import React, { useState, useEffect, useContext, useMemo } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Alias management
const AliasTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);

    const [fabricOptions, setFabricOptions] = useState([]);
    const [hostOptions, setHostOptions] = useState([]);
    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // API endpoints
    const API_ENDPOINTS = {
        aliases: `${API_URL}/api/san/aliases/project/`,
        fabrics: `${API_URL}/api/san/fabrics/`,
        hosts: `${API_URL}/api/san/hosts/project/`,
        storages: `${API_URL}/api/storage/`,
        aliasSave: `${API_URL}/api/san/aliases/save/`,
        aliasDelete: `${API_URL}/api/san/aliases/delete/`
    };

    // All possible alias columns
    const columns = [
        { data: "name", title: "Name" },
        { data: "wwpn", title: "WWPN" },
        { data: "use", title: "Use", type: "dropdown" },
        { data: "fabric_details.name", title: "Fabric", type: "dropdown" },
        { data: "host_details.name", title: "Host", type: "dropdown" },
        { data: "storage_details.name", title: "Storage System", type: "dropdown" },
        { data: "cisco_alias", title: "Alias Type", type: "dropdown" },
        { data: "create", title: "Create", type: "checkbox" },
        { data: "delete", title: "Delete", type: "checkbox" },
        { data: "include_in_zoning", title: "Include in Zoning", type: "checkbox" },
        { data: "logged_in", title: "Logged In", type: "checkbox" },
        { data: "zoned_count", title: "Zoned Count", type: "numeric", readOnly: true },
        { data: "imported", title: "Imported", readOnly: true },
        { data: "updated", title: "Updated", readOnly: true },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

    const NEW_ALIAS_TEMPLATE = {
        id: null,
        name: "",
        wwpn: "",
        use: "",
        fabric: "",
        fabric_details: { name: "" },
        host: "",
        host_details: { name: "" },
        storage: "",
        storage_details: { name: "" },
        cisco_alias: "",
        create: false,
        delete: false,
        include_in_zoning: false,
        logged_in: false,
        notes: "",
        imported: null,
        updated: null,
        zoned_count: 0
    };

    // WWPN formatting utilities
    const formatWWPN = (value) => {
        if (!value) return "";
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleanValue.length !== 16) return value;
        return cleanValue.match(/.{2}/g).join(':');
    };

    const isValidWWPNFormat = (value) => {
        if (!value) return true;
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
        return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
    };

    // Load fabrics, hosts, and storage systems
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId && activeProjectId) {
                try {
                    setLoading(true);
                    console.log('Loading dropdown data for alias table...');

                    const [fabricResponse, hostResponse, storageResponse] = await Promise.all([
                        axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`),
                        axios.get(`${API_ENDPOINTS.hosts}${activeProjectId}/`),
                        axios.get(`${API_ENDPOINTS.storages}?customer=${activeCustomerId}`)
                    ]);

                    // Handle paginated response structure
                    const fabricsArray = fabricResponse.data.results || fabricResponse.data;
                    setFabricOptions(fabricsArray.map(f => ({ id: f.id, name: f.name })));

                    setHostOptions(hostResponse.data.map(h => ({ id: h.id, name: h.name })));

                    const storageArray = storageResponse.data.results || storageResponse.data;
                    setStorageOptions(storageArray.map(s => ({ id: s.id, name: s.name })));

                    console.log('✅ Dropdown data loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading dropdown data:', error);
                    setLoading(false);
                }
            }
        };

        loadData();
    }, [activeCustomerId, activeProjectId]);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        use: ["init", "target", "both"],
        "fabric_details.name": fabricOptions.map(f => f.name),
        "host_details.name": hostOptions.map(h => h.name), // Note: Should be conditional based on use=init
        "storage_details.name": storageOptions.map(s => s.name),
        cisco_alias: ["device-alias", "fcalias", "wwpn"],
    }), [fabricOptions, hostOptions, storageOptions]);

    // Custom renderers for WWPN formatting
    const customRenderers = {
        wwpn: (rowData, td, row, col, prop, value) => {
            if (value && isValidWWPNFormat(value)) {
                return formatWWPN(value);
            }
            return value || "";
        }
    };

    // Process data for display - convert IDs to names in nested properties
    const preprocessData = (data) => {
        return data.map(alias => ({
            ...alias,
            // Keep nested structure for display
            fabric_details: alias.fabric_details || { name: "" },
            host_details: alias.host_details || { name: "" },
            storage_details: alias.storage_details || { name: "" },
            // Ensure zoned_count defaults to 0 if not set
            zoned_count: alias.zoned_count || 0
        }));
    };

    // Custom save handler that matches the original AliasTable bulk save approach
    // Handles CREATE, UPDATE, and DELETE operations
    const handleAliasSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            console.log('⚠️ No changes to save');
            return { success: true, message: 'No changes to save' };
        }

        try {
            console.log('🔥 Custom alias save with data:', allTableData);
            console.log('🗑️ Deletions to process:', deletedRows);
            console.log('🔍 Data types in save:', allTableData.map(row => ({ name: row.name, id: row.id, type: typeof row.id })));

            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                console.log('🗑️ Processing deletions:', deletedRows);
                for (const aliasId of deletedRows) {
                    try {
                        await axios.delete(`${API_ENDPOINTS.aliasDelete}${aliasId}/`);
                        console.log(`✅ Deleted alias ${aliasId}`);
                    } catch (error) {
                        console.error(`❌ Failed to delete alias ${aliasId}:`, error);
                        return {
                            success: false,
                            message: `Failed to delete alias ${aliasId}: ${error.response?.data?.message || error.message}`
                        };
                    }
                }
            }

            // Validate WWPNs
            const invalidWWPN = allTableData.find((alias) => {
                if (!alias.name || alias.name.trim() === "") return false;
                if (!alias.wwpn) return true;
                const cleanWWPN = alias.wwpn.replace(/[^0-9a-fA-F]/g, "");
                return cleanWWPN.length !== 16 || !/^[0-9a-fA-F]+$/.test(cleanWWPN);
            });

            if (invalidWWPN) {
                return {
                    success: false,
                    message: `⚠️ Invalid WWPN format for alias "${invalidWWPN.name}". Must be 16 hex characters.`,
                };
            }

            // Build payload for each alias using the original logic
            const payload = allTableData
                .filter(alias => alias.id || (alias.name && alias.name.trim() !== ""))
                .map(row => {
                    console.log('🔍 Processing row for save:', {
                        name: row.name,
                        fabric_details: row.fabric_details,
                        'fabric_details?.name': row.fabric_details?.name,
                        'row["fabric_details.name"]': row['fabric_details.name'],
                        'row.fabric': row.fabric,
                        'Full row keys:': Object.keys(row),
                        availableFabrics: fabricOptions.map(f => f.name)
                    });

                    // Find IDs from names - the dropdown stores values as 'fabric_details.name' directly in row data
                    let fabricName = row['fabric_details.name'] || row.fabric_details?.name || row.fabric;
                    let hostName = row.host_details?.name || row['host_details.name'] || row.host;
                    let storageName = row.storage_details?.name || row['storage_details.name'] || row.storage;

                    const fabric = fabricOptions.find(f => f.name === fabricName);
                    const host = hostOptions.find(h => h.name === hostName);
                    const storage = storageOptions.find(s => s.name === storageName);

                    console.log('🎯 Found references:', {
                        fabricName: fabricName,
                        fabric: fabric,
                        hostName: hostName,
                        host: host,
                        storageName: storageName,
                        storage: storage
                    });

                    if (!fabric) {
                        console.error('❌ Fabric lookup failed for row:', row);
                        throw new Error(`Alias "${row.name}" must have a valid fabric selected`);
                    }

                    // Clean payload (replicating original buildPayload)
                    const cleanRow = { ...row };
                    delete cleanRow.saved;
                    delete cleanRow.fabric_details;
                    delete cleanRow.host_details;
                    delete cleanRow.storage_details;
                    delete cleanRow.zoned_count;

                    // Format WWPN
                    if (cleanRow.wwpn) {
                        cleanRow.wwpn = formatWWPN(cleanRow.wwpn);
                    }

                    // Handle boolean fields
                    const booleanFields = ['create', 'delete', 'include_in_zoning', 'logged_in'];
                    booleanFields.forEach(field => {
                        if (cleanRow[field] === 'unknown' || cleanRow[field] === undefined || cleanRow[field] === null || cleanRow[field] === '') {
                            cleanRow[field] = false;
                        } else if (typeof cleanRow[field] === 'string') {
                            cleanRow[field] = cleanRow[field].toLowerCase() === 'true';
                        }
                    });

                    const result = {
                        ...cleanRow,
                        projects: [activeProjectId],
                        fabric: parseInt(fabric.id),
                        host: null,
                        storage: null
                    };

                    // Handle host assignment (only for initiators)
                    if (row.host_details?.name && row.use === 'init' && host) {
                        result.host = parseInt(host.id);
                    }

                    // Handle storage assignment (only for targets)
                    if (row.storage_details?.name && row.use === 'target' && storage) {
                        result.storage = parseInt(storage.id);
                    }

                    return result;
                });

            // Only call bulk save if there are rows to save
            if (payload.length > 0) {
                console.log('🚀 Sending bulk alias save:', { project_id: activeProjectId, aliases: payload });

                // Use the original bulk save endpoint
                await axios.post(API_ENDPOINTS.aliasSave, {
                    project_id: activeProjectId,
                    aliases: payload,
                });
            } else {
                console.log('✅ No data to save, only deletions were processed');
            }

            const totalOperations = payload.length + (deletedRows ? deletedRows.length : 0);
            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} aliases`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} aliases`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return {
                success: true,
                message: message
            };

        } catch (error) {
            console.error('❌ Alias save error:', error);
            return {
                success: false,
                message: `Error saving aliases: ${error.response?.data?.message || error.message}`
            };
        }
    };

    // Transform data for saving - not used since we have custom save handler
    const saveTransform = (rows) => rows;

    // Show loading while data loads
    if (loading || !activeProjectId) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">
                        {loading ? "Loading alias data..." : "Please select a project to view aliases"}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration - uses custom save endpoint
                apiUrl={`${API_ENDPOINTS.aliases}${activeProjectId}/`}
                saveUrl={API_ENDPOINTS.aliasSave}
                deleteUrl={API_ENDPOINTS.aliasDelete}
                customerId={activeCustomerId}
                tableName="aliases"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_ALIAS_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`alias-table-${activeProjectId || 'default'}`}

                // Custom save handler - bypass default CRUD and use bulk save
                customSaveHandler={handleAliasSave}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Alias save successful:', result.message);
                    } else {
                        console.error('❌ Alias save failed:', result.message);
                        alert('Error saving aliases: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default AliasTableTanStackClean;