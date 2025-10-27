import React, { useState, useEffect, useContext } from 'react';
import {
  FaChartLine, FaDatabase, FaServer, FaNetworkWired,
  FaExclamationTriangle, FaClock, FaUsers, FaHdd,
  FaCheckCircle, FaTimesCircle, FaSpinner
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import axios from 'axios';
import { ConfigContext } from '../../context/ConfigContext';
import InsightsStatusWidget from './widgets/InsightsStatusWidget';
import SanOverviewWidget from './widgets/SanOverviewWidget';
import ZoneDeploymentWidget from './widgets/ZoneDeploymentWidget';
import AliasDistributionWidget from './widgets/AliasDistributionWidget';
import StorageInventoryWidget from './widgets/StorageInventoryWidget';
import HostConnectivityWidget from './widgets/HostConnectivityWidget';
import ImportActivityWidget from './widgets/ImportActivityWidget';
import BackupHealthWidget from './widgets/BackupHealthWidget';
import WwpnInventoryWidget from './widgets/WwpnInventoryWidget';
import ProjectActivityWidget from './widgets/ProjectActivityWidget';
import StorageCapacityWidget from './widgets/StorageCapacityWidget';

export const WidgetRenderer = ({ widget, editMode, compact = false }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Get customer ID from config context
  const customerId = config?.customer?.id;

  // Fetch widget data based on type
  useEffect(() => {
    const fetchWidgetData = async () => {
      // Force data fetch for storage_systems widget regardless of requires_data_source
      if (widget?.widget_type?.name !== 'storage_systems' && !widget?.widget_type?.requires_data_source) {
        return;
      }

      if (!customerId) {
        setError('No active customer selected');
        return;
      }

      // Prevent multiple fetches for storage_systems widget
      if (widget?.widget_type?.name === 'storage_systems' && hasFetched) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getWidgetData(widget, customerId);
        setData(response);
        setHasFetched(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgetData();

    // Set up auto-refresh if needed (disabled for storage_systems to prevent flickering)
    const refreshInterval = widget.refresh_interval || 30;
    if (!editMode && refreshInterval > 0 && widget?.widget_type?.name !== 'storage_systems') {
      const interval = setInterval(fetchWidgetData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget?.id, widget?.widget_type?.name, editMode, customerId]);

  if (loading) {
    return <WidgetLoading />;
  }

  if (error) {
    return <WidgetError error={error} />;
  }

  // Render based on widget type
  switch (widget.widget_type.component_name) {
    case 'SystemsWidget':
      return <SystemsWidget widget={widget} data={data} compact={compact} />;
    case 'InsightsStatusWidget':
      return <InsightsStatusWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'SanOverviewWidget':
      return <SanOverviewWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'ZoneDeploymentWidget':
      return <ZoneDeploymentWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'AliasDistributionWidget':
      return <AliasDistributionWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'StorageInventoryWidget':
      return <StorageInventoryWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'HostConnectivityWidget':
      return <HostConnectivityWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'ImportActivityWidget':
      return <ImportActivityWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'BackupHealthWidget':
      return <BackupHealthWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'WwpnInventoryWidget':
      return <WwpnInventoryWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'ProjectActivityWidget':
      return <ProjectActivityWidget widget={widget} editMode={editMode} compact={compact} />;
    case 'StorageCapacityWidget':
      return <StorageCapacityWidget widget={widget} editMode={editMode} compact={compact} />;
    default:
      return <GenericWidget widget={widget} data={data} compact={compact} />;
  }
};

// Widget Data Fetcher
const getWidgetData = async (widget, customerId) => {
  const { widget_type, data_filters, config } = widget;
  
  try {
    let response;
    // Merge customer ID with existing data filters
    const params = { ...data_filters, customer: customerId };
    
    switch (widget_type.name) {
      case 'storage_systems':
        response = await axios.get('/api/storage/', { params });
        return response.data;
      default:
        // Mock data for demo purposes - fallback for unsupported widget types
        return generateMockData(widget_type.name);
    }
  } catch (error) {
    throw new Error(`Failed to fetch widget data: ${error.response?.data?.detail || error.message}`);
  }
};

// Individual Widget Components

const SystemsWidget = ({ widget, data, compact }) => {
  // Handle real storage systems data from backend
  const systems = data?.results || [];

  const formatSystem = (system) => {
    return {
      id: system.id,
      name: system.name || `Storage-${system.id}`,
      storage_type: system.storage_type || '-',
      machine_type: system.machine_type || '-',
      model: system.model || '-',
      serial_number: system.serial_number || '-',
      firmware_level: system.firmware_level || '-',
      hosts: system.db_hosts_count || 0,
      volumes: system.db_volumes_count || 0
    };
  };

  const formattedSystems = systems.map(formatSystem);
  const maxRows = compact ? 5 : 10;

  return (
    <div className="systems-widget">
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <span className="systems-count">{formattedSystems.length} systems</span>
      </div>
      
      {formattedSystems.length === 0 ? (
        <div className="systems-empty">
          <span>No storage systems found</span>
        </div>
      ) : (
        <div className="systems-table-container">
          <table className="systems-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Model</th>
                <th>Serial</th>
                {!compact && <th>Machine Type</th>}
                {!compact && <th>Firmware</th>}
                <th>Hosts</th>
                <th>Volumes</th>
              </tr>
            </thead>
            <tbody>
              {formattedSystems.slice(0, maxRows).map((system) => (
                <tr key={system.id}>
                  <td className="system-name" title={system.name}>
                    {system.name}
                  </td>
                  <td className="system-type">
                    {system.storage_type}
                  </td>
                  <td className="system-model">
                    {system.model}
                  </td>
                  <td className="system-serial" title={system.serial_number}>
                    {system.serial_number.length > 8 ? 
                      `${system.serial_number.substring(0, 8)}...` : 
                      system.serial_number
                    }
                  </td>
                  {!compact && (
                    <td className="system-machine-type">
                      {system.machine_type}
                    </td>
                  )}
                  {!compact && (
                    <td className="system-firmware" title={system.firmware_level}>
                      {system.firmware_level.length > 10 ? 
                        `${system.firmware_level.substring(0, 10)}...` : 
                        system.firmware_level
                      }
                    </td>
                  )}
                  <td className="system-hosts">
                    <span className="count-badge hosts">
                      {system.hosts}
                    </span>
                  </td>
                  <td className="system-volumes">
                    <span className="count-badge volumes">
                      {system.volumes}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {formattedSystems.length > maxRows && (
            <div className="systems-footer">
              +{formattedSystems.length - maxRows} more systems
            </div>
          )}
        </div>
      )}
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

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown time';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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