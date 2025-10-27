import React, { useState, useEffect, useContext } from 'react';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const ZoneDeploymentWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/zone-deployment/', {
          params: {
            project_id: config?.active_project?.id
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
      <div className="widget-preview zone-deployment-widget">
        <div className="widget-header">
          <h4>Zone Deployment Status</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">75%</div>
          <div className="stat-label">Deployed</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading zone-deployment-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error zone-deployment-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="zone-deployment-widget">
      <div className="widget-header">
        <FaCheckCircle className="header-icon" />
        <h4>{widget?.title || 'Zone Deployment'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-grid stat-grid-3">
          <div className="stat-item">
            <div className="stat-value">{data?.total_zones || 0}</div>
            <div className="stat-label">Total Zones</div>
          </div>

          <div className="stat-item">
            <FaCheckCircle className="stat-icon" style={{ color: '#10b981' }} />
            <div className="stat-value">{data?.deployed || 0}</div>
            <div className="stat-label">Deployed</div>
          </div>

          <div className="stat-item">
            <FaExclamationCircle className="stat-icon" style={{ color: '#f59e0b' }} />
            <div className="stat-value">{data?.designed || 0}</div>
            <div className="stat-label">Designed</div>
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-header">
            <span>Deployment Progress</span>
            <span>{data?.deployment_percentage || 0}%</span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${data?.deployment_percentage || 0}%` }}
            >
              {data?.deployment_percentage > 10 && `${data?.deployment_percentage}%`}
            </div>
          </div>
          <div className="progress-labels">
            <div className="progress-label-item">
              <span className="progress-dot deployed"></span>
              <span>Deployed: {data?.deployed || 0}</span>
            </div>
            <div className="progress-label-item">
              <span className="progress-dot designed"></span>
              <span>Designed: {data?.designed || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneDeploymentWidget;
