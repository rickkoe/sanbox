import React, { useState, useEffect, useContext, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';
import { 
  FaPlus, FaCog, FaGripVertical, FaTimes, FaExpand, FaCompress,
  FaDownload, FaUpload, FaRedo, FaEye, FaEyeSlash,
  FaLayerGroup, FaStore, FaWrench, FaChartLine, FaDatabase,
  FaNetworkWired, FaServer, FaUsers, FaHdd, FaSearch,
  FaBars, FaTh, FaThLarge, FaGlobe, FaExclamationTriangle,
} from 'react-icons/fa';
import { ConfigContext } from '../context/ConfigContext';
import { useTheme } from '../context/ThemeContext';
import { useCustomDashboard } from '../hooks/useCustomDashboard';
import { WidgetMarketplace } from '../components/dashboard/WidgetMarketplace';
import { DashboardPresets } from '../components/dashboard/DashboardPresets';
import { SaveTemplateModal } from '../components/dashboard/SaveTemplateModal';
import { GridLayoutRenderer } from '../components/dashboard/GridLayoutRenderer';
import { DashboardToolbar } from '../components/dashboard/DashboardToolbar';
import './CustomizableDashboard.css';

const CustomizableDashboard = () => {
  const { config } = useContext(ConfigContext);
  const { updateTheme, registerDashboardUpdate, unregisterDashboardUpdate } = useTheme();
  const {
    dashboard,
    loading,
    error,
    addWidget,
    updateWidget,
    removeWidget,
    updateLayout,
    applyPreset,
    refreshDashboard
  } = useCustomDashboard(config?.customer?.id);

  const [editMode, setEditMode] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [dashboardView, setDashboardView] = useState('grid'); // grid, list, cards

  // Register dashboard theme update function
  useEffect(() => {
    const handleDashboardThemeUpdate = async (themeName) => {
      if (!config?.customer?.id) return;
      
      try {
        await updateLayout({
          theme: themeName,
          customer_id: config.customer.id
        });
      } catch (error) {
        console.error('Failed to update dashboard theme:', error);
        throw error;
      }
    };

    registerDashboardUpdate(handleDashboardThemeUpdate);
    
    return () => {
      unregisterDashboardUpdate();
    };
  }, [registerDashboardUpdate, unregisterDashboardUpdate, updateLayout, config?.customer?.id]);

  // Sync theme context with dashboard theme
  useEffect(() => {
    if (dashboard?.layout?.theme) {
      updateTheme(dashboard.layout.theme);
    }
  }, [dashboard?.layout?.theme, updateTheme]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!dashboard?.layout?.auto_refresh || editMode) return;
    
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshDashboard();
      }
    }, (dashboard.layout.refresh_interval || 30) * 1000);

    return () => clearInterval(interval);
  }, [dashboard?.layout, editMode, refreshDashboard]);

  const handleAddWidget = useCallback(async (widgetType, position) => {
    try {
      await addWidget({
        widget_type: widgetType.name,
        title: widgetType.display_name,
        position_x: position?.x || 0,
        position_y: position?.y || 0,
        width: widgetType.default_width,
        height: widgetType.default_height
      });
      // Keep marketplace open after adding a widget
    } catch (error) {
      console.error('Failed to add widget:', error);
    }
  }, [addWidget]);


  const handlePresetApply = useCallback(async (preset) => {
    try {
      await applyPreset({
        preset_name: preset.name,
        customer_id: config?.customer?.id
      });
      setShowPresets(false);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to apply preset:', error);
      console.error('Error details:', error.response?.data);
      alert('Failed to apply template. Please try again.');
    }
  }, [applyPreset, config?.customer?.id]);

  const handleSaveTemplate = useCallback(async (templateData) => {
    try {
      if (!config?.customer?.id) {
        alert('No customer selected. Please select a customer first.');
        return;
      }
      
      const response = await axios.post('/api/core/dashboard-v2/templates/save/', {
        customer_id: config?.customer?.id,
        template_name: templateData.name,
        template_description: templateData.description,
        is_public: templateData.isPublic || false
      });
      
      setShowSaveTemplate(false);
      // Show success message or refresh presets
      alert(`Template "${templateData.name}" saved successfully!`);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template. Please try again.');
    }
  }, [config?.customer?.id]);

  if (loading && !dashboard) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <DashboardError error={error} onRetry={refreshDashboard} />;
  }

  if (!config?.customer?.id || !config?.active_project?.id) {
    return <WelcomeScreen />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`customizable-dashboard theme-${dashboard?.layout?.theme || 'modern'}`}>
        {/* Dashboard Header & Controls */}
        <DashboardHeader
          layout={dashboard?.layout}
          editMode={editMode}
          onEditModeToggle={() => setEditMode(!editMode)}
          onShowMarketplace={() => setShowMarketplace(true)}
          onShowPresets={() => setShowPresets(true)}
          onShowSaveTemplate={() => setShowSaveTemplate(true)}
          onRefresh={refreshDashboard}
          dashboardView={dashboardView}
          onViewChange={setDashboardView}
        />

        {/* Edit Mode Toolbar */}
        {editMode && (
          <DashboardToolbar
            onAddWidget={() => setShowMarketplace(true)}
            onLoadPreset={() => setShowPresets(true)}
            selectedWidget={selectedWidget}
            onWidgetConfig={setSelectedWidget}
          />
        )}

        {/* Main Dashboard Content */}
        <div className="dashboard-content">
          <GridLayoutRenderer
            widgets={dashboard?.widgets || []}
            layout={dashboard?.layout}
            editMode={editMode}
            onWidgetUpdate={updateWidget}
            onWidgetRemove={removeWidget}
            onWidgetSelect={setSelectedWidget}
            selectedWidget={selectedWidget}
            viewMode={dashboardView}
          />
        </div>

        {/* Dashboard Stats Footer */}
        {editMode && (
          <DashboardFooter
            layout={dashboard?.layout}
            widgetCount={dashboard?.widgets?.length || 0}
          />
        )}

        {/* Modals and Overlays */}
        {showMarketplace && (
          <WidgetMarketplace
            onAddWidget={handleAddWidget}
            onRemoveWidget={removeWidget}
            onClose={() => setShowMarketplace(false)}
            existingWidgets={dashboard?.widgets || []}
          />
        )}


        {showPresets && (
          <DashboardPresets
            onPresetSelect={handlePresetApply}
            onClose={() => setShowPresets(false)}
            currentLayout={dashboard?.layout}
          />
        )}

        {showSaveTemplate && (
          <SaveTemplateModal
            onSave={handleSaveTemplate}
            onClose={() => setShowSaveTemplate(false)}
            currentLayout={{
              ...dashboard?.layout,
              widgets: dashboard?.widgets || []
            }}
          />
        )}
      </div>
    </DndProvider>
  );
};

