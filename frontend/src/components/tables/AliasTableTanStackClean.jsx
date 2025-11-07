import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusColumn } from "../../utils/projectStatusRenderer";

// Clean TanStack Table implementation for Alias management
const AliasTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
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
    const [totalRowCount, setTotalRowCount] = useState(0); // Total rows in table

    // Project filter state (default: 'all' shows all customer aliases)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('aliasTableProjectFilter') || 'all'
    );

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
        entityType: 'aliases',
        baseUrl: `${API_URL}/api/san`,
        localStorageKey: 'aliasTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'aliases'
    });

    // Use centralized selection hook
    const {
        selectedRows,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        SelectAllBanner,
        CustomerViewBanner,
        ActionsDropdown
    } = useProjectViewSelection({
        tableRef,
        projectFilter,
        activeProjectId,
        apiUrl,
        entityType: 'alias',
        API_URL,
        totalRowCount
    });

    // Auto-switch and force visibility are now handled by hooks

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

        // Restore data and sorting after column is added
        // Use longer timeout to ensure table has re-rendered with new columns
        setTimeout(() => {
            if (dataCopy && dataCopy.length > 0) {
                // Extend each row with the new WWPN column field
                const extendedData = dataCopy.map(row => ({
                    ...row,
                    [`wwpn_${newColumnIndex}`]: "" // Add empty field for new WWPN column
                }));

                tableRef.current?.setTableData(extendedData);
                tableRef.current?.setSorting(currentSorting || []);

                // Auto-size columns after restoration
                setTimeout(() => {
                    tableRef.current?.autoSizeColumns();

                    // Clear the flag after everything is done
                    isAddingColumnRef.current = false;
                }, 50);
            } else {
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

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - aliases URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/san`;

        return {
            aliases: apiUrl, // From useProjectViewAPI hook
            fabrics: `${baseUrl}/fabrics/`,
            hosts: `${baseUrl}/hosts/project/`,
            aliasSave: `${baseUrl}/aliases/save/`,
            aliasDelete: `${baseUrl}/aliases/delete/`
        };
    }, [API_URL, apiUrl]);

    // Base alias columns (non-WWPN columns)
    const baseColumns = useMemo(() => {
        const allColumns = [];

        // Add selection checkbox column only in Project View
        if (projectFilter === 'current') {
            allColumns.push({
                data: "_selected",
                title: "Select",
                type: "checkbox",
                readOnly: false,
                width: 60,
                defaultVisible: true,
                accessorKey: "_selected"
            });
        }

        allColumns.push(
            { data: "name", title: "Name", required: true }
        );

        // Add Project Status column (shows New/Delete/Modified/Unmodified) after Name in Project View
        if (projectFilter === 'current') {
            allColumns.push(projectStatusColumn);
        }

        allColumns.push(
            { data: "use", title: "Use", type: "dropdown" },
            { data: "fabric_details.name", title: "Fabric", type: "dropdown", required: true },
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
        );

        return allColumns;
    }, [projectFilter]);

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
        // In Project View, _selected is first, name is second, then WWPNs, then projectStatus, then rest
        // In Customer View, name is first, then WWPNs, then rest
        let finalColumns;
        if (projectFilter === 'current') {
            const selectionColumn = baseColumns.slice(0, 1); // "_selected" column
            const nameColumn = baseColumns.slice(1, 2); // "name" column
            const projectStatusColumn = baseColumns.slice(2, 3); // "projectStatus" column
            const otherColumns = baseColumns.slice(3);  // All other columns
            finalColumns = [...selectionColumn, ...nameColumn, ...wwpnColumns, ...projectStatusColumn, ...otherColumns];
        } else {
            const nameColumn = baseColumns.slice(0, 1); // "name" column
            const otherColumns = baseColumns.slice(1);  // All other columns
            finalColumns = [...nameColumn, ...wwpnColumns, ...otherColumns];
        }
        return finalColumns;
    }, [baseColumns, wwpnColumns, projectFilter]);

    // Generate list of default visible columns (includes all WWPN columns and _selected in Project View)
    const defaultVisibleColumns = useMemo(() => {
        const wwpnColumnNames = Array.from({ length: wwpnColumnCount }, (_, i) => `wwpn_${i + 1}`);
        const visibleColumns = [
            'name',
            ...wwpnColumnNames,
            'use',
            'fabric_details.name',
            'host_details.name',
            'storage_details.name',
            'cisco_alias',
            'committed',
            'deployed',
            'zoned_count',
            'notes'
        ];

        // Add _selected column to visible columns in Project View
        if (projectFilter === 'current') {
            return ['_selected', ...visibleColumns];
        }

        return visibleColumns;
    }, [wwpnColumnCount, projectFilter]);

    const colHeaders = columns.map(col => col.title);

    const NEW_ALIAS_TEMPLATE = useMemo(() => {
        const template = {
            id: null,
            name: "",
            use: "",
            _selected: false, // Selection checkbox state
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
            zoned_count: 0
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
        return maxWwpns;
    }, []);

    // Load fabrics, hosts, and calculate WWPN columns from customer aliases
    useEffect(() => {
        const loadData = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);

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
                    } else {
                        console.error('Failed to load fabrics:', results[0].reason);
                        setFabricOptions([]);
                    }

                    // Handle hosts
                    if (results[1].status === 'fulfilled') {
                        const hostsArray = results[1].value.data.results || results[1].value.data;
                        setHostOptions(hostsArray.map(h => ({ id: h.id, name: h.name })));
                    } else {
                        console.error('Failed to load hosts:', results[1].reason);
                        setHostOptions([]);
                    }

                    // Handle aliases and calculate WWPN columns
                    if (results[2].status === 'fulfilled') {
                        const aliasesArray = results[2].value.data.results || results[2].value.data;
                        const requiredColumns = calculateWwpnColumns(aliasesArray);
                        wwpnColumnCountRef.current = requiredColumns;
                        setWwpnColumnCount(requiredColumns);
                    } else {
                        console.error('Failed to load aliases for column calculation:', results[2].reason);
                        // Default to 2 columns if we can't calculate
                        wwpnColumnCountRef.current = 2;
                        setWwpnColumnCount(2);
                    }

                    setLoading(false);
                } catch (error) {
                    console.error('Error loading dropdown data:', error);
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
                return false;
            }

            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-alias/`, {
                alias_id: aliasId,
                action: action,
                include_in_zoning: false,
                notes: `Added via table UI with action: ${action}`
            });

            if (response.data.success) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding alias to project:', error);
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
                // Reload table data
                if (tableRef.current?.reloadData) {
                    tableRef.current.reloadData();
                }
            }
        } catch (error) {
            console.error('Error removing alias from project:', error);
            alert(`Failed to remove alias: ${error.response?.data?.error || error.message}`);
        }
    }, [activeProjectId, API_URL]);

    // Load all customer aliases when modal opens
    useEffect(() => {
        const loadAllCustomerAliases = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    // Fetch all customer aliases with project membership info
                    const response = await api.get(
                        `${API_URL}/api/san/aliases/project/${activeProjectId}/?project_filter=all&page_size=10000`
                    );
                    const aliases = response.data.results || response.data;
                    setAllCustomerAliases(aliases);
                } catch (error) {
                    console.error('Error loading customer aliases:', error);
                    setAllCustomerAliases([]);
                }
            }
        };

        loadAllCustomerAliases();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handler for bulk add/remove aliases from modal
    const handleBulkAliasSave = useCallback(async (selectedIds) => {
        try {
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

        } catch (error) {
            console.error('Bulk alias save error:', error);
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
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            } else {
                console.error('reloadData function not available');
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

                    // Get current table data and check for dirty changes
                    const hadDirtyChanges = window.aliasTableRef?.current?.hasChanges;
                    const currentData = window.aliasTableRef?.current?.getTableData();

                    const success = await handleAddAliasToProject(aliasId, option.action);

                    if (success && currentData) {
                        // Update just the affected row
                        const updatedData = currentData.map(row => {
                            if (row.id === parseInt(aliasId)) {
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
                            window.aliasTableRef?.current?.setTableData(updatedData);
                        } else {
                            // Silent update (no dirty state triggered)
                            window.aliasTableRef?.current?.updateTableDataSilently(updatedData);
                        }
                    } else if (!success) {
                        console.error('Add failed, not updating');
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

    // Custom renderers for WWPN formatting
    const customRenderers = useMemo(() => {
        const renderers = {};

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
            return null;
        }

        // Use ref value for stable column count during processing
        const columnCount = wwpnColumnCountRef.current;

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
                zoned_count: alias.zoned_count || 0,
                // Selection state - use API value or default to false
                _selected: alias._selected || false
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

            return processedAlias;
        });

        return processed;
    }, []); // Empty deps - checkbox state managed by table data itself

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

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook

    // Custom save handler that matches the original AliasTable bulk save approach
    // Handles CREATE, UPDATE, and DELETE operations
    const handleAliasSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            return { success: true, message: 'No changes to save' };
        }

        try {
            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                for (const aliasId of deletedRows) {
                    try {
                        await api.delete(`${API_ENDPOINTS.aliasDelete}${aliasId}/`);
                    } catch (error) {
                        console.error(`Failed to delete alias ${aliasId}:`, error);

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
                // Use the original bulk save endpoint
                await api.post(API_ENDPOINTS.aliasSave, {
                    project_id: activeProjectId,
                    aliases: payload,
                });
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

    // Use ProjectViewToolbar component (replaces ~170 lines of duplicated code)
    const filterToggleButtons = (
        <ProjectViewToolbar
            projectFilter={projectFilter}
            onFilterChange={handleFilterChange}
            activeProjectId={activeProjectId}
            onBulkClick={() => setShowBulkModal(true)}
            ActionsDropdown={ActionsDropdown}
            entityName="aliases"
        />
    );

    return (
        <div className="modern-table-container">
            {/* Customer View Banner - shown in Customer View (read-only mode) */}
            <CustomerViewBanner />

            {/* Select All Banner - shown in Project View when all page items selected */}
            <SelectAllBanner />

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
                storageKey={`alias-table-${activeProjectId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}

                // Custom save handler - bypass default CRUD and use bulk save
                customSaveHandler={handleAliasSave}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Event Handlers
                onSave={(result) => {
                    if (!result.success) {
                        console.error('Alias save failed:', result.message);
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