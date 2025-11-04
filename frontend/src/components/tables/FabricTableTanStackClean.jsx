import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Fabric management
const FabricTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const navigate = useNavigate();
    const customerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;  // FIX: Use active_project, not project

    // Project filter state
    const [projectFilter, setProjectFilter] = useState('all');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerFabrics, setAllCustomerFabrics] = useState([]);

    const tableRef = useRef(null);

    // Check if user can edit infrastructure
    const userRole = getUserRole(customerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // Load filter preference
    useEffect(() => {
        const savedFilter = localStorage.getItem('fabricTableProjectFilter');
        if (savedFilter && ['all', 'current'].includes(savedFilter)) {
            setProjectFilter(savedFilter);
        }
    }, []);

    // Auto-switch to 'all' when project is deselected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            setProjectFilter('all');
            localStorage.setItem('fabricTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

    // Load all customer fabrics when modal opens
    useEffect(() => {
        const loadAllCustomerFabrics = async () => {
            if (showBulkModal && customerId && activeProjectId) {
                try {
                    console.log('📥 Loading all customer fabrics for bulk modal...');
                    const response = await api.get(`${API_URL}/api/san/fabrics/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=all&page_size=10000`);
                    const fabrics = response.data.results || response.data;
                    setAllCustomerFabrics(fabrics);
                    console.log(`✅ Loaded ${fabrics.length} customer fabrics for modal`);
                } catch (error) {
                    console.error('❌ Error loading customer fabrics:', error);
                    setAllCustomerFabrics([]);
                }
            }
        };

        loadAllCustomerFabrics();
    }, [showBulkModal, customerId, activeProjectId, API_URL]);

    // Handle filter change
    const handleFilterChange = (newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('fabricTableProjectFilter', newFilter);
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    };

    // Vendor mapping
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // All possible fabric columns
    const baseColumns = [
        { data: "name", title: "Name", required: true },
        { data: "san_vendor", title: "Vendor", type: "dropdown", required: true },
        { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
        { data: "switches", title: "Switches", readOnly: true },
        { data: "zoneset_name", title: "Zoneset Name" },
        { data: "vsan", title: "VSAN", type: "numeric", defaultVisible: false },
        { data: "alias_count", title: "Aliases", type: "numeric", readOnly: true },
        { data: "zone_count", title: "Zones", type: "numeric", readOnly: true },
        { data: "exists", title: "Exists", type: "checkbox" },
        { data: "notes", title: "Notes" }
    ];

    // Add project-specific columns when project is active
    const columns = activeProjectId ? [
        ...baseColumns,
        { data: "in_active_project", title: "In Project", type: "custom", readOnly: true, defaultVisible: true },
        { data: "project_actions", title: "Add/Remove", type: "custom", readOnly: true, defaultVisible: true }
    ] : baseColumns;

    const colHeaders = columns.map(col => col.title);

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name)
    };

    const NEW_FABRIC_TEMPLATE = {
        id: null,
        name: "",
        san_vendor: "",
        switches: "",
        zoneset_name: "",
        vsan: "",
        alias_count: 0,
        zone_count: 0,
        exists: false,
        notes: ""
    };

    // Custom renderers
    const customRenderers = {
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
                return `<button class="btn btn-sm btn-danger remove-fabric-btn" data-fabric-id="${rowData.id}">Remove</button>`;
            } else {
                return `<div class="dropdown d-inline">
                    <button class="btn btn-sm btn-primary dropdown-toggle add-fabric-btn" type="button" data-bs-toggle="dropdown" data-fabric-id="${rowData.id}">
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

    // Handle add fabric to project
    const handleAddFabricToProject = async (fabricId, action) => {
        try {
            const response = await api.post(`/api/core/projects/${activeProjectId}/add-fabric/`, {
                fabric_id: fabricId,
                action: action,
                notes: ''
            });

            if (response.data.success) {
                console.log('✅ Fabric added to project');

                const hadDirtyChanges = tableRef.current?.hasChanges;
                const currentData = tableRef.current?.getTableData();

                if (currentData) {
                    const updatedData = currentData.map(row => {
                        if (row.id === parseInt(fabricId)) {
                            return { ...row, in_active_project: true };
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
            console.error('Error adding fabric to project:', error);
            alert('Failed to add fabric to project: ' + (error.response?.data?.error || error.message));
        }
        return false;
    };

    // Handle remove fabric from project
    const handleRemoveFabricFromProject = async (fabricId) => {
        if (!window.confirm('Remove this fabric from the project?')) {
            return false;
        }

        try {
            const response = await api.delete(`/api/core/projects/${activeProjectId}/remove-fabric/${fabricId}/`);

            if (response.data.success) {
                console.log('✅ Fabric removed from project');

                const hadDirtyChanges = tableRef.current?.hasChanges;
                const currentData = tableRef.current?.getTableData();

                if (currentData) {
                    const updatedData = currentData.map(row => {
                        if (row.id === parseInt(fabricId)) {
                            return { ...row, in_active_project: false };
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
            console.error('Error removing fabric from project:', error);
            alert('Failed to remove fabric from project: ' + (error.response?.data?.error || error.message));
        }
        return false;
    };

    // Handle bulk fabric save
    const handleBulkFabricSave = async (selectedIds) => {
        try {
            console.log('🔄 Bulk fabric save started with selected IDs:', selectedIds);

            if (!allCustomerFabrics || allCustomerFabrics.length === 0) {
                console.error('No customer fabrics available');
                alert('No fabrics data available. Please try again.');
                return;
            }

            // Get current fabrics in project
            const currentProjectFabricIds = allCustomerFabrics
                .filter(f => f.in_active_project)
                .map(f => f.id);

            const toAdd = selectedIds.filter(id => !currentProjectFabricIds.includes(id));
            const toRemove = currentProjectFabricIds.filter(id => !selectedIds.includes(id));

            console.log('📊 To Add:', toAdd, 'To Remove:', toRemove);

            let successCount = 0;
            let errorCount = 0;

            // Process additions
            for (const fabricId of toAdd) {
                const success = await handleAddFabricToProject(fabricId, 'reference');
                if (success) successCount++;
                else errorCount++;
            }

            // Process removals
            for (const fabricId of toRemove) {
                try {
                    const response = await api.delete(`/api/core/projects/${activeProjectId}/remove-fabric/${fabricId}/`);
                    if (response.data.success) successCount++;
                    else errorCount++;
                } catch (error) {
                    console.error('Error removing fabric:', error);
                    errorCount++;
                }
            }

            alert(`Bulk operation complete!\n✅ Success: ${successCount}\n❌ Errors: ${errorCount}`);

            // Reload table data
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

        } catch (error) {
            console.error('❌ Bulk fabric save error:', error);
            alert('Failed to perform bulk operation: ' + error.message);
        }
    };

    // Expose handlers to window
    useEffect(() => {
        window.handleAddFabricToProject = handleAddFabricToProject;
        window.handleRemoveFabricFromProject = handleRemoveFabricFromProject;

        return () => {
            delete window.handleAddFabricToProject;
            delete window.handleRemoveFabricFromProject;
        };
    }, [activeProjectId, handleAddFabricToProject, handleRemoveFabricFromProject]);

    // Process data for display
    const preprocessData = (data) => {
        return data.map(fabric => ({
            ...fabric,
            san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor,
            switches: fabric.switches_details?.map(s => {
                const domainStr = s.domain_id !== null && s.domain_id !== undefined ? ` (${s.domain_id})` : '';
                return `${s.name}${domainStr}`;
            }).join(', ') || "",
            in_active_project: fabric.in_active_project || false
        }));
    };

    // Transform data for saving
    const saveTransform = (rows) =>
        rows
            .filter(row => {
                const requiredFields = ["name", "zoneset_name", "san_vendor"];
                return requiredFields.some(key => {
                    const value = row[key];
                    return typeof value === "string" && value.trim() !== "";
                });
            })
            .map(row => {
                const { alias_count, zone_count, switches, in_active_project, project_actions, modified_fields, project_action, ...fabricData } = row;

                return {
                    ...fabricData,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === fabricData.san_vendor || v.code === fabricData.san_vendor)?.code || fabricData.san_vendor,
                    vsan: fabricData.vsan === "" ? null : fabricData.vsan
                };
            });

    // Determine API URL
    const getApiUrl = () => {
        if (projectFilter === 'current' && activeProjectId) {
            return `${API_URL}/api/san/fabrics/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=${projectFilter}`;
        } else {
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}`;
        }
    };

    // Custom toolbar buttons - match AliasTable exactly
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
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only fabrics in this project'}
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
                title={!activeProjectId ? 'Select a project to add/remove fabrics' : 'Bulk add or remove fabrics from this project'}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </button>
        </div>
    );

    // Show loading
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

    // Show message if no config
    if (!config || !customerId) {
        return <EmptyConfigMessage entityName="fabrics" />;
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure (Fabrics and Storage).
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}
                // API Configuration
                apiUrl={getApiUrl()}
                saveUrl={`${API_URL}/api/san/fabrics/`}
                deleteUrl={`${API_URL}/api/san/fabrics/delete/`}
                customerId={customerId}
                tableName="fabrics"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                customRenderers={customRenderers}
                newRowTemplate={NEW_FABRIC_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                vendorOptions={vendorOptions}

                // Custom Toolbar
                customToolbarContent={filterToggleButtons}

                // Table Settings
                height="calc(100vh - 280px)"
                storageKey={`fabric-table-${customerId || 'default'}`}
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
                    items={allCustomerFabrics.length > 0 ? allCustomerFabrics : (tableRef.current?.getTableData() || [])}
                    onSave={handleBulkFabricSave}
                    itemType="fabric"
                    projectName={config?.active_project?.name || ''}
                />
            )}
        </div>
    );
};

export default FabricTableTanStackClean;
