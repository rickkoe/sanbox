import React from "react";
import { FaNetworkWired, FaAddressBook, FaProjectDiagram } from "react-icons/fa";

const SanPage = () => {
  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">SAN Tables</h1>
      
      <div className="row">
        {/* Fabrics Card */}
        <div className="col-md-4 mb-4">
          <a href="/san/fabrics" className="home-card card text-center h-100">
            <div className="card-body">
              <FaNetworkWired size={48} className="home-icon mb-3" />
              <h5 className="card-title">Fabrics</h5>
              <p className="card-text">Manage your fabric configurations.</p>
            </div>
          </a>
        </div>
        
        {/* Aliases Card */}
        <div className="col-md-4 mb-4">
          <a href="/san/aliases" className="home-card card text-center h-100">
            <div className="card-body">
              <FaAddressBook size={48} className="home-icon mb-3" />
              <h5 className="card-title">Aliases</h5>
              <p className="card-text">View and update device aliases.</p>
            </div>
          </a>
        </div>
        
        {/* Zones Card */}
        <div className="col-md-4 mb-4">
          <a href="/san/zones" className="home-card card text-center h-100">
            <div className="card-body">
              <FaProjectDiagram size={48} className="home-icon mb-3" />
              <h5 className="card-title">Zones</h5>
              <p className="card-text">Configure SAN zoning policies.</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default SanPage;
