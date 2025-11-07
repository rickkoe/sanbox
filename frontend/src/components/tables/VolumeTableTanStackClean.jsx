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

// Clean TanStack Table implementation for Volume management
// Props:
// - storageId (optional): Filter volumes to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage'])
const VolumeTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('volumeTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerVolumes, setAllCustomerVolumes] = useState([]);
    const [totalRowCount, setTotalRowCount] = useState(0);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook
    const { apiUrl } = useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: 'volumes',
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'volumeTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'volumes'
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
        entityType: 'volume',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - volumes URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            volumes: apiUrl, // From useProjectViewAPI hook
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/volumes/`,
            deleteUrl: `${baseUrl}/volumes/`
        };
    }, [API_URL, apiUrl]);

    // Helper function to format bytes to human-readable format
    const formatBytes = useCallback((bytes) => {
        if (!bytes && bytes !== 0) return "";
        const tb = bytes / (1024 ** 4);
        const gb = bytes / (1024 ** 3);
        if (tb >= 1) {
            return `${tb.toFixed(2)} TB`;
        } else if (gb >= 1) {
            return `${gb.toFixed(2)} GB`;
        } else {
            return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
        }
    }, []);

    // All available volume columns
    const allColumns = useMemo(() => {
        const cols = [];

        // Add selection checkbox column only in Project View
        if (projectFilter === 'current') {
            cols.push({
                data: "_selected",
                title: "Select",
                type: "checkbox",
                readOnly: false,
                width: 60,
                defaultVisible: true,
                accessorKey: "_selected"
            });
        }

        cols.push(
        { data: "name", title: "Volume Name", required: true, width: 200 }
        );

        // Add Project Status column (shows New/Delete/Modified/Unmodified) after Name in Project View
        if (projectFilter === 'current') {
            cols.push(projectStatusColumn);
        }

        cols.push(
        { data: "storage", title: "Storage System", type: "dropdown", required: true, width: 180 },
        { data: "volume_id", title: "Volume ID", width: 120 },
        { data: "volume_number", title: "Volume Number", type: "numeric", width: 120 },
        { data: "volser", title: "Volser", width: 100 },
        { data: "format", title: "Format", width: 100 },
        { data: "capacity_bytes", title: "Capacity", type: "numeric", readOnly: true, width: 120 },
        { data: "used_capacity_bytes", title: "Used Capacity", type: "numeric", readOnly: true, width: 130 },
        { data: "used_capacity_percent", title: "Used %", type: "numeric", readOnly: true, width: 100 },
        { data: "available_capacity_bytes", title: "Available", type: "numeric", readOnly: true, width: 120 },
        { data: "written_capacity_bytes", title: "Written", type: "numeric", readOnly: true, width: 120 },
        { data: "written_capacity_percent", title: "Written %", type: "numeric", readOnly: true, width: 100 },
        { data: "pool_name", title: "Pool Name", width: 150 },
        { data: "pool_id", title: "Pool ID", width: 100 },
        { data: "lss_lcu", title: "LSS/LCU", width: 100 },
        { data: "node", title: "Node", width: 100 },
        { data: "block_size", title: "Block Size", type: "numeric", width: 100 },
        { data: "thin_provisioned", title: "Thin Provisioned", width: 130 },
        { data: "compressed", title: "Compressed", type: "checkbox", width: 110 },
        { data: "compression_saving_percent", title: "Compression %", type: "numeric", readOnly: true, width: 130 },
        { data: "encryption", title: "Encryption", width: 100 },
        { data: "flashcopy", title: "FlashCopy", width: 100 },
        { data: "auto_expand", title: "Auto Expand", type: "checkbox", width: 110 },
        { data: "easy_tier", title: "Easy Tier", width: 120 },
        { data: "easy_tier_status", title: "Easy Tier Status", width: 140 },
        { data: "safeguarded", title: "Safeguarded", width: 120 },
        { data: "raid_level", title: "RAID Level", width: 110 },
        { data: "io_group", title: "I/O Group", width: 100 },
        { data: "status_label", title: "Status", width: 100 },
        { data: "acknowledged", title: "Acknowledged", type: "checkbox", width: 120 },
        { data: "unique_id", title: "Unique ID", readOnly: true, width: 200 },
        { data: "natural_key", title: "Natural Key", width: 150 },
        { data: "imported", title: "Imported", readOnly: true, width: 150 },
        { data: "updated", title: "Updated", readOnly: true, width: 150 }
        );

        return cols;
    }, [projectFilter]);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

    // Dynamic template - pre-populate storage if storageId is provided
    const NEW_VOLUME_TEMPLATE = useMemo(() => {
        let storageSystemName = "";
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                storageSystemName = storageSystem.name;
            }
        }

        return {
            id: null,
            name: "",
            _selected: false, // Selection checkbox state
            storage: storageSystemName,
            volume_id: "",
            volume_number: null,
            volser: "",
            format: "",
            capacity_bytes: null,
            used_capacity_bytes: null,
            used_capacity_percent: null,
            available_capacity_bytes: null,
            written_capacity_bytes: null,
            written_capacity_percent: null,
            pool_name: "",
            pool_id: "",
            lss_lcu: "",
            node: "",
            block_size: null,
            thin_provisioned: "",
            compressed: false,
            compression_saving_percent: null,
            encryption: "",
            flashcopy: "",
            auto_expand: false,
            easy_tier: "",
            easy_tier_status: "",
            safeguarded: "",
            raid_level: "",
            io_group: "",
            status_label: "",
            acknowledged: false,
            unique_id: "",
            natural_key: "",
            imported: null,
            updated: null
        };
    }, [storageId, storageOptions]);

    // Load storage systems for dropdown
    useEffect(() => {
        const loadStorageSystems = async () => {
            if (activeCustomerId) {
                try {
                    setLoading(true);
                    console.log('Loading storage systems for volume table...');

                    const response = await axios.get(`${API_ENDPOINTS.storage}?customer=${activeCustomerId}`);
                    const storageArray = response.data.results || response.data;
                    setStorageOptions(storageArray.map(s => ({ id: s.id, name: s.name })));

                    console.log('✅ Storage systems loaded successfully');
                    setLoading(false);
                } catch (error) {
                    console.error('❌ Error loading storage systems:', error);
                    setLoading(false);
                }
            }
        };

        loadStorageSystems();
    }, [activeCustomerId, API_ENDPOINTS.storage]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('volumeTableProjectFilter', newFilter);
        if (tableRef.current && tableRef.current.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Load all customer volumes when modal opens
    useEffect(() => {
        const loadAllCustomerVolumes = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    const response = await api.get(`${API_URL}/api/storage/volumes/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerVolumes(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer volumes:', error);
                }
            }
        };
        loadAllCustomerVolumes();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding volume to project
    const handleAddVolumeToProject = useCallback(async (volumeId, action = 'reference') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-volume/`, {
                volume_id: volumeId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding volume to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Handle bulk volume save
    const handleBulkVolumeSave = useCallback(async (selectedIds) => {
        try {
            if (!allCustomerVolumes || allCustomerVolumes.length === 0) return;
            const currentInProject = new Set(allCustomerVolumes.filter(v => v.in_active_project).map(v => v.id));
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            for (const volumeId of toAdd) {
                await handleAddVolumeToProject(volumeId, 'reference');
            }
            for (const volumeId of toRemove) {
                await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-volume/${volumeId}/`);
            }

            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }
            setShowBulkModal(false);
        } catch (error) {
            console.error('Error in bulk volume save:', error);
        }
    }, [allCustomerVolumes, activeProjectId, API_URL, handleAddVolumeToProject]);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage: storageOptions.map(s => s.name)
    }), [storageOptions]);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        used_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        available_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        written_capacity_bytes: (rowData, td, row, col, prop, value) => {
            return formatBytes(value);
        },
        used_capacity_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        written_capacity_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        compression_saving_percent: (rowData, td, row, col, prop, value) => {
            return value != null ? `${value.toFixed(2)}%` : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        }
    }), [formatBytes, activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(volume => {
            // Get storage name from ID
            const storageObj = storageOptions.find(s => s.id === volume.storage);
            const storageName = storageObj ? storageObj.name : '';

            return {
                ...volume,
                storage_id: volume.storage, // Keep original ID
                storage: storageName, // Display name
                saved: !!volume.id,
                // Selection state - use API value or default to false
                _selected: volume._selected || false
            };
        });

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(volume => volume.storage === storageSystem.name);
            }
        }

        return processedData;
    }, [storageId, storageOptions]);

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

    // Transform data for saving - convert labels back to IDs
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Convert storage name back to ID
            if (payload.storage_id) {
                payload.storage = payload.storage_id;
                delete payload.storage_id;
            } else if (payload.storage && typeof payload.storage === 'string') {
                const storage = storageOptions.find(s => s.name === payload.storage);
                payload.storage = storage ? storage.id : null;
            }

            // Handle boolean fields
            if (typeof payload.compressed === 'string') {
                payload.compressed = payload.compressed.toLowerCase() === 'true';
            }
            if (typeof payload.auto_expand === 'string') {
                payload.auto_expand = payload.auto_expand.toLowerCase() === 'true';
            }
            if (typeof payload.acknowledged === 'string') {
                payload.acknowledged = payload.acknowledged.toLowerCase() === 'true';
            }

            // Ensure required fields are present
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Volume";
            }

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [storageOptions]);

    // Use ProjectViewToolbar component (replaces ~170 lines of duplicated code)
    const filterToggleButtons = (
        <ProjectViewToolbar
            projectFilter={projectFilter}
            onFilterChange={handleFilterChange}
            activeProjectId={activeProjectId}
            onBulkClick={() => setShowBulkModal(true)}
            ActionsDropdown={ActionsDropdown}
            entityName="volumes"
        />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="volumes" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading volume data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {/* Customer View Banner - shown in Customer View (read-only mode) */}
            <CustomerViewBanner />

            {/* Select All Banner - shown in Project View when all page items selected */}
            <SelectAllBanner />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={
                    projectFilter === 'current' && activeProjectId
                        ? (storageId ? `${API_ENDPOINTS.volumes}?storage_id=${storageId}` : API_ENDPOINTS.volumes)
                        : (storageId ? `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}&storage_id=${storageId}` : `${API_ENDPOINTS.volumes}?customer=${activeCustomerId}`)
                }
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="volumes"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_VOLUME_TEMPLATE}

                // Dropdown Configuration
                dropdownSources={dropdownSources}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // Custom Renderers
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 250px)"
                stretchH="all"
                autoColumnSize={true}
                manualColumnResize={true}
                storageKey={`volumes-table-${activeCustomerId || 'default'}-${projectFilter}`}

                // Feature Flags
                enableFilters={true}
                enableExport={true}
                enablePagination={true}
                defaultPageSize={50}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkVolumeSave}
                items={allCustomerVolumes}
                itemType="volume"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default VolumeTableTanStackClean;
