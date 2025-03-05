import React, { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import "./Navbar.css"; // ✅ Import styles

const Navbar = ({ toggleSidebar }) => {
  const [customer, setCustomer] = useState(null);
  const [project, setProject] = useState(null);
  const apiUrl = "http://127.0.0.1:8000/api/core/config/";

  // ✅ Fetch Config Data on Load
  useEffect(() => {
    axios.get(apiUrl)
      .then(response => {
        const configData = response.data;
        console.log(configData)
        setCustomer(configData.customer ? configData.customer.name : "No Customer");
        setProject(configData.project ? configData.project_details.name : "No Project");
      })
      .catch(error => console.error("Error fetching config:", error));
  }, []);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">

        {/* ✅ Sidebar Toggle Button */}
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
          ☰
        </button>

        <NavLink className="navbar-brand ms-2" to="/">SANBox</NavLink>

        {/* ✅ Display Active Customer & Project */}
        <div className="navbar-config">
          <span className="navbar-text">Customer: <strong>{customer}</strong></span>
          <span className="navbar-text ms-3">Project: <strong>{project}</strong></span>
        </div>

        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink className="nav-link" to="/customers">Customers</NavLink>
            </li>

            {/* SAN Dropdown */}
            <li className="nav-item dropdown">
              <Link 
                className="nav-link dropdown-toggle" 
                to="#" 
                id="sanDropdown" 
                role="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
              >
                SAN
              </Link>
              <ul className="dropdown-menu" aria-labelledby="sanDropdown">
                <li><NavLink className="dropdown-item" to="/san/fabrics">Fabrics</NavLink></li>
                <li><NavLink className="dropdown-item" to="/san/aliases">Aliases</NavLink></li>
                <li><NavLink className="dropdown-item" to="/san/zones">Zones</NavLink></li>
              </ul>
            </li>

            {/* Storage Dropdown */}
            <li className="nav-item dropdown">
              <Link 
                className="nav-link dropdown-toggle" 
                to="#" 
                id="storageDropdown" 
                role="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
              >
                Storage
              </Link>
              <ul className="dropdown-menu" aria-labelledby="storageDropdown">
                <li><NavLink className="dropdown-item" to="/storage">DS8000</NavLink></li>
                <li><NavLink className="dropdown-item" to="/storage">FlashSystem</NavLink></li>
              </ul>
            </li>

            <li className="nav-item">
              <NavLink className="nav-link" to="/config">Config</NavLink>
            </li>

            {/* ✅ Django Admin Link (Opens in a New Tab) */}
            <li className="nav-item">
              <a className="nav-link" href="http://127.0.0.1:8000/admin/" target="_blank" rel="noopener noreferrer">
                Admin
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;