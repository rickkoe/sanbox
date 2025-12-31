import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { Modal, Button, Form } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// IBM i LPAR table - manages LPARs for even volume distribution
// Props:
// - storageId (required): Filter LPARs to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide
const IBMiLPARTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);

    const tableRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [availableHosts, setAvailableHosts] = useState([]);
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

    // Modal state for editing hosts
    const [showHostsModal, setShowHostsModal] = useState(false);
    const [editingLPAR, setEditingLPAR] = useState(null);
    const [selectedHostIds, setSelectedHostIds] = useState([]);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized API hook for auto-switch behavior
    useProjectViewAPI({
        projectFilter,
        setProjectFilter,
        activeProjectId,
        activeCustomerId,
        entityType: '',
        baseUrl: `${API_URL}/api/storage`,
        localStorageKey: 'ibmiLPARTableProjectFilter'
    });

    // Generate the correct apiUrl for IBM i LPARs
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null;
        }

        const storageFilter = storageId ? `storage_id=${storageId}` : '';

        if (projectFilter === 'current' && activeProjectId) {
            const baseUrl = `${API_URL}/api/storage/project/${activeProjectId}/view/ibmi-lpars/`;
            return storageFilter ? `${baseUrl}?${storageFilter}` : baseUrl;
        } else if (activeProjectId) {
            const baseUrl = `${API_URL}/api/storage/${storageId}/ibmi-lpars/?project_id=${activeProjectId}`;
            return baseUrl;
        } else if (activeCustomerId && storageId) {
            return `${API_URL}/api/storage/${storageId}/ibmi-lpars/`;
        } else {
            return `${API_URL}/api/storage/ibmi-lpars/`;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading, storageId]);

    // Use centralized permissions hook
    const { canEdit, canDelete } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'IBM i LPARs'
    });

    // Use centralized selection hook
    const {
        selectedRows,
        handleClearSelection,
        handleMarkForDeletion,
        BannerSlot,
        ActionsDropdown
    } = useProjectViewSelection({
        tableRef,
        projectFilter,
        activeProjectId,
        apiUrl,
        entityType: 'ibmilpar',
        API_URL,
        totalRowCount
    });

    // Customer View is always read-only; Project View depends on permissions
    const isReadOnly = projectFilter !== 'current' || !canEdit;

    // API endpoints
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            lpars: apiUrl,
            hosts: `${baseUrl}/hosts/`,
            saveUrl: `${baseUrl}/ibmi-lpars/`,
            deleteUrl: `${baseUrl}/ibmi-lpars/`
        };
    }, [API_URL, apiUrl]);

    // Load available hosts for this storage system
    useEffect(() => {
        const loadHosts = async () => {
            if (storageId && activeCustomerId) {
                try {
                    setLoading(true);
                    const response = await axios.get(
                        `${API_ENDPOINTS.hosts}?storage_id=${storageId}&customer=${activeCustomerId}`
                    );
                    const hostsArray = response.data.results || response.data;
                    setAvailableHosts(hostsArray.map(h => ({ id: h.id, name: h.name })));
                    setLoading(false);
                } catch (error) {
                    console.error('Error loading hosts:', error);
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        loadHosts();
    }, [storageId, activeCustomerId, API_ENDPOINTS.hosts]);

    // Transform data for saving
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;
            delete payload.hosts_display;
            delete payload.hosts_details;
            delete payload.storage_name;

            // Add storage ID
            if (storageId) {
                payload.storage = storageId;
            }

            // Add active project ID if in Project View
            if (projectFilter === 'current' && activeProjectId) {
                payload.active_project_id = activeProjectId;
            }

            return payload;
        });
    }, [projectFilter, activeProjectId, storageId]);

    // Load columns from centralized configuration
    const allColumns = useMemo(() => {
        return getTableColumns('ibmilpar');
    }, []);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('ibmilpar');

    // New row template
    const NEW_LPAR_TEMPLATE = useMemo(() => {
        return {
            id: null,
            name: "",
            _selected: false,
            storage_name: "",
            host_count: 0,
            volume_count: 0,
            hosts_display: "",
            hosts: [],
            notes: "",
            committed: false,
            deployed: false
        };
    }, []);

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.ibmiLPARTableRef = tableRef;

        return () => {
            delete window.ibmiLPARTableRef;
        };
    }, []);

    // Handle opening the hosts edit modal
    const handleEditHosts = useCallback((lpar) => {
        setEditingLPAR(lpar);
        setSelectedHostIds(lpar.hosts || []);
        setShowHostsModal(true);
    }, []);

    // Handle saving hosts selection
    const handleSaveHosts = useCallback(async () => {
        if (!editingLPAR) return;

        try {
            await axios.put(`${API_ENDPOINTS.saveUrl}${editingLPAR.id}/`, {
                hosts: selectedHostIds
            });

            // Reload the table data
            tableRef.current?.reloadData?.();
            setShowHostsModal(false);
            setEditingLPAR(null);
        } catch (error) {
            console.error('Error saving hosts:', error);
            alert('Error saving hosts: ' + (error.response?.data?.error || error.message));
        }
    }, [editingLPAR, selectedHostIds, API_ENDPOINTS.saveUrl]);

    // Toggle host selection
    const toggleHost = useCallback((hostId) => {
        setSelectedHostIds(prev => {
            if (prev.includes(hostId)) {
                return prev.filter(id => id !== hostId);
            } else {
                return [...prev, hostId];
            }
        });
    }, []);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        hosts_display: (rowData) => {
            const hostsDetails = rowData.hosts_details || [];
            const displayText = hostsDetails.map(h => h.name).join(', ') || '-';

            // Only show edit button in Project View and if user can edit
            if (projectFilter === 'current' && canEdit && rowData.id) {
                return {
                    __isReactComponent: true,
                    component: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ flex: 1 }}>{displayText}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditHosts(rowData);
                                }}
                                style={{
                                    padding: '2px 8px',
                                    fontSize: '12px',
                                    background: 'var(--primary-bg)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Edit
                            </button>
                        </div>
                    )
                };
            }

            return displayText;
        },
        host_count: (rowData) => {
            return rowData.host_count || 0;
        },
        volume_count: (rowData) => {
            return rowData.volume_count || 0;
        }
    }), [projectFilter, canEdit, handleEditHosts]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(lpar => {
            const hostsDetails = lpar.hosts_details || [];
            return {
                ...lpar,
                hosts_display: hostsDetails.map(h => h.name).join(', ') || '-',
                storage_name: lpar.storage?.name || lpar.storage_name || '',
                saved: !!lpar.id,
                _selected: lpar._selected || false
            };
        });
    }, []);

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

    // Toolbar content
    const filterToggleButtons = (
        <ProjectViewToolbar ActionsDropdown={ActionsDropdown} />
    );

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="IBM i LPARs" />;
    }

    // Show loading while data loads
    if (loading || projectFilterLoading || !apiUrl) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading IBM i LPARs...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {/* Banner Slot - shows Customer View or Select All banner */}
            <BannerSlot />

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration
                apiUrl={apiUrl}
                saveUrl={API_ENDPOINTS.saveUrl}
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                activeProjectId={activeProjectId}
                tableName="ibmilpars"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_LPAR_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Custom toolbar content
                customToolbarContent={filterToggleButtons}

                // Selection tracking
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`ibmilpar-table-${storageId || activeCustomerId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}
                selectCheckboxDisabled={projectFilter !== 'current'}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('IBM i LPAR save successful:', result.message);
                    } else {
                        console.error('IBM i LPAR save failed:', result.message);
                        alert('Error saving IBM i LPAR: ' + result.message);
                    }
                }}
            />

            {/* Hosts Edit Modal */}
            <Modal show={showHostsModal} onHide={() => setShowHostsModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Member Hosts</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editingLPAR && (
                        <>
                            <p className="text-muted mb-3">
                                Select hosts to include in LPAR: <strong>{editingLPAR.name}</strong>
                            </p>
                            <p className="small text-muted mb-3">
                                Volumes mapped to this LPAR will be evenly distributed across selected hosts.
                            </p>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {availableHosts.length === 0 ? (
                                    <p className="text-muted">No hosts available for this storage system.</p>
                                ) : (
                                    availableHosts.map(host => (
                                        <Form.Check
                                            key={host.id}
                                            type="checkbox"
                                            id={`host-${host.id}`}
                                            label={host.name}
                                            checked={selectedHostIds.includes(host.id)}
                                            onChange={() => toggleHost(host.id)}
                                            className="mb-2"
                                        />
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowHostsModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSaveHosts}>
                        Save Hosts
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default IBMiLPARTableTanStackClean;
