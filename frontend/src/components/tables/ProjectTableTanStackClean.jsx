import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Project management
const ProjectTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, refreshConfig } = useContext(ConfigContext);

    const [customerOptions, setCustomerOptions] = useState([]);
    const [customersById, setCustomersById] = useState({});

    // All possible project columns
    const columns = [
        { data: "name", title: "Project Name", required: true },
        { data: "customer", title: "Customer", type: "dropdown", required: true },
        { data: "fabric_count", title: "Fabrics", type: "numeric", readOnly: true },
        { data: "alias_count", title: "Aliases", type: "numeric", readOnly: true },
        { data: "zone_count", title: "Zones", type: "numeric", readOnly: true },
        { data: "storage_system_count", title: "Storage Systems", type: "numeric", readOnly: true },
        { data: "host_count", title: "Hosts", type: "numeric", readOnly: true },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

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
                const response = await axios.get(`${API_URL}/api/customers/`);
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
    const preprocessData = (data) => {
        return data.map(project => ({
            ...project,
            customer: customersById[project.customer] || project.customer
        }));
    };

    // Transform data for saving - convert customer names to IDs
    const saveTransform = (rows) => {
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
    };

    // Custom delete handler to refresh config after project deletion
    const handleDelete = async (projectId) => {
        try {
            // Delete the project
            await axios.delete(`${API_URL}/api/core/projects/delete/${projectId}/`);

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

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/core/projects/`}
                saveUrl={`${API_URL}/api/core/projects/`}
                updateUrl={`${API_URL}/api/core/projects/update/`}
                deleteUrl={`${API_URL}/api/core/projects/delete/`}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_PROJECT_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // Custom Handlers
                onDelete={handleDelete}

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
    );
};

export default ProjectTableTanStackClean;