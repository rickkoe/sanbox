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

// Clean TanStack Table implementation for Host management
// Props:
// - storageId (optional): Filter hosts to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage_system'])
const HostTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('hostTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerHosts, setAllCustomerHosts] = useState([]);
    const [totalRowCount, setTotalRowCount] = useState(0);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook
    const { apiUrl } = useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: 'hosts',
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'hostTableProjectFilter'
    });

    // Use centralized permissions hook
    const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'hosts'
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
        entityType: 'host',
        API_URL,
        totalRowCount
    });

    // Selection state and actions dropdown are now managed by useProjectViewSelection hook
    // Auto-switch and force visibility are now handled by hooks

    // Check permissions - All authenticated users have full access
    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints - hosts URL now comes from hook
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            hosts: apiUrl, // From useProjectViewAPI hook
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/hosts/`,
            deleteUrl: `${baseUrl}/hosts/`
        };
    }, [API_URL, apiUrl]);

    // All available host columns
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
            { data: "name", title: "Host Name", required: true }
        );

        // Add Project Status column (shows New/Delete/Modified/Unmodified) after Name in Project View
        if (projectFilter === 'current') {
            cols.push(projectStatusColumn);
        }

        cols.push(
            { data: "storage_system", title: "Storage System", type: "dropdown" },
            { data: "wwpns", title: "WWPNs" },
            { data: "wwpn_status", title: "WWPN Status", type: "dropdown" },
            { data: "status", title: "Status", type: "dropdown" },
            { data: "host_type", title: "Host Type", type: "dropdown" },
            { data: "aliases_count", title: "Aliases Count", type: "numeric", readOnly: true },
            { data: "vols_count", title: "Volumes Count", type: "numeric", readOnly: true },
            { data: "fc_ports_count", title: "FC Ports Count", type: "numeric", readOnly: true },
            { data: "associated_resource", title: "Associated Resource" },
            { data: "volume_group", title: "Volume Group" },
            { data: "acknowledged", title: "Acknowledged", type: "dropdown" },
            { data: "last_data_collection", title: "Last Data Collection", readOnly: true },
            { data: "natural_key", title: "Natural Key" },
            { data: "create", title: "Create", type: "checkbox" },
            { data: "imported", title: "Imported", readOnly: true },
            { data: "updated", title: "Updated", readOnly: true }
        );

        return cols;
    }, [projectFilter]);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = columns.map(col => col.title);

    // Dynamic template - pre-populate storage system if storageId is provided
    const NEW_HOST_TEMPLATE = useMemo(() => {
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
            storage_system: storageSystemName,
            wwpns: "",
            wwpn_status: "",
            status: "",
            host_type: "",
            aliases_count: 0,
            vols_count: 0,
            fc_ports_count: 0,
            associated_resource: "",
            volume_group: "",
            acknowledged: "",
            last_data_collection: null,
            natural_key: "",
            create: false,
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
                    console.log('Loading storage systems for host table...');

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
    }, [activeCustomerId]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        setProjectFilter(newFilter);
        localStorage.setItem('hostTableProjectFilter', newFilter);
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
    }, []);

    // Load all customer hosts when modal opens
    useEffect(() => {
        const loadAllCustomerHosts = async () => {
            if (showBulkModal && activeCustomerId && activeProjectId) {
                try {
                    const response = await api.get(`${API_URL}/api/storage/hosts/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`);
                    if (response.data && response.data.results) {
                        setAllCustomerHosts(response.data.results);
                    }
                } catch (error) {
                    console.error('Error loading customer hosts:', error);
                }
            }
        };
        loadAllCustomerHosts();
    }, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);

    // Handle adding host to project
    const handleAddHostToProject = useCallback(async (hostId, action = 'reference') => {
        try {
            if (!activeProjectId) return false;
            const response = await api.post(`${API_URL}/api/core/projects/${activeProjectId}/add-host/`, {
                host_id: hostId,
                action: action,
                notes: `Added via table UI with action: ${action}`
            });
            return response.data.success;
        } catch (error) {
            console.error('Error adding host to project:', error);
            return false;
        }
    }, [activeProjectId, API_URL]);

    // Handle bulk host save
    const handleBulkHostSave = useCallback(async (selectedIds) => {
        try {
            if (!allCustomerHosts || allCustomerHosts.length === 0) return;
            const currentInProject = new Set(allCustomerHosts.filter(h => h.in_active_project).map(h => h.id));
            const selectedSet = new Set(selectedIds);
            const toAdd = selectedIds.filter(id => !currentInProject.has(id));
            const toRemove = Array.from(currentInProject).filter(id => !selectedSet.has(id));

            for (const hostId of toAdd) {
                await handleAddHostToProject(hostId, 'reference');
            }
            for (const hostId of toRemove) {
                await api.delete(`${API_URL}/api/core/projects/${activeProjectId}/remove-host/${hostId}/`);
            }

            if (tableRef.current && tableRef.current.reloadData) {
                tableRef.current.reloadData();
            }
            setShowBulkModal(false);
        } catch (error) {
            console.error('Error in bulk host save:', error);
        }
    }, [allCustomerHosts, activeProjectId, API_URL, handleAddHostToProject]);

    // Dynamic dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_system: storageOptions.map(s => s.name),
        wwpn_status: ["Active", "Inactive", "Error", "Unknown"],
        status: ["Online", "Offline", "Degraded", "Unknown"],
        host_type: ["Linux", "Windows", "AIX", "VMware", "Other"],
        acknowledged: ["Yes", "No", "Pending"]
    }), [storageOptions]);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        last_data_collection: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            // Just return the value - styling will be handled by CSS
            return value || "";
        }
    }), [activeProjectId]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        let processedData = data.map(host => {
            return {
                ...host,
                // Map wwpn_display to wwpns for table display
                wwpns: host.wwpn_display || host.wwpns || '',
                saved: !!host.id,
                // Selection state - use API value or default to false
                _selected: host._selected || false
            };
        });

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(host => host.storage_system === storageSystem.name);
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

    // Note: With the new storage/hosts API, we don't need a custom save handler
    // The hosts are created/updated via Storage Insights import, not manual CRUD
    // This component is now primarily for viewing hosts from storage systems

    // Use ProjectViewToolbar component (replaces ~170 lines of duplicated code)
    const filterToggleButtons = (
        <ProjectViewToolbar
            projectFilter={projectFilter}
            onFilterChange={handleFilterChange}
            activeProjectId={activeProjectId}
            onBulkClick={() => setShowBulkModal(true)}
            ActionsDropdown={ActionsDropdown}
            entityName="hosts"
        />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="hosts" />;
    }

    // Show loading while data loads
    if (loading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading host data...</span>
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
                apiUrl={apiUrl}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                tableName="hosts"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_HOST_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                customRenderers={customRenderers}

                // Custom toolbar content - filter toggle
                customToolbarContent={filterToggleButtons}

                // Selection tracking - pass total selected count across all pages
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`host-table-${storageId || activeCustomerId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Host save successful:', result.message);
                    } else {
                        console.error('❌ Host save failed:', result.message);
                        alert('Error saving hosts: ' + result.message);
                    }
                }}
            />

            {/* Bulk Project Membership Modal */}
            <BulkProjectMembershipModal
                show={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onSave={handleBulkHostSave}
                items={allCustomerHosts}
                itemType="host"
                projectName={config?.active_project?.name || ''}
            />
        </div>
    );
};

export default HostTableTanStackClean;