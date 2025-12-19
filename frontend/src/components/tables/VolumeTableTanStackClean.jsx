import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import api from "../../api";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusRenderer } from "../../utils/projectStatusRenderer";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Clean TanStack Table implementation for Volume management
// Props:
// - storageId (optional): Filter volumes to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const VolumeTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [poolOptions, setPoolOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook for auto-switch behavior
    // Note: Volumes have a different URL pattern than SAN entities
    // - Customer View: /api/storage/volumes/?customer=123
    // - Project View: /api/storage/project/123/view/volumes/
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '', // Not used for volumes
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'volumeTableProjectFilter'
    });

    // Generate the correct apiUrl for volumes (different pattern than SAN entities)
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null; // Don't fetch until projectFilter is loaded
        }
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            return `${API_URL}/api/storage/project/${activeProjectId}/view/volumes/`;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            return `${API_URL}/api/storage/project/${activeProjectId}/view/volumes/?project_filter=${projectFilter}`;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            return `${API_URL}/api/storage/volumes/?customer=${activeCustomerId}`;
        } else {
            // Fallback: No customer or project selected
            return `${API_URL}/api/storage/volumes/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading]);

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'volumes'
    });

    // Use centralized selection hook
    const {
        selectedRows,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        BannerSlot,
        ActionsDropdown
    } = useProjectViewSelection({
        tableRef,
        projectFilter,
        activeProjectId,
        apiUrl,
        entityType: 'volume',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - volumes URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            volumes: apiUrl, // From useProjectViewAPI hook
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/volumes/`,
            deleteUrl: `${baseUrl}/volumes/`
        };
    }, [API_URL, apiUrl]);

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

    // Load columns from centralized configuration
    const allColumns = useMemo(() => {
        return getTableColumns('volume', projectFilter === 'current');
    }, [projectFilter]);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('volume');

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
            pool: "",
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
    }, [activeCustomerId, API_ENDPOINTS.storage]);

    // Load pool options for dropdown
    useEffect(() => {
        const loadPools = async () => {
            if (!activeCustomerId) return;
            try {
                // Include project context to get committed pools + pools in active project
                const params = new URLSearchParams();
                params.append('customer', activeCustomerId);
                params.append('project_filter', projectFilter || 'all');
                if (activeProjectId) {
                    params.append('project_id', activeProjectId);
                }
                // If filtering by storage, only get pools for that storage
                if (storageId) {
                    const response = await axios.get(`${API_URL}/api/storage/${storageId}/pools/?${params.toString()}`);
                    const pools = response.data.results || response.data || [];
                    setPoolOptions(pools.map(p => ({ id: p.id, name: p.name })));
                } else {
                    // Get all pools for customer
                    const response = await axios.get(`${API_URL}/api/storage/pools/?${params.toString()}`);
                    const pools = response.data.results || response.data || [];
                    setPoolOptions(pools.map(p => ({ id: p.id, name: p.name })));
                }
            } catch (err) {
                console.error('Error loading pools:', err);
                setPoolOptions([]);
            }
        };
        loadPools();
    }, [API_URL, activeCustomerId, storageId, projectFilter, activeProjectId]);

    // Live/Draft toggle is now in the navbar

    // Handle adding volume to project
    const handleAddVolumeToProject = useCallback(async (volumeId, action = 'unmodified') => {
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

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.volumeTableRef = tableRef;

        return () => {
            delete window.volumeTableRef;
        };
    }, []);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage: storageOptions.map(s => s.name),
        pool: poolOptions.map(p => p.name)
    }), [storageOptions, poolOptions]);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        project_action: projectStatusRenderer,
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

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(volume => {
            // Get storage name from ID
            const storageObj = storageOptions.find(s => s.id === volume.storage);
            const storageName = storageObj ? storageObj.name : '';

            return {
                ...volume,
                storage_id: volume.storage, // Keep original ID
                storage: storageName, // Display name
                saved: !!volume.id,
                // Selection state - use API value or default to false
                _selected: volume._selected || false
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

    // Use ProjectViewToolbar component for table-specific actions
    // (Committed/Draft toggle, Commit, and Bulk Add/Remove are now in the navbar)
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="volumes" />;
    }

    // Show loading while data loads or projectFilter is loading
    if (loading || projectFilterLoading) {
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
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={
                    storageId
                        ? `${API_ENDPOINTS.volumes}${API_ENDPOINTS.volumes?.includes('?') ? '&' : '?'}storage_id=${storageId}`
                        : API_ENDPOINTS.volumes
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
                defaultSort={defaultSort}

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
        </div>
    );
};

export default VolumeTableTanStackClean;
