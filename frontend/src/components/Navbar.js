import React from "react";
import { NavLink, Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <NavLink className="navbar-brand" to="/">SANBox</NavLink>

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
              <NavLink className="nav-link" to="/">Home</NavLink>
            </li>
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
                <li><NavLink className="dropdown-item" to="/san/alias">Alias</NavLink></li>
                <li><NavLink className="dropdown-item" to="/san/zoning">Zoning</NavLink></li>
              </ul>
            </li>

            {/* Storage Link */}
            <li className="nav-item">
              <NavLink className="nav-link" to="/storage">Storage</NavLink>
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