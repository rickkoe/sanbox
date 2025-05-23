import React from "react";
import { NavLink } from "react-router-dom";
import { FaServer, FaCalculator } from "react-icons/fa";
import "../styles/tools.css";

const ToolsPage = () => {
  return (
    <div className="container mt-5">
      <h1 className="mb-4 text-center">Tools</h1>
      <div className="row">
        {/* WWPN Colonizer Tool */}
        <div className="col-md-6 mb-4">
          <NavLink to="/tools/wwpn-colonizer" className="home-card card text-center h-100">
            <div className="card-body">
              <FaServer size={48} className="home-icon mb-3" />
              <h5 className="card-title">WWPN Colonizer</h5>
              <p className="card-text">Run the WWPN Colonizer tool to manage your SAN ports.</p>
            </div>
          </NavLink>
        </div>
        {/* Storage Calculators Tool */}
        <div className="col-md-6 mb-4">
          <NavLink to="/tools/ibm-storage-calculator" className="home-card card text-center h-100">
            <div className="card-body">
              <FaCalculator size={48} className="home-icon mb-3" />
              <h5 className="card-title">Storage Calculators</h5>
              <p className="card-text">Access calculators for your storage configurations.</p>
            </div>
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;