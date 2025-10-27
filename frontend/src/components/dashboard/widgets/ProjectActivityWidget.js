import React, { useState, useEffect, useContext } from 'react';
import { FaClock, FaRoute, FaTags, FaUser } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const ProjectActivityWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/project-activity/', {
          params: {
            project_id: config?.active_project?.id,
            limit: 10
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

    if (config?.active_project?.id) {
      fetchData();
    }
  }, [config?.active_project?.id, editMode]);

  if (editMode) {
    return (
      <div className="widget-preview project-activity-widget">
        <div className="widget-header">
          <h4>Project Activity</h4>
        </div>
        <div className="widget-preview-content">
          <div className="activity-item zone">
            <span>Zone modified</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading project-activity-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error project-activity-widget">
        <span>{error}</span>
      </div>
    );
  }

  if (!data?.activities || data.activities.length === 0) {
    return (
      <div className="project-activity-widget">
        <div className="widget-header">
          <FaClock className="header-icon" />
          <h4>{widget?.title || 'Project Activity'}</h4>
        </div>
        <div className="widget-content">
          <div className="widget-empty">
            <div className="widget-empty-icon">📋</div>
            <div>No recent activity</div>
          </div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="project-activity-widget">
      <div className="widget-header">
        <FaClock className="header-icon" />
        <h4>{widget?.title || 'Project Activity'}</h4>
      </div>

      <div className="widget-content">
        <div className="activity-list">
          {data.activities.map((activity, index) => (
            <div key={index} className={`activity-item ${activity.type}`}>
              {activity.type === 'zone' ? (
                <FaRoute className="activity-icon" style={{ color: '#3b82f6' }} />
              ) : (
                <FaTags className="activity-icon" style={{ color: '#10b981' }} />
              )}

              <div className="activity-details">
                <div className="activity-name">{activity.name}</div>
                <div className="activity-meta">
                  <span className="activity-user">
                    <FaUser style={{ fontSize: '10px', marginRight: '2px' }} />
                    {activity.user}
                  </span>
                  <span>{formatTimestamp(activity.timestamp)}</span>
                </div>
              </div>

              <span className={`status-badge ${activity.type === 'zone' ? 'zone' : 'alias'}`}>
                {activity.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectActivityWidget;
