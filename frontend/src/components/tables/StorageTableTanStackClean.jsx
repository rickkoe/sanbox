import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Storage management
const StorageTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state ('all' = Customer View, 'current' = Project View)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('storageTableProjectFilter') || 'all'
    );

    const [showBulkModal, setShowBulkModal] = useState(false); // Bulk add/remove modal
    const [allCustomerStorage, setAllCustomerStorage] = useState([]); // All customer storage for bulk modal
    const [selectedRows, setSelectedRows] = useState(new Set()); // Selected row IDs for bulk actions
    const [showActionsDropdown, setShowActionsDropdown] = useState(false); // Actions dropdown state
    const [showSelectAllBanner, setShowSelectAllBanner] = useState(false); // Show banner to select all pages
    const [totalRowCount, setTotalRowCount] = useState(0); // Total rows in table

    // Ref to track selected rows for preprocessData
    const selectedRowsRef = useRef(new Set());

    // Keep ref in sync with state
    useEffect(() => {
        selectedRowsRef.current = selectedRows;
    }, [selectedRows]);

    // Auto-switch to Customer View when no project is selected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            setProjectFilter('all');
            localStorage.setItem('storageTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

    // Force _selected column to be visible when switching to Project View
    // Run multiple times to catch both initial load and database state load
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const checkAndForceVisibility = () => {
                const currentVisibility = tableRef.current?.getColumnVisibility?.();
                // Check if _selected is either missing or explicitly false
                if (currentVisibility && (currentVisibility['_selected'] === false || currentVisibility['_selected'] === undefined)) {
                    // Silently force visibility - no console log needed
                    tableRef.current?.setColumnVisibility?.({ ...currentVisibility, '_selected': true });
                }
            };

            // Run immediately
            checkAndForceVisibility();

            // Run again after short delay (for initial render)
            const timer1 = setTimeout(checkAndForceVisibility, 100);

            // Run again after longer delay (for database state load)
            const timer2 = setTimeout(checkAndForceVisibility, 500);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [projectFilter]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('storageTableProjectFilter', newFilter);
        // Reload table data with new filter
        if (tableRef.current && tableRef.current.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Load all customer storage when modal opens
    useEffect(() => {
        const loadAllCustomerStorage = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    // Fetch all customer storage with project membership info
                    const response = await api.get(`${API_URL}/api/storage/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerStorage(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer storage:', error);
                }
            }
        };

        loadAllCustomerStorage();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding storage to project
    const handleAddStorageToProject = useCallback(async (storageId, action = 'reference') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return false;
            }

            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-storage/`, {
                storage_id: storageId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });

            if (response.data.success) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding storage to project:', error);
            alert(`Failed to add storage: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // API endpoints - dynamically determined based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;

        // Use different endpoint based on filter mode and project availability
        let storageUrl;
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Use merged data endpoint (only project entities with overrides applied)
            storageUrl = `${baseUrl}/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer View with project: Use regular endpoint with project filter
            storageUrl = `${baseUrl}/project/${activeProjectId}/?project_filter=${projectFilter}`;
        } else {
            // Customer View without project: Use customer-level endpoint
            storageUrl = `${baseUrl}/?customer=${activeCustomerId}`;
        }

        return {
            storage: storageUrl,
            storageSave: `${baseUrl}/save/`,
            storageDelete: `${baseUrl}/delete/`
        };
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId]);

    // Handler to select all rows across all pages
    const handleSelectAllPages = useCallback(async () => {
        try {
            // Build URL to fetch all rows (add page_size parameter)
            const fetchAllUrl = API_ENDPOINTS.storage.includes('?')
                ? `${API_ENDPOINTS.storage}&page_size=10000`
                : `${API_ENDPOINTS.storage}?page_size=10000`;

            const response = await api.get(fetchAllUrl);
            const allData = response.data.results || response.data;

            // Get all IDs
            const allIds = allData.map(row => row.id).filter(id => id);

            // Update table data to set _selected = true for all rows on current page
            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                const updatedData = currentData.map(row => ({
                    ...row,
                    _selected: true // Select all rows on current page
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
    }, [API_ENDPOINTS.storage]);

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
    }, []);

    // Handler for marking selected rows for deletion
    const handleMarkForDeletion = useCallback(async () => {
        if (selectedRows.size === 0) {
            alert('Please select at least one item to mark for deletion.');
            return;
        }

        try {
            const selectedIds = Array.from(selectedRows);
            console.log('Marking storage for deletion:', selectedIds);

            // Call API to update junction table action to 'delete'
            const promises = selectedIds.map(storageId =>
                api.post(`${API_URL}/api/core/projects/${activeProjectId}/mark-storage-deletion/`, {
                    storage_id: storageId,
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
    }, [selectedRows, activeProjectId, API_URL, handleClearSelection]);

    // Handle bulk storage save
    const handleBulkStorageSave = useCallback(async (selectedIds) => {
        try {
            console.log('🔄 Bulk storage save started with selected IDs:', selectedIds);

            if (!allCustomerStorage || allCustomerStorage.length === 0) {
                console.error('No customer storage available');
                return;
            }

            // Get current storage in project
            const currentInProject = new Set(
                allCustomerStorage
                    .filter(storage => storage.in_active_project)
                    .map(storage => storage.id)
            );

            // Determine adds and removes
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            console.log('📊 Bulk operation:', { toAdd: toAdd.length, toRemove: toRemove.length });

            let successCount = 0;
            let errorCount = 0;

            // Process additions
            for (const storageId of toAdd) {
                try {
                    const success = await handleAddStorageToProject(storageId, 'reference');
                    if (success) successCount++;
                    else errorCount++;
                } catch (error) {
                    console.error(`Failed to add storage ${storageId}:`, error);
                    errorCount++;
                }
            }

            // Process removals
            for (const storageId of toRemove) {
                try {
                    const response = await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-storage/${storageId}/`);
                    if (response.data.success) {
                        successCount++;
                        console.log(`✅ Removed storage ${storageId} from project`);
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Failed to remove storage ${storageId}:`, error);
                    errorCount++;
                }
            }

            console.log(`✅ Bulk operation complete: ${successCount} successful, ${errorCount} errors`);

            // Reload table data
            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }

            // Close modal
            setShowBulkModal(false);

            // Show summary
            if (errorCount > 0) {
                alert(`Bulk operation completed with errors:\n${successCount} successful\n${errorCount} failed`);
            }
        } catch (error) {
            console.error('❌ Error in bulk storage save:', error);
            alert(`Bulk operation failed: ${error.message}`);
        }
    }, [allCustomerStorage, activeProjectId, API_URL, handleAddStorageToProject]);

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    // Make read-only if: 1) user doesn't have permissions, OR 2) viewing customer view (not project view)
    const isReadOnly = !canEditInfrastructure || projectFilter === 'all';

    // Core storage columns (most commonly used)
    const columns = useMemo(() => {
        const allColumns = [];

        // Add selection checkbox column only in Project View
        if (projectFilter === 'current') {
            allColumns.push({
                data: "_selected",
                title: "Select",  // Single space to prevent fallback to column.data
                type: "checkbox",
                readOnly: false,
                width: 60,
                defaultVisible: true,
                // Ensure this column is treated as a checkbox column
                accessorKey: "_selected"
            });
        }

        allColumns.push(
        { data: "id", title: "Details", type: "custom", readOnly: true },
        { data: "name", title: "Name", required: true },
        { data: "storage_type", title: "Type", type: "dropdown" },
        { data: "location", title: "Location" },
        { data: "storage_system_id", title: "Storage System ID", defaultVisible: false },
        { data: "machine_type", title: "Machine Type" },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number", defaultVisible: false },
        { data: "db_volumes_count", title: "DB Volumes", type: "numeric", readOnly: true },
        { data: "db_hosts_count", title: "DB Hosts", type: "numeric", readOnly: true },
        { data: "db_aliases_count", title: "DB Aliases", type: "numeric", readOnly: true },
        { data: "system_id", title: "System ID", defaultVisible: false },
        { data: "wwnn", title: "WWNN", defaultVisible: false },
        { data: "firmware_level", title: "Firmware Level", defaultVisible: false },
        { data: "primary_ip", title: "Primary IP", defaultVisible: false },
        { data: "secondary_ip", title: "Secondary IP", defaultVisible: false },
        { data: "vendor", title: "Vendor" },
        { data: "condition", title: "Condition" },
        { data: "probe_status", title: "Probe Status", defaultVisible: false },
        { data: "capacity_bytes", title: "Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "used_capacity_bytes", title: "Used Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "available_capacity_bytes", title: "Available Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "volumes_count", title: "SI Volumes Count", type: "numeric", defaultVisible: false },
        { data: "pools_count", title: "Pools Count", type: "numeric", defaultVisible: false },
        { data: "disks_count", title: "Disks Count", type: "numeric", defaultVisible: false },
        { data: "fc_ports_count", title: "FC Ports Count", type: "numeric", defaultVisible: false },
        { data: "notes", title: "Notes" },
        { data: "imported", title: "Imported", readOnly: true, defaultVisible: false },
        { data: "updated", title: "Updated", readOnly: true, defaultVisible: false }
        );

        return allColumns;
    }, [projectFilter]);

    const colHeaders = columns.map(col => col.title);

    const NEW_STORAGE_TEMPLATE = useMemo(() => ({
        id: null,
        name: "",
        _selected: false, // Selection checkbox state
        storage_type: "",
        location: "",
        storage_system_id: "",
        machine_type: "",
        model: "",
        serial_number: "",
        db_volumes_count: 0,
        db_hosts_count: 0,
        db_aliases_count: 0,
        system_id: "",
        wwnn: "",
        firmware_level: "",
        primary_ip: "",
        secondary_ip: "",
        vendor: "",
        condition: "",
        probe_status: "",
        capacity_bytes: null,
        used_capacity_bytes: null,
        available_capacity_bytes: null,
        volumes_count: 0,
        pools_count: 0,
        disks_count: 0,
        fc_ports_count: 0,
        notes: "",
        imported: null,
        updated: null
    }), []);

    // Dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_type: ["FlashSystem", "DS8000", "Switch", "Data Domain"]
    }), []);

    // Custom renderers for special columns
    const customRenderers = useMemo(() => ({
        id: (rowData, td, row, col, prop, value) => {
            console.log('📋 Details renderer called with:', { rowData, value, hasId: !!rowData?.id });

            // Check both rowData.id and the actual value parameter
            const storageId = rowData?.id || value;

            if (!storageId) {
                console.log('📋 No storage ID found, rendering empty cell');
                return { __isReactComponent: true, component: null };
            }

            console.log('📋 Rendering Details button for storage ID:', storageId);
            return {
                __isReactComponent: true,
                component: (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔗 Button clicked! Navigating to:', `/storage/${storageId}`);
                            navigate(`/storage/${storageId}`);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        Details
                    </button>
                )
            };
        },
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            // Just return the value - styling will be handled by CSS
            return value || "";
        }
    }), [navigate, activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(storage => {
            // Check if this row should be selected (either from data or from selectedRowsRef)
            const shouldBeSelected = storage._selected !== undefined
                ? storage._selected
                : (storage.id && selectedRowsRef.current.has(storage.id));

            return {
                ...storage,
                saved: !!storage.id,
                // Selection state - check if ID is in selectedRowsRef
                _selected: shouldBeSelected
            };
        });
    }, []);

    // Transform data for saving
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Ensure required fields are present and non-empty
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Storage";
            }

            if (!payload.storage_type || payload.storage_type.trim() === "") {
                payload.storage_type = "DS8000";
            }

            // Add the customer ID from the context
            payload.customer = activeCustomerId;

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name" && key !== "storage_type") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [activeCustomerId]);

    // Track total row count from table
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setInterval(() => {
                const paginationInfo = tableRef.current?.getPaginationInfo?.();
                if (paginationInfo && paginationInfo.totalItems !== totalRowCount) {
                    setTotalRowCount(paginationInfo.totalItems);
                }
            }, 500);

            return () => clearInterval(timer);
        }
    }, [projectFilter, totalRowCount]);

    // Sync selectedRows with table data - runs when checkbox values change
    // This updates the Actions button count without reloading the table
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setInterval(() => {
                const currentData = tableRef.current?.getTableData();
                if (currentData && currentData.length > 0) {
                    // Merge approach: start with existing selectedRows, then update based on current page
                    const updatedSelectedRows = new Set(selectedRows);

                    // Get current page IDs
                    const currentPageIds = new Set(currentData.map(row => row.id).filter(id => id));

                    // For each row on current page, add or remove from selection based on checkbox
                    currentData.forEach(row => {
                        if (row.id) {
                            if (row._selected) {
                                updatedSelectedRows.add(row.id);
                            } else if (currentPageIds.has(row.id)) {
                                // Only remove if this ID is on the current page (user explicitly unchecked it)
                                updatedSelectedRows.delete(row.id);
                            }
                        }
                    });

                    // Check if all rows on current page are selected
                    const allCurrentPageSelected = currentData.every(row => row._selected);
                    const hasSelectionsOnPage = currentData.some(row => row._selected);

                    // Show banner if: all current page rows selected, but not all total rows
                    if (allCurrentPageSelected && hasSelectionsOnPage && updatedSelectedRows.size < totalRowCount && totalRowCount > 0) {
                        setShowSelectAllBanner(true);
                    } else if (updatedSelectedRows.size === 0) {
                        // Hide banner when nothing is selected
                        setShowSelectAllBanner(false);
                    } else if (updatedSelectedRows.size === totalRowCount) {
                        // Hide banner when all rows are already selected
                        setShowSelectAllBanner(false);
                    }

                    // Only update if different (avoid unnecessary re-renders)
                    if (updatedSelectedRows.size !== selectedRows.size ||
                        [...updatedSelectedRows].some(id => !selectedRows.has(id))) {
                        setSelectedRows(updatedSelectedRows);
                    }
                }
            }, 200); // Check every 200ms

            return () => clearInterval(timer);
        }
    }, [projectFilter, selectedRows, totalRowCount]);

    // Close actions dropdown when clicking outside
    useEffect(() => {
        if (showActionsDropdown) {
            const handleClickOutside = () => setShowActionsDropdown(false);
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showActionsDropdown]);

    // Project filter toggle buttons for toolbar
    const filterToggleButtons = (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Actions Dropdown - Only show in Project View */}
            {projectFilter === 'current' && (
                <div style={{ position: 'relative' }}>
                    <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (selectedRows.size > 0) {
                                setShowActionsDropdown(!showActionsDropdown);
                            }
                        }}
                        style={{
                            padding: '10px 18px',
                            fontSize: '14px',
                            fontWeight: '500',
                            borderRadius: '6px',
                            transition: 'all 0.2s ease',
                            minWidth: '120px',
                            opacity: selectedRows.size === 0 ? 0.5 : 1,
                            cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer'
                        }}
                        disabled={selectedRows.size === 0}
                    >
                        Actions ({selectedRows.size}) {selectedRows.size > 0 && (showActionsDropdown ? '▲' : '▼')}
                    </button>
                    {showActionsDropdown && selectedRows.size > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '4px',
                                backgroundColor: 'var(--secondary-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                minWidth: '200px'
                            }}
                        >
                            <button
                                onClick={() => {
                                    handleMarkForDeletion();
                                    setShowActionsDropdown(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'var(--text-color)',
                                    fontSize: '14px',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Mark for Deletion
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
            {/* Customer View Button */}
            <button
                type="button"
                className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{
                    borderRadius: '6px 0 0 6px',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
                    transition: 'all 0.2s ease',
                    marginRight: '0',
                    minWidth: '140px'
                }}
            >
                Customer View
            </button>

            {/* Project View Button - Disabled if no active project */}
            <button
                type="button"
                className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('current')}
                disabled={!activeProjectId}
                style={{
                    borderRadius: '0',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '140px'
                }}
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only storage systems in this project'}
            >
                Project View
            </button>

            {/* Manage Project Button - Disabled if no active project */}
            <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/settings/project')}
                disabled={!activeProjectId}
                style={{
                    borderRadius: '0',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '140px'
                }}
                title={!activeProjectId ? 'Select a project to manage' : 'Manage active project'}
            >
                Manage Project
            </button>

            {/* Bulk Add/Remove Button - Disabled if no active project */}
            <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowBulkModal(true)}
                disabled={!activeProjectId}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '0 6px 6px 0',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}
                title={!activeProjectId ? 'Select a project to add/remove storage' : 'Bulk add or remove storage from this project'}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Checklist icon */}
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </button>
            </div>
        </div>
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="storage systems" />;
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && !canEditInfrastructure && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure (Fabrics and Storage).
                </div>
            )}
            {isReadOnly && canEditInfrastructure && projectFilter === 'all' && (
                <div className="alert alert-warning mb-3" role="alert">
                    <strong>Customer View is read-only.</strong> Switch to Project View to add, edit, or delete storage.
                </div>
            )}

            {/* Select All Pages Banner */}
            {showSelectAllBanner && projectFilter === 'current' && (
                <div
                    style={{
                        backgroundColor: 'var(--color-accent-subtle)',
                        border: '1px solid var(--color-accent-muted)',
                        borderRadius: '6px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span style={{ color: 'var(--primary-text)', fontSize: '14px' }}>
                            All <strong>{selectedRows.size}</strong> items on this page are selected.{' '}
                            <button
                                onClick={handleSelectAllPages}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--link-text)',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    padding: 0,
                                    font: 'inherit',
                                    fontWeight: '600'
                                }}
                            >
                                Select all {totalRowCount} items
                            </button>
                        </span>
                    </div>
                    <button
                        onClick={handleClearSelection}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-text)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '14px',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        title="Clear selection"
                    >
                        ✕
                    </button>
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={API_ENDPOINTS.storage}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="storage"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_STORAGE_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`storage-table-${activeCustomerId || 'default'}-${projectFilter}`}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Storage save successful:', result.message);
                    } else {
                        console.error('❌ Storage save failed:', result.message);
                        alert('Error saving storage systems: ' + result.message);
                    }
                }}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkStorageSave}
                items={allCustomerStorage}
                itemType="storage"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default StorageTableTanStackClean;