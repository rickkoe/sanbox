import React, { useState, useRef, useMemo, forwardRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getColumnResizeMode,
  flexRender,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Enhanced TanStack Table with full CRUD operations and Excel-like features
 * This component provides a complete data management solution with:
 * - Full Excel-like copy/paste with auto-extending rows
 * - Searchable dropdowns with type-to-filter
 * - Advanced cell editing (text, dropdown, checkbox)
 * - CRUD operations (Create, Read, Update, Delete)
 * - Fill down/right operations
 * - Cell selection and keyboard navigation
 * - Server-side data management
 */
const TanStackCRUDTable = forwardRef(({
  // API Configuration
  apiUrl,
  saveUrl,
  updateUrl,
  deleteUrl,
  customerId,

  // Table Configuration
  tableName, // Name for storing table configuration in database

  // Column Configuration
  columns = [],
  colHeaders = [],
  dropdownSources = {},
  dropdownFilters = {},
  customRenderers = {},
  newRowTemplate = {},

  // Data Processing
  preprocessData,
  saveTransform,
  vendorOptions = [],

  // Table Settings
  height = '600px',
  storageKey,

  // Event Handlers
  onSave,
  onDelete,
  onDataChange,
  customSaveHandler,

  // Custom Actions
  customAddActions,

  ...otherProps
}, ref) => {

  // Core state
  const [fabricData, setFabricData] = useState([]);
  const [editableData, setEditableData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [deletedRows, setDeletedRows] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Excel-like features state
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectionRange, setSelectionRange] = useState(null);
  const [currentCell, setCurrentCell] = useState({ row: 0, col: 0 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [fillPreview, setFillPreview] = useState(null);

  // Table configuration
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnSizing, setColumnSizing] = useState({});
  const [tableConfig, setTableConfig] = useState(null);
  const [resizeState, setResizeState] = useState({ isResizing: false, startX: 0, currentX: 0, columnId: null });

  // Build API URL with pagination and customer filter
  const buildApiUrl = useCallback((page, size, search = '') => {
    if (!apiUrl) return null;

    // Check if apiUrl already has query parameters
    const separator = apiUrl.includes('?') ? '&' : '?';

    // Handle "All" page size by using a very large number that the backend can handle
    const actualPageSize = size === 'All' ? 10000 : size;

    let url = `${apiUrl}${separator}page=${page}&page_size=${actualPageSize}`;

    // Add customer filter if provided
    if (customerId) {
      url += `&customer_id=${customerId}`;
    }

    // Add search parameter
    if (search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }

    console.log(`🌐 Built API URL: ${url}`);
    return url;
  }, [apiUrl, customerId]);

  // Delete URL function for individual deletions
  const getDeleteUrl = useCallback((id) => {
    if (deleteUrl) {
      if (deleteUrl.includes('/delete/')) {
        // If deleteUrl already has /delete/ pattern, just append the ID
        return deleteUrl.endsWith('/') ? `${deleteUrl}${id}/` : `${deleteUrl}${id}/`;
      } else {
        // Otherwise construct standard URL pattern
        return deleteUrl.endsWith('/') ? `${deleteUrl}${id}/` : `${deleteUrl}/${id}/`;
      }
    }
    return null;
  }, [deleteUrl]);

  // Table configuration API functions
  const loadTableConfig = useCallback(async () => {
    if (!tableName || !customerId) return;

    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await axios.get(`${API_URL}/api/core/table-config/`, {
        params: {
          customer: customerId,
          table_name: tableName
        }
      });

      if (response.data) {
        setTableConfig(response.data);
        if (response.data.column_widths && Object.keys(response.data.column_widths).length > 0) {
          console.log('📊 Loading saved column widths:', response.data.column_widths);
          setColumnSizing(response.data.column_widths);
        }
        console.log('📊 Loaded table configuration:', response.data);
      }
    } catch (error) {
      console.log('⚠️ No existing table configuration found or error loading:', error.message);
    }
  }, [tableName, customerId]);

  const saveTableConfig = useCallback(async (configUpdate) => {
    if (!tableName || !customerId) {
      console.log('⚠️ Cannot save table config: missing tableName or customerId', { tableName, customerId });
      return;
    }

    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const configData = {
        customer: customerId,
        table_name: tableName,
        column_widths: configUpdate.column_widths || columnSizing,
        ...configUpdate
      };

      console.log('💾 Saving table configuration:', {
        url: tableConfig?.id ? `${API_URL}/api/core/table-config/${tableConfig.id}/` : `${API_URL}/api/core/table-config/`,
        method: tableConfig?.id ? 'PUT' : 'POST',
        data: configData
      });

      if (tableConfig?.id) {
        // Update existing config
        await axios.put(`${API_URL}/api/core/table-config/${tableConfig.id}/`, configData);
        console.log('✅ Updated existing table configuration');
      } else {
        // Create new config
        const response = await axios.post(`${API_URL}/api/core/table-config/`, configData);
        setTableConfig(response.data);
        console.log('✅ Created new table configuration:', response.data);
      }
    } catch (error) {
      console.error('❌ Error saving table configuration:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
    }
  }, [tableName, customerId, tableConfig, columnSizing]);


  // Load data from server with pagination
  const loadData = useCallback(async () => {
    const url = buildApiUrl(currentPage, pageSize, globalFilter);
    if (!url) {
      console.log('⚠️ No API URL available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔄 Loading page ${currentPage} (size: ${pageSize}) from:`, url);
      const response = await axios.get(url);

      // Handle paginated response
      let dataList = response.data.results || response.data;
      let totalCount = response.data.count || dataList.length;

      console.log(`📥 Loaded ${dataList.length} records from server (total: ${totalCount})`);

      // Process data if preprocessing function provided
      const processedData = preprocessData ? preprocessData(dataList) : dataList;

      setFabricData(processedData);
      setEditableData([...processedData]);
      setTotalItems(totalCount);
      setTotalPages(pageSize === 'All' ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)));
      setHasChanges(false);
      setDeletedRows([]);

    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError('Failed to load data: ' + error.message);
      setFabricData([]);
      setEditableData([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [buildApiUrl, currentPage, pageSize, globalFilter, preprocessData]);

  // Load data when dependencies change
  useEffect(() => {
    if (apiUrl) {
      loadData();
    }
  }, [loadData, apiUrl]);

  // Reset to page 1 when search filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // Don't trigger loadData here - it will be triggered by the currentPage change above
  }, [globalFilter]);

  // Load table configuration on mount
  useEffect(() => {
    if (tableName && customerId) {
      loadTableConfig();
    }
  }, [tableName, customerId]);

  // Save column widths when they change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (Object.keys(columnSizing).length > 0) {
        console.log('💾 Saving column widths:', columnSizing);
        saveTableConfig({ column_widths: columnSizing });
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(debounceTimer);
  }, [columnSizing, saveTableConfig]);

  // Current table data (server-side pagination means we show what we loaded)
  const currentTableData = useMemo(() => {
    console.log(`📄 Displaying ${editableData.length} rows from server`);
    return editableData;
  }, [editableData]);

  // Auto-size columns function (defined after currentTableData)
  const autoSizeColumns = useCallback(() => {
    console.log('📏 Auto-sizing columns...');

    // Reset all column widths to auto-calculated sizes
    const newSizing = {};

    // For each column, calculate optimal width based on content and header
    columns.forEach((column, index) => {
      const accessorKey = column.data || `column_${index}`;
      const headerName = colHeaders[index] || column.header || column.data || `Column ${index + 1}`;

      // Calculate width based on header length
      const headerWidth = Math.max(120, headerName.length * 10 + 60);

      // Calculate content width by sampling data
      let maxContentWidth = headerWidth;

      // For dropdown columns, also consider all dropdown options
      if (column.type === 'dropdown' && dropdownSources && dropdownSources[accessorKey]) {
        const dropdownOptions = dropdownSources[accessorKey] || [];
        dropdownOptions.forEach(option => {
          if (option) {
            const optionWidth = String(option).length * 8 + 60; // Extra padding for dropdown arrow
            maxContentWidth = Math.max(maxContentWidth, optionWidth);
          }
        });
        console.log(`📏 Dropdown column "${accessorKey}" - longest option width:`, maxContentWidth);
      }

      if (currentTableData && currentTableData.length > 0) {
        // Sample first 10 rows to estimate content width
        const sampleSize = Math.min(10, currentTableData.length);
        for (let i = 0; i < sampleSize; i++) {
          const cellValue = currentTableData[i]?.[accessorKey];
          if (cellValue) {
            const cellWidth = String(cellValue).length * 8 + 40;
            maxContentWidth = Math.max(maxContentWidth, cellWidth);
          }
        }
      }

      // Set reasonable limits (increased max for dropdown readability)
      const finalWidth = Math.min(Math.max(maxContentWidth, 80), column.type === 'dropdown' ? 300 : 400);
      newSizing[accessorKey] = finalWidth;
    });

    console.log('📏 Setting new column sizes:', newSizing);
    setColumnSizing(newSizing);

    // Save to database
    if (Object.keys(newSizing).length > 0) {
      saveTableConfig({ column_widths: newSizing });
    }
  }, [columns, colHeaders, currentTableData, dropdownSources, saveTableConfig]);

  // Auto-size columns on first load if no saved configuration exists
  useEffect(() => {
    if (editableData.length > 0 && // Data has loaded
        tableName && customerId && // Required for persistence
        Object.keys(columnSizing).length === 0 && // No existing column sizes
        !isLoading) { // Not currently loading

      console.log('🎯 First time loading table with no saved configuration - running auto-sizer');
      // Small delay to ensure table is fully rendered
      setTimeout(() => {
        autoSizeColumns();
      }, 100);
    }
  }, [editableData, tableName, customerId, columnSizing, isLoading, autoSizeColumns]);

  // Handle resize events
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizeState.isResizing) {
        setResizeState(prev => ({
          ...prev,
          currentX: e.clientX
        }));
      }
    };

    const handleMouseUp = () => {
      if (resizeState.isResizing) {
        setResizeState({ isResizing: false, startX: 0, currentX: 0, columnId: null });
      }
    };

    if (resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState.isResizing]);

  // Update cell data function
  const updateCellData = useCallback((rowIndex, columnKey, newValue) => {
    setEditableData(currentData => {
      const newData = [...currentData];
      newData[rowIndex] = {
        ...newData[rowIndex],
        [columnKey]: newValue
      };
      console.log(`📝 Updated ${columnKey} for row ${rowIndex} to: "${newValue}"`);
      return newData;
    });
    setHasChanges(true);
  }, []);

  // Navigation functions for floating panel
  const scrollToTop = useCallback(() => {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTo({ top: tableWrapper.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const scrollToLeft = useCallback(() => {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, []);

  const scrollToRight = useCallback(() => {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollTo({ left: tableWrapper.scrollWidth, behavior: 'smooth' });
    }
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    console.log(`📄 Changed to page ${page}`);
    // Data will be reloaded automatically via useEffect when currentPage changes
  }, []);

  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
    console.log(`📄 Changed page size to ${newPageSize}`);
    // Data will be reloaded automatically via useEffect when pageSize changes
  }, []);

  // Add new row (following original FabricTable pattern)
  const addNewRow = useCallback(() => {
    const newRow = {
      ...newRowTemplate,
      id: null  // Use null for new rows like original FabricTable
    };

    const newData = [...editableData, newRow];
    setEditableData(newData);
    setHasChanges(true);

    console.log('➕ Added new row:', newRow);

    // Auto-scroll to bottom to show the new row
    setTimeout(() => {
      const tableWrapper = document.querySelector('.table-wrapper');
      if (tableWrapper) {
        tableWrapper.scrollTop = tableWrapper.scrollHeight;
        console.log('📜 Auto-scrolled to bottom after adding new row');
      } else {
        console.log('⚠️ Table wrapper not found for auto-scroll');
      }
    }, 100); // Small delay to ensure the row is rendered
  }, [editableData, newRowTemplate]);

  // Delete selected rows
  const deleteSelectedRows = useCallback(() => {
    if (selectedCells.size === 0) return;

    // Get unique row indices from selected cells
    const rowIndices = new Set();
    selectedCells.forEach(cellKey => {
      const [rowIndex] = cellKey.split('-').map(Number);
      rowIndices.add(rowIndex);
    });

    const rowsToDelete = Array.from(rowIndices).sort((a, b) => b - a); // Delete from end to beginning
    console.log('🗑️ Deleting', rowsToDelete.length, 'rows:', rowsToDelete);

    // Track IDs for backend deletion
    const idsToDelete = [];
    rowsToDelete.forEach(rowIndex => {
      const row = editableData[rowIndex];
      if (row && row.id && !String(row.id).startsWith('new-')) {
        idsToDelete.push(row.id);
      }
    });

    // Remove rows from editable data
    const newData = editableData.filter((_, index) => !rowsToDelete.includes(index));

    setEditableData(newData);
    setDeletedRows(prev => [...prev, ...idsToDelete]);
    setSelectedCells(new Set());
    setHasChanges(true);

    console.log('🗑️ Marked for deletion:', idsToDelete);
    console.log('✅ Deleted rows, remaining:', newData.length);
  }, [selectedCells, editableData]);

  // Save changes to database
  const saveChanges = useCallback(async () => {
    if (!hasChanges) {
      console.log('⚠️ No changes to save');
      return;
    }

    try {
      console.log('💾 Starting save process...');
      setIsLoading(true);

      // Use custom save handler if provided (for bulk save scenarios like AliasTable)
      if (customSaveHandler) {
        console.log('🔧 Using custom save handler with deletions:', deletedRows);
        const result = await customSaveHandler(editableData, hasChanges, deletedRows);

        if (result.success) {
          // Reload data from server after successful save
          await loadData();
          setHasChanges(false);
          setDeletedRows([]);

          console.log('✅ Custom save completed successfully');
          if (onSave) onSave(result);
        } else {
          console.error('❌ Custom save failed:', result.message);
          if (onSave) onSave(result);
        }
        return;
      }

      // Standard CRUD save process
      // Separate new rows from existing rows (using original FabricTable logic)
      const newRows = editableData.filter(row => !row.id || row.id === null);
      const existingRows = editableData.filter(row => row.id && row.id !== null);

      console.log('➕ New rows to create:', newRows.length);
      console.log('✏️ Existing rows to update:', existingRows.length);
      console.log('🗑️ Rows to delete:', deletedRows.length);

      // Delete rows first (individual DELETE requests)
      const uniqueDeletedRows = [...new Set(deletedRows)]; // Remove duplicates
      for (const deletedId of uniqueDeletedRows) {
        console.log('🗑️ Deleting record ID:', deletedId);

        if (onDelete) {
          // Use custom delete handler if provided
          const deleteResult = await onDelete(deletedId);
          console.log('✅ Custom delete result:', deleteResult);
        } else {
          // Use default axios delete
          const response = await axios.delete(getDeleteUrl(deletedId));
          console.log('✅ Deleted record response:', response.data);
        }
      }

      // Save new rows (POST requests)
      for (const newRow of newRows) {
        let rowData = { ...newRow };

        // Remove any ID properties for new records (following original FabricTable logic)
        delete rowData.id;
        delete rowData.saved;
        delete rowData._isNew;

        // Apply transform if provided
        if (saveTransform) {
          const transformed = saveTransform([rowData]);
          if (transformed.length > 0) {
            rowData = transformed[0];
          }
        }

        console.log('📤 Creating new record:', rowData);
        const response = await axios.post(saveUrl || apiUrl, rowData);
        console.log('✅ Created record with ID:', response.data.id);
      }

      // Save existing rows (PUT requests)
      for (const existingRow of existingRows) {
        let rowData = { ...existingRow };

        // Apply transform if provided
        if (saveTransform) {
          const transformed = saveTransform([rowData]);
          if (transformed.length > 0) {
            rowData = transformed[0];
          }
        }

        console.log('📤 Updating record ID:', existingRow.id);

        // Construct proper PUT URL - use updateUrl if provided, otherwise default pattern
        let putUrl;
        if (updateUrl) {
          // Custom update URL pattern (e.g., /api/core/projects/update/{id}/)
          putUrl = updateUrl.endsWith('/') ? `${updateUrl}${existingRow.id}/` : `${updateUrl}${existingRow.id}/`;
        } else {
          // Standard REST pattern (e.g., /api/customers/{id}/)
          const baseUrl = saveUrl || apiUrl;
          putUrl = baseUrl.endsWith('/') ? `${baseUrl}${existingRow.id}/` : `${baseUrl}/${existingRow.id}/`;
        }

        console.log('📤 PUT URL:', putUrl);
        const response = await axios.put(putUrl, rowData);
        console.log('✅ Updated record response:', response.data);
      }

      // Reload data from server to get fresh state
      console.log('🔄 Reloading data from server...');
      await loadData();
      setDeletedRows([]);
      setHasChanges(false);

      console.log('✅ All changes saved successfully!');

      // Call onSave callback if provided
      if (onSave) {
        onSave({ success: true, message: 'Changes saved successfully' });
      }

    } catch (error) {
      console.error('❌ Error saving changes:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error config:', error.config);

      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      const requestUrl = error.config?.url;

      console.error(`❌ Save failed: ${statusCode} ${errorMessage} (URL: ${requestUrl})`);

      // Don't reset data on save failure to preserve user's work
      alert(`Save failed: ${errorMessage}\nPlease check the console for details.`);

      if (onSave) {
        onSave({ success: false, message: 'Error saving changes: ' + errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  }, [editableData, hasChanges, deletedRows, loadData, getDeleteUrl, saveUrl, apiUrl, saveTransform, onSave, customSaveHandler]);

  // Create enhanced column definitions with our custom cell components
  const columnDefs = useMemo(() => {
    console.log('🏗️ Building column definitions with dropdownSources:', dropdownSources);

    return columns.map((column, index) => {
      const headerName = colHeaders[index] || column.header || column.data || `Column ${index + 1}`;
      const accessorKey = column.data || column.accessorKey || `column_${index}`;
      const dropdownSource = dropdownSources[accessorKey] || dropdownSources[headerName];

      console.log(`🏗️ Column ${index} (${accessorKey}):`, {
        headerName,
        accessorKey,
        columnType: column.type,
        dropdownSource,
        hasDropdownSource: !!dropdownSource
      });

      return {
        id: accessorKey,
        accessorKey,
        header: headerName,

        // Enhanced cell rendering with editing capabilities
        cell: ({ row, column, getValue, table }) => {
          const value = getValue();
          const rowIndex = row.index;
          const colIndex = column.getIndex?.() || index;

          // Get the actual column config to check type
          const actualColumnConfig = columns[index];
          const isCheckbox = accessorKey === 'exists' || actualColumnConfig?.type === 'checkbox';
          const isDropdown = actualColumnConfig?.type === 'dropdown' || accessorKey === 'san_vendor' || accessorKey.startsWith('member_');

          console.log(`🔍 Cell [${rowIndex}, ${colIndex}] ${accessorKey}:`, {
            value,
            isCheckbox,
            isDropdown,
            columnConfig: actualColumnConfig,
            index,
            columnsLength: columns.length,
            isMemberColumn: accessorKey.startsWith('member_'),
            dropdownSource,
            dropdownOptions: dropdownSources[accessorKey]
          });

          // Checkbox cell
          if (isCheckbox) {
            return (
              <ExistsCheckboxCell
                value={value}
                rowIndex={rowIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
              />
            );
          }

          // Dropdown cell
          if (isDropdown) {
            let options = dropdownSource || dropdownSources[accessorKey] || [];

            // Handle dynamic dropdown sources (functions)
            if (typeof dropdownSources === 'function') {
              const dynamicSources = dropdownSources(currentTableData);

              // Check if this column has a dynamic function
              if (dynamicSources.getMemberOptions && accessorKey.startsWith('member_')) {
                options = dynamicSources.getMemberOptions(rowIndex, accessorKey, currentTableData);
              } else {
                options = dynamicSources[accessorKey] || [];
              }
            }

            console.log(`📋 Dropdown ${accessorKey} options:`, Array.isArray(options) ? options.length : 'function');

            return (
              <VendorDropdownCell
                value={value}
                options={options}
                rowIndex={rowIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
                rowData={row.original}
                filterFunction={dropdownFilters?.[accessorKey]}
              />
            );
          }

          // Custom renderer cell
          if (customRenderers && (customRenderers[accessorKey] || customRenderers[headerName])) {
            const customRenderer = customRenderers[accessorKey] || customRenderers[headerName];
            let renderResult = value;

            try {
              // Call custom renderer with row data for context
              const rowData = editableData[rowIndex] || {};
              renderResult = customRenderer(rowData, null, rowIndex, colIndex, accessorKey, value);
            } catch (error) {
              console.warn('Custom renderer error:', error);
              renderResult = value;
            }

            // Check if result is a React component
            if (renderResult && typeof renderResult === 'object' && renderResult.__isReactComponent) {
              return renderResult.component;
            }

            // Check if result contains HTML (like links, spans, or buttons)
            if (typeof renderResult === 'string' && (renderResult.includes('<a ') || renderResult.includes('<span') || renderResult.includes('<button'))) {
              return (
                <div
                  dangerouslySetInnerHTML={{ __html: renderResult }}
                  style={{
                    cursor: 'pointer',
                    color: '#007bff',
                    textDecoration: 'none'
                  }}
                />
              );
            }

            // Check if this is a password-like field (shows asterisks)
            if (typeof renderResult === 'string' && renderResult.includes('••••••••••')) {
              return (
                <PasswordLikeCell
                  actualValue={value}
                  maskedValue={renderResult}
                  rowIndex={rowIndex}
                  columnKey={accessorKey}
                  updateCellData={updateCellData}
                />
              );
            }

            // Return as text
            return (
              <EditableTextCell
                value={renderResult}
                rowIndex={rowIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
              />
            );
          }

          // Default text cell
          return (
            <EditableTextCell
              value={value}
              rowIndex={rowIndex}
              columnKey={accessorKey}
              updateCellData={updateCellData}
            />
          );
        },

        // Column configuration
        enableSorting: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,

        // Sizing and resizing
        enableResizing: true,
        size: columnSizing[accessorKey] || column.width || getColumnWidth(headerName, column.type),
        minSize: 50,
        maxSize: 800,
      };
    });
  }, [columns, colHeaders, dropdownSources, updateCellData, columnSizing]);

  // Table instance
  const table = useReactTable({
    data: currentTableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnSizing,
    },
    onColumnSizingChange: (updater) => {
      console.log('🔧 Column sizing changed:', updater);
      setColumnSizing(updater);
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    enableRowSelection: true,
  });

  // Excel-like features implementation
  const handleCellClick = useCallback((rowIndex, colIndex, event) => {
    const cellKey = `${rowIndex}-${colIndex}`;

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: Toggle cell selection
      const newSelection = new Set(selectedCells);
      if (selectedCells.has(cellKey)) {
        newSelection.delete(cellKey);
      } else {
        newSelection.add(cellKey);
      }
      setSelectedCells(newSelection);
      setCurrentCell({ row: rowIndex, col: colIndex });
    } else if (event.shiftKey && selectionRange) {
      // Shift+click: Range selection
      const startRow = Math.min(selectionRange.startRow, rowIndex);
      const endRow = Math.max(selectionRange.startRow, rowIndex);
      const startCol = Math.min(selectionRange.startCol, colIndex);
      const endCol = Math.max(selectionRange.startCol, colIndex);

      const rangeCells = new Set();
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          rangeCells.add(`${r}-${c}`);
        }
      }
      setSelectedCells(rangeCells);
      setSelectionRange(prev => ({
        ...prev,
        endRow: rowIndex,
        endCol: colIndex
      }));
    } else {
      // Single click: Select single cell
      setSelectedCells(new Set([cellKey]));
      setCurrentCell({ row: rowIndex, col: colIndex });
      setSelectionRange({
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      });
    }

    // Focus the table container for keyboard events
    event.currentTarget.closest('.table-wrapper')?.focus();
  }, [selectedCells, selectionRange]);

  // Arrow key navigation
  const navigateToCell = useCallback((newRow, newCol) => {
    const maxRow = currentTableData.length - 1;
    const maxCol = columnDefs.length - 1;

    // Clamp to valid range
    const clampedRow = Math.max(0, Math.min(newRow, maxRow));
    const clampedCol = Math.max(0, Math.min(newCol, maxCol));

    const cellKey = `${clampedRow}-${clampedCol}`;
    setSelectedCells(new Set([cellKey]));
    setCurrentCell({ row: clampedRow, col: clampedCol });
    setSelectionRange({
      startRow: clampedRow,
      endRow: clampedRow,
      startCol: clampedCol,
      endCol: clampedCol,
    });

    console.log(`🔄 Navigated to cell [${clampedRow}, ${clampedCol}]`);
  }, [currentTableData, columnDefs]);

  // Clear selected cells
  const clearCells = useCallback(() => {
    if (selectedCells.size === 0) return;

    console.log('🧹 Clearing selected cells');

    setEditableData(currentData => {
      const newData = [...currentData];

      selectedCells.forEach(cellKey => {
        const [rowIndex, colIndex] = cellKey.split('-').map(Number);
        const columnKey = columnDefs[colIndex]?.accessorKey;
        if (newData[rowIndex] && columnKey) {
          newData[rowIndex] = {
            ...newData[rowIndex],
            [columnKey]: ''
          };
        }
      });

      return newData;
    });

    setHasChanges(true);
  }, [selectedCells, columnDefs]);

  // Fill down operation
  const fillDown = useCallback(() => {
    if (selectedCells.size <= 1) return;

    const cellKeys = Array.from(selectedCells).sort();
    const firstCellKey = cellKeys[0];
    const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);
    const sourceValue = currentTableData[firstRowIndex]?.[columnDefs[firstColIndex]?.accessorKey];
    const columnKey = columnDefs[firstColIndex]?.accessorKey;

    if (sourceValue === undefined || sourceValue === null) return;

    console.log(`🔽 Fill Down: Copying "${sourceValue}" to ${selectedCells.size - 1} cells`);

    // Update the actual data
    setEditableData(currentData => {
      const newData = [...currentData];

      // Fill all selected cells except the first one with the source value
      cellKeys.slice(1).forEach(cellKey => {
        const [rowIndex] = cellKey.split('-').map(Number);
        if (newData[rowIndex]) {
          newData[rowIndex] = {
            ...newData[rowIndex],
            [columnKey]: sourceValue
          };
        }
      });

      return newData;
    });

    setHasChanges(true);
  }, [selectedCells, currentTableData, columnDefs]);

  // Fill right operation
  const fillRight = useCallback(() => {
    if (selectedCells.size <= 1) return;

    const cellKeys = Array.from(selectedCells).sort();
    const firstCellKey = cellKeys[0];
    const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);
    const sourceValue = currentTableData[firstRowIndex]?.[columnDefs[firstColIndex]?.accessorKey];

    if (sourceValue === undefined || sourceValue === null) return;

    console.log(`➡️ Fill Right: Copying "${sourceValue}" to ${selectedCells.size - 1} cells`);

    // Update the actual data
    setEditableData(currentData => {
      const newData = [...currentData];

      // Fill all selected cells except the first one with the source value
      cellKeys.slice(1).forEach(cellKey => {
        const [rowIndex, colIndex] = cellKey.split('-').map(Number);
        const columnKey = columnDefs[colIndex]?.accessorKey;
        if (newData[rowIndex] && columnKey) {
          newData[rowIndex] = {
            ...newData[rowIndex],
            [columnKey]: sourceValue
          };
        }
      });

      return newData;
    });

    setHasChanges(true);
  }, [selectedCells, currentTableData, columnDefs]);

  // Enhanced Copy functionality for Excel compatibility
  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;

    // Convert selected cells to a grid structure
    const cellArray = Array.from(selectedCells);
    const rowIndices = [...new Set(cellArray.map(key => parseInt(key.split('-')[0])))].sort((a, b) => a - b);
    const colIndices = [...new Set(cellArray.map(key => parseInt(key.split('-')[1])))].sort((a, b) => a - b);

    console.log('📋 Copy operation: rows', rowIndices, 'cols', colIndices);

    // Build a 2D grid of the selected data
    const copyGrid = rowIndices.map(rowIndex => {
      return colIndices.map(colIndex => {
        const cellKey = `${rowIndex}-${colIndex}`;
        if (selectedCells.has(cellKey)) {
          const columnKey = columnDefs[colIndex]?.accessorKey;
          const value = currentTableData[rowIndex]?.[columnKey];

          // Handle different data types properly
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
          } else {
            return String(value);
          }
        } else {
          return ''; // Empty cell in non-contiguous selection
        }
      });
    });

    // Convert to tab-separated format (Excel standard)
    const copyText = copyGrid.map(row => row.join('\t')).join('\n');

    navigator.clipboard.writeText(copyText);
    console.log('📋 Copied to clipboard (Excel format):', copyText);

    // Show brief success feedback
    setFillPreview({
      operation: 'Copied',
      sourceValue: `${rowIndices.length} rows × ${colIndices.length} columns`,
      count: selectedCells.size
    });

    setTimeout(() => setFillPreview(null), 1500);
  }, [selectedCells, currentTableData, columnDefs]);

  // Enhanced Paste functionality for Excel compatibility
  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        console.log('📋 Clipboard is empty');
        return;
      }

      // Parse Excel-style tab-separated data
      const rows = clipboardText.split('\n').filter(row => row.length > 0);
      const pasteData = rows.map(row => row.split('\t'));

      console.log('📋 Pasting data:', pasteData);

      // Calculate paste dimensions
      const pasteRowCount = pasteData.length;
      const pasteColCount = Math.max(...pasteData.map(row => row.length));
      const targetStartRow = currentCell.row;
      const targetStartCol = currentCell.col;
      const targetEndRow = targetStartRow + pasteRowCount - 1;
      const targetEndCol = targetStartCol + pasteColCount - 1;

      console.log(`📋 Paste area: [${targetStartRow}-${targetEndRow}, ${targetStartCol}-${targetEndCol}]`);

      // Auto-extend table rows if needed
      const currentRowCount = editableData.length;
      const neededRows = Math.max(0, (targetEndRow + 1) - currentRowCount);

      if (neededRows > 0) {
        console.log(`➕ Auto-extending table with ${neededRows} new rows`);
        const newRows = Array.from({ length: neededRows }, (_, i) => ({
          ...newRowTemplate,
          id: null  // Use null for new rows like original FabricTable
        }));

        // Update the data immediately to include new rows
        setEditableData(prev => [...prev, ...newRows]);
      }

      // Apply paste data with proper data type conversion
      setEditableData(currentData => {
        const newData = [...currentData];

        pasteData.forEach((rowData, rowOffset) => {
          const targetRowIndex = targetStartRow + rowOffset;
          if (targetRowIndex < newData.length) {
            rowData.forEach((cellValue, colOffset) => {
              const targetColIndex = targetStartCol + colOffset;
              const columnKey = columnDefs[targetColIndex]?.accessorKey;

              if (columnKey && newData[targetRowIndex] && targetColIndex < columnDefs.length) {
                // Convert data types appropriately
                let convertedValue = cellValue;

                // Handle boolean values
                if (cellValue === 'TRUE' || cellValue === 'true') {
                  convertedValue = true;
                } else if (cellValue === 'FALSE' || cellValue === 'false') {
                  convertedValue = false;
                }
                // Handle numeric values for VSAN column
                else if (columnKey === 'vsan' && cellValue && !isNaN(cellValue)) {
                  convertedValue = parseInt(cellValue) || cellValue;
                }
                // Keep strings as-is
                else {
                  convertedValue = cellValue;
                }

                newData[targetRowIndex] = {
                  ...newData[targetRowIndex],
                  [columnKey]: convertedValue
                };

                console.log(`📝 Pasted "${cellValue}" → "${convertedValue}" to [${targetRowIndex}, ${targetColIndex}] (${columnKey})`);
              }
            });
          }
        });

        return newData;
      });

      // Update selection to show the pasted area
      const pastedCells = new Set();
      for (let r = targetStartRow; r <= targetEndRow; r++) {
        for (let c = targetStartCol; c <= Math.min(targetEndCol, columnDefs.length - 1); c++) {
          pastedCells.add(`${r}-${c}`);
        }
      }
      setSelectedCells(pastedCells);
      setSelectionRange({
        startRow: targetStartRow,
        startCol: targetStartCol,
        endRow: targetEndRow,
        endCol: Math.min(targetEndCol, columnDefs.length - 1)
      });

      setHasChanges(true);

      // Show success feedback
      setFillPreview({
        operation: 'Pasted',
        sourceValue: `${pasteRowCount} rows × ${pasteColCount} columns`,
        count: pasteRowCount * pasteColCount
      });

      setTimeout(() => setFillPreview(null), 2000);

    } catch (error) {
      console.error('❌ Error pasting data:', error);

      // Show error feedback
      setFillPreview({
        operation: 'Paste Error',
        sourceValue: error.message,
        count: 0
      });

      setTimeout(() => setFillPreview(null), 3000);
    }
  }, [currentCell, editableData, newRowTemplate, columnDefs]);

  // Enhanced keyboard shortcuts and navigation
  const handleKeyDown = useCallback((e) => {
    const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // Don't interfere with input fields unless it's navigation keys
    if (isInputFocused && !['Tab', 'Escape', 'Enter'].includes(e.key)) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'c':
          e.preventDefault();
          handleCopy();
          console.log('📋 Copy shortcut triggered');
          break;
        case 'v':
          e.preventDefault();
          handlePaste();
          console.log('📋 Paste shortcut triggered');
          break;
        case 'd':
          e.preventDefault();
          fillDown();
          console.log('🔽 Fill down shortcut triggered');
          break;
        case 'r':
          e.preventDefault();
          fillRight();
          console.log('➡️ Fill right shortcut triggered');
          break;
        case 'a':
          e.preventDefault();
          // Select all cells
          const allCells = new Set();
          for (let r = 0; r < currentTableData.length; r++) {
            for (let c = 0; c < columnDefs.length; c++) {
              allCells.add(`${r}-${c}`);
            }
          }
          setSelectedCells(allCells);
          console.log('🔄 Select all triggered');
          break;
      }
    } else {
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Delete: Delete rows
            deleteSelectedRows();
            console.log('🗑️ Delete rows shortcut triggered');
          } else {
            // Delete: Clear cell contents
            clearCells();
            console.log('🧹 Clear cells shortcut triggered');
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey && selectionRange) {
            // Shift+Arrow: Extend selection
            const newEndRow = Math.max(0, selectionRange.endRow - 1);
            extendSelection(selectionRange.startRow, selectionRange.startCol, newEndRow, selectionRange.endCol);
          } else {
            navigateToCell(currentCell.row - 1, currentCell.col);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey && selectionRange) {
            const newEndRow = Math.min(currentTableData.length - 1, selectionRange.endRow + 1);
            extendSelection(selectionRange.startRow, selectionRange.startCol, newEndRow, selectionRange.endCol);
          } else {
            navigateToCell(currentCell.row + 1, currentCell.col);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey && selectionRange) {
            const newEndCol = Math.max(0, selectionRange.endCol - 1);
            extendSelection(selectionRange.startRow, selectionRange.startCol, selectionRange.endRow, newEndCol);
          } else {
            navigateToCell(currentCell.row, currentCell.col - 1);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && selectionRange) {
            const newEndCol = Math.min(columnDefs.length - 1, selectionRange.endCol + 1);
            extendSelection(selectionRange.startRow, selectionRange.startCol, selectionRange.endRow, newEndCol);
          } else {
            navigateToCell(currentCell.row, currentCell.col + 1);
          }
          break;

        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Tab: Navigate left
            navigateToCell(currentCell.row, currentCell.col - 1);
          } else {
            // Tab: Navigate right
            navigateToCell(currentCell.row, currentCell.col + 1);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Enter: Navigate up
            navigateToCell(currentCell.row - 1, currentCell.col);
          } else {
            // Enter: Navigate down
            navigateToCell(currentCell.row + 1, currentCell.col);
          }
          break;

        case 'Escape':
          e.preventDefault();
          // Clear selection
          setSelectedCells(new Set());
          setSelectionRange(null);
          console.log('⏹️ Selection cleared');
          break;

        case 'F2':
          e.preventDefault();
          // Start editing current cell (if it's a text cell)
          console.log('✏️ Edit mode triggered for current cell');
          break;
      }
    }
  }, [
    handleCopy,
    handlePaste,
    fillDown,
    fillRight,
    deleteSelectedRows,
    clearCells,
    navigateToCell,
    currentCell,
    selectionRange,
    currentTableData,
    columnDefs
  ]);

  // Extend selection (for Shift+Arrow keys)
  const extendSelection = useCallback((startRow, startCol, endRow, endCol) => {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const rangeCells = new Set();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        rangeCells.add(`${r}-${c}`);
      }
    }

    setSelectedCells(rangeCells);
    setSelectionRange({
      startRow,
      startCol,
      endRow,
      endCol
    });

    console.log(`📐 Extended selection to [${minRow}-${maxRow}, ${minCol}-${maxCol}]`);
  }, []);

  // Pagination Footer Component
  const PaginationFooter = () => {
    const actualPageSize = pageSize === 'All' ? totalItems : pageSize;
    const startItem = totalItems === 0 ? 0 : ((currentPage - 1) * actualPageSize) + 1;
    const endItem = Math.min(currentPage * actualPageSize, totalItems);

    const handlePageSizeChangeLocal = (e) => {
      const newSize = e.target.value === 'all' ? 'All' : parseInt(e.target.value);
      handlePageSizeChange(newSize);
    };

    const renderPageButtons = () => {
      const buttons = [];
      const maxVisiblePages = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // Adjust startPage if we're near the end
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      // Add ellipsis at the beginning if needed
      if (startPage > 1) {
        buttons.push(
          <button
            key={1}
            onClick={() => handlePageChange(1)}
            className="pagination-btn"
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              padding: '0 6px',
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
              fontSize: '14px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            1
          </button>
        );
        if (startPage > 2) {
          buttons.push(
            <span key="ellipsis-start" style={{ padding: '0 4px', color: '#6b7280' }}>
              ...
            </span>
          );
        }
      }

      // Add page buttons
      for (let i = startPage; i <= endPage; i++) {
        buttons.push(
          <button
            key={i}
            onClick={() => handlePageChange(i)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              padding: '0 6px',
              border: '1px solid #d1d5db',
              background: i === currentPage ? '#1976d2' : 'white',
              color: i === currentPage ? 'white' : '#374151',
              fontSize: '14px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {i}
          </button>
        );
      }

      // Add ellipsis at the end if needed
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          buttons.push(
            <span key="ellipsis-end" style={{ padding: '0 4px', color: '#6b7280' }}>
              ...
            </span>
          );
        }
        buttons.push(
          <button
            key={totalPages}
            onClick={() => handlePageChange(totalPages)}
            className="pagination-btn"
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              padding: '0 6px',
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
              fontSize: '14px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {totalPages}
          </button>
        );
      }

      return buttons;
    };

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderTop: '1px solid #e0e0e0',
        flexWrap: 'wrap',
        gap: '16px',
        minHeight: '48px',
        marginTop: 'auto',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              color: '#374151',
              fontSize: '14px'
            }}>
              Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {totalItems.toLocaleString()} entries
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <label style={{
              color: '#6b7280',
              fontSize: '14px',
              margin: 0
            }}>Rows per page:</label>
            <select
              value={pageSize === 'All' || pageSize >= totalItems ? 'all' : pageSize}
              onChange={handlePageSizeChangeLocal}
              disabled={isLoading}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value="all">All ({totalItems.toLocaleString()})</option>
            </select>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isLoading}
            title="First page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: '1px solid #d1d5db',
              background: currentPage === 1 || isLoading ? '#f3f4f6' : 'white',
              color: currentPage === 1 || isLoading ? '#9ca3af' : '#374151',
              borderRadius: '4px',
              cursor: currentPage === 1 || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            title="Previous page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: '1px solid #d1d5db',
              background: currentPage === 1 || isLoading ? '#f3f4f6' : 'white',
              color: currentPage === 1 || isLoading ? '#9ca3af' : '#374151',
              borderRadius: '4px',
              cursor: currentPage === 1 || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            margin: '0 8px'
          }}>
            {renderPageButtons()}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            title="Next page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: '1px solid #d1d5db',
              background: currentPage === totalPages || isLoading ? '#f3f4f6' : 'white',
              color: currentPage === totalPages || isLoading ? '#9ca3af' : '#374151',
              borderRadius: '4px',
              cursor: currentPage === totalPages || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ChevronRight size={14} />
          </button>

          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || isLoading}
            title="Last page"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: '1px solid #d1d5db',
              background: currentPage === totalPages || isLoading ? '#f3f4f6' : 'white',
              color: currentPage === totalPages || isLoading ? '#9ca3af' : '#374151',
              borderRadius: '4px',
              cursor: currentPage === totalPages || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // Expose table methods via ref
  React.useImperativeHandle(ref, () => ({
    addRow: addNewRow,
    deleteSelectedRows,
    saveChanges,
    fillDown,
    fillRight,
    clearSelection: () => setSelectedCells(new Set()),
    getSelectedCells: () => selectedCells,
    getTableData: () => currentTableData,
    hasChanges,
    autoSizeColumns,
  }));

  return (
    <div className="tanstack-crud-table-container" style={{
      height,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {/* Modern Table Controls */}
      <div className="table-controls" style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: '#fafafa',
        minHeight: '64px'
      }}>
        {/* Enhanced Search */}
        <div style={{ position: 'relative', minWidth: '250px' }}>
          <input
            type="text"
            placeholder="🔍 Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: '1px solid #d0d0d0',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              backgroundColor: 'white'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1976d2';
              e.target.style.boxShadow = '0 0 0 2px rgba(25, 118, 210, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d0d0d0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Modern Action Buttons */}
        {/* Conditional rendering for Add Actions */}
        {customAddActions ? (
          <div className="dropdown">
            <button
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{
                padding: '10px 18px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s, transform 0.1s',
                boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#1565c0';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1976d2';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {customAddActions.dropdownLabel || "Add Item"} ▼
            </button>
            <ul className="dropdown-menu">
              {customAddActions.actions?.map((action, index) => (
                <React.Fragment key={index}>
                  <li>
                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        if (action.onClick === "default") {
                          addNewRow();
                        } else if (typeof action.onClick === 'function') {
                          action.onClick();
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  </li>
                  {action.divider && <li><hr className="dropdown-divider" /></li>}
                </React.Fragment>
              ))}
            </ul>
          </div>
        ) : (
          <button
            onClick={addNewRow}
            style={{
              padding: '10px 18px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s, transform 0.1s',
              boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#1565c0';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1976d2';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ➕ Add Row
          </button>
        )}

        <button
          onClick={deleteSelectedRows}
          disabled={selectedCells.size === 0}
          style={{
            padding: '10px 18px',
            backgroundColor: selectedCells.size > 0 ? '#d32f2f' : '#e0e0e0',
            color: selectedCells.size > 0 ? 'white' : '#9e9e9e',
            border: 'none',
            borderRadius: '6px',
            cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s, transform 0.1s',
            boxShadow: selectedCells.size > 0 ? '0 2px 4px rgba(211, 47, 47, 0.2)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (selectedCells.size > 0) {
              e.target.style.backgroundColor = '#c62828';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCells.size > 0) {
              e.target.style.backgroundColor = '#d32f2f';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          🗑️ Delete Selected ({selectedCells.size})
        </button>

        <button
          onClick={saveChanges}
          disabled={!hasChanges || isLoading}
          style={{
            padding: '10px 18px',
            backgroundColor: hasChanges && !isLoading ? '#2e7d32' : '#e0e0e0',
            color: hasChanges && !isLoading ? 'white' : '#9e9e9e',
            border: 'none',
            borderRadius: '6px',
            cursor: hasChanges && !isLoading ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s, transform 0.1s',
            boxShadow: hasChanges && !isLoading ? '0 2px 4px rgba(46, 125, 50, 0.2)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (hasChanges && !isLoading) {
              e.target.style.backgroundColor = '#1b5e20';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasChanges && !isLoading) {
              e.target.style.backgroundColor = '#2e7d32';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {isLoading ? '💾 Saving...' : hasChanges ? '💾 Save Changes' : '💾 No Changes'}
        </button>

        {/* Auto-size columns button */}
        <button
          onClick={autoSizeColumns}
          style={{
            padding: '10px 18px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s, transform 0.1s',
            boxShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#1565c0';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#1976d2';
            e.target.style.transform = 'translateY(0)';
          }}
          title="Auto-size all columns to fit content"
        >
          📏 Auto-size Columns
        </button>

        {/* Status indicator and shortcuts */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {selectedCells.size > 0 && (
            <div style={{
              padding: '6px 12px',
              backgroundColor: '#e3f2fd',
              border: '1px solid #1976d2',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#1976d2',
              fontWeight: '500'
            }}>
              {selectedCells.size} cell{selectedCells.size > 1 ? 's' : ''} selected
            </div>
          )}

          {/* Keyboard shortcuts hint */}
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#666',
            cursor: 'help'
          }}
          title="Keyboard Shortcuts:
• Click: Select cell
• Ctrl+Click: Multi-select
• Shift+Click: Range select
• Arrow Keys: Navigate
• Tab/Shift+Tab: Navigate
• Ctrl+C/V: Copy/Paste
• Ctrl+D: Fill Down
• Ctrl+R: Fill Right
• Delete: Clear cells
• Shift+Delete: Delete rows
• Escape: Clear selection
• F2: Edit cell">
            ⌨️ Excel Features
          </div>
        </div>
      </div>

      {/* Professional Table */}
      <div
        className="table-wrapper"
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'white'
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <table style={{
          width: table.getCenterTotalSize(),
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: '14px',
          minWidth: '100%',
          tableLayout: 'fixed'
        }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    style={{
                      padding: '14px 12px',
                      textAlign: 'left',
                      borderBottom: '2px solid #e0e0e0',
                      borderRight: '1px solid #e0e0e0',
                      backgroundColor: '#f8f9fa',
                      height: '50px', // Consistent header height
                      minHeight: '50px',
                      position: 'relative',
                      width: header.getSize(),
                      fontWeight: '600',
                      fontSize: '13px',
                      color: '#424242',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      userSelect: 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                    onMouseEnter={(e) => {
                      if (header.column.getCanSort()) {
                        e.target.style.backgroundColor = '#f0f0f0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span style={{
                          color: header.column.getIsSorted() ? '#1976d2' : '#bdbdbd',
                          fontSize: '12px'
                        }}>
                          {header.column.getIsSorted() === 'desc' ? '▼' :
                           header.column.getIsSorted() === 'asc' ? '▲' : '↕'}
                        </span>
                      )}
                    </div>
                    {/* Column resize handle */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setResizeState({
                            isResizing: true,
                            startX: e.clientX,
                            currentX: e.clientX,
                            columnId: header.id
                          });
                          header.getResizeHandler()(e);
                        }}
                        onTouchStart={header.getResizeHandler()}
                        className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                        onMouseEnter={(e) => {
                          if (!header.column.getIsResizing()) {
                            e.target.style.opacity = '1';
                            e.target.style.background = '#1976d2';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!header.column.getIsResizing()) {
                            e.target.style.opacity = '0';
                            e.target.style.background = 'rgba(0, 0, 0, 0.1)';
                          }
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: header.column.getIsResizing() ? '3px' : '5px',
                          background: header.column.getIsResizing() ? '#1976d2' : 'rgba(0, 0, 0, 0.1)',
                          cursor: 'col-resize',
                          userSelect: 'none',
                          touchAction: 'none',
                          opacity: header.column.getIsResizing() ? 1 : 0,
                          transition: 'opacity 0.2s',
                          boxShadow: header.column.getIsResizing() ? '0 0 0 1px #1976d2' : 'none',
                          zIndex: header.column.getIsResizing() ? 1000 : 10
                        }}
                      />
                    )}
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
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!Array.from(selectedCells).some(key => key.startsWith(`${row.index}-`))) {
                    e.target.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!Array.from(selectedCells).some(key => key.startsWith(`${row.index}-`))) {
                    e.target.style.backgroundColor = 'white';
                  }
                }}
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const rowIndex = row.index;
                  const colIndex = cellIndex;
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const isSelected = selectedCells.has(cellKey);

                  return (
                    <td
                      key={cell.id}
                      style={{
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid #e0e0e0',
                        borderRight: '1px solid #e0e0e0',
                        width: cell.column.getSize(),
                        backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                        cursor: 'cell',
                        position: 'relative',
                        transition: 'background-color 0.15s, border-color 0.15s',
                        outline: isSelected ? '2px solid #1976d2' : 'none',
                        outlineOffset: '-2px',
                        minHeight: '20px',
                        maxWidth: '300px',
                        overflow: 'hidden'
                      }}
                      onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = '#f9f9f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.target.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <PaginationFooter />

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <div>Loading...</div>
          </div>
        </div>
      )}

      {/* Fill Preview */}
      {fillPreview && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#333',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px',
          zIndex: 1001,
          fontSize: '14px',
        }}>
          {fillPreview.operation}: {fillPreview.sourceValue} → {fillPreview.count} cells
        </div>
      )}

      {/* Floating Navigation Panel */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        zIndex: 1000,
        opacity: 0.9,
        transition: 'opacity 0.2s'
      }}
      onMouseEnter={(e) => e.target.style.opacity = '1'}
      onMouseLeave={(e) => e.target.style.opacity = '0.9'}
      >
        {/* Auto-size Columns Button */}
        <button
          onClick={autoSizeColumns}
          title="Auto-size Columns"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'background-color 0.2s',
            marginBottom: '4px'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
        >
          📏
        </button>

        {/* Top Arrow */}
        <button
          onClick={scrollToTop}
          title="Scroll to Top"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
        >
          ▲
        </button>

        {/* Navigation Row */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Left Arrow */}
          <button
            onClick={scrollToLeft}
            title="Scroll to Left"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
          >
            ◀
          </button>

          {/* Right Arrow */}
          <button
            onClick={scrollToRight}
            title="Scroll to Right"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
          >
            ▶
          </button>
        </div>

        {/* Bottom Arrow */}
        <button
          onClick={scrollToBottom}
          title="Scroll to Bottom"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
        >
          ▼
        </button>
      </div>

      {/* Floating resize line that follows cursor during drag */}
      {resizeState.isResizing && (
        <div
          style={{
            position: 'fixed',
            left: resizeState.currentX,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: '#1976d2',
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 0 0 1px rgba(25, 118, 210, 0.3)'
          }}
        />
      )}
    </div>
  );
});

