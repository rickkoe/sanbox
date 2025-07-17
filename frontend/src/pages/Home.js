import React, { useState, useEffect, useContext } from "react";
import { 
  FaNetworkWired, FaProjectDiagram, FaServer, FaUsers,
  FaChartLine, FaArrowRight, FaCog, FaPlus, FaCloud,
  FaCheckCircle, FaTimesCircle, FaClock, FaDownload
} from "react-icons/fa";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
import axios from "axios";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { config, loading: configLoading } = useContext(ConfigContext);
  const { isImportRunning, importProgress } = useImportStatus();
  
  // Simplified state for key metrics only
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalFabrics: 0,
    totalZones: 0,
    totalAliases: 0,
    totalStorage: 0
  });
  const [insightsData, setInsightsData] = useState({
    hasCredentials: false,
    lastImport: null,
    importHistory: []
  });

  // Fetch Storage Insights data
  const fetchInsightsData = async () => {
    if (!config?.customer?.id) return;
    
    try {
      // Check if customer has Storage Insights credentials
      const hasCredentials = !!(config.customer.insights_tenant && config.customer.insights_api_key);
      
      let importHistory = [];
      if (hasCredentials) {
        // Fetch recent import history
        const historyRes = await axios.get('/api/importer/history/', {
          params: { customer_id: config.customer.id }
        });
        importHistory = historyRes.data.slice(0, 5); // Last 5 imports
      }
      
      setInsightsData({
        hasCredentials,
        tenant: config.customer.insights_tenant,
        lastImport: importHistory.length > 0 ? importHistory[0] : null,
        importHistory
      });
    } catch (err) {
      console.error("Error fetching Storage Insights data:", err);
    }
  };

  // Simplified data fetching - only get key metrics for current active project
  const fetchDashboardData = async () => {
    if (!config?.customer?.id || !config?.active_project?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Fetch dashboard metrics and insights data
      const [fabricsRes, zonesRes, aliasesRes, storageRes] = await Promise.allSettled([
        axios.get(`/api/san/fabrics/?customer_id=${config.customer.id}`),
        axios.get(`/api/san/zones/project/${config.active_project.id}/`),
        axios.get(`/api/san/aliases/project/${config.active_project.id}/`),
        axios.get(`/api/storage/?customer=${config.customer.id}`)
      ]);

      // Also fetch insights data
      await fetchInsightsData();
      
      const fabrics = fabricsRes.status === 'fulfilled' ? 
        (Array.isArray(fabricsRes.value.data) ? fabricsRes.value.data : fabricsRes.value.data.results || []) : [];
      const zones = zonesRes.status === 'fulfilled' ? 
        (Array.isArray(zonesRes.value.data) ? zonesRes.value.data : zonesRes.value.data.results || []) : [];
      const aliases = aliasesRes.status === 'fulfilled' ? 
        (Array.isArray(aliasesRes.value.data) ? aliasesRes.value.data : aliasesRes.value.data.results || []) : [];
      const storage = storageRes.status === 'fulfilled' ? 
        (Array.isArray(storageRes.value.data) ? storageRes.value.data : storageRes.value.data.results || []) : [];
      
      setStats({
        totalFabrics: fabrics.length,
        totalZones: zones.length,
        totalAliases: aliases.length,
        totalStorage: storage.length
      });
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(`Failed to fetch dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard data when config changes
  useEffect(() => {
    fetchDashboardData();
  }, [config]);

  if (loading || configLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // If no active customer/project is configured
  if (!config?.customer?.id || !config?.active_project?.id) {
    return (
      <div className="dashboard-container">
        <div className="welcome-state">
          <div className="welcome-header">
            <h1>Welcome to Sanbox</h1>
            <p className="lead">Storage Area Network management made simple</p>
          </div>
          
          <div className="welcome-actions">
            <Link to="/config" className="action-btn primary">
              <FaCog className="action-icon" />
              <div className="action-content">
                <h3>Get Started</h3>
                <p>Configure your first customer and project</p>
              </div>
              <FaArrowRight className="action-arrow" />
            </Link>
            
            <Link to="/customers" className="action-btn secondary">
              <FaUsers className="action-icon" />
              <div className="action-content">
                <h3>Manage Customers</h3>
                <p>View and organize customer data</p>
              </div>
              <FaArrowRight className="action-arrow" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="project-info">
            <h1>{config.active_project.name}</h1>
            <p className="customer-name">{config.customer.name}</p>
          </div>
          
          {/* Storage Insights Status in Header */}
          <div className="header-insights">
            <div className="insights-status-compact">
              {insightsData.hasCredentials ? (
                <>
                  <FaCheckCircle className="status-icon configured" />
                  <div className="status-text-compact">
                    <span className="status-label">Storage Insights</span>
                    <small>Tenant: {insightsData.tenant}</small>
                  </div>
                </>
              ) : (
                <>
                  <FaTimesCircle className="status-icon not-configured" />
                  <div className="status-text-compact">
                    <span className="status-label">Storage Insights</span>
                    <small>Not configured</small>
                  </div>
                </>
              )}
            </div>
            
            {isImportRunning && (
              <div className="import-status-compact">
                <FaDownload className="import-icon spinning" />
                <div className="import-text-compact">
                  <span>Importing</span>
                  {importProgress && (
                    <small>{Math.round((importProgress.current / importProgress.total) * 100)}%</small>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <Link to="/config" className="header-action">
            <FaCog />
            Settings
          </Link>
        </div>
        
        {/* Last Import Info */}
        {insightsData.hasCredentials && insightsData.lastImport && (
          <div className="header-import-info">
            <FaClock className="import-icon" />
            <span className="import-date">
              Last Import: {new Date(insightsData.lastImport.started_at).toLocaleDateString()}
            </span>
            <span className={`import-status ${insightsData.lastImport.status}`}>
              {insightsData.lastImport.status.toUpperCase()}
            </span>
            <span className="import-items">
              {insightsData.lastImport.storage_systems_imported} systems, {' '}
              {insightsData.lastImport.volumes_imported} volumes
            </span>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon fabrics">
            <FaNetworkWired />
          </div>
          <div className="metric-content">
            <h3>{stats.totalFabrics}</h3>
            <p>SAN Fabrics</p>
          </div>
          <Link to="/san/fabrics" className="metric-link">
            <FaArrowRight />
          </Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon zones">
            <FaProjectDiagram />
          </div>
          <div className="metric-content">
            <h3>{stats.totalZones}</h3>
            <p>Zones</p>
          </div>
          <Link to="/san/zones" className="metric-link">
            <FaArrowRight />
          </Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon aliases">
            <FaChartLine />
          </div>
          <div className="metric-content">
            <h3>{stats.totalAliases}</h3>
            <p>Aliases</p>
          </div>
          <Link to="/san/aliases" className="metric-link">
            <FaArrowRight />
          </Link>
        </div>

        <div className="metric-card">
          <div className="metric-icon storage">
            <FaServer />
          </div>
          <div className="metric-content">
            <h3>{stats.totalStorage}</h3>
            <p>Storage Systems</p>
          </div>
          <Link to="/storage" className="metric-link">
            <FaArrowRight />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="actions-section">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/san/fabrics" className="action-card">
            <FaNetworkWired className="action-icon" />
            <h3>Manage Fabrics</h3>
            <p>Configure and monitor SAN fabrics</p>
          </Link>

          <Link to="/scripts" className="action-card">
            <FaCog className="action-icon" />
            <h3>Generate Scripts</h3>
            <p>Create zoning and storage scripts</p>
          </Link>

          <Link to="/insights/importer" className="action-card">
            <FaCloud className="action-icon" />
            <h3>Import Data</h3>
            <p>Import from Storage Insights</p>
          </Link>

          <Link to="/tools" className="action-card">
            <FaChartLine className="action-icon" />
            <h3>Calculators</h3>
            <p>Storage capacity tools</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;