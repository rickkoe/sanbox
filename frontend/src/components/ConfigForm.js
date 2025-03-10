import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";

const ConfigForm = () => {
    const [config, setConfig] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [unsavedConfig, setUnsavedConfig] = useState(null);  
    const [saveStatus, setSaveStatus] = useState(""); 
    const {refreshConfig} = useContext(ConfigContext);

    const apiUrl = "http://127.0.0.1:8000/api/core/config/";
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const projectsApiUrl = "http://127.0.0.1:8000/api/core/projects/";

    useEffect(() => {
        axios.get(apiUrl)
            .then(response => {

                const configData = response.data;
                setConfig(configData);

                setUnsavedConfig({
                    customer: configData.customer ? String(configData.customer.id) : "",
                    project: configData.project_details ? String(configData.project_details.id) : "",
                    san_vendor: configData.san_vendor,
                    cisco_alias: configData.cisco_alias,
                    cisco_zoning_mode: configData.cisco_zoning_mode,
                    zone_ratio: configData.zone_ratio,
                    zoning_job_name: configData.zoning_job_name,
                    smartzone_prefix: configData.smartzone_prefix,
                    alias_max_zones: configData.alias_max_zones,
                });

                if (configData.customer) fetchProjects(configData.customer.id);
            })
            .catch(error => console.error("❌ Error fetching config on load:", error));
    }, []);

    useEffect(() => {
        axios.get(customersApiUrl)
            .then(response => setCustomers(response.data))
            .catch(error => console.error("Error fetching customers:", error));
    }, []);

    const fetchProjects = (customerId) => {
        if (!customerId) return;

        axios.get(`${projectsApiUrl}${customerId}/`)
            .then(response => setProjects(response.data))
            .catch(error => console.error("Error fetching projects:", error));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
    
        setUnsavedConfig(prevConfig => ({
            ...prevConfig,
            [name]: value,
            ...(name === "customer" && { project: "" })  // ✅ Reset project when customer changes
        }));
    
        if (name === "customer") {
            fetchProjects(value);  // ✅ Fetch projects for the selected customer
        }
    };

    const handleSave = () => {
        setSaveStatus("Saving...");  // ✅ Show "Saving..." message
    
        axios.put(apiUrl, unsavedConfig)
            .then(response => {
                setConfig(response.data);
                setSaveStatus("Configuration saved successfully! ✅");
                refreshConfig();
    
                document.querySelectorAll("input, select").forEach(el => {
                    el.classList.add("saved-highlight");
                });
    
                setTimeout(() => {
                    setSaveStatus("");  // ✅ Reset status
                    document.querySelectorAll("input, select").forEach(el => {
                        el.classList.remove("saved-highlight");
                    });
                }, 3000);
            })
            .catch(error => {
                console.error("❌ Error saving config:", error);
                setSaveStatus("⚠️ Error saving configuration! Please try again.");
            });
    };

    return (
        <div className="container mt-4">
            {config && unsavedConfig && (
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
                            <option value="">Select a Customer</option>
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

                    {/* ✅ Other Fields */}
                    <div className="mb-3">
                        <label className="form-label">Zoning Job Name</label>
                        <input type="text" className="form-control" name="zoning_job_name" value={unsavedConfig.zoning_job_name} onChange={handleInputChange} />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">SmartZone Prefix</label>
                        <input type="text" className="form-control" name="smartzone_prefix" value={unsavedConfig.smartzone_prefix} onChange={handleInputChange} />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Alias Max Zones</label>
                        <input type="number" className="form-control" name="alias_max_zones" value={unsavedConfig.alias_max_zones} onChange={handleInputChange} />
                    </div>

                    <button type="button" className={`btn btn-sm ${saveStatus === "Saving..." ? "btn-secondary" : "btn-secondary"}`} onClick={handleSave} disabled={saveStatus === "Saving..."}>
                        {saveStatus === "Saving..." ? (
                            <> <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving... </>
                        ) : saveStatus.includes("successfully") ? (
                            <> ✅ Saved </>
                        ) : (
                            <> Save </>
                        )}
                    </button>

                    {/* ✅ Bootstrap Alert for Save Status */}
                    {saveStatus && (
                        <div className={`alert ${saveStatus.includes("Error") ? "alert-danger" : "alert-success"} mt-2`} role="alert">
                            {saveStatus}
                        </div>
                    )}
                </form>
            )}
        </div>
    );
};

export default ConfigForm;