// Enhanced Cell Components

// Enhanced searchable dropdown cell component
const VendorDropdownCell = ({ value, options = [], rowIndex, columnKey, updateCellData, rowData, filterFunction }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        console.log('🖱️ Click outside detected, closing dropdown');
        setIsOpen(false);
        setSearchText('');
        setSelectedIndex(-1);
      }
    };

    if (isOpen) {
      // Use a slight delay to avoid interfering with option clicks
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('focusin', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('focusin', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Apply filtering function if provided, then search filtering
  let availableOptions = options;
  if (filterFunction && rowData) {
    availableOptions = filterFunction(options, rowData, columnKey);
    console.log(`🔍 Filtered ${columnKey} options from ${options.length} to ${availableOptions.length} for row data:`, rowData);
  }

  const filteredOptions = availableOptions.filter(option =>
    typeof option === 'string'
      ? option.toLowerCase().includes(searchText.toLowerCase())
      : (option.name || option.label || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = (selectedOption) => {
    console.log('🖱️ handleSelect called with:', selectedOption);

    const newValue = typeof selectedOption === 'string' ? selectedOption : (selectedOption.name || selectedOption.label);

    console.log(`📝 Setting ${columnKey} to: "${newValue}" for row ${rowIndex}`);

    setLocalValue(newValue);
    updateCellData(rowIndex, columnKey, newValue);
    setIsOpen(false);
    setSearchText('');
    setSelectedIndex(-1);

    console.log('✅ Dropdown closed after selection');
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
          handleSelect(filteredOptions[selectedIndex]);
        } else if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchText('');
        setSelectedIndex(-1);
        break;
    }
  };

  // Determine dropdown position with safety checks
  const getDropdownStyle = () => {
    if (!containerRef.current) {
      console.log('⚠️ containerRef not available, using fallback positioning');
      return {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 9999,
        maxHeight: '200px'
      };
    }

    try {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || 800;
      const dropdownHeight = 200; // max dropdown height
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If there's more space above and not enough below, show above
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      const style = {
        position: 'fixed',
        left: Math.max(0, rect.left),
        width: Math.max(100, rect.width),
        zIndex: 9999,
        maxHeight: Math.min(dropdownHeight, showAbove ? spaceAbove - 10 : spaceBelow - 10)
      };

      if (showAbove) {
        style.bottom = windowHeight - rect.top + 2;
      } else {
        style.top = rect.bottom + 2;
      }

      console.log('📍 Dropdown positioning:', style);
      return style;
    } catch (error) {
      console.error('❌ Error calculating dropdown position:', error);
      return {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 9999,
        maxHeight: '200px'
      };
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{
          padding: '6px 10px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: localValue ? '#f8f9fa' : 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          transition: 'all 0.2s',
          minHeight: '32px',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.target.style.borderColor = '#1976d2';
          e.target.style.backgroundColor = localValue ? '#e3f2fd' : '#f9f9f9';
        }}
        onMouseLeave={(e) => {
          e.target.style.borderColor = '#e0e0e0';
          e.target.style.backgroundColor = localValue ? '#f8f9fa' : 'white';
        }}
      >
        <span style={{
          color: localValue ? '#333' : '#999',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {localValue || 'Select...'}
        </span>
        <span style={{
          color: '#666',
          marginLeft: '8px',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>▼</span>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            ...getDropdownStyle(),
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}
        >
          <input
            type="text"
            placeholder="🔍 Type to filter..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSelectedIndex(-1); // Reset selection when filtering
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderBottom: '1px solid #f0f0f0',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: '#fafafa',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          <div style={{
            maxHeight: '150px',
            overflow: 'auto',
            backgroundColor: 'white'
          }}>
            {filteredOptions.map((option, index) => {
              const displayText = typeof option === 'string' ? option : (option.name || option.label);
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Option clicked:', displayText);
                    handleSelect(option);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f5f5f5' : 'none',
                    fontSize: '14px',
                    transition: 'background-color 0.15s',
                    backgroundColor: isSelected ? '#e3f2fd' : 'white',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.target.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.target.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {displayText}
                </div>
              );
            })}
            {filteredOptions.length === 0 && (
              <div style={{
                padding: '12px',
                fontSize: '13px',
                color: '#999',
                fontStyle: 'italic',
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced checkbox cell component
const ExistsCheckboxCell = ({ value, rowIndex, columnKey, updateCellData }) => {
  const [checked, setChecked] = useState(Boolean(value));

  useEffect(() => {
    setChecked(Boolean(value));
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.checked;
    setChecked(newValue);
    updateCellData(rowIndex, columnKey, newValue);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      padding: '4px'
    }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '4px',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = 'transparent';
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          style={{
            cursor: 'pointer',
            transform: 'scale(1.3)',
            margin: 0,
            accentColor: '#1976d2'
          }}
        />
      </label>
    </div>
  );
};

// Enhanced editable text cell component
const EditableTextCell = ({ value, rowIndex, columnKey, updateCellData }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value || '');
    }
  }, [value, isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setLocalValue(value || '');
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    commitValue();
  };

  const commitValue = () => {
    setIsEditing(false);
    if (localValue !== value) {
      updateCellData(rowIndex, columnKey, localValue);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          border: '2px solid #1976d2',
          borderRadius: '4px',
          outline: 'none',
          padding: '6px 8px',
          backgroundColor: '#fff',
          fontSize: '14px',
          boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)'
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 8px',
        cursor: 'text',
        minHeight: '20px',
        borderRadius: '4px',
        transition: 'background-color 0.2s',
        fontSize: '14px',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#f9f9f9';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = 'transparent';
      }}
      title={String(localValue)}
    >
      {localValue || (
        <span style={{ color: '#bbb', fontStyle: 'italic' }}>
          Double-click to edit...
        </span>
      )}
    </div>
  );
};

// Password-like cell that shows asterisks but reveals value on double-click
const PasswordLikeCell = ({ actualValue, maskedValue, rowIndex, columnKey, updateCellData }) => {
  const [localValue, setLocalValue] = useState(actualValue || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(actualValue || '');
    }
  }, [actualValue, isEditing]);

  const handleDoubleClick = () => {
    if (!isRevealed) {
      // First double-click reveals the password
      setIsRevealed(true);
      setTimeout(() => setIsRevealed(false), 3000); // Hide after 3 seconds
    } else {
      // Second double-click (while revealed) starts editing
      setIsEditing(true);
    }
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setLocalValue(actualValue || '');
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleSave = () => {
    setIsEditing(false);
    setIsRevealed(false);
    if (updateCellData && localValue !== actualValue) {
      updateCellData(rowIndex, columnKey, localValue);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          border: '2px solid #1976d2',
          borderRadius: '4px',
          outline: 'none',
          padding: '6px 8px',
          backgroundColor: '#fff',
          fontSize: '14px',
          boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)'
        }}
      />
    );
  }

  const displayValue = isRevealed ? actualValue : maskedValue;

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 8px',
        cursor: 'pointer',
        minHeight: '20px',
        borderRadius: '4px',
        transition: 'background-color 0.2s',
        fontSize: '14px',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: isRevealed ? 'inherit' : 'monospace',
        backgroundColor: isRevealed ? '#fff3cd' : 'transparent',
        border: isRevealed ? '1px solid #ffeaa7' : '1px solid transparent'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = isRevealed ? '#fff3cd' : '#f9f9f9';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = isRevealed ? '#fff3cd' : 'transparent';
      }}
      title={isRevealed ? "Double-click to edit" : "Double-click to reveal"}
    >
      {displayValue || (
        <span style={{ color: '#bbb', fontStyle: 'italic' }}>
          Double-click to reveal...
        </span>
      )}
    </div>
  );
};

// Helper function for column width
const getColumnWidth = (headerName, columnType) => {
  const baseWidth = Math.max(120, headerName.length * 8 + 40);

  switch (columnType) {
    case 'boolean': return 80;
    case 'date': return 120;
    case 'number': return 100;
    case 'select':
    case 'dropdown': return Math.max(baseWidth, 150);
    default: return Math.min(baseWidth, 200);
  }
};

TanStackCRUDTable.displayName = 'TanStackCRUDTable';

export default TanStackCRUDTable;