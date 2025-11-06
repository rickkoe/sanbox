import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Host management
// Props:
// - storageId (optional): Filter hosts to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage_system'])
const HostTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { user, getUserRole } = useAuth();
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('hostTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerHosts, setAllCustomerHosts] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set()); // Selected row IDs for bulk actions
    const [showActionsDropdown, setShowActionsDropdown] = useState(false); // Actions dropdown state
    const [showSelectAllBanner, setShowSelectAllBanner] = useState(false); // Show banner to select all pages
    const [totalRowCount, setTotalRowCount] = useState(0); // Total rows in table

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Ref to track selected rows for preprocessData
    const selectedRowsRef = useRef(new Set());

    // Keep ref in sync with state
    useEffect(() => {
        selectedRowsRef.current = selectedRows;
    }, [selectedRows]);

    // Check permissions for modifying customer data
    const userRole = getUserRole(activeCustomerId);

    // Determine if user can modify customer infrastructure
    const isViewer = userRole === 'viewer';
    const isAdmin = userRole === 'admin';
    const isMember = userRole === 'member';

    const canModifyInfrastructure = !isViewer && (isMember || isAdmin);
    const canEditInfrastructure = canModifyInfrastructure; // Alias for consistency
    // Make read-only if: 1) user doesn't have permissions, OR 2) viewing customer view (not project view)
    const isReadOnly = !canModifyInfrastructure || projectFilter === 'all';

    // API endpoints - dynamically determined based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        let hostsUrl;
        if (projectFilter === 'current' && activeProjectId) {
            hostsUrl = `${baseUrl}/project/${activeProjectId}/view/hosts/`;
            console.log('🔧 HostTable - Building Project View endpoint:', hostsUrl);
        } else {
            hostsUrl = `${baseUrl}/hosts/`;
            console.log('🔧 HostTable - Building Customer View endpoint:', hostsUrl);
        }
        console.log('🔧 HostTable - API_ENDPOINTS updated. projectFilter:', projectFilter, 'activeProjectId:', activeProjectId);
        return {
            hosts: hostsUrl,
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/hosts/`,
            deleteUrl: `${baseUrl}/hosts/`
        };
    }, [API_URL, activeProjectId, projectFilter]);

    // All available host columns
    const allColumns = useMemo(() => {
        const cols = [];

        // Add selection checkbox column only in Project View
        if (projectFilter === 'current') {
            cols.push({
                data: "_selected",
                title: "Select",
                type: "checkbox",
                readOnly: false,
                width: 60,
                defaultVisible: true,
                accessorKey: "_selected"
            });
        }

        cols.push(
            { data: "name", title: "Host Name", required: true },
            { data: "storage_system", title: "Storage System", type: "dropdown" },
            { data: "wwpns", title: "WWPNs" },
            { data: "wwpn_status", title: "WWPN Status", type: "dropdown" },
            { data: "status", title: "Status", type: "dropdown" },
            { data: "host_type", title: "Host Type", type: "dropdown" },
            { data: "aliases_count", title: "Aliases Count", type: "numeric", readOnly: true },
            { data: "vols_count", title: "Volumes Count", type: "numeric", readOnly: true },
            { data: "fc_ports_count", title: "FC Ports Count", type: "numeric", readOnly: true },
            { data: "associated_resource", title: "Associated Resource" },
            { data: "volume_group", title: "Volume Group" },
            { data: "acknowledged", title: "Acknowledged", type: "dropdown" },
            { data: "last_data_collection", title: "Last Data Collection", readOnly: true },
            { data: "natural_key", title: "Natural Key" },
            { data: "create", title: "Create", type: "checkbox" },
            { data: "imported", title: "Imported", readOnly: true },
            { data: "updated", title: "Updated", readOnly: true }
        );

        return cols;
    }, [projectFilter]);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

    // Dynamic template - pre-populate storage system if storageId is provided
    const NEW_HOST_TEMPLATE = useMemo(() => {
        let storageSystemName = "";
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                storageSystemName = storageSystem.name;
            }
        }

        return {
            id: null,
            name: "",
            _selected: false, // Selection checkbox state
            storage_system: storageSystemName,
            wwpns: "",
            wwpn_status: "",
            status: "",
            host_type: "",
            aliases_count: 0,
            vols_count: 0,
            fc_ports_count: 0,
            associated_resource: "",
            volume_group: "",
            acknowledged: "",
            last_data_collection: null,
            natural_key: "",
            create: false,
            imported: null,
            updated: null
        };
    }, [storageId, storageOptions]);

    // Load storage systems for dropdown
    useEffect(() => {
        const loadStorageSystems = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);
                    console.log('Loading storage systems for host table...');

                    const response = await axios.get(`${API_ENDPOINTS.storage}?customer=${activeCustomerId}`);
                    const storageArray = response.data.results || response.data;
                    setStorageOptions(storageArray.map(s => ({ id: s.id, name: s.name })));

                    console.log('✅ Storage systems loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading storage systems:', error);
                    setLoading(false);
                }
            }
        };

        loadStorageSystems();
    }, [activeCustomerId]);

    // Auto-switch to Customer View when no project is selected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            setProjectFilter('all');
            localStorage.setItem('hostTableProjectFilter', 'all');
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
        console.log('🔄 HostTable - Filter changing from', projectFilter, 'to', newFilter);
        setProjectFilter(newFilter);
        localStorage.setItem('hostTableProjectFilter', newFilter);
        // Delay reload to ensure state has updated
        setTimeout(() => {
            if (tableRef.current && tableRef.current.reloadData) {
                console.log('🔄 HostTable - Calling reloadData()');
                tableRef.current.reloadData();
            }
        }, 100);
    }, [projectFilter]);

    // Load all customer hosts when modal opens
    useEffect(() => {
        const loadAllCustomerHosts = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    const response = await api.get(`${API_URL}/api/storage/hosts/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerHosts(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer hosts:', error);
                }
            }
        };
        loadAllCustomerHosts();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding host to project
    const handleAddHostToProject = useCallback(async (hostId, action = 'reference') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-host/`, {
                host_id: hostId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding host to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Build API URL with customer filter and optional storage filter
    // MUST be defined before handlers that use it (like handleSelectAllPages)
    const apiUrl = useMemo(() => {
        // Project view endpoint doesn't need customer param (gets it from project)
        // Customer view endpoint needs customer param
        if (projectFilter === 'current' && activeProjectId) {
            // Project view - no customer param needed
            const url = storageId ? `${API_ENDPOINTS.hosts}?storage_id=${storageId}` : API_ENDPOINTS.hosts;
            console.log('🔍 HostTable - Project View URL:', url, 'projectId:', activeProjectId);
            return url;
        } else {
            // Customer view - add customer param
            let url = `${API_ENDPOINTS.hosts}?customer=${activeCustomerId}`;
            if (storageId) {
                url += `&storage_id=${storageId}`;
            }
            console.log('🔍 HostTable - Customer View URL:', url, 'customerId:', activeCustomerId);
            return url;
        }
    }, [projectFilter, activeProjectId, API_ENDPOINTS.hosts, storageId, activeCustomerId]);

    // Handler to select all rows across all pages
    const handleSelectAllPages = useCallback(async () => {
        try {
            // Build URL to fetch all rows (add page_size parameter)
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
    }, [apiUrl]);

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
            console.log('Marking hosts for deletion:', selectedIds);

            // Call API to update junction table action to 'delete'
            const promises = selectedIds.map(hostId =>
                api.post(`${API_URL}/api/core/projects/${activeProjectId}/mark-host-deletion/`, {
                    host_id: hostId,
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

    // Handle bulk host save
    const handleBulkHostSave = useCallback(async (selectedIds) => {
        try {
            if (!allCustomerHosts || allCustomerHosts.length === 0) return;
            const currentInProject = new Set(allCustomerHosts.filter(h => h.in_active_project).map(h => h.id));
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            for (const hostId of toAdd) {
                await handleAddHostToProject(hostId, 'reference');
            }
            for (const hostId of toRemove) {
                await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-host/${hostId}/`);
            }

            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }
            setShowBulkModal(false);
        } catch (error) {
            console.error('Error in bulk host save:', error);
        }
    }, [allCustomerHosts, activeProjectId, API_URL, handleAddHostToProject]);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_system: storageOptions.map(s => s.name),
        wwpn_status: ["Active", "Inactive", "Error", "Unknown"],
        status: ["Online", "Offline", "Degraded", "Unknown"],
        host_type: ["Linux", "Windows", "AIX", "VMware", "Other"],
        acknowledged: ["Yes", "No", "Pending"]
    }), [storageOptions]);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        last_data_collection: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            // Just return the value - styling will be handled by CSS
            return value || "";
        }
    }), [activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(host => {
            // Check if this row should be selected (either from data or from selectedRowsRef)
            const shouldBeSelected = host._selected !== undefined
                ? host._selected
                : (host.id && selectedRowsRef.current.has(host.id));

            return {
                ...host,
                // Map wwpn_display to wwpns for table display
                wwpns: host.wwpn_display || host.wwpns || '',
                saved: !!host.id,
                // Selection state - check if ID is in selectedRowsRef
                _selected: shouldBeSelected
            };
        });

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(host => host.storage_system === storageSystem.name);
            }
        }

        return processedData;
    }, [storageId, storageOptions]);

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

    // Note: With the new storage/hosts API, we don't need a custom save handler
    // The hosts are created/updated via Storage Insights import, not manual CRUD
    // This component is now primarily for viewing hosts from storage systems

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
                <button type="button" className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handleFilterChange('all')}
                    style={{ borderRadius: '6px 0 0 6px', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', marginRight: '0', minWidth: '140px' }}>
                    Customer View
                </button>
                <button type="button" className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handleFilterChange('current')} disabled={!activeProjectId}
                    style={{ borderRadius: '0', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '140px' }}
                    title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only hosts in this project'}>
                    Project View
                </button>
                <button type="button" className="btn btn-outline-secondary"
                    onClick={() => navigate('/settings/project')} disabled={!activeProjectId}
                    style={{ borderRadius: '0', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '140px' }}
                    title={!activeProjectId ? 'Select a project to manage' : 'Manage active project'}>
                    Manage Project
                </button>
                <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setShowBulkModal(true)} disabled={!activeProjectId}
                    style={{ padding: '10px 18px', fontSize: '14px', fontWeight: '500', borderRadius: '0 6px 6px 0', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    title={!activeProjectId ? 'Select a project to add/remove hosts' : 'Bulk add or remove hosts from this project'}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                </button>
            </div>
        </div>
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="hosts" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading host data...</span>
                </div>
            </div>
        );
    }

    // Generate read-only message based on user role
    const getReadOnlyMessage = () => {
        if (isViewer) {
            return "You have viewer permissions for this customer. Only members and admins can modify infrastructure.";
        }
        return "";
    };

    return (
        <div className="modern-table-container">
            {isReadOnly && !canEditInfrastructure && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> {getReadOnlyMessage()}
                </div>
            )}
            {isReadOnly && canEditInfrastructure && projectFilter === 'all' && (
                <div className="alert alert-warning mb-3" role="alert">
                    <strong>Customer View is read-only.</strong> Switch to Project View to add, edit, or delete hosts.
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
                apiUrl={apiUrl}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="hosts"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_HOST_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`host-table-${storageId || activeCustomerId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Host save successful:', result.message);
                    } else {
                        console.error('❌ Host save failed:', result.message);
                        alert('Error saving hosts: ' + result.message);
                    }
                }}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkHostSave}
                items={allCustomerHosts}
                itemType="host"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default HostTableTanStackClean;