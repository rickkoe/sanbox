import React, { useContext, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusColumn, projectStatusRenderer } from "../../utils/projectStatusRenderer";

// Clean TanStack Table implementation for Fabric management
const FabricTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const navigate = useNavigate();
    const customerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('fabricTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerFabrics, setAllCustomerFabrics] = useState([]);
    const [totalRowCount, setTotalRowCount] = useState(0);

    const tableRef = useRef(null);

    // Determine API URL based on filter (Fabrics use query parameters, not path-based URLs)
    const getApiUrl = () => {
        if (projectFilter === 'current' && activeProjectId) {
            // Project view: merged data with overrides
            return `${API_URL}/api/san/fabrics/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer view with project: includes in_active_project flag
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=${projectFilter}`;
        } else {
            // Customer view without project
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}`;
        }
    };

    const apiUrl = getApiUrl();

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'fabrics'
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
        entityType: 'fabric',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions
    // Customer View is always read-only (shows committed/deployed data)
    // Project View is where work happens (editable based on permissions)
    const isReadOnly = projectFilter !== 'current' || !canEdit;

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
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('fabricTableProjectFilter', newFilter);
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Vendor mapping
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // All possible fabric columns
    const baseColumns = (() => {
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
            { data: "san_vendor", title: "Vendor", type: "dropdown", required: true },
            { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
            { data: "switches", title: "Switches", readOnly: true },
            { data: "zoneset_name", title: "Zoneset Name" },
            { data: "vsan", title: "VSAN", type: "numeric", defaultVisible: false },
            { data: "alias_count", title: "Aliases", type: "numeric", readOnly: true },
            { data: "zone_count", title: "Zones", type: "numeric", readOnly: true },
            { data: "exists", title: "Exists", type: "checkbox" },
            { data: "notes", title: "Notes" }
        );

        return allColumns;
    })();

    // Use baseColumns directly (no more In Project or Add/Remove columns)
    const columns = baseColumns;

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
        project_action: projectStatusRenderer,
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
    const preprocessData = useCallback((data) => {
        return data.map(fabric => {
            return {
                ...fabric,
                san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor,
                switches: fabric.switches_details?.map(s => {
                    const domainStr = s.domain_id !== null && s.domain_id !== undefined ? ` (${s.domain_id})` : '';
                    return `${s.name}${domainStr}`;
                }).join(', ') || "",
                in_active_project: fabric.in_active_project || false,
                _selected: fabric._selected || false // Use API value or default to false
            };
        });
    }, [vendorOptions]);

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
                const { alias_count, zone_count, switches, in_active_project, project_actions, modified_fields, project_action, ...fabricData} = row;

                return {
                    ...fabricData,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === fabricData.san_vendor || v.code === fabricData.san_vendor)?.code || fabricData.san_vendor,
                    vsan: fabricData.vsan === "" ? null : fabricData.vsan
                };
            });

    // Custom save handler to automatically add new fabrics to project when in Project View
    const handleFabricSave = async (allTableData, hasChanges, deletedRows = []) => {
        if (!hasChanges) {
            return { success: true, message: 'No changes to save' };
        }

        try {
            // Handle deletions first
            if (deletedRows && deletedRows.length > 0) {
                for (const fabricId of deletedRows) {
                    try {
                        await api.delete(`${API_URL}/api/san/fabrics/delete/${fabricId}/`);
                    } catch (error) {
                        console.error(`Failed to delete fabric ${fabricId}:`, error);
                        if (error.response?.status === 403) {
                            return {
                                success: false,
                                message: error.response?.data?.error || 'You do not have permission to delete fabrics.'
                            };
                        }
                        return {
                            success: false,
                            message: `Failed to delete fabric: ${error.response?.data?.error || error.message}`
                        };
                    }
                }
            }

            // Build payload for saving fabrics
            const payload = saveTransform(allTableData)
                .filter(fabric => fabric.id || (fabric.name && fabric.name.trim() !== ""));

            // Use the new bulk save endpoint with field override support
            if (payload.length > 0) {
                await api.post(`${API_URL}/api/san/fabrics/save/`, {
                    project_id: activeProjectId,
                    fabrics: payload,
                });
            }

            const totalOperations = payload.length + (deletedRows ? deletedRows.length : 0);
            const operations = [];
            if (payload.length > 0) operations.push(`saved ${payload.length} fabric(s)`);
            if (deletedRows && deletedRows.length > 0) operations.push(`deleted ${deletedRows.length} fabric(s)`);

            const message = operations.length > 0
                ? `Successfully ${operations.join(' and ')}`
                : 'No changes to save';

            return { success: true, message };

        } catch (error) {
            console.error('❌ Fabric save error:', error);
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: error.response?.data?.error || 'You do not have permission to modify fabrics.'
                };
            }
            return {
                success: false,
                message: `Error saving fabrics: ${error.response?.data?.error || error.message}`
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

    // Use ProjectViewToolbar component (replaces ~170 lines of duplicated code)
    const filterToggleButtons = (
        <ProjectViewToolbar
            projectFilter={projectFilter}
            onFilterChange={handleFilterChange}
            activeProjectId={activeProjectId}
            onBulkClick={() => setShowBulkModal(true)}
            ActionsDropdown={ActionsDropdown}
            entityName="fabrics"
        />
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
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}
                // API Configuration
                apiUrl={apiUrl}
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

                // Custom save handler - auto-add to project in Project View
                customSaveHandler={handleFabricSave}

                // Custom Toolbar
                customToolbarContent={filterToggleButtons}

                // Table Settings
                height="calc(100vh - 280px)"
                storageKey={`fabric-table-${customerId || 'default'}`}
                readOnly={isReadOnly}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

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
