import React, { useState, useEffect } from 'react';
import { FaDatabase, FaCheckCircle, FaTimesCircle, FaSpinner, FaClock } from 'react-icons/fa';
import axios from 'axios';
import './WidgetStyles.css';

const BackupHealthWidget = ({ widget, editMode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/backup-health/');
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editMode]);

  if (editMode) {
    return (
      <div className="widget-preview backup-health-widget">
        <div className="widget-header">
          <h4>Backup Health</h4>
        </div>
        <div className="widget-preview-content">
          <span className="status-badge completed">Healthy</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading backup-health-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error backup-health-widget">
        <span>{error}</span>
      </div>
    );
  }

  if (!data?.has_backups) {
    return (
      <div className="backup-health-widget">
        <div className="widget-header">
          <FaDatabase className="header-icon" />
          <h4>{widget?.title || 'Backup Health'}</h4>
        </div>
        <div className="widget-content">
          <div className="widget-empty">
            <div className="widget-empty-icon">💾</div>
            <div>No backups found</div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (data.status) {
      case 'completed':
      case 'verified':
        return <FaCheckCircle style={{ color: 'var(--color-success-fg)' }} />;
      case 'failed':
        return <FaTimesCircle style={{ color: 'var(--color-danger-fg)' }} />;
      case 'in_progress':
      case 'verifying':
        return <FaSpinner className="spinning" style={{ color: 'var(--color-info-fg)' }} />;
      default:
        return <FaDatabase />;
    }
  };

  return (
    <div className="backup-health-widget">
      <div className="widget-header">
        <FaDatabase className="header-icon" />
        <h4>{widget?.title || 'Backup Health'}</h4>
      </div>

      <div className="widget-content">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStatusIcon()}
          <span className={`status-badge ${data.status}`}>
            {data.status?.replace(/_/g, ' ').charAt(0).toUpperCase() + data.status?.slice(1).replace(/_/g, ' ')}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">
            <FaClock style={{ marginRight: '4px' }} />
            Last Backup
          </span>
          <span className="info-value">{data.time_since}</span>
        </div>

        <div className="info-row">
          <span className="info-label">Backup Type</span>
          <span className="info-value">{data.backup_type || 'Full'}</span>
        </div>

        <div className="info-row">
          <span className="info-label">Size</span>
          <span className="info-value">{data.file_size_mb?.toFixed(2)} MB</span>
        </div>

        {data.duration && (
          <div className="info-row">
            <span className="info-label">Duration</span>
            <span className="info-value">{data.duration}s</span>
          </div>
        )}

        {data.description && (
          <div style={{ marginTop: '12px', padding: '8px', background: 'var(--secondary-bg)', borderRadius: '4px', fontSize: '12px', color: 'var(--secondary-text)' }}>
            {data.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupHealthWidget;
