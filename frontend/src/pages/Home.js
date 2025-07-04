import React, { useState, useEffect, useContext } from "react";
import { 
  FaCogs, FaNetworkWired, FaAddressBook, FaProjectDiagram, 
  FaServer, FaTools, FaExternalLinkAlt, FaCheckCircle, 
  FaTimesCircle, FaBuilding, FaChevronDown, FaChevronRight,
  FaPlus, FaEye, FaEdit, FaBars, FaInfoCircle, FaCloud,
  FaKey, FaGlobe, FaChartPie
} from "react-icons/fa";
import { ConfigContext } from "../context/ConfigContext";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const Dashboard = () => {
  const { config, loading: configLoading, setConfig } = useContext(ConfigContext);
  
  // State for dashboard data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [overallStats, setOverallStats] = useState({
    totalCustomers: 0,
    totalProjects: 0,
    totalFabrics: 0,
    totalZones: 0,
    totalAliases: 0,
    totalStorage: 0,
    connectedInsights: 0
  });

  // State for forcing re-renders
  const [refreshKey, setRefreshKey] = useState(0);

  // Color scheme for charts
  const colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1', '#fd7e14', '#20c997', '#6c757d'];

  // Extract the dashboard data fetching into a separate function
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Using your actual API endpoints
      console.log('Fetching customers...');
      let customersData = [];
      
      try {
        // Use your existing customer endpoint
        const customersRes = await axios.get('/api/core/customers/');
        customersData = Array.isArray(customersRes.data) ? customersRes.data : 
                       customersRes.data.results || [];
      } catch (customerError) {
        console.warn('Error fetching customers:', customerError);
        // If customers endpoint doesn't exist, we can derive customers from config
        if (config?.customer) {
          customersData = [config.customer];
        }
      }
      
      console.log('Found customers:', customersData.length);
      
      // For each customer, fetch their projects and related data
      const customersWithData = await Promise.all(
        customersData.map(async (customer) => {
          console.log(`Processing customer: ${customer.name} (ID: ${customer.id})`);
          
          try {
            // Fetch projects for this customer using your existing endpoint
            console.log(`Fetching projects for customer ${customer.id}...`);
            let projects = [];
            try {
              const projectsRes = await axios.get(`/api/core/projects/${customer.id}/`);
              projects = Array.isArray(projectsRes.data) ? projectsRes.data : 
                        projectsRes.data.results || [];
            } catch (projError) {
              console.warn(`Error fetching projects for customer ${customer.id}:`, projError);
            }
            
            // Fetch fabrics for this customer using your existing endpoint
            console.log(`Fetching fabrics for customer ${customer.id}...`);
            let fabrics = [];
            try {
              const fabricsRes = await axios.get(`/api/san/fabrics/?customer_id=${customer.id}`);
              fabrics = Array.isArray(fabricsRes.data) ? fabricsRes.data :
                       fabricsRes.data.results || [];
            } catch (fabricError) {
              console.warn(`Error fetching fabrics for customer ${customer.id}:`, fabricError);
            }
            
            // Fetch storage for this customer using your existing endpoint
            console.log(`Fetching storage for customer ${customer.id}...`);
            let storage = [];
            try {
              const storageRes = await axios.get(`/api/storage/?customer=${customer.id}`);
              storage = Array.isArray(storageRes.data) ? storageRes.data :
                       storageRes.data.results || [];
            } catch (storageError) {
              console.warn(`Error fetching storage for customer ${customer.id}:`, storageError);
            }
            
            // For each project, fetch zones and aliases using your existing endpoints
            console.log(`Processing ${projects.length} projects for customer ${customer.id}...`);
            const projectsWithData = await Promise.all(
              projects.map(async (project) => {
                try {
                  console.log(`Fetching zones and aliases for project ${project.id}...`);
                  
                  // Fetch zones and aliases in parallel using your existing endpoints
                  const [zonesRes, aliasesRes] = await Promise.allSettled([
                    axios.get(`/api/san/zones/project/${project.id}/`),
                    axios.get(`/api/san/aliases/project/${project.id}/`)
                  ]);
                  
                  const zones = zonesRes.status === 'fulfilled' ? 
                    (Array.isArray(zonesRes.value.data) ? zonesRes.value.data : zonesRes.value.data.results || []) : [];
                  const aliases = aliasesRes.status === 'fulfilled' ? 
                    (Array.isArray(aliasesRes.value.data) ? aliasesRes.value.data : aliasesRes.value.data.results || []) : [];
                  
                  return {
                    ...project,
                    zones,
                    aliases,
                    zoneCount: zones.length,
                    aliasCount: aliases.length
                  };
                } catch (err) {
                  console.warn(`Error fetching data for project ${project.id}:`, err);
                  return {
                    ...project,
                    zones: [],
                    aliases: [],
                    zoneCount: 0,
                    aliasCount: 0
                  };
                }
              })
            );
            
            // Calculate customer-level stats
            const brocadeFabrics = fabrics.filter(f => f.san_vendor === 'BR').length;
            const ciscoFabrics = fabrics.filter(f => f.san_vendor === 'CI').length;
            const ds8000Count = storage.filter(s => s.storage_type === 'DS8000').length;
            const flashSystemCount = storage.filter(s => s.storage_type === 'FlashSystem').length;
            const otherStorageCount = storage.filter(s => 
              !['DS8000', 'FlashSystem'].includes(s.storage_type)).length;
            
            const totalZones = projectsWithData.reduce((sum, p) => sum + (p.zoneCount || 0), 0);
            const totalAliases = projectsWithData.reduce((sum, p) => sum + (p.aliasCount || 0), 0);
            
            console.log(`Customer ${customer.name} stats:`, {
              projects: projects.length,
              fabrics: fabrics.length,
              zones: totalZones,
              aliases: totalAliases,
              storage: storage.length
            });
            
            return {
              ...customer,
              projects: projectsWithData,
              fabrics,
              storage,
              stats: {
                projectCount: projects.length,
                fabricCount: fabrics.length,
                brocadeFabrics,
                ciscoFabrics,
                zoneCount: totalZones,
                aliasCount: totalAliases,
                storageCount: storage.length,
                ds8000Count,
                flashSystemCount,
                otherStorageCount,
                hasInsightsKey: !!customer.insights_api_key,
                hasInsightsTenant: !!customer.insights_tenant
              }
            };
          } catch (err) {
            console.error(`Error processing customer ${customer.id}:`, err);
            return {
              ...customer,
              projects: [],
              fabrics: [],
              storage: [],
              stats: {
                projectCount: 0,
                fabricCount: 0,
                brocadeFabrics: 0,
                ciscoFabrics: 0,
                zoneCount: 0,
                aliasCount: 0,
                storageCount: 0,
                ds8000Count: 0,
                flashSystemCount: 0,
                otherStorageCount: 0,
                hasInsightsKey: false,
                hasInsightsTenant: false
              }
            };
          }
        })
      );
      
      // Calculate overall stats
      const overallStats = customersWithData.reduce((totals, customer) => ({
        totalCustomers: totals.totalCustomers + 1,
        totalProjects: totals.totalProjects + customer.stats.projectCount,
        totalFabrics: totals.totalFabrics + customer.stats.fabricCount,
        totalZones: totals.totalZones + customer.stats.zoneCount,
        totalAliases: totals.totalAliases + customer.stats.aliasCount,
        totalStorage: totals.totalStorage + customer.stats.storageCount,
        connectedInsights: totals.connectedInsights + (customer.stats.hasInsightsKey ? 1 : 0)
      }), {
        totalCustomers: 0,
        totalProjects: 0,
        totalFabrics: 0,
        totalZones: 0,
        totalAliases: 0,
        totalStorage: 0,
        connectedInsights: 0
      });
      
      console.log('Overall stats:', overallStats);
      
      setCustomers(customersWithData);
      setOverallStats(overallStats);
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(`Failed to fetch dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, [config, refreshKey]); // Add refreshKey as dependency to trigger re-fetch

  const toggleCustomerExpansion = (customerId) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const handleSetActiveCustomer = async (customer, project = null) => {
    try {
      console.log('Setting active customer:', customer.name, project ? `and project: ${project.name}` : '');
      
      let targetProject = project;
      
      // If no specific project is provided, try to get the customer's existing active project
      if (!project) {
        try {
          const customerConfigResponse = await axios.get(`/api/core/config/customer/${customer.id}/`);
          if (customerConfigResponse.data && customerConfigResponse.data.active_project) {
            targetProject = customerConfigResponse.data.active_project;
            console.log(`Using existing active project for ${customer.name}:`, targetProject.name);
          }
        } catch (configError) {
          console.log(`No existing config found for customer ${customer.name}, will set without project`);
        }
      }
      
      // Prepare the payload similar to your ConfigForm
      const payload = {
        customer: String(customer.id),
        project: targetProject ? String(targetProject.id) : "",
        active_project_id: targetProject ? String(targetProject.id) : "",
        is_active: true,
        // Include existing config values to avoid overwriting them
        san_vendor: config?.san_vendor || "BR",
        cisco_alias: config?.cisco_alias || "device-alias", 
        cisco_zoning_mode: config?.cisco_zoning_mode || "enhanced",
        zone_ratio: config?.zone_ratio || "one-to-one",
        zoning_job_name: config?.zoning_job_name || "",
        alias_max_zones: config?.alias_max_zones || "",
      };
      
      console.log('Payload for config update:', payload);
      
      // Use the same API endpoint as your ConfigForm
      const updateCustomerUrl = `/api/core/config/update/${customer.id}/`;
      await axios.put(updateCustomerUrl, payload);
      
      console.log('✅ Config updated on backend, triggering full page reload...');
      
      // Force a complete page reload (like Cmd+R)
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error setting active customer/project:', error);
      // Even if there's an error, we might want to reload to ensure consistency
      window.location.reload();
    }
  };

  // Prepare chart data
  const fabricDistributionData = customers.map((customer, index) => ({
    name: customer.name,
    brocade: customer.stats.brocadeFabrics,
    cisco: customer.stats.ciscoFabrics,
    color: colors[index % colors.length]
  })).filter(item => item.brocade > 0 || item.cisco > 0);

  const storageDistributionData = customers.map((customer, index) => ({
    name: customer.name,
    ds8000: customer.stats.ds8000Count,
    flashSystem: customer.stats.flashSystemCount,
    other: customer.stats.otherStorageCount,
    color: colors[index % colors.length]
  })).filter(item => item.ds8000 > 0 || item.flashSystem > 0 || item.other > 0);

  const insightsConnectionData = [
    { name: 'Connected', value: overallStats.connectedInsights, color: '#198754' },
    { name: 'Not Connected', value: overallStats.totalCustomers - overallStats.connectedInsights, color: '#dc3545' }
  ];

  if (loading || configLoading) {
    return (
      <div className="modern-table-container">
        <div className="loading-container">
          <div className="loading-content">
            <div className="spinner large"></div>
            <span>Loading dashboard data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modern-table-container">
        <div className="status-message status-error">
          <span className="status-icon">❌</span>
          <span className="status-text">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="modern-table-container">
      {/* Header with Overall Stats */}
      <div className="modern-table-header">
        <div className="header-left">
          <h2 className="mb-0">Multi-Customer Dashboard</h2>
        </div>
        <div className="header-right">
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Customers</span>
              <span className="stat-value">{overallStats.totalCustomers}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Projects</span>
              <span className="stat-value">{overallStats.totalProjects}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Fabrics</span>
              <span className="stat-value">{overallStats.totalFabrics}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Connected</span>
              <span className="stat-value">{overallStats.connectedInsights}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div className="row">
          {/* Left Column - Customer List */}
          <div className="col-lg-8">
            <div className="bg-white rounded shadow-sm">
              <div className="p-4 border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <FaBuilding className="me-2 text-primary" />
                    Customers & Projects
                  </h5>
                  <div>
                    <Link to="/config" className="modern-btn modern-btn-secondary me-2">
                      <FaCogs className="me-1" />
                      Configure
                    </Link>
                    <button 
                      className="modern-btn modern-btn-primary"
                      onClick={() => {
                        setExpandedCustomers(new Set(customers.map(c => c.id)));
                      }}
                    >
                      Expand All
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                {customers.length === 0 ? (
                  <div className="text-center py-5">
                    <FaBuilding size={48} className="text-muted mb-3" />
                    <h6 className="text-muted">No customers found</h6>
                    <p className="text-muted">Add your first customer to get started</p>
                    <Link to="/config" className="modern-btn modern-btn-primary">
                      <FaPlus className="me-1" />
                      Add Customer
                    </Link>
                  </div>
                ) : (
                  <div className="customer-list">
                    {customers.map((customer) => (
                      <div key={customer.id} className="customer-card mb-4 border rounded">
                        {/* Customer Header */}
                        <div className="customer-header p-3 bg-light d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <button
                              className="btn btn-sm btn-link p-0 me-2"
                              onClick={() => toggleCustomerExpansion(customer.id)}
                            >
                              {expandedCustomers.has(customer.id) ? 
                                <FaChevronDown className="text-primary" /> : 
                                <FaChevronRight className="text-primary" />
                              }
                            </button>
                            <div>
                              <h6 className="mb-1 fw-bold">{customer.name}</h6>
                              <div className="d-flex align-items-center gap-3">
                                <small className="text-muted">
                                  <FaProjectDiagram className="me-1" />
                                  {customer.stats.projectCount} projects
                                </small>
                                <small className="text-muted">
                                  <FaNetworkWired className="me-1" />
                                  {customer.stats.fabricCount} fabrics
                                </small>
                                <small className="text-muted">
                                  <FaServer className="me-1" />
                                  {customer.stats.storageCount} storage systems
                                </small>
                              </div>
                            </div>
                          </div>
                          
                          <div className="d-flex align-items-center gap-2">
                            {/* Storage Insights Status */}
                            <div className="d-flex align-items-center">
                              {customer.insights_tenant ? (
                                <a
                                  href={`https://insights.ibm.com/cui/${customer.insights_tenant}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none me-2"
                                  title="Storage Insights Portal"
                                >
                                  <FaCloud className="text-primary" />
                                </a>
                              ) : (
                                <FaCloud className="text-muted me-2" title="No Storage Insights configured" />
                              )}
                              
                              {customer.insights_api_key ? (
                                <FaKey className="text-success" title="API Key configured" />
                              ) : (
                                <FaKey className="text-muted" title="No API Key" />
                              )}
                            </div>
                            
                            {/* Action buttons */}
                            <button
                              className="modern-btn modern-btn-secondary btn-sm"
                              onClick={() => handleSetActiveCustomer(customer)}
                              title="Set as active customer"
                            >
                              <FaEye />
                            </button>
                            
                            {config?.customer?.id === customer.id && (
                              <span className="badge bg-primary">Active</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Expanded Customer Details */}
                        {expandedCustomers.has(customer.id) && (
                          <div className="customer-details p-3">
                            {/* Customer Stats Row */}
                            <div className="row mb-3">
                              <div className="col-md-3">
                                <div className="text-center p-2 border rounded bg-light">
                                  <div className="fw-bold text-primary">{customer.stats.zoneCount}</div>
                                  <small className="text-muted">Zones</small>
                                </div>
                              </div>
                              <div className="col-md-3">
                                <div className="text-center p-2 border rounded bg-light">
                                  <div className="fw-bold text-success">{customer.stats.aliasCount}</div>
                                  <small className="text-muted">Aliases</small>
                                </div>
                              </div>
                              <div className="col-md-3">
                                <div className="text-center p-2 border rounded bg-light">
                                  <div className="fw-bold text-info">{customer.stats.ciscoFabrics}</div>
                                  <small className="text-muted">Cisco</small>
                                </div>
                              </div>
                              <div className="col-md-3">
                                <div className="text-center p-2 border rounded bg-light">
                                  <div className="fw-bold text-danger">{customer.stats.brocadeFabrics}</div>
                                  <small className="text-muted">Brocade</small>
                                </div>
                              </div>
                            </div>
                            
                            {/* Storage Insights Info */}
                            {(customer.insights_tenant || customer.insights_api_key) && (
                              <div className="mb-3 p-2 bg-light rounded">
                                <small className="text-muted d-block mb-1">
                                  <FaGlobe className="me-1" />
                                  Storage Insights Integration
                                </small>
                                {customer.insights_tenant && (
                                  <div className="d-flex align-items-center mb-1">
                                    <span className="small me-2">Tenant:</span>
                                    <a
                                      href={`https://insights.ibm.com/cui/${customer.insights_tenant}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary text-decoration-none small"
                                    >
                                      {customer.insights_tenant} <FaExternalLinkAlt size={10} />
                                    </a>
                                  </div>
                                )}
                                <div className="d-flex align-items-center">
                                  <span className="small me-2">API Key:</span>
                                  {customer.insights_api_key ? (
                                    <span className="badge bg-success">
                                      <FaCheckCircle className="me-1" />
                                      Configured
                                    </span>
                                  ) : (
                                    <span className="badge bg-danger">
                                      <FaTimesCircle className="me-1" />
                                      Missing
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Projects List */}
                            <div>
                              <h6 className="mb-2">Projects</h6>
                              {customer.projects.length === 0 ? (
                                <p className="text-muted small">No projects found for this customer</p>
                              ) : (
                                <div className="row">
                                  {customer.projects.map((project) => (
                                    <div key={project.id} className="col-md-6 mb-2">
                                      <div className="d-flex justify-content-between align-items-center p-2 border rounded bg-white">
                                        <div>
                                          <div className="fw-medium">{project.name}</div>
                                          <small className="text-muted">
                                            {project.zoneCount} zones, {project.aliasCount} aliases
                                          </small>
                                        </div>
                                        <div className="d-flex gap-1">
                                          <button
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => handleSetActiveCustomer(customer, project)}
                                            title="Set as active project"
                                          >
                                            <FaEye size={12} />
                                          </button>
                                          {config?.active_project?.id === project.id && (
                                            <span className="badge bg-primary">Active</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Column - Charts and Stats */}
          <div className="col-lg-4">
            {/* Current Active Context */}
            <div className="bg-white rounded shadow-sm mb-4 p-3">
              <h6 className="mb-3">
                <FaInfoCircle className="me-2 text-primary" />
                Active Context
              </h6>
              <div className="mb-2">
                <small className="text-muted">Customer:</small>
                <div className="fw-medium">{config?.customer?.name || "None selected"}</div>
              </div>
              <div className="mb-2">
                <small className="text-muted">Project:</small>
                <div className="fw-medium">{config?.active_project?.name || "None selected"}</div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <Link to="/san/fabrics" className="modern-btn modern-btn-secondary btn-sm">
                  <FaNetworkWired className="me-1" />
                  Fabrics
                </Link>
                <Link to="/san/zones" className="modern-btn modern-btn-secondary btn-sm">
                  <FaProjectDiagram className="me-1" />
                  Zones
                </Link>
              </div>
            </div>
            
            {/* Storage Insights Connections */}
            {overallStats.totalCustomers > 0 && (
              <div className="bg-white rounded shadow-sm mb-4 p-3">
                <h6 className="mb-3">
                  <FaCloud className="me-2 text-primary" />
                  Storage Insights Connections
                </h6>
                <div style={{ height: "150px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={insightsConnectionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {insightsConnectionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {/* Fabric Distribution */}
            {fabricDistributionData.length > 0 && (
              <div className="bg-white rounded shadow-sm mb-4 p-3">
                <h6 className="mb-3">
                  <FaNetworkWired className="me-2 text-primary" />
                  Fabric Distribution
                </h6>
                <div style={{ height: "200px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fabricDistributionData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="brocade" name="Brocade" fill="#dc3545" />
                      <Bar dataKey="cisco" name="Cisco" fill="#0dcaf0" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {/* Storage Distribution */}
            {storageDistributionData.length > 0 && (
              <div className="bg-white rounded shadow-sm p-3">
                <h6 className="mb-3">
                  <FaServer className="me-2 text-primary" />
                  Storage Systems
                </h6>
                <div style={{ height: "200px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={storageDistributionData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="ds8000" name="DS8000" fill="#6610f2" />
                      <Bar dataKey="flashSystem" name="FlashSystem" fill="#fd7e14" />
                      <Bar dataKey="other" name="Other" fill="#20c997" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;