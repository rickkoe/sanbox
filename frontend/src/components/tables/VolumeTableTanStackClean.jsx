import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";

// Clean TanStack Table implementation for Volume management
// Props:
// - storageId (optional): Filter volumes to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const VolumeTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeCustomerId = config?.customer?.id;

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // API endpoints
    const API_ENDPOINTS = {
        volumes: `${API_URL}/api/storage/volumes/`,
        storage: `${API_URL}/api/storage/`
    };

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
    const allColumns = [
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
    ];

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

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
    }), [formatBytes]);

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
                saved: !!volume.id
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
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure.
                </div>
            )}
            <TanStackCRUDTable
                // API Configuration
                apiUrl={storageId
                    ? `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}&storage_id=${storageId}`
                    : `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}`
                }
                saveUrl={API_ENDPOINTS.volumes}
                deleteUrl={API_ENDPOINTS.volumes}
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

export default VolumeTableTanStackClean;
