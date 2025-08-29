import React, { useState, useEffect, useContext } from "react";
import { 
  FaNetworkWired, FaProjectDiagram, FaServer, FaUsers,
  FaChartLine, FaArrowRight, FaCog, FaPlus, FaCloud,
  FaCheckCircle, FaTimesCircle, FaClock, FaDownload, FaSync
} from "react-icons/fa";
import { Modal, Button, Form as BootstrapForm } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
import { SkeletonDashboard } from "../components/SkeletonLoader";
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
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [insightsTenant, setInsightsTenant] = useState("");
  const [insightsApiKey, setInsightsApiKey] = useState("");
  const [savingInsights, setSavingInsights] = useState(false);

  // Optimized single API call for all dashboard data
  const fetchDashboardData = async (forceRefresh = false) => {
    if (!config?.customer?.id || !config?.active_project?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Single optimized API call with optional cache busting
      const params = { 
        customer_id: config.customer.id,
        project_id: config.active_project.id
      };
      
      // Add timestamp to bypass cache when needed
      if (forceRefresh) {
        params._t = Date.now();
      }
      
      const response = await axios.get('/api/core/dashboard/stats/', { params });
      
      const data = response.data;
      
      // Update stats from the single response
      setStats({
        totalFabrics: data.stats.total_fabrics,
        totalZones: data.stats.total_zones,
        totalAliases: data.stats.total_aliases,
        totalStorage: data.stats.total_storage
      });
      
      // Update insights data
      console.log("Dashboard API response customer data:", data.customer);
      console.log("Customer insights_tenant:", data.customer.insights_tenant);
      console.log("Customer insights_api_key exists:", !!data.customer.insights_api_key);
      console.log("Raw has_insights value:", data.customer.has_insights);
      setInsightsData({
        hasCredentials: data.customer.has_insights,
        tenant: data.customer.insights_tenant,
        lastImport: data.last_import,
        importHistory: data.last_import ? [data.last_import] : []
      });
      console.log("Setting hasCredentials to:", data.customer.has_insights);
      
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

  // Refetch data when component comes back into view (e.g., navigating back from other pages)
  useEffect(() => {
    const handleFocus = () => {
      if (config?.customer?.id && config?.active_project?.id) {
        fetchDashboardData(true); // Force refresh when coming back
      }
    };

    // Listen for when the window/tab comes back into focus
    window.addEventListener('focus', handleFocus);
    
    // Listen for when user navigates back to this page
    const handleVisibilityChange = () => {
      if (!document.hidden && config?.customer?.id && config?.active_project?.id) {
        fetchDashboardData(true); // Force refresh when page becomes visible
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config]);

  const handleSaveInsights = async () => {
    if (!insightsTenant.trim() || !insightsApiKey.trim()) {
      alert("Please enter both Tenant ID and API Key");
      return;
    }

    setSavingInsights(true);
    try {
      console.log("Saving insights credentials...");
      const response = await axios.put(`/api/customers/${config.customer.id}/`, {
        insights_tenant: insightsTenant.trim(),
        insights_api_key: insightsApiKey.trim()
      });
      console.log("Customer update response:", response.data);
      console.log("Updated customer has insights_tenant:", response.data.insights_tenant);
      console.log("Updated customer has insights_api_key:", response.data.insights_api_key ? "YES (hidden)" : "NO");

      // Clear dashboard cache to force refresh
      try {
        console.log("Clearing dashboard cache...");
        await axios.post('/api/core/dashboard/cache/clear/', {
          customer_id: config.customer.id,
          project_id: config.active_project.id
        });
        console.log("Dashboard cache cleared");
      } catch (cacheError) {
        console.warn("Could not clear dashboard cache:", cacheError);
      }

      // Clear form and close modal first
      setInsightsTenant("");
      setInsightsApiKey("");
      setShowInsightsModal(false);
      
      // Force refresh dashboard data with cache busting - this should update insightsData
      console.log("Forcing dashboard refresh...");
      await fetchDashboardData(true);
      console.log("Dashboard refresh complete, insightsData:", insightsData);
      
    } catch (error) {
      console.error("Error saving Storage Insights credentials:", error);
      alert("Failed to save Storage Insights credentials. Please try again.");
    } finally {
      setSavingInsights(false);
    }
  };

  const handleRefresh = async () => {
    if (!config?.customer?.id || !config?.active_project?.id) {
      return;
    }

    try {
      // Clear dashboard cache first
      await axios.post('/api/core/dashboard/cache/clear/', {
        customer_id: config.customer.id,
        project_id: config.active_project.id
      });
    } catch (cacheError) {
      console.warn("Could not clear dashboard cache:", cacheError);
    }

    // Force refresh dashboard data
    await fetchDashboardData(true);
  };

  if (loading || configLoading) {
    return <SkeletonDashboard />;
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
            <div 
              className={`insights-status-compact ${!insightsData.hasCredentials ? 'clickable' : ''}`}
              onClick={!insightsData.hasCredentials ? () => setShowInsightsModal(true) : undefined}
              title={!insightsData.hasCredentials ? 'Click to configure Storage Insights' : ''}
            >
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
                    <small>Click to configure</small>
                  </div>
                </>
              )}
            </div>
            
            {isImportRunning && (
              <div className="import-status-compact">
                <div className="import-progress-container">
                  <FaDownload />
                  <div className="import-progress-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
                <div className="import-text-compact">
                  <span>Importing</span>
                  {importProgress && (
                    <small>{Math.round((importProgress.current / importProgress.total) * 100)}%</small>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <button 
            className="header-action refresh-button" 
            onClick={handleRefresh}
            title="Refresh dashboard data"
            disabled={loading}
          >
            <FaSync className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          
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
          <Link to="/storage/systems" className="metric-link">
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

          <Link to="/customers" className="action-card">
            <FaUsers className="action-icon" />
            <h3>Customer Settings</h3>
            <p>Manage customers and Storage Insights</p>
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

      {/* Storage Insights Configuration Modal */}
      <Modal show={showInsightsModal} onHide={() => setShowInsightsModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCloud className="me-2" />
            Configure Storage Insights
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Connect your IBM Storage Insights account to automatically import storage data.
          </p>
          <BootstrapForm>
            <BootstrapForm.Group className="mb-3">
              <BootstrapForm.Label>Tenant ID</BootstrapForm.Label>
              <BootstrapForm.Control
                type="text"
                value={insightsTenant}
                onChange={(e) => setInsightsTenant(e.target.value)}
                placeholder="Enter your Storage Insights Tenant ID"
              />
            </BootstrapForm.Group>
            <BootstrapForm.Group className="mb-3">
              <BootstrapForm.Label>API Key</BootstrapForm.Label>
              <BootstrapForm.Control
                type="password"
                value={insightsApiKey}
                onChange={(e) => setInsightsApiKey(e.target.value)}
                placeholder="Enter your Storage Insights API Key"
              />
            </BootstrapForm.Group>
          </BootstrapForm>
          <hr />
          <div className="d-flex align-items-center">
            <FaUsers className="text-primary me-2" />
            <span className="me-auto">Need to manage customers?</span>
            <Link to="/customers" className="btn btn-outline-primary btn-sm">
              Customer Management
            </Link>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowInsightsModal(false)}
            disabled={savingInsights}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveInsights}
            disabled={savingInsights}
          >
            {savingInsights ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Dashboard;