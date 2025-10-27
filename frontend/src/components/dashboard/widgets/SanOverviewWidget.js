import React, { useState, useEffect, useContext } from 'react';
import { FaNetworkWired, FaLayerGroup, FaRoute, FaTags, FaServer } from 'react-icons/fa';
import { SiCisco } from 'react-icons/si';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const SanOverviewWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/san-overview/', {
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

    if (config?.customer?.id && config?.active_project?.id) {
      fetchData();
    }
  }, [config?.customer?.id, config?.active_project?.id, editMode]);

  if (editMode) {
    return (
      <div className="widget-preview san-overview-widget">
        <div className="widget-header">
          <h4>SAN Configuration Overview</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-grid">
            <div className="stat-item">
              <FaLayerGroup className="stat-icon" />
              <div className="stat-value">3</div>
              <div className="stat-label">Fabrics</div>
            </div>
            <div className="stat-item">
              <FaRoute className="stat-icon" />
              <div className="stat-value">42</div>
              <div className="stat-label">Zones</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading san-overview-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error san-overview-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="san-overview-widget">
      <div className="widget-header">
        <FaNetworkWired className="header-icon" />
        <h4>{widget?.title || 'SAN Configuration'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-grid stat-grid-2x2">
          <div className="stat-item">
            <FaLayerGroup className="stat-icon fabric" />
            <div className="stat-value">{data?.total_fabrics || 0}</div>
            <div className="stat-label">Fabrics</div>
          </div>

          <div className="stat-item">
            <FaRoute className="stat-icon zone" />
            <div className="stat-value">{data?.total_zones || 0}</div>
            <div className="stat-label">Zones</div>
          </div>

          <div className="stat-item">
            <FaTags className="stat-icon alias" />
            <div className="stat-value">{data?.total_aliases || 0}</div>
            <div className="stat-label">Aliases</div>
          </div>

          <div className="stat-item">
            <FaServer className="stat-icon switch" />
            <div className="stat-value">{data?.total_switches || 0}</div>
            <div className="stat-label">Switches</div>
          </div>
        </div>

        {(data?.cisco_fabrics > 0 || data?.brocade_fabrics > 0) && (
          <div className="vendor-breakdown">
            <div className="breakdown-label">Fabric Vendors:</div>
            <div className="vendor-stats">
              {data.cisco_fabrics > 0 && (
                <span className="vendor-badge cisco">
                  <SiCisco /> Cisco: {data.cisco_fabrics}
                </span>
              )}
              {data.brocade_fabrics > 0 && (
                <span className="vendor-badge brocade">
                  Brocade: {data.brocade_fabrics}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SanOverviewWidget;
