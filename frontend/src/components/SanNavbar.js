import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./SanNavbar.css";  // ✅ Import custom styles

const SanNavbar = () => {
    const [sanVendor, setSanVendor] = useState(null); // ✅ Start as null (no flicker)
    const apiUrl = "http://127.0.0.1:8000/api/core/config/";

    // Fetch current SAN Vendor from Config
    useEffect(() => {
        axios.get(apiUrl)
            .then(response => {
                setSanVendor(response.data.san_vendor); // ✅ Set actual vendor from API
            })
            .catch(error => console.error("Error fetching SAN vendor:", error));
    }, []);

    // Handle Toggle Change
    const handleToggle = () => {
        if (sanVendor === null) return;  // ✅ Prevent toggle action before API data loads

        const newSanVendor = sanVendor === "BR" ? "CI" : "BR"; // Toggle value

        // ✅ Fetch full config before updating
        axios.get(apiUrl)
            .then(response => {
                const updatedConfig = { ...response.data, san_vendor: newSanVendor }; // Update only `san_vendor`
                setSanVendor(newSanVendor);

                // ✅ Send full config update
                return axios.put(apiUrl, updatedConfig);
            })
            .catch(error => console.error("Error updating SAN vendor:", error));
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light">
            <div className="container d-flex justify-content-between">
                <ul className="navbar-nav">
                    <li className="nav-item">
                        <NavLink className="nav-link" to="/san/fabrics">Fabrics</NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink className="nav-link" to="/san/aliases">Aliases</NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink className="nav-link" to="/san/zones">Zones</NavLink>
                    </li>
                </ul>

                {/* ✅ Custom Toggle Switch for Brocade/Cisco */}
                {sanVendor !== null && (  // ✅ Prevent rendering before API data loads
                    <div className="san-toggle-container">
                        <span className={`san-toggle-label ${sanVendor === "BR" ? "active" : ""}`}>Brocade</span>
                        <div 
                            className={`san-toggle-switch ${sanVendor === "CI" ? "switch-right" : "switch-left"}`} 
                            onClick={handleToggle}
                        >
                            <div className="san-toggle-thumb"></div>
                        </div>
                        <span className={`san-toggle-label ${sanVendor === "CI" ? "active" : ""}`}>Cisco</span>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default SanNavbar;