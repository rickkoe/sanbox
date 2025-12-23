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

// Clean TanStack Table implementation for Host management
// Props:
// - storageId (optional): Filter hosts to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage_system'])
const HostTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook for auto-switch behavior
    // Note: Hosts have a different URL pattern than SAN entities
    // - Customer View: /api/storage/hosts/?customer=123
    // - Project View: /api/storage/project/123/view/hosts/
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '', // Not used for hosts
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'hostTableProjectFilter'
    });

    // Generate the correct apiUrl for hosts (different pattern than SAN entities)
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null; // Don't fetch until projectFilter is loaded
        }
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            return `${API_URL}/api/storage/project/${activeProjectId}/view/hosts/`;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            return `${API_URL}/api/storage/project/${activeProjectId}/view/hosts/?project_filter=${projectFilter}`;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            return `${API_URL}/api/storage/hosts/?customer=${activeCustomerId}`;
        } else {
            // Fallback: No customer or project selected
            return `${API_URL}/api/storage/hosts/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading]);

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'hosts'
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
        entityType: 'host',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - hosts URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            hosts: apiUrl, // From useProjectViewAPI hook
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/hosts/`,
            deleteUrl: `${baseUrl}/hosts/`
        };
    }, [API_URL, apiUrl]);

    // Transform data for saving - add active_project_id for Project View
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Add active project ID if in Project View (for creating junction table entry)
            if (projectFilter === 'current' && activeProjectId) {
                payload.active_project_id = activeProjectId;
            }

            return payload;
        });
    }, [projectFilter, activeProjectId]);

    // Load columns from centralized configuration
    // _selected column is always included for consistent layout
    const allColumns = useMemo(() => {
        return getTableColumns('host');
    }, []);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('host');

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

    // Live/Draft toggle is now in the navbar

    // Handle adding host to project
    const handleAddHostToProject = useCallback(async (hostId, action = 'unmodified') => {
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

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.hostTableRef = tableRef;

        return () => {
            delete window.hostTableRef;
        };
    }, []);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_system: storageOptions.map(s => s.name),
        wwpn_status: ["Active", "Inactive", "Error", "Unknown"],
        status: ["Online", "Offline", "Degraded", "Unknown"],
        host_type: ["Linux", "Windows", "AIX", "VMware", "Other"],
        acknowledged: ["Yes", "No", "Pending"]
    }), [storageOptions]);

    // Custom renderers for special formatting
    // Note: project_action is now shown via colored row borders, not a column
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
            return {
                ...host,
                // Map wwpn_display to wwpns for table display
                wwpns: host.wwpn_display || host.wwpns || '',
                saved: !!host.id,
                // Selection state - use API value or default to false
                _selected: host._selected || false
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

    // Note: With the new storage/hosts API, we don't need a custom save handler
    // The hosts are created/updated via Storage Insights import, not manual CRUD
    // This component is now primarily for viewing hosts from storage systems

    // Use ProjectViewToolbar component for table-specific actions
    // (Committed/Draft toggle, Commit, and Bulk Add/Remove are now in the navbar)
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="hosts" />;
    }

    // Show loading while data loads or projectFilter is loading
    if (loading || projectFilterLoading) {
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

    return (
        <div className="modern-table-container">
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={apiUrl}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                activeProjectId={activeProjectId}
                tableName="hosts"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_HOST_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
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
                selectCheckboxDisabled={projectFilter !== 'current'}

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
        </div>
    );
};

export default HostTableTanStackClean;