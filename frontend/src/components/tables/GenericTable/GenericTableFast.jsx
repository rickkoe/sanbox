import React, { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { DataGrid } from 'react-data-grid';
import axios from 'axios';
import { useTheme } from '../../../context/ThemeContext';
import { useTableConfiguration } from './hooks/useTableConfiguration';
import { generateTableColumns, convertLegacyColumns } from './utils/columnUtils';
import './GenericTableFast.css';

/**
 * GenericTableFast - High-performance implementation using react-data-grid
 * - Native virtualization for large datasets
 * - Excellent performance with inline editing
 * - Built-in sorting and filtering
 * - Modern React patterns
 */

const GenericTableFast = forwardRef((props, ref) => {
  const {
    apiUrl,
    data: externalData,
    columns = [],
    colHeaders = [],
    tableName = 'generic',
    newRowTemplate = {},
    preprocessData,
    height = '600px',
    className = '',
    defaultPageSize = 50,
    onSave,
    onDelete,
    saveUrl,
    deleteUrl,
    dropdownSources = {},
    onBuildPayload,
    beforeSave,
    afterSave,
    getExportFilename,
    memberCount = 20,
    visibleBaseIndices
  } = props;

  const { theme } = useTheme();
  
  // State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Table configuration hook for persistence (OPTIMIZED)
  const {
    tableConfig,
    isConfigLoaded,
    updateConfig
  } = useTableConfiguration({
    tableName,
    columns,
    colHeaders,
    defaultVisibleColumns: [],
    userId: null
  });

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!apiUrl && !externalData) return;
    
    if (externalData) {
      const processedData = preprocessData ? preprocessData(externalData) : externalData;
      setData(processedData);
      return;
    }
    
    setLoading(true);
    try {
      const fullApiUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}page_size=10000`;
      const response = await axios.get(fullApiUrl);
      const responseData = response.data;
      const dataArray = Array.isArray(responseData) ? responseData : responseData.results || [];
      const processedData = preprocessData ? preprocessData(dataArray) : dataArray;
      
      // Add minimal blank rows for performance
      const blankRows = newRowTemplate ? Array.from({ length: 5 }, (_, i) => ({
        ...newRowTemplate,
        _id: `blank_${i}`,
        _isNew: true
      })) : [];
      
      setData([...processedData, ...blankRows]);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, externalData, preprocessData, newRowTemplate]);

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update cell value - OPTIMIZED for react-data-grid
  const updateCellValue = useCallback((rowIndex, columnKey, value) => {
    setData(oldData => {
      const newData = [...oldData];
      const targetRow = newData[rowIndex];
      
      if (targetRow) {
        const updatedRow = {
          ...targetRow,
          [columnKey]: value
        };
        
        // Convert blank rows to real rows only for text input
        if (updatedRow._isNew && typeof value === 'string' && value.trim() !== '') {
          delete updatedRow._isNew;
          delete updatedRow._id;
        }
        
        newData[rowIndex] = updatedRow;
      }
      
      return newData;
    });
    
    setIsDirty(true);
  }, []);

  // Generate columns for react-data-grid
  const gridColumns = useMemo(() => {
    let finalColumns = [];
    
    if (columns.length === 0 && tableName !== 'generic') {
      const generated = generateTableColumns(tableName, { memberCount, visibleBaseIndices });
      finalColumns = generated.columns;
    } else if (columns.length > 0) {
      const converted = convertLegacyColumns(columns, colHeaders);
      finalColumns = converted.columns;
    }

    // Convert to react-data-grid format
    return finalColumns.map(col => ({
      key: col.data || col.key,
      name: col.title || col.name,
      width: col.width || 150,
      resizable: true,
      sortable: true,
      editor: getEditor(col.data, dropdownSources[col.data]),
      formatter: getFormatter(col.data, dropdownSources[col.data]),
    }));
  }, [columns, colHeaders, tableName, memberCount, visibleBaseIndices, dropdownSources]);

  // Simple editor for react-data-grid
  const getEditor = useCallback((columnKey, options) => {
    if (options && options.length > 0) {
      // Dropdown editor
      return ({ row, onRowChange, onClose }) => {
        return (
          <select
            autoFocus
            value={row[columnKey] || ''}
            onChange={(e) => {
              onRowChange({ ...row, [columnKey]: e.target.value });
              onClose(true);
            }}
            onBlur={() => onClose(false)}
          >
            <option value="">Select...</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      };
    }
    
    // Default text editor
    return ({ row, column, onRowChange, onClose }) => {
      return (
        <input
          autoFocus
          type="text"
          value={row[column.key] ?? ''}
          onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value })}
          onBlur={() => onClose(true)}
        />
      );
    };
  }, []);

  // Simple formatter for react-data-grid
  const getFormatter = useCallback((columnKey, options) => {
    return ({ row }) => {
      const value = row[columnKey];
      
      // Handle boolean values as checkboxes
      if (typeof value === 'boolean' || (options && options.includes(true))) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => {
                const newData = [...data];
                const rowIndex = newData.findIndex(r => r === row);
                if (rowIndex >= 0) {
                  newData[rowIndex] = { ...row, [columnKey]: e.target.checked };
                  setData(newData);
                  setIsDirty(true);
                }
              }}
            />
          </div>
        );
      }
      
      return <div>{value ?? ''}</div>;
    };
  }, [data]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isDirty || (!onSave && !saveUrl)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Filter out empty rows
      let dataToSave = data.filter(row => {
        if (row._isNew) return false;
        return Object.values(row).some(value => 
          value !== null && value !== undefined && value !== ''
        );
      });

      // Apply custom payload transformation if provided
      if (onBuildPayload) {
        dataToSave = dataToSave.map(row => onBuildPayload(row));
      }
      
      // Validation
      if (beforeSave) {
        const validationResult = beforeSave(dataToSave);
        if (validationResult !== true) {
          alert(validationResult);
          return;
        }
      }

      let result;
      if (onSave) {
        // Use custom save handler
        result = await onSave(dataToSave);
      } else if (saveUrl) {
        // Use bulk save endpoint
        const response = await axios.post(saveUrl, { data: dataToSave });
        result = { success: true, message: 'Data saved successfully!' };
      }

      if (result.success) {
        alert(result.message || 'Saved successfully!');
        setIsDirty(false);
        if (afterSave) afterSave();
        fetchData(); // Refresh data
      } else {
        alert('Error saving: ' + result.message);
      }
      
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  }, [isDirty, data, onSave, saveUrl, onBuildPayload, beforeSave, afterSave, fetchData]);

  // Handle row updates from react-data-grid
  const handleRowsChange = useCallback((newRows, { indexes }) => {
    setData(newRows);
    setIsDirty(true);
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    refresh: fetchData,
    getData: () => data,
    isDirty,
  }));

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <div className={`generic-table-fast ${className}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Save button */}
      {isDirty && (
        <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
          <button 
            onClick={handleSave}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
      
      {/* Data Grid */}
      <DataGrid
        columns={gridColumns}
        rows={data}
        onRowsChange={handleRowsChange}
        className="rdg-light"
        style={{ flex: 1 }}
        rowKeyGetter={(row) => row.id || row._id}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
        }}
      />
    </div>
  );
});

GenericTableFast.displayName = 'GenericTableFast';

export default GenericTableFast;