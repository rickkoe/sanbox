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

// Clean TanStack Table implementation for Port management
// Props:
// - storageId (optional): Filter ports to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const PortTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    // State for dropdown options
    const [fabricOptions, setFabricOptions] = useState([]);
    const [storageOptions, setStorageOptions] = useState([]);
    const [aliasOptions, setAliasOptions] = useState([]);

    // Use centralized API hook for auto-switch behavior
    // Note: Ports have a different URL pattern than SAN entities
    // - Customer View: /api/storage/ports/?customer=123
    // - Project View: /api/storage/project/123/view/ports/
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '', // Not used for ports
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'portTableProjectFilter'
    });

    // Generate the correct apiUrl for ports (different pattern than SAN entities)
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null; // Don't fetch until projectFilter is loaded
        }
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            return `${API_URL}/api/storage/project/${activeProjectId}/view/ports/`;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            return `${API_URL}/api/storage/project/${activeProjectId}/view/ports/?project_filter=${projectFilter}`;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            return `${API_URL}/api/storage/ports/?customer=${activeCustomerId}`;
        } else {
            // Fallback: No customer or project selected
            return `${API_URL}/api/storage/ports/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading]);

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'ports'
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
        entityType: 'port',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - ports URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            ports: apiUrl, // From useProjectViewAPI hook
            fabrics: `${API_URL}/api/san/fabrics/`,
            storage: `${baseUrl}/`,
            aliases: `${API_URL}/api/san/aliases/`,
            saveUrl: `${baseUrl}/ports/`,
            deleteUrl: `${baseUrl}/ports/`
        };
    }, [API_URL, apiUrl]);

    // Speed options based on port type
    const getSpeedOptions = useCallback((portType) => {
        if (portType === 'fc') {
            return [2, 4, 8, 16, 32, 64];
        } else if (portType === 'ethernet') {
            return [1, 10, 25, 40, 100];
        }
        return [];
    }, []);

    // Protocol options based on port type AND storage type
    const getProtocolOptions = useCallback((portType, storageType) => {
        if (portType === 'fc') {
            if (storageType === 'DS8000') {
                return ['FICON', 'SCSI FCP'];
            } else if (storageType === 'FlashSystem') {
                return ['SCSI FCP', 'NVMe FCP'];
            } else {
                // Default to DS8000 options for other/unknown storage types
                return ['FICON', 'SCSI FCP'];
            }
        } else if (portType === 'ethernet') {
            return ['TCP/IP', 'iSCSI', 'RDMA'];
        }
        return [];
    }, []);

    // Fetch fabrics for dropdown - use project endpoint to get committed + project fabrics
    useEffect(() => {
        const fetchFabrics = async () => {
            if (!activeCustomerId) return;
            try {
                // Use project endpoint when in project view to get both committed and project fabrics
                const fabricsUrl = activeProjectId
                    ? `${API_URL}/api/san/fabrics/project/${activeProjectId}/view/?project_filter=all`
                    : `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`;
                const response = await axios.get(fabricsUrl);
                const fabrics = response.data.results || response.data || [];
                // Sort fabrics alphabetically by name
                const sortedFabrics = [...fabrics].sort((a, b) =>
                    (a.name || '').localeCompare(b.name || '')
                );
                setFabricOptions(sortedFabrics.map(f => ({ value: f.id, label: f.name })));
            } catch (error) {
                console.error("Failed to fetch fabrics:", error);
            }
        };
        fetchFabrics();
    }, [activeCustomerId, activeProjectId, API_ENDPOINTS.fabrics, API_URL]);

    // Fetch storage systems for dropdown
    useEffect(() => {
        const fetchStorageSystems = async () => {
            if (!activeCustomerId) return;
            try {
                const response = await axios.get(`${API_ENDPOINTS.storage}?customer=${activeCustomerId}&page_size=500`);
                const systems = response.data.results || [];
                setStorageOptions(systems.map(s => ({ value: s.id, label: s.name, storage_type: s.storage_type })));
            } catch (error) {
                console.error("Failed to fetch storage systems:", error);
            }
        };
        fetchStorageSystems();
    }, [activeCustomerId, API_ENDPOINTS.storage]);

    // Fetch all aliases for the active project
    // Aliases are project-specific, so we fetch them by project ID
    useEffect(() => {
        const fetchAliases = async () => {
            if (!activeProjectId) return;
            try {
                // Use the project-specific alias endpoint
                const response = await axios.get(`${API_URL}/api/san/aliases/project/${activeProjectId}/`);
                // API returns { results: [...] } format
                const aliases = response.data.results || response.data || [];
                console.log(`Fetched ${aliases.length} aliases for project ${activeProjectId}`);
                setAliasOptions(aliases);
            } catch (error) {
                console.error("Failed to fetch aliases:", error);
                setAliasOptions([]);
            }
        };
        fetchAliases();
    }, [activeProjectId, API_URL]);

    // Live/Draft toggle is now in the navbar

    // Reload table data when fabricOptions loads to ensure fabric names are displayed
    useEffect(() => {
        if (fabricOptions.length > 0 && tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    }, [fabricOptions]);

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

    // Handle adding port to project
    const handleAddPortToProject = useCallback(async (portId, action = 'unmodified') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-port/`, {
                port_id: portId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding port to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.portTableRef = tableRef;

        return () => {
            delete window.portTableRef;
        };
    }, []);

    // WWPN formatting utilities (same as AliasTable)
    const formatWWPN = useCallback((value) => {
        if (!value) return "";
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleanValue.length !== 16) return value;
        return cleanValue.match(/.{2}/g).join(':');
    }, []);

    const isValidWWPNFormat = useCallback((value) => {
        if (!value) return true;
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
        return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
    }, []);

    // Load columns from centralized configuration
    // _selected column is always included for consistent layout
    const allColumns = useMemo(() => {
        return getTableColumns('port');
    }, []);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('port');

    const NEW_PORT_TEMPLATE = useMemo(() => ({
        id: null,
        name: "",
        _selected: false,
        storage: storageId || null, // Pre-populate storage if filtering by storage system
        wwpn: "",
        type: "Fibre Channel", // Display value, will be converted to 'fc' on save
        type_value: "fc", // Internal value
        speed_gbps: null,
        use: null,
        protocol: null,
        location: "",
        frame: null,
        io_enclosure: null,
        fabric: null,
        alias: null
        // Note: Port belongs to storage system (customer-level), not project
        // Alias lookup happens via active project based on WWPN matching
    }), [storageId]);

    // Dropdown sources with all options
    const dropdownSources = useMemo(() => {
        const sources = {
            type: ["Fibre Channel", "Ethernet"],
            use: ["Host", "Replication", "Both"],
            storage: storageOptions.map(opt => opt.label),
            fabric: fabricOptions.map(opt => opt.label),
            // Include all possible speed options (FC + Ethernet)
            speed_gbps: ["1", "2", "4", "8", "10", "16", "25", "32", "40", "64", "100"],
            // Include all possible protocol options
            protocol: ["FICON", "SCSI FCP", "NVMe FCP", "TCP/IP", "iSCSI", "RDMA"]
        };

        return sources;
    }, [storageOptions, fabricOptions]);

    // Dynamic dropdown provider for speed, protocol, and aliases
    // Parameters: row index, col index, table data, accessorKey (column name)
    const dynamicDropdownProvider = useCallback((row, col, data, accessorKey) => {
        const rowData = data[row];
        const columnName = accessorKey || columns[col]?.data;

        if (columnName === 'speed_gbps') {
            // Use type (current/edited value) first, then type_value (original saved value)
            let portType = rowData?.type || rowData?.type_value || 'fc';
            if (portType === 'Fibre Channel') portType = 'fc';
            else if (portType === 'Ethernet') portType = 'ethernet';

            const speeds = getSpeedOptions(portType);
            return speeds.map(speed => speed.toString());
        }

        if (columnName === 'protocol') {
            // Use type (current/edited value) first, then type_value (original saved value)
            let portType = rowData?.type || rowData?.type_value || 'fc';
            if (portType === 'Fibre Channel') portType = 'fc';
            else if (portType === 'Ethernet') portType = 'ethernet';

            const storageId = rowData?.storage;

            // Find storage type from storage options
            const storage = storageOptions.find(s => s.value === storageId);
            const storageType = storage?.storage_type || rowData?.storage_type || 'DS8000';

            const protocols = getProtocolOptions(portType, storageType);
            return protocols;
        }

        if (columnName === 'alias') {
            const fabricId = rowData?.fabric;
            if (!fabricId) {
                return [];
            }

            // Filter aliases by selected fabric and project
            const fabricAliases = aliasOptions.filter(alias =>
                alias.fabric === fabricId &&
                alias.projects && alias.projects.includes(activeProjectId)
            );

            // Get aliases already used in this table (excluding current row)
            const usedAliasIds = data
                .filter((r, idx) => idx !== row && r.alias)
                .map(r => r.alias);

            // Mark used aliases
            return fabricAliases.map(alias => {
                const isUsed = usedAliasIds.includes(alias.id);
                return isUsed ? `${alias.name} (used)` : alias.name;
            });
        }

        return null;
    }, [columns, storageOptions, aliasOptions, activeProjectId, getSpeedOptions, getProtocolOptions]);

    // Custom renderers
    // Note: project_action is now shown via colored row borders, not a column
    const customRenderers = useMemo(() => ({
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        },
        wwpn: (rowData, td, row, col, prop, value) => {
            if (value && isValidWWPNFormat(value)) {
                return formatWWPN(value);
            }
            return value || "";
        }
    }), [formatWWPN, isValidWWPNFormat, activeProjectId]);

    // Process data for display - convert IDs to labels
    const preprocessData = useCallback((data) => {
        return data.map(port => {
            // Convert type value to display value
            const typeDisplay = port.type === 'fc' ? 'Fibre Channel' :
                               port.type === 'ethernet' ? 'Ethernet' : port.type;

            // Convert use value to display value
            const useDisplay = port.use === 'host' ? 'Host' :
                              port.use === 'replication' ? 'Replication' :
                              port.use === 'both' ? 'Both' : port.use;

            // Get storage name
            const storageObj = storageOptions.find(s => s.value === port.storage);
            const storageDisplay = storageObj ? storageObj.label : '';

            // Get fabric name - use fabric_details from API first, then fall back to fabricOptions lookup
            const fabricDisplay = port.fabric_details?.name ||
                (fabricOptions.find(f => f.value === port.fabric)?.label || '');

            // Get alias name - use alias_details from API first, then fall back to aliasOptions lookup
            const aliasDisplay = port.alias_details?.name ||
                (aliasOptions.find(a => a.id === port.alias)?.name || '');

            // Also check if we can auto-populate from WWPN
            let autoAlias = aliasDisplay;
            let autoFabric = fabricDisplay;

            if (port.wwpn) {
                const matchingAlias = aliasOptions.find(a => {
                    const aliasWWPN = formatWWPN(a.wwpn || '');
                    const portWWPN = formatWWPN(port.wwpn);
                    return aliasWWPN === portWWPN;
                });

                if (matchingAlias) {
                    autoAlias = matchingAlias.name;

                    // Get fabric from alias - use fabric_details if available, otherwise lookup by ID
                    if (matchingAlias.fabric_details && matchingAlias.fabric_details.name) {
                        autoFabric = matchingAlias.fabric_details.name;
                    } else if (matchingAlias.fabric) {
                        const matchingFabric = fabricOptions.find(f => f.value === matchingAlias.fabric);
                        if (matchingFabric) {
                            autoFabric = matchingFabric.label;
                        }
                    }
                }
            }

            return {
                ...port,
                // Selection state - use API value or default to false
                _selected: port._selected || false,
                storage_id: port.storage, // Keep original ID
                storage: storageDisplay, // Display name in the storage column
                storage_type: port.storage_details?.storage_type || storageObj?.storage_type,
                type_value: port.type, // Keep original value for logic
                type: typeDisplay, // Display value
                use_value: port.use, // Keep original value
                use: useDisplay, // Display value
                fabric_id: port.fabric, // Keep original fabric ID
                fabric: autoFabric, // Display name (auto-populated from WWPN)
                alias_id: port.alias, // Keep original alias ID
                alias: autoAlias, // Display name (auto-populated from WWPN)
                saved: !!port.id
            };
        });
    }, [storageOptions, fabricOptions, aliasOptions, formatWWPN]);

    // Transform data for saving - convert labels back to IDs/values
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };

            // Trim all string values to remove carriage returns and whitespace from paste operations
            Object.keys(payload).forEach(key => {
                if (typeof payload[key] === 'string') {
                    payload[key] = payload[key].trim();
                }
            });

            delete payload.saved;
            delete payload.storage_type;
            delete payload.type_value;
            delete payload.use_value;
            delete payload.storage_details;
            delete payload.fabric_details;
            delete payload.alias_details;
            delete payload.project_details;

            // Format WWPN before saving
            if (payload.wwpn) {
                payload.wwpn = formatWWPN(payload.wwpn);

                // Look up alias by WWPN and auto-populate alias and fabric
                const matchingAlias = aliasOptions.find(a => {
                    const aliasWWPN = formatWWPN(a.wwpn || '');
                    const portWWPN = formatWWPN(payload.wwpn);
                    return aliasWWPN === portWWPN;
                });

                if (matchingAlias) {
                    // Auto-populate alias
                    payload.alias = matchingAlias.id;
                    // Auto-populate fabric from the alias
                    if (matchingAlias.fabric) {
                        payload.fabric = matchingAlias.fabric;
                    }
                }
            }

            // Convert type display back to value
            if (payload.type === 'Fibre Channel') payload.type = 'fc';
            else if (payload.type === 'Ethernet') payload.type = 'ethernet';

            // Convert use display back to value
            if (payload.use === 'Host') payload.use = 'host';
            else if (payload.use === 'Replication') payload.use = 'replication';
            else if (payload.use === 'Both') payload.use = 'both';

            // Use storage_id if available, otherwise convert label to ID
            if (payload.storage_id) {
                payload.storage = payload.storage_id;
                delete payload.storage_id;
            } else if (payload.storage && typeof payload.storage === 'string') {
                const storage = storageOptions.find(s => s.label === payload.storage);
                payload.storage = storage ? storage.value : null;
            }

            // Convert fabric label to ID if it's a string (from dropdown selection)
            if (payload.fabric && typeof payload.fabric === 'string') {
                const fabric = fabricOptions.find(f => f.label === payload.fabric);
                payload.fabric = fabric ? fabric.value : null;
            }
            // Use fabric_id as fallback if fabric wasn't set
            if (!payload.fabric && payload.fabric_id) {
                payload.fabric = payload.fabric_id;
            }
            delete payload.fabric_id; // Clean up

            // Use alias_id if available, otherwise convert label to ID
            // (Only if not already set by WWPN lookup)
            if (!payload.alias && payload.alias_id) {
                payload.alias = payload.alias_id;
                delete payload.alias_id;
            } else if (!payload.alias && typeof payload.alias === 'string') {
                const aliasName = payload.alias.replace(' (used)', '');
                const alias = aliasOptions.find(a => a.name === aliasName);
                payload.alias = alias ? alias.id : null;
            }
            delete payload.alias_id; // Clean up

            // Convert speed to integer
            if (payload.speed_gbps && typeof payload.speed_gbps === 'string') {
                payload.speed_gbps = parseInt(payload.speed_gbps, 10);
            }

            // Ensure required fields are present
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Port";
            }

            if (!payload.type) {
                payload.type = "fc";
            }

            // Remove legacy project field if it exists
            delete payload.project;

            // Add active project ID if in Project View (for creating junction table entry)
            if (projectFilter === 'current' && activeProjectId) {
                payload.active_project_id = activeProjectId;
            }

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions, fabricOptions, aliasOptions, activeProjectId, projectFilter, formatWWPN]);

    // Custom save handler to use field overrides when in Project View
    const handlePortSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            return { success: true, message: 'No changes to save' };
        }

        try {
            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                for (const portId of deletedRows) {
                    try {
                        await api.delete(`${API_URL}/api/storage/ports/${portId}/`);
                    } catch (error) {
                        console.error(`Failed to delete port ${portId}:`, error);
                        if (error.response?.status === 403) {
                            return {
                                success: false,
                                message: error.response?.data?.error || 'You do not have permission to delete ports.'
                            };
                        }
                        return {
                            success: false,
                            message: `Failed to delete port: ${error.response?.data?.error || error.message}`
                        };
                    }
                }
            }

            // Build payload for saving ports
            const payload = saveTransform(allTableData)
                .filter(port => port.id || (port.name && port.name.trim() !== ""));

            // Use the bulk save endpoint with field override support
            if (payload.length > 0) {
                await api.post(`${API_URL}/api/storage/ports/save/`, {
                    project_id: activeProjectId,
                    ports: payload,
                });
            }

            const totalOperations = payload.length + (deletedRows ? deletedRows.length : 0);
            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} port(s)`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} port(s)`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return { success: true, message };

        } catch (error) {
            console.error('❌ Port save error:', error);
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: error.response?.data?.error || 'You do not have permission to modify ports.'
                };
            }
            return {
                success: false,
                message: `Error saving ports: ${error.response?.data?.error || error.message}`
            };
        }
    };

    // Use ProjectViewToolbar component for table-specific actions
    // (Committed/Draft toggle, Commit, and Bulk Add/Remove are now in the navbar)
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="ports" />;
    }

    // Wait for projectFilter to load before rendering table
    if (projectFilterLoading || !apiUrl) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
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
                apiUrl={storageId
                    ? `${API_ENDPOINTS.ports}${API_ENDPOINTS.ports.includes('?') ? '&' : '?'}storage_id=${storageId}`
                    : API_ENDPOINTS.ports
                }
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customSaveHandler={handlePortSave}
                customerId={activeCustomerId}
                tableName="ports"
                readOnly={isReadOnly}
                selectCheckboxDisabled={projectFilter !== 'current'}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_PORT_TEMPLATE}
                defaultSort={defaultSort}

                // Dropdown Configuration
                dropdownSources={dropdownSources}
                dynamicDropdownProvider={dynamicDropdownProvider}

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
                storageKey={`port-table-${storageId || activeCustomerId || 'default'}-${projectFilter}`}

                // Feature Flags
                enableFilters={true}
                enableExport={true}
                enablePagination={true}
                defaultPageSize={50}
            />
        </div>
    );
};

export default PortTableTanStackClean;
