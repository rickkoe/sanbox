import { useState, useEffect } from 'react';
import { useTableConfiguration } from './useTableConfiguration';

export const useTableColumns = (
  columns, 
  colHeaders, 
  defaultVisibleColumns, 
  customRenderers, 
  dropdownSources,
  tableName,
  userId = null,
  requiredColumns = []
) => {
  const [visibleColumns, setVisibleColumns] = useState({});
  const [columnFilter, setColumnFilter] = useState('');

  // Always call the configuration hook, but it will handle null tableName gracefully
  const {
    tableConfig,
    isConfigLoaded,
    configError,
    getVisibleColumnsState,
    updateVisibleColumns,
    updateConfig,
    resetConfiguration
  } = useTableConfiguration({
    tableName,
    columns,
    colHeaders,
    defaultVisibleColumns,
    userId
  });

  // Initialize visible columns from saved configuration
  useEffect(() => {
    if (isConfigLoaded && columns.length > 0) {
      const savedVisibleState = getVisibleColumnsState();
      
      // If no saved configuration or all columns are false (no tableName scenario), use defaults
      const hasValidSavedState = Object.keys(savedVisibleState).length > 0 && 
                                Object.values(savedVisibleState).some(Boolean);
      
      if (!hasValidSavedState || !tableName) {
        const defaultVisibleState = columns.reduce((acc, col, index) => {
          if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
            acc[index] = defaultVisibleColumns.includes(index);
          } else {
            acc[index] = true; // Show all columns by default
          }
          return acc;
        }, {});
        setVisibleColumns(defaultVisibleState);
        // Don't call updateVisibleColumns here to avoid infinite loop during initialization
      } else {
        setVisibleColumns(savedVisibleState);
      }
    }
  }, [isConfigLoaded, columns.length, tableName]); // Add tableName to dependencies

  const isRequiredColumn = (columnIndex) => {
    return requiredColumns.includes(columnIndex);
  };

  const createVisibleColumns = () => {
    return columns
      .map((col, index) => {
        if (!visibleColumns[index]) return null;
        
        const isDropdown = dropdownSources.hasOwnProperty(col.data);
        const columnConfig = {
          ...col,
          type: isDropdown ? "dropdown" : col.type,
          source: isDropdown ? dropdownSources[col.data] : undefined,
        };
        
        // Preserve important dropdown properties like allowInvalid
        if (isDropdown && col.allowInvalid !== undefined) {
          columnConfig.allowInvalid = col.allowInvalid;
        }
        
        if (customRenderers[col.data]) {
          columnConfig.renderer = customRenderers[col.data];
        }
        
        return columnConfig;
      })
      .filter(col => col !== null);
  };

  const createVisibleHeaders = () => {
    return colHeaders.filter((header, index) => visibleColumns[index]);
  };

  const toggleColumnVisibility = (columnIndex) => {
    // Prevent hiding required columns
    if (isRequiredColumn(columnIndex) && visibleColumns[columnIndex]) {
      return;
    }
    
    const newVisibleState = {
      ...visibleColumns,
      [columnIndex]: !visibleColumns[columnIndex]
    };
    
    setVisibleColumns(newVisibleState);
    
    // Only save to API if configuration is working
    if (!configError) {
      updateVisibleColumns(newVisibleState);
    }
  };

  const toggleAllColumns = (showAll) => {
    const newVisibleState = columns.reduce((acc, col, index) => {
      // Required columns are always visible
      if (isRequiredColumn(index)) {
        acc[index] = true;
      } else {
        acc[index] = showAll;
      }
      return acc;
    }, {});
    
    setVisibleColumns(newVisibleState);
    
    // Only save to API if configuration is working
    if (!configError) {
      updateVisibleColumns(newVisibleState);
    }
  };

  return {
    visibleColumns,
    setVisibleColumns,
    columnFilter,
    setColumnFilter,
    createVisibleColumns,
    createVisibleHeaders,
    toggleColumnVisibility,
    toggleAllColumns,
    isRequiredColumn,
    // Table configuration methods
    tableConfig,
    isConfigLoaded,
    configError,
    updateConfig,
    resetConfiguration
  };
};