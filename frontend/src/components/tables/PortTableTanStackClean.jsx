import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";

// Clean TanStack Table implementation for Port management
// Props:
// - storageId (optional): Filter ports to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const PortTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // State for dropdown options
    const [fabricOptions, setFabricOptions] = useState([]);
    const [storageOptions, setStorageOptions] = useState([]);
    const [aliasOptions, setAliasOptions] = useState([]);

    // API endpoints
    const API_ENDPOINTS = {
        ports: `${API_URL}/api/storage/ports/`,
        fabrics: `${API_URL}/api/san/fabrics/`,
        storage: `${API_URL}/api/storage/`,
        aliases: `${API_URL}/api/san/aliases/`
    };

    // Speed options based on port type
    const getSpeedOptions = useCallback((portType) => {
        if (portType === 'fc') {
            return [8, 16, 32, 64];
        } else if (portType === 'ethernet') {
            return [1, 10, 25, 100];
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

    // Fetch fabrics for dropdown
    useEffect(() => {
        const fetchFabrics = async () => {
            if (!activeCustomerId) return;
            try {
                const response = await axios.get(`${API_ENDPOINTS.fabrics}?customer=${activeCustomerId}&page_size=All`);
                const fabrics = response.data.results || [];
                setFabricOptions(fabrics.map(f => ({ value: f.id, label: f.name })));
            } catch (error) {
                console.error("Failed to fetch fabrics:", error);
            }
        };
        fetchFabrics();
    }, [activeCustomerId, API_ENDPOINTS.fabrics]);

    // Fetch storage systems for dropdown
    useEffect(() => {
        const fetchStorageSystems = async () => {
            if (!activeCustomerId) return;
            try {
                const response = await axios.get(`${API_ENDPOINTS.storage}?customer=${activeCustomerId}&page_size=All`);
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

    // Core port columns - all available columns
    const allColumns = [
        { data: "name", title: "Name", required: true, width: 150 },
        {
            data: "storage",
            title: "Storage System",
            type: "dropdown",
            required: true,
            width: 200
        },
        { data: "wwpn", title: "WWPN", width: 180 },
        {
            data: "type",
            title: "Type",
            type: "dropdown",
            required: true,
            width: 150
        },
        {
            data: "speed_gbps",
            title: "Speed (Gbps)",
            type: "dropdown",
            width: 120
        },
        {
            data: "use",
            title: "Use",
            type: "dropdown",
            width: 120
        },
        {
            data: "protocol",
            title: "Protocol",
            type: "dropdown",
            width: 120
        },
        { data: "location", title: "Location", width: 150 },
        { data: "frame", title: "Frame", type: "numeric", width: 100 },
        { data: "io_enclosure", title: "I/O Enclosure", type: "numeric", width: 130 },
        {
            data: "fabric",
            title: "Fabric",
            readOnly: true,
            width: 150
        },
        {
            data: "alias",
            title: "Alias",
            readOnly: true,
            width: 150
        },
    ];

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

    const NEW_PORT_TEMPLATE = {
        id: null,
        name: "",
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
    };

    // Dropdown sources with all options (fabric and alias are read-only, auto-populated from WWPN)
    const dropdownSources = useMemo(() => {
        const sources = {
            type: ["Fibre Channel", "Ethernet"],
            use: ["Host", "Replication"],
            storage: storageOptions.map(opt => opt.label),
            // Include all possible speed options (FC + Ethernet)
            speed_gbps: ["1", "8", "10", "16", "25", "32", "64", "100"],
            // Include all possible protocol options
            protocol: ["FICON", "SCSI FCP", "NVMe FCP", "TCP/IP", "iSCSI", "RDMA"]
            // fabric and alias are NOT in dropdowns - they're read-only and auto-populated
        };

        return sources;
    }, [storageOptions]);

    // Dynamic dropdown provider for speed, protocol, and aliases
    const dynamicDropdownProvider = useCallback((row, col, data) => {
        const rowData = data[row];
        const columnName = columns[col]?.data;

        if (columnName === 'speed_gbps') {
            // Convert display value to internal value
            let portType = rowData?.type_value || rowData?.type || 'fc';
            if (portType === 'Fibre Channel') portType = 'fc';
            else if (portType === 'Ethernet') portType = 'ethernet';

            const speeds = getSpeedOptions(portType);
            console.log('Speed dropdown - portType:', portType, 'speeds:', speeds);
            return speeds.map(speed => speed.toString());
        }

        if (columnName === 'protocol') {
            // Convert display value to internal value
            let portType = rowData?.type_value || rowData?.type || 'fc';
            if (portType === 'Fibre Channel') portType = 'fc';
            else if (portType === 'Ethernet') portType = 'ethernet';

            const storageId = rowData?.storage;

            // Find storage type from storage options
            const storage = storageOptions.find(s => s.value === storageId);
            const storageType = storage?.storage_type || rowData?.storage_type || 'DS8000';

            const protocols = getProtocolOptions(portType, storageType);
            console.log('Protocol dropdown - portType:', portType, 'storageType:', storageType, 'protocols:', protocols);
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
    }), [formatWWPN, isValidWWPNFormat]);

    // Process data for display - convert IDs to labels
    const preprocessData = useCallback((data) => {
        return data.map(port => {
            // Convert type value to display value
            const typeDisplay = port.type === 'fc' ? 'Fibre Channel' :
                               port.type === 'ethernet' ? 'Ethernet' : port.type;

            // Convert use value to display value
            const useDisplay = port.use === 'host' ? 'Host' :
                              port.use === 'replication' ? 'Replication' : port.use;

            // Get storage name
            const storageObj = storageOptions.find(s => s.value === port.storage);
            const storageDisplay = storageObj ? storageObj.label : '';

            // Get fabric name (from alias lookup if available)
            const fabricObj = fabricOptions.find(f => f.value === port.fabric);
            const fabricDisplay = fabricObj ? fabricObj.label : '';

            // Get alias name (from WWPN lookup if available)
            const aliasObj = aliasOptions.find(a => a.id === port.alias);
            const aliasDisplay = aliasObj ? aliasObj.name : '';

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

            // Use storage_id if available, otherwise convert label to ID
            if (payload.storage_id) {
                payload.storage = payload.storage_id;
                delete payload.storage_id;
            } else if (payload.storage && typeof payload.storage === 'string') {
                const storage = storageOptions.find(s => s.label === payload.storage);
                payload.storage = storage ? storage.value : null;
            }

            // Use fabric_id if available, otherwise convert label to ID
            // (Only if not already set by WWPN lookup)
            if (!payload.fabric && payload.fabric_id) {
                payload.fabric = payload.fabric_id;
                delete payload.fabric_id;
            } else if (!payload.fabric && payload.fabric && typeof payload.fabric === 'string') {
                const fabric = fabricOptions.find(f => f.label === payload.fabric);
                payload.fabric = fabric ? fabric.value : null;
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

            // Note: Ports belong to storage systems (customer-level), not projects
            // Remove project field if it exists (legacy)
            delete payload.project;

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions, fabricOptions, aliasOptions, activeProjectId, formatWWPN]);

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="ports" />;
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure.
                </div>
            )}
            <TanStackCRUDTable
                // API Configuration
                // Ports belong to storage systems (customer-level), so we filter by customer
                // Optionally filter by specific storage system if storageId prop is provided
                // Alias lookup happens client-side using the active project
                apiUrl={storageId
                    ? `${API_ENDPOINTS.ports}?customer=${activeCustomerId}&storage_id=${storageId}`
                    : `${API_ENDPOINTS.ports}?customer=${activeCustomerId}`
                }
                saveUrl={API_ENDPOINTS.ports}
                deleteUrl={API_ENDPOINTS.ports}
                customerId={activeCustomerId}
                tableName="ports"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_PORT_TEMPLATE}

                // Dropdown Configuration
                dropdownSources={dropdownSources}
                dynamicDropdownProvider={dynamicDropdownProvider}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // Custom Renderers
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 250px)"
                stretchH="all"
                autoColumnSize={true}
                manualColumnResize={true}

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
