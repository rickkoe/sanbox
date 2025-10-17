import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";

// Clean TanStack Table implementation for Port management
const PortTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.project?.id;

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

    // Fetch all aliases (will be filtered dynamically per row)
    useEffect(() => {
        const fetchAliases = async () => {
            if (!activeCustomerId) return;
            try {
                // Fetch aliases for customer, will filter by project in the dropdown provider
                const params = activeProjectId
                    ? `?customer=${activeCustomerId}&project=${activeProjectId}&page_size=All`
                    : `?customer=${activeCustomerId}&page_size=All`;
                const response = await axios.get(`${API_ENDPOINTS.aliases}${params}`);
                const aliases = response.data.results || [];
                setAliasOptions(aliases);
            } catch (error) {
                console.error("Failed to fetch aliases:", error);
            }
        };
        fetchAliases();
    }, [activeCustomerId, activeProjectId, API_ENDPOINTS.aliases]);

    // Core port columns
    const columns = [
        { data: "id", title: "ID", readOnly: true, width: 80 },
        { data: "name", title: "Name", required: true, width: 150 },
        {
            data: "storage",
            title: "Storage System",
            type: "dropdown",
            required: true,
            width: 200
        },
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
            required: true,
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
            type: "dropdown",
            width: 150
        },
        {
            data: "alias",
            title: "Alias",
            type: "dropdown",
            width: 150
        },
    ];

    const colHeaders = columns.map(col => col.title);

    const NEW_PORT_TEMPLATE = {
        id: null,
        name: "",
        storage: null,
        type: "Fibre Channel", // Display value, will be converted to 'fc' on save
        type_value: "fc", // Internal value
        speed_gbps: null,
        use: null,
        protocol: null,
        location: "",
        frame: null,
        io_enclosure: null,
        fabric: null,
        alias: null,
        project: activeProjectId
    };

    // Dropdown sources with all options (TanStackCRUDTable doesn't support fully dynamic dropdowns yet)
    const dropdownSources = useMemo(() => {
        const sources = {
            type: ["Fibre Channel", "Ethernet"],
            use: ["Host", "Replication"],
            storage: storageOptions.map(opt => opt.label),
            fabric: fabricOptions.map(opt => opt.label),
            // Include all possible speed options (FC + Ethernet)
            speed_gbps: ["1", "8", "10", "16", "25", "32", "64", "100"],
            // Include all possible protocol options
            protocol: ["FICON", "SCSI FCP", "NVMe FCP", "TCP/IP", "iSCSI", "RDMA"],
            // Aliases will be all available aliases
            alias: aliasOptions.map(a => a.name)
        };

        return sources;
    }, [storageOptions, fabricOptions, aliasOptions]);

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
        }
    }), []);

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

            // Get fabric name
            const fabricObj = fabricOptions.find(f => f.value === port.fabric);
            const fabricDisplay = fabricObj ? fabricObj.label : '';

            // Get alias name
            const aliasObj = aliasOptions.find(a => a.id === port.alias);
            const aliasDisplay = aliasObj ? aliasObj.name : '';

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
                fabric: fabricDisplay, // Display name
                alias_id: port.alias, // Keep original alias ID
                alias: aliasDisplay, // Display name
                saved: !!port.id
            };
        });
    }, [storageOptions, fabricOptions, aliasOptions]);

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
            if (payload.fabric_id) {
                payload.fabric = payload.fabric_id;
                delete payload.fabric_id;
            } else if (payload.fabric && typeof payload.fabric === 'string') {
                const fabric = fabricOptions.find(f => f.label === payload.fabric);
                payload.fabric = fabric ? fabric.value : null;
            }

            // Use alias_id if available, otherwise convert label to ID
            if (payload.alias_id) {
                payload.alias = payload.alias_id;
                delete payload.alias_id;
            } else if (payload.alias && typeof payload.alias === 'string') {
                const aliasName = payload.alias.replace(' (used)', '');
                const alias = aliasOptions.find(a => a.name === aliasName);
                payload.alias = alias ? alias.id : null;
            }

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

            // Add the project ID if available (it's optional)
            if (activeProjectId) {
                payload.project = activeProjectId;
            } else {
                // Project is optional, so we can leave it as null
                payload.project = null;
            }

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions, fabricOptions, aliasOptions, activeProjectId]);

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
                apiUrl={activeProjectId ? `${API_ENDPOINTS.ports}?project=${activeProjectId}` : `${API_ENDPOINTS.ports}?customer=${activeCustomerId}`}
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
