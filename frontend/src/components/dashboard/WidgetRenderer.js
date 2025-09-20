import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, FaDatabase, FaServer, FaNetworkWired, 
  FaExclamationTriangle, FaClock, FaUsers, FaHdd,
  FaCheckCircle, FaTimesCircle, FaSpinner
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import axios from 'axios';

export const WidgetRenderer = ({ widget, editMode, compact = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch widget data based on type
  useEffect(() => {
    const fetchWidgetData = async () => {
      if (!widget?.widget_type?.requires_data_source) {
        // Static widget - no data needed
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getWidgetData(widget);
        setData(response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgetData();

    // Set up auto-refresh if needed
    const refreshInterval = widget.refresh_interval || 30;
    if (!editMode && refreshInterval > 0) {
      const interval = setInterval(fetchWidgetData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget, editMode]);

  if (loading) {
    return <WidgetLoading />;
  }

  if (error) {
    return <WidgetError error={error} />;
  }

  // Render based on widget type
  switch (widget.widget_type.component_name) {
    case 'MetricWidget':
      return <MetricWidget widget={widget} data={data} compact={compact} />;
    case 'ChartWidget':
      return <ChartWidget widget={widget} data={data} compact={compact} />;
    case 'TableWidget':
      return <TableWidget widget={widget} data={data} compact={compact} />;
    case 'HealthWidget':
      return <HealthWidget widget={widget} data={data} compact={compact} />;
    case 'ActivityWidget':
      return <ActivityWidget widget={widget} data={data} compact={compact} />;
    case 'CapacityWidget':
      return <CapacityWidget widget={widget} data={data} compact={compact} />;
    case 'NetworkWidget':
      return <NetworkWidget widget={widget} data={data} compact={compact} />;
    case 'SystemsWidget':
      return <SystemsWidget widget={widget} data={data} compact={compact} />;
    default:
      return <GenericWidget widget={widget} data={data} compact={compact} />;
  }
};

// Widget Data Fetcher
const getWidgetData = async (widget) => {
  const { widget_type, data_filters, config } = widget;
  
  switch (widget_type.name) {
    case 'san_metrics':
      return axios.get('/api/core/dashboard/stats/', { params: data_filters });
    case 'storage_capacity':
      return axios.get('/api/core/dashboard/capacity/', { params: data_filters });
    case 'system_health':
      return axios.get('/api/core/dashboard/health/', { params: data_filters });
    case 'recent_activity':
      return axios.get('/api/core/dashboard/activity/', { params: data_filters });
    case 'fabric_overview':
      return axios.get('/api/san/fabrics/', { params: data_filters });
    case 'storage_systems':
      return axios.get('/api/storage/systems/', { params: data_filters });
    default:
      // Mock data for demo purposes
      return generateMockData(widget_type.name);
  }
};

// Individual Widget Components

const MetricWidget = ({ widget, data, compact }) => {
  const value = data?.value || Math.floor(Math.random() * 1000);
  const label = widget.config.label || widget.title;
  const trend = data?.trend || { value: Math.floor(Math.random() * 20) - 10, period: 'month' };
  const icon = getWidgetIcon(widget.widget_type.icon);

  return (
    <div className="metric-widget">
      <div className="metric-header">
        <div className="metric-icon">
          {React.createElement(icon)}
        </div>
        {!compact && (
          <div className="metric-trend">
            <span className={trend.value >= 0 ? 'positive' : 'negative'}>
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </span>
            <small>this {trend.period}</small>
          </div>
        )}
      </div>
      <div className="metric-value">{value.toLocaleString()}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
};

const ChartWidget = ({ widget, data, compact }) => {
  const chartData = data?.data || generateChartData();
  const chartType = widget.config.chart_type || 'bar';

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#667eea" strokeWidth={2} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={compact ? 40 : 60}
              fill="#667eea"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      default:
        return (
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#667eea" />
          </BarChart>
        );
    }
  };

  return (
    <div className="chart-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
      </div>
      <div className="chart-container" style={{ height: compact ? 150 : 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const TableWidget = ({ widget, data, compact }) => {
  const tableData = data?.data || generateTableData();
  const columns = widget.config.columns || ['name', 'status', 'value'];
  const maxRows = compact ? 3 : 10;

  return (
    <div className="table-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="row-count">{tableData.length} items</span>
      </div>
      <div className="table-container">
        <table className="widget-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col.charAt(0).toUpperCase() + col.slice(1)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.slice(0, maxRows).map((row, index) => (
              <tr key={index}>
                {columns.map(col => (
                  <td key={col}>
                    {col === 'status' ? (
                      <span className={`status ${row[col]?.toLowerCase()}`}>
                        {row[col]}
                      </span>
                    ) : (
                      row[col]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {tableData.length > maxRows && (
          <div className="table-footer">
            +{tableData.length - maxRows} more items
          </div>
        )}
      </div>
    </div>
  );
};

const HealthWidget = ({ widget, data, compact }) => {
  const health = data?.health || {
    overall: Math.random() > 0.7 ? 'healthy' : Math.random() > 0.3 ? 'warning' : 'critical',
    systems: Math.floor(Math.random() * 20) + 5,
    issues: Math.floor(Math.random() * 3),
    uptime: '99.8%'
  };

  const statusColor = {
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444'
  }[health.overall];

  return (
    <div className="health-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <div className="health-status" style={{ color: statusColor }}>
          {health.overall === 'healthy' ? <FaCheckCircle /> : 
           health.overall === 'warning' ? <FaExclamationTriangle /> : <FaTimesCircle />}
          {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
        </div>
      </div>
      <div className="health-metrics">
        <div className="health-metric">
          <span className="metric-value">{health.systems}</span>
          <span className="metric-label">Systems Online</span>
        </div>
        <div className="health-metric">
          <span className="metric-value">{health.issues}</span>
          <span className="metric-label">Active Issues</span>
        </div>
        {!compact && (
          <div className="health-metric">
            <span className="metric-value">{health.uptime}</span>
            <span className="metric-label">Uptime</span>
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityWidget = ({ widget, data, compact }) => {
  const activities = data?.activities || generateActivityData();
  const maxItems = compact ? 3 : 8;

  return (
    <div className="activity-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="activity-count">{activities.length} recent</span>
      </div>
      <div className="activity-list">
        {activities.slice(0, maxItems).map((activity, index) => (
          <div key={index} className="activity-item">
            <div className="activity-icon">
              <FaClock />
            </div>
            <div className="activity-content">
              <span className="activity-text">{activity.text}</span>
              <span className="activity-time">{activity.time}</span>
            </div>
            <div className={`activity-status ${activity.status}`}>
              {activity.status === 'success' ? <FaCheckCircle /> :
               activity.status === 'error' ? <FaTimesCircle /> : <FaSpinner />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CapacityWidget = ({ widget, data, compact }) => {
  const capacity = data?.capacity || {
    total: Math.floor(Math.random() * 1000) + 500,
    used: Math.floor(Math.random() * 400) + 100,
    available: 0
  };
  capacity.available = capacity.total - capacity.used;
  capacity.utilization = ((capacity.used / capacity.total) * 100).toFixed(1);

  const utilizationColor = 
    capacity.utilization > 90 ? '#ef4444' :
    capacity.utilization > 80 ? '#f59e0b' : '#10b981';

  return (
    <div className="capacity-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="utilization" style={{ color: utilizationColor }}>
          {capacity.utilization}% Used
        </span>
      </div>
      <div className="capacity-bar">
        <div 
          className="capacity-fill" 
          style={{ 
            width: `${capacity.utilization}%`,
            backgroundColor: utilizationColor
          }}
        />
      </div>
      <div className="capacity-details">
        <div className="capacity-stat">
          <span className="stat-value">{capacity.used}TB</span>
          <span className="stat-label">Used</span>
        </div>
        <div className="capacity-stat">
          <span className="stat-value">{capacity.available}TB</span>
          <span className="stat-label">Available</span>
        </div>
        {!compact && (
          <div className="capacity-stat">
            <span className="stat-value">{capacity.total}TB</span>
            <span className="stat-label">Total</span>
          </div>
        )}
      </div>
    </div>
  );
};

const NetworkWidget = ({ widget, data, compact }) => {
  const networks = data?.networks || generateNetworkData();

  return (
    <div className="network-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="network-count">{networks.length} fabrics</span>
      </div>
      <div className="network-list">
        {networks.slice(0, compact ? 3 : 6).map((network, index) => (
          <div key={index} className="network-item">
            <div className="network-icon">
              <FaNetworkWired />
            </div>
            <div className="network-info">
              <span className="network-name">{network.name}</span>
              <span className="network-status">{network.zones} zones</span>
            </div>
            <div className={`network-health ${network.status}`}>
              {network.status === 'active' ? <FaCheckCircle /> : <FaExclamationTriangle />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemsWidget = ({ widget, data, compact }) => {
  const systems = data?.systems || generateSystemsData();

  return (
    <div className="systems-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="systems-count">{systems.length} systems</span>
      </div>
      <div className="systems-grid">
        {systems.slice(0, compact ? 4 : 8).map((system, index) => (
          <div key={index} className="system-card">
            <div className="system-icon">
              <FaServer />
            </div>
            <div className="system-info">
              <span className="system-name">{system.name}</span>
              <span className="system-capacity">{system.capacity}TB</span>
            </div>
            <div className={`system-status ${system.status}`}>
              {system.status === 'online' ? <FaCheckCircle /> : <FaTimesCircle />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GenericWidget = ({ widget, data, compact }) => (
  <div className="generic-widget">
    <div className="widget-header">
      <h4>{widget.title}</h4>
    </div>
    <div className="widget-content">
      <div className="widget-placeholder">
        <FaDatabase />
        <p>Widget: {widget.widget_type.display_name}</p>
        {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </div>
  </div>
);

// Loading and Error States
const WidgetLoading = () => (
  <div className="widget-loading">
    <FaSpinner className="spinning" />
    <span>Loading...</span>
  </div>
);

const WidgetError = ({ error }) => (
  <div className="widget-error">
    <FaExclamationTriangle />
    <span>Error: {error}</span>
  </div>
);

// Helper Functions
const getWidgetIcon = (iconName) => {
  const icons = {
    FaChartLine, FaDatabase, FaServer, FaNetworkWired, 
    FaExclamationTriangle, FaClock, FaUsers, FaHdd
  };
  return icons[iconName] || FaDatabase;
};

const CHART_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b'];

// Mock Data Generators
const generateChartData = () => {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return labels.map(name => ({
    name,
    value: Math.floor(Math.random() * 100) + 10
  }));
};

const generateTableData = () => {
  const statuses = ['Online', 'Warning', 'Critical'];
  return Array.from({ length: 15 }, (_, i) => ({
    name: `System-${i + 1}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    value: `${Math.floor(Math.random() * 100)}%`
  }));
};

const generateActivityData = () => {
  const activities = [
    'Storage import completed',
    'New zone created',
    'System health check',
    'Fabric configuration updated',
    'User login detected',
    'Backup process started'
  ];
  const statuses = ['success', 'warning', 'error'];
  
  return Array.from({ length: 10 }, (_, i) => ({
    text: activities[Math.floor(Math.random() * activities.length)],
    time: `${Math.floor(Math.random() * 60)} min ago`,
    status: statuses[Math.floor(Math.random() * statuses.length)]
  }));
};

const generateNetworkData = () => {
  const statuses = ['active', 'warning'];
  return Array.from({ length: 8 }, (_, i) => ({
    name: `Fabric-${i + 1}`,
    zones: Math.floor(Math.random() * 50) + 5,
    status: statuses[Math.floor(Math.random() * statuses.length)]
  }));
};

const generateSystemsData = () => {
  const statuses = ['online', 'offline'];
  return Array.from({ length: 12 }, (_, i) => ({
    name: `Storage-${i + 1}`,
    capacity: Math.floor(Math.random() * 500) + 100,
    status: statuses[Math.floor(Math.random() * statuses.length)]
  }));
};

const generateMockData = (widgetType) => {
  // Return appropriate mock data based on widget type
  return {
    value: Math.floor(Math.random() * 1000),
    data: generateChartData(),
    timestamp: new Date().toISOString()
  };
};