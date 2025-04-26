import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, FaServer, FaTools } from "react-icons/fa";
import "../styles/pages.css";
import { ConfigContext } from "../context/ConfigContext";

const Home = () => {
  const { config, loading } = useContext(ConfigContext);
  return (
    <div className="container mt-5">
      {/* Active Customer & Project */}
      <div className="dashboard-section mb-5">
        <h4 className="dashboard-section-title">Active Customer & Project</h4>
        <div className="card text-center p-4">
        <h5>Customer: {config?.customer?.name || "N/A"}</h5>
        <h5>Project: {config?.active_project?.name || "N/A"}</h5>
        </div>
      </div>

      {/* SAN Summary */}
      <div className="dashboard-section mb-5">
        <h4 className="dashboard-section-title">SAN Summary</h4>
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card text-center p-3">
              <h5>Total Fabrics</h5>
              <p>0</p> {/* Placeholder */}
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card text-center p-3">
              <h5>Total Aliases</h5>
              <p>0</p> {/* Placeholder */}
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card text-center p-3">
              <h5>Total Zones</h5>
              <p>0</p> {/* Placeholder */}
            </div>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="dashboard-section mb-5">
        <h4 className="dashboard-section-title">Shortcuts</h4>
        <div className="row">
          <div className="col-md-4 mb-4">
            <NavLink to="/config" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaCogs size={32} className="home-icon mb-2" />
                <h6 className="card-title">Config</h6>
              </div>
            </NavLink>
          </div>
          <div className="col-md-4 mb-4">
            <NavLink to="/san/fabrics" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaNetworkWired size={32} className="home-icon mb-2" />
                <h6 className="card-title">Fabrics</h6>
              </div>
            </NavLink>
          </div>
          <div className="col-md-4 mb-4">
            <NavLink to="/san/aliases" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaAddressBook size={32} className="home-icon mb-2" />
                <h6 className="card-title">Aliases</h6>
              </div>
            </NavLink>
          </div>
          <div className="col-md-4 mb-4">
            <NavLink to="/san/zones" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaProjectDiagram size={32} className="home-icon mb-2" />
                <h6 className="card-title">Zones</h6>
              </div>
            </NavLink>
          </div>
          <div className="col-md-4 mb-4">
            <NavLink to="/storage" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaServer size={32} className="home-icon mb-2" />
                <h6 className="card-title">Storage</h6>
              </div>
            </NavLink>
          </div>
          <div className="col-md-4 mb-4">
            <NavLink to="/tools" className="home-card card text-center h-100 p-3">
              <div className="card-body">
                <FaTools size={32} className="home-icon mb-2" />
                <h6 className="card-title">Tools</h6>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;