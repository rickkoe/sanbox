import React from "react";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const SanNavbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-secondary">
      <div className="container">
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#sanNavbarNav"
          aria-controls="sanNavbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="sanNavbarNav">
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
        </div>
      </div>
    </nav>
  );
};

export default SanNavbar;