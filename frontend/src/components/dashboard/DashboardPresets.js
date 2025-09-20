import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaLayerGroup, FaDownload, FaEye, FaSpinner } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../context/ConfigContext';
import './DashboardPresets.css';

export const DashboardPresets = ({ onPresetSelect, onClose, currentLayout }) => {
  const { config } = useContext(ConfigContext);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [previewPreset, setPreviewPreset] = useState(null);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        setLoading(true);
        
        // Build URL with customer_id parameter if available
        let url = '/api/core/dashboard-v2/presets/';
        if (config?.customer?.id) {
          url += `?customer_id=${config.customer.id}`;
        }
        
        const response = await axios.get(url);
        setPresets(response.data.presets || []);
      } catch (err) {
        console.error('Error fetching presets:', err);
        // Fallback to predefined presets if API fails
        setPresets([
          {
            name: 'executive_overview',
            display_name: 'Executive Overview',
            description: 'High-level metrics and KPIs for executives. Uses your current theme.',
            category: 'executive',
            thumbnail_url: '',
            is_featured: true,
            usage_count: 150,
            layout_config: {
              theme: 'modern',
              widgets: [
                { widget_type: 'san_fabric_count', position_x: 0, position_y: 0, width: 3, height: 3 },
                { widget_type: 'storage_capacity_chart', position_x: 3, position_y: 0, width: 6, height: 4 },
                { widget_type: 'system_health_overview', position_x: 9, position_y: 0, width: 3, height: 3 }
              ]
            }
          },
          {
            name: 'technical_operations',
            display_name: 'Technical Operations',
            description: 'Detailed operational view for technical teams. Adapts to your theme.',
            category: 'technical',
            is_featured: true,
            usage_count: 95,
            layout_config: {
              theme: 'dark',
              widgets: [
                { widget_type: 'fabric_zones_table', position_x: 0, position_y: 0, width: 6, height: 4 },
                { widget_type: 'storage_systems_table', position_x: 6, position_y: 0, width: 6, height: 4 },
                { widget_type: 'recent_activity_feed', position_x: 0, position_y: 4, width: 12, height: 3 }
              ]
            }
          },
          {
            name: 'capacity_planning',
            display_name: 'Capacity Planning',
            description: 'Focus on storage capacity and growth trends. Preserves your theme choice.',
            category: 'capacity',
            usage_count: 67,
            layout_config: {
              theme: 'modern',
              widgets: [
                { widget_type: 'storage_capacity_chart', position_x: 0, position_y: 0, width: 8, height: 4 },
                { widget_type: 'capacity_utilization_metric', position_x: 8, position_y: 0, width: 4, height: 4 }
              ]
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPresets();
  }, [config?.customer?.id]);

  const handleApplyPreset = async (preset) => {
    try {
      setApplying(preset.name);
      await onPresetSelect(preset);
      onClose();
    } catch (error) {
      console.error('Failed to apply preset:', error);
      alert('Failed to apply preset. Please try again.');
    } finally {
      setApplying(null);
    }
  };

  const handlePreviewPreset = (preset) => {
    setPreviewPreset(preset);
  };

  if (loading) {
    return (
      <div className="presets-modal">
        <div className="presets-content">
          <div className="loading">Loading presets...</div>
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="presets-modal">
      <div className="presets-content">
        <div className="presets-header">
          <h3><FaLayerGroup /> Dashboard Templates</h3>
          <div className="header-subtitle">
            <small>Templates apply widget layouts while preserving your current theme</small>
          </div>
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
                {preset.is_custom && (
                  <div className="custom-badge">Custom</div>
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
                  {preset.is_custom && preset.created_by && (
                    <span className="created-by">
                      By: {preset.created_by}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="preset-actions">
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handlePreviewPreset(preset)}
                >
                  <FaEye /> Preview
                </button>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleApplyPreset(preset)}
                  disabled={applying === preset.name}
                >
                  {applying === preset.name ? (
                    <>
                      <FaSpinner className="spinning" /> Applying...
                    </>
                  ) : (
                    'Apply Template'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Preset Preview Modal */}
      {previewPreset && (
        <PresetPreviewModal
          preset={previewPreset}
          onClose={() => setPreviewPreset(null)}
          onApply={() => handleApplyPreset(previewPreset)}
          applying={applying === previewPreset.name}
          currentLayout={currentLayout}
        />
      )}
    </div>,
    document.body
  );
};

// Preset Preview Modal Component
const PresetPreviewModal = ({ preset, onClose, onApply, applying, currentLayout }) => (
  <div className="preset-preview-modal">
    <div className="preview-modal-content">
      <div className="preview-modal-header">
        <h3>{preset.display_name} Preview</h3>
        <button onClick={onClose} className="close-btn">
          <FaTimes />
        </button>
      </div>
      
      <div className="preview-modal-body">
        <div className="preset-preview-large">
          <div className="preview-info">
            <p>{preset.description}</p>
            <div className="theme-notice">
              <small><strong>Note:</strong> Your current theme will be preserved when applying this template.</small>
            </div>
            <div className="preview-specs">
              <div className="spec-item">
                <strong>Theme:</strong> {currentLayout?.theme || 'Modern'} (Your Current)
              </div>
              <div className="spec-item">
                <strong>Widgets:</strong> {preset.layout_config?.widgets?.length || 0}
              </div>
              <div className="spec-item">
                <strong>Category:</strong> {preset.category}
              </div>
              <div className="spec-item">
                <strong>Usage:</strong> {preset.usage_count} times
              </div>
            </div>
          </div>
          
          <div className="preview-layout">
            <div className="preview-dashboard">
              <div className="preview-grid">
                {preset.layout_config?.widgets?.map((widget, index) => (
                  <div 
                    key={index}
                    className="preview-widget"
                    style={{
                      gridColumn: `${widget.position_x + 1} / span ${widget.width}`,
                      gridRow: `${widget.position_y + 1} / span ${Math.ceil(widget.height / 100)}`,
                      minHeight: `${widget.height}px`
                    }}
                  >
                    <div className="preview-widget-header">
                      {widget.title || widget.widget_type.replace(/_/g, ' ')}
                    </div>
                    <div className="preview-widget-content">
                      {/* Mockup content based on widget type */}
                      {widget.widget_type.includes('chart') && (
                        <div className="chart-preview">📊</div>
                      )}
                      {widget.widget_type.includes('table') && (
                        <div className="table-preview">📋</div>
                      )}
                      {widget.widget_type.includes('metric') && (
                        <div className="metric-preview">📈</div>
                      )}
                      {widget.widget_type.includes('health') && (
                        <div className="health-preview">💚</div>
                      )}
                      {!widget.widget_type.includes('chart') && 
                       !widget.widget_type.includes('table') && 
                       !widget.widget_type.includes('metric') && 
                       !widget.widget_type.includes('health') && (
                        <div className="default-preview">📊</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="preview-modal-actions">
        <button onClick={onClose} className="btn btn-secondary">
          Close Preview
        </button>
        <button 
          onClick={onApply}
          className="btn btn-primary"
          disabled={applying}
        >
          {applying ? (
            <>
              <FaSpinner className="spinning" /> Applying...
            </>
          ) : (
            'Apply This Template'
          )}
        </button>
      </div>
    </div>
  </div>
);