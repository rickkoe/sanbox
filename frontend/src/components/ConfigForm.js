import React, { useEffect, useState } from "react";
import axios from "axios";

const ConfigForm = () => {
    const [config, setConfig] = useState({ customer: "", project: "" });
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);

    const apiUrl = "http://127.0.0.1:8000/api/core/config/";
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";

    // Fetch initial config data
    useEffect(() => {
        axios.get(apiUrl)
            .then(response => {
                const configData = response.data;
                setConfig({
                    customer: configData.customer ? String(configData.customer.id) : "",
                    project: configData.project ? String(configData.project.id) : "",
                });
                if (configData.customer) fetchProjects(configData.customer.id);
            })
            .catch(error => console.error("Error fetching config:", error));
    }, []);

    // Fetch customers
    useEffect(() => {
        axios.get(customersApiUrl)
            .then(response => setCustomers(response.data))
            .catch(error => console.error("Error fetching customers:", error));
    }, []);

// ✅ Fetch Projects for a selected customer
const fetchProjects = (customerId) => {
    if (!customerId) return;

    axios.get(`${projectsApiUrl}${customerId}/`)
        .then(response => {
            setProjects(response.data);  // ✅ Ensure state updates with available projects
        })
        .catch(error => console.error("Error fetching projects:", error));
};

    // Handle customer selection change
    const handleCustomerChange = (e) => {
        const newCustomerId = e.target.value;
        setConfig(prevConfig => ({
            ...prevConfig,
            customer: newCustomerId,
            project: "" // Reset project selection when customer changes
        }));
        fetchProjects(newCustomerId);
    };

    // Handle project selection change
const handleProjectChange = (e) => {
    const newProjectId = e.target.value;

    setConfig(prevConfig => {
        const updatedConfig = { 
            ...prevConfig, 
            project: newProjectId  // ✅ Only update the project, keep customer unchanged
        };

        // ✅ Send only the project update to the backend
        axios.put(apiUrl, { project: newProjectId })  
            .then(response => setConfig(response.data))  // ✅ Update state with response
            .catch(error => console.error("Error updating project in config:", error));

        return updatedConfig;
    });
};

    return (
        <div className="container mt-4">
            <h2>Configuration Settings</h2>
            <form>
                {/* Customer Dropdown */}
                <div className="mb-3">
                    <label className="form-label">Customer</label>
                    <select
                        className="form-control"
                        name="customer"
                        value={config.customer}
                        onChange={handleCustomerChange}
                    >
                        <option value="">Select a Customer</option>
                        {customers.map(customer => (
                            <option key={customer.id} value={String(customer.id)}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Project Dropdown */}
{/* ✅ Project Dropdown (Now correctly displays projects for the selected customer) */}
<div className="mb-3">
    <label className="form-label">Project</label>
    <select
        className="form-control"
        name="project"
        value={config.project || ""}
        onChange={handleProjectChange}  // ✅ Allows users to change project
        disabled={!config.customer || projects.length === 0}  // ✅ Disable if no customer is selected or no projects found
    >
        <option value="">Select a Project</option>
        {projects.length > 0 ? (
            projects.map(project => (
                <option key={project.id} value={String(project.id)}>
                    {project.name}
                </option>
            ))
        ) : (
            <option disabled>No projects available</option>
        )}
    </select>
</div>
            </form>
        </div>
    );
};

export default ConfigForm;