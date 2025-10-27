import React, { useState, useEffect, useContext } from 'react';
import { FaHdd, FaLink, FaUnlink } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const HostConnectivityWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/host-connectivity/', {
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
      <div className="widget-preview host-connectivity-widget">
        <div className="widget-header">
          <h4>Host Connectivity</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">24</div>
          <div className="stat-label">Hosts</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading host-connectivity-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error host-connectivity-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="host-connectivity-widget">
      <div className="widget-header">
        <FaHdd className="header-icon" />
        <h4>{widget?.title || 'Host Connectivity'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-grid stat-grid-2x2">
          <div className="stat-item">
            <FaHdd className="stat-icon host" />
            <div className="stat-value">{data?.total_hosts || 0}</div>
            <div className="stat-label">Total Hosts</div>
          </div>

          <div className="stat-item">
            <FaLink className="stat-icon" style={{ color: '#10b981' }} />
            <div className="stat-value">{data?.hosts_with_wwpns || 0}</div>
            <div className="stat-label">With WWPNs</div>
          </div>

          <div className="stat-item">
            <FaUnlink className="stat-icon" style={{ color: '#f59e0b' }} />
            <div className="stat-value">{data?.hosts_without_wwpns || 0}</div>
            <div className="stat-label">Without WWPNs</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{data?.total_wwpns || 0}</div>
            <div className="stat-label">Total WWPNs</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostConnectivityWidget;
