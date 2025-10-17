import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { useAuth } from "../context/AuthContext";
import TanStackCRUDTable from "../components/tables/TanStackTable/TanStackCRUDTable";

const StoragePortsPage = () => {
    const { id } = useParams(); // Storage system ID
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { setBreadcrumbMap } = useContext(BreadcrumbContext);
    const { getUserRole } = useAuth();

    const [storageSystem, setStorageSystem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fabricOptions, setFabricOptions] = useState([]);
    const [aliasOptions, setAliasOptions] = useState([]);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.project?.id;

    // Check if user can edit infrastructure
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // API endpoints
    const API_ENDPOINTS = {
        ports: `${API_URL}/api/storage/ports/`,
        storage: `${API_URL}/api/storage/${id}/`,
        fabrics: `${API_URL}/api/san/fabrics/`,
        aliases: `${API_URL}/api/san/aliases/`
    };

    // Fetch storage system details
    useEffect(() => {
        const fetchStorage = async () => {
            try {
                const response = await axios.get(API_ENDPOINTS.storage);
                setStorageSystem(response.data);
                setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
                setLoading(false);
            } catch (error) {
                console.error("Failed to fetch storage system:", error);
                setLoading(false);
            }
        };
        fetchStorage();
    }, [id, API_ENDPOINTS.storage, setBreadcrumbMap]);

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

    // Fetch aliases
    useEffect(() => {
        const fetchAliases = async () => {
            if (!activeCustomerId || !activeProjectId) return;
            try {
                const response = await axios.get(`${API_ENDPOINTS.aliases}?customer=${activeCustomerId}&project=${activeProjectId}&page_size=All`);
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
        { data: "storage_display", title: "Storage System", readOnly: true, width: 200 },
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
        storage: parseInt(id),
        storage_display: storageSystem?.name || '',
        type: "fc",
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

    // Dropdown sources with all options
    const dropdownSources = useMemo(() => ({
        type: ["Fibre Channel", "Ethernet"],
        use: ["Host", "Replication"],
        fabric: fabricOptions.map(opt => opt.label),
        // Include all possible speed options
        speed_gbps: ["1", "8", "10", "16", "25", "32", "64", "100"],
        // Include all possible protocol options
        protocol: ["FICON", "SCSI FCP", "NVMe FCP", "TCP/IP", "iSCSI", "RDMA"],
        // All available aliases
        alias: aliasOptions.map(a => a.name)
    }), [fabricOptions, aliasOptions]);

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

            const storageType = storageSystem?.storage_type || 'DS8000';
            const protocols = getProtocolOptions(portType, storageType);
            console.log('Protocol dropdown - portType:', portType, 'storageType:', storageType, 'protocols:', protocols);
            return protocols;
        }

        if (columnName === 'alias') {
            const fabricId = rowData?.fabric;
            if (!fabricId) {
                return [];
            }

            const fabricAliases = aliasOptions.filter(alias =>
                alias.fabric === fabricId &&
                alias.projects && alias.projects.includes(activeProjectId)
            );

            const usedAliasIds = data
                .filter((r, idx) => idx !== row && r.alias)
                .map(r => r.alias);

            return fabricAliases.map(alias => {
                const isUsed = usedAliasIds.includes(alias.id);
                return isUsed ? `${alias.name} (used)` : alias.name;
            });
        }

        return null;
    }, [columns, storageSystem, aliasOptions, activeProjectId, getSpeedOptions, getProtocolOptions]);

    // Custom renderers
    const customRenderers = useMemo(() => ({
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        },
        storage_display: (rowData, td, row, col, prop, value) => {
            return value || storageSystem?.name || "";
        }
    }), [storageSystem]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(port => {
            const typeDisplay = port.type === 'fc' ? 'Fibre Channel' :
                               port.type === 'ethernet' ? 'Ethernet' : port.type;

            const useDisplay = port.use === 'host' ? 'Host' :
                              port.use === 'replication' ? 'Replication' : port.use;

            const fabric = fabricOptions.find(f => f.value === port.fabric);
            const fabricDisplay = fabric ? fabric.label : '';

            const alias = aliasOptions.find(a => a.id === port.alias);
            const aliasDisplay = alias ? alias.name : '';

            return {
                ...port,
                storage_display: storageSystem?.name || '',
                type_value: port.type,
                type: typeDisplay,
                use_value: port.use,
                use: useDisplay,
                fabric_display: fabricDisplay,
                alias_display: aliasDisplay,
                saved: !!port.id
            };
        });
    }, [storageSystem, fabricOptions, aliasOptions]);

    // Transform data for saving
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;
            delete payload.storage_display;
            delete payload.fabric_display;
            delete payload.alias_display;
            delete payload.type_value;
            delete payload.use_value;
            delete payload.storage_details;
            delete payload.fabric_details;
            delete payload.alias_details;
            delete payload.project_details;
            delete payload.storage_type;

            // Convert type display back to value
            if (payload.type === 'Fibre Channel') payload.type = 'fc';
            else if (payload.type === 'Ethernet') payload.type = 'ethernet';

            // Convert use display back to value
            if (payload.use === 'Host') payload.use = 'host';
            else if (payload.use === 'Replication') payload.use = 'replication';

            // Ensure storage is set
            payload.storage = parseInt(id);

            // Convert fabric label to ID
            if (payload.fabric && typeof payload.fabric === 'string') {
                const fabric = fabricOptions.find(f => f.label === payload.fabric);
                payload.fabric = fabric ? fabric.value : null;
            }

            // Convert alias label to ID
            if (payload.alias && typeof payload.alias === 'string') {
                const aliasName = payload.alias.replace(' (used)', '');
                const alias = aliasOptions.find(a => a.name === aliasName);
                payload.alias = alias ? alias.id : null;
            }

            // Convert speed to integer
            if (payload.speed_gbps && typeof payload.speed_gbps === 'string') {
                payload.speed_gbps = parseInt(payload.speed_gbps, 10);
            }

            // Ensure required fields
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Port";
            }

            if (!payload.type) {
                payload.type = "fc";
            }

            payload.project = activeProjectId;

            // Convert empty strings to null
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [id, fabricOptions, aliasOptions, activeProjectId]);

    if (loading) {
        return <div className="container mt-4">Loading...</div>;
    }

    if (!storageSystem) {
        return <div className="container mt-4">Storage system not found.</div>;
    }

    return (
        <div className="modern-table-container">
            <h4 className="mb-3">{storageSystem.name} - Ports</h4>
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure.
                </div>
            )}
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_ENDPOINTS.ports}?storage_id=${id}&project=${activeProjectId}`}
                saveUrl={API_ENDPOINTS.ports}
                deleteUrl={API_ENDPOINTS.ports}
                customerId={activeCustomerId}
                tableName={`storage-${id}-ports`}
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
                height="calc(100vh - 300px)"
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

export default StoragePortsPage;
