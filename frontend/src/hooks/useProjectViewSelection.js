/**
 * useProjectViewSelection Hook
 *
 * Centralizes selection state management for Project View tables.
 * Provides selection tracking, bulk actions, and UI components (banner, dropdown).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Edit3 } from 'lucide-react';
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
    const [isSelectingAllPages, setIsSelectingAllPages] = useState(false);

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
            // Set loading state
            setIsSelectingAllPages(true);

            // Build URL to fetch all rows
            const fetchAllUrl = apiUrl.includes('?')
                ? `${apiUrl}&page_size=All`
                : `${apiUrl}?page_size=All`;

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
        } finally {
            // Clear loading state
            setIsSelectingAllPages(false);
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

    /**
     * Unmark selected items for deletion (sets delete_me=false)
     * Updates table data in-place to reflect the change
     */
    const handleUnmarkForDeletion = useCallback(async () => {
        if (selectedRows.size === 0) {
            alert('Please select at least one item to unmark for deletion.');
            return;
        }

        try {
            const selectedIds = Array.from(selectedRows);
            console.log(`Unmarking ${entityType}s for deletion:`, selectedIds);

            // Call API to update junction table delete_me to false
            const promises = selectedIds.map(entityId =>
                api.post(`${API_URL}/api/core/projects/${activeProjectId}/unmark-${entityType}-deletion/`, {
                    [`${entityType}_id`]: entityId
                })
            );

            await Promise.all(promises);

            // Update table data in-place to reflect the change
            // The project_action will be restored to the original action value
            const hadDirtyChanges = tableRef.current?.hasChanges;
            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                // Reload the data to get the correct action value from the server
                // We don't know what the original action was, so we need to fetch it
                await tableRef.current?.reloadData();
            }

            // Clear selection state
            setSelectedRows(new Set());
            setShowSelectAllBanner(false);
            setShowActionsDropdown(false);

            alert(`Successfully unmarked ${selectedIds.length} item(s) for deletion.`);
        } catch (error) {
            console.error('Error unmarking items for deletion:', error);
            alert('Failed to unmark items for deletion. Please try again.');
        }
    }, [selectedRows, activeProjectId, entityType, API_URL, handleClearSelection, tableRef]);

    // Banner Slot Component - Always reserves space to prevent layout shift
    const BannerSlot = useCallback(() => {
        // Determine which banner to show (if any)
        const showCustomerViewBanner = projectFilter !== 'current';
        const showSelectAllBannerContent = showSelectAllBanner && projectFilter === 'current';
        const showProjectWorkBanner = projectFilter === 'current' && !showSelectAllBanner;

        // Always render container with fixed min-height to reserve space
        return (
            <div style={{
                minHeight: '52px',
                visibility: (showCustomerViewBanner || showSelectAllBannerContent || showProjectWorkBanner) ? 'visible' : 'hidden'
            }}>
                {/* Customer View Banner (Read-only mode notification) */}
                {showCustomerViewBanner && (
                    <div style={{
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1px solid var(--border-color)',
                        borderLeft: '4px solid var(--color-accent-emphasis)',
                        borderRadius: '6px',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--color-accent-emphasis)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span style={{ color: 'var(--primary-text)', fontSize: '14px' }}>
                                <strong>Customer View is read-only.</strong> Switch to <strong>Project View</strong> to edit cells.
                            </span>
                        </div>
                    </div>
                )}

                {/* Select All Banner (shown in Project View when all page items selected) */}
                {showSelectAllBannerContent && (
                    <div style={{
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        <span style={{ color: 'var(--primary-text)', fontSize: '14px' }}>
                            {isSelectingAllPages ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    <strong>Selecting all {totalRowCount} {entityType} across all pages...</strong>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </span>
                        {!isSelectingAllPages && (
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
                        )}
                    </div>
                )}

                {/* Project Work Banner (shown in Project View when not selecting all) */}
                {showProjectWorkBanner && (
                    <div style={{
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1px solid var(--border-color)',
                        borderLeft: '4px solid var(--color-accent-emphasis)',
                        borderRadius: '6px',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Edit3
                                size={20}
                                color="var(--color-accent-emphasis)"
                                strokeWidth={2}
                            />
                            <span style={{ color: 'var(--primary-text)', fontSize: '14px' }}>
                                <strong>Project View:</strong> Edit items here. Commit changes to deploy to Customer View.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    }, [projectFilter, showSelectAllBanner, selectedRows.size, totalRowCount, entityType, handleSelectAllPages, handleClearSelection, isSelectingAllPages]);

    // Actions Dropdown Component
    const ActionsDropdown = useCallback(() => {
        if (projectFilter !== 'current') {
            return null;
        }

        return (
            <div className="table-dropdown">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (selectedRows.size > 0) {
                            setShowActionsDropdown(!showActionsDropdown);
                        }
                    }}
                    disabled={selectedRows.size === 0}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: selectedRows.size === 0
                            ? 'var(--table-toolbar-bg)'
                            : 'var(--button-secondary-bg)',
                        color: selectedRows.size === 0
                            ? 'var(--muted-text)'
                            : 'var(--table-toolbar-text)',
                        border: '1px solid var(--table-pagination-button-border)',
                        borderRadius: '6px',
                        cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: selectedRows.size === 0 ? 0.6 : 1
                    }}
                    title={selectedRows.size === 0 ? 'Select items to perform actions' : 'Bulk actions'}
                >
                    Actions ({selectedRows.size}) {selectedRows.size > 0 && (showActionsDropdown ? '▲' : '▼')}
                </button>
                {showActionsDropdown && selectedRows.size > 0 && (
                    <ul
                        className="table-dropdown-menu"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <li>
                            <button
                                className="table-dropdown-item"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowActionsDropdown(false);
                                    handleMarkForDeletion();
                                }}
                                style={{
                                    color: 'var(--color-danger-fg)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-danger-subtle)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <Trash2 size={16} />
                                Mark for Deletion
                            </button>
                        </li>
                        <li>
                            <button
                                className="table-dropdown-item"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowActionsDropdown(false);
                                    handleUnmarkForDeletion();
                                }}
                                style={{
                                    color: 'var(--color-success-fg)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-success-subtle)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <Trash2 size={16} />
                                Unmark for Deletion
                            </button>
                        </li>
                    </ul>
                )}
            </div>
        );
    }, [projectFilter, selectedRows.size, showActionsDropdown, handleMarkForDeletion, handleUnmarkForDeletion]);

    return {
        selectedRows,
        selectedRowsRef,
        showSelectAllBanner,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        handleUnmarkForDeletion,
        BannerSlot,
        ActionsDropdown
    };
};
