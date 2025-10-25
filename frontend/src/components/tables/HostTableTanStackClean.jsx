import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";

// Clean TanStack Table implementation for Host management
// Props:
// - storageId (optional): Filter hosts to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage_system'])
const HostTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { user, getUserRole } = useAuth();

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeCustomerId = config?.customer?.id;

    // Check permissions for modifying customer data
    const userRole = getUserRole(activeCustomerId);

    // Determine if user can modify customer infrastructure
    const isViewer = userRole === 'viewer';
    const isAdmin = userRole === 'admin';
    const isMember = userRole === 'member';

    const canModifyInfrastructure = !isViewer && (isMember || isAdmin);
    const isReadOnly = !canModifyInfrastructure;

    // API endpoints - use storage/hosts endpoints instead of san/hosts
    const API_ENDPOINTS = {
        hosts: `${API_URL}/api/storage/hosts/`,
        storage: `${API_URL}/api/storage/`
    };

    // All available host columns
    const allColumns = [
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
    ];

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
    }), []);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(host => ({
            ...host,
            // Map wwpn_display to wwpns for table display
            wwpns: host.wwpn_display || host.wwpns || '',
            saved: !!host.id
        }));

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(host => host.storage_system === storageSystem.name);
            }
        }

        return processedData;
    }, [storageId, storageOptions]);

    // Note: With the new storage/hosts API, we don't need a custom save handler
    // The hosts are created/updated via Storage Insights import, not manual CRUD
    // This component is now primarily for viewing hosts from storage systems

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

    // Build API URL with customer filter and optional storage filter
    const buildApiUrl = () => {
        let url = `${API_ENDPOINTS.hosts}?customer=${activeCustomerId}`;
        if (storageId) {
            url += `&storage_id=${storageId}`;
        }
        return url;
    };

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> {getReadOnlyMessage()}
                </div>
            )}
            <TanStackCRUDTable
                // API Configuration
                apiUrl={buildApiUrl()}
                saveUrl={API_ENDPOINTS.hosts}
                deleteUrl={API_ENDPOINTS.hosts}
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

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`host-table-${storageId || activeCustomerId || 'default'}`}
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
        </div>
    );
};

export default HostTableTanStackClean;