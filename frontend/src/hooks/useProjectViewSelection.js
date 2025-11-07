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
    useEffect(() => {
        if (projectFilter === 'current') {
            const currentData = tableRef.current?.getTableData();
            if (currentData && currentData.length > 0) {
                // Merge approach: start with existing selectedRows, then update based on current page
                const updatedSelectedRows = new Set(selectedRows);

                currentData.forEach(row => {
                    if (row._selected && row.id) {
                        updatedSelectedRows.add(row.id);
                    } else if (!row._selected && row.id) {
                        updatedSelectedRows.delete(row.id);
                    }
                });

                // Update state only if there are actual changes
                if (updatedSelectedRows.size !== selectedRows.size ||
                    [...updatedSelectedRows].some(id => !selectedRows.has(id))) {
                    setSelectedRows(updatedSelectedRows);
                }
            }

            // Show banner if some rows selected but not all
            const pageSize = currentData?.length || 0;
            const selectedOnPage = currentData?.filter(row => row._selected).length || 0;
            setShowSelectAllBanner(
                selectedOnPage > 0 &&
                selectedOnPage === pageSize &&
                totalRowCount &&
                selectedRows.size < totalRowCount
            );
        }
    }, [projectFilter, selectedRows, totalRowCount, tableRef]);

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
            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                const updatedData = currentData.map(row => ({
                    ...row,
                    _selected: true
                }));
                tableRef.current?.updateTableDataSilently(updatedData);
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
        // Update table data to set _selected = false for all rows
        const currentData = tableRef.current?.getTableData();
        if (currentData) {
            const clearedData = currentData.map(row => ({
                ...row,
                _selected: false
            }));
            tableRef.current?.updateTableDataSilently(clearedData);
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

            // Clear selection
            handleClearSelection();

            // Reload table to show updated data
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

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
                backgroundColor: 'var(--table-header-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '12px 16px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ color: 'var(--primary-text)' }}>
                    All <strong>{selectedRows.size}</strong> items on this page are selected.{' '}
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            handleSelectAllPages();
                        }}
                        style={{
                            color: 'var(--link-color)',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
                        Select all {totalRowCount} {entityType}s across all pages?
                    </a>
                </span>
                <button
                    onClick={handleClearSelection}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--link-color)',
                        cursor: 'pointer',
                        textDecoration: 'underline'
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
