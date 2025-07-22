
import React from "react";
import { FaDatabase, FaServer, FaNetworkWired } from "react-icons/fa";

const ScriptsPage = () => {
  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">Script Builder</h1>
      
      <div className="row">
        {/* DS8000 Scripts Card */}
        <div className="col-md-4 mb-4">
          <a href="/scripts/ds8000" className="home-card card text-center h-100">
            <div className="card-body">
              <FaDatabase size={48} className="home-icon mb-3" />
              <h5 className="card-title">DS8000 DSCLI Scripts</h5>
              <p className="card-text">Build and customize DSCLI scripts for IBM DS8000 storage systems.</p>
            </div>
          </a>
        </div>
        
        {/* FlashSystem Scripts Card */}
        <div className="col-md-4 mb-4">
          <a href="/scripts/flashsystem" className="home-card card text-center h-100">
            <div className="card-body">
              <FaServer size={48} className="home-icon mb-3" />
              <h5 className="card-title">FlashSystem Scripts</h5>
              <p className="card-text">Generate scripts for IBM FlashSystem storage management and automation.</p>
            </div>
          </a>
        </div>
        
        {/* SAN Zoning Scripts Card */}
        <div className="col-md-4 mb-4">
          <a href="/scripts/zoning" className="home-card card text-center h-100">
            <div className="card-body">
              <FaNetworkWired size={48} className="home-icon mb-3" />
              <h5 className="card-title">SAN Zoning Scripts</h5>
              <p className="card-text">Create SAN zoning scripts to simplify fabric configuration.</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ScriptsPage;