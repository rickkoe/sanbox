import React, { useState, useEffect, useContext } from 'react';
import { FaTags, FaLayerGroup, FaHdd, FaEdit, FaLink } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const WwpnInventoryWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/wwpn-inventory/', {
          params: {
            customer_id: config?.customer?.id,
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

    if (config?.customer?.id) {
      fetchData();
    }
  }, [config?.customer?.id, config?.active_project?.id, editMode]);

  if (editMode) {
    return (
      <div className="widget-preview wwpn-inventory-widget">
        <div className="widget-header">
          <h4>WWPN Inventory</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">156</div>
          <div className="stat-label">Total WWPNs</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading wwpn-inventory-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error wwpn-inventory-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="wwpn-inventory-widget">
      <div className="widget-header">
        <FaTags className="header-icon" />
        <h4>{widget?.title || 'WWPN Inventory'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-item" style={{ marginBottom: '16px' }}>
          <FaTags className="stat-icon wwpn" />
          <div className="stat-value">{data?.total_wwpns || 0}</div>
          <div className="stat-label">Total WWPNs</div>
        </div>

        <div className="type-distribution">
          <div className="type-item">
            <span className="type-name">
              <FaLayerGroup style={{ marginRight: '6px', fontSize: '14px', color: '#3b82f6' }} />
              Alias WWPNs
            </span>
            <span className="type-count">{data?.alias_wwpns || 0}</span>
          </div>
          <div className="type-item">
            <span className="type-name">
              <FaHdd style={{ marginRight: '6px', fontSize: '14px', color: '#10b981' }} />
              Host WWPNs
            </span>
            <span className="type-count">{data?.host_wwpns || 0}</span>
          </div>
          <div className="type-item">
            <span className="type-name">
              <FaLink style={{ marginRight: '6px', fontSize: '14px', color: '#8b5cf6' }} />
              Alias-Derived
            </span>
            <span className="type-count">{data?.alias_derived_wwpns || 0}</span>
          </div>
          <div className="type-item">
            <span className="type-name">
              <FaEdit style={{ marginRight: '6px', fontSize: '14px', color: '#f59e0b' }} />
              Manual
            </span>
            <span className="type-count">{data?.manual_wwpns || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WwpnInventoryWidget;
