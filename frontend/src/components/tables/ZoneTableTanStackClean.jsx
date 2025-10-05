import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Zone management
const ZoneTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { settings } = useSettings();
    const { theme } = useTheme();

    const [fabricOptions, setFabricOptions] = useState([]);
    const [fabricsById, setFabricsById] = useState({});
    const [aliasOptions, setAliasOptions] = useState([]);
    const [rawZoneData, setRawZoneData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [memberColumnCounts, setMemberColumnCounts] = useState({
        targets: 3,
        initiators: 3,
        allAccess: 2
    });

    // Ref to access table methods
    const tableRef = useRef(null);

    // Functions to add new member columns
    const addTargetColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        console.log('💾 Preserving table data before adding column:', currentData?.length, 'rows');
        console.log('💾 Preserving sorting state:', currentSorting);

        setMemberColumnCounts(prev => ({
            ...prev,
            targets: prev.targets + 1
        }));
        console.log('➕ Added new target member column');

        // Restore data and sorting after column is added and trigger auto-size for new column
        if (currentData && currentData.length > 0) {
            setTimeout(() => {
                console.log('♻️ Restoring preserved table data and sorting');
                tableRef.current?.setTableData(currentData);
                tableRef.current?.setSorting(currentSorting || []);
                // Auto-size all columns including the new one
                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                }, 50);
            }, 100);
        } else {
            // Even if no data, auto-size the new column
            setTimeout(() => {
                console.log('📏 Auto-sizing columns after adding new column');
                tableRef.current?.autoSizeColumns();
            }, 150);
        }
    }, []);

    const addInitiatorColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        console.log('💾 Preserving table data before adding column:', currentData?.length, 'rows');
        console.log('💾 Preserving sorting state:', currentSorting);

        setMemberColumnCounts(prev => ({
            ...prev,
            initiators: prev.initiators + 1
        }));
        console.log('➕ Added new initiator member column');

        // Restore data and sorting after column is added and trigger auto-size for new column
        if (currentData && currentData.length > 0) {
            setTimeout(() => {
                console.log('♻️ Restoring preserved table data and sorting');
                tableRef.current?.setTableData(currentData);
                tableRef.current?.setSorting(currentSorting || []);
                // Auto-size all columns including the new one
                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                }, 50);
            }, 100);
        } else {
            // Even if no data, auto-size the new column
            setTimeout(() => {
                console.log('📏 Auto-sizing columns after adding new column');
                tableRef.current?.autoSizeColumns();
            }, 150);
        }
    }, []);

    const addAllAccessColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        console.log('💾 Preserving table data before adding column:', currentData?.length, 'rows');
        console.log('💾 Preserving sorting state:', currentSorting);

        setMemberColumnCounts(prev => ({
            ...prev,
            allAccess: prev.allAccess + 1
        }));
        console.log('➕ Added new all access member column');

        // Restore data and sorting after column is added and trigger auto-size for new column
        if (currentData && currentData.length > 0) {
            setTimeout(() => {
                console.log('♻️ Restoring preserved table data and sorting');
                tableRef.current?.setTableData(currentData);
                tableRef.current?.setSorting(currentSorting || []);
                // Auto-size all columns including the new one
                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                }, 50);
            }, 100);
        } else {
            // Even if no data, auto-size the new column
            setTimeout(() => {
                console.log('📏 Auto-sizing columns after adding new column');
                tableRef.current?.autoSizeColumns();
            }, 150);
        }
    }, []);

    // Helper function to get plus button styles based on theme
    const getPlusButtonStyle = useCallback(() => {
        const isDark = theme === 'dark';
        return {
            background: isDark ? '#14b8a6' : '#64748b', // teal for dark, slate for light
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            color: isDark ? '#000' : '#fff', // black for dark theme, white for light
            fontSize: '16px',
            fontWeight: 'bold',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.2s, transform 0.2s'
        };
    }, [theme]);

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

    // Generate dynamic member columns organized by use type
    const memberColumns = useMemo(() => {
        const columns = [];

        // Target columns first - subtle blue tint
        for (let i = 1; i <= memberColumnCounts.targets; i++) {
            const isLastTarget = i === memberColumnCounts.targets;
            columns.push({
                data: `target_member_${i}`,
                title: `Target Member ${i}`,
                type: "dropdown",
                columnGroup: "target",
                customHeader: isLastTarget ? {
                    component: () => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between', width: '100%' }}>
                            <span>Target Member {i}</span>
                            <button
                                onClick={addTargetColumn}
                                style={getPlusButtonStyle()}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = 1;
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = 0.8;
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Add Target Member Column"
                            >
                                +
                            </button>
                        </div>
                    )
                } : undefined
            });
        }

        // Initiator columns next - subtle green tint
        for (let i = 1; i <= memberColumnCounts.initiators; i++) {
            const isLastInitiator = i === memberColumnCounts.initiators;
            columns.push({
                data: `init_member_${i}`,
                title: `Initiator Member ${i}`,
                type: "dropdown",
                columnGroup: "initiator",
                customHeader: isLastInitiator ? {
                    component: () => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between', width: '100%' }}>
                            <span>Initiator Member {i}</span>
                            <button
                                onClick={addInitiatorColumn}
                                style={getPlusButtonStyle()}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = 1;
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = 0.8;
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Add Initiator Member Column"
                            >
                                +
                            </button>
                        </div>
                    )
                } : undefined
            });
        }

        // All Access columns last - subtle purple tint
        for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
            const isLastAllAccess = i === memberColumnCounts.allAccess;
            columns.push({
                data: `all_member_${i}`,
                title: `All Access Member ${i}`,
                type: "dropdown",
                columnGroup: "allAccess",
                customHeader: isLastAllAccess ? {
                    component: () => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between', width: '100%' }}>
                            <span>All Access Member {i}</span>
                            <button
                                onClick={addAllAccessColumn}
                                style={getPlusButtonStyle()}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = 1;
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = 0.8;
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Add All Access Member Column"
                            >
                                +
                            </button>
                        </div>
                    )
                } : undefined
            });
        }

        return columns;
    }, [memberColumnCounts, addTargetColumn, addInitiatorColumn, addAllAccessColumn, getPlusButtonStyle]);

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

        // Add target member fields
        for (let i = 1; i <= memberColumnCounts.targets; i++) {
            template[`target_member_${i}`] = "";
        }

        // Add initiator member fields
        for (let i = 1; i <= memberColumnCounts.initiators; i++) {
            template[`init_member_${i}`] = "";
        }

        // Add all access member fields
        for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
            template[`all_member_${i}`] = "";
        }

        return template;
    }, [memberColumnCounts]);

    // Calculate dynamic member columns by use type based on zone data
    const calculateMemberColumnsByType = useCallback((zones, aliases) => {
        console.log('🔢 calculateMemberColumnsByType called with', zones?.length, 'zones and', aliases?.length, 'aliases');

        if (!zones || zones.length === 0) {
            console.log('⚠️ No zones provided, using defaults');
            return { targets: 3, initiators: 3, allAccess: 2 }; // Default minimums
        }

        const memberCounts = { targets: 0, initiators: 0, allAccess: 0 };

        zones.forEach((zone, zoneIndex) => {
            console.log(`🔍 Checking zone ${zoneIndex}: ${zone.name}, members_details:`, zone.members_details);

            if (zone.members_details) {
                const typeCounts = { targets: 0, initiators: 0, allAccess: 0 };

                zone.members_details.forEach((member, memberIndex) => {
                    // Try multiple ways to get use type
                    let useType = member.alias_details?.use || member.use;

                    // If no use type found, look up in aliases array
                    if (!useType && member.name && aliases) {
                        const aliasInfo = aliases.find(a => a.name === member.name);
                        if (aliasInfo) {
                            useType = aliasInfo.use;
                            console.log(`  Member ${memberIndex} (${member.name}): found use type from aliases: ${useType}`);
                        }
                    }

                    console.log(`  Member ${memberIndex} (${member.name}): use type = ${useType}`);

                    if (useType === 'target') {
                        typeCounts.targets++;
                    } else if (useType === 'init') {
                        typeCounts.initiators++;
                    } else if (useType === 'both') {
                        typeCounts.allAccess++;
                    }
                });

                console.log(`  Zone ${zone.name} counts:`, typeCounts);

                memberCounts.targets = Math.max(memberCounts.targets, typeCounts.targets);
                memberCounts.initiators = Math.max(memberCounts.initiators, typeCounts.initiators);
                memberCounts.allAccess = Math.max(memberCounts.allAccess, typeCounts.allAccess);
            }
        });

        // Use maximum found across all zones, with minimum defaults
        const result = {
            targets: Math.max(3, memberCounts.targets),
            initiators: Math.max(3, memberCounts.initiators),
            allAccess: Math.max(2, memberCounts.allAccess)
        };

        console.log(`📊 Dynamic member columns by type:`, {
            found: memberCounts,
            result: result,
            total: result.targets + result.initiators + result.allAccess
        });

        return result;
    }, []);

    // Load fabrics, aliases, and zones to calculate member columns
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId && activeProjectId) {
                try {
                    setLoading(true);
                    console.log('Loading zone dropdown data...');

                    const [fabricResponse, aliasResponse, zoneResponse] = await Promise.all([
                        axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`),
                        axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/`),
                        axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/`)
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

                    // Process aliases with fabric names and filtering FIRST
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

                    // Process zone data and calculate member columns (after aliases are processed)
                    const zonesArray = zoneResponse.data.results || zoneResponse.data;
                    setRawZoneData(zonesArray);

                    // Calculate member columns by type - pass aliases for lookup
                    const requiredMemberColumns = calculateMemberColumnsByType(zonesArray, processedAliases);
                    setMemberColumnCounts(requiredMemberColumns);

                    console.log('✅ Zone dropdown data loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading zone dropdown data:', error);
                    setLoading(false);
                }
            }
        };

        loadData();
    }, [activeCustomerId, activeProjectId, calculateMemberColumnsByType]);

    // Calculate used aliases to filter dropdowns
    const calculateUsedAliases = useCallback((tableData, currentRowIndex, currentMemberColumn) => {
        const usedAliases = new Set();

        tableData.forEach((row, rowIndex) => {
            // Check all member columns (target, init, all access)
            const memberColumns = [
                ...Array.from({length: memberColumnCounts.targets}, (_, i) => `target_member_${i + 1}`),
                ...Array.from({length: memberColumnCounts.initiators}, (_, i) => `init_member_${i + 1}`),
                ...Array.from({length: memberColumnCounts.allAccess}, (_, i) => `all_member_${i + 1}`)
            ];

            memberColumns.forEach(memberKey => {
                const memberName = row[memberKey];
                if (memberName) {
                    // Don't count the current cell being edited
                    if (!(rowIndex === currentRowIndex && memberKey === currentMemberColumn)) {
                        usedAliases.add(memberName);
                    }
                }
            });
        });

        return usedAliases;
    }, [memberColumnCounts]);

    // Custom member dropdown renderer that filters by fabric and use type
    const getMemberDropdownOptions = useCallback((rowData, columnKey) => {
        const zoneFabric = rowData.fabric;
        console.log(`🔍 Getting member options for ${columnKey}, zone fabric: ${zoneFabric}`);

        if (!zoneFabric) {
            console.log('⚠️ No zone fabric selected, showing no options');
            return [];
        }

        const aliasMaxZones = settings?.alias_max_zones || 1;

        // Determine required use type based on column type
        let requiredUseType = null;
        if (columnKey.startsWith('target_member_')) {
            requiredUseType = 'target';
        } else if (columnKey.startsWith('init_member_')) {
            requiredUseType = 'init';
        } else if (columnKey.startsWith('all_member_')) {
            requiredUseType = 'both';
        }

        console.log(`🎯 Column ${columnKey} requires use type: ${requiredUseType}`);

        // Filter aliases by fabric, use type, and zoning rules
        const filteredAliases = aliasOptions.filter(alias => {
            const matchesFabric = alias.fabric === zoneFabric;
            const includeInZoning = alias.include_in_zoning;
            const hasRoom = (alias.zoned_count || 0) < aliasMaxZones;
            const matchesUseType = requiredUseType ? alias.use === requiredUseType : true;

            const result = matchesFabric && includeInZoning && hasRoom && matchesUseType;
            if (!result && alias.name) {
                console.log(`❌ Filtered out ${alias.name}: fabric=${alias.fabric} (need ${zoneFabric}), zoning=${includeInZoning}, room=${hasRoom}, use=${alias.use} (need ${requiredUseType})`);
            }
            return result;
        });

        console.log(`✅ Found ${filteredAliases.length} valid ${requiredUseType || 'any'} members for fabric ${zoneFabric}`);
        return filteredAliases.map(alias => alias.name);
    }, [aliasOptions, settings]);

    // Custom renderers for member dropdowns
    const customRenderers = useMemo(() => {
        const renderers = {};

        // Get all member column keys for all types
        const allMemberColumns = [
            ...Array.from({length: memberColumnCounts.targets}, (_, i) => `target_member_${i + 1}`),
            ...Array.from({length: memberColumnCounts.initiators}, (_, i) => `init_member_${i + 1}`),
            ...Array.from({length: memberColumnCounts.allAccess}, (_, i) => `all_member_${i + 1}`)
        ];

        // Add custom renderers for each member column type
        allMemberColumns.forEach(memberKey => {
            renderers[memberKey] = (rowData, td, row, col, prop, value) => {
                // Get dynamic options based on zone fabric and use type
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
        });

        return renderers;
    }, [memberColumnCounts, getMemberDropdownOptions]);

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

        // Add target member columns with full alias list (filtering happens in custom renderer)
        for (let i = 1; i <= memberColumnCounts.targets; i++) {
            sources[`target_member_${i}`] = availableAliases.filter(alias => alias.use === 'target').map(alias => alias.name);
        }

        // Add initiator member columns
        for (let i = 1; i <= memberColumnCounts.initiators; i++) {
            sources[`init_member_${i}`] = availableAliases.filter(alias => alias.use === 'init').map(alias => alias.name);
        }

        // Add all access member columns
        for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
            sources[`all_member_${i}`] = availableAliases.filter(alias => alias.use === 'both').map(alias => alias.name);
        }

        return sources;
    }, [fabricOptions, aliasOptions, settings, memberColumnCounts]);

    // Dynamic dropdown filters for member columns
    const dropdownFilters = useMemo(() => {
        const filters = {};

        // Get all member column keys for all types
        const allMemberColumns = [
            ...Array.from({length: memberColumnCounts.targets}, (_, i) => `target_member_${i + 1}`),
            ...Array.from({length: memberColumnCounts.initiators}, (_, i) => `init_member_${i + 1}`),
            ...Array.from({length: memberColumnCounts.allAccess}, (_, i) => `all_member_${i + 1}`)
        ];

        // Create fabric and use-type based filter for member columns
        allMemberColumns.forEach(memberKey => {
            filters[memberKey] = (options, rowData, columnKey, allTableData) => {
                console.log(`🎯 Filter function called for ${columnKey}:`, {
                    optionsCount: options?.length,
                    hasRowData: !!rowData,
                    hasAllTableData: !!allTableData,
                    allTableDataLength: allTableData?.length
                });

                const zoneFabric = rowData?.fabric;
                if (!zoneFabric) {
                    console.log(`⚠️ No fabric selected for ${columnKey}, showing no options`);
                    return [];
                }

                // Determine required use type based on column type
                let requiredUseType = null;
                if (columnKey.startsWith('target_member_')) {
                    requiredUseType = 'target';
                } else if (columnKey.startsWith('init_member_')) {
                    requiredUseType = 'init';
                } else if (columnKey.startsWith('all_member_')) {
                    requiredUseType = 'both';
                }

                const aliasMaxZones = settings?.alias_max_zones || 1;
                const currentValue = rowData?.[columnKey]; // Current value in this cell

                // Get all aliases already used across ALL zones in the project
                const usedAcrossAllZones = new Set();
                if (allTableData && Array.isArray(allTableData)) {
                    allTableData.forEach((zone, zoneIndex) => {
                        allMemberColumns.forEach(memberCol => {
                            const memberName = zone?.[memberCol];
                            if (memberName) {
                                // Don't count the current cell being edited
                                // Compare by ID if available, otherwise by reference
                                const isSameZone = (zone.id && rowData?.id)
                                    ? zone.id === rowData.id
                                    : zone === rowData;
                                const isCurrentCell = isSameZone && memberCol === columnKey;
                                if (!isCurrentCell) {
                                    usedAcrossAllZones.add(memberName);
                                }
                            }
                        });
                    });
                }

                console.log(`🔍 ${columnKey}: Checking zone fabric="${zoneFabric}", found ${usedAcrossAllZones.size} aliases used across all zones:`, Array.from(usedAcrossAllZones));

                // Filter aliases by fabric, use type, zone count limits, and cross-zone usage
                const filteredAliases = aliasOptions.filter(alias => {
                    // Must match fabric
                    if (alias.fabric !== zoneFabric) return false;

                    // Must be marked for zoning
                    if (!alias.include_in_zoning) return false;

                    // Must match required use type
                    if (requiredUseType && alias.use !== requiredUseType) return false;

                    // Check if already used in ANY zone (but allow current value)
                    const isCurrentValue = alias.name === currentValue;
                    const alreadyUsedInAnyZone = usedAcrossAllZones.has(alias.name);

                    if (alreadyUsedInAnyZone && !isCurrentValue) {
                        console.log(`  ❌ Excluded ${alias.name}: already used in another zone`);
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

                console.log(`🔍 ${columnKey} (${requiredUseType}) filtered from ${options.length} to ${result.length} for fabric ${zoneFabric} (max zones: ${aliasMaxZones}, used across all zones: ${usedAcrossAllZones.size})`);
                return result;
            };
        });

        return filters;
    }, [memberColumnCounts, aliasOptions, settings]);

    // Custom cell validation for fabric consistency
    const customValidation = useCallback((value, rowData, columnKey) => {
        // Validate member fabric consistency
        const isMemberColumn = columnKey.startsWith('target_member_') ||
                              columnKey.startsWith('init_member_') ||
                              columnKey.startsWith('all_member_');

        if (isMemberColumn && value && rowData.fabric) {
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

            // Clear all member columns first
            // Target member columns
            for (let i = 1; i <= memberColumnCounts.targets; i++) {
                processedZone[`target_member_${i}`] = "";
            }
            // Initiator member columns
            for (let i = 1; i <= memberColumnCounts.initiators; i++) {
                processedZone[`init_member_${i}`] = "";
            }
            // All access member columns
            for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
                processedZone[`all_member_${i}`] = "";
            }

            // Populate member columns from members_details organized by use type
            if (zone.members_details && Array.isArray(zone.members_details)) {
                console.log(`🏗️ Processing zone ${zone.name} with ${zone.members_details.length} members:`, zone.members_details);

                // Group members by use type
                const membersByType = {
                    targets: [],
                    initiators: [],
                    allAccess: []
                };

                zone.members_details.forEach((member, idx) => {
                    console.log(`🔍 Member ${idx}:`, {
                        name: member.name,
                        alias_details: member.alias_details,
                        use: member.alias_details?.use,
                        fullMember: member
                    });

                    // Check multiple possible locations for use type
                    let useType = member.alias_details?.use || member.use || null;

                    // If no use type found, look up the alias in our aliasOptions
                    if (!useType && member.name) {
                        const aliasInfo = aliasOptions.find(a => a.name === member.name);
                        if (aliasInfo) {
                            useType = aliasInfo.use;
                            console.log(`  💡 Found use type from aliasOptions: ${useType}`);
                        }
                    }

                    if (useType === 'target') {
                        membersByType.targets.push(member);
                    } else if (useType === 'init') {
                        membersByType.initiators.push(member);
                    } else if (useType === 'both') {
                        membersByType.allAccess.push(member);
                    } else {
                        console.log(`⚠️ Unknown use type for member ${member.name}: ${useType} (member data:`, member, ')')
                        // For now, put unknown types in the all access category as fallback
                        membersByType.allAccess.push(member);
                    }
                });

                // Populate target member columns
                membersByType.targets.forEach((member, index) => {
                    if (index < memberColumnCounts.targets) {
                        processedZone[`target_member_${index + 1}`] = member.name || '';
                        console.log(`  Set target_member_${index + 1} = "${member.name}"`);
                    }
                });

                // Populate initiator member columns
                membersByType.initiators.forEach((member, index) => {
                    if (index < memberColumnCounts.initiators) {
                        processedZone[`init_member_${index + 1}`] = member.name || '';
                        console.log(`  Set init_member_${index + 1} = "${member.name}"`);
                    }
                });

                // Populate all access member columns
                membersByType.allAccess.forEach((member, index) => {
                    if (index < memberColumnCounts.allAccess) {
                        processedZone[`all_member_${index + 1}`] = member.name || '';
                        console.log(`  Set all_member_${index + 1} = "${member.name}"`);
                    }
                });

                // Update member count
                processedZone.member_count = zone.members_details.length;
            } else {
                console.log(`⚠️ Zone ${zone.name} has no members_details:`, zone.members_details);
                processedZone.member_count = 0;
            }

            return processedZone;
        });
    }, [fabricsById, memberColumnCounts]);

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

                        // Check if it's a permission error
                        if (error.response?.status === 403) {
                            return {
                                success: false,
                                message: error.response?.data?.error || 'You have read-only access to this project. Only members and admins can delete data.'
                            };
                        }

                        return {
                            success: false,
                            message: `Failed to delete zone ${zoneId}: ${error.response?.data?.error || error.response?.data?.message || error.message}`
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
                        memberColumns: Object.keys(row).filter(k =>
                            k.startsWith('target_member_') ||
                            k.startsWith('init_member_') ||
                            k.startsWith('all_member_')
                        ).reduce((acc, k) => {
                            acc[k] = row[k];
                            return acc;
                        }, {})
                    });

                    // Extract members from all member columns (organized by type)
                    const members = [];
                    let memberIndex = 0;

                    // Process target members
                    for (let i = 1; i <= memberColumnCounts.targets; i++) {
                        const memberName = row[`target_member_${i}`];
                        if (memberName) {
                            const alias = aliasOptions.find(a => a.name === memberName);
                            if (alias) {
                                // Check if this is an existing member relationship
                                if (row.members_details?.[memberIndex]?.id) {
                                    members.push({
                                        id: row.members_details[memberIndex].id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing target member ${i}: ${memberName} (ID: ${row.members_details[memberIndex].id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New target member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                                memberIndex++;
                            }
                        }
                    }

                    // Process initiator members
                    for (let i = 1; i <= memberColumnCounts.initiators; i++) {
                        const memberName = row[`init_member_${i}`];
                        if (memberName) {
                            const alias = aliasOptions.find(a => a.name === memberName);
                            if (alias) {
                                // Check if this is an existing member relationship
                                if (row.members_details?.[memberIndex]?.id) {
                                    members.push({
                                        id: row.members_details[memberIndex].id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing init member ${i}: ${memberName} (ID: ${row.members_details[memberIndex].id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New init member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                                memberIndex++;
                            }
                        }
                    }

                    // Process all access members
                    for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
                        const memberName = row[`all_member_${i}`];
                        if (memberName) {
                            const alias = aliasOptions.find(a => a.name === memberName);
                            if (alias) {
                                // Check if this is an existing member relationship
                                if (row.members_details?.[memberIndex]?.id) {
                                    members.push({
                                        id: row.members_details[memberIndex].id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing all access member ${i}: ${memberName} (ID: ${row.members_details[memberIndex].id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New all access member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                                memberIndex++;
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

                    // Remove all member columns and UI-only fields
                    // Remove target member columns
                    for (let i = 1; i <= memberColumnCounts.targets; i++) {
                        delete cleanRow[`target_member_${i}`];
                    }
                    // Remove initiator member columns
                    for (let i = 1; i <= memberColumnCounts.initiators; i++) {
                        delete cleanRow[`init_member_${i}`];
                    }
                    // Remove all access member columns
                    for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
                        delete cleanRow[`all_member_${i}`];
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

            // Check if it's a permission error
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: error.response?.data?.error || 'You have read-only access to this project. Only members and admins can modify data.'
                };
            }

            return {
                success: false,
                message: `Error saving zones: ${error.response?.data?.error || error.response?.data?.message || error.message}`
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
                ref={tableRef}
                // API Configuration
                apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
                saveUrl={API_ENDPOINTS.zoneSave}
                deleteUrl={API_ENDPOINTS.zoneDelete}
                customerId={activeCustomerId}
                tableName="zones"

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
                storageKey={`zone-table-${activeProjectId || 'default'}-bytype-t${memberColumnCounts.targets}i${memberColumnCounts.initiators}a${memberColumnCounts.allAccess}`}

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