import React, { useEffect, useState } from "react";
import axios from "axios";

const ConfigForm = () => {
    const [config, setConfig] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [unsavedConfig, setUnsavedConfig] = useState(null);  // ✅ Holds changes until Save is clicked

    const apiUrl = "http://127.0.0.1:8000/api/core/config/";
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";

    // 	Runs once when the page loads (useEffect([]))
	// 	Calls GET /api/core/config/ to fetch the config from Django.
	// 	Converts customer and project IDs into strings (because dropdown values are strings).
	// 	Stores the fetched data in state (setConfig & setUnsavedConfig).
	// 	If a customer is found, it calls fetchProjects() to get their projects.
    useEffect(() => {
        axios.get(apiUrl)
            .then(response => {
                console.log("✅ API Config Response on Load:", response.data);  // ✅ Debug API response
    
                const configData = response.data;
                setConfig({
                    ...configData,
                    customer: configData.customer ? String(configData.customer.id) : "",  
                    project: configData.project_details ? String(configData.project_details.id) : "",  // ✅ Now extracts from `project_details`
                });
    
                setUnsavedConfig({
                    customer: configData.customer ? String(configData.customer.id) : "",
                    project: configData.project_details ? String(configData.project_details.id) : "",  // ✅ Ensures project loads correctly
                });
    
                console.log("🚀 `unsavedConfig` on Load:", configData);  // ✅ Debugging log
    
                if (configData.customer) fetchProjects(configData.customer.id);
            })
            .catch(error => console.error("❌ Error fetching config on load:", error));
    }, []);
    // 	Runs once when the page loads.
    // Calls GET /api/customers/ to fetch all customers.
    // Stores the response in setCustomers.
    useEffect(() => {
        axios.get(customersApiUrl)
            .then(response => setCustomers(response.data))
            .catch(error => console.error("Error fetching customers:", error));
    }, []);

    // 	When a customer is selected, this function is called.
    //  Calls GET /api/core/projects/{customerId}/ to fetch only that customer’s projects.
    //  Stores the projects in setProjects.
    const fetchProjects = (customerId) => {
        if (!customerId) return;

        axios.get(`${projectsApiUrl}${customerId}/`)
            .then(response => setProjects(response.data))
            .catch(error => console.error("Error fetching projects:", error));
    };

    // ✅ Handle customer selection change
    const handleCustomerChange = (e) => {
        const newCustomerId = e.target.value;

        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            customer: newCustomerId,
            project: "" // ✅ Reset project when customer changes
        }));

        fetchProjects(newCustomerId);
    };

    // ✅ Handle project selection change
    const handleProjectChange = (e) => {
        const newProjectId = e.target.value;

        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            project: newProjectId
        }));
    };

    // ✅ Save button sends the updated data to the backend
    const handleSave = () => {
        console.log("📤 Saving Config:", unsavedConfig);  // ✅ Debugging log
        axios.put(apiUrl, unsavedConfig)
            .then(response => {
                console.log("✅ API Response:", response.data);
                setConfig(response.data);  // ✅ Update state with saved data
            })
            .catch(error => console.error("❌ Error saving config:", error));
    };

    return (
        <div className="container mt-4">
            <h2>Configuration Settings</h2>

            {config && unsavedConfig && (
                <form>
                    {/* ✅ Customer Dropdown (Editable) */}
                    <div className="mb-3">
                        <label className="form-label">Customer</label>
                        <select
                            className="form-control"
                            name="customer"
                            value={unsavedConfig.customer || ""}
                            onChange={handleCustomerChange}  // ✅ Allows users to change customer
                        >
                            <option value="">Select a Customer</option>
                            {customers.map(customer => (
                                <option key={customer.id} value={String(customer.id)}>
                                    {customer.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ✅ Project Dropdown (Filtered by Customer) */}
                    <div className="mb-3">
                        <label className="form-label">Project</label>
                        <select
                            className="form-control"
                            name="project"
                            value={unsavedConfig.project || ""}
                            onChange={handleProjectChange}  // ✅ Allows users to change project
                            disabled={!unsavedConfig.customer}  // ✅ Disable if no customer is selected
                        >
                            <option value="">Select a Project</option>
                            {projects.map(project => (
                                <option key={project.id} value={String(project.id)}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ✅ Save Button */}
                    <button type="button" className="btn btn-primary" onClick={handleSave}>
                        Save Configuration
                    </button>
                </form>
            )}
        </div>
    );
};

export default ConfigForm;