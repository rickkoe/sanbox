import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import "../../styles/configform.css"

const ConfigForm = () => {
    const { config, refreshConfig } = useContext(ConfigContext);
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [unsavedConfig, setUnsavedConfig] = useState(null);
    const [saveStatus, setSaveStatus] = useState(""); 
    const [loading, setLoading] = useState(true);
    
    const apiUrl = "http://127.0.0.1:8000/api/core/configs/";
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (config) {
            setUnsavedConfig({
                customer: String(config.customer.id),
                project: config.active_project ? String(config.active_project.id) : "",
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
    }, [config]); // ✅ Runs when `config` changes

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(customersApiUrl);
            console.log("📌 Customers Received:", response.data); 
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
            console.log("📌 Projects Received:", response.data); 
            setProjects(response.data);
        } catch (error) {
            console.error("❌ Error fetching projects:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
    
        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            [name]: value,
            ...(name === "customer" && { project: "", active_project_id: "" }),  // ✅ Reset project & active_project_id
            ...(name === "project" && { active_project_id: value })  // ✅ Ensure active_project_id is set
        }));
    
        if (name === "customer") {
            fetchProjects(value);  // ✅ Load projects for new customer
        }
    };

    const handleSave = async () => {
        setSaveStatus("Saving...");

        console.log("📌 Sending Data:", unsavedConfig); // ✅ Debugging

        try {
            await axios.put(`${apiUrl}${config.id}/`, unsavedConfig);
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
                            {/* ✅ Customer Dropdown (Disabled since it's tied to active config) */}
                            <div className="mb-3">
                                <label className="form-label">Customer</label>
                                <select className="form-control" disabled value={unsavedConfig.customer}>
                                    {customers.map(customer => (
                                        <option key={customer.id} value={String(customer.id)}>
                                            {customer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ✅ Project Dropdown */}
                            <div className="mb-3">
                                <label className="form-label">Project</label>
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
                            </div>

                            {/* ✅ SAN Vendor */}
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
                                    {/* ✅ Cisco Alias */}
                                    <div className="mb-3">
                                        <label className="form-label">Cisco Alias</label>
                                        <select className="form-control" name="cisco_alias" value={unsavedConfig.cisco_alias} onChange={handleInputChange}>
                                            <option value="device-alias">Device Alias</option>
                                            <option value="fcalias">FC Alias</option>
                                            <option value="wwpn">WWPN</option>
                                        </select>
                                    </div>

                                    {/* ✅ Cisco Zoning Mode */}
                                    <div className="mb-3">
                                        <label className="form-label">Cisco Zoning Mode</label>
                                        <select className="form-control" name="cisco_zoning_mode" value={unsavedConfig.cisco_zoning_mode} onChange={handleInputChange}>
                                            <option value="basic">Basic</option>
                                            <option value="enhanced">Enhanced</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* ✅ Zone Ratio */}
                            <div className="mb-3">
                                <label className="form-label">Zone Ratio</label>
                                <select className="form-control" name="zone_ratio" value={unsavedConfig.zone_ratio} onChange={handleInputChange}>
                                    <option value="one-to-one">One-to-One</option>
                                    <option value="one-to-many">One-to-Many</option>
                                    <option value="all-to-all">All-to-All</option>
                                </select>
                            </div>

                            <button type="button" className="btn btn-secondary" onClick={handleSave} disabled={saveStatus === "Saving..."}>
                                {saveStatus || "Save"}
                            </button>
                        </form>
                    )}
                </>
            )}
        </div>
    );
};

export default ConfigForm;