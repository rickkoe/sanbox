import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import api from "../../api";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import CommitProjectModal from "../modals/CommitProjectModal";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Clean TanStack Table implementation for Project management
const ProjectTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, refreshConfig } = useContext(ConfigContext);

    const [customerOptions, setCustomerOptions] = useState([]);
    const [customersById, setCustomersById] = useState({});
    const [commitModalOpen, setCommitModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [closeAfterCommit, setCloseAfterCommit] = useState(false);

    const activeCustomerId = config?.customer?.id;

    // Load columns from centralized configuration
    const columns = useMemo(() => {
        return getTableColumns('project', false); // Project table doesn't have project view variations
    }, []);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('project', false);
    }, []);

    const defaultSort = getDefaultSort('project');

    const NEW_PROJECT_TEMPLATE = {
        id: null,
        name: "",
        customer: "",
        notes: "",
        fabric_count: 0,
        alias_count: 0,
        zone_count: 0,
        storage_system_count: 0,
        host_count: 0
    };

    // Load customer options for dropdown
    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const response = await api.get(`${API_URL}/api/customers/`);
                const customers = response.data.results || response.data || [];

                setCustomerOptions(customers.map(customer => customer.name));

                // Create a map of customer ID to customer name for reverse lookup
                const customerMap = {};
                customers.forEach(customer => {
                    customerMap[customer.id] = customer.name;
                });
                setCustomersById(customerMap);
            } catch (error) {
                console.error('Error loading customers:', error);
            }
        };
        loadCustomers();
    }, [API_URL]);

    // Dynamic dropdown sources
    const dropdownSources = {
        customer: customerOptions
    };

    // Process data for display - convert customer IDs to names
    const preprocessData = useCallback((data) => {
        if (!data || data.length === 0) {
            return data || [];
        }

        return data.map(project => ({
            ...project,
            customer: customersById[project.customer] || project.customer
        }));
    }, [customersById]);

    // Transform data for saving - convert customer names to IDs
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            // Find customer ID from the loaded customers data
            const customerName = row.customer;
            const customerId = Object.keys(customersById).find(id => customersById[id] === customerName);

            if (!customerId) {
                throw new Error(`Customer '${customerName}' not found`);
            }

            return {
                name: row.name?.trim() || '',
                notes: row.notes || '',
                customer: parseInt(customerId)
            };
        });
    }, [customersById]);

    // Custom delete handler to refresh config after project deletion
    const handleDelete = async (projectId) => {
        try {
            // Delete the project
            await api.delete(`/core/projects/delete/${projectId}/`);

            // Check if the deleted project was the active project
            const activeProjectId = config?.active_project?.id;

            if (projectId === activeProjectId) {
                console.log('🔄 Active project was deleted, refreshing config...');
                // Refresh the config context to clear the deleted project reference
                await refreshConfig();
            }

            return { success: true, message: `Deleted project successfully` };
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            throw error;
        }
    };

    // Global handlers for commit buttons (accessed via window object from HTML)
    useEffect(() => {
        window.projectTableHandleCommit = (projectId, projectName) => {
            console.log('🔵 Commit button clicked:', projectId, projectName);
            setSelectedProject({ id: parseInt(projectId), name: projectName });
            setCloseAfterCommit(false);
            setCommitModalOpen(true);
        };

        window.projectTableHandleCommitAndClose = (projectId, projectName) => {
            console.log('🔵 Commit and Close button clicked:', projectId, projectName);
            setSelectedProject({ id: parseInt(projectId), name: projectName });
            setCloseAfterCommit(true);
            setCommitModalOpen(true);
        };

        return () => {
            delete window.projectTableHandleCommit;
            delete window.projectTableHandleCommitAndClose;
        };
    }, []);

    // Custom renderers for the Actions column
    const customRenderers = useMemo(() => {
        const renderers = {};

        renderers['project_actions'] = (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
            try {
                const projectId = rowData.id;
                const projectName = rowData.name || 'Unknown';
                const status = rowData.status || 'active';

                // Don't show commit buttons for closed projects
                if (status === 'closed') {
                    return `<span style="
                        padding: 4px 8px;
                        background-color: var(--badge-bg);
                        color: var(--badge-text);
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                    " onmousedown="event.stopPropagation()">Closed</span>`;
                }

                // Show commit buttons for active projects
                return `<div style="display: flex; gap: 8px;" onmousedown="event.stopPropagation()">
                    <button
                        onclick="window.projectTableHandleCommit('${projectId}', '${projectName.replace(/'/g, "\\'")}')"
                        onmousedown="event.stopPropagation()"
                        style="
                            padding: 6px 12px;
                            border: 1px solid var(--color-accent-emphasis);
                            border-radius: 6px;
                            cursor: pointer;
                            background-color: var(--color-accent-subtle);
                            color: var(--color-accent-fg);
                            font-size: 13px;
                            font-weight: 500;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.backgroundColor='var(--color-accent-muted)'"
                        onmouseout="this.style.backgroundColor='var(--color-accent-subtle)'"
                        title="Commit changes to base objects">
                        Commit
                    </button>
                    <button
                        onclick="window.projectTableHandleCommitAndClose('${projectId}', '${projectName.replace(/'/g, "\\'")}')"
                        onmousedown="event.stopPropagation()"
                        style="
                            padding: 6px 12px;
                            border: 1px solid var(--color-success-emphasis);
                            border-radius: 6px;
                            cursor: pointer;
                            background-color: var(--color-success-subtle);
                            color: var(--color-success-fg);
                            font-size: 13px;
                            font-weight: 500;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.backgroundColor='var(--color-success-muted)'"
                        onmouseout="this.style.backgroundColor='var(--color-success-subtle)'"
                        title="Commit changes and close project">
                        Commit & Close
                    </button>
                </div>`;
            } catch (error) {
                console.error('Error rendering project_actions:', error);
                return '';
            }
        };

        return renderers;
    }, []);

    // Handler for successful commit
    const handleCommitSuccess = () => {
        console.log('✅ Commit successful, refreshing table...');
        // Trigger table refresh by forcing a re-render
        // The table will reload data automatically
        refreshConfig();
    };

    return (
        <>
            <CommitProjectModal
                show={commitModalOpen}
                onClose={() => {
                    setCommitModalOpen(false);
                    setSelectedProject(null);
                }}
                projectId={selectedProject?.id}
                projectName={selectedProject?.name}
                onSuccess={handleCommitSuccess}
            />
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/core/projects/`}
                saveUrl={`${API_URL}/api/core/projects/`}
                updateUrl={`${API_URL}/api/core/projects/update/`}
                deleteUrl={`${API_URL}/api/core/projects/delete/`}
                customerId={null} // Show all projects user has access to (like CustomerTable)
                tableName="projects"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_PROJECT_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // Custom Handlers
                onDelete={handleDelete}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey="project-table-tanstack"

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
        </div>
        </>
    );
};

export default ProjectTableTanStackClean;