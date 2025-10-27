import React, { useState, useEffect, useContext } from 'react';
import { FaServer, FaHdd } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const StorageInventoryWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/storage-inventory/', {
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
      <div className="widget-preview storage-inventory-widget">
        <div className="widget-header">
          <h4>Storage Systems</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">5</div>
          <div className="stat-label">Systems</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading storage-inventory-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error storage-inventory-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="storage-inventory-widget">
      <div className="widget-header">
        <FaServer className="header-icon" />
        <h4>{widget?.title || 'Storage Systems'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-item" style={{ marginBottom: '16px' }}>
          <FaHdd className="stat-icon storage" />
          <div className="stat-value">{data?.total_systems || 0}</div>
          <div className="stat-label">Storage Systems</div>
        </div>

        {data?.by_type && Object.keys(data.by_type).length > 0 ? (
          <div className="type-distribution">
            {Object.entries(data.by_type).map(([type, count]) => (
              <div key={type} className="type-item">
                <span className="type-name">{type}</span>
                <span className="type-count">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="widget-empty">
            <div className="widget-empty-icon">📦</div>
            <div>No storage systems found</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageInventoryWidget;
