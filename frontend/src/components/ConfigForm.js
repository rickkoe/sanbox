import React, { useEffect, useState } from "react";
import axios from "axios";

const ConfigForm = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const apiUrl = "http://127.0.0.1:8000/api/core/config/";

    // Fetch config from Django API
    const fetchConfig = () => {
        axios.get(apiUrl)
            .then(response => {
                setConfig(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching config:", error);
                setError("Failed to load configuration.");
                setLoading(false);
            });
    };

    // Fetch config when the component mounts
    useEffect(() => {
        fetchConfig();
    }, []);

    // Handle form input changes
    const handleChange = (e) => {
        setConfig({
            ...config,
            [e.target.name]: e.target.value
        });
    };

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        axios.put(apiUrl, config)
            .then(response => {
                setConfig(response.data);
                alert("Configuration saved successfully!");
            })
            .catch(error => console.error("Error updating config:", error));
    };

    return (
        <div className="container mt-4">
            <h2>Configuration Settings</h2>

            {loading && <div className="alert alert-info">Loading configuration...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {config && (
                <form onSubmit={handleSubmit}>
                    {/* SAN Vendor Dropdown */}
                    <div className="mb-3">
                        <label className="form-label">SAN Vendor</label>
                        <select className="form-control" name="san_vendor" value={config.san_vendor} onChange={handleChange}>
                            <option value="BR">Brocade</option>
                            <option value="CI">Cisco</option>
                        </select>
                    </div>

                    {/* Cisco Alias Dropdown */}
                    <div className="mb-3">
                        <label className="form-label">Cisco Alias</label>
                        <select className="form-control" name="cisco_alias" value={config.cisco_alias} onChange={handleChange}>
                            <option value="device-alias">device-alias</option>
                            <option value="fcalias">fcalias</option>
                            <option value="wwpn">wwpn</option>
                        </select>
                    </div>

                    {/* Cisco Zoning Mode Dropdown */}
                    <div className="mb-3">
                        <label className="form-label">Cisco Zoning Mode</label>
                        <select className="form-control" name="cisco_zoning_mode" value={config.cisco_zoning_mode} onChange={handleChange}>
                            <option value="basic">Basic</option>
                            <option value="enhanced">Enhanced</option>
                        </select>
                    </div>

                    {/* Zone Ratio Dropdown */}
                    <div className="mb-3">
                        <label className="form-label">Zone Ratio</label>
                        <select className="form-control" name="zone_ratio" value={config.zone_ratio} onChange={handleChange}>
                            <option value="one-to-one">One-to-One</option>
                            <option value="one-to-many">One-to-Many</option>
                            <option value="all-to-all">All-to-All</option>
                        </select>
                    </div>

                    {/* Text Inputs */}
                    <div className="mb-3">
                        <label className="form-label">Zoning Job Name</label>
                        <input type="text" className="form-control" name="zoning_job_name" value={config.zoning_job_name} onChange={handleChange} />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">SmartZone Prefix</label>
                        <input type="text" className="form-control" name="smartzone_prefix" value={config.smartzone_prefix} onChange={handleChange} />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Alias Max Zones</label>
                        <input type="number" className="form-control" name="alias_max_zones" value={config.alias_max_zones} onChange={handleChange} />
                    </div>

                    {/* Submit Button */}
                    <button type="submit" className="btn btn-primary">Save Configuration</button>
                </form>
            )}
        </div>
    );
};

export default ConfigForm;