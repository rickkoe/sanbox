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
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Clean TanStack Table implementation for Pool management
// Props:
// - storageId (optional): Filter pools to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const PoolTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [storageSystemTypes, setStorageSystemTypes] = useState({}); // Map storage ID to storage_type
    const [loading, setLoading] = useState(true);
    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook for auto-switch behavior
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '',
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'poolTableProjectFilter'
    });

    // Generate the correct apiUrl for pools
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null;
        }
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            let url = `${API_URL}/api/storage/project/${activeProjectId}/view/pools/`;
            if (storageId) {
                url += `?storage_id=${storageId}`;
            }
            return url;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            let url = `${API_URL}/api/storage/project/${activeProjectId}/view/pools/?project_filter=${projectFilter}`;
            if (storageId) {
                url += `&storage_id=${storageId}`;
            }
            return url;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            let url = `${API_URL}/api/storage/pools/?customer=${activeCustomerId}`;
            if (storageId) {
                url += `&storage_id=${storageId}`;
            }
            return url;
        } else {
            return `${API_URL}/api/storage/pools/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading, storageId]);

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'pools'
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
        entityType: 'pool',
        API_URL,
        totalRowCount
    });

    // Check permissions - Customer View is always read-only
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            pools: apiUrl,
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/pools/`,
            deleteUrl: `${baseUrl}/pools/`
        };
    }, [API_URL, apiUrl]);

    // Load columns from centralized configuration
    // _selected column is always included for consistent layout
    const allColumns = useMemo(() => {
        return getTableColumns('pool');
    }, []);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('pool');

    // Dynamic template - pre-populate storage if storageId is provided
    const NEW_POOL_TEMPLATE = useMemo(() => {
        let storageSystemName = "";
        let defaultStorageType = "FB";

        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                storageSystemName = storageSystem.name;
                // FlashSystem pools are always FB
                if (storageSystemTypes[storageId] === 'FlashSystem') {
                    defaultStorageType = "FB";
                }
            }
        }

        return {
            id: null,
            name: "",
            _selected: false,
            storage: storageSystemName,
            storage_type: defaultStorageType,
            db_volumes_count: 0,
            committed: false,
            deployed: false
        };
    }, [storageId, storageOptions, storageSystemTypes]);

    // Load storage systems for dropdown
    useEffect(() => {
        const loadStorageSystems = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);
                    console.log('Loading storage systems for pool table...');

                    const response = await axios.get(`${API_ENDPOINTS.storage}?customer=${activeCustomerId}`);
                    const storageArray = response.data.results || response.data;
                    setStorageOptions(storageArray.map(s => ({ id: s.id, name: s.name })));

                    // Build storage type map
                    const typeMap = {};
                    storageArray.forEach(s => {
                        typeMap[s.id] = s.storage_type;
                    });
                    setStorageSystemTypes(typeMap);

                    console.log('Storage systems loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('Error loading storage systems:', error);
                    setLoading(false);
                }
            }
        };

        loadStorageSystems();
    }, [activeCustomerId, API_ENDPOINTS.storage]);

    // Handle adding pool to project
    const handleAddPoolToProject = useCallback(async (poolId, action = 'unmodified') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-pool/`, {
                pool_id: poolId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding pool to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.poolTableRef = tableRef;

        return () => {
            delete window.poolTableRef;
        };
    }, []);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage: storageOptions.map(s => s.name),
        storage_type: ['FB', 'CKD']
    }), [storageOptions]);

    // Custom renderers for special formatting
    // Note: project_action is now shown via colored row borders, not a column
    const customRenderers = useMemo(() => ({
        db_volumes_count: (rowData, td, row, col, prop, value) => {
            return value != null ? value.toString() : "0";
        },
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        }
    }), [activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(pool => {
            // Get storage name from ID
            const storageObj = storageOptions.find(s => s.id === pool.storage);
            const storageName = storageObj ? storageObj.name : '';

            return {
                ...pool,
                storage_id: pool.storage,
                storage: storageName,
                saved: !!pool.id,
                _selected: pool._selected || false
            };
        });

        return processedData;
    }, [storageOptions]);

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

            // If storageId prop is provided and storage is still empty, use it
            // This handles the case where the storage column is hidden
            if (!payload.storage && storageId) {
                payload.storage = storageId;
            }

            // FlashSystem pools are always FB - enforce this
            const finalStorageId = payload.storage;
            if (finalStorageId && storageSystemTypes[finalStorageId] === 'FlashSystem') {
                payload.storage_type = 'FB';
            }

            // Ensure required fields are present
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Pool";
            }

            // Add active project ID if in Project View (for creating junction table entry)
            if (projectFilter === 'current' && activeProjectId) {
                payload.active_project_id = activeProjectId;
            }

            // Handle boolean fields
            if (typeof payload.committed === 'string') {
                payload.committed = payload.committed.toLowerCase() === 'true';
            }
            if (typeof payload.deployed === 'string') {
                payload.deployed = payload.deployed.toLowerCase() === 'true';
            }

            // Convert empty strings to null for optional fields (but not storage - it's required)
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name" && key !== "storage") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions, storageSystemTypes, storageId, projectFilter, activeProjectId]);

    // Use ProjectViewToolbar component for table-specific actions
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="pools" />;
    }

    // Show loading while data loads or projectFilter is loading
    if (loading || projectFilterLoading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading pool data...</span>
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
                apiUrl={API_ENDPOINTS.pools}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="pools"
                readOnly={isReadOnly}
                selectCheckboxDisabled={projectFilter !== 'current'}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_POOL_TEMPLATE}
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
                height="calc(100vh - 200px)"
                stretchH="all"
                autoColumnSize={true}
                manualColumnResize={true}
                storageKey={`pools-table-${activeCustomerId || 'default'}-${projectFilter}`}

                // Feature Flags
                enableFilters={true}
                enableExport={true}
                enablePagination={true}
                defaultPageSize={50}
            />
        </div>
    );
};

export default PoolTableTanStackClean;
