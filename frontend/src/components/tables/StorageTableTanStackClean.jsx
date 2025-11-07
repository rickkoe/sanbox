import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
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
import { projectStatusColumn } from "../../utils/projectStatusRenderer";

// Clean TanStack Table implementation for Storage management
const StorageTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state ('all' = Customer View, 'current' = Project View)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('storageTableProjectFilter') || 'all'
    );

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerStorage, setAllCustomerStorage] = useState([]);
    const [totalRowCount, setTotalRowCount] = useState(0);

    // Use centralized API hook
    const { apiUrl } = useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: 'storage',
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'storageTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'storage systems'
    });

    // Use centralized selection hook
    const {
        selectedRows,
        selectedRowsRef,
        handleSelectAllPages,
        handleClearSelection,
        handleMarkForDeletion,
        SelectAllBanner,
        ActionsDropdown
    } = useProjectViewSelection({
        tableRef,
        projectFilter,
        activeProjectId,
        apiUrl,
        entityType: 'storage',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('storageTableProjectFilter', newFilter);
        // Reload table data with new filter
        if (tableRef.current && tableRef.current.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Load all customer storage when modal opens
    useEffect(() => {
        const loadAllCustomerStorage = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    // Fetch all customer storage with project membership info
                    const response = await api.get(`${API_URL}/api/storage/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerStorage(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer storage:', error);
                }
            }
        };

        loadAllCustomerStorage();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding storage to project
    const handleAddStorageToProject = useCallback(async (storageId, action = 'reference') => {
        try {
            const projectId = activeProjectId;
            if (!projectId) {
                console.error('No active project selected');
                return false;
            }

            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-storage/`, {
                storage_id: storageId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });

            if (response.data.success) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding storage to project:', error);
            alert(`Failed to add storage: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // API endpoints - storage URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;

        return {
            storage: apiUrl, // From useProjectViewAPI hook
            storageSave: `${baseUrl}/save/`,
            storageDelete: `${baseUrl}/delete/`
        };
    }, [API_URL, apiUrl]);

    // Handle bulk storage save
    const handleBulkStorageSave = useCallback(async (selectedIds) => {
        try {
            console.log('🔄 Bulk storage save started with selected IDs:', selectedIds);

            if (!allCustomerStorage || allCustomerStorage.length === 0) {
                console.error('No customer storage available');
                return;
            }

            // Get current storage in project
            const currentInProject = new Set(
                allCustomerStorage
                    .filter(storage => storage.in_active_project)
                    .map(storage => storage.id)
            );

            // Determine adds and removes
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            console.log('📊 Bulk operation:', { toAdd: toAdd.length, toRemove: toRemove.length });

            let successCount = 0;
            let errorCount = 0;

            // Process additions
            for (const storageId of toAdd) {
                try {
                    const success = await handleAddStorageToProject(storageId, 'reference');
                    if (success) successCount++;
                    else errorCount++;
                } catch (error) {
                    console.error(`Failed to add storage ${storageId}:`, error);
                    errorCount++;
                }
            }

            // Process removals
            for (const storageId of toRemove) {
                try {
                    const response = await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-storage/${storageId}/`);
                    if (response.data.success) {
                        successCount++;
                        console.log(`✅ Removed storage ${storageId} from project`);
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Failed to remove storage ${storageId}:`, error);
                    errorCount++;
                }
            }

            console.log(`✅ Bulk operation complete: ${successCount} successful, ${errorCount} errors`);

            // Reload table data
            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }

            // Close modal
            setShowBulkModal(false);

            // Show summary
            if (errorCount > 0) {
                alert(`Bulk operation completed with errors:\n${successCount} successful\n${errorCount} failed`);
            }
        } catch (error) {
            console.error('❌ Error in bulk storage save:', error);
            alert(`Bulk operation failed: ${error.message}`);
        }
    }, [allCustomerStorage, activeProjectId, API_URL, handleAddStorageToProject]);

    // Check permissions - All authenticated users have full access
    const isReadOnly = projectFilter === 'current' ? !canEdit : false;

    // Core storage columns (most commonly used)
    const columns = useMemo(() => {
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
        { data: "id", title: "Details", type: "custom", readOnly: true },
        { data: "storage_type", title: "Type", type: "dropdown" },
        { data: "location", title: "Location" },
        { data: "storage_system_id", title: "Storage System ID", defaultVisible: false },
        { data: "machine_type", title: "Machine Type" },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number", defaultVisible: false },
        { data: "db_volumes_count", title: "DB Volumes", type: "numeric", readOnly: true },
        { data: "db_hosts_count", title: "DB Hosts", type: "numeric", readOnly: true },
        { data: "db_aliases_count", title: "DB Aliases", type: "numeric", readOnly: true },
        { data: "system_id", title: "System ID", defaultVisible: false },
        { data: "wwnn", title: "WWNN", defaultVisible: false },
        { data: "firmware_level", title: "Firmware Level", defaultVisible: false },
        { data: "primary_ip", title: "Primary IP", defaultVisible: false },
        { data: "secondary_ip", title: "Secondary IP", defaultVisible: false },
        { data: "vendor", title: "Vendor" },
        { data: "condition", title: "Condition" },
        { data: "probe_status", title: "Probe Status", defaultVisible: false },
        { data: "capacity_bytes", title: "Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "used_capacity_bytes", title: "Used Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "available_capacity_bytes", title: "Available Capacity (Bytes)", type: "numeric", defaultVisible: false },
        { data: "volumes_count", title: "SI Volumes Count", type: "numeric", defaultVisible: false },
        { data: "pools_count", title: "Pools Count", type: "numeric", defaultVisible: false },
        { data: "disks_count", title: "Disks Count", type: "numeric", defaultVisible: false },
        { data: "fc_ports_count", title: "FC Ports Count", type: "numeric", defaultVisible: false },
        { data: "notes", title: "Notes" },
        { data: "imported", title: "Imported", readOnly: true, defaultVisible: false },
        { data: "updated", title: "Updated", readOnly: true, defaultVisible: false }
        );

        return allColumns;
    }, [projectFilter]);

    const colHeaders = columns.map(col => col.title);

    const NEW_STORAGE_TEMPLATE = useMemo(() => ({
        id: null,
        name: "",
        _selected: false, // Selection checkbox state
        storage_type: "",
        location: "",
        storage_system_id: "",
        machine_type: "",
        model: "",
        serial_number: "",
        db_volumes_count: 0,
        db_hosts_count: 0,
        db_aliases_count: 0,
        system_id: "",
        wwnn: "",
        firmware_level: "",
        primary_ip: "",
        secondary_ip: "",
        vendor: "",
        condition: "",
        probe_status: "",
        capacity_bytes: null,
        used_capacity_bytes: null,
        available_capacity_bytes: null,
        volumes_count: 0,
        pools_count: 0,
        disks_count: 0,
        fc_ports_count: 0,
        notes: "",
        imported: null,
        updated: null
    }), []);

    // Dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_type: ["FlashSystem", "DS8000", "Switch", "Data Domain"]
    }), []);

    // Custom renderers for special columns
    const customRenderers = useMemo(() => ({
        id: (rowData, td, row, col, prop, value) => {
            console.log('📋 Details renderer called with:', { rowData, value, hasId: !!rowData?.id });

            // Check both rowData.id and the actual value parameter
            const storageId = rowData?.id || value;

            if (!storageId) {
                console.log('📋 No storage ID found, rendering empty cell');
                return { __isReactComponent: true, component: null };
            }

            console.log('📋 Rendering Details button for storage ID:', storageId);
            return {
                __isReactComponent: true,
                component: (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔗 Button clicked! Navigating to:', `/storage/${storageId}`);
                            navigate(`/storage/${storageId}`);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        Details
                    </button>
                )
            };
        },
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            // Just return the value - styling will be handled by CSS
            return value || "";
        }
    }), [navigate, activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(storage => {
            // Check if this row should be selected (either from data or from selectedRowsRef)
            const shouldBeSelected = storage._selected !== undefined
                ? storage._selected
                : (storage.id && selectedRowsRef.current.has(storage.id));

            return {
                ...storage,
                saved: !!storage.id,
                // Selection state - check if ID is in selectedRowsRef
                _selected: shouldBeSelected
            };
        });
    }, []);

    // Transform data for saving
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Ensure required fields are present and non-empty
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Storage";
            }

            if (!payload.storage_type || payload.storage_type.trim() === "") {
                payload.storage_type = "DS8000";
            }

            // Add the customer ID from the context
            payload.customer = activeCustomerId;

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name" && key !== "storage_type") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [activeCustomerId]);

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
            entityName="storage systems"
        />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="storage systems" />;
    }

    return (
        <div className="modern-table-container">
            {/* Select All Banner from hook */}
            <SelectAllBanner />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={API_ENDPOINTS.storage}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="storage"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_STORAGE_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`storage-table-${activeCustomerId || 'default'}-${projectFilter}`}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Storage save successful:', result.message);
                    } else {
                        console.error('❌ Storage save failed:', result.message);
                        alert('Error saving storage systems: ' + result.message);
                    }
                }}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkStorageSave}
                items={allCustomerStorage}
                itemType="storage"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default StorageTableTanStackClean;