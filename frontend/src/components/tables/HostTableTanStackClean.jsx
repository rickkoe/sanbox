import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import BulkProjectMembershipModal from "../modals/BulkProjectMembershipModal";
import api from "../../api";

// Clean TanStack Table implementation for Host management
// Props:
// - storageId (optional): Filter hosts to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide (e.g., ['storage_system'])
const HostTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { user, getUserRole } = useAuth();
    const navigate = useNavigate();

    const tableRef = useRef(null);

    const [storageOptions, setStorageOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState(
        localStorage.getItem('hostTableProjectFilter') || 'all'
    );
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [allCustomerHosts, setAllCustomerHosts] = useState([]);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Check permissions for modifying customer data
    const userRole = getUserRole(activeCustomerId);

    // Determine if user can modify customer infrastructure
    const isViewer = userRole === 'viewer';
    const isAdmin = userRole === 'admin';
    const isMember = userRole === 'member';

    const canModifyInfrastructure = !isViewer && (isMember || isAdmin);
    const isReadOnly = !canModifyInfrastructure;

    // API endpoints - dynamically determined based on filter mode
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        let hostsUrl;
        if (projectFilter === 'current' && activeProjectId) {
            hostsUrl = `${baseUrl}/project/${activeProjectId}/view/hosts/`;
            console.log('🔧 HostTable - Building Project View endpoint:', hostsUrl);
        } else {
            hostsUrl = `${baseUrl}/hosts/`;
            console.log('🔧 HostTable - Building Customer View endpoint:', hostsUrl);
        }
        console.log('🔧 HostTable - API_ENDPOINTS updated. projectFilter:', projectFilter, 'activeProjectId:', activeProjectId);
        return {
            hosts: hostsUrl,
            storage: `${baseUrl}/`,
            saveUrl: `${baseUrl}/hosts/`,
            deleteUrl: `${baseUrl}/hosts/`
        };
    }, [API_URL, activeProjectId, projectFilter]);

    // All available host columns
    const allColumns = [
        { data: "name", title: "Host Name", required: true },
        { data: "storage_system", title: "Storage System", type: "dropdown" },
        { data: "project_memberships", title: "Projects", type: "custom", readOnly: true, defaultVisible: true },
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
    ];

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

    // Auto-switch to Customer View when no project is selected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            setProjectFilter('all');
            localStorage.setItem('hostTableProjectFilter', 'all');
        }
    }, [activeProjectId, projectFilter]);

    // Handle filter toggle change
    const handleFilterChange = useCallback((newFilter) => {
        console.log('🔄 HostTable - Filter changing from', projectFilter, 'to', newFilter);
        setProjectFilter(newFilter);
        localStorage.setItem('hostTableProjectFilter', newFilter);
        // Delay reload to ensure state has updated
        setTimeout(() => {
            if (tableRef.current && tableRef.current.reloadData) {
                console.log('🔄 HostTable - Calling reloadData()');
                tableRef.current.reloadData();
            }
        }, 100);
    }, [projectFilter]);

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
        project_memberships: (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
            try {
                if (!value || !Array.isArray(value) || value.length === 0) {
                    return '';
                }
                const badges = value.map(pm => {
                    if (!pm || typeof pm !== 'object') return '';
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
        let processedData = data.map(host => ({
            ...host,
            // Map wwpn_display to wwpns for table display
            wwpns: host.wwpn_display || host.wwpns || '',
            saved: !!host.id
        }));

        // Filter by storage system if storageId is provided
        if (storageId) {
            const storageSystem = storageOptions.find(s => s.id === storageId);
            if (storageSystem) {
                processedData = processedData.filter(host => host.storage_system === storageSystem.name);
            }
        }

        return processedData;
    }, [storageId, storageOptions]);

    // Build API URL with customer filter and optional storage filter
    const apiUrl = useMemo(() => {
        // Project view endpoint doesn't need customer param (gets it from project)
        // Customer view endpoint needs customer param
        if (projectFilter === 'current' && activeProjectId) {
            // Project view - no customer param needed
            const url = storageId ? `${API_ENDPOINTS.hosts}?storage_id=${storageId}` : API_ENDPOINTS.hosts;
            console.log('🔍 HostTable - Project View URL:', url, 'projectId:', activeProjectId);
            return url;
        } else {
            // Customer view - add customer param
            let url = `${API_ENDPOINTS.hosts}?customer=${activeCustomerId}`;
            if (storageId) {
                url += `&storage_id=${storageId}`;
            }
            console.log('🔍 HostTable - Customer View URL:', url, 'customerId:', activeCustomerId);
            return url;
        }
    }, [projectFilter, activeProjectId, API_ENDPOINTS.hosts, storageId, activeCustomerId]);

    // Note: With the new storage/hosts API, we don't need a custom save handler
    // The hosts are created/updated via Storage Insights import, not manual CRUD
    // This component is now primarily for viewing hosts from storage systems

    // Project filter toggle buttons for toolbar
    const filterToggleButtons = (
        <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
            <button type="button" className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('all')}
                style={{ borderRadius: '6px 0 0 6px', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', marginRight: '0', minWidth: '140px' }}>
                Customer View
            </button>
            <button type="button" className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => handleFilterChange('current')} disabled={!activeProjectId}
                style={{ borderRadius: '0', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '140px' }}
                title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only hosts in this project'}>
                Project View
            </button>
            <button type="button" className="btn btn-outline-secondary"
                onClick={() => navigate('/settings/project')} disabled={!activeProjectId}
                style={{ borderRadius: '0', fontWeight: '500', fontSize: '14px', padding: '6px 16px', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '140px' }}
                title={!activeProjectId ? 'Select a project to manage' : 'Manage active project'}>
                Manage Project
            </button>
            <button type="button" className="btn btn-outline-secondary"
                onClick={() => setShowBulkModal(true)} disabled={!activeProjectId}
                style={{ padding: '10px 18px', fontSize: '14px', fontWeight: '500', borderRadius: '0 6px 6px 0', transition: 'all 0.2s ease', opacity: activeProjectId ? 1 : 0.5, cursor: activeProjectId ? 'pointer' : 'not-allowed', minWidth: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                title={!activeProjectId ? 'Select a project to add/remove hosts' : 'Bulk add or remove hosts from this project'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
            </button>
        </div>
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

    // Generate read-only message based on user role
    const getReadOnlyMessage = () => {
        if (isViewer) {
            return "You have viewer permissions for this customer. Only members and admins can modify infrastructure.";
        }
        return "";
    };

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> {getReadOnlyMessage()}
                </div>
            )}
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