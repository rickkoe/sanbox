import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import api from "../../api";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusRenderer } from "../../utils/projectStatusRenderer";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// TanStack Table implementation for Switch management
const SwitchTableTanStack = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const navigate = useNavigate();
    const customerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    const tableRef = useRef(null);

    // State for fabrics dropdown
    const [fabrics, setFabrics] = useState([]);
    const [fabricsLoading, setFabricsLoading] = useState(false);

    // Use centralized API hook
    const { apiUrl } = useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: 'switches',
        baseUrl: `${API_URL}/api/san`,
        localStorageKey: 'switchTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'switches'
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
        entityType: 'switch',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // Live/Draft toggle is now in the navbar

    // Determine API URL based on filter (needed for select all handler)
    const getApiUrl = () => {
        if (projectFilter === 'current' && activeProjectId) {
            // Project view: merged data with overrides
            return `${API_URL}/api/san/switches/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer view with project
            return `${API_URL}/api/san/switches/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=${projectFilter}`;
        } else {
            // Customer view without project
            return `${API_URL}/api/san/switches/?customer_id=${customerId}`;
        }
    };


    // Fetch fabrics for the active customer (including fabrics in current project)
    useEffect(() => {
        const fetchFabrics = async () => {
            if (!customerId) return;

            setFabricsLoading(true);
            try {
                let fabricsData = [];

                if (activeProjectId) {
                    // When in a project: use project endpoint with project_filter=all
                    // This returns ALL customer fabrics (committed, uncommitted, in project or not)
                    const response = await api.get(
                        `/api/san/fabrics/project/${activeProjectId}/view/?project_filter=all&page_size=500`
                    );
                    fabricsData = response.data.results || response.data || [];
                } else {
                    // No project: just fetch customer fabrics (committed or orphaned)
                    const response = await api.get(`/api/san/fabrics/?customer_id=${customerId}&page_size=500`);
                    fabricsData = response.data.results || response.data || [];
                }

                // Sort alphabetically by name
                fabricsData.sort((a, b) => a.name.localeCompare(b.name));

                console.log('📡 Fetched fabrics:', fabricsData);
                setFabrics(fabricsData);
            } catch (error) {
                console.error('Error fetching fabrics:', error);
                setFabrics([]); // Set empty array on error
            } finally {
                setFabricsLoading(false);
            }
        };

        fetchFabrics();
    }, [customerId, activeProjectId]);

    // Vendor mapping (same as FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // WWNN formatting utilities (same as WWPN formatting in AliasTable)
    const formatWWNN = (value) => {
        if (!value) return "";
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleanValue.length !== 16) return value;
        return cleanValue.match(/.{2}/g).join(':');
    };

    const isValidWWNNFormat = (value) => {
        if (!value) return true;
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
        return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
    };

    // Load columns from centralized configuration
    const columns = useMemo(() => {
        return getTableColumns('switch', projectFilter === 'current');
    }, [projectFilter]);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('switch', projectFilter === 'current');
    }, [projectFilter]);

    const defaultSort = getDefaultSort('switch');

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name),
        fabrics: fabrics.map(f => f.name)
    };

    const NEW_SWITCH_TEMPLATE = {
        id: null,
        name: "",
        _selected: false, // Selection checkbox state
        san_vendor: "",
        fabrics: [],
        domain_ids: "",
        wwnn: "",
        ip_address: "",
        subnet_mask: "",
        gateway: "",
        model: "",
        serial_number: "",
        firmware_version: "",
        is_active: true,
        location: "",
        notes: ""
    };

    // Custom renderers for WWNN formatting and project columns
    const customRenderers = {
        project_action: projectStatusRenderer,
        wwnn: (rowData, td, row, col, prop, value) => {
            if (value && isValidWWNNFormat(value)) {
                return formatWWNN(value);
            }
            return value || "";
        },
        project_memberships: (_rowData, _prop, _rowIndex, _colIndex, _accessorKey, value) => {
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
        }
    };

    // Handle switch save with project-aware logic
    const handleSwitchSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            return { success: true, message: 'No changes to save' };
        }

        try {
            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                for (const switchId of deletedRows) {
                    try {
                        await api.delete(`${API_URL}/api/san/switches/delete/${switchId}/`);
                    } catch (error) {
                        console.error(`Failed to delete switch ${switchId}:`, error);
                        if (error.response?.status === 403) {
                            return {
                                success: false,
                                message: error.response?.data?.error || 'You do not have permission to delete switches.'
                            };
                        }
                        return {
                            success: false,
                            message: `Failed to delete switch: ${error.response?.data?.error || error.message}`
                        };
                    }
                }
            }

            // Build payload for saving switches
            const payload = saveTransform(allTableData)
                .filter(switchItem => switchItem.id || (switchItem.name && switchItem.name.trim() !== ""));

            // Use the new bulk save endpoint with field override support
            if (payload.length > 0) {
                await api.post(`${API_URL}/api/san/switches/save/`, {
                    project_id: activeProjectId,
                    switches: payload,
                });
            }

            const totalOperations = payload.length + (deletedRows ? deletedRows.length : 0);
            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} switch(es)`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} switch(es)`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return { success: true, message };

        } catch (error) {
            console.error('❌ Switch save error:', error);
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: error.response?.data?.error || 'You do not have permission to modify switches.'
                };
            }
            return {
                success: false,
                message: `Error saving switches: ${error.response?.data?.error || error.message}`
            };
        }
    };

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

    // Handler to add switch to project
    const handleAddSwitchToProject = useCallback(async (switchId, action = 'unmodified') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return false;
            }

            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-switch/`, {
                switch_id: switchId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });

            if (response.data.success) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding switch to project:', error);
            alert(`Failed to add switch: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Process data for display - convert vendor codes to names, format fabrics, and domain IDs
    const preprocessData = (data) => {
        return data.map(switchItem => {
            return {
                ...switchItem,
                san_vendor: vendorOptions.find(v => v.code === switchItem.san_vendor)?.name || switchItem.san_vendor,
                fabrics: switchItem.fabric_domain_details?.map(f => f.name) || [],
                domain_ids: switchItem.fabric_domain_details?.map(f => {
                    const domainStr = f.domain_id !== null && f.domain_id !== undefined ? f.domain_id : '';
                    return `${f.name}: ${domainStr}`;
                }).join('\n') || "",
                // Selection state - use API value or default to false
                _selected: switchItem._selected || false
            };
        });
    };

    // Transform data for saving - convert vendor names to codes, format WWNN, and convert fabric names to IDs
    const saveTransform = (rows) =>
        rows
            .filter(row => {
                const requiredFields = ["name", "san_vendor"];
                return requiredFields.some(key => {
                    const value = row[key];
                    return typeof value === "string" && value.trim() !== "";
                });
            })
            .map(row => {
                // Build fabric_domains from fabric_domain_details (which has names and domain_ids)
                // We need to look up fabric IDs from the fabrics list
                let fabric_domains = [];

                if (Array.isArray(row.fabric_domain_details) && row.fabric_domain_details.length > 0) {
                    // Use the fabric_domain_details updated by DomainIDsCell
                    fabric_domains = row.fabric_domain_details
                        .map(fd => {
                            // Look up fabric ID by name
                            const fabric = fabrics.find(f => f.name === fd.name);
                            if (fabric) {
                                return {
                                    fabric_id: fabric.id,
                                    domain_id: fd.domain_id
                                };
                            }
                            return null;
                        })
                        .filter(fd => fd !== null);
                } else if (Array.isArray(row.fabrics)) {
                    // Fall back to fabrics array (when domain IDs haven't been set yet)
                    fabric_domains = row.fabrics
                        .map(fabricName => {
                            const fabric = fabrics.find(f => f.name === fabricName);
                            return fabric ? { fabric_id: fabric.id, domain_id: null } : null;
                        })
                        .filter(fd => fd !== null);
                }

                // Exclude read-only/computed fields
                const { domain_ids, fabric_domain_details, fabrics_details, modified_fields, project_action, ...switchData } = row;

                return {
                    ...switchData,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === switchData.san_vendor || v.code === switchData.san_vendor)?.code || switchData.san_vendor,
                    fabric_domains: fabric_domains,  // Send as fabric_domains array
                    wwnn: switchData.wwnn ? formatWWNN(switchData.wwnn) : null,
                    ip_address: switchData.ip_address === "" ? null : switchData.ip_address,
                    subnet_mask: switchData.subnet_mask === "" ? null : switchData.subnet_mask,
                    gateway: switchData.gateway === "" ? null : switchData.gateway,
                    model: switchData.model === "" ? null : switchData.model,
                    serial_number: switchData.serial_number === "" ? null : switchData.serial_number,
                    firmware_version: switchData.firmware_version === "" ? null : switchData.firmware_version,
                    location: switchData.location === "" ? null : switchData.location
                };
            });

    // Custom toolbar buttons - Actions dropdown
    // (Committed/Draft toggle, Commit, and Bulk Add/Remove are now in the navbar)
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show loading while config is being fetched
    if (configLoading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading configuration...</span>
                    </div>
                    <span className="ms-2">Loading customer configuration...</span>
                </div>
            </div>
        );
    }

    // Show message if no active customer/project is configured
    if (!config || !customerId) {
        return <EmptyConfigMessage entityName="switches" />;
    }

    return (
        <div className="modern-table-container">
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}
                // API Configuration
                apiUrl={getApiUrl()}
                customSaveHandler={handleSwitchSave}
                deleteUrl={`${API_URL}/api/san/switches/delete/`}
                customerId={customerId}
                tableName="switches"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                customRenderers={customRenderers}
                newRowTemplate={NEW_SWITCH_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                vendorOptions={vendorOptions}

                // Custom Toolbar
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 280px)"
                storageKey={`switch-table-${customerId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Save successful:', result.message);
                    } else {
                        console.error('❌ Save failed:', result.message);
                        alert('Error saving changes: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default SwitchTableTanStack;
