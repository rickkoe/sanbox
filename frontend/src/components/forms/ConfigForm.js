import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";

const ConfigForm = () => {
    const [config, setConfig] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [unsavedConfig, setUnsavedConfig] = useState(null);  
    const [saveStatus, setSaveStatus] = useState(""); 
    const { refreshConfig } = useContext(ConfigContext);

    const apiUrl = "http://127.0.0.1:8000/api/core/configs/";
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (unsavedConfig?.customer) {
            fetchActiveConfig(unsavedConfig.customer);
            fetchProjects(unsavedConfig.customer);
        }
    }, [unsavedConfig?.customer]);

    const fetchCustomers = async () => {
        try {
            const response = await axios.get(customersApiUrl);
            setCustomers(response.data);

            // ✅ Auto-select the first customer and fetch config
            if (response.data.length > 0) {
                setUnsavedConfig(prev => ({ ...prev, customer: String(response.data[0].id) }));
            }
        } catch (error) {
            console.error("❌ Error fetching customers:", error);
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

    const fetchActiveConfig = async (customerId) => {
        try {
            console.log(`🔍 Fetching active config for customer ID: ${customerId}`);
            const response = await axios.get(`${apiUrl}?is_active=True&customer_id=${customerId}`);
            
            console.log("✅ API Response:", response.data);
    
            if (response.data.length > 0) {
                const configData = response.data[0];
                console.log("🎯 Active Config Found:", configData);
    
                setConfig(configData);
                setUnsavedConfig({
                    customer: String(configData.customer.id),
                    project: configData.active_project ? String(configData.active_project.id) : "",  // ✅ Set project correctly
                    san_vendor: configData.san_vendor,
                    cisco_alias: configData.cisco_alias,
                    cisco_zoning_mode: configData.cisco_zoning_mode,
                    zone_ratio: configData.zone_ratio,
                    zoning_job_name: configData.zoning_job_name,
                    smartzone_prefix: configData.smartzone_prefix,
                    alias_max_zones: configData.alias_max_zones,
                });
            } else {
                console.warn("⚠️ No active config found for this customer.");
                setConfig(null);
                setUnsavedConfig(prev => ({ ...prev, project: "" }));
            }
        } catch (error) {
            console.error("❌ Error fetching active config:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            [name]: value,
            ...(name === "customer" && { project: "" }) // ✅ Reset project when customer changes
        }));

        if (name === "customer") {
            fetchProjects(value);
            fetchActiveConfig(value);
        }
    };

    const handleSave = async () => {
        setSaveStatus("Saving...");  

        try {
            const response = await axios.put(`${apiUrl}${config.id}/`, unsavedConfig);
            setConfig(response.data);
            setSaveStatus("Configuration saved successfully! ✅");
            refreshConfig();

            document.querySelectorAll("input, select").forEach(el => {
                el.classList.add("saved-highlight");
            });

            setTimeout(() => {
                setSaveStatus("");  
                document.querySelectorAll("input, select").forEach(el => {
                    el.classList.remove("saved-highlight");
                });
            }, 3000);
        } catch (error) {
            console.error("❌ Error saving config:", error);
            setSaveStatus("⚠️ Error saving configuration! Please try again.");
        }
    };

    return (
        <div className="container mt-4">
            {unsavedConfig && (
                <form>
                    {/* ✅ Customer Dropdown */}
                    <div className="mb-3">
                        <label className="form-label">Customer</label>
                        <select
                            className="form-control"
                            name="customer"
                            value={unsavedConfig.customer || ""}
                            onChange={handleInputChange}
                        >
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
                        <select className="form-control" name="san_vendor" value={unsavedConfig.san_vendor} onChange={handleInputChange}>
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
        </div>
    );
};

export default ConfigForm;