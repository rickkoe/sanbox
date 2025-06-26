import { useState, useEffect } from 'react';

export const useTableColumns = (columns, colHeaders, defaultVisibleColumns, customRenderers, dropdownSources) => {
  const [visibleColumns, setVisibleColumns] = useState({});
  const [columnFilter, setColumnFilter] = useState('');

  // Initialize visible columns
  useEffect(() => {
    const newVisibleState = columns.reduce((acc, col, index) => {
      if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
        acc[index] = defaultVisibleColumns.includes(index);
      } else {
        acc[index] = true; // Show all columns by default
      }
      return acc;
    }, {});
    
    setVisibleColumns(newVisibleState);
  }, [columns.length]);

  const isRequiredColumn = (columnIndex) => {
    return defaultVisibleColumns.includes(columnIndex);
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
    isRequiredColumn
  };
};