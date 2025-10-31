import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";

// Clean TanStack Table implementation for Zone management
const ZoneTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { user, getUserRole } = useAuth();
    const { settings } = useSettings();
    const { theme } = useTheme();

    const [fabricOptions, setFabricOptions] = useState([]);
    const [fabricsById, setFabricsById] = useState({});
    const [aliasOptions, setAliasOptions] = useState([]);
    const [rawZoneData, setRawZoneData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [memberColumnCounts, setMemberColumnCounts] = useState({
        targets: 1,
        initiators: 1,
        allAccess: 1
    });
    const isAddingColumnRef = useRef(false); // Flag to prevent data reload when adding column
    const isUpdatingProjectRef = useRef(false); // Flag to prevent data reload when updating project membership
    const memberColumnCountsRef = useRef(memberColumnCounts); // Store current counts for stable access

    // Project filter state (default: 'all' shows all customer zones)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('zoneTableProjectFilter') || 'all'
    );

    // Keep the ref in sync with state
    useEffect(() => {
        memberColumnCountsRef.current = memberColumnCounts;
    }, [memberColumnCounts]);

    // Ref to access table methods
    const tableRef = useRef(null);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('zoneTableProjectFilter', newFilter);
        // Reload table data with new filter
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Functions to add new member columns - no dependencies to avoid recreation issues
    const addTargetColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        const hadChanges = tableRef.current?.hasChanges;
        console.log('💾 Preserving table data before adding target column:', {
            rows: currentData?.length,
            hadChanges: hadChanges
        });

        // Create a deep copy to ensure data isn't lost
        const dataCopy = currentData ? JSON.parse(JSON.stringify(currentData)) : null;

        // Set flag to prevent automatic data reload
        isAddingColumnRef.current = true;

        // Capture current count before updating
        let newColumnIndex;
        setMemberColumnCounts(prev => {
            newColumnIndex = prev.targets + 1;
            return {
                ...prev,
                targets: prev.targets + 1
            };
        });
        console.log('➕ Added new target member column');

        // Restore data and sorting after column is added
        setTimeout(() => {
            if (dataCopy && dataCopy.length > 0) {
                console.log('♻️ Restoring preserved table data and sorting');

                // Extend each row with the new member column field
                // Use newColumnIndex captured during setState
                const extendedData = dataCopy.map(row => ({
                    ...row,
                    [`target_member_${newColumnIndex}`]: ""
                }));

                tableRef.current?.setTableData(extendedData);
                tableRef.current?.setSorting(currentSorting || []);

                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                    isAddingColumnRef.current = false;
                }, 50);
            } else {
                console.log('📏 Auto-sizing columns after adding new column (no data to restore)');
                tableRef.current?.autoSizeColumns();
                isAddingColumnRef.current = false;
            }
        }, 200);
    }, []); // Empty deps - stable reference

    const addInitiatorColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        const hadChanges = tableRef.current?.hasChanges;
        console.log('💾 Preserving table data before adding initiator column:', {
            rows: currentData?.length,
            hadChanges: hadChanges
        });

        // Create a deep copy to ensure data isn't lost
        const dataCopy = currentData ? JSON.parse(JSON.stringify(currentData)) : null;

        // Set flag to prevent automatic data reload
        isAddingColumnRef.current = true;

        // Capture current count before updating
        let newColumnIndex;
        setMemberColumnCounts(prev => {
            newColumnIndex = prev.initiators + 1;
            return {
                ...prev,
                initiators: prev.initiators + 1
            };
        });
        console.log('➕ Added new initiator member column');

        // Restore data and sorting after column is added
        setTimeout(() => {
            if (dataCopy && dataCopy.length > 0) {
                console.log('♻️ Restoring preserved table data and sorting');

                // Extend each row with the new member column field
                const extendedData = dataCopy.map(row => ({
                    ...row,
                    [`init_member_${newColumnIndex}`]: ""
                }));

                tableRef.current?.setTableData(extendedData);
                tableRef.current?.setSorting(currentSorting || []);

                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                    isAddingColumnRef.current = false;
                }, 50);
            } else {
                console.log('📏 Auto-sizing columns after adding new column (no data to restore)');
                tableRef.current?.autoSizeColumns();
                isAddingColumnRef.current = false;
            }
        }, 200);
    }, []); // Empty deps - stable reference

    const addAllAccessColumn = useCallback(() => {
        // Preserve current table data and sorting before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        const hadChanges = tableRef.current?.hasChanges;
        console.log('💾 Preserving table data before adding all access column:', {
            rows: currentData?.length,
            hadChanges: hadChanges
        });

        // Create a deep copy to ensure data isn't lost
        const dataCopy = currentData ? JSON.parse(JSON.stringify(currentData)) : null;

        // Set flag to prevent automatic data reload
        isAddingColumnRef.current = true;

        // Capture current count before updating
        let newColumnIndex;
        setMemberColumnCounts(prev => {
            newColumnIndex = prev.allAccess + 1;
            return {
                ...prev,
                allAccess: prev.allAccess + 1
            };
        });
        console.log('➕ Added new all access member column');

        // Restore data and sorting after column is added
        setTimeout(() => {
            if (dataCopy && dataCopy.length > 0) {
                console.log('♻️ Restoring preserved table data and sorting');

                // Extend each row with the new member column field
                const extendedData = dataCopy.map(row => ({
                    ...row,
                    [`all_member_${newColumnIndex}`]: ""
                }));

                tableRef.current?.setTableData(extendedData);
                tableRef.current?.setSorting(currentSorting || []);

                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();
                    isAddingColumnRef.current = false;
                }, 50);
            } else {
                console.log('📏 Auto-sizing columns after adding new column (no data to restore)');
                tableRef.current?.autoSizeColumns();
                isAddingColumnRef.current = false;
            }
        }, 200);
    }, []); // Empty deps - stable reference

    // Helper function to get plus button styles based on theme
    const getPlusButtonStyle = useCallback(() => {
        return {
            background: 'var(--color-success-emphasis)',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            color: 'var(--button-primary-text)',
            fontSize: '16px',
            fontWeight: 'bold',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.2s, transform 0.2s'
        };
    }, []);

    // Check permissions for modifying project data
    const userRole = getUserRole(activeCustomerId);
    const projectOwner = config?.active_project?.owner;

    // Determine if user can modify this project
    const isViewer = userRole === 'viewer';
    const isProjectOwner = user && projectOwner && user.id === projectOwner;
    const isAdmin = userRole === 'admin';

    const canModifyProject = !isViewer && (isProjectOwner || isAdmin);
    const isReadOnly = !canModifyProject;

    // API endpoints
    const API_ENDPOINTS = {
        zones: `${API_URL}/api/san/zones/project/`,
        fabrics: `${API_URL}/api/san/fabrics/`,
        aliases: `${API_URL}/api/san/aliases/project/`,
        zoneSave: `${API_URL}/api/san/zones/save/`,
        zoneDelete: `${API_URL}/api/san/zones/delete/`
    };

    // Base zone columns (main columns before member columns)
    const baseColumns = [
        { data: "name", title: "Name", required: true },
        { data: "fabric", title: "Fabric", type: "dropdown", required: true },
        { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
        { data: "project_actions", title: "Active Project", type: "custom", readOnly: true, defaultVisible: true },
        { data: "zone_type", title: "Zone Type", type: "dropdown" }
    ];

    // Trailing columns (appear after member columns)
    const trailingColumns = [
        { data: "committed", title: "Committed", type: "checkbox", defaultVisible: true },
        { data: "deployed", title: "Deployed", type: "checkbox", defaultVisible: true },
        { data: "exists", title: "Exists", type: "checkbox", readOnly: true },
        { data: "member_count", title: "Members", type: "numeric", readOnly: true },
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

    // All columns (base + member + trailing)
    const allColumns = useMemo(() => {
        return [...baseColumns, ...memberColumns, ...trailingColumns];
    }, [memberColumns]);

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
    }, [memberColumnCounts]); // Needs to recreate when columns added

    // Calculate dynamic member columns by use type based on zone data
    const calculateMemberColumnsByType = useCallback((zones, aliases) => {
        console.log('🔢 calculateMemberColumnsByType called with', zones?.length, 'zones and', aliases?.length, 'aliases');

        if (!zones || zones.length === 0) {
            console.log('⚠️ No zones provided, using minimums of 1 each');
            return { targets: 1, initiators: 1, allAccess: 1 }; // Minimum of 1 column each
        }

        const memberCounts = { targets: 0, initiators: 0, allAccess: 0 };

        zones.forEach((zone, zoneIndex) => {
            console.log(`🔍 Checking zone ${zoneIndex}: ${zone.name}, has ${zone.members_details?.length || 0} members`);
            if (zone.members_details && zone.members_details.length > 0) {
                console.log(`   First member sample:`, zone.members_details[0]);
            }

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
                    } else if (useType === 'both' || !useType || useType === '') {
                        // Members with 'both', empty, or no use type go to all access
                        typeCounts.allAccess++;
                    }
                });

                console.log(`  Zone ${zone.name} counts:`, typeCounts);

                memberCounts.targets = Math.max(memberCounts.targets, typeCounts.targets);
                memberCounts.initiators = Math.max(memberCounts.initiators, typeCounts.initiators);
                memberCounts.allAccess = Math.max(memberCounts.allAccess, typeCounts.allAccess);
            }
        });

        // Use maximum found across all zones, with minimum of 1 column each
        const result = {
            targets: Math.max(1, memberCounts.targets),
            initiators: Math.max(1, memberCounts.initiators),
            allAccess: Math.max(1, memberCounts.allAccess)
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
                        axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/?page_size=10000`),
                        axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/?page_size=10000`)
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
                    console.log('📊 About to calculate member columns from', zonesArray.length, 'zones');
                    const requiredMemberColumns = calculateMemberColumnsByType(zonesArray, processedAliases);
                    console.log('📊 Calculated member columns:', requiredMemberColumns);
                    setMemberColumnCounts(requiredMemberColumns);
                    console.log('📊 Set member column counts to:', requiredMemberColumns);

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
    }, [memberColumnCounts]); // Needs to recreate when columns added

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
            requiredUseType = 'both_or_empty';  // Special flag for both or empty
        }

        console.log(`🎯 Column ${columnKey} requires use type: ${requiredUseType}`);

        // Filter aliases by fabric, use type, and zoning rules
        const filteredAliases = aliasOptions.filter(alias => {
            const matchesFabric = alias.fabric === zoneFabric;
            const includeInZoning = alias.include_in_zoning;
            const hasRoom = (alias.zoned_count || 0) < aliasMaxZones;

            let matchesUseType = true;
            if (requiredUseType === 'both_or_empty') {
                // All access columns accept 'both' or empty/null use types
                matchesUseType = alias.use === 'both' || !alias.use || alias.use === '';
            } else if (requiredUseType) {
                matchesUseType = alias.use === requiredUseType;
            }

            const result = matchesFabric && includeInZoning && hasRoom && matchesUseType;
            if (!result && alias.name) {
                console.log(`❌ Filtered out ${alias.name}: fabric=${alias.fabric} (need ${zoneFabric}), zoning=${includeInZoning}, room=${hasRoom}, use=${alias.use} (need ${requiredUseType})`);
            }
            return result;
        });

        console.log(`✅ Found ${filteredAliases.length} valid ${requiredUseType || 'any'} members for fabric ${zoneFabric}`);
        return filteredAliases.map(alias => alias.name);
    }, [aliasOptions, settings]);

    // Custom renderers for member dropdowns and project badges
    const customRenderers = useMemo(() => {
        const renderers = {};

        // Add renderer for project_memberships column (badge pills)
        renderers['project_memberships'] = (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
            try {
                if (!value || !Array.isArray(value) || value.length === 0) {
                    return '';
                }

                // Render badge pills for each project
                const badges = value.map(pm => {
                    if (!pm || typeof pm !== 'object') {
                        return '';
                    }
                    const isActive = pm.project_id === activeProjectId;
                    const badgeClass = isActive ? 'bg-primary' : 'bg-secondary';
                    const title = `Action: ${pm.action || 'unknown'}`;
                    const projectName = pm.project_name || 'Unknown';
                    return `<span class="badge ${badgeClass} me-1" title="${title}" onmousedown="event.stopPropagation()">${projectName}</span>`;
                }).filter(badge => badge !== '').join('');

                return badges ? `<div onmousedown="event.stopPropagation()">${badges}</div>` : '';
            } catch (error) {
                console.error('Error rendering project_memberships:', error, value);
                return '';
            }
        };

        // Add renderer for project_actions column (HTML with styled dropdown)
        renderers['project_actions'] = (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
            try {
                const zoneId = rowData.id;
                const zoneName = rowData.name;
                const inActiveProject = rowData.in_active_project;
                const createdByProject = rowData.created_by_project;

                // If in active project
                if (inActiveProject) {
                    // If created by this project, show badge only (can't remove)
                    if (createdByProject === activeProjectId) {
                        return `<span style="
                            padding: 4px 8px;
                            background-color: var(--color-success-subtle);
                            color: var(--color-success-fg);
                            border-radius: 4px;
                            font-size: 12px;
                            font-weight: 500;
                        " title="This zone was created by this project" onmousedown="event.stopPropagation()">✓ Created Here</span>`;
                    }
                    // Otherwise show remove button
                    return `<button
                        onclick="window.zoneTableHandleRemove('${zoneId}', '${zoneName}')"
                        onmousedown="event.stopPropagation()"
                        style="
                            padding: 4px 12px;
                            border: 1px solid var(--color-danger-emphasis);
                            border-radius: 6px;
                            cursor: pointer;
                            background-color: transparent;
                            color: var(--color-danger-fg);
                            font-size: 13px;
                            font-weight: 500;
                        "
                        title="Remove from project">× Remove</button>`;
                }

                // Not in active project - show styled dropdown button
                return `<div class="dropdown" style="position: relative;" onmousedown="event.stopPropagation()">
                    <button
                        class="zone-add-dropdown-btn"
                        onclick="window.zoneTableToggleAddMenu(event, '${zoneId}', '${zoneName}')"
                        onmousedown="event.stopPropagation()"
                        style="
                            padding: 6px 10px;
                            border: none;
                            cursor: pointer;
                            background-color: transparent;
                            color: var(--color-accent-fg);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 13px;
                            font-weight: 500;
                            width: 100%;
                        "
                        title="Add to project">
                        <span>+ Add</span>
                        <span style="color: var(--muted-text); margin-left: 8px;">▽</span>
                    </button>
                </div>`;
            } catch (error) {
                console.error('Error rendering project_actions:', error);
                return '';
            }
        };

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
    }, [getMemberDropdownOptions, memberColumnCounts, activeProjectId]); // Needs to recreate when columns added

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

        // Add all access member columns (includes 'both' and empty/null use types)
        for (let i = 1; i <= memberColumnCounts.allAccess; i++) {
            sources[`all_member_${i}`] = availableAliases.filter(alias =>
                alias.use === 'both' || !alias.use || alias.use === ''
            ).map(alias => alias.name);
        }

        return sources;
    }, [fabricOptions, aliasOptions, settings, memberColumnCounts]); // Needs to recreate when columns added

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
                    requiredUseType = 'both_or_empty';  // Special flag for both or empty
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
                    if (requiredUseType === 'both_or_empty') {
                        // All access columns accept 'both' or empty/null use types
                        if (!(alias.use === 'both' || !alias.use || alias.use === '')) return false;
                    } else if (requiredUseType) {
                        if (alias.use !== requiredUseType) return false;
                    }

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
    }, [aliasOptions, settings, memberColumnCounts]); // Needs to recreate when columns added

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
    // Using useCallback with stable reference - memberColumnCounts accessed via ref to avoid recreating function
    const preprocessData = useCallback((data) => {
        // If we're in the middle of adding a column or updating project, return null to prevent reload
        if (isAddingColumnRef.current) {
            console.log('⏸️ preprocessData skipped - adding column in progress');
            return null;
        }
        if (isUpdatingProjectRef.current) {
            console.log('⏸️ preprocessData skipped - updating project membership in progress');
            return null;
        }

        // Use ref value to avoid dependency on memberColumnCounts
        const columnCounts = memberColumnCountsRef.current;

        console.log('🔄 Preprocessing zone data:', data.length, 'zones');
        return data.map(zone => {
            const processedZone = {
                ...zone,
                fabric: fabricsById[zone.fabric] || zone.fabric || ''
            };

            // Clear all member columns first
            // Target member columns
            for (let i = 1; i <= columnCounts.targets; i++) {
                processedZone[`target_member_${i}`] = "";
            }
            // Initiator member columns
            for (let i = 1; i <= columnCounts.initiators; i++) {
                processedZone[`init_member_${i}`] = "";
            }
            // All access member columns
            for (let i = 1; i <= columnCounts.allAccess; i++) {
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
                    } else if (useType === 'both' || !useType || useType === '') {
                        // Members with 'both', empty, or no use type go to all access
                        membersByType.allAccess.push(member);
                    } else {
                        console.log(`⚠️ Unknown use type for member ${member.name}: ${useType} (member data:`, member, ')')
                        // For now, put unknown types in the all access category as fallback
                        membersByType.allAccess.push(member);
                    }
                });

                // Populate target member columns
                membersByType.targets.forEach((member, index) => {
                    if (index < columnCounts.targets) {
                        processedZone[`target_member_${index + 1}`] = member.name || '';
                        console.log(`  Set target_member_${index + 1} = "${member.name}"`);
                    }
                });

                // Populate initiator member columns
                membersByType.initiators.forEach((member, index) => {
                    if (index < columnCounts.initiators) {
                        processedZone[`init_member_${index + 1}`] = member.name || '';
                        console.log(`  Set init_member_${index + 1} = "${member.name}"`);
                    }
                });

                // Populate all access member columns
                membersByType.allAccess.forEach((member, index) => {
                    if (index < columnCounts.allAccess) {
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
    }, [fabricsById]); // memberColumnCounts accessed via ref - not in deps to prevent reload

    // API handlers for add/remove zone from project
    const handleAddZoneToProject = useCallback(async (zoneId, action = 'reference') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return false;
            }

            console.log(`📤 Adding zone ${zoneId} to project ${projectId} with action: ${action}`);
            const response = await axios.post(`${API_URL}/api/core/projects/${projectId}/add-zone/`, {
                zone_id: zoneId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });

            console.log('📥 Response from add-zone:', response.data);
            if (response.data.success) {
                console.log('✅ Zone added to project with action:', action);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error adding zone to project:', error);
            alert(`Failed to add zone: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

    const handleRemoveZoneFromProject = useCallback(async (zoneId, zoneName) => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return;
            }

            const confirmed = window.confirm(`Remove "${zoneName}" from this project?\n\nThis will only remove it from your project - the zone itself will not be deleted.`);
            if (!confirmed) return;

            const response = await axios.delete(`${API_URL}/api/core/projects/${projectId}/remove-zone/${zoneId}/`);

            if (response.data.success) {
                console.log('✅ Zone removed from project');
                // Reload table data
                if (tableRef.current?.reloadData) {
                    tableRef.current.reloadData();
                }
            }
        } catch (error) {
            console.error('❌ Error removing zone from project:', error);
            alert(`Failed to remove zone: ${error.response?.data?.error || error.message}`);
        }
    }, [activeProjectId, API_URL]);

    // Expose handlers to window for onclick handlers in rendered HTML
    useEffect(() => {
        window.zoneTableHandleAdd = handleAddZoneToProject;
        window.zoneTableHandleRemove = handleRemoveZoneFromProject;

        // Expose tableRef and config for data updates
        window.zoneTableRef = tableRef;
        window.zoneTableActiveProjectId = activeProjectId;
        window.zoneTableActiveProjectName = config?.active_project?.name || 'Current Project';
        window.zoneTableIsUpdatingProjectRef = isUpdatingProjectRef;

        // Expose reload function
        window.zoneTableReload = () => {
            console.log('🔄 zoneTableReload called');
            console.log('🔄 tableRef.current:', tableRef.current);
            console.log('🔄 reloadData function:', tableRef.current?.reloadData);
            if (tableRef.current?.reloadData) {
                console.log('🔄 Calling reloadData()...');
                tableRef.current.reloadData();
                console.log('🔄 reloadData() called successfully');
            } else {
                console.error('❌ reloadData function not available!');
            }
        };

        // Close any open dropdown
        window.zoneTableCloseDropdown = () => {
            const existingMenu = document.querySelector('.zone-add-dropdown-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
        };

        // Toggle dropdown menu
        window.zoneTableToggleAddMenu = (event, zoneId, zoneName) => {
            event.stopPropagation();

            // Close any existing menu
            window.zoneTableCloseDropdown();

            const button = event.currentTarget;
            const rect = button.getBoundingClientRect();

            // Create dropdown menu
            const menu = document.createElement('div');
            menu.className = 'zone-add-dropdown-menu';
            menu.style.cssText = `
                position: fixed;
                top: ${rect.bottom + 4}px;
                left: ${rect.left}px;
                width: ${Math.max(rect.width, 180)}px;
                background-color: var(--secondary-bg);
                border: 1px solid var(--color-border-default);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-md);
                z-index: 10000;
                overflow: hidden;
            `;

            const options = [
                { action: 'reference', label: 'Reference Only', description: 'Just track it' },
                { action: 'modify', label: 'Mark for Modification', description: "You'll modify it" },
                { action: 'delete', label: 'Mark for Deletion', description: "You'll delete it" }
            ];

            options.forEach((option, index) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 10px 12px;
                    cursor: pointer;
                    border-bottom: ${index < options.length - 1 ? '1px solid var(--color-border-default)' : 'none'};
                    font-size: 14px;
                    background-color: var(--secondary-bg);
                    color: var(--primary-text);
                    user-select: none;
                `;

                item.innerHTML = `
                    <div style="font-weight: 500; color: var(--primary-text);">${option.label}</div>
                    <div style="font-size: 12px; color: var(--primary-text); opacity: 0.7; margin-top: 2px;">${option.description}</div>
                `;

                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = 'var(--button-hover-bg)';
                });

                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = 'var(--secondary-bg)';
                });

                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    window.zoneTableCloseDropdown();

                    console.log(`🎯 Dropdown option clicked: ${option.action} for zone ${zoneId}`);
                    const success = await handleAddZoneToProject(zoneId, option.action);

                    if (success) {
                        console.log('✅ Add complete, reloading table data from server...');
                        // Reload from server to get updated data
                        window.zoneTableReload();
                    } else {
                        console.error('❌ Add failed, not reloading');
                    }
                });

                menu.appendChild(item);
            });

            document.body.appendChild(menu);

            // Close dropdown when clicking outside
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && e.target !== button) {
                    window.zoneTableCloseDropdown();
                    document.removeEventListener('click', closeHandler);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        };

        return () => {
            delete window.zoneTableHandleAdd;
            delete window.zoneTableHandleRemove;
            delete window.zoneTableToggleAddMenu;
            delete window.zoneTableCloseDropdown;
            delete window.zoneTableReload;
            delete window.zoneTableRef;
            delete window.zoneTableActiveProjectId;
            delete window.zoneTableActiveProjectName;
            delete window.zoneTableIsUpdatingProjectRef;
        };
    }, [handleAddZoneToProject, handleRemoveZoneFromProject, activeProjectId, config]);

    // Custom save handler for zone bulk save
    const handleZoneSave = useCallback(async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            console.log('⚠️ No changes to save');
            return { success: true, message: 'No changes to save' };
        }

        // Use ref value to avoid dependency on memberColumnCounts
        const columnCounts = memberColumnCountsRef.current;

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
                    // Match existing members by alias ID, not by array index
                    const members = [];

                    // Process target members
                    for (let i = 1; i <= columnCounts.targets; i++) {
                        const memberName = row[`target_member_${i}`];
                        if (memberName) {
                            // Trim whitespace and use case-insensitive matching (handle pasted values from Excel)
                            const trimmedName = (typeof memberName === 'string') ? memberName.trim() : memberName;
                            const alias = aliasOptions.find(a =>
                                a.name.toLowerCase() === (trimmedName || '').toLowerCase()
                            );
                            if (alias) {
                                // Find existing member relationship by matching alias ID
                                const existingMember = row.members_details?.find(m =>
                                    (m.alias === alias.id || m.alias_details?.id === alias.id)
                                );

                                if (existingMember?.id) {
                                    members.push({
                                        id: existingMember.id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing target member ${i}: ${memberName} (member ID: ${existingMember.id}, alias ID: ${alias.id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New target member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                            }
                        }
                    }

                    // Process initiator members
                    for (let i = 1; i <= columnCounts.initiators; i++) {
                        const memberName = row[`init_member_${i}`];
                        if (memberName) {
                            // Trim whitespace and use case-insensitive matching (handle pasted values from Excel)
                            const trimmedName = (typeof memberName === 'string') ? memberName.trim() : memberName;
                            const alias = aliasOptions.find(a =>
                                a.name.toLowerCase() === (trimmedName || '').toLowerCase()
                            );
                            if (alias) {
                                // Find existing member relationship by matching alias ID
                                const existingMember = row.members_details?.find(m =>
                                    (m.alias === alias.id || m.alias_details?.id === alias.id)
                                );

                                if (existingMember?.id) {
                                    members.push({
                                        id: existingMember.id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing init member ${i}: ${memberName} (member ID: ${existingMember.id}, alias ID: ${alias.id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New init member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                            }
                        }
                    }

                    // Process all access members
                    for (let i = 1; i <= columnCounts.allAccess; i++) {
                        const memberName = row[`all_member_${i}`];
                        if (memberName) {
                            // Trim whitespace and use case-insensitive matching (handle pasted values from Excel)
                            const trimmedName = (typeof memberName === 'string') ? memberName.trim() : memberName;
                            const alias = aliasOptions.find(a =>
                                a.name.toLowerCase() === (trimmedName || '').toLowerCase()
                            );
                            if (alias) {
                                // Find existing member relationship by matching alias ID
                                const existingMember = row.members_details?.find(m =>
                                    (m.alias === alias.id || m.alias_details?.id === alias.id)
                                );

                                if (existingMember?.id) {
                                    members.push({
                                        id: existingMember.id,
                                        alias: alias.id
                                    });
                                    console.log(`  ✅ Preserved existing all access member ${i}: ${memberName} (member ID: ${existingMember.id}, alias ID: ${alias.id})`);
                                } else {
                                    members.push({ alias: alias.id });
                                    console.log(`  🆕 New all access member ${i}: ${memberName} (alias ID: ${alias.id})`);
                                }
                            }
                        }
                    }

                    console.log(`🎯 Final members array for ${row.name}:`, members);

                    // Find fabric ID from name
                    // Trim whitespace and use case-insensitive matching (handle pasted values from Excel)
                    const fabricName = (typeof row.fabric === 'string') ? row.fabric.trim() : row.fabric;
                    const fabric = fabricOptions.find(f =>
                        f.name.toLowerCase() === (fabricName || '').toLowerCase()
                    );
                    if (!fabric) {
                        const availableFabricNames = fabricOptions.map(f => f.name).join(', ');
                        throw new Error(`Zone "${row.name}" must have a valid fabric selected. Fabric "${fabricName}" not found. Available fabrics: ${availableFabricNames}`);
                    }

                    // Clean payload
                    const cleanRow = { ...row };

                    // Remove all member columns and UI-only fields
                    // Remove target member columns
                    for (let i = 1; i <= columnCounts.targets; i++) {
                        delete cleanRow[`target_member_${i}`];
                    }
                    // Remove initiator member columns
                    for (let i = 1; i <= columnCounts.initiators; i++) {
                        delete cleanRow[`init_member_${i}`];
                    }
                    // Remove all access member columns
                    for (let i = 1; i <= columnCounts.allAccess; i++) {
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
    }, [fabricOptions, aliasOptions, activeProjectId, API_ENDPOINTS]); // memberColumnCounts accessed via ref

    // Show empty config message if no active customer/project
    if (!config || !activeCustomerId || !activeProjectId) {
        return <EmptyConfigMessage entityName="zones" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading zone data...</span>
                </div>
            </div>
        );
    }

    // Generate read-only message based on user role and project ownership
    const getReadOnlyMessage = () => {
        if (isViewer) {
            return "You have viewer permissions for this customer. Only members and admins can modify project data.";
        } else if (!isProjectOwner && !isAdmin) {
            const ownerName = config?.active_project?.owner_username || 'another user';
            return `You can only modify projects you own. This project is owned by ${ownerName}.`;
        }
        return "";
    };

    // Project filter toggle buttons for toolbar
    const filterToggleButtons = (
        <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
            <button
                type="button"
                className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px 0 0 6px',
                    transition: 'all 0.2s ease'
                }}
            >
                All Zones
            </button>
            <button
                type="button"
                className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('current')}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '0 6px 6px 0',
                    transition: 'all 0.2s ease'
                }}
            >
                Current Project Only
            </button>
        </div>
    );

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> {getReadOnlyMessage()}
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}
                // API Configuration
                apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/?project_filter=${projectFilter}`}
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
                customRenderers={customRenderers}

                // Custom save handler for bulk zone operations
                customSaveHandler={handleZoneSave}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`zone-table-${activeProjectId || 'default'}-bytype`}
                readOnly={isReadOnly}
                pageSizeOptions={[25, 50, 100]} // Limited options for better performance with large datasets

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