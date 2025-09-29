import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ConfigContext } from '../../../../context/ConfigContext';

/**
 * Hook for managing table configuration persistence
 * Handles loading and saving of column visibility, filters, sorting, etc.
 */
export const useTableConfiguration = ({
  tableName,
  columns = [],
  colHeaders = [],
  defaultVisibleColumns = [],
  userId = null
}) => {
  const { config } = useContext(ConfigContext);
  const customerId = useMemo(() => config?.customer?.id, [config?.customer?.id]); // Memoize to prevent unnecessary re-renders
  
  // console.log(`🔍 useTableConfiguration for ${tableName}:`, {
  //   config,
  //   customerId,
  //   configLoaded: !!config,
  //   customerLoaded: !!(config?.customer)
  // });

  // Configuration state
  const [tableConfig, setTableConfig] = useState({
    visible_columns: [],
    column_widths: {},
    filters: {},
    sorting: {},
    page_size: 25,
    additional_settings: {}
  });

  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [configError, setConfigError] = useState(false);

  // Build API URL for table configuration
  const getConfigUrl = useCallback(() => {
    if (!customerId || !tableName) return null;
    const params = new URLSearchParams({
      customer: customerId,
      table_name: tableName
    });
    if (userId) {
      params.append('user', userId);
    }
    return `/api/core/table-config/?${params.toString()}`;
  }, [customerId, tableName, userId]);

  // Load table configuration from API
  const loadConfiguration = useCallback(async () => {
    const url = getConfigUrl();
    if (!url) {
      // No URL available, use defaults and mark as loaded
      const defaultConfig = {
        visible_columns: defaultVisibleColumns.map(index => colHeaders[index] || `column_${index}`),
        column_widths: {},
        filters: {},
        sorting: {},
        page_size: 25,
        additional_settings: {}
      };
      setTableConfig(defaultConfig);
      setIsConfigLoaded(true);
      return;
    }

    try {
      const response = await axios.get(url);
      const config = response.data;
      
      console.log(`🔍 API Response for table configuration ${tableName}:`, response.data);
      
      // If we got an empty response, use defaults
      if (!config.visible_columns || config.visible_columns.length === 0) {
        const defaultConfig = {
          visible_columns: defaultVisibleColumns.map(index => colHeaders[index] || `column_${index}`),
          column_widths: {},
          filters: {},
          sorting: {},
          page_size: 25,
          additional_settings: {}
        };
        setTableConfig(defaultConfig);
      } else {
        // Merge saved configuration with new default columns
        // This ensures new columns (like additional member columns) are included
        const defaultVisibleColumnNames = defaultVisibleColumns.map(index => colHeaders[index] || `column_${index}`);
        const savedVisibleColumns = config.visible_columns || [];
        
        // Add any new default columns that aren't in the saved config
        const mergedVisibleColumns = [...new Set([...savedVisibleColumns, ...defaultVisibleColumnNames])];
        
        const mergedConfig = {
          ...config,
          visible_columns: mergedVisibleColumns
        };
        
        console.log(`🔄 Merged configuration for ${tableName}:`, {
          saved: savedVisibleColumns.length,
          defaults: defaultVisibleColumnNames.length,
          merged: mergedVisibleColumns.length,
          newColumns: defaultVisibleColumnNames.filter(col => !savedVisibleColumns.includes(col))
        });
        
        setTableConfig(mergedConfig);
      }
      
      setConfigError(false);
      console.log(`📋 Loaded table configuration for ${tableName}:`, config);
    } catch (error) {
      console.warn(`⚠️ Could not load table configuration for ${tableName}:`, error);
      setConfigError(true);
      
      // Use defaults if loading fails
      const defaultConfig = {
        visible_columns: defaultVisibleColumns.map(index => colHeaders[index] || `column_${index}`),
        column_widths: {},
        filters: {},
        sorting: {},
        page_size: 25,
        additional_settings: {}
      };
      setTableConfig(defaultConfig);
    } finally {
      setIsConfigLoaded(true);
    }
  }, [tableName, defaultVisibleColumns, colHeaders, customerId]); // Simplified dependencies

  // Save table configuration to API
  const saveConfiguration = useCallback(async (newConfig) => {
    if (!customerId || !tableName || isConfigSaving || configError) return;

    setIsConfigSaving(true);
    try {
      const payload = {
        customer: customerId,
        table_name: tableName,
        user: userId,
        ...newConfig
      };

      console.log('💾 Saving table configuration payload:', JSON.stringify(payload, null, 2));
      await axios.post('/api/core/table-config/', payload);
      setTableConfig(newConfig);
      console.log(`💾 Saved table configuration for ${tableName}:`, newConfig);
    } catch (error) {
      console.error(`❌ Failed to save table configuration for ${tableName}:`, error);
      // Don't throw or break the app, just log the error
    } finally {
      setIsConfigSaving(false);
    }
  }, [customerId, tableName, userId, isConfigSaving, configError]);

  // Debounced save function to avoid too many API calls
  const debouncedSave = useCallback(
    debounce((newConfig) => {
      saveConfiguration(newConfig);
    }, 1000),
    [saveConfiguration]
  );

  // Update specific configuration section
  const updateConfig = useCallback((section, value) => {
    if (configError) return; // Don't update if there's a configuration error
    
    // Check if the value actually changed to prevent unnecessary saves
    const currentValue = tableConfig[section];
    const valueString = JSON.stringify(value);
    const currentValueString = JSON.stringify(currentValue);
    
    if (valueString === currentValueString) {
      console.log(`🔄 ${section} unchanged, skipping save`);
      return;
    }
    
    const newConfig = {
      ...tableConfig,
      [section]: value
    };
    setTableConfig(newConfig);
    debouncedSave(newConfig);
    console.log(`📝 Queued save for ${section}:`, value);
  }, [tableConfig, debouncedSave, configError]);

  // Convert visible columns from names to column indices
  const getVisibleColumnIndices = useCallback(() => {
    if (!tableConfig.visible_columns || !colHeaders) return [];
    
    return tableConfig.visible_columns
      .map(columnName => colHeaders.findIndex(header => header === columnName))
      .filter(index => index !== -1);
  }, [tableConfig.visible_columns, colHeaders]);

  // Convert column indices to visible state object
  const getVisibleColumnsState = useCallback(() => {
    const visibleIndices = getVisibleColumnIndices();
    return columns.reduce((acc, col, index) => {
      acc[index] = visibleIndices.includes(index);
      return acc;
    }, {});
  }, [getVisibleColumnIndices, columns]);

  // Update visible columns
  const updateVisibleColumns = useCallback((visibleState) => {
    if (configError || !colHeaders || colHeaders.length === 0) return;
    
    const visibleColumnNames = Object.entries(visibleState)
      .filter(([index, isVisible]) => isVisible)
      .map(([index]) => colHeaders[parseInt(index)])
      .filter(name => name);
    
    updateConfig('visible_columns', visibleColumnNames);
  }, [colHeaders, updateConfig, configError]);

  // Reset configuration
  const resetConfiguration = useCallback(async () => {
    if (!customerId || !tableName) return;

    try {
      await axios.post('/api/core/table-config/reset/', {
        customer: customerId,
        table_name: tableName,
        user: userId
      });
      
      // Reset to defaults
      const defaultConfig = {
        visible_columns: defaultVisibleColumns.map(index => colHeaders[index] || `column_${index}`),
        column_widths: {},
        filters: {},
        sorting: {},
        page_size: 25,
        additional_settings: {}
      };
      setTableConfig(defaultConfig);
      console.log(`🔄 Reset table configuration for ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to reset table configuration for ${tableName}:`, error);
    }
  }, [customerId, tableName, userId, defaultVisibleColumns, colHeaders]);

  // Load configuration on mount or when dependencies change
  useEffect(() => {
    console.log(`🔍 useTableConfiguration effect triggered for ${tableName}:`, {
      customerId, 
      tableName, 
      colHeadersLength: colHeaders.length,
      isConfigLoaded,
      hasConfig: !!config
    });
    
    if (customerId && tableName) {
      console.log(`📋 Loading configuration for table: ${tableName} with customer ${customerId}`);
      loadConfiguration();
    } else if (!tableName) {
      // If no tableName provided, just mark as loaded with defaults
      setIsConfigLoaded(true);
      setConfigError(true); // Treat as error so no API calls are made
    } else if (!customerId) {
      console.log(`⏳ Waiting for customer ID to load for table: ${tableName}`);
    }
  }, [customerId, tableName]); // Remove config dependency to prevent re-renders on every cell edit

  return {
    tableConfig,
    isConfigLoaded,
    isConfigSaving,
    configError,
    updateConfig,
    getVisibleColumnIndices,
    getVisibleColumnsState,
    updateVisibleColumns,
    resetConfiguration,
    loadConfiguration,
    saveConfiguration
  };
};

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}