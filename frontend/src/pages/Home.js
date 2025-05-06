import React, { useState, useEffect, useContext } from "react";
import { 
  FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, 
  FaServer, FaTools, FaExternalLinkAlt, FaCheckCircle, 
  FaTimesCircle, FaBars, FaChartLine, FaInfoCircle
} from "react-icons/fa";
import { ConfigContext } from "../context/ConfigContext";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const Dashboard = () => {
  // Get real config from context
  const { config, loading: configLoading } = useContext(ConfigContext);
  
  // State for dashboard data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    fabricCount: 0,
    brocadeFabricCount: 0,
    ciscoFabricCount: 0,
    aliasCount: 0,
    zoneCount: 0,
    ds8000Count: 0,
    flashSystemCount: 0,
    otherStorageCount: 0
  });
  
  // Storage capacity trends data
  const [storageCapacityData, setStorageCapacityData] = useState([]);

  // Fetch statistics when config is loaded
  useEffect(() => {
    if (!config || !config.customer?.id) {
      return;
    }
    
    setLoading(true);
    
    // Fetch SAN fabrics data
    const fetchFabrics = axios.get(`http://127.0.0.1:8000/api/san/fabrics/customer/${config.customer.id}/`);
    
    // Fetch zones for active project
    const fetchZones = config.active_project?.id 
      ? axios.get(`http://127.0.0.1:8000/api/san/zones/project/${config.active_project.id}/`)
      : Promise.resolve({ data: [] });
    
    // Fetch aliases for active project
    const fetchAliases = config.active_project?.id
      ? axios.get(`http://127.0.0.1:8000/api/san/aliases/project/${config.active_project.id}/`)
      : Promise.resolve({ data: [] });
    
    // Fetch storage systems
    const fetchStorage = axios.get(`http://127.0.0.1:8000/api/storage/?customer=${config.customer.id}`);
    
    // Run all requests in parallel and process results
    Promise.all([fetchFabrics, fetchZones, fetchAliases, fetchStorage])
      .then(([fabricsRes, zonesRes, aliasesRes, storageRes]) => {
        const fabrics = fabricsRes.data || [];
        const zones = zonesRes.data || [];
        const aliases = aliasesRes.data || [];
        const storage = storageRes.data || [];
        
        // Count by types
        const brocadeFabrics = fabrics.filter(f => f.san_vendor === 'BR');
        const ciscoFabrics = fabrics.filter(f => f.san_vendor === 'CI');
        const ds8000Systems = storage.filter(s => s.storage_type === 'DS8000');
        const flashSystems = storage.filter(s => s.storage_type === 'FlashSystem');
        const otherStorage = storage.filter(s => 
          s.storage_type !== 'DS8000' && s.storage_type !== 'FlashSystem');
        
        // Update statistics
        setStats({
          fabricCount: fabrics.length,
          brocadeFabricCount: brocadeFabrics.length,
          ciscoFabricCount: ciscoFabrics.length,
          aliasCount: aliases.length,
          zoneCount: zones.length,
          ds8000Count: ds8000Systems.length,
          flashSystemCount: flashSystems.length,
          otherStorageCount: otherStorage.length
        });
        
        // Generate storage capacity trend data
        // In a real application, this would come from an API endpoint
        // providing historical capacity usage data
        const today = new Date();
        const capacityData = [
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 6, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 120,
            usedTB: 65,
            forecastTB: 68
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 5, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 120,
            usedTB: 72,
            forecastTB: 75
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 4, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 120,
            usedTB: 78,
            forecastTB: 82
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 3, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 150,
            usedTB: 85,
            forecastTB: 90
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 2, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 150,
            usedTB: 92,
            forecastTB: 98
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 150,
            usedTB: 105,
            forecastTB: 110
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth(), 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 180,
            usedTB: 115,
            forecastTB: 122
          },
          // Forecasted future months
          { 
            month: new Date(today.getFullYear(), today.getMonth() + 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 180,
            forecastTB: 133
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() + 2, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 180,
            forecastTB: 145
          },
          { 
            month: new Date(today.getFullYear(), today.getMonth() + 3, 1).toLocaleString('default', { month: 'short', year: 'numeric' }),
            totalTB: 180,
            forecastTB: 158
          }
        ];
        
        setStorageCapacityData(capacityData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to fetch dashboard data");
        setLoading(false);
      });
      
  }, [config]);

  // Prepare chart data from stats
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

  // Quick actions
  const quickActions = [
    { title: "Configure", icon: <FaCogs size={24} className="text-primary" />, path: "/config" },
    { title: "Fabrics", icon: <FaNetworkWired size={24} className="text-primary" />, path: "/san/fabrics" },
    { title: "Aliases", icon: <FaAddressBook size={24} className="text-primary" />, path: "/san/aliases" },
    { title: "Zones", icon: <FaProjectDiagram size={24} className="text-primary" />, path: "/san/zones" },
    { title: "Storage", icon: <FaServer size={24} className="text-primary" />, path: "/storage" },
    { title: "Tools", icon: <FaTools size={24} className="text-primary" />, path: "/tools" }
  ];

  if (loading || configLoading) {
    return (
      <div className="dashboard-container bg-light p-4">
        <div className="loading-overlay d-flex justify-content-center align-items-center bg-white bg-opacity-75 position-absolute top-0 start-0 w-100 h-100 rounded">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="ms-3 mb-0">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container bg-light p-4">
        <div className="alert alert-danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container bg-light p-4">
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
                  <Link to="/san/fabrics" className="position-absolute top-0 end-0 m-3 text-muted">
                    <FaBars />
                  </Link>
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
                  <Link to="/san/aliases" className="position-absolute top-0 end-0 m-3 text-muted">
                    <FaBars />
                  </Link>
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
                  <Link to="/san/zones" className="position-absolute top-0 end-0 m-3 text-muted">
                    <FaBars />
                  </Link>
                </div>
              </div>
            </div>

            {/* Storage Capacity Trends chart replacing Activity Trend */}
            <div className="bg-white rounded shadow-sm mb-4 p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0"><FaChartLine className="me-2 text-primary" /> Storage Capacity Trends & Forecast</h5>
                <div>
                  <button className="btn btn-sm btn-outline-secondary">6-Month View</button>
                </div>
              </div>
              <div style={{ height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={storageCapacityData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" />
                    <YAxis label={{ value: 'Terabytes (TB)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value} TB`, value === undefined ? 'Forecast' : null]} />
                    <Legend />
                    <defs>
                      <linearGradient id="totalColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="usedColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.2}/>
                      </linearGradient>
                      <linearGradient id="forecastColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ffc658" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="totalTB" 
                      stroke="#8884d8" 
                      fill="url(#totalColor)" 
                      name="Total Capacity"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="usedTB" 
                      stroke="#82ca9d" 
                      fill="url(#usedColor)" 
                      name="Used Capacity"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="forecastTB" 
                      stroke="#ffc658" 
                      strokeDasharray="5 5"
                      fill="url(#forecastColor)" 
                      name="Forecasted Usage"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-muted text-center small mt-2">
                Based on recent growth patterns, storage capacity should be expanded within the next 2 months.
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
                    <Link key={index} to={action.path} className="text-decoration-none">
                      <div className="p-3 rounded text-center transition-all hover-shadow" style={{ border: "1px solid #e0e0e0" }}>
                        <div className="mb-2">
                          {action.icon}
                        </div>
                        <span className="d-block text-dark">{action.title}</span>
                      </div>
                    </Link>
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
                  <span className="text-muted small">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;