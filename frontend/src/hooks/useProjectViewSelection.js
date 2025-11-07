/**
 * useProjectViewSelection Hook
 *
 * Centralizes selection state management for Project View tables.
 * Provides selection tracking, bulk actions, and UI components (banner, dropdown).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../api';

/**
 * @param {Object} options
 * @param {Object} options.tableRef - Ref to the TanStackCRUDTable instance
 * @param {string} options.projectFilter - Current filter: 'all' | 'current' | 'not_in_project'
 * @param {number|null} options.activeProjectId - Active project ID
 * @param {string} options.apiUrl - Full API URL for fetching data
 * @param {string} options.entityType - Entity type (e.g., 'alias', 'zone', 'fabric')
 * @param {string} options.API_URL - Base API URL (e.g., process.env.REACT_APP_API_URL)
 * @param {number|null} options.totalRowCount - Total number of rows across all pages
 * @returns {Object} Selection state, handlers, and components
 */
export const useProjectViewSelection = ({
    tableRef,
    projectFilter,
    activeProjectId,
    apiUrl,
    entityType,
    API_URL,
    totalRowCount
}) => {
    // Selection state
    const [selectedRows, setSelectedRows] = useState(new Set());
    const selectedRowsRef = useRef(new Set());
    const [showSelectAllBanner, setShowSelectAllBanner] = useState(false);
    const [showActionsDropdown, setShowActionsDropdown] = useState(false);

    // Sync ref with state for stable access in callbacks
    useEffect(() => {
        selectedRowsRef.current = selectedRows;
    }, [selectedRows]);

    // Force _selected column visibility in Project View
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const checkAndForceVisibility = () => {
                const currentVisibility = tableRef.current?.getColumnVisibility?.();
                if (currentVisibility && (currentVisibility['_selected'] === false ||
                    currentVisibility['_selected'] === undefined)) {
                    tableRef.current?.setColumnVisibility?.({
                        ...currentVisibility, '_selected': true
                    });
                }
            };

            checkAndForceVisibility();
            const timer1 = setTimeout(checkAndForceVisibility, 100);
            const timer2 = setTimeout(checkAndForceVisibility, 500);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [projectFilter, tableRef]);

    // Sync selectedRows with table data when checkbox values change
    // Poll every 300ms to detect checkbox changes
    useEffect(() => {
        if (projectFilter === 'current') {
            const checkCheckboxChanges = () => {
                const currentData = tableRef.current?.getTableData();
                if (!currentData || currentData.length === 0) return;

                // Merge approach: start with existing selectedRows, then update based on current page
                const updatedSelectedRows = new Set(selectedRowsRef.current);

                currentData.forEach(row => {
                    if (row._selected && row.id) {
                        updatedSelectedRows.add(row.id);
                    } else if (!row._selected && row.id) {
                        updatedSelectedRows.delete(row.id);
                    }
                });

                // Update state only if there are actual changes
                if (updatedSelectedRows.size !== selectedRowsRef.current.size ||
                    [...updatedSelectedRows].some(id => !selectedRowsRef.current.has(id))) {
                    setSelectedRows(updatedSelectedRows);
                }

                // Show banner if all rows on page selected but not all across all pages
                const pageSize = currentData.length;
                const selectedOnPage = currentData.filter(row => row._selected).length;
                const shouldShowBanner =
                    selectedOnPage > 0 &&
                    selectedOnPage === pageSize &&
                    totalRowCount &&
                    updatedSelectedRows.size < totalRowCount;

                // Debug logging
                if (selectedOnPage > 0 || updatedSelectedRows.size > 0) {
                    console.log('🔔 Banner check:', {
                        pageSize,
                        selectedOnPage,
                        totalRowCount,
                        selectedRowsSize: updatedSelectedRows.size,
                        shouldShowBanner,
                        conditions: {
                            hasSelected: selectedOnPage > 0,
                            allOnPageSelected: selectedOnPage === pageSize,
                            hasTotalCount: !!totalRowCount,
                            notAllPagesSelected: updatedSelectedRows.size < totalRowCount
                        }
                    });
                }

                if (shouldShowBanner !== showSelectAllBanner) {
                    console.log('🔔 Setting banner visibility to:', shouldShowBanner);
                    setShowSelectAllBanner(shouldShowBanner);
                }

                // Close actions dropdown if no items selected
                if (updatedSelectedRows.size === 0 && showActionsDropdown) {
                    setShowActionsDropdown(false);
                }
            };

            // Initial check
            checkCheckboxChanges();

            // Poll for changes
            const intervalId = setInterval(checkCheckboxChanges, 300);

            return () => clearInterval(intervalId);
        } else {
            // Clear selection when not in Project View
            if (selectedRows.size > 0) {
                setSelectedRows(new Set());
            }
            if (showSelectAllBanner) {
                setShowSelectAllBanner(false);
            }
            if (showActionsDropdown) {
                setShowActionsDropdown(false);
            }
        }
    }, [projectFilter, totalRowCount, tableRef]);

    // Handler to select all rows across all pages
    const handleSelectAllPages = useCallback(async () => {
        try {
            // Build URL to fetch all rows
            const fetchAllUrl = apiUrl.includes('?')
                ? `${apiUrl}&page_size=10000`
                : `${apiUrl}?page_size=10000`;

            const response = await api.get(fetchAllUrl);
            const allData = response.data.results || response.data;

            // Get all IDs
            const allIds = allData.map(row => row.id).filter(id => id);

            // Update table data to set _selected = true for all rows on current page
            // Follow CLAUDE.md pattern: check for dirty state first
            const hadDirtyChanges = tableRef.current?.hasChanges;
            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                const updatedData = currentData.map(row => ({
                    ...row,
                    _selected: true
                }));

                // Choose update method based on dirty state
                if (hadDirtyChanges) {
                    // Preserve existing dirty state
                    tableRef.current?.setTableData(updatedData);
                } else {
                    // Silent update - no dirty state triggered
                    tableRef.current?.updateTableDataSilently(updatedData);
                }
            }

            // Update selectedRows state with ALL IDs from all pages
            setSelectedRows(new Set(allIds));

            // Hide the banner
            setShowSelectAllBanner(false);
        } catch (error) {
            console.error('Error selecting all pages:', error);
            alert('Failed to select all rows. Please try again.');
        }
    }, [apiUrl, tableRef]);

    // Handler to clear all selections
    const handleClearSelection = useCallback(() => {
        // Follow CLAUDE.md pattern: check for dirty state first
        const hadDirtyChanges = tableRef.current?.hasChanges;
        const currentData = tableRef.current?.getTableData();
        if (currentData) {
            const clearedData = currentData.map(row => ({
                ...row,
                _selected: false
            }));

            // Choose update method based on dirty state
            if (hadDirtyChanges) {
                // Preserve existing dirty state
                tableRef.current?.setTableData(clearedData);
            } else {
                // Silent update - no dirty state triggered
                tableRef.current?.updateTableDataSilently(clearedData);
            }
        }

        setSelectedRows(new Set());
        setShowSelectAllBanner(false);
        setShowActionsDropdown(false);
    }, [tableRef]);

    // Handler for marking selected rows for deletion
    const handleMarkForDeletion = useCallback(async () => {
        if (selectedRows.size === 0) {
            alert('Please select at least one item to mark for deletion.');
            return;
        }

        try {
            const selectedIds = Array.from(selectedRows);
            console.log(`Marking ${entityType}s for deletion:`, selectedIds);

            // Call API to update junction table action to 'delete'
            const promises = selectedIds.map(entityId =>
                api.post(`${API_URL}/api/core/projects/${activeProjectId}/mark-${entityType}-deletion/`, {
                    [`${entityType}_id`]: entityId,
                    action: 'delete'
                })
            );

            await Promise.all(promises);

            // Update table data in-place to reflect the deletion marker
            // Follow CLAUDE.md pattern: update without reloading to preserve dirty data
            const hadDirtyChanges = tableRef.current?.hasChanges;
            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                const updatedData = currentData.map(row => {
                    if (selectedIds.includes(row.id)) {
                        return {
                            ...row,
                            project_action: 'delete',
                            _selected: false
                        };
                    }
                    return row;
                });

                // Choose update method based on dirty state
                if (hadDirtyChanges) {
                    // Preserve existing dirty state
                    tableRef.current?.setTableData(updatedData);
                } else {
                    // Silent update - no dirty state triggered
                    tableRef.current?.updateTableDataSilently(updatedData);
                }
            }

            // Clear selection state
            setSelectedRows(new Set());
            setShowSelectAllBanner(false);
            setShowActionsDropdown(false);

            alert(`Successfully marked ${selectedIds.length} item(s) for deletion.`);
        } catch (error) {
            console.error('Error marking items for deletion:', error);
            alert('Failed to mark items for deletion. Please try again.');
        }
    }, [selectedRows, activeProjectId, entityType, API_URL, handleClearSelection, tableRef]);

    // Select All Banner Component
    const SelectAllBanner = useCallback(() => {
        if (!showSelectAllBanner || projectFilter !== 'current') {
            return null;
        }

        return (
            <div style={{
                backgroundColor: 'var(--secondary-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '14px 18px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
                <span style={{ color: 'var(--primary-text)', fontSize: '14px' }}>
                    All <strong>{selectedRows.size}</strong> items on this page are selected.{' '}
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            console.log('🔗 Select all pages link clicked');
                            handleSelectAllPages();
                        }}
                        style={{
                            color: 'var(--link-text)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        Select all {totalRowCount} {entityType} across all pages?
                    </a>
                </span>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        console.log('🔗 Clear selection clicked');
                        handleClearSelection();
                    }}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--link-text)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '14px',
                        padding: '4px 8px'
                    }}
                >
                    Clear selection
                </button>
            </div>
        );
    }, [showSelectAllBanner, projectFilter, selectedRows.size, totalRowCount, entityType, handleSelectAllPages, handleClearSelection]);

    // Actions Dropdown Component
    const ActionsDropdown = useCallback(() => {
        if (projectFilter !== 'current') {
            return null;
        }

        return (
            <div style={{ position: 'relative' }}>
                <button
                    className="btn btn-outline-secondary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: selectedRows.size === 0 ? 0.5 : 1,
                        cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                    disabled={selectedRows.size === 0}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (selectedRows.size > 0) {
                            setShowActionsDropdown(!showActionsDropdown);
                        }
                    }}
                >
                    Actions ({selectedRows.size}) {selectedRows.size > 0 && (showActionsDropdown ? '▲' : '▼')}
                </button>
                {showActionsDropdown && selectedRows.size > 0 && (
                    <div
                        className="dropdown-menu show"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            zIndex: 1050,
                            marginTop: '4px',
                            minWidth: '200px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="dropdown-item"
                            onClick={() => {
                                setShowActionsDropdown(false);
                                handleMarkForDeletion();
                            }}
                        >
                            <span style={{ color: 'var(--color-danger-fg)' }}>Mark for Deletion</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }, [projectFilter, selectedRows.size, showActionsDropdown, handleMarkForDeletion]);

    return {
        selectedRows,
        selectedRowsRef,
        showSelectAllBanner,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        SelectAllBanner,
        ActionsDropdown
    };
};
