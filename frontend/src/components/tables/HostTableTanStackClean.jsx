import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Host management
const HostTableTanStackClean = ({ storage }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // API endpoints
    const API_ENDPOINTS = {
        hosts: `${API_URL}/api/san/hosts/project/`,
        hostSave: `${API_URL}/api/san/hosts/save/`,
        hostDelete: `${API_URL}/api/san/hosts/delete/`,
        storage: `${API_URL}/api/storage/`
    };

    // Host columns
    const columns = [
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

    const colHeaders = columns.map(col => col.title);

    const NEW_HOST_TEMPLATE = {
        id: null,
        name: "",
        storage_system: "",
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
        return data.map(host => ({
            ...host,
            saved: !!host.id
        }));
    }, []);

    // Custom save handler for bulk host operations
    const handleHostSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            console.log('⚠️ No changes to save');
            return { success: true, message: 'No changes to save' };
        }

        try {
            console.log('🔥 Custom host save - RECEIVED DATA:');
            console.log('📊 Total rows received:', allTableData.length);
            console.log('📋 First 3 rows (full data):', allTableData.slice(0, 3));
            console.log('🗑️ Deletions to process:', deletedRows);

            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                console.log('🗑️ Processing host deletions:', deletedRows);
                for (const hostId of deletedRows) {
                    try {
                        await axios.delete(`${API_ENDPOINTS.hostDelete}${hostId}/`);
                        console.log(`✅ Deleted host ${hostId}`);
                    } catch (error) {
                        console.error(`❌ Failed to delete host ${hostId}:`, error);
                        return {
                            success: false,
                            message: `Failed to delete host ${hostId}: ${error.response?.data?.message || error.message}`
                        };
                    }
                }
            }

            // Build payload for hosts
            const payload = allTableData
                .filter(host => host.id || (host.name && host.name.trim() !== ""))
                .map(row => {
                    console.log('🔍 Processing row for save - RAW DATA:', row);
                    console.log('   name:', row.name);
                    console.log('   storage_system:', row.storage_system);
                    console.log('   wwpns:', row.wwpns);
                    console.log('   status:', row.status);
                    console.log('   host_type:', row.host_type);

                    // Find storage system ID and name from name
                    let storageSystemId = null;
                    let storageSystemName = null;
                    if (row.storage_system) {
                        const storage = storageOptions.find(s => s.name === row.storage_system);
                        if (storage) {
                            storageSystemId = parseInt(storage.id);
                            storageSystemName = storage.name;
                        }
                    }

                    // Clean payload
                    const cleanRow = { ...row };
                    delete cleanRow.saved;

                    // Handle boolean fields
                    if (typeof cleanRow.create === 'string') {
                        cleanRow.create = cleanRow.create.toLowerCase() === 'true';
                    }

                    const result = {
                        ...cleanRow,
                        projects: [activeProjectId],
                        storage: storageSystemId,  // ForeignKey ID for the storage relation
                        storage_system: storageSystemName  // CharField for the storage system name
                    };

                    return result;
                });

            // Only call bulk save if there are hosts to save
            if (payload.length > 0) {
                console.log('🚀 Sending bulk host save:');
                console.log('   Project ID:', activeProjectId);
                console.log('   Total hosts to save:', payload.length);
                console.log('   First 3 hosts (full payload):', payload.slice(0, 3));

                await axios.post(API_ENDPOINTS.hostSave, {
                    project_id: activeProjectId,
                    hosts: payload
                });
            } else {
                console.log('✅ No host data to save, only deletions were processed');
            }

            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} hosts`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} hosts`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return {
                success: true,
                message: message
            };

        } catch (error) {
            console.error('❌ Host save error:', error);
            return {
                success: false,
                message: `Error saving hosts: ${error.response?.data?.message || error.message}`
            };
        }
    };

    // Show loading while data loads
    if (loading || !activeProjectId) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">
                        {loading ? "Loading host data..." : "Please select a project to view hosts"}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_ENDPOINTS.hosts}${activeProjectId}/?format=table`}
                saveUrl={API_ENDPOINTS.hostSave}
                deleteUrl={API_ENDPOINTS.hostDelete}
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

                // Custom save handler for bulk host operations
                customSaveHandler={handleHostSave}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`host-table-${activeProjectId || 'default'}`}

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