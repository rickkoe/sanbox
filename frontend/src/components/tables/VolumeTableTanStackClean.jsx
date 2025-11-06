import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Volume management
// Props:
// - storageId (optional): Filter volumes to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const VolumeTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('volumeTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerVolumes, setAllCustomerVolumes] = useState([]);
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

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    // Make read-only if: 1) user doesn't have permissions, OR 2) viewing customer view (not project view)
    const isReadOnly = !canEditInfrastructure || projectFilter === 'all';

    // API endpoints - dynamically determined based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        let volumesUrl;
        if (projectFilter === 'current' && activeProjectId) {
            volumesUrl = `${baseUrl}/project/${activeProjectId}/view/volumes/`;
        } else {
            volumesUrl = `${baseUrl}/volumes/`;
        }
        return {
            volumes: volumesUrl,
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/volumes/`,
            deleteUrl: `${baseUrl}/volumes/`
        };
    }, [API_URL, activeProjectId, projectFilter]);

    // Helper function to format bytes to human-readable format
    const formatBytes = useCallback((bytes) => {
        if (!bytes && bytes !== 0) return "";
        const tb = bytes / (1024 ** 4);
        const gb = bytes / (1024 ** 3);
        if (tb >= 1) {
            return `${tb.toFixed(2)} TB`;
        } else if (gb >= 1) {
            return `${gb.toFixed(2)} GB`;
        } else {
            return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
        }
    }, []);

    // All available volume columns
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
        { data: "name", title: "Volume Name", required: true, width: 200 },
        { data: "storage", title: "Storage System", type: "dropdown", required: true, width: 180 },
        { data: "volume_id", title: "Volume ID", width: 120 },
        { data: "volume_number", title: "Volume Number", type: "numeric", width: 120 },
        { data: "volser", title: "Volser", width: 100 },
        { data: "format", title: "Format", width: 100 },
        { data: "capacity_bytes", title: "Capacity", type: "numeric", readOnly: true, width: 120 },
        { data: "used_capacity_bytes", title: "Used Capacity", type: "numeric", readOnly: true, width: 130 },
        { data: "used_capacity_percent", title: "Used %", type: "numeric", readOnly: true, width: 100 },
        { data: "available_capacity_bytes", title: "Available", type: "numeric", readOnly: true, width: 120 },
        { data: "written_capacity_bytes", title: "Written", type: "numeric", readOnly: true, width: 120 },
        { data: "written_capacity_percent", title: "Written %", type: "numeric", readOnly: true, width: 100 },
        { data: "pool_name", title: "Pool Name", width: 150 },
        { data: "pool_id", title: "Pool ID", width: 100 },
        { data: "lss_lcu", title: "LSS/LCU", width: 100 },
        { data: "node", title: "Node", width: 100 },
        { data: "block_size", title: "Block Size", type: "numeric", width: 100 },
        { data: "thin_provisioned", title: "Thin Provisioned", width: 130 },
        { data: "compressed", title: "Compressed", type: "checkbox", width: 110 },
        { data: "compression_saving_percent", title: "Compression %", type: "numeric", readOnly: true, width: 130 },
        { data: "encryption", title: "Encryption", width: 100 },
        { data: "flashcopy", title: "FlashCopy", width: 100 },
        { data: "auto_expand", title: "Auto Expand", type: "checkbox", width: 110 },
        { data: "easy_tier", title: "Easy Tier", width: 120 },
        { data: "easy_tier_status", title: "Easy Tier Status", width: 140 },
        { data: "safeguarded", title: "Safeguarded", width: 120 },
        { data: "raid_level", title: "RAID Level", width: 110 },
        { data: "io_group", title: "I/O Group", width: 100 },
        { data: "status_label", title: "Status", width: 100 },
        { data: "acknowledged", title: "Acknowledged", type: "checkbox", width: 120 },
        { data: "unique_id", title: "Unique ID", readOnly: true, width: 200 },
        { data: "natural_key", title: "Natural Key", width: 150 },
        { data: "imported", title: "Imported", readOnly: true, width: 150 },
        { data: "updated", title: "Updated", readOnly: true, width: 150 }
        );

        return cols;
    }, [projectFilter]);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

    // Force _selected column to be visible when switching to Project View
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const checkAndForceVisibility = () => {
                const currentVisibility = tableRef.current?.getColumnVisibility?.();
                if (currentVisibility && (currentVisibility['_selected'] === false || currentVisibility['_selected'] === undefined)) {
                    tableRef.current?.setColumnVisibility?.({ ...currentVisibility, '_selected': true });
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
    }, [projectFilter]);

    // Dynamic template - pre-populate storage if storageId is provided
    const NEW_VOLUME_TEMPLATE = useMemo(() => {
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
            storage: storageSystemName,
            volume_id: "",
            volume_number: null,
            volser: "",
            format: "",
            capacity_bytes: null,
            used_capacity_bytes: null,
            used_capacity_percent: null,
            available_capacity_bytes: null,
            written_capacity_bytes: null,
            written_capacity_percent: null,
            pool_name: "",
            pool_id: "",
            lss_lcu: "",
            node: "",
            block_size: null,
            thin_provisioned: "",
            compressed: false,
            compression_saving_percent: null,
            encryption: "",
            flashcopy: "",
            auto_expand: false,
            easy_tier: "",
            easy_tier_status: "",
            safeguarded: "",
            raid_level: "",
            io_group: "",
            status_label: "",
            acknowledged: false,
            unique_id: "",
            natural_key: "",
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
                    console.log('Loading storage systems for volume table...');

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
            localStorage.setItem('volumeTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('volumeTableProjectFilter', newFilter);
        if (tableRef.current && tableRef.current.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Load all customer volumes when modal opens
    useEffect(() => {
        const loadAllCustomerVolumes = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    const response = await api.get(`${API_URL}/api/storage/volumes/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerVolumes(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer volumes:', error);
                }
            }
        };
        loadAllCustomerVolumes();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding volume to project
    const handleAddVolumeToProject = useCallback(async (volumeId, action = 'reference') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-volume/`, {
                volume_id: volumeId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding volume to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Handle bulk volume save
    const handleBulkVolumeSave = useCallback(async (selectedIds) => {
        try {
            if (!allCustomerVolumes || allCustomerVolumes.length === 0) return;
            const currentInProject = new Set(allCustomerVolumes.filter(v => v.in_active_project).map(v => v.id));
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            for (const volumeId of toAdd) {
                await handleAddVolumeToProject(volumeId, 'reference');
            }
            for (const volumeId of toRemove) {
                await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-volume/${volumeId}/`);
            }

            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }
            setShowBulkModal(false);
        } catch (error) {
            console.error('Error in bulk volume save:', error);
        }
    }, [allCustomerVolumes, activeProjectId, API_URL, handleAddVolumeToProject]);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage: storageOptions.map(s => s.name)
    }), [storageOptions]);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        used_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        available_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        written_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        used_capacity_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        written_capacity_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        compression_saving_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        }
    }), [formatBytes, activeProjectId]);

    // Handler to select all rows across all pages
    const handleSelectAllPages = useCallback(async () => {
        try {
            const fetchAllUrl = API_ENDPOINTS.volumes.includes('?')
                ? `${API_ENDPOINTS.volumes}&page_size=10000`
                : `${API_ENDPOINTS.volumes}?page_size=10000`;

            const response = await api.get(fetchAllUrl);
            const allData = response.data.results || response.data;
            const allIds = allData.map(row => row.id).filter(id => id);

            const currentData = tableRef.current?.getTableData();
            if (currentData) {
                const updatedData = currentData.map(row => ({
                    ...row,
                    _selected: true
                }));
                tableRef.current?.updateTableDataSilently(updatedData);
            }

            setSelectedRows(new Set(allIds));
            setShowSelectAllBanner(false);
        } catch (error) {
            console.error('Error selecting all pages:', error);
            alert('Failed to select all rows. Please try again.');
        }
    }, [API_ENDPOINTS.volumes]);

    // Handler to clear all selections
    const handleClearSelection = useCallback(() => {
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
            console.log('Marking volumes for deletion:', selectedIds);

            const promises = selectedIds.map(volumeId =>
                api.post(`${API_URL}/api/core/projects/${activeProjectId}/mark-volume-deletion/`, {
                    volume_id: volumeId,
                    action: 'delete'
                })
            );

            await Promise.all(promises);

            handleClearSelection();

            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

            alert(`Successfully marked ${selectedIds.length} item(s) for deletion.`);
        } catch (error) {
            console.error('Error marking items for deletion:', error);
            alert('Failed to mark items for deletion. Please try again.');
        }
    }, [selectedRows, activeProjectId, API_URL, handleClearSelection]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(volume => {
            // Check if this row should be selected
            const shouldBeSelected = volume._selected !== undefined
                ? volume._selected
                : (volume.id && selectedRowsRef.current.has(volume.id));

            // Get storage name from ID
            const storageObj = storageOptions.find(s => s.id === volume.storage);
            const storageName = storageObj ? storageObj.name : '';

            return {
                ...volume,
                storage_id: volume.storage, // Keep original ID
                storage: storageName, // Display name
                saved: !!volume.id,
                _selected: shouldBeSelected
            };
        });

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(volume => volume.storage === storageSystem.name);
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
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setInterval(() => {
                const currentData = tableRef.current?.getTableData();
                if (currentData && currentData.length > 0) {
                    const updatedSelectedRows = new Set(selectedRows);
                    const currentPageIds = new Set(currentData.map(row => row.id).filter(id => id));

                    currentData.forEach(row => {
                        if (row.id) {
                            if (row._selected) {
                                updatedSelectedRows.add(row.id);
                            } else if (currentPageIds.has(row.id)) {
                                updatedSelectedRows.delete(row.id);
                            }
                        }
                    });

                    const allCurrentPageSelected = currentData.every(row => row._selected);
                    const hasSelectionsOnPage = currentData.some(row => row._selected);

                    if (allCurrentPageSelected && hasSelectionsOnPage && updatedSelectedRows.size < totalRowCount && totalRowCount > 0) {
                        setShowSelectAllBanner(true);
                    } else if (updatedSelectedRows.size === 0) {
                        setShowSelectAllBanner(false);
                    } else if (updatedSelectedRows.size === totalRowCount) {
                        setShowSelectAllBanner(false);
                    }

                    if (updatedSelectedRows.size !== selectedRows.size ||
                        [...updatedSelectedRows].some(id => !selectedRows.has(id))) {
                        setSelectedRows(updatedSelectedRows);
                    }
                }
            }, 200);

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

    // Transform data for saving - convert labels back to IDs
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Convert storage name back to ID
            if (payload.storage_id) {
                payload.storage = payload.storage_id;
                delete payload.storage_id;
            } else if (payload.storage && typeof payload.storage === 'string') {
                const storage = storageOptions.find(s => s.name === payload.storage);
                payload.storage = storage ? storage.id : null;
            }

            // Handle boolean fields
            if (typeof payload.compressed === 'string') {
                payload.compressed = payload.compressed.toLowerCase() === 'true';
            }
            if (typeof payload.auto_expand === 'string') {
                payload.auto_expand = payload.auto_expand.toLowerCase() === 'true';
            }
            if (typeof payload.acknowledged === 'string') {
                payload.acknowledged = payload.acknowledged.toLowerCase() === 'true';
            }

            // Ensure required fields are present
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Volume";
            }

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions]);

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
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only volumes in this project'}>
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
                title={!activeProjectId ? 'Select a project to add/remove volumes' : 'Bulk add or remove volumes from this project'}>
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
        return <EmptyConfigMessage entityName="volumes" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading volume data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && !canEditInfrastructure && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure.
                </div>
            )}
            {isReadOnly && canEditInfrastructure && projectFilter === 'all' && (
                <div className="alert alert-warning mb-3" role="alert">
                    <strong>Customer View is read-only.</strong> Switch to Project View to add, edit, or delete volumes.
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
                apiUrl={
                    projectFilter === 'current' && activeProjectId
                        ? (storageId ? `${API_ENDPOINTS.volumes}?storage_id=${storageId}` : API_ENDPOINTS.volumes)
                        : (storageId ? `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}&storage_id=${storageId}` : `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}`)
                }
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="volumes"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_VOLUME_TEMPLATE}

                // Dropdown Configuration
                dropdownSources={dropdownSources}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // Custom Renderers
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 250px)"
                stretchH="all"
                autoColumnSize={true}
                manualColumnResize={true}
                storageKey={`volumes-table-${activeCustomerId || 'default'}-${projectFilter}`}

                // Feature Flags
                enableFilters={true}
                enableExport={true}
                enablePagination={true}
                defaultPageSize={50}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkVolumeSave}
                items={allCustomerVolumes}
                itemType="volume"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default VolumeTableTanStackClean;
