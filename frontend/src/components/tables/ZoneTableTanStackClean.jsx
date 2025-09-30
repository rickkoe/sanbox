import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Zone management
const ZoneTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { settings } = useSettings();

    const [fabricOptions, setFabricOptions] = useState([]);
    const [fabricsById, setFabricsById] = useState({});
    const [aliasOptions, setAliasOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [maxMemberColumns, setMaxMemberColumns] = useState(10);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // API endpoints
    const API_ENDPOINTS = {
        zones: `${API_URL}/api/san/zones/project/`,
        fabrics: `${API_URL}/api/san/fabrics/`,
        aliases: `${API_URL}/api/san/aliases/project/`,
        zoneSave: `${API_URL}/api/san/zones/save/`,
        zoneDelete: `${API_URL}/api/san/zones/delete/`
    };

    // Base zone columns
    const baseColumns = [
        { data: "name", title: "Name", required: true },
        { data: "fabric", title: "Fabric", type: "dropdown", required: true },
        { data: "member_count", title: "Members", type: "numeric", readOnly: true },
        { data: "create", title: "Create", type: "checkbox" },
        { data: "delete", title: "Delete", type: "checkbox" },
        { data: "exists", title: "Exists", type: "checkbox", readOnly: true },
        { data: "zone_type", title: "Zone Type", type: "dropdown" },
        { data: "imported", title: "Imported", readOnly: true },
        { data: "updated", title: "Updated", readOnly: true },
        { data: "notes", title: "Notes" }
    ];

    // Generate dynamic member columns (temporarily remove dropdown type)
    const memberColumns = useMemo(() => {
        const columns = [];
        for (let i = 1; i <= maxMemberColumns; i++) {
            columns.push({
                data: `member_${i}`,
                title: `Member ${i}`,
                // type: "dropdown" // Temporarily remove to debug member preservation
            });
        }
        return columns;
    }, [maxMemberColumns]);

    // All columns (base + member)
    const allColumns = useMemo(() => {
        return [...baseColumns, ...memberColumns];
    }, [baseColumns, memberColumns]);

    const colHeaders = allColumns.map(col => col.title);

    const NEW_ZONE_TEMPLATE = useMemo(() => {
        const template = {
            id: null,
            name: "",
            fabric: "",
            member_count: 0,
            create: false,
            delete: false,
            exists: false,
            zone_type: "",
            notes: "",
            imported: null,
            updated: null
        };

        // Add member fields
        for (let i = 1; i <= maxMemberColumns; i++) {
            template[`member_${i}`] = "";
        }

        return template;
    }, [maxMemberColumns]);

    // Load fabrics and aliases
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId && activeProjectId) {
                try {
                    setLoading(true);
                    console.log('Loading zone dropdown data...');

                    const [fabricResponse, aliasResponse] = await Promise.all([
                        axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`),
                        axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/`)
                    ]);

                    // Handle paginated responses
                    const fabricsArray = fabricResponse.data.results || fabricResponse.data;
                    setFabricOptions(fabricsArray.map(f => ({ id: f.id, name: f.name })));

                    // Create fabric ID map for reverse lookup
                    const fabricMap = {};
                    fabricsArray.forEach(fabric => {
                        fabricMap[fabric.id] = fabric.name;
                    });
                    setFabricsById(fabricMap);

                    // Process aliases with fabric names and filtering
                    const aliasesArray = aliasResponse.data.results || aliasResponse.data;
                    const processedAliases = aliasesArray.map(alias => ({
                        id: alias.id,
                        name: alias.name,
                        fabric: alias.fabric_details?.name || fabricMap[alias.fabric] || '',
                        include_in_zoning: alias.include_in_zoning,
                        zoned_count: alias.zoned_count || 0,
                        use: alias.use
                    }));
                    setAliasOptions(processedAliases);

                    console.log('✅ Zone dropdown data loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading zone dropdown data:', error);
                    setLoading(false);
                }
            }
        };

        loadData();
    }, [activeCustomerId, activeProjectId]);

    // Calculate used aliases to filter dropdowns
    const calculateUsedAliases = useCallback((tableData, currentRowIndex, currentMemberColumn) => {
        const usedAliases = new Set();

        tableData.forEach((row, rowIndex) => {
            for (let i = 1; i <= maxMemberColumns; i++) {
                const memberName = row[`member_${i}`];
                if (memberName) {
                    // Don't count the current cell being edited
                    if (!(rowIndex === currentRowIndex && `member_${i}` === currentMemberColumn)) {
                        usedAliases.add(memberName);
                    }
                }
            }
        });

        return usedAliases;
    }, [maxMemberColumns]);

    // Custom member dropdown renderer that filters by fabric
    const getMemberDropdownOptions = useCallback((rowData, columnKey) => {
        const zoneFabric = rowData.fabric;
        console.log(`🔍 Getting member options for ${columnKey}, zone fabric: ${zoneFabric}`);

        if (!zoneFabric) {
            console.log('⚠️ No zone fabric selected, showing no options');
            return [];
        }

        const aliasMaxZones = settings?.alias_max_zones || 1;

        // Filter aliases by fabric and zoning rules
        const filteredAliases = aliasOptions.filter(alias => {
            const matchesFabric = alias.fabric === zoneFabric;
            const includeInZoning = alias.include_in_zoning;
            const hasRoom = (alias.zoned_count || 0) < aliasMaxZones;

            const result = matchesFabric && includeInZoning && hasRoom;
            if (!result && alias.name) {
                console.log(`❌ Filtered out ${alias.name}: fabric=${alias.fabric} (need ${zoneFabric}), zoning=${includeInZoning}, room=${hasRoom}`);
            }
            return result;
        });

        console.log(`✅ Found ${filteredAliases.length} valid members for fabric ${zoneFabric}`);
        return filteredAliases.map(alias => alias.name);
    }, [aliasOptions, settings]);

    // Custom renderers for member dropdowns
    const customRenderers = useMemo(() => {
        const renderers = {};

        // Add custom renderers for each member column
        for (let i = 1; i <= maxMemberColumns; i++) {
            const memberKey = `member_${i}`;
            renderers[memberKey] = (rowData, td, row, col, prop, value) => {
                // Get dynamic options based on zone fabric
                const options = getMemberDropdownOptions(rowData, memberKey);

                // Create a simple dropdown for now - this will need enhancement
                const select = document.createElement('select');
                select.style.width = '100%';
                select.style.border = 'none';
                select.style.background = 'transparent';

                // Add empty option
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '';
                select.appendChild(emptyOption);

                // Add filtered options
                options.forEach(optionValue => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    if (optionValue === value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                return select.outerHTML;
            };
        }

        return renderers;
    }, [maxMemberColumns, getMemberDropdownOptions]);

    // Dynamic dropdown sources that include member filtering
    const dropdownSources = useMemo(() => {
        const sources = {
            fabric: fabricOptions.map(f => f.name),
            zone_type: ["smart", "standard"]
        };

        // Add member dropdown sources (will be filtered by custom renderers)
        const aliasMaxZones = settings?.alias_max_zones || 1;
        const availableAliases = aliasOptions.filter(alias =>
            alias.include_in_zoning && (alias.zoned_count || 0) < aliasMaxZones
        );

        // Add all member columns with full alias list (filtering happens in custom renderer)
        for (let i = 1; i <= maxMemberColumns; i++) {
            sources[`member_${i}`] = availableAliases.map(alias => alias.name);
        }

        return sources;
    }, [fabricOptions, aliasOptions, settings, maxMemberColumns]);

    // Dynamic dropdown filters for member columns
    const dropdownFilters = useMemo(() => {
        const filters = {};

        // Create fabric-based filter for member columns
        for (let i = 1; i <= maxMemberColumns; i++) {
            const memberKey = `member_${i}`;
            filters[memberKey] = (options, rowData, columnKey) => {
                const zoneFabric = rowData?.fabric;
                if (!zoneFabric) {
                    console.log(`⚠️ No fabric selected for ${columnKey}, showing no options`);
                    return [];
                }

                const aliasMaxZones = settings?.alias_max_zones || 1;
                const currentValue = rowData?.[columnKey]; // Current value in this cell

                // Get all aliases already used in other member columns of this same zone
                const usedInThisZone = new Set();
                for (let i = 1; i <= maxMemberColumns; i++) {
                    const memberCol = `member_${i}`;
                    if (memberCol !== columnKey && rowData?.[memberCol]) {
                        usedInThisZone.add(rowData[memberCol]);
                    }
                }

                // Filter aliases by fabric, zone count limits, and current zone usage
                const filteredAliases = aliasOptions.filter(alias => {
                    // Must match fabric
                    if (alias.fabric !== zoneFabric) return false;

                    // Must be marked for zoning
                    if (!alias.include_in_zoning) return false;

                    // Check if already used in this zone (but allow current value)
                    const isCurrentValue = alias.name === currentValue;
                    const alreadyUsedInThisZone = usedInThisZone.has(alias.name);

                    if (alreadyUsedInThisZone && !isCurrentValue) {
                        console.log(`  ❌ Excluded ${alias.name}: already used in this zone`);
                        return false;
                    }

                    // Check zone count limits - allow current value even if at limit
                    const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;

                    const result = hasRoomForMoreZones || isCurrentValue;

                    if (!result) {
                        console.log(`  ❌ Excluded ${alias.name}: zoned_count=${alias.zoned_count}, max=${aliasMaxZones}, current=${isCurrentValue}`);
                    }

                    return result;
                });

                const filteredNames = filteredAliases.map(alias => alias.name);

                // Only return options that exist in both the original list and pass all filters
                const result = options.filter(option => filteredNames.includes(option));

                console.log(`🔍 ${columnKey} filtered from ${options.length} to ${result.length} for fabric ${zoneFabric} (max zones: ${aliasMaxZones}, used in zone: ${usedInThisZone.size})`);
                return result;
            };
        }

        return filters;
    }, [maxMemberColumns, aliasOptions, settings]);

    // Custom cell validation for fabric consistency
    const customValidation = useCallback((value, rowData, columnKey) => {
        // Validate member fabric consistency
        if (columnKey.startsWith('member_') && value && rowData.fabric) {
            const alias = aliasOptions.find(a => a.name === value);
            if (alias && alias.fabric !== rowData.fabric) {
                return `Member ${value} belongs to fabric ${alias.fabric}, but zone is in fabric ${rowData.fabric}`;
            }
        }
        return null;
    }, [aliasOptions]);

    // Process data for display - convert fabric IDs to names and handle members
    const preprocessData = useCallback((data) => {
        console.log('🔄 Preprocessing zone data:', data.length, 'zones');
        return data.map(zone => {
            const processedZone = {
                ...zone,
                fabric: fabricsById[zone.fabric] || zone.fabric || ''
            };

            // Clear member columns first
            for (let i = 1; i <= maxMemberColumns; i++) {
                processedZone[`member_${i}`] = "";
            }

            // Populate member columns from members_details
            if (zone.members_details && Array.isArray(zone.members_details)) {
                console.log(`🏗️ Processing zone ${zone.name} with ${zone.members_details.length} members:`, zone.members_details);
                zone.members_details.forEach((member, index) => {
                    if (index < maxMemberColumns) {
                        processedZone[`member_${index + 1}`] = member.name || '';
                        console.log(`  Set member_${index + 1} = "${member.name}"`);
                    }
                });
                // Update member count
                processedZone.member_count = zone.members_details.length;
            } else {
                console.log(`⚠️ Zone ${zone.name} has no members_details:`, zone.members_details);
            }

            return processedZone;
        });
    }, [fabricsById, maxMemberColumns]);

    // Custom save handler for zone bulk save
    const handleZoneSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            console.log('⚠️ No changes to save');
            return { success: true, message: 'No changes to save' };
        }

        try {
            console.log('🔥 Custom zone save with data:', allTableData);
            console.log('🗑️ Deletions to process:', deletedRows);

            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                console.log('🗑️ Processing zone deletions:', deletedRows);
                for (const zoneId of deletedRows) {
                    try {
                        await axios.delete(`${API_ENDPOINTS.zoneDelete}${zoneId}/`);
                        console.log(`✅ Deleted zone ${zoneId}`);
                    } catch (error) {
                        console.error(`❌ Failed to delete zone ${zoneId}:`, error);
                        return {
                            success: false,
                            message: `Failed to delete zone ${zoneId}: ${error.response?.data?.message || error.message}`
                        };
                    }
                }
            }

            // Build payload for zones with members
            const payload = allTableData
                .filter(zone => zone.id || (zone.name && zone.name.trim() !== ""))
                .map(row => {
                    console.log('🔍 Processing zone for save:', {
                        name: row.name,
                        fabric: row.fabric,
                        members_details: row.members_details,
                        memberColumns: Object.keys(row).filter(k => k.startsWith('member_')).reduce((acc, k) => {
                            acc[k] = row[k];
                            return acc;
                        }, {})
                    });

                    // Extract members from member columns
                    const members = [];
                    for (let i = 1; i <= maxMemberColumns; i++) {
                        const memberName = row[`member_${i}`];
                        if (memberName) {
                            const alias = aliasOptions.find(a => a.name === memberName);
                            if (alias) {
                                // Check if this is an existing member relationship
                                if (row.members_details?.[i - 1]?.id) {
                                    members.push({
                                        id: row.members_details[i - 1].id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing member ${i}: ${memberName} (ID: ${row.members_details[i - 1].id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                            }
                        }
                    }

                    console.log(`🎯 Final members array for ${row.name}:`, members);

                    // Find fabric ID from name
                    const fabric = fabricOptions.find(f => f.name === row.fabric);
                    if (!fabric) {
                        throw new Error(`Zone "${row.name}" must have a valid fabric selected`);
                    }

                    // Clean payload
                    const cleanRow = { ...row };

                    // Remove member columns and UI-only fields
                    for (let i = 1; i <= maxMemberColumns; i++) {
                        delete cleanRow[`member_${i}`];
                    }
                    delete cleanRow.saved;
                    // Keep members_details for relationship tracking - DON'T DELETE IT
                    // delete cleanRow.members_details;
                    delete cleanRow.member_count;

                    // Handle boolean fields
                    const booleanFields = ['create', 'delete', 'exists'];
                    booleanFields.forEach(field => {
                        if (cleanRow[field] === 'unknown' || cleanRow[field] === undefined ||
                            cleanRow[field] === null || cleanRow[field] === '') {
                            cleanRow[field] = false;
                        } else if (typeof cleanRow[field] === 'string') {
                            cleanRow[field] = cleanRow[field].toLowerCase() === 'true';
                        }
                    });

                    const finalPayload = {
                        ...cleanRow,
                        projects: [activeProjectId],
                        fabric: parseInt(fabric.id),
                        members
                    };

                    // Remove members_details from API payload but log it first
                    console.log(`📤 API payload for ${row.name}:`, finalPayload);
                    delete finalPayload.members_details;

                    return finalPayload;
                });

            // Only call bulk save if there are zones to save
            if (payload.length > 0) {
                console.log('🚀 Sending bulk zone save:', { project_id: activeProjectId, zones: payload });

                await axios.post(API_ENDPOINTS.zoneSave, {
                    project_id: activeProjectId,
                    zones: payload
                });
            } else {
                console.log('✅ No zone data to save, only deletions were processed');
            }

            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} zones`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} zones`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return {
                success: true,
                message: message
            };

        } catch (error) {
            console.error('❌ Zone save error:', error);
            return {
                success: false,
                message: `Error saving zones: ${error.response?.data?.message || error.message}`
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
                        {loading ? "Loading zone data..." : "Please select a project to view zones"}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
                saveUrl={API_ENDPOINTS.zoneSave}
                deleteUrl={API_ENDPOINTS.zoneDelete}

                // Column Configuration
                columns={allColumns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                dropdownFilters={dropdownFilters}
                newRowTemplate={NEW_ZONE_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                customValidation={customValidation}

                // Custom save handler for bulk zone operations
                customSaveHandler={handleZoneSave}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`zone-table-${activeProjectId || 'default'}-members${maxMemberColumns}`}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Zone save successful:', result.message);
                    } else {
                        console.error('❌ Zone save failed:', result.message);
                        alert('Error saving zones: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default ZoneTableTanStackClean;