import React, { useState, useRef, useMemo, forwardRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';

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
  deleteUrl,
  customerId,

  // Column Configuration
  columns = [],
  colHeaders = [],
  dropdownSources = {},
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

  ...otherProps
}, ref) => {

  // Core state
  const [fabricData, setFabricData] = useState([]);
  const [editableData, setEditableData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [deletedRows, setDeletedRows] = useState([]);

  // Excel-like features state
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectionRange, setSelectionRange] = useState(null);
  const [currentCell, setCurrentCell] = useState({ row: 0, col: 0 });
  const [globalFilter, setGlobalFilter] = useState('');
  const [fillPreview, setFillPreview] = useState(null);

  // Table configuration
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  // API URL with customer filter for server pagination
  const filteredApiUrl = useMemo(() => {
    if (customerId && apiUrl) {
      const url = apiUrl.includes('?')
        ? `${apiUrl}&customer_id=${customerId}`
        : `${apiUrl}?customer_id=${customerId}`;
      console.log('🔗 Building filtered API URL for customer', customerId, ':', url);
      return url;
    } else {
      console.log('⚠️ No customer ID available, using unfiltered API URL:', apiUrl);
      return apiUrl;
    }
  }, [customerId, apiUrl]);

  // Delete URL function for individual deletions
  const getDeleteUrl = useCallback((id) => {
    if (deleteUrl && deleteUrl.includes('/delete/')) {
      return `${deleteUrl}${id}/`;
    }
    return `${deleteUrl}/${id}/`;
  }, [deleteUrl]);

  // Load data from server
  useEffect(() => {
    const loadData = async () => {
      if (!filteredApiUrl) {
        console.log('⚠️ No API URL available');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🔄 Loading data from:', filteredApiUrl);
        const response = await axios.get(filteredApiUrl);
        let dataList = response.data;
        if (response.data.results) {
          dataList = response.data.results;
        }

        console.log('📥 Loaded data from server:', dataList.length, 'records');

        // Process data if preprocessing function provided
        const processedData = preprocessData ? preprocessData(dataList) : dataList;

        setFabricData(processedData);
        setEditableData([...processedData]);
        setHasChanges(false);
        setDeletedRows([]);

      } catch (error) {
        console.error('❌ Error loading data:', error);
        setError('Failed to load data: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [filteredApiUrl, preprocessData]);

  // Table data with filtering
  const currentTableData = useMemo(() => {
    if (!globalFilter) {
      console.log('🔍 No global filter, showing all data:', editableData.length, 'rows');
      return editableData;
    }

    const filtered = editableData.filter(item => {
      return Object.values(item).some(value =>
        String(value || '').toLowerCase().includes(globalFilter.toLowerCase())
      );
    });

    console.log(`🔍 Filtered data: ${filtered.length} of ${editableData.length} rows match "${globalFilter}"`);
    return filtered;
  }, [editableData, globalFilter]);

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

  // Add new row
  const addNewRow = useCallback(() => {
    const newRowId = `new-${Date.now()}`;
    const newRow = {
      id: newRowId,
      ...newRowTemplate
    };

    const newData = [...editableData, newRow];
    setEditableData(newData);
    setHasChanges(true);

    console.log('➕ Added new row:', newRow);
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

      // Separate new rows from existing rows
      const newRows = editableData.filter(row => String(row.id).startsWith('new-'));
      const existingRows = editableData.filter(row => !String(row.id).startsWith('new-'));

      console.log('➕ New rows to create:', newRows.length);
      console.log('✏️ Existing rows to update:', existingRows.length);
      console.log('🗑️ Rows to delete:', deletedRows.length);

      // Delete rows first (individual DELETE requests)
      const uniqueDeletedRows = [...new Set(deletedRows)]; // Remove duplicates
      for (const deletedId of uniqueDeletedRows) {
        console.log('🗑️ Deleting record ID:', deletedId);
        const response = await axios.delete(getDeleteUrl(deletedId));
        console.log('✅ Deleted record response:', response.data);
      }

      // Save new rows (POST requests)
      for (const newRow of newRows) {
        let rowData = { ...newRow };
        delete rowData.id; // Remove temp ID

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
        const response = await axios.put(`${saveUrl || apiUrl}${existingRow.id}/`, rowData);
        console.log('✅ Updated record response:', response.data);
      }

      // Reload data from server to get fresh state
      console.log('🔄 Reloading data from server...');
      const response = await axios.get(filteredApiUrl);
      let dataList = response.data;
      if (response.data.results) {
        dataList = response.data.results;
      }

      // Process data if preprocessing function provided
      const processedData = preprocessData ? preprocessData(dataList) : dataList;

      setFabricData(processedData);
      setEditableData([...processedData]);
      setDeletedRows([]);
      setHasChanges(false);

      console.log('✅ All changes saved successfully!');

      // Call onSave callback if provided
      if (onSave) {
        onSave({ success: true, message: 'Changes saved successfully' });
      }

    } catch (error) {
      console.error('❌ Error saving changes:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;

      if (onSave) {
        onSave({ success: false, message: 'Error saving changes: ' + errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  }, [editableData, hasChanges, deletedRows, filteredApiUrl, getDeleteUrl, saveUrl, apiUrl, saveTransform, preprocessData, onSave]);

  // Create enhanced column definitions with our custom cell components
  const columnDefs = useMemo(() => {
    return columns.map((column, index) => {
      const headerName = colHeaders[index] || column.header || column.data || `Column ${index + 1}`;
      const accessorKey = column.data || column.accessorKey || `column_${index}`;
      const dropdownSource = dropdownSources[accessorKey] || dropdownSources[headerName];

      return {
        id: accessorKey,
        accessorKey,
        header: headerName,

        // Enhanced cell rendering with editing capabilities
        cell: ({ row, column, getValue, table }) => {
          const value = getValue();
          const rowIndex = row.index;
          const colIndex = column.getIndex?.() || index;

          // Determine cell type
          if (column.columnDef.accessorKey === 'exists' || column.type === 'checkbox') {
            return (
              <ExistsCheckboxCell
                value={value}
                rowIndex={rowIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
              />
            );
          }

          if (dropdownSource) {
            return (
              <VendorDropdownCell
                value={value}
                options={dropdownSource}
                rowIndex={rowIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
              />
            );
          }

          // Default to editable text cell
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

        // Sizing
        size: column.width || getColumnWidth(headerName, column.type),
        minSize: 50,
        maxSize: 800,
      };
    });
  }, [columns, colHeaders, dropdownSources, updateCellData]);

  // Table instance
  const table = useReactTable({
    data: currentTableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
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

  // Copy/Paste functionality
  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;

    const cellKeys = Array.from(selectedCells).sort();
    const copyData = cellKeys.map(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      const columnKey = columnDefs[colIndex]?.accessorKey;
      return currentTableData[rowIndex]?.[columnKey] || '';
    });

    const copyText = copyData.join('\t');
    navigator.clipboard.writeText(copyText);
    console.log('📋 Copied to clipboard:', copyText);
  }, [selectedCells, currentTableData, columnDefs]);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const rows = clipboardText.split('\n').filter(row => row.trim());
      const pasteData = rows.map(row => row.split('\t'));

      console.log('📋 Pasting data:', pasteData);

      // Auto-extend rows if needed
      const currentRowCount = editableData.length;
      const neededRows = Math.max(0, (currentCell.row + pasteData.length) - currentRowCount);

      if (neededRows > 0) {
        console.log(`➕ Auto-extending table with ${neededRows} new rows`);
        const newRows = Array.from({ length: neededRows }, (_, i) => ({
          id: `new-${Date.now()}-${i}`,
          ...newRowTemplate
        }));

        setEditableData(prev => [...prev, ...newRows]);
      }

      // Apply paste data
      setEditableData(currentData => {
        const newData = [...currentData];

        pasteData.forEach((rowData, rowOffset) => {
          const targetRowIndex = currentCell.row + rowOffset;
          if (targetRowIndex < newData.length) {
            rowData.forEach((cellValue, colOffset) => {
              const targetColIndex = currentCell.col + colOffset;
              const columnKey = columnDefs[targetColIndex]?.accessorKey;
              if (columnKey && newData[targetRowIndex]) {
                newData[targetRowIndex] = {
                  ...newData[targetRowIndex],
                  [columnKey]: cellValue
                };
              }
            });
          }
        });

        return newData;
      });

      setHasChanges(true);

    } catch (error) {
      console.error('❌ Error pasting data:', error);
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
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: '14px'
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
                      backgroundColor: '#f8f9fa',
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
                        borderBottom: '1px solid #f0f0f0',
                        borderRight: '1px solid #f5f5f5',
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
    </div>
  );
});

// Enhanced Cell Components

// Enhanced searchable dropdown cell component
const VendorDropdownCell = ({ value, options = [], rowIndex, columnKey, updateCellData }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const filteredOptions = options.filter(option =>
    typeof option === 'string'
      ? option.toLowerCase().includes(searchText.toLowerCase())
      : (option.name || option.label || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = (selectedOption) => {
    const newValue = typeof selectedOption === 'string' ? selectedOption : (selectedOption.name || selectedOption.label);
    setLocalValue(newValue);
    updateCellData(rowIndex, columnKey, newValue);
    setIsOpen(false);
    setSearchText('');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
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
          minHeight: '32px'
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
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1001,
          maxHeight: '200px',
          overflow: 'hidden',
          marginTop: '2px'
        }}>
          <input
            type="text"
            placeholder="🔍 Type to filter..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderBottom: '1px solid #f0f0f0',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: '#fafafa'
            }}
            autoFocus
          />
          <div style={{ maxHeight: '150px', overflow: 'auto' }}>
            {filteredOptions.map((option, index) => {
              const displayText = typeof option === 'string' ? option : (option.name || option.label);
              return (
                <div
                  key={index}
                  onClick={() => handleSelect(option)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: index < filteredOptions.length - 1 ? '1px solid #f5f5f5' : 'none',
                    fontSize: '14px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#e3f2fd';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'white';
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
                textAlign: 'center'
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
        {/* Visual indicator */}
        <span style={{
          marginLeft: '8px',
          fontSize: '12px',
          color: checked ? '#2e7d32' : '#666',
          fontWeight: '500'
        }}>
          {checked ? '✓' : '○'}
        </span>
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