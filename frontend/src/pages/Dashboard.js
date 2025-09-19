import React, { useState, useContext } from "react";
import { 
  FaNetworkWired, FaServer, FaUsers, FaDatabase,
  FaChartLine, FaExclamationTriangle, FaCheckCircle, 
  FaClock, FaDownload, FaSync, FaCog,
  FaTimesCircle, FaCloud, FaHdd
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
import { useDashboardData } from "../hooks/useDashboardData";
import { 
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';

const Dashboard = () => {
  const { config, loading: configLoading } = useContext(ConfigContext);
  const { isImportRunning, importProgress } = useImportStatus();
  const { data: dashboardData, loading, error, lastUpdated, refresh } = useDashboardData(config, 30000);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading || configLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <FaExclamationTriangle />
        <h3>Dashboard Error</h3>
        <p>{error}</p>
        <button onClick={handleRefresh} className="btn btn-primary">
          <FaSync /> Retry
        </button>
      </div>
    );
  }

  if (!config?.customer?.id || !config?.active_project?.id) {
    return <WelcomeScreen />;
  }

  return (
    <div className="modern-dashboard">
      {/* Header Section */}
      <DashboardHeader 
        config={config}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        importStatus={{ isImportRunning, importProgress }}
        lastImport={dashboardData.stats?.last_import}
        lastUpdated={lastUpdated}
      />

      {/* Key Metrics Grid */}
      <MetricsGrid stats={dashboardData.stats?.stats || {}} />

      {/* Charts and Analytics */}
      <div className="dashboard-analytics">
        <div className="row">
          <div className="col-lg-8">
            <CapacityChart capacity={dashboardData.capacity || {}} />
          </div>
          <div className="col-lg-4">
            <StorageBreakdown capacity={dashboardData.capacity || {}} />
          </div>
        </div>
      </div>

      {/* System Health and Activity */}
      <div className="dashboard-bottom">
        <div className="row">
          <div className="col-lg-8">
            <SystemHealth health={dashboardData.health || {}} />
          </div>
          <div className="col-lg-4">
            <ActivityFeed activities={dashboardData.activity || []} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Header Component
const DashboardHeader = ({ config, onRefresh, refreshing, importStatus, lastImport, lastUpdated }) => (
  <div className="dashboard-header">
    <div className="header-content">
      <div className="project-info">
        <h1>{config.active_project.name}</h1>
        <p className="customer-name">{config.customer.name}</p>
        {lastUpdated && (
          <small className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </small>
        )}
      </div>
      
      <div className="header-status">
        <StorageInsightsStatus customer={config.customer} lastImport={lastImport} />
        {importStatus.isImportRunning && (
          <ImportProgress progress={importStatus.importProgress} />
        )}
      </div>
      
      <div className="header-actions">
        <button 
          className={`btn btn-outline-primary ${refreshing ? 'loading' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <FaSync className={refreshing ? 'spinning' : ''} />
          Refresh
        </button>
        <Link to="/settings/project-config" className="btn btn-outline-secondary">
          <FaCog /> Settings
        </Link>
      </div>
    </div>
  </div>
);

// Metrics Grid Component
const MetricsGrid = ({ stats }) => {
  const metrics = [
    {
      title: "SAN Fabrics",
      value: stats.total_fabrics || 0,
      icon: FaNetworkWired,
      color: "primary",
      link: "/san/fabrics"
    },
    {
      title: "Storage Systems",
      value: stats.total_storage || 0,
      icon: FaServer,
      color: "success",
      link: "/storage/systems"
    },
    {
      title: "Zones",
      value: stats.total_zones || 0,
      icon: FaDatabase,
      color: "info",
      link: "/san/zones"
    },
    {
      title: "Hosts",
      value: stats.total_hosts || 0,
      icon: FaHdd,
      color: "warning",
      link: "/storage/hosts"
    }
  ];

  return (
    <div className="metrics-grid">
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
};

// Individual Metric Card
const MetricCard = ({ metric }) => (
  <Link to={metric.link} className={`metric-card metric-${metric.color}`}>
    <div className="metric-icon">
      <metric.icon />
    </div>
    <div className="metric-content">
      <h3>{metric.value.toLocaleString()}</h3>
      <p>{metric.title}</p>
    </div>
    <div className="metric-arrow">
      <FaChartLine />
    </div>
  </Link>
);

// Capacity Chart Component
const CapacityChart = ({ capacity }) => {
  if (!capacity.storage_systems || capacity.storage_systems.length === 0) {
    return (
      <div className="chart-card">
        <h3>Storage Capacity Overview</h3>
        <div className="no-data">
          <FaDatabase />
          <p>No storage systems found</p>
        </div>
      </div>
    );
  }

  const chartData = capacity.storage_systems.map(s => ({
    name: s.name,
    used: s.used_tb,
    available: s.available_tb,
    total: s.capacity_tb
  }));

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Storage Capacity Overview</h3>
        <div className="capacity-summary">
          <span className="total-capacity">
            {capacity.total_capacity_tb || 0}TB Total
          </span>
          <span className={`utilization ${(capacity.utilization_percent || 0) > 80 ? 'high' : 'normal'}`}>
            {capacity.utilization_percent || 0}% Used
          </span>
        </div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Capacity (TB)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => [`${value} TB`, '']} />
            <Legend />
            <Bar dataKey="used" stackId="a" fill="#3b82f6" name="Used" />
            <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Storage Type Breakdown
const StorageBreakdown = ({ capacity }) => {
  if (!capacity.capacity_by_type || Object.keys(capacity.capacity_by_type).length === 0) {
    return (
      <div className="chart-card">
        <h3>Storage Distribution</h3>
        <div className="no-data">
          <FaServer />
          <p>No storage data available</p>
        </div>
      </div>
    );
  }

  const types = Object.keys(capacity.capacity_by_type);
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'];
  
  const pieData = types.map((type, index) => ({
    name: type,
    value: capacity.capacity_by_type[type].capacity_tb,
    count: capacity.capacity_by_type[type].count,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="chart-card">
      <h3>Storage Distribution</h3>
      <div className="chart-container doughnut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value.toFixed(1)} TB`, 'Capacity']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="storage-breakdown-list">
        {pieData.map(item => (
          <div key={item.name} className="breakdown-item">
            <div className="breakdown-color" style={{ backgroundColor: item.color }}></div>
            <span className="type-name">{item.name}</span>
            <span className="type-count">
              {item.count} system{item.count !== 1 ? 's' : ''}
            </span>
            <span className="type-capacity">
              {item.value.toFixed(1)}TB
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// System Health Component
const SystemHealth = ({ health }) => {
  const overallStatus = health?.overall_status || 'unknown';
  
  return (
    <div className="chart-card health-card">
      <div className="card-header">
        <h3>System Health</h3>
        <div className={`overall-status ${overallStatus}`}>
          {overallStatus === 'healthy' ? <FaCheckCircle /> : 
           overallStatus === 'warning' ? <FaExclamationTriangle /> : 
           <FaTimesCircle />}
          <span>{overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}</span>
        </div>
      </div>
      
      {health?.issues && health.issues.length > 0 && (
        <div className="health-issues">
          <h4>Issues</h4>
          {health.issues.map((issue, index) => (
            <div key={index} className={`issue-item ${issue?.severity || 'info'}`}>
              <FaExclamationTriangle />
              <span>{issue?.message || 'Unknown issue'}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="health-checks">
        <div className="check-item">
          <FaCloud />
          <span>Storage Insights</span>
          <div className={`status ${health?.connection_tests?.storage_insights?.status || 'unknown'}`}>
            {health?.connection_tests?.storage_insights?.status === 'configured' ? 
              <FaCheckCircle /> : <FaTimesCircle />}
          </div>
        </div>
        
        {health?.fabric_status && health.fabric_status.length > 0 && (
          <div className="fabric-health">
            <h4>SAN Fabrics</h4>
            {health.fabric_status.slice(0, 3).map(fabric => (
              <div key={fabric?.id || Math.random()} className="fabric-item">
                <FaNetworkWired />
                <span>{fabric?.name || 'Unknown'}</span>
                <div className={`status ${fabric?.status || 'unknown'}`}>
                  {fabric?.status === 'active' ? <FaCheckCircle /> : <FaTimesCircle />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Activity Feed Component
const ActivityFeed = ({ activities }) => (
  <div className="chart-card activity-card">
    <div className="card-header">
      <h3>Recent Activity</h3>
      <Link to="/import" className="view-all">View All</Link>
    </div>
    
    <div className="activity-list">
      {activities && activities.length > 0 ? (
        activities.map(activity => (
          <div key={activity.id} className={`activity-item ${activity.status}`}>
            <div className="activity-icon">
              <FaDownload />
            </div>
            <div className="activity-content">
              <h4>{activity.title}</h4>
              <p>{activity.description}</p>
              <span className="activity-time">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
            </div>
            <div className={`activity-status ${activity.status}`}>
              {activity.status === 'completed' ? <FaCheckCircle /> :
               activity.status === 'failed' ? <FaTimesCircle /> :
               <FaClock />}
            </div>
          </div>
        ))
      ) : (
        <div className="no-activity">
          <FaClock />
          <p>No recent activity</p>
        </div>
      )}
    </div>
  </div>
);


// Storage Insights Status Component
const StorageInsightsStatus = ({ customer, lastImport }) => {
  const hasCredentials = customer?.has_insights;
  
  return (
    <div className={`insights-status ${hasCredentials ? 'configured' : 'not-configured'}`}>
      {hasCredentials ? <FaCheckCircle /> : <FaTimesCircle />}
      <div className="status-text">
        <span>Storage Insights</span>
        {hasCredentials && lastImport && (
          <small>Last: {new Date(lastImport.started_at).toLocaleDateString()}</small>
        )}
      </div>
    </div>
  );
};

// Import Progress Component
const ImportProgress = ({ progress }) => (
  <div className="import-progress">
    <FaDownload />
    <div className="progress-content">
      <span>Importing...</span>
      {progress && (
        <small>{Math.round((progress.current / progress.total) * 100)}%</small>
      )}
    </div>
    <div className="progress-indicator">
      <div className="spinner"></div>
    </div>
  </div>
);

// Welcome Screen Component
const WelcomeScreen = () => (
  <div className="welcome-screen">
    <div className="welcome-content">
      <h1>Welcome to Sanbox</h1>
      <p>Enterprise Storage Area Network Management</p>
      <div className="welcome-actions">
        <Link to="/settings/project-config" className="btn btn-primary">
          <FaCog /> Get Started
        </Link>
        <Link to="/customers" className="btn btn-outline-primary">
          <FaUsers /> Manage Customers
        </Link>
      </div>
    </div>
  </div>
);

// Loading Skeleton Component
const DashboardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="skeleton-header"></div>
    <div className="skeleton-metrics">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-metric"></div>
      ))}
    </div>
    <div className="skeleton-charts">
      <div className="skeleton-chart large"></div>
      <div className="skeleton-chart small"></div>
    </div>
  </div>
);

export default Dashboard;