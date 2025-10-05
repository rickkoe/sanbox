import React, { useContext, useEffect, useState } from "react";
import api from "../../api";
import { ConfigContext } from "../../context/ConfigContext";
import "../../styles/configform.css"
import { Modal, Button, Form as BootstrapForm } from "react-bootstrap";

const ConfigForm = () => {
    const customersApiUrl = `/customers/`;
    const projectsApiUrl = `/core/projects/`;
    const updateCustomerUrl = `/core/config/update/`;

    const { config, refreshConfig } = useContext(ConfigContext);
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [unsavedConfig, setUnsavedConfig] = useState(null);
    const [saveStatus, setSaveStatus] = useState(""); 
    const [loading, setLoading] = useState(true);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const handleAddCustomer = async () => {
        try {
            console.log("Adding new customer:", newCustomerName);
            const response = await api.post(customersApiUrl, {
                name: newCustomerName
            });
            const newCustomer = response.data;
            setCustomers(prev => [...prev, newCustomer]);
            setUnsavedConfig(prev => ({
                ...prev,
                customer: String(newCustomer.id),
                project: "",
                active_project_id: ""
            }));
            fetchProjects(newCustomer.id);
            fetchConfigForCustomer(newCustomer.id);
            setShowCustomerModal(false);
            setNewCustomerName("");
        } catch (error) {
            console.error("❌ Error adding customer:", error);
        }
    };
    const handleAddProject = async () => {
        try {
            const response = await api.post(projectsApiUrl, {
                name: newProjectName,
                customer: parseInt(unsavedConfig.customer)
            });
            const newProject = response.data;
            setProjects(prev => [...prev, newProject]);
            setUnsavedConfig(prev => ({ ...prev, project: String(newProject.id), active_project_id: String(newProject.id) }));
            setShowProjectModal(false);
            setNewProjectName("");
        } catch (error) {
            console.error("❌ Error adding project:", error);
        }
    };


    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (config) {
            setUnsavedConfig({
                customer: String(config.customer.id),
                project: config.active_project ? String(config.active_project.id) : "",
                active_project_id: config.active_project ? String(config.active_project.id) : "",
            });
            fetchProjects(config.customer.id);
        } else {
            // Initialize empty config when no config exists (new user scenario)
            setUnsavedConfig({
                customer: "",
                project: "",
                active_project_id: ""
            });
        }
    }, [config]);

    useEffect(() => {
        refreshConfig();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await api.get(customersApiUrl);
            // Ensure response.data is an array
            const customersData = Array.isArray(response.data) ? response.data : 
                                 response.data.results ? response.data.results : [];
            setCustomers(customersData);
        } catch (error) {
            console.error("❌ Error fetching customers:", error);
            setCustomers([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async (customerId) => {
        if (!customerId) return;
        try {
            const response = await api.get(`${projectsApiUrl}${customerId}/`);
            // Ensure response.data is an array
            const projectsData = Array.isArray(response.data) ? response.data : 
                                response.data.results ? response.data.results : [];
            setProjects(projectsData);
        } catch (error) {
            console.error("❌ Error fetching projects:", error);
            setProjects([]); // Set empty array on error
        }
    };

    const fetchConfigForCustomer = async (customerId) => {
        console.log("Fetching config for customer:", customerId);
        try {
            const url = `/core/config/customer/${customerId}/`;
            const response = await api.get(url);
            console.log("Response from fetchConfigForCustomer:", response.data);
            if (response.data && Object.keys(response.data).length > 0) {
                const configForCustomer = response.data;
                setUnsavedConfig(prevConfig => ({
                    ...prevConfig,
                    project: configForCustomer.active_project ? String(configForCustomer.active_project.id) : "",
                }));
            } else {
                setUnsavedConfig(prevConfig => ({
                    ...prevConfig,
                    project: "",
                }));
            }
        } catch (error) {
            console.error("❌ Error fetching config for customer:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            [name]: value,
            ...(name === "customer" && { project: "", active_project_id: "" }),
            ...(name === "project" && { active_project_id: value })
        }));

        if (name === "customer") {
            fetchProjects(value);
            fetchConfigForCustomer(value);
        }
    };

    const handleSave = async () => {
        console.log("🚀 Starting save process...");
        console.log("Current unsavedConfig:", unsavedConfig);
        
        setSaveStatus("Saving...");
        try {
            const { customer, project, active_project_id } = unsavedConfig;
            
            console.log("Extracted values:", { customer, project, active_project_id });
            
            // Validate required fields
            if (!customer || !project) {
                console.log("❌ Validation failed - missing customer or project");
                setSaveStatus("⚠️ Please select both customer and project.");
                return;
            }
            
            const payload = { 
                customer: String(customer),
                project: String(project),
                active_project_id: String(active_project_id || project),
                is_active: true
            };
            
            console.log("📦 PAYLOAD:", payload);
            console.log("🌐 API URL:", `${updateCustomerUrl}${customer}/`);

            const response = await api.put(`${updateCustomerUrl}${customer}/`, payload);
            console.log("✅ Save response:", response.data);
            
            setSaveStatus("Configuration saved successfully! ✅");
            refreshConfig();
            
            // Clear status after 3 seconds
            setTimeout(() => setSaveStatus(""), 3000);
            
        } catch (error) {
            console.error("❌ FULL ERROR OBJECT:", error);
            console.error("❌ Error message:", error.message);
            console.error("❌ Error response:", error.response);
            console.error("❌ Error response data:", error.response?.data);
            console.error("❌ Error response status:", error.response?.status);
            console.error("❌ Error response headers:", error.response?.headers);
            console.error("❌ Error request:", error.request);
            console.error("❌ Error config:", error.config);
            
            let errorMessage = "⚠️ Error saving configuration! ";
            if (error.response?.data?.detail) {
                errorMessage += error.response.data.detail;
            } else if (error.response?.data?.message) {
                errorMessage += error.response.data.message;
            } else if (error.response?.status === 404) {
                errorMessage += "Configuration endpoint not found.";
            } else if (error.response?.status === 500) {
                errorMessage += "Server error occurred.";
            } else if (error.code === 'NETWORK_ERROR') {
                errorMessage += "Network error - is the backend running?";
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += "Unknown error occurred.";
            }
            
            setSaveStatus(errorMessage);
            
            // Clear error status after 5 seconds
            setTimeout(() => setSaveStatus(""), 5000);
        }
    };

    return (
        <div className="config-container">
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <span>Loading configuration...</span>
                </div>
            ) : (
                <div className="settings-layout">
                    {/* Page Header */}
                    <div className="settings-header">
                        <div className="header-content">
                            <h1 className="settings-title">Project Configuration</h1>
                            <p className="settings-description">
                                Manage your workspace settings and preferences
                            </p>
                        </div>
                    </div>

                    {/* Settings Content */}
                    <div className="settings-content">
                        {/* Show setup guidance for new users */}
                        {customers.length === 0 && !loading && (
                            <div className="setup-guidance">
                                <div className="guidance-icon">🚀</div>
                                <h3>Welcome to Sanbox!</h3>
                                <p>Let's set up your first customer and project to get started.</p>
                                <div className="guidance-steps">
                                    <div className="step">
                                        <span className="step-number">1</span>
                                        <span>Click the <strong>+ button</strong> next to "Customer Organization" below</span>
                                    </div>
                                    <div className="step">
                                        <span className="step-number">2</span>
                                        <span>Add your customer/organization name</span>
                                    </div>
                                    <div className="step">
                                        <span className="step-number">3</span>
                                        <span>Then add your first project</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Workspace Settings Card */}
                        {unsavedConfig && (
                            <div className="settings-card">
                                <div className="card-header">
                                    <div className="card-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                        </svg>
                                    </div>
                                    <div className="card-header-text">
                                        <h3 className="card-title">Workspace</h3>
                                        <p className="card-subtitle">Configure your active customer and project</p>
                                    </div>
                                </div>

                                <form className="config-form">
                                    <div className="form-section">
                                        <div className="form-group">
                                            <label className="form-label">
                                                <span className="label-icon">🏢</span>
                                                Customer Organization
                                                <span className="required">*</span>
                                            </label>
                                            <div className="input-group">
                                                <select
                                                    className="form-select"
                                                    name="customer"
                                                    value={unsavedConfig.customer || ""}
                                                    onChange={handleInputChange}
                                                    required
                                                >
                                                    <option value="">
                                                        {customers.length === 0 ? "Click + to add your first customer" : "Choose a customer..."}
                                                    </option>
                                                    {Array.isArray(customers) && customers.map(customer => (
                                                        <option key={customer.id} value={String(customer.id)}>
                                                            {customer.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className={`add-btn ${customers.length === 0 ? "add-btn-highlight" : ""}`}
                                                    onClick={() => setShowCustomerModal(true)}
                                                    title="Add new customer"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                            {customers.length === 0 && (
                                                <div className="field-guidance">
                                                    👆 <strong>Click the + button</strong> to add your first customer
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                <span className="label-icon">📁</span>
                                                Active Project
                                                <span className="required">*</span>
                                            </label>
                                            <div className="input-group">
                                                <select
                                                    className="form-select"
                                                    name="project"
                                                    value={unsavedConfig.project || ""}
                                                    onChange={handleInputChange}
                                                    disabled={!unsavedConfig.customer}
                                                    required
                                                >
                                                    <option value="">
                                                        {unsavedConfig.customer ? "Choose a project..." : "Select customer first"}
                                                    </option>
                                                    {Array.isArray(projects) && projects.map(project => (
                                                        <option key={project.id} value={String(project.id)}>
                                                            {project.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className={`add-btn ${unsavedConfig.customer && projects.length === 0 ? "add-btn-highlight" : ""}`}
                                                    onClick={() => setShowProjectModal(true)}
                                                    disabled={!unsavedConfig.customer}
                                                    title="Add new project"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                            {unsavedConfig.customer && projects.length === 0 && (
                                                <div className="field-guidance">
                                                    👆 <strong>Click the + button</strong> to add your first project
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="card-footer">
                                        <button
                                            type="button"
                                            className={`save-btn ${saveStatus === "Saving..." ? "saving" : ""}`}
                                            onClick={handleSave}
                                            disabled={saveStatus === "Saving..." || !unsavedConfig.customer || !unsavedConfig.project}
                                        >
                                            {saveStatus === "Saving..." ? (
                                                <>
                                                    <div className="btn-spinner"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                    Save Configuration
                                                </>
                                            )}
                                        </button>

                                        {saveStatus && !saveStatus.includes("Saving") && (
                                            <div className={`status-message ${saveStatus.includes("✅") ? "success" : "error"}`}>
                                                {saveStatus}
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Placeholder for future settings */}
                        <div className="settings-card settings-card-disabled">
                            <div className="card-header">
                                <div className="card-icon card-icon-disabled">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M12 1v6m0 6v6m8.66-9l-5.2 3M8.54 14l-5.2 3m12.72 0l-5.2-3M8.54 10l-5.2-3"></path>
                                    </svg>
                                </div>
                                <div className="card-header-text">
                                    <h3 className="card-title">Advanced Settings</h3>
                                    <p className="card-subtitle">Additional configuration options</p>
                                </div>
                                <span className="coming-soon-badge">Coming Soon</span>
                            </div>
                            <div className="card-body">
                                <p className="placeholder-text">More configuration options will be available here in future updates.</p>
                            </div>
                        </div>
                    </div>

                    {/* Modals */}
                    <Modal show={showProjectModal} onHide={() => setShowProjectModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Add New Project</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <BootstrapForm.Group>
                                <BootstrapForm.Label>Project Name</BootstrapForm.Label>
                                <BootstrapForm.Control
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Enter project name"
                                />
                            </BootstrapForm.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleAddProject}>Add Project</Button>
                        </Modal.Footer>
                    </Modal>

                    <Modal show={showCustomerModal} onHide={() => setShowCustomerModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Add New Customer</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <BootstrapForm.Group>
                                <BootstrapForm.Label>Customer Name</BootstrapForm.Label>
                                <BootstrapForm.Control
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    placeholder="Enter customer name"
                                />
                            </BootstrapForm.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowCustomerModal(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleAddCustomer}>Add Customer</Button>
                        </Modal.Footer>
                    </Modal>
                </div>
            )}
        </div>
    );
};

export default ConfigForm;