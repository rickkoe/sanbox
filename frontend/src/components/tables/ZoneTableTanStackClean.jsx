import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusRenderer } from "../../utils/projectStatusRenderer";
import { getTableColumns, getDefaultSort } from "../../utils/tableConfigLoader";
import "../../styles/zone-table.css";
import { Form } from "react-bootstrap";

// Clean TanStack Table implementation for Zone management
const ZoneTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { settings } = useSettings();
    const { theme } = useTheme();
    const navigate = useNavigate();

    const [fabricOptions, setFabricOptions] = useState([]);
    const [fabricsById, setFabricsById] = useState({});
    const [aliasOptions, setAliasOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [memberColumnCounts, setMemberColumnCounts] = useState({
        targets: 1,
        initiators: 1,
        allAccess: 1
    });
    const isAddingColumnRef = useRef(false); // Flag to prevent data reload when adding column
    const memberColumnCountsRef = useRef(memberColumnCounts); // Store current counts for stable access
    const isTogglingColumnsRef = useRef(false); // Flag to prevent page change detection during manual toggle
    const [totalRowCount, setTotalRowCount] = useState(0); // Total rows in table
    const [showAllMemberColumns, setShowAllMemberColumns] = useState(false); // Expand/collapse member columns
    const [showAllAliases, setShowAllAliases] = useState(false); // Show all aliases in dropdowns (bypass already-zoned filter)
    const showAllAliasesRef = useRef(showAllAliases); // Ref for filter function access (avoids stale closure)
    // Update ref synchronously during render (before useMemo runs) - useEffect is too late!
    showAllAliasesRef.current = showAllAliases;
    const [currentPage, setCurrentPage] = useState(1); // Track current page for reset on navigation

    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter } = useProjectFilter();

    // Keep the ref in sync with state
    useEffect(() => {
        memberColumnCountsRef.current = memberColumnCounts;
    }, [memberColumnCounts]);

    // Ref to access table methods
    const tableRef = useRef(null);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // Use centralized API hook
    const { apiUrl } = useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: 'zones',
        baseUrl: `${API_URL}/api/san`,
        localStorageKey: 'zoneTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'zones'
    });

    // Use centralized selection hook
    const {
        selectedRows,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        BannerSlot,
        ActionsDropdown
    } = useProjectViewSelection({
        tableRef,
        projectFilter,
        activeProjectId,
        apiUrl,
        entityType: 'zone',
        API_URL,
        totalRowCount
    });

    // Auto-switch and force visibility are now handled by hooks

    // API endpoints - zones URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/san`;

        return {
            zones: apiUrl, // From useProjectViewAPI hook
            fabrics: `${baseUrl}/fabrics/`,
            aliases: `${baseUrl}/aliases/project/`,
            zoneSave: `${baseUrl}/zones/save/`,
            zoneDelete: `${baseUrl}/zones/delete/`
        };
    }, [API_URL, apiUrl]);

    // Live/Draft toggle is now in the navbar

    // Handler to select all rows across all pages
    // Selection state and actions dropdown are now managed by useProjectViewSelection hook

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

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // Get default sort configuration
    const defaultSort = getDefaultSort('zone');

    // Base zone columns (main columns before member columns) - loaded from centralized configuration
    // Zone table has complex structure: base columns + dynamic member columns + trailing columns
    const baseColumns = useMemo(() => {
        // Get columns from config - this includes selection, name, project_action, and initial fields
        const configColumns = getTableColumns('zone', projectFilter === 'current');

        // Filter to only get initial columns (name, fabric, zone_type)
        // The rest (committed, deployed, etc.) will be trailing columns
        return configColumns.filter(col =>
            ['_selected', 'name', 'project_action', 'fabric', 'zone_type'].includes(col.data)
        );
    }, [projectFilter]);

    // Trailing columns (appear after member columns) - from config
    const trailingColumns = useMemo(() => {
        const configColumns = getTableColumns('zone', projectFilter === 'current');

        // Get the trailing columns (everything after zone_type)
        return configColumns.filter(col =>
            ['committed', 'deployed', 'exists', 'member_count', 'imported', 'updated', 'notes'].includes(col.data)
        );
    }, [projectFilter]);

    // Generate dynamic member columns organized by use type
    const memberColumns = useMemo(() => {
        const columns = [];

        // Determine how many columns to show based on expanded/collapsed state
        const targetCount = showAllMemberColumns ? memberColumnCounts.targets : 1;
        const initiatorCount = showAllMemberColumns ? memberColumnCounts.initiators : 1;
        const allAccessCount = showAllMemberColumns ? memberColumnCounts.allAccess : 1;

        console.log('🏗️ memberColumns memo recalculating:', {
            showAllMemberColumns,
            targetCount,
            initiatorCount,
            allAccessCount,
            memberColumnCounts
        });

        // Target columns first - subtle blue tint
        for (let i = 1; i <= targetCount; i++) {
            const isLastTarget = i === memberColumnCounts.targets;
            columns.push({
                data: `target_member_${i}`,
                title: `Target Member ${i}`,
                type: "dropdown",
                columnGroup: "target",
                customHeader: (showAllMemberColumns && isLastTarget) ? {
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
        for (let i = 1; i <= initiatorCount; i++) {
            const isLastInitiator = i === memberColumnCounts.initiators;
            columns.push({
                data: `init_member_${i}`,
                title: `Initiator Member ${i}`,
                type: "dropdown",
                columnGroup: "initiator",
                customHeader: (showAllMemberColumns && isLastInitiator) ? {
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
        for (let i = 1; i <= allAccessCount; i++) {
            const isLastAllAccess = i === memberColumnCounts.allAccess;
            columns.push({
                data: `all_member_${i}`,
                title: `All Access Member ${i}`,
                type: "dropdown",
                columnGroup: "allAccess",
                customHeader: (showAllMemberColumns && isLastAllAccess) ? {
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
    }, [memberColumnCounts, showAllMemberColumns, addTargetColumn, addInitiatorColumn, addAllAccessColumn, getPlusButtonStyle]);

    // All columns (base + member + trailing)
    const allColumns = useMemo(() => {
        console.log('📋 Regenerating allColumns:', {
            baseCount: baseColumns.length,
            memberCount: memberColumns.length,
            trailingCount: trailingColumns.length,
            total: baseColumns.length + memberColumns.length + trailingColumns.length,
            showAllMemberColumns
        });
        return [...baseColumns, ...memberColumns, ...trailingColumns];
    }, [baseColumns, memberColumns, trailingColumns, showAllMemberColumns]);

    const colHeaders = useMemo(() => {
        const headers = allColumns.map(col => col.title);
        console.log('📝 Regenerating colHeaders:', headers.length);
        return headers;
    }, [allColumns]);

    const NEW_ZONE_TEMPLATE = useMemo(() => {
        const template = {
            id: null,
            name: "",
            _selected: false, // Selection checkbox state
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

    // Load fabrics and aliases for dropdowns
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);
                    console.log('Loading zone dropdown data...');

                    // Helper function to paginate through all aliases
                    const fetchAllAliases = async () => {
                        const baseUrl = activeProjectId
                            ? `${API_ENDPOINTS.aliases}${activeProjectId}/`
                            : `${API_URL}/api/san/aliases/`;
                        const params = activeProjectId
                            ? `project_filter=${projectFilter}&`
                            : `customer_id=${activeCustomerId}&`;

                        let allAliases = [];
                        let page = 1;
                        let hasMore = true;
                        const pageSize = 500; // Use max allowed by backend

                        while (hasMore) {
                            const response = await api.get(
                                `${baseUrl}?${params}page_size=${pageSize}&page=${page}`
                            );
                            const aliases = response.data.results || response.data;
                            allAliases = [...allAliases, ...aliases];

                            hasMore = response.data.has_next === true;
                            page++;

                            // Safety limit to prevent infinite loops
                            if (page > 100) break;
                        }

                        console.log(`📦 Fetched ${allAliases.length} aliases for zone dropdowns (${page - 1} pages)`);
                        return { data: { results: allAliases } };
                    };

                    // Build column requirements URL
                    const columnReqUrl = activeProjectId
                        ? `${API_URL}/api/san/zones/project/${activeProjectId}/column-requirements/`
                        : `${API_URL}/api/san/zones/customer/column-requirements/?customer_id=${activeCustomerId}`;

                    // Fabrics URL: use project endpoint when in Project View
                    const fabricsUrl = activeProjectId
                        ? `${API_URL}/api/san/fabrics/project/${activeProjectId}/view/?project_filter=all`
                        : `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`;

                    const [fabricResponse, aliasResponse, columnReqResponse] = await Promise.all([
                        api.get(fabricsUrl),
                        fetchAllAliases(),
                        api.get(columnReqUrl)
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

                    // Use column counts from lightweight endpoint (doesn't load full zone data)
                    const columnReq = columnReqResponse.data;
                    const requiredMemberColumns = {
                        targets: columnReq.targets || 3,
                        initiators: columnReq.initiators || 3,
                        allAccess: columnReq.allAccess || 3
                    };
                    console.log('📊 Column requirements from backend:', requiredMemberColumns);
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
    }, [activeCustomerId, activeProjectId, API_ENDPOINTS, API_URL]);

    // Track total row count from table
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setInterval(() => {
                const paginationInfo = tableRef.current?.getPaginationInfo?.();
                if (paginationInfo && paginationInfo.totalItems !== totalRowCount) {
                    setTotalRowCount(paginationInfo.totalItems);
                }
            }, 500);

            return () => clearInterval(timer);
        }
    }, [projectFilter, totalRowCount]);

    // Initialize current page from table pagination
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setTimeout(() => {
                const paginationInfo = tableRef.current?.getPaginationInfo?.();
                if (paginationInfo && typeof paginationInfo.currentPage === 'number') {
                    console.log('📄 Initializing current page:', paginationInfo.currentPage);
                    setCurrentPage(paginationInfo.currentPage);
                }
            }, 1000); // Wait for table to fully initialize

            return () => clearTimeout(timer);
        }
    }, [projectFilter]);

    // Reset member columns to collapsed view when page changes
    useEffect(() => {
        if (projectFilter === 'current' && tableRef.current) {
            const timer = setInterval(() => {
                const paginationInfo = tableRef.current?.getPaginationInfo?.();

                // Only reset if pagination info is valid and page actually changed
                // Ignore if currentPage is 0 or undefined (initial/invalid state)
                if (paginationInfo &&
                    typeof paginationInfo.currentPage === 'number' &&
                    paginationInfo.currentPage > 0 &&
                    currentPage > 0 &&
                    paginationInfo.currentPage !== currentPage) {
                    console.log(`📄 Page changed from ${currentPage} to ${paginationInfo.currentPage}, collapsing to minimal view`);
                    setCurrentPage(paginationInfo.currentPage);

                    // Only collapse if currently expanded
                    if (showAllMemberColumns) {
                        setShowAllMemberColumns(false);

                        // Hide the extra member columns
                        const currentCounts = memberColumnCountsRef.current;
                        setTimeout(() => {
                            if (tableRef.current?.setColumnVisibility) {
                                const visibilityUpdates = {};

                                // Hide target columns 2+
                                for (let i = 2; i <= currentCounts.targets; i++) {
                                    visibilityUpdates[`target_member_${i}`] = false;
                                }

                                // Hide initiator columns 2+
                                for (let i = 2; i <= currentCounts.initiators; i++) {
                                    visibilityUpdates[`init_member_${i}`] = false;
                                }

                                // Hide all-access columns 2+
                                for (let i = 2; i <= currentCounts.allAccess; i++) {
                                    visibilityUpdates[`all_member_${i}`] = false;
                                }

                                console.log('👁️ Page change: Hiding extra member columns:', visibilityUpdates);
                                tableRef.current.setColumnVisibility(visibilityUpdates);
                            }
                        }, 100);
                    }
                }
            }, 500);

            return () => clearInterval(timer);
        }
    }, [projectFilter, currentPage, showAllMemberColumns]);

    // Selection sync is now handled by useProjectViewSelection hook

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
            const hasRoom = (alias.zoned_count || 0) < aliasMaxZones;

            let matchesUseType = true;
            if (requiredUseType === 'both_or_empty') {
                // All access columns accept 'both' or empty/null use types
                matchesUseType = alias.use === 'both' || !alias.use || alias.use === '';
            } else if (requiredUseType) {
                matchesUseType = alias.use === requiredUseType;
            }

            // Note: include_in_zoning check removed - filtering now based on deployed status and overrides in backend
            const result = matchesFabric && hasRoom && matchesUseType;
            if (!result && alias.name) {
                console.log(`❌ Filtered out ${alias.name}: fabric=${alias.fabric} (need ${zoneFabric}), room=${hasRoom}, use=${alias.use} (need ${requiredUseType})`);
            }
            return result;
        });

        console.log(`✅ Found ${filteredAliases.length} valid ${requiredUseType || 'any'} members for fabric ${zoneFabric}`);
        return filteredAliases.map(alias => alias.name);
    }, [aliasOptions, settings]);

    // Custom renderers for member dropdowns
    const customRenderers = useMemo(() => {
        const renderers = {
            project_action: projectStatusRenderer
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
                // Check if this is the first column and we're in collapsed mode
                const isFirstTargetColumn = memberKey === 'target_member_1';
                const isFirstInitColumn = memberKey === 'init_member_1';
                const isFirstAllAccessColumn = memberKey === 'all_member_1';
                const isFirstColumn = isFirstTargetColumn || isFirstInitColumn || isFirstAllAccessColumn;

                // Show indicator only in collapsed mode for first column with additional members
                let indicator = '';
                if (!showAllMemberColumns && isFirstColumn && value) {
                    let additionalCount = 0;
                    if (isFirstTargetColumn && rowData._targetCount > 1) {
                        additionalCount = rowData._targetCount - 1;
                    } else if (isFirstInitColumn && rowData._initCount > 1) {
                        additionalCount = rowData._initCount - 1;
                    } else if (isFirstAllAccessColumn && rowData._allAccessCount > 1) {
                        additionalCount = rowData._allAccessCount - 1;
                    }

                    if (additionalCount > 0) {
                        indicator = `<span class="zone-table-member-indicator">+${additionalCount} more</span>`;
                    }
                }

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

                // Combine dropdown with indicator
                if (indicator) {
                    return `<div style="display: flex; align-items: center; gap: 6px;">${select.outerHTML}${indicator}</div>`;
                }

                return select.outerHTML;
            };
        });

        // Note: Modified field highlighting is handled automatically by TanStackCRUDTable
        // at the cell level (lines 4149-4167 in TanStackCRUDTable.jsx)
        // No custom renderer needed - just return the value

        return renderers;
    }, [getMemberDropdownOptions, memberColumnCounts, activeProjectId, projectFilter, showAllMemberColumns]); // Needs to recreate when columns added or expand/collapse changes

    // Dynamic dropdown sources that include member filtering
    const dropdownSources = useMemo(() => {
        const sources = {
            fabric: fabricOptions.map(f => f.name),
            zone_type: ["smart", "standard"]
        };

        // Add member dropdown sources (will be filtered by custom renderers)
        const aliasMaxZones = settings?.alias_max_zones || 1;
        // Note: Filtering now happens in backend (alias_list_view) based on deployed status and manual overrides
        // When showAllAliases is true, skip the zoned_count pre-filtering
        const availableAliases = showAllAliasesRef.current
            ? aliasOptions  // Show ALL aliases when toggle is on
            : aliasOptions.filter(alias => (alias.zoned_count || 0) < aliasMaxZones);

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
    }, [fabricOptions, aliasOptions, settings, memberColumnCounts, showAllAliases]); // Needs to recreate when columns added or showAllAliases changes

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

                const zoneFabric = rowData?.fabric;
                if (!zoneFabric) {
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

                // Filter aliases by fabric, use type, zone count limits, and cross-zone usage
                const filteredAliases = aliasOptions.filter(alias => {
                    // Must match fabric
                    if (alias.fabric !== zoneFabric) return false;

                    // Note: include_in_zoning check removed - filtering now based on deployed status and overrides in backend

                    // Must match required use type
                    if (requiredUseType === 'both_or_empty') {
                        // All access columns accept 'both' or empty/null use types
                        if (!(alias.use === 'both' || !alias.use || alias.use === '')) return false;
                    } else if (requiredUseType) {
                        if (alias.use !== requiredUseType) return false;
                    }

                    // Check if already used in ANY zone (but allow current value)
                    // Skip this check if showAllAliases is enabled
                    const isCurrentValue = alias.name === currentValue;
                    const alreadyUsedInAnyZone = usedAcrossAllZones.has(alias.name);

                    if (!showAllAliasesRef.current && alreadyUsedInAnyZone && !isCurrentValue) {
                        return false;
                    }

                    // Check zone count limits - allow current value even if at limit
                    // Skip this check if showAllAliases is enabled
                    if (!showAllAliasesRef.current) {
                        const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;

                        if (!hasRoomForMoreZones && !isCurrentValue) {
                            return false;
                        }
                    }

                    return true;
                });

                const filteredNames = filteredAliases.map(alias => alias.name);

                // Only return options that exist in both the original list and pass all filters
                return options.filter(option => filteredNames.includes(option));
            };
        });

        return filters;
    }, [aliasOptions, settings, memberColumnCounts, showAllAliases]); // Needs to recreate when columns added or showAllAliases changes

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
        // If we're in the middle of adding a column, return null to prevent reload
        if (isAddingColumnRef.current) {
            console.log('⏸️ preprocessData skipped - adding column in progress');
            return null;
        }

        // Use ref value to avoid dependency on memberColumnCounts
        const columnCounts = memberColumnCountsRef.current;

        console.log('🔄 Preprocessing zone data:', data.length, 'zones');
        return data.map(zone => {
            const processedZone = {
                ...zone,
                fabric: fabricsById[zone.fabric] || zone.fabric || '',
                // Selection state - use API value or default to false
                _selected: zone._selected || false
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

                // Populate ALL target member columns (not limited by columnCounts)
                // This ensures data is available when user expands columns
                membersByType.targets.forEach((member, index) => {
                    processedZone[`target_member_${index + 1}`] = member.name || '';
                    console.log(`  Set target_member_${index + 1} = "${member.name}"`);
                });

                // Populate ALL initiator member columns
                membersByType.initiators.forEach((member, index) => {
                    processedZone[`init_member_${index + 1}`] = member.name || '';
                    console.log(`  Set init_member_${index + 1} = "${member.name}"`);
                });

                // Populate ALL all access member columns
                membersByType.allAccess.forEach((member, index) => {
                    processedZone[`all_member_${index + 1}`] = member.name || '';
                    console.log(`  Set all_member_${index + 1} = "${member.name}"`);
                });

                // Update member count
                processedZone.member_count = zone.members_details.length;

                // Add metadata for member counts per type (for indicators in collapsed mode)
                processedZone._targetCount = membersByType.targets.length;
                processedZone._initCount = membersByType.initiators.length;
                processedZone._allAccessCount = membersByType.allAccess.length;
            } else {
                console.log(`⚠️ Zone ${zone.name} has no members_details:`, zone.members_details);
                processedZone.member_count = 0;
                processedZone._targetCount = 0;
                processedZone._initCount = 0;
                processedZone._allAccessCount = 0;
            }

            return processedZone;
        });
    }, [fabricsById]); // memberColumnCounts accessed via ref - not in deps to prevent reload

    // API handlers for add/remove zone from project
    const handleAddZoneToProject = useCallback(async (zoneId, action = 'unmodified') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return false;
            }

            console.log(`📤 Adding zone ${zoneId} to project ${projectId} with action: ${action}`);
            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-zone/`, {
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

            const response = await api.delete(`${API_URL}/api/core/projects/${projectId}/remove-zone/${zoneId}/`);

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
                { action: 'unmodified', label: 'Reference Only', description: 'Just track it' },
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

                    // Get current table data and check for dirty changes
                    const hadDirtyChanges = window.zoneTableRef?.current?.hasChanges;
                    const currentData = window.zoneTableRef?.current?.getTableData();
                    console.log('💾 Table state before add:', { hadDirtyChanges, rowCount: currentData?.length });

                    const success = await handleAddZoneToProject(zoneId, option.action);

                    if (success && currentData) {
                        console.log('✅ Add complete, updating table data in place...');

                        // Update just the affected row
                        const updatedData = currentData.map(row => {
                            if (row.id === parseInt(zoneId)) {
                                return {
                                    ...row,
                                    in_active_project: true
                                };
                            }
                            return row;
                        });

                        // Use silent update if no dirty changes, otherwise preserve dirty state
                        if (hadDirtyChanges) {
                            // Preserve dirty state
                            window.zoneTableRef?.current?.setTableData(updatedData);
                            console.log('✅ Table updated - dirty state preserved');
                        } else {
                            // Silent update (no dirty state triggered)
                            window.zoneTableRef?.current?.updateTableDataSilently(updatedData);
                            console.log('✅ Table updated silently - no dirty state');
                        }
                    } else if (!success) {
                        console.error('❌ Add failed, not updating');
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
                        await api.delete(`${API_ENDPOINTS.zoneDelete}${zoneId}/`);
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

                await api.post(API_ENDPOINTS.zoneSave, {
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

    // Toggle handler for expand/collapse member columns
    const handleToggleMemberColumns = useCallback(() => {
        console.log('🔄 Toggling member columns...', {
            current: showAllMemberColumns,
            willBe: !showAllMemberColumns
        });

        const newValue = !showAllMemberColumns;
        setShowAllMemberColumns(newValue);

        if (tableRef.current) {
            if (newValue) {
                // EXPANDING: Show all member columns
                const currentData = tableRef.current.getTableData?.();
                if (currentData && currentData.length > 0) {
                    // Calculate max member counts from actual data
                    let maxTargets = 0;
                    let maxInitiators = 0;
                    let maxAllAccess = 0;

                    currentData.forEach(zone => {
                        if (zone._targetCount) maxTargets = Math.max(maxTargets, zone._targetCount);
                        if (zone._initCount) maxInitiators = Math.max(maxInitiators, zone._initCount);
                        if (zone._allAccessCount) maxAllAccess = Math.max(maxAllAccess, zone._allAccessCount);
                    });

                    console.log('📊 Dynamic member counts from page data:', {
                        maxTargets,
                        maxInitiators,
                        maxAllAccess
                    });

                    // Update column counts to match actual data
                    setMemberColumnCounts({
                        targets: Math.max(maxTargets, 1),
                        initiators: Math.max(maxInitiators, 1),
                        allAccess: Math.max(maxAllAccess, 1)
                    });

                    // After columns update, make them visible
                    setTimeout(() => {
                        // Build list of all member column IDs
                        const memberColumnIds = [];
                        for (let i = 1; i <= Math.max(maxTargets, 1); i++) {
                            memberColumnIds.push(`target_member_${i}`);
                        }
                        for (let i = 1; i <= Math.max(maxInitiators, 1); i++) {
                            memberColumnIds.push(`init_member_${i}`);
                        }
                        for (let i = 1; i <= Math.max(maxAllAccess, 1); i++) {
                            memberColumnIds.push(`all_member_${i}`);
                        }

                        // Make all member columns visible
                        if (tableRef.current?.setColumnVisibility) {
                            const visibilityUpdates = {};
                            memberColumnIds.forEach(colId => {
                                visibilityUpdates[colId] = true;
                            });
                            console.log('👁️ Making member columns visible:', visibilityUpdates);
                            tableRef.current.setColumnVisibility(visibilityUpdates);
                        }
                    }, 100);
                }
            } else {
                // COLLAPSING: Hide extra member columns (keep only column 1 of each type)
                // Get current member counts before collapsing
                const currentCounts = memberColumnCountsRef.current;

                setTimeout(() => {
                    if (tableRef.current?.setColumnVisibility) {
                        const visibilityUpdates = {};

                        // Hide target columns 2+
                        for (let i = 2; i <= currentCounts.targets; i++) {
                            visibilityUpdates[`target_member_${i}`] = false;
                        }

                        // Hide initiator columns 2+
                        for (let i = 2; i <= currentCounts.initiators; i++) {
                            visibilityUpdates[`init_member_${i}`] = false;
                        }

                        // Hide all-access columns 2+
                        for (let i = 2; i <= currentCounts.allAccess; i++) {
                            visibilityUpdates[`all_member_${i}`] = false;
                        }

                        console.log('👁️ Hiding extra member columns:', visibilityUpdates);
                        tableRef.current.setColumnVisibility(visibilityUpdates);
                    }
                }, 100);
            }
        }
    }, [showAllMemberColumns]);

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
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

    // SVG icons for expand/collapse button
    const expandIcon = (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '6px' }}>
            <path d="M1.5 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5zM8 1.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6a.5.5 0 0 1 .5-.5z"/>
        </svg>
    );

    const collapseIcon = (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '6px' }}>
            <path d="M1.5 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5z"/>
        </svg>
    );

    // Expand/collapse button for member columns
    const expandCollapseButton = (
        <button
            className="btn btn-outline-primary btn-sm zone-table-expand-btn"
            onClick={handleToggleMemberColumns}
            title={showAllMemberColumns ? "Show minimal columns (1 per type)" : "Show all member columns"}
            style={{ marginRight: '8px' }}
        >
            {showAllMemberColumns ? collapseIcon : expandIcon}
            {showAllMemberColumns ? "Show Minimal Columns" : "Show All Members"}
        </button>
    );

    // Use ProjectViewToolbar component for table-specific actions
    // (Live/Draft toggle and Commit are now in the navbar)
    const filterToggleButtons = (
        <>
            {expandCollapseButton}
            <div className="zone-table-alias-toggle">
                <Form.Check
                    type="switch"
                    id="show-all-aliases-toggle"
                    label="Show All Aliases"
                    checked={showAllAliases}
                    onChange={(e) => setShowAllAliases(e.target.checked)}
                />
            </div>
            <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
        </>
    );

    return (
        <div className="modern-table-container zone-table-container">
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}
                // API Configuration
                apiUrl={API_ENDPOINTS.zones}
                saveUrl={API_ENDPOINTS.zoneSave}
                deleteUrl={API_ENDPOINTS.zoneDelete}
                customerId={activeCustomerId}
                tableName="zones"

                // Column Configuration
                columns={allColumns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                dropdownFilters={dropdownFilters}
                dropdownFilterKey={showAllAliases ? 1 : 0}
                newRowTemplate={NEW_ZONE_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                customValidation={customValidation}
                customRenderers={customRenderers}

                // Custom save handler for bulk zone operations
                customSaveHandler={handleZoneSave}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`zone-table-${activeProjectId || 'default'}-bytype`}
                readOnly={isReadOnly}

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