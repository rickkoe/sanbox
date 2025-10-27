import React, { useState, useEffect, useContext } from 'react';
import { FaChartLine, FaServer, FaHdd, FaCompress } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const StorageCapacityWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/storage-capacity/', {
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
      <div className="widget-preview storage-capacity-widget">
        <div className="widget-header">
          <h4>Storage Capacity</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">125.4 TB</div>
          <div className="stat-label">Total Capacity</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading storage-capacity-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error storage-capacity-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="storage-capacity-widget">
      <div className="widget-header">
        <FaChartLine className="header-icon" />
        <h4>{widget?.title || 'Storage Capacity'}</h4>
      </div>

      <div className="widget-content">
        <div style={{ marginBottom: '16px', textAlign: 'center', padding: '12px', background: 'var(--stat-bg, #f9fafb)', borderRadius: '6px' }}>
          <FaServer style={{ fontSize: '24px', color: 'var(--icon-color, #6b7280)', marginBottom: '8px' }} />
          <div style={{ fontSize: '14px', color: 'var(--text-muted, #6b7280)', marginBottom: '4px' }}>
            {data?.system_count || 0} Storage Systems
          </div>
        </div>

        <div className="capacity-display">
          <div className="capacity-row">
            <span className="capacity-label">
              <FaHdd style={{ marginRight: '6px', fontSize: '14px' }} />
              Total Capacity
            </span>
            <span className="capacity-value large">
              {data?.total_capacity_tb?.toFixed(2) || '0.00'}
              <span className="capacity-unit">TB</span>
            </span>
          </div>

          <div className="capacity-row">
            <span className="capacity-label">Used</span>
            <span className="capacity-value">
              {data?.used_capacity_tb?.toFixed(2) || '0.00'}
              <span className="capacity-unit">TB</span>
            </span>
          </div>

          <div className="capacity-row">
            <span className="capacity-label">Available</span>
            <span className="capacity-value">
              {data?.available_capacity_tb?.toFixed(2) || '0.00'}
              <span className="capacity-unit">TB</span>
            </span>
          </div>

          {data?.compression_savings_tb > 0 && (
            <div className="capacity-row" style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', marginTop: '8px', paddingTop: '8px' }}>
              <span className="capacity-label">
                <FaCompress style={{ marginRight: '6px', fontSize: '14px', color: '#10b981' }} />
                Compression Savings
              </span>
              <span className="capacity-value" style={{ color: '#10b981' }}>
                {data.compression_savings_tb.toFixed(2)}
                <span className="capacity-unit">TB</span>
              </span>
            </div>
          )}
        </div>

        <div className="progress-section" style={{ marginTop: '16px' }}>
          <div className="progress-header">
            <span>Utilization</span>
            <span>{data?.used_percentage?.toFixed(1) || 0}%</span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${data?.used_percentage || 0}%`,
                background: data?.used_percentage > 80 ? '#ef4444' : data?.used_percentage > 60 ? '#f59e0b' : '#10b981'
              }}
            >
              {data?.used_percentage > 10 && `${data?.used_percentage?.toFixed(1)}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageCapacityWidget;
