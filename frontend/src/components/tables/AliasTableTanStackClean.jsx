import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";

// Clean TanStack Table implementation for Alias management
const AliasTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { user, getUserRole } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();

    const [fabricOptions, setFabricOptions] = useState([]);
    const [hostOptions, setHostOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorModal, setErrorModal] = useState({ show: false, message: '', errors: null });
    const [wwpnColumnCount, setWwpnColumnCount] = useState(1); // Dynamic WWPN column count
    const isAddingColumnRef = useRef(false); // Flag to prevent data reload when adding column
    const [showBulkModal, setShowBulkModal] = useState(false); // Bulk add/remove modal
    const [allCustomerAliases, setAllCustomerAliases] = useState([]); // All customer aliases for bulk modal

    // Project filter state (default: 'all' shows all customer aliases)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('aliasTableProjectFilter') || 'all'
    );

    // Ref to access table methods
    const tableRef = useRef(null);

    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // Auto-switch to Customer View when no project is selected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            console.log('No active project - switching to Customer View');
            setProjectFilter('all');
            localStorage.setItem('aliasTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('aliasTableProjectFilter', newFilter);
        // Reload table data with new filter
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Function to add new WWPN column
    const addWwpnColumn = useCallback(() => {
        // Preserve current table data, sorting, and changes state before adding column
        const currentData = tableRef.current?.getTableData();
        const currentSorting = tableRef.current?.getSorting();
        const hadChanges = tableRef.current?.hasChanges;
        console.log('💾 Preserving table data before adding WWPN column:', {
            rows: currentData?.length,
            hadChanges: hadChanges
        });

        // Create a deep copy to ensure data isn't lost
        const dataCopy = currentData ? JSON.parse(JSON.stringify(currentData)) : null;

        // Set flag to prevent automatic data reload
        isAddingColumnRef.current = true;

        // Capture current count before updating
        let newColumnIndex;
        setWwpnColumnCount(prev => {
            newColumnIndex = prev + 1;
            return prev + 1;
        });
        console.log('➕ Added new WWPN column');

        // Restore data and sorting after column is added
        // Use longer timeout to ensure table has re-rendered with new columns
        setTimeout(() => {
            if (dataCopy && dataCopy.length > 0) {
                console.log('♻️ Restoring preserved table data and sorting');

                // Extend each row with the new WWPN column field
                const extendedData = dataCopy.map(row => ({
                    ...row,
                    [`wwpn_${newColumnIndex}`]: "" // Add empty field for new WWPN column
                }));

                tableRef.current?.setTableData(extendedData);
                tableRef.current?.setSorting(currentSorting || []);

                // Auto-size columns after restoration
                setTimeout(() => {
                    console.log('📏 Auto-sizing columns after adding new column');
                    tableRef.current?.autoSizeColumns();

                    // Clear the flag after everything is done
                    isAddingColumnRef.current = false;
                }, 50);
            } else {
                console.log('📏 Auto-sizing columns after adding new column (no data to restore)');
                tableRef.current?.autoSizeColumns();

                // Clear the flag
                isAddingColumnRef.current = false;
            }
        }, 200); // Increased timeout to ensure columns are ready
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

    // API endpoints - Use different endpoint based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/san`;

        // Use different endpoint based on filter mode and project availability
        let aliasesUrl;
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Use merged data endpoint (only project entities with overrides applied)
            aliasesUrl = `${baseUrl}/aliases/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer View with project: Use regular endpoint
            aliasesUrl = `${baseUrl}/aliases/project/${activeProjectId}/?project_filter=${projectFilter}`;
        } else {
            // Customer View without project: Use customer-level endpoint
            aliasesUrl = `${baseUrl}/aliases/?customer_id=${activeCustomerId}`;
        }

        return {
            aliases: aliasesUrl,
            fabrics: `${baseUrl}/fabrics/`,
            hosts: `${baseUrl}/hosts/project/`,
            aliasSave: `${baseUrl}/aliases/save/`,
            aliasDelete: `${baseUrl}/aliases/delete/`
        };
    }, [API_URL, activeProjectId, activeCustomerId, projectFilter]);

    // Base alias columns (non-WWPN columns)
    const baseColumns = useMemo(() => {
        const allColumns = [
            { data: "name", title: "Name", required: true },
            { data: "use", title: "Use", type: "dropdown" },
            { data: "fabric_details.name", title: "Fabric", type: "dropdown", required: true },
            { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
            { data: "host_details.name", title: "Host", type: "dropdown" },
            { data: "storage_details.name", title: "Storage System", readOnly: true },
            { data: "cisco_alias", title: "Alias Type", type: "dropdown" },
            { data: "committed", title: "Committed", type: "checkbox", defaultVisible: true },
            { data: "deployed", title: "Deployed", type: "checkbox", defaultVisible: true },
            { data: "logged_in", title: "Logged In", type: "checkbox", defaultVisible: false },
            { data: "zoned_count", title: "Zoned Count", type: "numeric", readOnly: true },
            { data: "imported", title: "Imported", readOnly: true, defaultVisible: false },
            { data: "updated", title: "Updated", readOnly: true, defaultVisible: false },
            { data: "notes", title: "Notes" }
        ];

        return allColumns;
    }, []);

    // Generate dynamic WWPN columns
    const wwpnColumns = useMemo(() => {
        const columns = [];
        for (let i = 1; i <= wwpnColumnCount; i++) {
            const isLastColumn = i === wwpnColumnCount;

            const columnDef = {
                data: `wwpn_${i}`,
                title: `WWPN ${i}`, // Keep title as string for auto-sizing
                required: i === 1 // Only first WWPN is required
            };

            // Add custom header with plus button only to the last column
            if (isLastColumn) {
                columnDef.customHeader = {
                    component: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            WWPN {i}
                            <button
                                className="wwpn-plus-button"
                                title="Add WWPN column"
                                style={getPlusButtonStyle()}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '0.8';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                onClick={(e) => {
                                    console.log('🔘 Plus button clicked in header!');
                                    e.preventDefault();
                                    e.stopPropagation();
                                    addWwpnColumn();
                                }}
                            >
                                +
                            </button>
                        </span>
                    )
                };
            }

            columns.push(columnDef);
        }
        return columns;
    }, [wwpnColumnCount, theme, getPlusButtonStyle, addWwpnColumn]);

    // Combine base columns with WWPN columns (WWPNs come after name)
    const columns = useMemo(() => {
        const nameColumn = baseColumns.slice(0, 1); // "Name" column
        const otherColumns = baseColumns.slice(1);  // All other columns
        return [...nameColumn, ...wwpnColumns, ...otherColumns];
    }, [baseColumns, wwpnColumns]);

    // Generate list of default visible columns (includes all WWPN columns)
    const defaultVisibleColumns = useMemo(() => {
        const wwpnColumnNames = Array.from({ length: wwpnColumnCount }, (_, i) => `wwpn_${i + 1}`);
        return [
            'name',
            ...wwpnColumnNames,
            'use',
            'fabric_details.name',
            'project_memberships',
            'host_details.name',
            'storage_details.name',
            'cisco_alias',
            'committed',
            'deployed',
            'zoned_count',
            'notes'
        ];
    }, [wwpnColumnCount]);

    const colHeaders = columns.map(col => col.title);

    const NEW_ALIAS_TEMPLATE = useMemo(() => {
        const template = {
            id: null,
            name: "",
            use: "",
            fabric: "",
            fabric_details: { name: "" },
            host: "",
            host_details: { name: "" },
            storage: "",
            storage_details: { name: "" },
            cisco_alias: "",
            committed: false,
            deployed: false,
            logged_in: false,
            notes: "",
            imported: null,
            updated: null,
            zoned_count: 0,
            project_memberships: [],
            in_active_project: false
        };
        // Add dynamic WWPN fields
        for (let i = 1; i <= wwpnColumnCount; i++) {
            template[`wwpn_${i}`] = "";
        }
        return template;
    }, [wwpnColumnCount]);

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

    // Calculate required WWPN columns based on alias data
    const calculateWwpnColumns = useCallback((aliases) => {
        if (!aliases || aliases.length === 0) return 1;

        let maxWwpns = 1;
        aliases.forEach(alias => {
            if (alias.wwpns && Array.isArray(alias.wwpns)) {
                maxWwpns = Math.max(maxWwpns, alias.wwpns.length);
            }
        });
        console.log(`📊 Calculated ${maxWwpns} WWPN columns needed`);
        return maxWwpns;
    }, []);

    // Load fabrics, hosts, and calculate WWPN columns from customer aliases
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);
                    console.log('Loading dropdown data for alias table...');

                    // Build hosts URL based on whether we have an active project
                    const hostsUrl = activeProjectId
                        ? `${API_ENDPOINTS.hosts}${activeProjectId}/`
                        : `${API_URL}/api/san/hosts/?customer_id=${activeCustomerId}`;

                    // Load all customer aliases to calculate WWPN column count
                    // This is a one-time load per customer change, not per table reload
                    const aliasesUrl = `${API_URL}/api/san/aliases/?customer_id=${activeCustomerId}`;

                    // Use Promise.allSettled to handle partial failures gracefully
                    const results = await Promise.allSettled([
                        api.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`),
                        api.get(hostsUrl),
                        api.get(aliasesUrl)
                    ]);

                    // Handle fabrics
                    if (results[0].status === 'fulfilled') {
                        const fabricsArray = results[0].value.data.results || results[0].value.data;
                        setFabricOptions(fabricsArray.map(f => ({ id: f.id, name: f.name })));
                        console.log(`✅ Loaded ${fabricsArray.length} fabrics`);
                    } else {
                        console.error('❌ Failed to load fabrics:', results[0].reason);
                        setFabricOptions([]);
                    }

                    // Handle hosts
                    if (results[1].status === 'fulfilled') {
                        const hostsArray = results[1].value.data.results || results[1].value.data;
                        setHostOptions(hostsArray.map(h => ({ id: h.id, name: h.name })));
                        console.log(`✅ Loaded ${hostsArray.length} hosts`);
                    } else {
                        console.error('❌ Failed to load hosts:', results[1].reason);
                        setHostOptions([]);
                    }

                    // Handle aliases and calculate WWPN columns
                    if (results[2].status === 'fulfilled') {
                        const aliasesArray = results[2].value.data.results || results[2].value.data;
                        const requiredColumns = calculateWwpnColumns(aliasesArray);
                        wwpnColumnCountRef.current = requiredColumns;
                        setWwpnColumnCount(requiredColumns);
                        console.log(`✅ Calculated ${requiredColumns} WWPN columns from ${aliasesArray.length} aliases`);
                    } else {
                        console.error('❌ Failed to load aliases for column calculation:', results[2].reason);
                        // Default to 2 columns if we can't calculate
                        wwpnColumnCountRef.current = 2;
                        setWwpnColumnCount(2);
                    }

                    console.log('✅ Dropdown data loading completed');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading dropdown data:', error);
                    setLoading(false);
                }
            }
        };

        loadData();
    }, [activeCustomerId, activeProjectId, calculateWwpnColumns, API_ENDPOINTS, API_URL]);

    // Dynamic dropdown sources (storage removed - now read-only lookup via WWPN)
    const dropdownSources = useMemo(() => ({
        use: ["init", "target", "both"],
        "fabric_details.name": fabricOptions.map(f => f.name),
        "host_details.name": hostOptions.map(h => h.name), // Note: Should be conditional based on use=init
        cisco_alias: ["device-alias", "fcalias", "wwpn"],
    }), [fabricOptions, hostOptions]);

    // API handlers for add/remove alias from project
    const handleAddAliasToProject = useCallback(async (aliasId, action = 'reference') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return;
            }

            console.log(`📤 Adding alias ${aliasId} to project ${projectId} with action: ${action}`);
            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-alias/`, {
                alias_id: aliasId,
                action: action,
                include_in_zoning: false,
                notes: `Added via table UI with action: ${action}`
            });

            console.log('📥 Response from add-alias:', response.data);
            if (response.data.success) {
                console.log('✅ Alias added to project with action:', action);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error adding alias to project:', error);
            alert(`Failed to add alias: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

    const handleRemoveAliasFromProject = useCallback(async (aliasId, aliasName) => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return;
            }

            const confirmed = window.confirm(`Remove "${aliasName}" from this project?\n\nThis will only remove it from your project - the alias itself will not be deleted.`);
            if (!confirmed) return;

            const response = await api.delete(`${API_URL}/api/core/projects/${projectId}/remove-alias/${aliasId}/`);

            if (response.data.success) {
                console.log('✅ Alias removed from project');
                // Reload table data
                if (tableRef.current?.reloadData) {
                    tableRef.current.reloadData();
                }
            }
        } catch (error) {
            console.error('❌ Error removing alias from project:', error);
            alert(`Failed to remove alias: ${error.response?.data?.error || error.message}`);
        }
    }, [activeProjectId, API_URL]);

    // Load all customer aliases when modal opens
    useEffect(() => {
        const loadAllCustomerAliases = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    console.log('📥 Loading all customer aliases for bulk modal...');
                    // Fetch all customer aliases with project membership info
                    const response = await api.get(
                        `${API_URL}/api/san/aliases/project/${activeProjectId}/?project_filter=all&page_size=10000`
                    );
                    const aliases = response.data.results || response.data;
                    setAllCustomerAliases(aliases);
                    console.log(`✅ Loaded ${aliases.length} customer aliases for modal`);
                } catch (error) {
                    console.error('❌ Error loading customer aliases:', error);
                    setAllCustomerAliases([]);
                }
            }
        };

        loadAllCustomerAliases();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handler for bulk add/remove aliases from modal
    const handleBulkAliasSave = useCallback(async (selectedIds) => {
        try {
            console.log('🔄 Bulk alias save started with selected IDs:', selectedIds);

            if (!allCustomerAliases || allCustomerAliases.length === 0) {
                console.error('No customer aliases available');
                return;
            }

            // Get current aliases in project
            const currentInProject = new Set(
                allCustomerAliases
                    .filter(alias => alias.in_active_project)
                    .map(alias => alias.id)
            );

            // Determine adds and removes
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            console.log('📊 Bulk operation:', { toAdd: toAdd.length, toRemove: toRemove.length });

            let successCount = 0;
            let errorCount = 0;

            // Process additions
            for (const aliasId of toAdd) {
                try {
                    const success = await handleAddAliasToProject(aliasId, 'reference');
                    if (success) successCount++;
                    else errorCount++;
                } catch (error) {
                    console.error(`Failed to add alias ${aliasId}:`, error);
                    errorCount++;
                }
            }

            // Process removals
            for (const aliasId of toRemove) {
                try {
                    const response = await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-alias/${aliasId}/`);
                    if (response.data.success) {
                        successCount++;
                        console.log(`✅ Removed alias ${aliasId} from project`);
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Failed to remove alias ${aliasId}:`, error);
                    errorCount++;
                }
            }

            // Show results
            if (errorCount > 0) {
                alert(`Completed with errors: ${successCount} successful, ${errorCount} failed`);
            } else if (successCount > 0) {
                alert(`Successfully updated ${successCount} aliases`);
            }

            // Reload table to get fresh data
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

            console.log('✅ Bulk operation completed:', { successCount, errorCount });

        } catch (error) {
            console.error('❌ Bulk alias save error:', error);
            alert(`Error during bulk operation: ${error.message}`);
        }
    }, [activeProjectId, API_URL, handleAddAliasToProject, allCustomerAliases]);

    // Expose handlers to window for onclick handlers in rendered HTML
    useEffect(() => {
        window.aliasTableHandleAdd = handleAddAliasToProject;
        window.aliasTableHandleRemove = handleRemoveAliasFromProject;

        // Expose tableRef and config for data updates
        window.aliasTableRef = tableRef;
        window.aliasTableActiveProjectId = activeProjectId;
        window.aliasTableActiveProjectName = config?.active_project?.name || 'Current Project';

        // Expose reload function
        window.aliasTableReload = () => {
            console.log('🔄 aliasTableReload called');
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
        window.aliasTableCloseDropdown = () => {
            const existingMenu = document.querySelector('.alias-add-dropdown-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
        };

        // Toggle dropdown menu
        window.aliasTableToggleAddMenu = (event, aliasId, aliasName) => {
            event.stopPropagation();

            // Close any existing menu
            window.aliasTableCloseDropdown();

            const button = event.currentTarget;
            const rect = button.getBoundingClientRect();

            // Create dropdown menu
            const menu = document.createElement('div');
            menu.className = 'alias-add-dropdown-menu';
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
                    window.aliasTableCloseDropdown();

                    console.log(`🎯 Dropdown option clicked: ${option.action} for alias ${aliasId}`);

                    // Get current table data and check for dirty changes
                    const hadDirtyChanges = window.aliasTableRef?.current?.hasChanges;
                    const currentData = window.aliasTableRef?.current?.getTableData();
                    console.log('💾 Table state before add:', { hadDirtyChanges, rowCount: currentData?.length });

                    const success = await handleAddAliasToProject(aliasId, option.action);

                    if (success && currentData) {
                        console.log('✅ Add complete, updating table data in place...');

                        // Update just the affected row
                        const updatedData = currentData.map(row => {
                            if (row.id === parseInt(aliasId)) {
                                return {
                                    ...row,
                                    in_active_project: true,
                                    project_memberships: [
                                        ...(row.project_memberships || []),
                                        {
                                            project_id: window.aliasTableActiveProjectId,
                                            project_name: window.aliasTableActiveProjectName,
                                            action: option.action
                                        }
                                    ]
                                };
                            }
                            return row;
                        });

                        // Use silent update if no dirty changes, otherwise preserve dirty state
                        if (hadDirtyChanges) {
                            // Preserve dirty state
                            window.aliasTableRef?.current?.setTableData(updatedData);
                            console.log('✅ Table updated - dirty state preserved');
                        } else {
                            // Silent update (no dirty state triggered)
                            window.aliasTableRef?.current?.updateTableDataSilently(updatedData);
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
                    window.aliasTableCloseDropdown();
                    document.removeEventListener('click', closeHandler);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 100);
        };

        return () => {
            delete window.aliasTableHandleAdd;
            delete window.aliasTableHandleRemove;
            delete window.aliasTableToggleAddMenu;
            delete window.aliasTableCloseDropdown;
            delete window.aliasTableReload;
            delete window.aliasTableRef;
            delete window.aliasTableActiveProjectId;
            delete window.aliasTableActiveProjectName;
        };
    }, [handleAddAliasToProject, handleRemoveAliasFromProject, activeProjectId, config]);

    // Custom renderers for WWPN formatting and project badges
    const customRenderers = useMemo(() => {
        console.log('🎨 Creating custom renderers for', wwpnColumnCount, 'WWPN columns');
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
                    const title = `Action: ${pm.action || 'unknown'}${pm.include_in_zoning ? ' (in zoning)' : ''}`;
                    const projectName = pm.project_name || 'Unknown';
                    return `<span class="badge ${badgeClass} me-1" title="${title}" onmousedown="event.stopPropagation()">${projectName}</span>`;
                }).filter(badge => badge !== '').join('');

                return badges ? `<div onmousedown="event.stopPropagation()">${badges}</div>` : '';
            } catch (error) {
                console.error('Error rendering project_memberships:', error, value);
                return '';
            }
        };

        // Add renderer for each WWPN column - just format the value
        // TanStackCRUDTable calls: customRenderer(rowData, null, rowIndex, colIndex, accessorKey, value)
        for (let i = 1; i <= wwpnColumnCount; i++) {
            const columnName = `wwpn_${i}`;

            renderers[columnName] = (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
                // The value is passed as the 6th argument
                // Format WWPN value
                const formattedValue = value && isValidWWPNFormat(value) ? formatWWPN(value) : (value || "");
                return formattedValue;
            };
        }

        // NOTE: Field highlighting for modified fields is now handled via CSS in TanStackCRUDTable
        // The table automatically applies background color and left border to cells where
        // rowData.modified_fields includes the column accessor key
        // No need for custom renderers here!

        console.log('✅ Custom renderers created:', Object.keys(renderers));
        return renderers;
    }, [wwpnColumnCount, activeProjectId, projectFilter]);

    // Store wwpnColumnCount in a ref so preprocessData doesn't need to depend on it
    const wwpnColumnCountRef = useRef(wwpnColumnCount);
    useEffect(() => {
        wwpnColumnCountRef.current = wwpnColumnCount;
    }, [wwpnColumnCount]);

    // Process data for display - convert IDs to names in nested properties and distribute WWPNs across columns
    // Using useCallback with stable reference - wwpnColumnCount accessed via ref to avoid recreating function
    const preprocessData = useCallback((data) => {
        // If we're in the middle of adding a column, return null to prevent reload
        if (isAddingColumnRef.current) {
            console.log('⏸️ preprocessData skipped - adding column in progress');
            return null;
        }

        // Use ref value for stable column count during processing
        const columnCount = wwpnColumnCountRef.current;

        console.log(`🔄 preprocessData called with ${data?.length} aliases, ${columnCount} WWPN columns`);
        const processed = data.map((alias, idx) => {
            const processedAlias = {
                ...alias,
                // Keep nested structure for display
                fabric_details: alias.fabric_details || { name: "" },
                host_details: alias.host_details || { name: "" },
                storage_details: alias.storage_details || { name: "" },
                // Add flattened version for easier filtering (helps FilterDropdown extract values)
                'storage_details.name': alias.storage_details?.name || '',
                // Ensure zoned_count defaults to 0 if not set
                zoned_count: alias.zoned_count || 0
            };

            // Distribute WWPNs across dynamic columns
            const wwpns = alias.wwpns || (alias.wwpn ? [alias.wwpn] : []);

            // Clear all WWPN columns first
            for (let i = 1; i <= columnCount; i++) {
                processedAlias[`wwpn_${i}`] = "";
            }

            // Populate WWPN columns with data
            wwpns.forEach((wwpn, index) => {
                if (index < columnCount) {
                    processedAlias[`wwpn_${index + 1}`] = wwpn;
                }
            });

            // Log first 3 aliases for debugging
            if (idx < 3) {
                console.log(`📝 Processed alias ${idx}:`, {
                    name: alias.name,
                    wwpns: wwpns,
                    wwpn_1: processedAlias.wwpn_1,
                    wwpn_2: processedAlias.wwpn_2,
                    allKeys: Object.keys(processedAlias).filter(k => k.startsWith('wwpn'))
                });
            }

            return processedAlias;
        });

        console.log('📝 Sample of processed data (first row):', processed[0]);
        return processed;
    }, []); // Empty deps - function uses refs for stable behavior

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
                        await api.delete(`${API_ENDPOINTS.aliasDelete}${aliasId}/`);
                        console.log(`✅ Deleted alias ${aliasId}`);
                    } catch (error) {
                        console.error(`❌ Failed to delete alias ${aliasId}:`, error);

                        // Check if it's a permission error
                        if (error.response?.status === 403) {
                            return {
                                success: false,
                                message: error.response?.data?.error || 'You have read-only access to this project. Only members and admins can delete data.'
                            };
                        }

                        return {
                            success: false,
                            message: `Failed to delete alias ${aliasId}: ${error.response?.data?.error || error.response?.data?.message || error.message}`
                        };
                    }
                }
            }

            // Validate WWPNs - check all WWPN columns
            const invalidWWPN = allTableData.find((alias) => {
                if (!alias.name || alias.name.trim() === "") return false;

                // Check if at least one WWPN is provided
                let hasAnyWwpn = false;
                for (let i = 1; i <= wwpnColumnCount; i++) {
                    if (alias[`wwpn_${i}`] && alias[`wwpn_${i}`].trim()) {
                        hasAnyWwpn = true;
                        break;
                    }
                }
                if (!hasAnyWwpn) return true; // No WWPN provided

                // Validate format of all provided WWPNs
                for (let i = 1; i <= wwpnColumnCount; i++) {
                    const wwpn = alias[`wwpn_${i}`];
                    if (wwpn && wwpn.trim()) {
                        const cleanWWPN = wwpn.replace(/[^0-9a-fA-F]/g, "");
                        if (cleanWWPN.length !== 16 || !/^[0-9a-fA-F]+$/.test(cleanWWPN)) {
                            return true; // Invalid format
                        }
                    }
                }
                return false;
            });

            if (invalidWWPN) {
                return {
                    success: false,
                    message: `⚠️ Invalid WWPN format for alias "${invalidWWPN.name}". All WWPNs must be 16 hex characters.`,
                };
            }

            // Validate that host is not set for targets
            const invalidHostRows = allTableData.filter((alias) => {
                if (!alias.name || alias.name.trim() === "") return false;
                const hasHost = (alias.host_details?.name && alias.host_details.name.trim() !== '') ||
                              alias['host_details.name'] ||
                              alias.host;
                return hasHost && alias.use === 'target';
            });

            // Build validation error message if there are issues
            if (invalidHostRows.length > 0) {
                const errors = [];

                if (invalidHostRows.length > 0) {
                    errors.push({
                        type: 'Host on Targets',
                        description: 'The following aliases have Use set to "target" but have a Host selected. Targets cannot have hosts.',
                        solution: 'Change Use to "init" or "both", or remove the Host.',
                        rows: invalidHostRows.map(r => r.name)
                    });
                }

                return {
                    success: false,
                    message: 'Validation errors found',
                    errors: errors
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

                    // Find IDs from names - check nested structure first (new behavior), then flat property (legacy)
                    // Use explicit checks to handle empty strings properly
                    let fabricName = (row.fabric_details?.name && row.fabric_details.name.trim() !== '')
                        ? row.fabric_details.name.trim()
                        : (row['fabric_details.name'] || row.fabric);
                    let hostName = (row.host_details?.name && row.host_details.name.trim() !== '')
                        ? row.host_details.name.trim()
                        : (row['host_details.name'] || row.host);

                    // Trim and normalize fabric/host names for matching (handle pasted values from Excel)
                    if (fabricName && typeof fabricName === 'string') {
                        fabricName = fabricName.trim();
                    }
                    if (hostName && typeof hostName === 'string') {
                        hostName = hostName.trim();
                    }

                    // Case-insensitive lookup for fabric (handles pasted values with different case)
                    const fabric = fabricOptions.find(f =>
                        f.name.toLowerCase() === (fabricName || '').toLowerCase()
                    );

                    // Case-insensitive lookup for host (handles pasted values with different case)
                    const host = hostOptions.find(h =>
                        h.name.toLowerCase() === (hostName || '').toLowerCase()
                    );

                    console.log('🎯 Found references:', {
                        fabricName: fabricName,
                        fabric: fabric,
                        hostName: hostName,
                        host: host,
                        'row.use': row.use,
                        'Will set host?': (row.host_details?.name && (row.use === 'init' || row.use === 'both') && host)
                    });

                    if (!fabric) {
                        console.error('❌ Fabric lookup failed for row:', row);
                        const availableFabricNames = fabricOptions.map(f => f.name).join(', ');
                        throw new Error(`Alias "${row.name}" must have a valid fabric selected. Fabric "${fabricName}" not found. Available fabrics: ${availableFabricNames}`);
                    }

                    // Clean payload (replicating original buildPayload)
                    const cleanRow = { ...row };
                    delete cleanRow.saved;
                    delete cleanRow.fabric_details;
                    delete cleanRow.host_details;
                    delete cleanRow.storage_details;
                    delete cleanRow.zoned_count;

                    // Collect WWPNs from all dynamic WWPN columns
                    let wwpns_write = [];
                    for (let i = 1; i <= wwpnColumnCount; i++) {
                        const wwpnValue = cleanRow[`wwpn_${i}`];
                        if (wwpnValue && wwpnValue.trim()) {
                            wwpns_write.push(formatWWPN(wwpnValue.trim()));
                        }
                        // Delete WWPN column from cleanRow
                        delete cleanRow[`wwpn_${i}`];
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
                        wwpns_write: wwpns_write, // Send as array
                        projects: [activeProjectId],
                        fabric: parseInt(fabric.id),
                        host: null
                        // Note: storage is no longer sent - it's a read-only lookup via Port.wwpn
                    };

                    // Handle host assignment (for initiators and both)
                    if (row.host_details?.name && (row.use === 'init' || row.use === 'both') && host) {
                        result.host = parseInt(host.id);
                    }

                    return result;
                });

            // Only call bulk save if there are rows to save
            if (payload.length > 0) {
                console.log('🚀 Sending bulk alias save:', { project_id: activeProjectId, aliases: payload });

                // Use the original bulk save endpoint
                await api.post(API_ENDPOINTS.aliasSave, {
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

            // Check if it's a permission error
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: error.response?.data?.error || 'You have read-only access to this project. Only members and admins can modify data.'
                };
            }

            return {
                success: false,
                message: `Error saving aliases: ${error.response?.data?.error || error.response?.data?.message || error.message}`
            };
        }
    };

    // Transform data for saving - not used since we have custom save handler
    const saveTransform = (rows) => rows;

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="aliases" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading alias data...</span>
                </div>
            </div>
        );
    }

    // Generate read-only message based on user role and project ownership
    const getReadOnlyMessage = () => {
        if (isViewer) {
            return "Read-only access: You have viewer permissions for this customer. Only members and admins can modify project data.";
        } else if (!isProjectOwner && !isAdmin) {
            const ownerName = config?.active_project?.owner_username || 'another user';
            return `Read-only access: You can only modify projects you own. This project is owned by ${ownerName}.`;
        }
        return "";
    };

    // Project filter toggle buttons for toolbar
    const filterToggleButtons = (
        <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
            {/* Customer View Button */}
            <button
                type="button"
                className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px 0 0 6px',
                    transition: 'all 0.2s ease',
                    marginRight: '0',
                    minWidth: '140px'
                }}
            >
                Customer View
            </button>

            {/* Project View Button - Disabled if no active project */}
            <button
                type="button"
                className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('current')}
                disabled={!activeProjectId}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '0',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '140px'
                }}
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only aliases in this project'}
            >
                Project View
            </button>

            {/* Manage Project Button - Disabled if no active project */}
            <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/settings/project')}
                disabled={!activeProjectId}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '0',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '140px'
                }}
                title={!activeProjectId ? 'Select a project to manage' : 'Manage active project'}
            >
                Manage Project
            </button>

            {/* Bulk Add/Remove Button - Disabled if no active project */}
            <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowBulkModal(true)}
                disabled={!activeProjectId}
                style={{
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '0 6px 6px 0',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}
                title={!activeProjectId ? 'Select a project to add/remove aliases' : 'Bulk add or remove aliases from this project'}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Checklist icon */}
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </button>
        </div>
    );

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> {getReadOnlyMessage().replace('Read-only access: ', '')}
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration - uses custom save endpoint
                apiUrl={API_ENDPOINTS.aliases}
                saveUrl={API_ENDPOINTS.aliasSave}
                deleteUrl={API_ENDPOINTS.aliasDelete}
                customerId={activeCustomerId}
                tableName="aliases"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_ALIAS_TEMPLATE}
                defaultVisibleColumns={defaultVisibleColumns}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`alias-table-${activeProjectId || 'default'}`}
                readOnly={isReadOnly}

                // Custom save handler - bypass default CRUD and use bulk save
                customSaveHandler={handleAliasSave}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Alias save successful:', result.message);
                    } else {
                        console.error('❌ Alias save failed:', result.message);
                        setErrorModal({
                            show: true,
                            message: result.message,
                            errors: result.errors || null
                        });
                    }
                }}
            />

            {/* Error Modal */}
            {errorModal.show && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 9999,
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setErrorModal({ show: false, message: '', errors: null });
                        }
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content shadow-lg" style={{
                            backgroundColor: 'var(--bs-body-bg, #fff)',
                            color: 'var(--bs-body-color, #212529)',
                            border: '1px solid var(--bs-border-color, #dee2e6)'
                        }}>
                            <div className="modal-header bg-danger text-white" style={{
                                borderBottom: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <h5 className="modal-title">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    Validation Error
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setErrorModal({ show: false, message: '', errors: null })}
                                ></button>
                            </div>
                            <div className="modal-body" style={{
                                maxHeight: '60vh',
                                overflowY: 'auto',
                                backgroundColor: 'var(--bs-body-bg, #fff)'
                            }}>
                                {errorModal.errors ? (
                                    <>
                                        <p style={{
                                            color: 'var(--bs-secondary-color, #6c757d)',
                                            marginBottom: '1rem'
                                        }}>
                                            Please fix the following validation errors before saving:
                                        </p>
                                        {errorModal.errors.map((error, idx) => (
                                            <div key={idx} className="mb-4">
                                                <h6 className="fw-bold" style={{ color: '#dc3545' }}>
                                                    <i className="bi bi-x-circle me-2"></i>
                                                    {error.type}
                                                </h6>
                                                <p className="small mb-2" style={{
                                                    color: 'var(--bs-secondary-color, #6c757d)'
                                                }}>
                                                    {error.description}
                                                </p>
                                                <div
                                                    className="border rounded p-2 mb-2"
                                                    style={{
                                                        maxHeight: '150px',
                                                        overflowY: 'auto',
                                                        backgroundColor: 'var(--bs-secondary-bg, #f8f9fa)',
                                                        borderColor: 'var(--bs-border-color, #dee2e6) !important'
                                                    }}
                                                >
                                                    <strong className="small" style={{
                                                        color: 'var(--bs-body-color, #212529)'
                                                    }}>
                                                        Affected aliases ({error.rows.length}):
                                                    </strong>
                                                    <ul className="mb-0 mt-1 small" style={{
                                                        columnCount: error.rows.length > 10 ? 2 : 1,
                                                        color: 'var(--bs-body-color, #212529)'
                                                    }}>
                                                        {error.rows.map((rowName, rowIdx) => (
                                                            <li key={rowIdx}>{rowName}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="py-2 px-3 mb-0 small rounded" style={{
                                                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                                    border: '1px solid rgba(13, 110, 253, 0.3)',
                                                    color: 'var(--bs-body-color, #212529)'
                                                }}>
                                                    <strong>Solution:</strong> {error.solution}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <p className="mb-0" style={{
                                        color: 'var(--bs-body-color, #212529)'
                                    }}>{errorModal.message}</p>
                                )}
                            </div>
                            <div className="modal-footer" style={{
                                borderTop: '1px solid var(--bs-border-color, #dee2e6)',
                                backgroundColor: 'var(--bs-body-bg, #fff)'
                            }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setErrorModal({ show: false, message: '', errors: null })}
                                >
                                    <i className="bi bi-check-circle me-2"></i>
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkAliasSave}
                items={allCustomerAliases}
                itemType="alias"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default AliasTableTanStackClean;