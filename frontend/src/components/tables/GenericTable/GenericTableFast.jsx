import React, { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper
} from '@tanstack/react-table';
import axios from 'axios';
import { useTheme } from '../../../context/ThemeContext';
import { generateTableColumns, convertLegacyColumns } from './utils/columnUtils';
import './GenericTableFast.css';

/**
 * GenericTableFast - Modern implementation using TanStack Table v8
 * - Full React 18 compatibility
 * - Better performance
 * - Active development and support
 */

const columnHelper = createColumnHelper();

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
    defaultPageSize = 25,
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
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [rowSelection, setRowSelection] = useState({});

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
      
      // Add blank rows for new entries
      const blankRows = newRowTemplate ? Array.from({ length: 20 }, (_, i) => ({
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

  // Update cell value - defined before use in columns
  const updateCellValue = useCallback((rowIndex, columnId, value) => {
    setData(old => 
      old.map((row, index) => {
        if (index === rowIndex) {
          const updatedRow = {
            ...row,
            [columnId]: value
          };
          
          // Handle new rows
          if (updatedRow._isNew) {
            const hasData = Object.entries(updatedRow).some(([key, val]) => 
              key !== '_id' && key !== '_isNew' && 
              val !== null && val !== undefined && val !== ''
            );
            
            if (hasData) {
              delete updatedRow._isNew;
              delete updatedRow._id;
            }
          }
          
          return updatedRow;
        }
        return row;
      })
    );
    setIsDirty(true);
  }, []);

  // Generate table columns
  const tableColumns = useMemo(() => {
    let finalColumns = [];
    
    if (columns.length === 0 && tableName !== 'generic') {
      const generated = generateTableColumns(tableName, { memberCount, visibleBaseIndices });
      finalColumns = generated.columns;
    } else if (columns.length > 0) {
      const converted = convertLegacyColumns(columns, colHeaders);
      finalColumns = converted.columns;
    } else {
      // Fallback: generate from data
      if (data.length > 0) {
        const sampleRow = data.find(row => !row._isNew) || data[0];
        finalColumns = Object.keys(sampleRow)
          .filter(key => !key.startsWith('_'))
          .map(key => ({
            title: key.charAt(0).toUpperCase() + key.slice(1),
            data: key,
            width: 120
          }));
      }
    }

    // Convert to TanStack Table v8 format
    const tanstackColumns = finalColumns.map(col => 
      columnHelper.accessor(col.data, {
        id: col.data,
        header: col.title,
        size: col.width || 120,
        cell: ({ getValue, row, column }) => {
          const value = getValue();
          
          // Enhanced cell rendering with editing capability
          return (
            <EditableCell
              value={value}
              row={row}
              column={column}
              dropdownOptions={dropdownSources[col.data]}
              onUpdate={(newValue) => updateCellValue(row.index, col.data, newValue)}
            />
          );
        },
      })
    );

    // Add selection column if delete is available
    if (onDelete || deleteUrl) {
      tanstackColumns.unshift(
        columnHelper.display({
          id: 'select',
          header: ({ table }) => (
            <IndeterminateCheckbox
              {...{
                checked: table.getIsAllRowsSelected(),
                indeterminate: table.getIsSomeRowsSelected(),
                onChange: table.getToggleAllRowsSelectedHandler(),
              }}
            />
          ),
          cell: ({ row }) => (
            <div>
              <IndeterminateCheckbox
                {...{
                  checked: row.getIsSelected(),
                  disabled: !row.getCanSelect(),
                  indeterminate: row.getIsSomeSelected(),
                  onChange: row.getToggleSelectedHandler(),
                }}
              />
            </div>
          ),
          size: 50,
        })
      );
    }

    return tanstackColumns;
  }, [columns, colHeaders, tableName, data, onDelete, deleteUrl, dropdownSources, memberCount, visibleBaseIndices, updateCellValue]);

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    enableSorting: true,
  });

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isDirty || (!onSave && !saveUrl)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Filter out empty rows and prepare data
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
      
      console.log('Final payload to be sent:', JSON.stringify(dataToSave.slice(0, 2), null, 2)); // Show first 2 items

      if (beforeSave) {
        const validation = await beforeSave(dataToSave);
        if (validation !== true) {
          return { success: false, message: validation };
        }
      }
      
      let result;
      if (onSave) {
        result = await onSave(dataToSave);
      } else if (saveUrl) {
        const response = await axios.post(saveUrl, dataToSave);
        result = { success: true, data: response.data };
      }
      
      if (result && result.success !== false) {
        setIsDirty(false);
        
        if (afterSave) {
          await afterSave(dataToSave);
        }
        
        await fetchData();
        return { success: true, message: 'Changes saved successfully!' };
      }
    } catch (error) {
      console.error('Save failed:', error);
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  }, [data, isDirty, onSave, saveUrl, beforeSave, afterSave, fetchData, onBuildPayload]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    
    try {
      setLoading(true);
      const rowsToDelete = selectedRows.map(row => row.original);
      
      if (onDelete) {
        await Promise.all(rowsToDelete.map(row => onDelete(row.id)));
      } else if (deleteUrl) {
        await Promise.all(rowsToDelete.map(row => axios.delete(`${deleteUrl}${row.id}/`)));
      }
      
      await fetchData();
      setRowSelection({});
      return { success: true, message: `Deleted ${rowsToDelete.length} item(s) successfully!` };
    } catch (error) {
      console.error('Delete failed:', error);
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  }, [table, onDelete, deleteUrl, fetchData]);

  // Export functionality
  const handleExport = useCallback((format = 'csv') => {
    const headers = tableColumns.filter(col => col.id !== 'select').map(col => col.header);
    const baseFilename = getExportFilename ? getExportFilename().replace(/\.[^/.]+$/, '') : 'table_export';
    const exportData = data.filter(row => !row._isNew);
    
    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          tableColumns.filter(col => col.id !== 'select').map(col => {
            const value = row[col.id] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
  }, [data, tableColumns, getExportFilename]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    save: handleSave,
    delete: handleDelete,
    export: handleExport,
    refresh: fetchData,
    isDirty,
    getSelectedRows: () => table.getFilteredSelectedRowModel().rows.map(row => row.original),
    clearSelection: () => setRowSelection({})
  }));

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const selectedRowCount = Object.keys(rowSelection).length;

  return (
    <div className={`generic-table-fast ${className} theme-${theme}`} style={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Action Buttons */}
      {((onSave || saveUrl) || (onDelete || deleteUrl) || getExportFilename) && (
        <div className="table-action-controls d-flex gap-2 align-items-center px-3 py-2 bg-light border-bottom" style={{ flexShrink: 0 }}>
          {(onSave || saveUrl) && (
            <button 
              className={`btn btn-sm ${isDirty ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={handleSave}
              disabled={!isDirty || loading}
            >
              Save {isDirty ? '(*)' : ''}
            </button>
          )}
          
          {(onDelete || deleteUrl) && selectedRowCount > 0 && (
            <button 
              className="btn btn-sm btn-danger"
              onClick={async () => {
                if (window.confirm(`Delete ${selectedRowCount} selected row(s)?`)) {
                  await handleDelete();
                }
              }}
              disabled={loading}
            >
              Delete ({selectedRowCount})
            </button>
          )}
          
          {getExportFilename && (
            <div className="dropdown">
              <button 
                className="btn btn-sm btn-outline-secondary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                disabled={loading}
              >
                Export
              </button>
              <ul className="dropdown-menu">
                <li>
                  <button 
                    className="dropdown-item"
                    onClick={() => handleExport('csv')}
                    disabled={loading}
                  >
                    Export as CSV
                  </button>
                </li>
              </ul>
            </div>
          )}
          
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </button>
          
          <div className="ms-auto d-flex align-items-center gap-2">
            {loading && <div className="spinner-border spinner-border-sm" />}
            <span className="text-muted small">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} • {data.filter(row => !row._isNew).length} rows
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-responsive" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table className={`table table-striped table-hover table-sm mb-0 table-${theme}`}>
          <thead className="table-header-sticky">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      backgroundColor: 'var(--table-header-bg, #f8f9fa)',
                      borderBottom: '2px solid var(--table-border, #dee2e6)',
                      fontWeight: '600',
                      fontSize: '14px',
                      padding: '12px 8px',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="ms-1">
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted()] ?? ' ↕️'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id}
                style={{
                  backgroundColor: row.original._isNew ? 'var(--table-new-row-bg, #f8f9fa)' : 'var(--table-bg, #ffffff)',
                  borderBottom: '1px solid var(--table-border, #dee2e6)'
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id}
                    style={{
                      padding: '0',
                      borderRight: '1px solid var(--table-border, #e9ecef)',
                      verticalAlign: 'middle',
                      minHeight: '42px'
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="table-pagination-footer d-flex justify-content-between align-items-center p-3 bg-light border-top" style={{ flexShrink: 0 }}>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small">Show:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
          >
            {[10, 25, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-muted small">per page</span>
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {'<<'}
          </button>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'<'}
          </button>
          <span className="text-muted small">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {'>'}
          </button>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            {'>>'}
          </button>
        </div>
      </div>
    </div>
  );
});

// Enhanced formatting helper function
const getFormattedValue = (value, columnId) => {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#dee2e6', fontStyle: 'italic', fontSize: '12px' }}>—</span>;
  }

  if (columnId === 'zone_status' || columnId === 'status') {
    if (value === 'valid') return <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✅ Valid</span>;
    if (value === 'invalid') return <span style={{ color: '#dc3545', fontSize: '16px', fontWeight: 'bold' }}>❌ Invalid</span>;
    return <span style={{ color: '#6c757d' }}>{value || 'Unknown'}</span>;
  }

  if (columnId === 'member_count') {
    const count = parseInt(value) || 0;
    return (
      <div style={{ textAlign: 'center' }}>
        <span style={{
          color: count > 0 ? '#28a745' : '#6c757d',
          fontWeight: count > 0 ? 'bold' : 'normal',
          backgroundColor: count > 0 ? '#d4edda' : '#f8f9fa',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px'
        }}>
          {count} members
        </span>
      </div>
    );
  }

  if (columnId === 'fabric') {
    const hasValue = value && value.trim() !== '';
    return (
      <span style={{
        color: hasValue ? '#0d6efd' : '#6c757d',
        fontWeight: hasValue ? '600' : '400',
        backgroundColor: hasValue ? '#e7f3ff' : '#f8f9fa',
        padding: '4px 8px',
        borderRadius: '6px',
        border: hasValue ? '1px solid #b3d7ff' : '1px solid #e9ecef',
        fontSize: '13px',
        display: 'inline-block'
      }}>
        {hasValue ? value : 'No Fabric'}
      </span>
    );
  }

  if (columnId === 'name') {
    return <span style={{
      fontWeight: '600',
      color: value ? '#212529' : '#6c757d'
    }}>{value || 'Unnamed'}</span>;
  }

  if (columnId && columnId.startsWith('member_')) {
    const hasValue = value && value.trim() !== '';
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100%',
        width: '100%'
      }}>
        <span style={{
          color: hasValue ? '#0d6efd' : '#dee2e6',
          fontStyle: hasValue ? 'normal' : 'italic',
          fontSize: '12px',
          fontWeight: hasValue ? '500' : '400',
          backgroundColor: hasValue ? '#e7f3ff' : '#f8f9fa',
          padding: '3px 6px',
          borderRadius: '4px',
          border: hasValue ? '1px solid #b3d7ff' : '1px solid #e9ecef',
          minWidth: hasValue ? 'auto' : '30px',
          textAlign: 'center',
          display: 'inline-block'
        }}>
          {hasValue ? value : '—'}
        </span>
      </div>
    );
  }

  if (columnId === 'notes') {
    const truncated = value && value.length > 30 ? value.substring(0, 30) + '...' : value;
    return (
      <span
        style={{
          color: '#6c757d',
          fontStyle: value ? 'normal' : 'italic',
          fontSize: '12px'
        }}
        title={value}
      >
        {truncated || 'No notes'}
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return <span style={{ color: value ? '#28a745' : '#dc3545' }}>{value ? 'Yes' : 'No'}</span>;
  }

  if (value instanceof Date) {
    return <span style={{ fontSize: '13px' }}>{value.toLocaleDateString()}</span>;
  }

  return <span style={{ fontSize: '13px' }}>{String(value)}</span>;
};

// Editable Cell Component
const EditableCell = ({ value, row, column, dropdownOptions, onUpdate }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = (newValue) => {
    onUpdate(newValue);
    setIsEditing(false);
  };

  if (isEditing) {
    if (dropdownOptions && dropdownOptions.length > 0) {
      return (
        <div style={{ padding: '8px' }}>
          <select
            value={localValue || ''}
            onChange={(e) => {
              const newValue = e.target.value;
              setLocalValue(newValue);
              handleSave(newValue);
            }}
            onBlur={() => setIsEditing(false)}
            style={{ width: '100%' }}
            autoFocus
          >
            <option value="">Select...</option>
            {dropdownOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    } else {
      return (
        <div style={{ padding: '8px' }}>
          <input
            type="text"
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => handleSave(localValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave(localValue);
              } else if (e.key === 'Escape') {
                setLocalValue(value);
                setIsEditing(false);
              }
            }}
            style={{ width: '100%' }}
            autoFocus
          />
        </div>
      );
    }
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        padding: '8px',
        cursor: 'pointer',
        minHeight: '34px',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {getFormattedValue(localValue, column.id)}
    </div>
  );
};

// Checkbox component
const IndeterminateCheckbox = ({ indeterminate, className = '', ...rest }) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (typeof indeterminate === 'boolean' && ref.current) {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);

  return (
    <input
      type="checkbox"
      ref={ref}
      className={className + ' cursor-pointer'}
      {...rest}
      style={{ transform: 'scale(1.2)' }}
    />
  );
};

GenericTableFast.displayName = 'GenericTableFast';

export default GenericTableFast;