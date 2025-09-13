import React from "react";
import { NavLink } from "react-router-dom";
import { FaServer, FaDesktop } from "react-icons/fa";
import "../styles/tools.css";

const StorageLandingPage = () => {
  return (
    <div className="container mt-5">
      <h1 className="mb-4 text-center">Storage Management</h1>
      <div className="row">
        {/* Storage Systems */}
        <div className="col-md-6 mb-4">
          <NavLink to="/storage/systems" className="home-card card text-center h-100">
            <div className="card-body">
              <FaServer size={48} className="home-icon mb-3" />
              <h5 className="card-title">Storage Systems</h5>
              <p className="card-text">Manage and view your storage systems, including configuration and monitoring.</p>
            </div>
          </NavLink>
        </div>
        {/* Storage Hosts */}
        <div className="col-md-6 mb-4">
          <NavLink to="/storage/hosts" className="home-card card text-center h-100">
            <div className="card-body">
              <FaDesktop size={48} className="home-icon mb-3" />
              <h5 className="card-title">Hosts</h5>
              <p className="card-text">View and manage hosts connected to your storage infrastructure.</p>
            </div>
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default StorageLandingPage;