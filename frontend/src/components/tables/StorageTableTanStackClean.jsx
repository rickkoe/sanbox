import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Storage management
const StorageTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Project filter state ('all' = Customer View, 'current' = Project View)
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('storageTableProjectFilter') || 'all'
    );

    const [showBulkModal, setShowBulkModal] = useState(false); // Bulk add/remove modal
    const [allCustomerStorage, setAllCustomerStorage] = useState([]); // All customer storage for bulk modal

    // Auto-switch to Customer View when no project is selected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            console.log('No active project - switching to Customer View');
            setProjectFilter('all');
            localStorage.setItem('storageTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

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
                    // Fetch all customer storage with project membership info
                    const response = await api.get(`${API_URL}/api/storage/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerStorage(response.data.results);
                        console.log(`✅ Loaded ${response.data.results.length} storage systems for bulk modal`);
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
                return;
            }

            console.log(`📤 Adding storage ${storageId} to project ${projectId} with action: ${action}`);
            const response = await api.post(`${API_URL}/api/core/projects/${projectId}/add-storage/`, {
                storage_id: storageId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });

            console.log('📥 Response from add-storage:', response.data);
            if (response.data.success) {
                console.log('✅ Storage added to project with action:', action);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error adding storage to project:', error);
            alert(`Failed to add storage: ${error.response?.data?.error || error.message}`);
            return false;
        }
    }, [activeProjectId, API_URL]);

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

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(activeCustomerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // API endpoints - dynamically determined based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;

        // Use different endpoint based on filter mode and project availability
        let storageUrl;
        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Use merged data endpoint (only project entities with overrides applied)
            storageUrl = `${baseUrl}/project/${activeProjectId}/view/storages/`;
        } else {
            // Customer View: Use regular endpoint
            storageUrl = `${baseUrl}/?customer=${activeCustomerId}`;
        }

        return {
            storage: storageUrl,
            saveUrl: `${baseUrl}/`,
            deleteUrl: `${baseUrl}/`
        };
    }, [API_URL, activeProjectId, activeCustomerId, projectFilter]);

    // Core storage columns (most commonly used)
    const columns = [
        { data: "id", title: "Details", type: "custom", readOnly: true },
        { data: "name", title: "Name", required: true },
        { data: "storage_type", title: "Type", type: "dropdown" },
        { data: "location", title: "Location" },
        { data: "storage_system_id", title: "Storage System ID", defaultVisible: false },
        { data: "machine_type", title: "Machine Type" },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number", defaultVisible: false },
        { data: "db_volumes_count", title: "DB Volumes", type: "numeric", readOnly: true },
        { data: "db_hosts_count", title: "DB Hosts", type: "numeric", readOnly: true },
        { data: "db_aliases_count", title: "DB Aliases", type: "numeric", readOnly: true },
        { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
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
    ];

    const colHeaders = columns.map(col => col.title);

    const NEW_STORAGE_TEMPLATE = {
        id: null,
        name: "",
        storage_type: "",
        location: "",
        storage_system_id: "",
        machine_type: "",
        model: "",
        serial_number: "",
        db_volumes_count: 0,
        db_hosts_count: 0,
        db_aliases_count: 0,
        project_memberships: [],
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
    };

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
        project_memberships: (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
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
        return data.map(storage => ({
            ...storage,
            saved: !!storage.id
        }));
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

    // Project filter toggle buttons for toolbar
    const filterToggleButtons = (
        <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
            {/* Customer View Button */}
            <button
                type="button"
                className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{
                    borderRadius: '6px 0 0 6px',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
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
                    borderRadius: '0',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
                    minWidth: '140px'
                }}
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only storage systems in this project'}
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
                    borderRadius: '0',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '6px 16px',
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
                title={!activeProjectId ? 'Select a project to add/remove storage' : 'Bulk add or remove storage from this project'}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Checklist icon */}
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </button>
        </div>
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="storage systems" />;
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