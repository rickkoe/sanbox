import React, { useState, useEffect } from 'react';
import { FaTimes, FaLayerGroup, FaDownload, FaEye } from 'react-icons/fa';
import './DashboardPresets.css';

export const DashboardPresets = ({ onPresetSelect, onClose, currentLayout }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        // For now, use predefined presets
        setPresets([
          {
            name: 'executive_overview',
            display_name: 'Executive Overview',
            description: 'High-level metrics and KPIs for executives',
            category: 'executive',
            thumbnail_url: '',
            is_featured: true,
            usage_count: 150,
            layout_config: {
              theme: 'corporate',
              widgets: [
                { widget_type: 'san_metrics', position_x: 0, position_y: 0, width: 3, height: 200 },
                { widget_type: 'storage_capacity', position_x: 3, position_y: 0, width: 6, height: 300 },
                { widget_type: 'system_health', position_x: 9, position_y: 0, width: 3, height: 200 }
              ]
            }
          },
          {
            name: 'technical_operations',
            display_name: 'Technical Operations',
            description: 'Detailed operational view for technical teams',
            category: 'technical',
            is_featured: true,
            usage_count: 95,
            layout_config: {
              theme: 'dark',
              widgets: [
                { widget_type: 'fabric_overview', position_x: 0, position_y: 0, width: 4, height: 250 },
                { widget_type: 'storage_systems', position_x: 4, position_y: 0, width: 4, height: 250 },
                { widget_type: 'recent_activity', position_x: 8, position_y: 0, width: 4, height: 250 },
                { widget_type: 'capacity_analytics', position_x: 0, position_y: 1, width: 12, height: 300 }
              ]
            }
          },
          {
            name: 'capacity_planning',
            display_name: 'Capacity Planning',
            description: 'Focus on storage capacity and growth trends',
            category: 'capacity',
            usage_count: 67,
            layout_config: {
              theme: 'modern',
              widgets: [
                { widget_type: 'storage_capacity', position_x: 0, position_y: 0, width: 8, height: 350 },
                { widget_type: 'capacity_trends', position_x: 8, position_y: 0, width: 4, height: 350 },
                { widget_type: 'utilization_alerts', position_x: 0, position_y: 1, width: 6, height: 250 },
                { widget_type: 'growth_projections', position_x: 6, position_y: 1, width: 6, height: 250 }
              ]
            }
          },
          {
            name: 'security_monitoring',
            display_name: 'Security Monitoring',
            description: 'Security-focused dashboard with alerts and monitoring',
            category: 'security',
            usage_count: 43,
            layout_config: {
              theme: 'dark',
              widgets: [
                { widget_type: 'security_alerts', position_x: 0, position_y: 0, width: 6, height: 250 },
                { widget_type: 'access_logs', position_x: 6, position_y: 0, width: 6, height: 250 },
                { widget_type: 'zone_security', position_x: 0, position_y: 1, width: 4, height: 300 },
                { widget_type: 'compliance_status', position_x: 4, position_y: 1, width: 8, height: 300 }
              ]
            }
          }
        ]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching presets:', err);
        setLoading(false);
      }
    };

    fetchPresets();
  }, []);

  if (loading) {
    return (
      <div className="presets-modal">
        <div className="presets-content">
          <div className="loading">Loading presets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="presets-modal">
      <div className="presets-content">
        <div className="presets-header">
          <h3><FaLayerGroup /> Dashboard Templates</h3>
          <button onClick={onClose} className="close-btn">
            <FaTimes />
          </button>
        </div>
        
        <div className="presets-grid">
          {presets.map(preset => (
            <div key={preset.name} className="preset-card">
              <div className="preset-preview">
                <div className="preset-thumbnail">
                  {/* Mock thumbnail showing widget layout */}
                  <div className="thumbnail-grid">
                    {preset.layout_config.widgets.slice(0, 4).map((widget, i) => (
                      <div 
                        key={i} 
                        className="thumbnail-widget"
                        style={{
                          gridColumn: `span ${Math.min(widget.width / 3, 2)}`,
                          gridRow: `span 1`
                        }}
                      />
                    ))}
                  </div>
                </div>
                {preset.is_featured && (
                  <div className="featured-badge">Featured</div>
                )}
              </div>
              
              <div className="preset-info">
                <h4>{preset.display_name}</h4>
                <p>{preset.description}</p>
                
                <div className="preset-meta">
                  <span className="usage-count">
                    <FaDownload /> {preset.usage_count} uses
                  </span>
                  <span className="widget-count">
                    {preset.layout_config.widgets.length} widgets
                  </span>
                </div>
              </div>
              
              <div className="preset-actions">
                <button className="btn btn-outline-secondary btn-sm">
                  <FaEye /> Preview
                </button>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => onPresetSelect(preset)}
                >
                  Apply Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};