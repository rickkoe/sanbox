import React, { useState, useEffect, useContext } from 'react';
import { FaCloudUploadAlt, FaCheckCircle, FaTimesCircle, FaSpinner, FaServer, FaHdd, FaUsers } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const ImportActivityWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/import-activity/', {
          params: {
            customer_id: config?.customer?.id
          }
        });
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (config?.customer?.id) {
      fetchData();
    }
  }, [config?.customer?.id, editMode]);

  if (editMode) {
    return (
      <div className="widget-preview import-activity-widget">
        <div className="widget-header">
          <h4>Recent Import Activity</h4>
        </div>
        <div className="widget-preview-content">
          <span className="status-badge completed">Completed</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading import-activity-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error import-activity-widget">
        <span>{error}</span>
      </div>
    );
  }

  if (!data?.has_imports) {
    return (
      <div className="import-activity-widget">
        <div className="widget-header">
          <FaCloudUploadAlt className="header-icon" />
          <h4>{widget?.title || 'Import Activity'}</h4>
        </div>
        <div className="widget-content">
          <div className="widget-empty">
            <div className="widget-empty-icon">📥</div>
            <div>No imports found</div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (data.status) {
      case 'completed':
        return <FaCheckCircle style={{ color: '#10b981' }} />;
      case 'failed':
        return <FaTimesCircle style={{ color: '#ef4444' }} />;
      case 'running':
        return <FaSpinner className="spinning" style={{ color: '#3b82f6' }} />;
      default:
        return <FaCloudUploadAlt />;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="import-activity-widget">
      <div className="widget-header">
        <FaCloudUploadAlt className="header-icon" />
        <h4>{widget?.title || 'Import Activity'}</h4>
      </div>

      <div className="widget-content">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStatusIcon()}
          <span className={`status-badge ${data.status}`}>
            {data.status?.charAt(0).toUpperCase() + data.status?.slice(1)}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Started</span>
          <span className="info-value">{formatDate(data.started_at)}</span>
        </div>

        {data.completed_at && (
          <div className="info-row">
            <span className="info-label">Completed</span>
            <span className="info-value">{formatDate(data.completed_at)}</span>
          </div>
        )}

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
          <div className="stat-grid stat-grid-3">
            <div className="stat-item">
              <FaServer className="stat-icon" style={{ fontSize: '20px' }} />
              <div className="stat-value" style={{ fontSize: '24px' }}>{data.storage_systems_imported || 0}</div>
              <div className="stat-label">Systems</div>
            </div>

            <div className="stat-item">
              <FaHdd className="stat-icon" style={{ fontSize: '20px' }} />
              <div className="stat-value" style={{ fontSize: '24px' }}>{data.volumes_imported || 0}</div>
              <div className="stat-label">Volumes</div>
            </div>

            <div className="stat-item">
              <FaUsers className="stat-icon" style={{ fontSize: '20px' }} />
              <div className="stat-value" style={{ fontSize: '24px' }}>{data.hosts_imported || 0}</div>
              <div className="stat-label">Hosts</div>
            </div>
          </div>
        </div>

        {data.error_message && (
          <div style={{ marginTop: '16px', padding: '8px', background: '#fee2e2', borderRadius: '4px', fontSize: '12px', color: '#991b1b' }}>
            {data.error_message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportActivityWidget;
