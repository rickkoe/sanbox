import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import "../../styles/configform.css"
import { Modal, Button, Form as BootstrapForm } from "react-bootstrap";

const ConfigForm = () => {
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
            const response = await axios.post("http://127.0.0.1:8000/api/customers/create/", {
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
            const response = await axios.post("http://127.0.0.1:8000/api/core/projects/", {
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
    
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";
    const configForCustomerApiUrl = "http://127.0.0.1:8000/api/core/config/customer/${customerId}/";
    const updateCustomerUrl = "http://127.0.0.1:8000/api/core/config/update/";

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (config) {
            setUnsavedConfig({
                customer: String(config.customer.id),
                project: config.active_project ? String(config.active_project.id) : "",
                active_project_id: config.active_project ? String(config.active_project.id) : "",
                san_vendor: config.san_vendor,
                cisco_alias: config.cisco_alias,
                cisco_zoning_mode: config.cisco_zoning_mode,
                zone_ratio: config.zone_ratio,
                zoning_job_name: config.zoning_job_name,
                smartzone_prefix: config.smartzone_prefix,
                alias_max_zones: config.alias_max_zones,
            });
            fetchProjects(config.customer.id);
        }
    }, [config]);

    useEffect(() => {
        refreshConfig();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(customersApiUrl);
            setCustomers(response.data);
        } catch (error) {
            console.error("❌ Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async (customerId) => {
        if (!customerId) return;
        try {
            const response = await axios.get(`${projectsApiUrl}${customerId}/`);
            setProjects(response.data);
        } catch (error) {
            console.error("❌ Error fetching projects:", error);
        }
    };

    const fetchConfigForCustomer = async (customerId) => {
        console.log("Fetching config for customer:", customerId);
        try {
            const response = await axios.get(configForCustomerApiUrl);
            console.log("Response from fetchConfigForCustomer:", response.data);
            if (response.data && Object.keys(response.data).length > 0) {
                const configForCustomer = response.data;
                setUnsavedConfig(prevConfig => ({
                    ...prevConfig,
                    project: configForCustomer.active_project ? String(configForCustomer.active_project.id) : "",
                    san_vendor: configForCustomer.san_vendor,
                    cisco_alias: configForCustomer.cisco_alias,
                    cisco_zoning_mode: configForCustomer.cisco_zoning_mode,
                    zone_ratio: configForCustomer.zone_ratio,
                    zoning_job_name: configForCustomer.zoning_job_name,
                    smartzone_prefix: configForCustomer.smartzone_prefix,
                    alias_max_zones: configForCustomer.alias_max_zones,
                }));
            } else {
                setUnsavedConfig(prevConfig => ({
                    ...prevConfig,
                    project: "",
                    san_vendor: "",
                    cisco_alias: "",
                    cisco_zoning_mode: "",
                    zone_ratio: "",
                    zoning_job_name: "",
                    smartzone_prefix: "",
                    alias_max_zones: "",
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
        setSaveStatus("Saving...");
        try {
            const { customer, project, active_project_id } = unsavedConfig;
            const payload = { 
                ...unsavedConfig, 
                active_project_id: active_project_id || project,
                is_active: true
            };
            console.log("PAYLOAD", payload);
            await axios.put(`${updateCustomerUrl}${customer}/`, payload);
            setSaveStatus("Configuration saved successfully! ✅");
            refreshConfig();
        } catch (error) {
            console.error("❌ Error saving config:", error);
            setSaveStatus("⚠️ Error saving configuration! Please try again.");
        }
    };

    return (
        <div className="container mt-4">
            {loading ? (
                <p>Loading...</p>
            ) : (
                <>
                    {unsavedConfig && (
                        <form>
                            <div className="mb-3">
                                <label className="form-label">Customer</label>
                                <div className="d-flex gap-2">
                                    <select className="form-control" name="customer" value={unsavedConfig.customer} onChange={handleInputChange}>
                                        {customers.map(customer => (
                                            <option key={customer.id} value={String(customer.id)}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button variant="outline-primary" onClick={() => setShowCustomerModal(true)}>+ Add</Button>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Project</label>
                                <div className="d-flex gap-2">
                                    <select
                                        className="form-control"
                                        name="project"
                                        value={unsavedConfig.project || ""}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Select a Project</option>
                                        {projects.map(project => (
                                            <option key={project.id} value={String(project.id)}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button variant="outline-primary" onClick={() => setShowProjectModal(true)}>+ Add</Button>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">SAN Vendor</label>
                                <select
                                    className="form-control"
                                    name="san_vendor"
                                    value={unsavedConfig.san_vendor}
                                    onChange={handleInputChange}
                                >
                                    <option value="BR">Brocade</option>
                                    <option value="CI">Cisco</option>
                                </select>
                            </div>

                            {unsavedConfig.san_vendor === "CI" && (
                                <>
                                    <div className="mb-3">
                                        <label className="form-label">Cisco Alias</label>
                                        <select className="form-control" name="cisco_alias" value={unsavedConfig.cisco_alias} onChange={handleInputChange}>
                                            <option value="device-alias">Device Alias</option>
                                            <option value="fcalias">FC Alias</option>
                                            <option value="wwpn">WWPN</option>
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Cisco Zoning Mode</label>
                                        <select className="form-control" name="cisco_zoning_mode" value={unsavedConfig.cisco_zoning_mode} onChange={handleInputChange}>
                                            <option value="basic">Basic</option>
                                            <option value="enhanced">Enhanced</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="mb-3">
                                <label className="form-label">Zone Ratio</label>
                                <select className="form-control" name="zone_ratio" value={unsavedConfig.zone_ratio} onChange={handleInputChange}>
                                    <option value="one-to-one">One-to-One</option>
                                    <option value="one-to-many">One-to-Many</option>
                                    <option value="all-to-all">All-to-All</option>
                                </select>
                            </div>

                            {/* ✅ Zoning Job Name */}
                            <div className="mb-3">
                                <label className="form-label">Zoning Job Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="zoning_job_name"
                                    value={unsavedConfig.zoning_job_name || ""}
                                    onChange={handleInputChange}
                                />
                            </div>

                            {/* ✅ Smartzone Prefix */}
                            <div className="mb-3">
                                <label className="form-label">Smartzone Prefix</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="smartzone_prefix"
                                    value={unsavedConfig.smartzone_prefix || ""}
                                    onChange={handleInputChange}
                                />
                            </div>

                            {/* ✅ Alias Max Zones */}
                            <div className="mb-3">
                                <label className="form-label">Alias Max Zones</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    name="alias_max_zones"
                                    value={unsavedConfig.alias_max_zones || ""}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <button type="button" className="btn btn-secondary" onClick={handleSave} disabled={saveStatus === "Saving..."}>
                                {saveStatus || "Save"}
                            </button>
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
                        </form>
                    )}
                </>
            )}
        </div>
    );
};

export default ConfigForm;