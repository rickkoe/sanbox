import React from "react";
import { NavLink } from "react-router-dom";
import { FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, FaServer, FaTools } from "react-icons/fa";
import "../styles/pages.css";

const Home = () => {
  return (
    <div className="container mt-5">
      {/* Hero Section */}
      <div className="hero text-center mb-5">
        <h1>Welcome to SANBox</h1>
        <p>Your unified dashboard for SAN and Storage scripts.</p>
      </div>

      {/* Quick Access Cards */}
      <div className="quick-access">
        <h2 className="mb-4">Quick Access</h2>
        <div className="row">
          {/* Config Card (should be first) */}
          <div className="col-md-4 mb-4">
            <NavLink to="/config" className="home-card card text-center h-100">
              <div className="card-body">
                <FaCogs size={48} className="home-icon mb-3" />
                <h5 className="card-title">Config</h5>
                <p className="card-text">Set your active customer and project.</p>
              </div>
            </NavLink>
          </div>
          {/* Fabrics Card */}
          <div className="col-md-4 mb-4">
            <NavLink to="/san/fabrics" className="home-card card text-center h-100">
              <div className="card-body">
                <FaNetworkWired size={48} className="home-icon mb-3" />
                <h5 className="card-title">Fabrics</h5>
                <p className="card-text">Define fabrics to use with zoning scripts.</p>
              </div>
            </NavLink>
          </div>
          {/* Aliases Card */}
          <div className="col-md-4 mb-4">
            <NavLink to="/san/aliases" className="home-card card text-center h-100">
              <div className="card-body">
                <FaAddressBook size={48} className="home-icon mb-3" />
                <h5 className="card-title">Aliases</h5>
                <p className="card-text">Define aliases to use with zoning scripts.</p>
              </div>
            </NavLink>
          </div>
          {/* Zones Card */}
          <div className="col-md-4 mb-4">
            <NavLink to="/san/zones" className="home-card card text-center h-100">
              <div className="card-body">
                <FaProjectDiagram size={48} className="home-icon mb-3" />
                <h5 className="card-title">Zones</h5>
                <p className="card-text">Define zones and generate scripts.</p>
              </div>
            </NavLink>
          </div>
          {/* Storage Card */}
          <div className="col-md-4 mb-4">
            <NavLink to="/storage" className="home-card card text-center h-100 under-construction">
              <div className="card-body">
                <FaServer size={48} className="home-icon mb-3" />
                <h5 className="card-title">Storage</h5>
                {/* <p className="card-text">Under Construction.</p> */}
              </div>
            </NavLink>
          </div>
          {/* Tools Card */}
          <div className="col-md-4 mb-4">
            <NavLink to="/tools" className="home-card card text-center h-100">
              <div className="card-body">
                <FaTools size={48} className="home-icon mb-3" />
                <h5 className="card-title">Tools</h5>
                <p className="card-text">Useful tools and calculators.</p>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;