import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const useCustomDashboard = (customerId) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshTimeoutRef = useRef(null);

  // Fetch dashboard layout and widgets
  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    if (!customerId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (!forceRefresh && dashboard) {
        // Don't show loading state for background refreshes
      } else {
        setLoading(true);
      }

      const response = await axios.get('/api/core/dashboard-v2/layout/', {
        params: { 
          customer_id: customerId,
          _t: forceRefresh ? Date.now() : undefined
        }
      });

      setDashboard(response.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [customerId, dashboard]);

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Add widget to dashboard
  const addWidget = useCallback(async (widgetData) => {
    if (!customerId) throw new Error('Customer ID required');

    try {
      const response = await axios.post('/api/core/dashboard-v2/widgets/', {
        ...widgetData,
        customer_id: customerId
      });

      // Refresh dashboard to get updated widget list
      await fetchDashboard(true);
      
      return response.data;
    } catch (err) {
      console.error('Error adding widget:', err);
      throw new Error(err.response?.data?.error || 'Failed to add widget');
    }
  }, [customerId, fetchDashboard]);

  // Update widget configuration
  const updateWidget = useCallback(async (widgetId, updates) => {
    try {
      const response = await axios.put(`/api/core/dashboard-v2/widgets/${widgetId}/`, updates);
      
      // Update widget in local state for immediate feedback
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.map(widget =>
          widget.id === widgetId ? { ...widget, ...updates } : widget
        )
      }));

      return response.data;
    } catch (err) {
      console.error('Error updating widget:', err);
      throw new Error(err.response?.data?.error || 'Failed to update widget');
    }
  }, []);

  // Remove widget from dashboard
  const removeWidget = useCallback(async (widgetId) => {
    try {
      await axios.delete(`/api/core/dashboard-v2/widgets/${widgetId}/`);
      
      // Remove widget from local state
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.filter(widget => widget.id !== widgetId)
      }));
    } catch (err) {
      console.error('Error removing widget:', err);
      throw new Error(err.response?.data?.error || 'Failed to remove widget');
    }
  }, []);

  // Update dashboard layout configuration
  const updateLayout = useCallback(async (layoutUpdates) => {
    if (!customerId) throw new Error('Customer ID required');

    try {
      const response = await axios.post('/api/core/dashboard-v2/layout/', {
        ...layoutUpdates,
        customer_id: customerId
      });

      // Update layout in local state
      setDashboard(prev => ({
        ...prev,
        layout: { ...prev.layout, ...layoutUpdates }
      }));

      return response.data;
    } catch (err) {
      console.error('Error updating layout:', err);
      throw new Error(err.response?.data?.error || 'Failed to update layout');
    }
  }, [customerId]);

  // Apply dashboard preset
  const applyPreset = useCallback(async (presetData) => {
    if (!customerId) throw new Error('Customer ID required');

    try {
      const response = await axios.post('/api/core/dashboard-v2/presets/apply/', {
        ...presetData,
        customer_id: customerId
      });

      // Refresh dashboard to get new layout and widgets
      await fetchDashboard(true);
      
      return response.data;
    } catch (err) {
      console.error('Error applying preset:', err);
      throw new Error(err.response?.data?.error || 'Failed to apply preset');
    }
  }, [customerId, fetchDashboard]);

  // Duplicate widget
  const duplicateWidget = useCallback(async (widget) => {
    const duplicateData = {
      widget_type: widget.widget_type.name,
      title: `${widget.title} (Copy)`,
      position_x: Math.min(widget.position_x + widget.width, 12 - widget.width),
      position_y: widget.position_y + 1,
      width: widget.width,
      height: widget.height,
      config: { ...widget.config },
      data_filters: { ...widget.data_filters }
    };

    return addWidget(duplicateData);
  }, [addWidget]);

  // Export dashboard configuration
  const exportDashboard = useCallback(() => {
    if (!dashboard) return null;

    const exportData = {
      layout: {
        name: dashboard.layout.name,
        theme: dashboard.layout.theme,
        grid_columns: dashboard.layout.grid_columns,
        auto_refresh: dashboard.layout.auto_refresh,
        refresh_interval: dashboard.layout.refresh_interval
      },
      widgets: dashboard.widgets.map(widget => ({
        widget_type: widget.widget_type.name,
        title: widget.title,
        position_x: widget.position_x,
        position_y: widget.position_y,
        width: widget.width,
        height: widget.height,
        config: widget.config,
        data_filters: widget.data_filters
      })),
      exported_at: new Date().toISOString(),
      version: '2.0'
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboard.layout.name.replace(/\s+/g, '_')}_dashboard.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return exportData;
  }, [dashboard]);

  // Import dashboard configuration
  const importDashboard = useCallback(async (importData) => {
    if (!customerId) throw new Error('Customer ID required');

    try {
      // Validate import data structure
      if (!importData.layout || !importData.widgets) {
        throw new Error('Invalid dashboard configuration');
      }

      // Update layout first
      await updateLayout(importData.layout);

      // Clear existing widgets and add imported ones
      if (dashboard?.widgets) {
        await Promise.all(dashboard.widgets.map(widget => removeWidget(widget.id)));
      }

      // Add imported widgets
      for (const widgetData of importData.widgets) {
        await addWidget(widgetData);
      }

      // Refresh to get final state
      await fetchDashboard(true);
    } catch (err) {
      console.error('Error importing dashboard:', err);
      throw new Error(err.response?.data?.error || 'Failed to import dashboard');
    }
  }, [customerId, updateLayout, removeWidget, addWidget, dashboard?.widgets, fetchDashboard]);

  // Auto-save functionality
  const autoSave = useCallback(() => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Set new timeout for auto-save
    refreshTimeoutRef.current = setTimeout(() => {
      if (dashboard?.layout?.auto_refresh) {
        fetchDashboard(false);
      }
    }, 30000); // Auto-save every 30 seconds
  }, [dashboard?.layout?.auto_refresh, fetchDashboard]);

  // Trigger auto-save when dashboard changes
  useEffect(() => {
    autoSave();
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoSave]);

  // Refresh dashboard data
  const refreshDashboard = useCallback(() => {
    return fetchDashboard(true);
  }, [fetchDashboard]);

  // Get widget analytics
  const getWidgetAnalytics = useCallback(async (days = 30) => {
    if (!customerId) return null;

    try {
      const response = await axios.get('/api/core/dashboard-v2/analytics/', {
        params: { 
          customer_id: customerId,
          days 
        }
      });
      return response.data.analytics;
    } catch (err) {
      console.error('Error fetching analytics:', err);
      return null;
    }
  }, [customerId]);

  // Bulk widget operations
  const bulkUpdateWidgets = useCallback(async (updates) => {
    try {
      const promises = updates.map(({ widgetId, data }) => 
        updateWidget(widgetId, data)
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Error bulk updating widgets:', err);
      throw new Error('Failed to update widgets');
    }
  }, [updateWidget]);

  const bulkRemoveWidgets = useCallback(async (widgetIds) => {
    try {
      const promises = widgetIds.map(id => removeWidget(id));
      await Promise.all(promises);
    } catch (err) {
      console.error('Error bulk removing widgets:', err);
      throw new Error('Failed to remove widgets');
    }
  }, [removeWidget]);

  // Widget position helpers
  const moveWidget = useCallback(async (widgetId, newPosition) => {
    return updateWidget(widgetId, {
      position_x: newPosition.x,
      position_y: newPosition.y
    });
  }, [updateWidget]);

  const resizeWidget = useCallback(async (widgetId, newSize) => {
    return updateWidget(widgetId, {
      width: newSize.width,
      height: newSize.height
    });
  }, [updateWidget]);

  // Layout helpers
  const resetLayout = useCallback(async () => {
    return updateLayout({
      theme: 'modern',
      grid_columns: 12,
      auto_refresh: true,
      refresh_interval: 30
    });
  }, [updateLayout]);

  const optimizeLayout = useCallback(async () => {
    if (!dashboard?.widgets) return;

    // Simple optimization: compact widgets vertically
    const sortedWidgets = [...dashboard.widgets].sort((a, b) => 
      a.position_y - b.position_y || a.position_x - b.position_x
    );

    const updates = [];
    let currentRow = 0;

    for (const widget of sortedWidgets) {
      if (widget.position_y !== currentRow) {
        updates.push({
          widgetId: widget.id,
          data: { position_y: currentRow }
        });
      }
      currentRow++;
    }

    if (updates.length > 0) {
      await bulkUpdateWidgets(updates);
    }
  }, [dashboard?.widgets, bulkUpdateWidgets]);

  return {
    // State
    dashboard,
    loading,
    error,

    // Widget operations
    addWidget,
    updateWidget,
    removeWidget,
    duplicateWidget,
    moveWidget,
    resizeWidget,

    // Bulk operations
    bulkUpdateWidgets,
    bulkRemoveWidgets,

    // Layout operations
    updateLayout,
    resetLayout,
    optimizeLayout,

    // Presets
    applyPreset,

    // Import/Export
    exportDashboard,
    importDashboard,

    // Refresh and analytics
    refreshDashboard,
    getWidgetAnalytics,

    // State helpers
    isLoading: loading,
    hasError: !!error,
    isEmpty: !loading && (!dashboard?.widgets || dashboard.widgets.length === 0)
  };
};