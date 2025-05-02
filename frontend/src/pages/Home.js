import React, { useState, useEffect } from "react";
import { 
  FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, 
  FaServer, FaTools, FaExternalLinkAlt, FaCheckCircle, 
  FaTimesCircle, FaBars, FaChartLine, FaInfoCircle
} from "react-icons/fa";
import { ConfigContext } from "../context/ConfigContext";
// Chart components
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  // State for the dashboard data
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    customer: { 
      name: "XYZ Corporation", 
      insights_tenant: "xyz123", 
      insights_api_key: true 
    },
    active_project: { name: "SAN Migration 2025" }
  });
  
  const [stats, setStats] = useState({
    fabricCount: 6,
    brocadeFabricCount: 4,
    ciscoFabricCount: 2,
    aliasCount: 124,
    zoneCount: 48,
    ds8000Count: 2,
    flashSystemCount: 3,
    otherStorageCount: 1
  });

  // Mock data for charts
  const fabricData = [
    { name: 'Brocade', value: stats.brocadeFabricCount, color: '#dc3545' },
    { name: 'Cisco', value: stats.ciscoFabricCount, color: '#0dcaf0' }
  ];

  const storageData = [
    { name: 'DS8000', value: stats.ds8000Count, color: '#6610f2' },
    { name: 'FlashSystem', value: stats.flashSystemCount, color: '#fd7e14' },
    { name: 'Other', value: stats.otherStorageCount, color: '#20c997' }
  ];

  const zoneAliasComparisonData = [
    { name: 'Fabrics', count: stats.fabricCount, color: '#0d6efd' },
    { name: 'Zones', count: stats.zoneCount, color: '#ffc107' },
    { name: 'Aliases', count: stats.aliasCount, color: '#198754' }
  ];

  // Activity trend mock data
  const activityTrendData = [
    { day: 'Mon', zones: 5, aliases: 12 },
    { day: 'Tue', zones: 7, aliases: 8 },
    { day: 'Wed', zones: 10, aliases: 15 },
    { day: 'Thu', zones: 8, aliases: 10 },
    { day: 'Fri', zones: 12, aliases: 18 },
    { day: 'Today', zones: 9, aliases: 14 }
  ];

  // Quick actions
  const quickActions = [
    { title: "Configure", icon: <FaCogs className="quick-action-icon" />, path: "/config" },
    { title: "Fabrics", icon: <FaNetworkWired className="quick-action-icon" />, path: "/san/fabrics" },
    { title: "Aliases", icon: <FaAddressBook className="quick-action-icon" />, path: "/san/aliases" },
    { title: "Zones", icon: <FaProjectDiagram className="quick-action-icon" />, path: "/san/zones" },
    { title: "Storage", icon: <FaServer className="quick-action-icon" />, path: "/storage" },
    { title: "Tools", icon: <FaTools className="quick-action-icon" />, path: "/tools" }
  ];

  // Dummy link component for demo
  const NavLink = ({ to, children, className }) => (
    <a href={to} className={className}>{children}</a>
  );

  return (
    <div className="dashboard-container bg-light p-4">
      {loading ? (
        <div className="loading-overlay d-flex justify-content-center align-items-center bg-white bg-opacity-75 position-absolute top-0 start-0 w-100 h-100 rounded">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="ms-3 mb-0">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Customer & Project Info Card */}
          <div className="dashboard-header mb-4">
            <div className="customer-project-card bg-white rounded shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-3 mb-md-0">
                    <h5 className="text-muted mb-1 small text-uppercase">Active Customer</h5>
                    <h3 className="fw-bold">{config?.customer?.name || "No Customer Selected"}</h3>
                  </div>
                  <div className="vertical-divider d-none d-md-block" style={{ width: "1px", height: "50px", background: "#e0e0e0" }}></div>
                  <div className="mb-3 mb-md-0">
                    <h5 className="text-muted mb-1 small text-uppercase">Active Project</h5>
                    <h3 className="fw-bold">{config?.active_project?.name || "No Project Selected"}</h3>
                  </div>
                  <div className="vertical-divider d-none d-md-block" style={{ width: "1px", height: "50px", background: "#e0e0e0" }}></div>
                  <div>
                    <h5 className="text-muted mb-1 small text-uppercase">IBM Storage Insights</h5>
                    <div className="d-flex align-items-center">
                      {config?.customer?.insights_tenant ? (
                        <a
                          href={`https://insights.ibm.com/cui/${config.customer.insights_tenant}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-decoration-none fw-medium"
                        >
                          {config.customer.insights_tenant} <FaExternalLinkAlt size={12} />
                        </a>
                      ) : (
                        <span className="text-muted">Not configured</span>
                      )}
                      <div className="ms-3">
                        {config?.customer?.insights_api_key ? (
                          <span className="badge bg-success d-flex align-items-center">
                            <FaCheckCircle className="me-1" /> API Key
                          </span>
                        ) : (
                          <span className="badge bg-danger d-flex align-items-center">
                            <FaTimesCircle className="me-1" /> No API Key
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Main Content */}
          <div className="dashboard-content">
            <div className="row">
              {/* Left column - 8 units */}
              <div className="col-lg-8">
                {/* Key Metrics Section */}
                <div className="row mb-4">
                  {/* Fabric Count */}
                  <div className="col-md-4 mb-4 mb-md-0">
                    <div className="bg-white rounded shadow-sm p-4 h-100 position-relative">
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle p-3 me-3" style={{ backgroundColor: "rgba(13, 110, 253, 0.1)" }}>
                          <FaNetworkWired className="text-primary" size={24} />
                        </div>
                        <div>
                          <h3 className="fw-bold mb-0">{stats.fabricCount}</h3>
                          <p className="text-muted mb-0">SAN Fabrics</p>
                        </div>
                      </div>
                      <NavLink to="/san/fabrics" className="position-absolute top-0 end-0 m-3 text-muted">
                        <FaBars />
                      </NavLink>
                    </div>
                  </div>
                  
                  {/* Alias Count */}
                  <div className="col-md-4 mb-4 mb-md-0">
                    <div className="bg-white rounded shadow-sm p-4 h-100 position-relative">
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle p-3 me-3" style={{ backgroundColor: "rgba(25, 135, 84, 0.1)" }}>
                          <FaAddressBook className="text-success" size={24} />
                        </div>
                        <div>
                          <h3 className="fw-bold mb-0">{stats.aliasCount}</h3>
                          <p className="text-muted mb-0">Aliases</p>
                        </div>
                      </div>
                      <NavLink to="/san/aliases" className="position-absolute top-0 end-0 m-3 text-muted">
                        <FaBars />
                      </NavLink>
                    </div>
                  </div>
                  
                  {/* Zone Count */}
                  <div className="col-md-4">
                    <div className="bg-white rounded shadow-sm p-4 h-100 position-relative">
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle p-3 me-3" style={{ backgroundColor: "rgba(255, 193, 7, 0.1)" }}>
                          <FaProjectDiagram className="text-warning" size={24} />
                        </div>
                        <div>
                          <h3 className="fw-bold mb-0">{stats.zoneCount}</h3>
                          <p className="text-muted mb-0">Zones</p>
                        </div>
                      </div>
                      <NavLink to="/san/zones" className="position-absolute top-0 end-0 m-3 text-muted">
                        <FaBars />
                      </NavLink>
                    </div>
                  </div>
                </div>

                {/* Activity Trend Chart */}
                <div className="bg-white rounded shadow-sm mb-4 p-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0"><FaChartLine className="me-2 text-primary" /> Activity Trend</h5>
                    <div>
                      <button className="btn btn-sm btn-outline-secondary">This Week</button>
                    </div>
                  </div>
                  <div style={{ height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activityTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="zones" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="aliases" stroke="#82ca9d" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* SAN Resources Comparison */}
                <div className="bg-white rounded shadow-sm p-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0"><FaInfoCircle className="me-2 text-primary" /> SAN Resources Overview</h5>
                  </div>
                  <div style={{ height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zoneAliasComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="Count">
                          {zoneAliasComparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Right column - 4 units */}
              <div className="col-lg-4">
                {/* Quick Actions */}
                <div className="bg-white rounded shadow-sm mb-4">
                  <div className="p-3 border-bottom">
                    <h5 className="mb-0">Quick Actions</h5>
                  </div>
                  <div className="p-3">
                    <div className="d-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "15px" }}>
                      {quickActions.map((action, index) => (
                        <NavLink key={index} to={action.path} className="text-decoration-none">
                          <div className="p-3 rounded text-center transition-all hover-shadow" style={{ border: "1px solid #e0e0e0" }}>
                            <div className="mb-2">
                              {React.cloneElement(action.icon, { size: 24, className: "text-primary" })}
                            </div>
                            <span className="d-block text-dark">{action.title}</span>
                          </div>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fabric Distribution */}
                <div className="bg-white rounded shadow-sm mb-4 p-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Fabric Distribution</h5>
                  </div>
                  <div className="text-center" style={{ height: "200px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fabricData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {fabricData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="d-flex justify-content-center mt-2">
                      {fabricData.map((entry, index) => (
                        <div key={index} className="d-flex align-items-center me-3">
                          <div className="rounded-circle me-1" style={{ width: "12px", height: "12px", backgroundColor: entry.color }}></div>
                          <span className="small">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Storage Distribution */}
                <div className="bg-white rounded shadow-sm p-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Storage Distribution</h5>
                  </div>
                  <div className="text-center" style={{ height: "200px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={storageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {storageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="d-flex justify-content-center mt-2">
                      {storageData.map((entry, index) => (
                        <div key={index} className="d-flex align-items-center me-3">
                          <div className="rounded-circle me-1" style={{ width: "12px", height: "12px", backgroundColor: entry.color }}></div>
                          <span className="small">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Status Summary */}
                <div className="bg-white rounded shadow-sm p-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">System Status</h5>
                  </div>
                  <div className="list-group list-group-flush">
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <span>Backend API</span>
                      <span className="badge bg-success rounded-pill">Online</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <span>IBM Storage Insights</span>
                      <span className="badge bg-success rounded-pill">Connected</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <span>Last Data Sync</span>
                      <span className="text-muted small">Today, 14:30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <style jsx>{`
        .hover-shadow:hover {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
          transform: translateY(-3px);
        }
        .transition-all {
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;