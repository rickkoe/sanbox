import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
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
    // Live/Draft toggle is now in the navbar

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

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.storageTableRef = tableRef;

        return () => {
            delete window.storageTableRef;
        };
    }, []);

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

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // Core storage columns (most commonly used)
    // Load columns from centralized configuration
    // _selected column is always included for consistent layout
    const columns = useMemo(() => {
        return getTableColumns('storage');
    }, []);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('storage');
    }, []);

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
    // Note: project_action is now shown via colored row borders, not a column
    const customRenderers = useMemo(() => ({
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            const storageId = rowData?.id;

            // If no ID (new unsaved row), just return plain text for editing
            if (!storageId) {
                return value || "";
            }

            // For saved rows, return a clickable link that navigates to storage details
            return {
                __isReactComponent: true,
                component: (
                    <span
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/storage/${storageId}`);
                        }}
                        style={{
                            cursor: 'pointer',
                            color: 'var(--link-text)',
                            textDecoration: 'none',
                            fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        title={`View details for ${value}`}
                    >
                        {value || "(unnamed)"}
                    </span>
                )
            };
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

    // Use ProjectViewToolbar component for table-specific actions
    // (Committed/Draft toggle, Commit, and Bulk Add/Remove are now in the navbar)
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
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
                selectCheckboxDisabled={projectFilter !== 'current'}

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
        </div>
    );
};

export default StorageTableTanStackClean;