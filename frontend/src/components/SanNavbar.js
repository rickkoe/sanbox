import React from "react";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./SanNavbar.css"; 
import { useSanVendor } from "../context/SanVendorContext";  // ✅ Use updated context

const SanNavbar = () => {
    const { sanVendor, updateSanVendor } = useSanVendor(); // ✅ Get state from context

    // Prevent toggle action before API data loads
    if (sanVendor === null) return null;

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

                {/* ✅ Custom Toggle Switch */}
                <div className="san-toggle-container">
                    <span className={`san-toggle-label ${sanVendor === "BR" ? "active" : ""}`}>Brocade</span>
                    <div 
                        className={`san-toggle-switch ${sanVendor === "CI" ? "switch-right" : "switch-left"}`} 
                        onClick={() => updateSanVendor(sanVendor === "BR" ? "CI" : "BR")}
                    >
                        <div className="san-toggle-thumb"></div>
                    </div>
                    <span className={`san-toggle-label ${sanVendor === "CI" ? "active" : ""}`}>Cisco</span>
                </div>
            </div>
        </nav>
    );
};

export default SanNavbar;