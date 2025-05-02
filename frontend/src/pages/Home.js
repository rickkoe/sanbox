import React, { useContext } from "react";
import { useState, useEffect } from "react";
import axios from "axios";
import { NavLink } from "react-router-dom";
import { FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, FaServer, FaTools } from "react-icons/fa";
import "../styles/pages.css";
import { ConfigContext } from "../context/ConfigContext";
import Spinner from "react-bootstrap/Spinner";

const Home = () => {
  const { config, loading } = useContext(ConfigContext);

  const [fabricCount, setFabricCount] = useState(0);
  const [brocadeFabricCount, setBrocadeFabricCount] = useState(0);
  const [ciscoFabricCount, setCiscoFabricCount] = useState(0);
  const [aliasCount, setAliasCount] = useState(0);
  const [zoneCount, setZoneCount] = useState(0);
  const [ds8000Count, setDs8000Count] = useState(0);
  const [flashSystemCount, setFlashSystemCount] = useState(0);

  const fetchCounts = async () => {
    try {
      // Fetch SAN counts
      const fabrics = await axios.get(`http://127.0.0.1:8000/api/san/fabrics/customer/${config?.customer?.id}/`);
      const aliases = await axios.get(`http://127.0.0.1:8000/api/san/aliases/project/${config?.active_project?.id}/`);
      const zones = await axios.get(`http://127.0.0.1:8000/api/san/zones/project/${config?.active_project?.id}/`);
      
      // Fetch storage counts
      const storage = await axios.get(`http://127.0.0.1:8000/api/storage/?customer=${config?.customer?.id}`);
      
      // Set SAN counts
      setFabricCount(fabrics.data.length);
      setAliasCount(aliases.data.length);
      setZoneCount(zones.data.length);
      
      // Count fabrics by vendor type
      const brocadeFabrics = fabrics.data.filter(fabric => fabric.san_vendor === "BR").length;
      const ciscoFabrics = fabrics.data.filter(fabric => fabric.san_vendor === "CI").length;
      
      setBrocadeFabricCount(brocadeFabrics);
      setCiscoFabricCount(ciscoFabrics);
      
      // Count storage by type
      const ds8000 = storage.data.filter(item => item.storage_type === "DS8000").length;
      const flashSystem = storage.data.filter(item => item.storage_type === "FlashSystem").length;
      
      setDs8000Count(ds8000);
      setFlashSystemCount(flashSystem);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  useEffect(() => {
    if (!loading && config?.customer?.id) {
      fetchCounts();
    }
  }, [loading, config]);

  const animatedCount = (target) => {
    // Simple placeholder animation - you can later replace it with react-countup
    return target;
  };

  return (
    <div className="container mt-2">
      {/* Loading Spinner */}
      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* Active Customer & Project */}
          <div className="dashboard-section mb-5">
            <h3 className="dashboard-section-title mb-4">
              Active Customer & Project
            </h3>
            <div className="card p-4 shadow-sm card-hover">
              <div className="row">
                <div className="col-md-6 mb-3 mb-md-0">
                  <h5>
                    <strong>Customer: </strong>
                    {config?.customer?.name || "N/A"}
                  </h5>
                  <h5>
                    <strong>Project: </strong>
                    {config?.active_project?.name || "N/A"}
                  </h5>
                </div>
                <div className="col-md-6 text-md-end">
                  <h6>
                    Storage Insights Tenant:&nbsp;
                    {config?.customer?.insights_tenant ? (
                      <a
                        href={`https://insights.ibm.com/cui/${config.customer.insights_tenant}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {config.customer.insights_tenant}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </h6>
                  <h6>
                    API Key Exists:&nbsp;
                    {config?.customer?.insights_api_key ? (
                      <span
                        className="api-indicator"
                        style={{ color: "green" }}
                      >
                        ✅
                      </span>
                    ) : (
                      <span className="api-indicator" style={{ color: "red" }}>
                        ❌
                      </span>
                    )}
                  </h6>
                </div>
              </div>
            </div>
          </div>

          {/* SAN Summary */}
          <div className="dashboard-section mb-5">
            <h3 className="dashboard-section-title mb-4">SAN Summary</h3>
            <div className="row">
              {/* Fabrics Card */}
              <div className="col-md-4 mb-4">
                <div className="card text-center p-4 shadow-sm card-hover">
                  <h5>Fabrics</h5>
                  <NavLink to="/san/fabrics">
                    <h2 className="dashboard-count-link">
                      {animatedCount(fabricCount)}
                    </h2>
                  </NavLink>
                  <div className="mt-2">
                    {brocadeFabricCount > 0 && (
                      <div className="badge bg-danger text-light m-1">
                        Brocade: {brocadeFabricCount}
                      </div>
                    )}
                    {ciscoFabricCount > 0 && (
                      <div className="badge bg-info text-dark m-1">
                        Cisco: {ciscoFabricCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md-4 mb-4">
                <div className="card text-center p-4 shadow-sm card-hover">
                  <h5>Aliases</h5>
                  <NavLink to="/san/aliases">
                    <h2 className="dashboard-count-link">
                      {animatedCount(aliasCount)}
                    </h2>
                  </NavLink>
                </div>
              </div>
              <div className="col-md-4 mb-4">
                <div className="card text-center p-4 shadow-sm card-hover">
                  <h5>Zones</h5>
                  <NavLink to="/san/zones">
                    <h2 className="dashboard-count-link">
                      {animatedCount(zoneCount)}
                    </h2>
                  </NavLink>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Summary */}
          <div className="dashboard-section mb-5">
            <h3 className="dashboard-section-title mb-4">Storage Summary</h3>
            <div className="row">
              {ds8000Count > 0 && (
                <div className="col-md-4 mb-4">
                  <div className="card text-center p-4 shadow-sm card-hover">
                    <h5>DS8000</h5>
                    <NavLink to="/storage">
                      <h2 className="dashboard-count-link">
                        {animatedCount(ds8000Count)}
                      </h2>
                    </NavLink>
                  </div>
                </div>
              )}
              {flashSystemCount > 0 && (
                <div className="col-md-4 mb-4">
                  <div className="card text-center p-4 shadow-sm card-hover">
                    <h5>FlashSystem</h5>
                    <NavLink to="/storage">
                      <h2 className="dashboard-count-link">
                        {animatedCount(flashSystemCount)}
                      </h2>
                    </NavLink>
                  </div>
                </div>
              )}
              {ds8000Count === 0 && flashSystemCount === 0 && (
                <div className="col-md-12 mb-4">
                  <div className="card text-center p-4 shadow-sm">
                    <h5>No storage systems configured</h5>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shortcuts */}
          <div className="dashboard-section mb-5">
            <h3 className="dashboard-section-title mb-4">Shortcuts</h3>
            <div className="row">
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/config"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaCogs size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Config</h6>
                  </div>
                </NavLink>
              </div>
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/san/fabrics"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaNetworkWired size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Fabrics</h6>
                  </div>
                </NavLink>
              </div>
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/san/aliases"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaAddressBook size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Aliases</h6>
                  </div>
                </NavLink>
              </div>
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/san/zones"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaProjectDiagram size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Zones</h6>
                  </div>
                </NavLink>
              </div>
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/storage"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaServer size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Storage</h6>
                  </div>
                </NavLink>
              </div>
              <div className="col-md-4 mb-4">
                <NavLink
                  to="/tools"
                  className="home-card card text-center h-100 p-4 shadow-sm card-hover"
                >
                  <div className="card-body">
                    <FaTools size={36} className="home-icon mb-3" />
                    <h6 className="card-title">Tools</h6>
                  </div>
                </NavLink>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;