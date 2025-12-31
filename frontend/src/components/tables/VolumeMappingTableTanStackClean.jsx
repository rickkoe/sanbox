import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Volume Mapping table - read-only view with delete capability
// Props:
// - storageId (optional): Filter mappings to only show those from a specific storage system
// - hideColumns (optional): Array of column names to hide
const VolumeMappingTableTanStackClean = ({ storageId = null, hideColumns = [] }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);

    const tableRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const { projectFilter, setProjectFilter, loading: projectFilterLoading } = useProjectFilter();
    const [totalRowCount, setTotalRowCount] = useState(0);

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
        localStorageKey: 'volumeMappingTableProjectFilter'
    });

    // Generate the correct apiUrl for volume mappings
    const apiUrl = useMemo(() => {
        if (projectFilterLoading) {
            return null;
        }

        const storageFilter = storageId ? `storage=${storageId}` : '';

        if (projectFilter === 'current' && activeProjectId) {
            const baseUrl = `${API_URL}/api/storage/project/${activeProjectId}/view/volume-mappings/`;
            return storageFilter ? `${baseUrl}?${storageFilter}` : baseUrl;
        } else if (activeProjectId) {
            const baseUrl = `${API_URL}/api/storage/project/${activeProjectId}/view/volume-mappings/?project_filter=${projectFilter}`;
            return storageFilter ? `${baseUrl}&${storageFilter}` : baseUrl;
        } else if (activeCustomerId) {
            const baseUrl = `${API_URL}/api/storage/volume-mappings/?customer=${activeCustomerId}`;
            return storageFilter ? `${baseUrl}&${storageFilter}` : baseUrl;
        } else {
            const baseUrl = `${API_URL}/api/storage/volume-mappings/`;
            return storageFilter ? `${baseUrl}?${storageFilter}` : baseUrl;
        }
    }, [API_URL, projectFilter, activeProjectId, activeCustomerId, projectFilterLoading, storageId]);

    // Use centralized permissions hook
    const { canEdit, canDelete } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'volume mappings'
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
        entityType: 'volumemapping',
        API_URL,
        totalRowCount
    });

    // Volume mappings are read-only (created via MapVolumesToHostModal)
    // Only deletion is allowed in Project View
    const isReadOnly = true;

    // API endpoints
    const API_ENDPOINTS = useMemo(() => {
        const baseUrl = `${API_URL}/api/storage`;
        return {
            mappings: apiUrl,
            deleteUrl: `${baseUrl}/volume-mappings/`
        };
    }, [API_URL, apiUrl]);

    // Load columns from centralized configuration
    const allColumns = useMemo(() => {
        return getTableColumns('volumemapping');
    }, []);

    // Filter columns based on hideColumns prop
    const columns = allColumns.filter(col => !hideColumns.includes(col.data));

    const colHeaders = useMemo(() => {
        return columns.map(col => col.title);
    }, [columns]);

    const defaultSort = getDefaultSort('volumemapping');

    // Expose table ref to window for bulk operations
    useEffect(() => {
        window.volumeMappingTableRef = tableRef;

        return () => {
            delete window.volumeMappingTableRef;
        };
    }, []);

    // Custom renderers for special formatting
    const customRenderers = useMemo(() => ({
        target_type_display: (rowData) => {
            const typeMap = {
                'host': 'Host',
                'cluster': 'Host Cluster',
                'lpar': 'IBM i LPAR'
            };
            return typeMap[rowData.target_type] || rowData.target_type || '';
        },
        assigned_host_name: (rowData) => {
            // Only show for LPAR mappings
            if (rowData.target_type === 'lpar') {
                return rowData.assigned_host_name || '-';
            }
            return '-';
        },
        volume_id_hex: (rowData) => {
            // Format volume ID in hex (DS8000 style)
            return rowData.volume_id_hex || rowData.volume?.volume_id || '';
        }
    }), []);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(mapping => {
            return {
                ...mapping,
                volume_name: mapping.volume?.name || mapping.volume_name || '',
                volume_id_hex: mapping.volume?.volume_id || mapping.volume_id_hex || '',
                target_type_display: mapping.target_type,
                saved: !!mapping.id,
                _selected: mapping._selected || false
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
        return <EmptyConfigMessage entityName="volume mappings" />;
    }

    // Show loading while projectFilter is loading
    if (projectFilterLoading || !apiUrl) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading volume mappings...</span>
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
                deleteUrl={API_ENDPOINTS.deleteUrl}
                customerId={activeCustomerId}
                activeProjectId={activeProjectId}
                tableName="volumemappings"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                customRenderers={customRenderers}

                // Custom toolbar content
                customToolbarContent={filterToggleButtons}

                // Selection tracking
                totalCheckboxSelected={selectedRows.size}
                onClearAllCheckboxes={handleClearSelection}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`volumemapping-table-${storageId || activeCustomerId || 'default'}-${projectFilter}`}
                readOnly={isReadOnly}
                selectCheckboxDisabled={projectFilter !== 'current'}
                hideAddButton={true}  // No adding - use MapVolumesToHostModal

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('Volume mapping operation successful:', result.message);
                    } else {
                        console.error('Volume mapping operation failed:', result.message);
                    }
                }}
            />
        </div>
    );
};

export default VolumeMappingTableTanStackClean;
