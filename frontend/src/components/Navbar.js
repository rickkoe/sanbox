import React from "react";
import { NavLink } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap styles

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        {/* Left-aligned Brand */}
        <NavLink className="navbar-brand" to="/">SANBox</NavLink>

        {/* Mobile Navbar Toggle Button */}
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

        {/* Right-aligned Nav Links */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>Home</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/customers">Customers</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/san">SAN</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/storage">Storage</NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;