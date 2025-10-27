import React, { useState, useEffect, useContext } from 'react';
import { FaChartBar, FaTags } from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const AliasDistributionWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/alias-distribution/', {
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
      <div className="widget-preview alias-distribution-widget">
        <div className="widget-header">
          <h4>Alias Distribution</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">42</div>
          <div className="stat-label">Total Aliases</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading alias-distribution-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error alias-distribution-widget">
        <span>{error}</span>
      </div>
    );
  }

  const chartData = [
    { name: 'Initiators', value: data?.initiators || 0 },
    { name: 'Targets', value: data?.targets || 0 },
    { name: 'Both', value: data?.both || 0 }
  ].filter(item => item.value > 0);

  return (
    <div className="alias-distribution-widget">
      <div className="widget-header">
        <FaTags className="header-icon" />
        <h4>{widget?.title || 'Alias Distribution'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-item" style={{ marginBottom: '16px' }}>
          <FaChartBar className="stat-icon alias" />
          <div className="stat-value">{data?.total_aliases || 0}</div>
          <div className="stat-label">Total Aliases</div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="widget-empty">
            <div className="widget-empty-icon">📊</div>
            <div>No alias data available</div>
          </div>
        )}

        <div className="type-distribution">
          <div className="type-item">
            <span className="type-name">Initiators</span>
            <span className="type-count">{data?.initiators || 0}</span>
          </div>
          <div className="type-item">
            <span className="type-name">Targets</span>
            <span className="type-count">{data?.targets || 0}</span>
          </div>
          <div className="type-item">
            <span className="type-name">Both</span>
            <span className="type-count">{data?.both || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AliasDistributionWidget;
