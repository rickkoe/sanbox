import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusRenderer } from "../../utils/projectStatusRenderer";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Clean TanStack Table implementation for Storage management
const StorageTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state - synchronized across all tables via ProjectFilterContext
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerStorage, setAllCustomerStorage] = useState([]);
    const [totalRowCount, setTotalRowCount] = useState(0);

    // Use centralized API hook for auto-switch behavior
    // Note: Storage has a different URL pattern than other entities
    // - Customer View: /api/storage/?customer=123
    // - Project View: /api/storage/project/123/view/storages/
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '', // Not used for storage
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'storageTableProjectFilter'
    });

    // Generate the correct apiUrl for storage (different pattern than other entities)
    // Don't generate URL while projectFilter is still loading to prevent wrong initial fetch
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null; // Don't fetch until projectFilter is loaded
        }
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            return `${API_URL}/api/storage/project/${activeProjectId}/view/storages/`;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            return `${API_URL}/api/storage/project/${activeProjectId}/view/storages/?project_filter=${projectFilter}`;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            return `${API_URL}/api/storage/?customer=${activeCustomerId}`;
        } else {
            // Fallback: No customer or project selected
            return `${API_URL}/api/storage/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading]);

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'storage systems'
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
                    console.log('📥 Loading all customer storage for bulk modal...');
                    let allStorage = [];
                    let page = 1;
                    let hasMore = true;
                    const pageSize = 500;

                    while (hasMore) {
                        const response = await api.get(
                            `${API_URL}/api/storage/project/${activeProjectId}/view/storages/?project_filter=all&page_size=${pageSize}&page=${page}`
                        );
                        const storage = response.data.results || response.data;
                        allStorage = [...allStorage, ...storage];

                        hasMore = response.data.has_next;
                        page++;
                    }

                    setAllCustomerStorage(allStorage);
                    console.log(`✅ Loaded ${allStorage.length} customer storage for modal`);
                } catch (error) {
                    console.error('❌ Error loading customer storage:', error);
                    setAllCustomerStorage([]);
                }
            }
        };

        loadAllCustomerStorage();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding storage to project
    const handleAddStorageToProject = useCallback(async (storageId, action = 'unmodified') => {
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

    // API endpoints - storage URL now comes from custom apiUrl generation
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;

        return {
            storage: apiUrl,
            // saveUrl: POST to /api/storage/ for create, PUT to /api/storage/<id>/ for update
            saveUrl: `${baseUrl}/`,
            // deleteUrl: DELETE to /api/storage/<id>/
            deleteUrl: `${baseUrl}/`
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
                    const success = await handleAddStorageToProject(storageId, 'unmodified');
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

            // Show error alert only
            if (errorCount > 0) {
                alert(`Completed with errors: ${successCount} successful, ${errorCount} failed`);
            }

            // Reload table to get fresh data
            if (tableRef.current?.reloadData) {
                tableRef.current.reloadData();
            }

            console.log('✅ Bulk operation completed:', { successCount, errorCount });

        } catch (error) {
            console.error('❌ Bulk storage save error:', error);
            alert(`Error during bulk operation: ${error.message}`);
        }
    }, [allCustomerStorage, activeProjectId, API_URL, handleAddStorageToProject]);

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // Core storage columns (most commonly used)
    // Load columns from centralized configuration
    const columns = useMemo(() => {
        return getTableColumns('storage', projectFilter === 'current');
    }, [projectFilter]);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('storage', projectFilter === 'current');
    }, [projectFilter]);

    const defaultSort = getDefaultSort('storage');

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
        project_action: projectStatusRenderer,
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
            return {
                ...storage,
                saved: !!storage.id,
                // Selection state - use API value or default to false
                _selected: storage._selected || false
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

            // Add active project ID if in Project View (for creating junction table entry)
            if (projectFilter === 'current' && activeProjectId) {
                payload.active_project_id = activeProjectId;
            }

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name" && key !== "storage_type") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [activeCustomerId, projectFilter, activeProjectId]);

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
            activeProjectName={config?.active_project?.name || 'Unknown Project'}
            onBulkClick={() => setShowBulkModal(true)}
            onCommitSuccess={() => tableRef.current?.reloadData?.()}
            ActionsDropdown={ActionsDropdown}
            entityName="storage systems"
        />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="storage systems" />;
    }

    // Wait for projectFilter to load before rendering table
    // This prevents fetching with wrong filter on page refresh
    if (projectFilterLoading || !apiUrl) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {/* Banner Slot - shows Customer View or Select All banner without layout shift */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={API_ENDPOINTS.storage}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                activeProjectId={activeProjectId}
                tableName="storage"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_STORAGE_TEMPLATE}
                defaultSort={defaultSort}

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