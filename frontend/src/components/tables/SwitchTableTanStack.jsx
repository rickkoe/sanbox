import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusColumn, projectStatusRenderer } from "../../utils/projectStatusRenderer";

// TanStack Table implementation for Switch management
const SwitchTableTanStack = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const navigate = useNavigate();
    const customerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;
    const activeCustomerId = config?.customer?.id;

    // Project filter state
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('switchTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerSwitches, setAllCustomerSwitches] = useState([]);
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

    // Load all customer switches when modal opens
    useEffect(() => {
        const loadAllCustomerSwitches = async () => {
            if (showBulkModal && customerId && activeProjectId) {
                try {
                    console.log('📥 Loading all customer switches for bulk modal...');
                    const response = await api.get(`${API_URL}/api/san/switches/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=all&page_size=10000`);
                    const switches = response.data.results || response.data;
                    setAllCustomerSwitches(switches);
                    console.log(`✅ Loaded ${switches.length} customer switches for modal`);
                } catch (error) {
                    console.error('❌ Error loading customer switches:', error);
                    setAllCustomerSwitches([]);
                }
            }
        };

        loadAllCustomerSwitches();
    }, [showBulkModal, customerId, activeProjectId, API_URL]);

    // Handle filter change
    const handleFilterChange = (newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('switchTableProjectFilter', newFilter);
        // Reload table data
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    };

    // Determine API URL based on filter (needed for select all handler)
    const getApiUrl = () => {
        if (projectFilter === 'current' && activeProjectId) {
            // Project view: merged data with overrides
            return `${API_URL}/api/san/switches/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer view with project: includes in_active_project flag
            return `${API_URL}/api/san/switches/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=${projectFilter}`;
        } else {
            // Customer view without project
            return `${API_URL}/api/san/switches/?customer_id=${customerId}`;
        }
    };


    // Fetch fabrics for the active customer
    useEffect(() => {
        const fetchFabrics = async () => {
            if (!customerId) return;

            setFabricsLoading(true);
            try {
                const response = await api.get(`/api/san/fabrics/?customer_id=${customerId}`);
                console.log('📡 Fetched fabrics:', response.data);
                // Handle paginated response
                const fabricsData = response.data.results || response.data;
                setFabrics(fabricsData);
            } catch (error) {
                console.error('Error fetching fabrics:', error);
            } finally {
                setFabricsLoading(false);
            }
        };

        fetchFabrics();
    }, [customerId]);

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

    // All possible switch columns
    const baseColumns = [];

    // Add selection checkbox column only in Project View
    if (projectFilter === 'current') {
        baseColumns.push({
            data: "_selected",
            title: "Select",
            type: "checkbox",
            readOnly: false,
            width: 60,
            defaultVisible: true,
            accessorKey: "_selected"
        });
    }

    baseColumns.push(
        { data: "name", title: "Name", required: true }
    );

    // Add Project Status column (shows New/Delete/Modified/Unmodified) after Name in Project View
    if (projectFilter === 'current') {
        baseColumns.push(projectStatusColumn);
    }

    baseColumns.push(
        { data: "san_vendor", title: "Vendor", type: "dropdown", required: true },
        { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
        { data: "fabrics", title: "Fabrics", type: "dropdown", allowMultiple: true },
        { data: "domain_ids", title: "Domain IDs" },  // Custom editable cell component
        { data: "wwnn", title: "WWNN" },
        { data: "ip_address", title: "IP Address" },
        { data: "subnet_mask", title: "Subnet Mask", defaultVisible: false },
        { data: "gateway", title: "Gateway", defaultVisible: false },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number", defaultVisible: false },
        { data: "firmware_version", title: "Firmware Version", defaultVisible: false },
        { data: "is_active", title: "Active", type: "checkbox" },
        { data: "location", title: "Location" },
        { data: "notes", title: "Notes" }
    );

    // Add project-specific columns when project is active
    const columns = activeProjectId ? [
        ...baseColumns,
        { data: "in_active_project", title: "In Project", type: "custom", readOnly: true, defaultVisible: true },
        { data: "project_actions", title: "Add/Remove", type: "custom", readOnly: true, defaultVisible: true }
    ] : baseColumns;

    const colHeaders = columns.map(col => col.title);

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
        },
        in_active_project: (rowData, td, row, col, prop, value) => {
            if (!activeProjectId) return "";
            const isInProject = rowData.in_active_project === true;
            return isInProject ?
                '<span class="badge bg-success">Yes</span>' :
                '<span class="badge bg-secondary">No</span>';
        },
        project_actions: (rowData, td, row, col, prop, value) => {
            if (!activeProjectId || isReadOnly) return "";
            const isInProject = rowData.in_active_project === true;

            if (isInProject) {
                return `<button class="btn btn-sm btn-danger remove-switch-btn" data-switch-id="${rowData.id}">Remove</button>`;
            } else {
                return `<div class="dropdown d-inline">
                    <button class="btn btn-sm btn-primary dropdown-toggle add-switch-btn" type="button" data-bs-toggle="dropdown" data-switch-id="${rowData.id}">
                        Add to Project
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" data-action="reference">Reference Only</a></li>
                        <li><a class="dropdown-item" href="#" data-action="modify">Mark for Modification</a></li>
                        <li><a class="dropdown-item" href="#" data-action="delete">Mark for Deletion</a></li>
                    </ul>
                </div>`;
            }
        }
    };

    // Handle add switch to project
    const handleAddSwitchToProject = async (switchId, action) => {
        try {
            const response = await api.post(`/api/core/projects/${activeProjectId}/add-switch/`, {
                switch_id: switchId,
                action: action,
                notes: ''
            });

            if (response.data.success) {
                console.log('✅ Switch added to project');

                // Smart table update
                const hadDirtyChanges = tableRef.current?.hasChanges;
                const currentData = tableRef.current?.getTableData();

                if (currentData) {
                    const updatedData = currentData.map(row => {
                        if (row.id === parseInt(switchId)) {
                            return {
                                ...row,
                                in_active_project: true
                            };
                        }
                        return row;
                    });

                    if (hadDirtyChanges) {
                        tableRef.current.setTableData(updatedData);
                    } else {
                        tableRef.current.updateTableDataSilently(updatedData);
                    }
                }

                return true;
            }
        } catch (error) {
            console.error('Error adding switch to project:', error);
            alert('Failed to add switch to project: ' + (error.response?.data?.error || error.message));
        }
        return false;
    };

    // Handle remove switch from project
    const handleRemoveSwitchFromProject = async (switchId) => {
        if (!window.confirm('Remove this switch from the project?')) {
            return false;
        }

        try {
            const response = await api.delete(`/api/core/projects/${activeProjectId}/remove-switch/${switchId}/`);

            if (response.data.success) {
                console.log('✅ Switch removed from project');

                // Smart table update
                const hadDirtyChanges = tableRef.current?.hasChanges;
                const currentData = tableRef.current?.getTableData();

                if (currentData) {
                    const updatedData = currentData.map(row => {
                        if (row.id === parseInt(switchId)) {
                            return {
                                ...row,
                                in_active_project: false
                            };
                        }
                        return row;
                    });

                    if (hadDirtyChanges) {
                        tableRef.current.setTableData(updatedData);
                    } else {
                        tableRef.current.updateTableDataSilently(updatedData);
                    }
                }

                return true;
            }
        } catch (error) {
            console.error('Error removing switch from project:', error);
            alert('Failed to remove switch from project: ' + (error.response?.data?.error || error.message));
        }
        return false;
    };

    // Handle bulk switch save from modal
    const handleBulkSwitchSave = async (selectedIds) => {
        try {
            console.log('🔄 Bulk switch save started with selected IDs:', selectedIds);

            if (!allCustomerSwitches || allCustomerSwitches.length === 0) {
                console.error('No customer switches available');
                alert('No switches data available. Please try again.');
                return;
            }

            // Get current switches in project
            const currentProjectSwitchIds = allCustomerSwitches
                .filter(s => s.in_active_project)
                .map(s => s.id);

            // Determine changes
            const toAdd = selectedIds.filter(id => !currentProjectSwitchIds.includes(id));
            const toRemove = currentProjectSwitchIds.filter(id => !selectedIds.includes(id));

            console.log('📊 To Add:', toAdd, 'To Remove:', toRemove);

            let successCount = 0;
            let errorCount = 0;

            // Process additions
            for (const switchId of toAdd) {
                const success = await handleAddSwitchToProject(switchId, 'reference');
                if (success) successCount++;
                else errorCount++;
            }

            // Process removals
            for (const switchId of toRemove) {
                try {
                    const response = await api.delete(`/api/core/projects/${activeProjectId}/remove-switch/${switchId}/`);
                    if (response.data.success) successCount++;
                    else errorCount++;
                } catch (error) {
                    console.error('Error removing switch:', error);
                    errorCount++;
                }
            }

            // Show result
            alert(`Bulk operation complete!\n✅ Success: ${successCount}\n❌ Errors: ${errorCount}`);

            // Reload table
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

        } catch (error) {
            console.error('❌ Bulk switch save error:', error);
            alert('Failed to perform bulk operation: ' + error.message);
        }
    };

    // Expose handlers to window for HTML onclick
    useEffect(() => {
        window.handleAddSwitchToProject = handleAddSwitchToProject;
        window.handleRemoveSwitchFromProject = handleRemoveSwitchFromProject;

        return () => {
            delete window.handleAddSwitchToProject;
            delete window.handleRemoveSwitchFromProject;
        };
    }, [activeProjectId, handleAddSwitchToProject, handleRemoveSwitchFromProject]);

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
                in_active_project: switchItem.in_active_project || false,
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
                const { domain_ids, fabric_domain_details, fabrics_details, in_active_project, project_actions, modified_fields, project_action, ...switchData } = row;

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

    // Custom toolbar buttons - Actions dropdown + View toggle buttons
    const filterToggleButtons = (
        <ProjectViewToolbar
            projectFilter={projectFilter}
            onFilterChange={handleFilterChange}
            activeProjectId={activeProjectId}
            onBulkClick={() => setShowBulkModal(true)}
            ActionsDropdown={ActionsDropdown}
            entityName="switches"
        />
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
                saveUrl={`${API_URL}/api/san/switches/`}
                deleteUrl={`${API_URL}/api/san/switches/delete/`}
                customerId={customerId}
                tableName="switches"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                customRenderers={customRenderers}
                newRowTemplate={NEW_SWITCH_TEMPLATE}

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

            {showBulkModal && (
                <BulkProjectMembershipModal
                    show={showBulkModal}
                    onHide={() => setShowBulkModal(false)}
                    items={allCustomerSwitches.length > 0 ? allCustomerSwitches : (tableRef.current?.getTableData() || [])}
                    onSave={handleBulkSwitchSave}
                    itemType="switch"
                    projectName={config?.active_project?.name || ''}
                />
            )}
        </div>
    );
};

export default SwitchTableTanStack;