// Dashboard Header Component
const DashboardHeader = ({ 
  layout, 
  editMode, 
  onEditModeToggle, 
  onShowMarketplace, 
  onShowPresets,
  onShowSaveTemplate,
  onRefresh,
  dashboardView,
  onViewChange 
}) => {
  const { config } = useContext(ConfigContext);
  
  return (
    <div className="dashboard-header-v2">
      <div className="header-left">
        <div className="dashboard-title">
          <h1>{layout?.name || 'My Dashboard'}</h1>
          <span className="customer-name">{config?.customer?.name}</span>
          {layout?.updated_at && (
            <small className="last-updated">
              Updated: {new Date(layout.updated_at).toLocaleString()}
            </small>
          )}
        </div>
      </div>

      <div className="header-controls">
        {/* View Mode Selector */}
        <div className="view-selector">
          <button
            className={`view-btn ${dashboardView === 'grid' ? 'active' : ''}`}
            onClick={() => onViewChange('grid')}
            title="Grid View"
          >
            <FaTh />
          </button>
          <button
            className={`view-btn ${dashboardView === 'list' ? 'active' : ''}`}
            onClick={() => onViewChange('list')}
            title="List View"
          >
            <FaBars />
          </button>
          <button
            className={`view-btn ${dashboardView === 'cards' ? 'active' : ''}`}
            onClick={() => onViewChange('cards')}
            title="Card View"
          >
            <FaThLarge />
          </button>
        </div>

        {/* Dashboard Actions */}
        <div className="header-actions">
          <button className="action-btn" onClick={onRefresh} title="Refresh">
            <FaRedo />
          </button>


          <button className="action-btn" onClick={onShowPresets} title="Templates">
            <FaLayerGroup />
          </button>

          <button className="action-btn" onClick={onShowSaveTemplate} title="Save as Template">
            <FaDownload />
          </button>

          {editMode && (
            <button className="action-btn" onClick={onShowMarketplace} title="Manage Widgets">
              <FaStore />
              Manage Widgets
            </button>
          )}

          <button 
            className={`action-btn ${editMode ? 'active' : ''}`}
            onClick={onEditModeToggle}
            title={editMode ? 'Exit Edit Mode' : 'Edit Dashboard'}
          >
            <FaWrench />
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Footer Component
const DashboardFooter = ({ layout, widgetCount }) => (
  <div className="dashboard-footer">
    <div className="footer-stats">
      <span className="stat-item">
        <FaLayerGroup /> {widgetCount} widgets
      </span>
      <span className="stat-item">
        <FaTh /> {layout?.grid_columns || 12} columns
      </span>
      <span className="stat-item">
        <FaRedo /> {layout?.refresh_interval || 30}s refresh
      </span>
    </div>
    <div className="footer-tip">
      <FaGripVertical /> Drag widgets to reposition • Click to configure • Right-click for options
    </div>
  </div>
);

// Error State Component
const DashboardError = ({ error, onRetry }) => (
  <div className="dashboard-error">
    <div className="error-content">
      <FaExclamationTriangle className="error-icon" />
      <h3>Dashboard Error</h3>
      <p>{error}</p>
      <button onClick={onRetry} className="btn btn-primary">
        <FaRedo /> Try Again
      </button>
    </div>
  </div>
);

// Loading State Component
const DashboardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="skeleton-header"></div>
    <div className="skeleton-toolbar"></div>
    <div className="skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton-widget"></div>
      ))}
    </div>
  </div>
);

// Welcome Screen Component
const WelcomeScreen = () => (
  <div className="welcome-screen">
    <div className="welcome-content">
      <FaGlobe className="welcome-icon" />
      <h1>Welcome to Sanbox Dashboard</h1>
      <p>Create your personalized SAN management experience</p>
      <div className="welcome-actions">
        <button className="btn btn-primary">
          <FaCog /> Configure Project
        </button>
        <button className="btn btn-outline-primary">
          <FaUsers /> Manage Customers
        </button>
      </div>
    </div>
  </div>
);

export default CustomizableDashboard;