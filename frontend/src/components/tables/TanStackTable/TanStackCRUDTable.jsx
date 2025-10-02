import React, { useState, useRef, useMemo, forwardRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getColumnResizeMode,
  flexRender,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import FilterDropdown from './components/FilterDropdown';
import StatsContainer from './components/StatsContainer';
import {
  createTableFilterFunction,
  convertToColumnFilters,
  convertFromColumnFilters,
  getFilterSummary,
  cleanInvalidFilters
} from './utils/filterUtils';

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

  // Theme context
  const { theme } = useTheme();

  // Core state
  const [fabricData, setFabricData] = useState([]);
  const [editableData, setEditableData] = useState([]);
  const [allData, setAllData] = useState([]); // Complete dataset for filtering
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
  const [invalidCells, setInvalidCells] = useState(new Set()); // Track cells with invalid dropdown values

  // Context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, cellKey: null });

  // Table configuration
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnSizing, setColumnSizing] = useState({});

  // Advanced filter state
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [useServerSideFiltering, setUseServerSideFiltering] = useState(false); // Start with client-side filtering

  // Client-side pagination state (for when we load all data)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: parseInt(pageSize) || 25,
  });

  // Update pagination pageSize when pageSize prop changes
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      pageSize: parseInt(pageSize) || 25
    }));
  }, [pageSize]);
  const [tableConfig, setTableConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [resizeState, setResizeState] = useState({ isResizing: false, startX: 0, currentX: 0, columnId: null });

  // Floating navigation panel state
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState(null);

  // Build API URL with pagination and customer filter
  const buildApiUrl = useCallback((page, size, search = '', filters = {}) => {
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

    // Add advanced filters
    Object.keys(filters).forEach(columnId => {
      const filter = filters[columnId];
      if (filter && filter.active) {
        if (filter.type === 'items') {
          // For item filters, send selected items as comma-separated values
          if (filter.selectedItems && filter.selectedItems.length > 0) {
            url += `&filter_${columnId}_in=${encodeURIComponent(filter.selectedItems.join(','))}`;
          }
        } else {
          // For text filters, send the filter type and value
          const filterValue = encodeURIComponent(filter.value || '');
          switch (filter.type) {
            case 'contains':
              url += `&filter_${columnId}_contains=${filterValue}`;
              break;
            case 'not_contains':
              url += `&filter_${columnId}_not_contains=${filterValue}`;
              break;
            case 'starts_with':
              url += `&filter_${columnId}_startswith=${filterValue}`;
              break;
            case 'ends_with':
              url += `&filter_${columnId}_endswith=${filterValue}`;
              break;
            case 'equals':
              url += `&filter_${columnId}_exact=${filterValue}`;
              break;
            case 'not_equals':
              url += `&filter_${columnId}_not_exact=${filterValue}`;
              break;
            case 'is_empty':
              url += `&filter_${columnId}_isnull=true`;
              break;
            case 'is_not_empty':
              url += `&filter_${columnId}_isnull=false`;
              break;
          }
        }
      }
    });

    console.log(`🌐 Built API URL with filters: ${url}`);
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
        // Load page_size from direct field
        if (response.data.page_size) {
          console.log('📊 Loading saved page size:', response.data.page_size);
          setPageSize(response.data.page_size);
        }

        // Load current_page from additional_settings
        if (response.data.additional_settings?.current_page) {
          console.log('📊 Loading saved current page:', response.data.additional_settings.current_page);
          setCurrentPage(response.data.additional_settings.current_page);
        }
        console.log('📊 Loaded table configuration:', response.data);
      }
    } catch (error) {
      console.log('⚠️ No existing table configuration found or error loading:', error.message);
    } finally {
      // Mark config as loaded regardless of success/failure
      setConfigLoaded(true);
      console.log('📊 Table configuration loading completed');
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

  // Determine if we need client-side pagination (memoized for consistency)
  const hasActiveClientFilters = useMemo(() => {
    const hasActiveFilters = Object.keys(activeFilters).some(key => activeFilters[key].active);
    const hasGlobalFilter = globalFilter && globalFilter.trim().length > 0;
    const result = !useServerSideFiltering && (hasActiveFilters || hasGlobalFilter);
    console.log('🔍 hasActiveClientFilters calculation:', {
      useServerSideFiltering,
      hasActiveFilters,
      hasGlobalFilter,
      result
    });
    return result;
  }, [useServerSideFiltering, activeFilters, globalFilter]);

  // Load data from server with pagination
  const loadData = useCallback(async () => {
    // Only pass filters to server if using server-side filtering
    const filtersToPass = useServerSideFiltering ? activeFilters : {};

    // Use the memoized hasActiveClientFilters value for consistency

    // Use a large page size when client-side filters are active to get all data
    const effectivePageSize = hasActiveClientFilters ? 10000 : pageSize;
    const effectivePage = hasActiveClientFilters ? 1 : currentPage;

    console.log('🔄 loadData parameters:', {
      hasActiveClientFilters,
      effectivePageSize,
      effectivePage,
      pageSize,
      currentPage
    });

    const url = buildApiUrl(effectivePage, effectivePageSize,
                           useServerSideFiltering ? globalFilter : '',
                           filtersToPass);
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

      // Store all data for filtering, but handle pagination correctly
      if (hasActiveClientFilters) {
        // When client-side filtering is active, we have all data
        // Store the full dataset and let TanStack Table handle filtering and pagination
        setFabricData(processedData);
        setEditableData([...processedData]);
        setTotalItems(totalCount);
        // For client-side filtering, pagination is handled by TanStack Table
        setTotalPages(Math.max(1, Math.ceil(processedData.length / pageSize)));
      } else {
        // Normal server-side pagination - only store the current page data
        setFabricData(processedData);
        setEditableData([...processedData]);
        setTotalItems(totalCount);
        setTotalPages(pageSize === 'All' ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)));
      }
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
  }, [buildApiUrl, currentPage, pageSize, globalFilter, activeFilters, useServerSideFiltering, preprocessData, hasActiveClientFilters]);

  // Load complete dataset for filter dropdown items
  const loadAllDataForFiltering = useCallback(async () => {
    if (!apiUrl) return;

    try {
      // Load all data without filters (using a large page size)
      const url = buildApiUrl(1, 10000, '', {});
      console.log('🔍 Loading complete dataset for filtering from:', url);

      const response = await axios.get(url);
      let dataList = response.data.results || response.data;

      // Process data if preprocessing function provided
      const processedData = preprocessData ? preprocessData(dataList) : dataList;

      setAllData(processedData);
      console.log(`📊 Loaded ${processedData.length} total records for filtering`);

    } catch (error) {
      console.error('❌ Error loading complete dataset:', error);
    }
  }, [apiUrl, buildApiUrl, preprocessData]);

  // Load data when dependencies change, but wait for table config to load first (if table has config)
  useEffect(() => {
    const hasTableConfig = tableName && customerId;
    const shouldWaitForConfig = hasTableConfig && !configLoaded;

    if (apiUrl && !shouldWaitForConfig) {
      console.log('🔄 Loading data -', hasTableConfig ? 'after table configuration is ready' : 'no table config needed');
      loadData();
      // Also load complete dataset for filtering
      loadAllDataForFiltering();
    }
  }, [loadData, loadAllDataForFiltering, apiUrl, configLoaded, tableName, customerId]);

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

  // Save pagination state when it changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (tableName && customerId) {
        console.log('💾 Saving pagination state:', { currentPage, pageSize });

        // Merge with existing additional_settings to avoid overwriting other settings
        const existingAdditionalSettings = tableConfig?.additional_settings || {};

        saveTableConfig({
          page_size: parseInt(pageSize) || 25,
          additional_settings: {
            ...existingAdditionalSettings,
            current_page: currentPage
          }
        });
      }
    }, 500); // Shorter debounce for pagination

    return () => clearTimeout(debounceTimer);
  }, [currentPage, pageSize, saveTableConfig, tableName, customerId, tableConfig]);

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

    // Helper function to get nested value from object path (e.g., "fabric.name" or "fabric_details.name")
    const getNestedValue = (obj, path) => {
      if (!path) return undefined;
      return path.split('.').reduce((current, prop) => current?.[prop], obj);
    };

    // For each column, calculate optimal width based on content and header
    columns.forEach((column, index) => {
      const accessorKey = column.data || `column_${index}`;
      const headerName = colHeaders[index] || column.header || column.data || `Column ${index + 1}`;

      // Calculate width based on header length
      // Add extra width if column has a custom header (likely has a plus icon button)
      const hasCustomHeader = column.customHeader;
      const customHeaderPadding = hasCustomHeader ? 40 : 0; // Extra space for plus icon
      const headerWidth = Math.max(120, headerName.length * 10 + 60 + customHeaderPadding);

      // Calculate content width by sampling data
      let maxContentWidth = headerWidth;

      // For dropdown columns, also consider all dropdown options
      if (column.type === 'dropdown' && dropdownSources && dropdownSources[accessorKey]) {
        const dropdownOptions = dropdownSources[accessorKey] || [];
        dropdownOptions.forEach(option => {
          if (option) {
            // Use 10px per character for proportional fonts
            const optionWidth = String(option).length * 10 + 80; // Extra padding for dropdown arrow + padding
            maxContentWidth = Math.max(maxContentWidth, optionWidth);
          }
        });
        console.log(`📏 Dropdown column "${accessorKey}" - longest option width:`, maxContentWidth);
      }

      if (currentTableData && currentTableData.length > 0) {
        // Sample up to 100 rows to estimate content width (or all rows if less than 100)
        const sampleSize = Math.min(100, currentTableData.length);
        for (let i = 0; i < sampleSize; i++) {
          // Handle nested properties (e.g., "fabric.name" or "fabric_details.name")
          const cellValue = getNestedValue(currentTableData[i], accessorKey);
          if (cellValue) {
            // Add extra padding for dropdown columns
            // Use 10px per character for proportional fonts (more accurate than 8px)
            const extraPadding = column.type === 'dropdown' ? 80 : 40;
            const cellWidth = String(cellValue).length * 10 + extraPadding;
            maxContentWidth = Math.max(maxContentWidth, cellWidth);
          }
        }
      }

      // Set reasonable limits (increased max for dropdown readability)
      const finalWidth = Math.min(Math.max(maxContentWidth, 80), column.type === 'dropdown' ? 350 : 400);
      newSizing[accessorKey] = finalWidth;

      // Debug logging for name column
      if (accessorKey === 'name') {
        console.log(`📏 Name column sizing details:`, {
          headerWidth,
          maxContentWidth,
          finalWidth,
          sampleSize: currentTableData ? Math.min(100, currentTableData.length) : 0,
          sampleData: currentTableData ? currentTableData.slice(0, 3).map(row => getNestedValue(row, accessorKey)) : []
        });
      }
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

  // Handle scroll events for floating navigation panel
  useEffect(() => {
    const handleScroll = () => {
      // Show the floating navigation panel when scrolling
      setShowFloatingNav(true);

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Hide the panel after 2 seconds of no scrolling
      const timeout = setTimeout(() => {
        setShowFloatingNav(false);
      }, 2000);

      setScrollTimeout(timeout);
    };

    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (tableWrapper) {
        tableWrapper.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  // Helper function to get nested property value
  const getNestedValue = useCallback((obj, path) => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }, []);

  // Helper function to set nested property value
  const setNestedValue = useCallback((obj, path, value) => {
    if (!path) return obj;
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
    return obj;
  }, []);

  // Update cell data function - supports both flat and nested properties
  const updateCellData = useCallback((rowIndex, columnKey, newValue) => {
    setEditableData(currentData => {
      const newData = [...currentData];

      // Check if this is a nested property (contains a dot)
      if (columnKey.includes('.')) {
        // Use helper to set nested value
        setNestedValue(newData[rowIndex], columnKey, newValue);
        console.log(`📝 Updated nested ${columnKey} for row ${rowIndex} to: "${newValue}"`);
      } else {
        // Simple flat property
        newData[rowIndex] = {
          ...newData[rowIndex],
          [columnKey]: newValue
        };
        console.log(`📝 Updated ${columnKey} for row ${rowIndex} to: "${newValue}"`);
      }

      return newData;
    });
    setHasChanges(true);
  }, [setNestedValue]);

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

  // Advanced filter handling functions
  const handleFiltersChange = useCallback((newActiveFilters) => {
    console.log('🔍 Updating active filters:', newActiveFilters);

    // Clean invalid filters
    const cleanedFilters = cleanInvalidFilters(newActiveFilters);
    setActiveFilters(cleanedFilters);

    // Reset to page 1 when filters change (for server-side filtering)
    if (useServerSideFiltering) {
      setCurrentPage(1);
    } else {
      // Reset client-side pagination to first page when filters change
      setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }

    // Always update column filters for TanStack Table (needed for both server and client-side)
    const newColumnFilters = Object.keys(cleanedFilters)
      .filter(columnId => cleanedFilters[columnId].active)
      .map(columnId => ({
        id: columnId,
        value: cleanedFilters[columnId] // Pass the entire filter object as value
      }));

    setColumnFilters(newColumnFilters);
    console.log('✅ Column filters updated:', newColumnFilters);

    console.log('✅ Active filters updated:', cleanedFilters);
  }, [useServerSideFiltering]);

  const toggleFilterDropdown = useCallback((show) => {
    setShowFilterDropdown(show !== undefined ? show : !showFilterDropdown);
  }, [showFilterDropdown]);

  const clearAllFilters = useCallback(() => {
    console.log('🧹 Clearing all filters and resetting to normal pagination');

    // Clear all filter states
    setActiveFilters({});
    setColumnFilters([]);
    setGlobalFilter('');

    // Reset pagination to first page
    setCurrentPage(1);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));

    // The useEffect for loadData will automatically trigger when activeFilters and globalFilter change
    // No need to manually call loadData here as it will cause the right data loading behavior
    console.log('🧹 All filters cleared, data will reload automatically');
  }, []);

  // Sync activeFilters when columnFilters change from other sources
  useEffect(() => {
    const newActiveFilters = convertFromColumnFilters(columnFilters);
    if (JSON.stringify(newActiveFilters) !== JSON.stringify(activeFilters)) {
      setActiveFilters(newActiveFilters);
    }
  }, [columnFilters, activeFilters]);

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

      // Check if this is a checkbox column
      const actualColumnConfig = columns[index];
      const isCheckboxColumn = accessorKey === 'exists' || actualColumnConfig?.type === 'checkbox';
      const hasCustomHeader = actualColumnConfig?.customHeader;

      return {
        id: accessorKey,
        accessorKey,
        header: hasCustomHeader ? actualColumnConfig.customHeader.component :
          isCheckboxColumn ? ({ table: tableInstance }) => {
          // Get current data from table
          const currentData = tableInstance.options.data;
          return (
            <CheckboxHeaderCell
              columnKey={accessorKey}
              headerName={headerName}
              editableData={currentData}
              setEditableData={setEditableData}
              setHasChanges={setHasChanges}
              hasActiveClientFilters={hasActiveClientFilters}
              table={tableInstance}
            />
          );
        } : headerName,

        // Enhanced cell rendering with editing capabilities
        cell: ({ row, column, getValue, table }) => {
          const value = getValue();
          const rowIndex = row.index;
          const colIndex = column.getIndex?.() || index;

          // Get the actual column config to check type
          const actualColumnConfig = columns[index];
          const isCheckbox = accessorKey === 'exists' || actualColumnConfig?.type === 'checkbox';
          const isDropdown = actualColumnConfig?.type === 'dropdown' || accessorKey === 'san_vendor' ||
            (accessorKey.startsWith('member_') && !accessorKey.includes('count'));

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

            // Get current table data from table instance (always up-to-date, including unsaved changes)
            const tableData = table.options.data;

            // Handle dynamic dropdown sources (functions)
            if (typeof dropdownSources === 'function') {
              const dynamicSources = dropdownSources(tableData);

              // Check if this column has a dynamic function
              if (dynamicSources.getMemberOptions && accessorKey.startsWith('member_')) {
                options = dynamicSources.getMemberOptions(rowIndex, accessorKey, tableData);
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
                colIndex={colIndex}
                columnKey={accessorKey}
                updateCellData={updateCellData}
                rowData={row.original}
                allTableData={tableData}
                filterFunction={dropdownFilters?.[accessorKey]}
                invalidCells={invalidCells}
                setInvalidCells={setInvalidCells}
                theme={theme}
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
        filterFn: 'advancedFilter',

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
    data: editableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: useServerSideFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: hasActiveClientFilters ? getPaginationRowModel() : undefined,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnSizing,
      ...(hasActiveClientFilters && { pagination }),
    },
    onColumnSizingChange: (updater) => {
      console.log('🔧 Column sizing changed:', updater);
      setColumnSizing(updater);
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    ...(hasActiveClientFilters && { onPaginationChange: setPagination }),
    enableRowSelection: true,
    // Custom filter function for advanced filters
    filterFns: {
      advancedFilter: (row, columnId, filterValue) => {
        // If no active filters for this column, show all rows
        if (!activeFilters[columnId] || !activeFilters[columnId].active) {
          return true;
        }

        const filter = activeFilters[columnId];
        const cellValue = row.getValue(columnId);

        if (filter.type === 'items') {
          const stringValue = cellValue === null || cellValue === undefined ? '' : String(cellValue);
          return filter.selectedItems.includes(stringValue);
        } else {
          // Handle text filters
          const stringValue = cellValue === null || cellValue === undefined ? '' : String(cellValue).toLowerCase();
          const filterString = String(filter.value || '').toLowerCase();

          switch (filter.type) {
            case 'contains':
              return stringValue.includes(filterString);
            case 'not_contains':
              return !stringValue.includes(filterString);
            case 'starts_with':
              return stringValue.startsWith(filterString);
            case 'ends_with':
              return stringValue.endsWith(filterString);
            case 'equals':
              return stringValue === filterString;
            case 'not_equals':
              return stringValue !== filterString;
            case 'is_empty':
              return stringValue === '';
            case 'is_not_empty':
              return stringValue !== '';
            default:
              return true;
          }
        }
      }
    }
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

  // Context menu handlers
  const handleCellRightClick = useCallback((rowIndex, colIndex, event) => {
    event.preventDefault();
    const cellKey = `${rowIndex}-${colIndex}`;

    // If right-clicking on an unselected cell, select it
    if (!selectedCells.has(cellKey)) {
      setSelectedCells(new Set([cellKey]));
      setCurrentCell({ row: rowIndex, col: colIndex });
    }

    // Show context menu at mouse position
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      cellKey: cellKey
    });
  }, [selectedCells]);

  const hideContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, cellKey: null });
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => hideContextMenu();
    const handleEscape = (e) => {
      if (e.key === 'Escape') hideContextMenu();
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu.visible, hideContextMenu]);

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

    // Focus the cell after state update
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-cell-key="${cellKey}"]`);
      if (cellElement) {
        const focusableElement = cellElement.querySelector('[tabindex="0"]') || cellElement;
        if (focusableElement && focusableElement !== document.activeElement) {
          focusableElement.focus();
        }
      }
    }, 0);

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
    console.log('🔽 Fill Down: Starting with selectedCells:', selectedCells.size);

    if (selectedCells.size <= 1) {
      console.log('⚠️ Fill Down: Not enough cells selected (need > 1)');
      return;
    }

    const cellKeys = Array.from(selectedCells).sort();

    // Group cells by column
    const cellsByColumn = {};
    cellKeys.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      if (!cellsByColumn[colIndex]) {
        cellsByColumn[colIndex] = [];
      }
      cellsByColumn[colIndex].push({ rowIndex, colIndex, cellKey });
    });

    console.log(`🔽 Fill Down: Processing ${Object.keys(cellsByColumn).length} columns`);

    // Update the actual data
    setEditableData(currentData => {
      const newData = [...currentData];
      let totalSkipped = 0;

      // Process each column independently
      Object.keys(cellsByColumn).forEach(colIndex => {
        const colCells = cellsByColumn[colIndex].sort((a, b) => a.rowIndex - b.rowIndex);
        if (colCells.length <= 1) return; // Need at least 2 cells in this column

        const firstCell = colCells[0];
        const firstRowIndex = firstCell.rowIndex;
        const columnKey = columnDefs[colIndex]?.accessorKey;

        console.log(`🔽 Fill Down Column ${colIndex} (${columnKey}): ${colCells.length} cells`);

        // Get source value from the first row in this column
        const sourceValue = getNestedValue(newData[firstRowIndex], columnKey);

        if (sourceValue === undefined || sourceValue === null) {
          console.log(`⚠️ Column ${colIndex}: Source value is null/undefined, skipping column`);
          return;
        }

        console.log(`🔽 Column ${colIndex}: Copying "${sourceValue}" to ${colCells.length - 1} cells`);

        // Get filter function and dropdown options for this column
        const filterFunction = dropdownFilters?.[columnKey];
        const dropdownOptions = dropdownSources?.[columnKey];
        let skippedInColumn = 0;

        // Fill all cells in this column except the first one
        colCells.slice(1).forEach(cell => {
          const rowIndex = cell.rowIndex;

          if (!newData[rowIndex]) {
            console.log(`  ⚠️ Row ${rowIndex} doesn't exist`);
            return;
          }

          // If this column has a filter function, validate the value is allowed for this row
          if (filterFunction && dropdownOptions && Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
            const availableOptions = filterFunction(dropdownOptions, newData[rowIndex], columnKey);

            if (Array.isArray(availableOptions) && availableOptions.length > 0) {
              const isValidOption = availableOptions.some(opt =>
                (typeof opt === 'string' ? opt : (opt.name || opt.label)) === sourceValue
              );

              if (!isValidOption) {
                console.log(`⚠️ Skipping [${rowIndex}, ${colIndex}]: "${sourceValue}" not valid for this row`);
                skippedInColumn++;
                return;
              }
            }
          }

          // Use helper to set nested values properly
          setNestedValue(newData[rowIndex], columnKey, sourceValue);
        });

        if (skippedInColumn > 0) {
          console.log(`⚠️ Column ${colIndex}: Skipped ${skippedInColumn} cells due to filter validation`);
          totalSkipped += skippedInColumn;
        }
      });

      if (totalSkipped > 0) {
        console.log(`⚠️ Total skipped: ${totalSkipped} cells`);
      }

      console.log('🔽 Fill Down: Complete, returning newData with', newData.length, 'rows');
      return newData;
    });

    setHasChanges(true);
    console.log('🔽 Fill Down: Done, hasChanges set to true');
  }, [selectedCells, columnDefs, dropdownFilters, dropdownSources, getNestedValue, setNestedValue]);

  // Fill right operation
  const fillRight = useCallback(() => {
    if (selectedCells.size <= 1) return;

    const cellKeys = Array.from(selectedCells).sort();
    const firstCellKey = cellKeys[0];
    const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);

    // Update the actual data
    setEditableData(currentData => {
      const newData = [...currentData];

      // Get source value from editableData using nested accessor if needed
      const firstColumnKey = columnDefs[firstColIndex]?.accessorKey;
      const sourceValue = getNestedValue(newData[firstRowIndex], firstColumnKey);

      if (sourceValue === undefined || sourceValue === null) return currentData;

      console.log(`➡️ Fill Right: Copying "${sourceValue}" to ${selectedCells.size - 1} cells`);

      let skippedCells = 0;

      // Fill all selected cells except the first one with the source value
      cellKeys.slice(1).forEach(cellKey => {
        const [rowIndex, colIndex] = cellKey.split('-').map(Number);
        const columnKey = columnDefs[colIndex]?.accessorKey;
        if (!newData[rowIndex] || !columnKey) return;

        // Get filter function for this column if it exists
        const filterFunction = dropdownFilters?.[columnKey];
        const dropdownOptions = dropdownSources?.[columnKey];

        // If this column has a filter function, validate the value is allowed for this row
        // Only apply validation if we have both a filter function AND dropdown options
        if (filterFunction && dropdownOptions && Array.isArray(dropdownOptions) && dropdownOptions.length > 0) {
          const availableOptions = filterFunction(dropdownOptions, newData[rowIndex], columnKey);

          // Only validate if the filter function actually returned filtered results
          if (Array.isArray(availableOptions) && availableOptions.length > 0) {
            const isValidOption = availableOptions.some(opt =>
              (typeof opt === 'string' ? opt : (opt.name || opt.label)) === sourceValue
            );

            if (!isValidOption) {
              console.log(`⚠️ Skipping cell [${rowIndex}, ${colIndex}]: "${sourceValue}" not valid for this row's context. Available options:`, availableOptions.slice(0, 5));
              skippedCells++;
              return;
            }
          }
        }

        // Use helper to set nested values properly
        setNestedValue(newData[rowIndex], columnKey, sourceValue);
      });

      if (skippedCells > 0) {
        console.log(`⚠️ Skipped ${skippedCells} cells due to filter validation`);
      }

      return newData;
    });

    setHasChanges(true);
  }, [selectedCells, columnDefs, dropdownFilters, dropdownSources]);

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
          // Use getNestedValue to handle both flat and nested properties
          const value = getNestedValue(currentTableData[rowIndex], columnKey);

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
  }, [selectedCells, currentTableData, columnDefs, getNestedValue]);

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

      // Excel-like behavior: if multiple cells are selected and paste data is smaller, repeat the pattern
      let targetEndRow, targetEndCol;

      if (selectedCells.size > 1) {
        // Get the selection bounds
        const cellArray = Array.from(selectedCells);
        const rowIndices = cellArray.map(key => parseInt(key.split('-')[0]));
        const colIndices = cellArray.map(key => parseInt(key.split('-')[1]));
        const selectionStartRow = Math.min(...rowIndices);
        const selectionEndRow = Math.max(...rowIndices);
        const selectionStartCol = Math.min(...colIndices);
        const selectionEndCol = Math.max(...colIndices);

        // Use selection bounds instead of paste data size
        targetEndRow = selectionEndRow;
        targetEndCol = selectionEndCol;

        console.log(`📋 Paste with repeat: selection [${selectionStartRow}-${selectionEndRow}, ${selectionStartCol}-${selectionEndCol}], data size [${pasteRowCount}x${pasteColCount}]`);
      } else {
        // Standard paste: use paste data dimensions
        targetEndRow = targetStartRow + pasteRowCount - 1;
        targetEndCol = targetStartCol + pasteColCount - 1;
        console.log(`📋 Standard paste: [${targetStartRow}-${targetEndRow}, ${targetStartCol}-${targetEndCol}]`);
      }

      // Auto-extend table rows if needed
      const currentRowCount = editableData.length;
      const neededRows = Math.max(0, (targetEndRow + 1) - currentRowCount);

      if (neededRows > 0) {
        console.log(`➕ Auto-extending table with ${neededRows} new rows`);
        const newRows = Array.from({ length: neededRows }, () => ({
          ...newRowTemplate,
          id: null  // Use null for new rows like original FabricTable
        }));

        // Update the data immediately to include new rows
        setEditableData(prev => [...prev, ...newRows]);
      }

      // Apply paste data with proper data type conversion and validation
      const newInvalidCells = new Set();

      setEditableData(currentData => {
        const newData = [...currentData];

        // Iterate over the target area (which may be larger than paste data if repeating)
        for (let targetRowIndex = targetStartRow; targetRowIndex <= targetEndRow && targetRowIndex < newData.length; targetRowIndex++) {
          for (let targetColIndex = targetStartCol; targetColIndex <= targetEndCol && targetColIndex < columnDefs.length; targetColIndex++) {
            // Calculate which cell from paste data to use (with modulo for repeating)
            const rowOffset = (targetRowIndex - targetStartRow) % pasteRowCount;
            const colOffset = (targetColIndex - targetStartCol) % pasteColCount;
            const rowData = pasteData[rowOffset];
            const cellValue = rowData?.[colOffset] || '';

            const columnKey = columnDefs[targetColIndex]?.accessorKey;
            const columnDef = columnDefs[targetColIndex];

            if (columnKey && newData[targetRowIndex]) {
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

                // Validate dropdown values
                const cellKey = `${targetRowIndex}-${targetColIndex}`;
                if (columnDef?.type === 'dropdown' && dropdownSources?.[columnKey]) {
                  const options = dropdownSources[columnKey];
                  const isValidOption = options.some(opt =>
                    (typeof opt === 'string' ? opt : (opt.name || opt.label)) === convertedValue
                  );

                  if (!isValidOption && convertedValue && convertedValue.trim() !== '') {
                    console.warn(`⚠️ Invalid dropdown value "${convertedValue}" for ${columnKey} at [${targetRowIndex}, ${targetColIndex}]`);
                    newInvalidCells.add(cellKey);
                  }
                }

              // Use nested property setter if needed
              if (columnKey.includes('.')) {
                setNestedValue(newData[targetRowIndex], columnKey, convertedValue);
                console.log(`📝 Pasted "${cellValue}" → nested "${convertedValue}" to [${targetRowIndex}, ${targetColIndex}] (${columnKey})`);
              } else {
                newData[targetRowIndex] = {
                  ...newData[targetRowIndex],
                  [columnKey]: convertedValue
                };
                console.log(`📝 Pasted "${cellValue}" → "${convertedValue}" to [${targetRowIndex}, ${targetColIndex}] (${columnKey})`);
              }
            }
          }
        }

        return newData;
      });

      // Update invalid cells state
      setInvalidCells(newInvalidCells);

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

      // Show success feedback with warning if invalid cells detected
      if (newInvalidCells.size > 0) {
        setFillPreview({
          operation: 'Pasted (with warnings)',
          sourceValue: `${pasteRowCount} rows × ${pasteColCount} columns, ${newInvalidCells.size} invalid dropdown value(s)`,
          count: pasteRowCount * pasteColCount,
          isWarning: true
        });
        setTimeout(() => setFillPreview(null), 4000);
      } else {
        setFillPreview({
          operation: 'Pasted',
          sourceValue: `${pasteRowCount} rows × ${pasteColCount} columns`,
          count: pasteRowCount * pasteColCount
        });
        setTimeout(() => setFillPreview(null), 2000);
      }

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

  // Clear cell contents (set to empty string)
  const clearCellContents = useCallback(() => {
    if (selectedCells.size === 0) {
      console.log('⚠️ No cells selected to clear');
      return;
    }

    console.log(`🗑️ Clearing contents of ${selectedCells.size} cells`);

    setEditableData(currentData => {
      const newData = [...currentData];

      selectedCells.forEach(cellKey => {
        const [rowIndex, colIndex] = cellKey.split('-').map(Number);
        const columnKey = columnDefs[colIndex]?.accessorKey;

        if (columnKey && newData[rowIndex]) {
          // Check if this is a nested property (contains a dot)
          if (columnKey.includes('.')) {
            setNestedValue(newData[rowIndex], columnKey, '');
            console.log(`  🗑️ Cleared nested ${columnKey} for row ${rowIndex}`);
          } else {
            newData[rowIndex][columnKey] = '';
            console.log(`  🗑️ Cleared ${columnKey} for row ${rowIndex}`);
          }
        }
      });

      return newData;
    });

    setHasChanges(true);
    console.log('✅ Cell contents cleared');
  }, [selectedCells, columnDefs, setNestedValue]);

  // Context menu action handlers
  const handleContextMenuAction = useCallback((action) => {
    hideContextMenu();

    switch (action) {
      case 'copy':
        handleCopy();
        break;
      case 'paste':
        handlePaste();
        break;
      case 'clear':
        clearCellContents();
        break;
      case 'delete':
        deleteSelectedRows();
        break;
      case 'fillDown':
        fillDown();
        break;
      case 'fillRight':
        fillRight();
        break;
      default:
        console.warn('Unknown context menu action:', action);
    }
  }, [hideContextMenu, handleCopy, handlePaste, clearCellContents, deleteSelectedRows, fillDown, fillRight]);

  // Enhanced keyboard shortcuts and navigation
  const handleKeyDown = useCallback((e) => {
    const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // Don't interfere with input fields unless it's navigation keys or keyboard shortcuts
    if (isInputFocused && !['Tab', 'Escape', 'Enter'].includes(e.key) && !(e.ctrlKey || e.metaKey)) {
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

        default:
          // Check if it's a printable character and current cell is a dropdown
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const currentColumnConfig = columnDefs[currentCell.col];
            const isDropdownCell = currentColumnConfig?.id?.includes('member_') ||
                                   columns[currentCell.col]?.type === 'dropdown';

            if (isDropdownCell) {
              e.preventDefault();
              // Focus the dropdown and trigger it with the typed character
              const cellKey = `${currentCell.row}-${currentCell.col}`;
              const cellElement = document.querySelector(`[data-cell-key="${cellKey}"]`);
              if (cellElement) {
                const dropdownTrigger = cellElement.querySelector('[tabindex="0"]');
                if (dropdownTrigger) {
                  dropdownTrigger.focus();
                  // Dispatch the keydown event to the dropdown trigger
                  const keyEvent = new KeyboardEvent('keydown', {
                    key: e.key,
                    code: e.code,
                    keyCode: e.keyCode,
                    which: e.which,
                    bubbles: true
                  });
                  dropdownTrigger.dispatchEvent(keyEvent);
                }
              }
            }
          }
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: 'var(--table-pagination-text)',
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: i === currentPage ? 'var(--table-pagination-button-active)' : 'var(--table-pagination-button-bg)',
              color: i === currentPage ? 'var(--content-bg)' : 'var(--table-pagination-text)',
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: 'var(--table-pagination-text)',
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
        backgroundColor: 'var(--table-pagination-bg)',
        borderTop: '1px solid var(--table-pagination-border)',
        color: 'var(--table-pagination-text)',
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
                border: '1px solid var(--table-pagination-button-border)',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'var(--table-pagination-button-bg)',
                color: 'var(--table-pagination-text)',
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: currentPage === 1 || isLoading ? 'var(--muted-text)' : 'var(--table-pagination-text)',
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: currentPage === 1 || isLoading ? 'var(--muted-text)' : 'var(--table-pagination-text)',
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: currentPage === totalPages || isLoading ? 'var(--muted-text)' : 'var(--table-pagination-text)',
              opacity: currentPage === totalPages || isLoading ? 0.5 : 1,
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
              border: '1px solid var(--table-pagination-button-border)',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: currentPage === totalPages || isLoading ? 'var(--muted-text)' : 'var(--table-pagination-text)',
              opacity: currentPage === totalPages || isLoading ? 0.5 : 1,
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
    setTableData: (data) => {
      setEditableData(data);
      setHasChanges(true);
    },
    getSorting: () => sorting,
    setSorting: (sortState) => setSorting(sortState),
    hasChanges,
    autoSizeColumns,
  }));

  return (
    <div className={`tanstack-crud-table-container theme-${theme}`} style={{
      height,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--table-bg)',
      border: '1px solid var(--table-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-light)',
      color: 'var(--table-cell-text)'
    }}>
      {/* Top Filter & Search Toolbar */}
      <div className="filter-search-toolbar" style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--table-toolbar-border)',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: 'var(--table-toolbar-bg)',
        minHeight: '60px',
        color: 'var(--table-toolbar-text)'
      }}>
        {/* Enhanced Search */}
        <div style={{ position: 'relative', minWidth: '300px', flex: '1 1 300px', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="🔍 Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px 10px 16px',
              border: '1px solid var(--form-input-border)',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              backgroundColor: 'var(--form-input-bg)',
              color: 'var(--form-input-text)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--form-input-focus-border)';
              e.target.style.boxShadow = '0 0 0 2px var(--form-input-focus-shadow)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--form-input-border)';
              e.target.style.boxShadow = 'none';
            }}
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted-text)',
                borderRadius: '4px',
                transition: 'background-color 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--table-row-hover)';
                e.target.style.color = 'var(--primary-text)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = 'var(--muted-text)';
              }}
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </button>
          )}
        </div>

        {/* Advanced Filter Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggleFilterDropdown()}
            style={{
              padding: '10px 18px',
              backgroundColor: Object.keys(activeFilters).length > 0
                ? 'var(--table-pagination-button-active)'
                : 'var(--table-pagination-button-bg)',
              color: Object.keys(activeFilters).length > 0
                ? 'var(--content-bg)'
                : 'var(--table-toolbar-text)',
              border: '1px solid var(--table-pagination-button-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔽 Advanced Filters
            {Object.keys(activeFilters).filter(key => activeFilters[key].active).length > 0 && (
              <span style={{
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {Object.keys(activeFilters).filter(key => activeFilters[key].active).length}
              </span>
            )}
          </button>

          {/* Filter Dropdown */}
          <FilterDropdown
            columns={columnDefs.map(col => ({
              id: col.accessorKey || col.id,
              header: col.header
            }))}
            data={allData.length > 0 ? allData : editableData}
            activeFilters={activeFilters}
            onFiltersChange={handleFiltersChange}
            isOpen={showFilterDropdown}
            onToggle={toggleFilterDropdown}
            className="advanced-filter-dropdown"
          />
        </div>

        {/* Spacer to push stats to the right */}
        <div style={{ flex: '1' }}></div>

        {/* Stats Container */}
        <StatsContainer
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          displayedRows={hasActiveClientFilters ?
            table.getRowModel().rows.length : // Use TanStack Table's filtered/paginated count
            editableData.length  // Use server-provided count for normal pagination
          }
          selectedCellsCount={(() => {
            // Calculate unique row count from selected cells
            const rowIndices = new Set();
            selectedCells.forEach(cellKey => {
              const [rowIndex] = cellKey.split('-').map(Number);
              rowIndices.add(rowIndex);
            });
            return rowIndices.size;
          })()}
          hasActiveFilters={Object.keys(activeFilters).filter(key => activeFilters[key].active).length > 0}
          hasUnsavedChanges={hasChanges}
          globalFilter={globalFilter}
          isPaginated={totalPages > 1}
        />
      </div>

      {/* Active Filters Display */}
      {Object.keys(activeFilters).filter(key => activeFilters[key].active).length > 0 && (
        <div style={{
          padding: '8px 20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--table-row-selected)',
          fontSize: '13px'
        }}>
          <span style={{ color: 'var(--link-text)', fontWeight: '500' }}>Active Filters:</span>
          {getFilterSummary(activeFilters, columnDefs).map((filter) => (
            <span
              key={filter.columnId}
              style={{
                backgroundColor: 'var(--link-text)',
                color: 'var(--content-bg)',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {filter.columnName}: {filter.summary}
              <button
                onClick={() => {
                  const newFilters = { ...activeFilters };
                  delete newFilters[filter.columnId];
                  handleFiltersChange(newFilters);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0',
                  marginLeft: '4px',
                  fontSize: '14px',
                  lineHeight: '1'
                }}
                title="Remove filter"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            style={{
              background: 'none',
              border: '1px solid var(--link-text)',
              color: 'var(--link-text)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
            title="Clear all filters"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Table Action Controls */}
      <div className="table-controls" style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--table-toolbar-border)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: 'var(--table-toolbar-bg)',
        color: 'var(--table-toolbar-text)',
        minHeight: '64px'
      }}>
        {/* Save Button */}
        <button
          onClick={saveChanges}
          disabled={!hasChanges || isLoading}
          style={{
            padding: '10px 18px',
            backgroundColor: hasChanges && !isLoading
              ? 'var(--table-pagination-button-active)'
              : 'var(--table-pagination-button-bg)',
            color: hasChanges && !isLoading
              ? 'var(--content-bg)'
              : 'var(--table-toolbar-text)',
            border: '1px solid var(--table-pagination-button-border)',
            borderRadius: '6px',
            cursor: hasChanges && !isLoading ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isLoading ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>

        {/* Action Buttons */}
        {/* Conditional rendering for Add Actions */}
        {customAddActions ? (
          <div className="dropdown">
            <button
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{
                padding: '10px 18px',
                backgroundColor: 'var(--table-pagination-button-bg)',
                color: 'var(--table-toolbar-text)',
                border: '1px solid var(--table-pagination-button-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {customAddActions.dropdownLabel || "Add Item"}
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
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: 'var(--table-toolbar-text)',
              border: '1px solid var(--table-pagination-button-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Add Row
          </button>
        )}

{/* Auto-size columns button */}
        <button
          onClick={autoSizeColumns}
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--table-pagination-button-bg)',
            color: 'var(--table-toolbar-text)',
            border: '1px solid var(--table-pagination-button-border)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Auto-size all columns to fit content"
        >
          Auto-size Columns
        </button>

        {/* Status indicator and shortcuts */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {selectedCells.size > 0 && (
            <div style={{
              padding: '6px 12px',
              backgroundColor: 'var(--table-row-selected)',
              border: '1px solid var(--link-text)',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--link-text)',
              fontWeight: '500'
            }}>
              {selectedCells.size} cell{selectedCells.size > 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      </div>

      {/* Professional Table */}
      <div
        className="table-wrapper"
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'var(--table-bg)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
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
          tableLayout: 'fixed',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  // Get column group for styling
                  const columnIndex = header.column.getIndex();
                  const columnConfig = columns[columnIndex];
                  const columnGroup = columnConfig?.columnGroup;
                  const isNameColumn = header.id === 'name' || columnConfig?.data === 'name';

                  // Define solid background colors for column groups (no transparency)
                  let headerBg = 'var(--table-header-bg)';
                  if (columnGroup === 'target') {
                    // Blue tint - solid color
                    headerBg = theme === 'dark' ? '#232f3e' : '#e1effe';
                  } else if (columnGroup === 'initiator') {
                    // Green tint - solid color
                    headerBg = theme === 'dark' ? '#243230' : '#dcfce7';
                  } else if (columnGroup === 'allAccess') {
                    // Purple tint - solid color
                    headerBg = theme === 'dark' ? '#2f2a38' : '#f3e8ff';
                  }

                  return (
                    <th
                      key={header.id}
                      style={{
                        padding: '14px 12px',
                        textAlign: 'left',
                        borderBottom: '2px solid var(--table-border)',
                        borderRight: '1px solid var(--table-border)',
                        backgroundColor: headerBg,
                        height: '50px', // Consistent header height
                        minHeight: '50px',
                        width: header.getSize(),
                        fontWeight: '600',
                        fontSize: '13px',
                        color: 'var(--table-header-text)',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        position: 'sticky',
                        top: 0,
                        left: isNameColumn ? 0 : undefined,
                        zIndex: isNameColumn ? 20 : 10,
                        userSelect: 'none',
                        transition: 'background-color 0.2s',
                        boxShadow: isNameColumn ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span style={{
                          color: header.column.getIsSorted() ? 'var(--link-text)' : 'var(--muted-text)',
                          fontSize: '12px'
                        }}>
                          {header.column.getIsSorted() === 'desc' ? '↓' :
                           header.column.getIsSorted() === 'asc' ? '↑' : '↕'}
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
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: header.column.getIsResizing() ? '3px' : '5px',
                          background: header.column.getIsResizing() ? 'var(--link-text)' : 'var(--table-border)',
                          cursor: 'col-resize',
                          userSelect: 'none',
                          touchAction: 'none',
                          opacity: header.column.getIsResizing() ? 1 : 0,
                          transition: 'opacity 0.2s',
                          boxShadow: header.column.getIsResizing() ? '0 0 0 1px var(--link-text)' : 'none',
                          zIndex: header.column.getIsResizing() ? 1000 : 10
                        }}
                      />
                    )}
                  </th>
                  );
                })}
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
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const rowIndex = row.index;
                  const colIndex = cellIndex;
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const isSelected = selectedCells.has(cellKey);
                  const isInvalid = invalidCells.has(cellKey);

                  // Get column group for styling
                  const columnConfig = columns[colIndex];
                  const columnGroup = columnConfig?.columnGroup;
                  const isNameColumn = cell.column.id === 'name' || columnConfig?.data === 'name';
                  const rowData = row.original;
                  const isSavedRow = rowData && rowData.id != null;

                  // Define solid background colors for column groups (no transparency)
                  let cellBg = 'transparent';
                  if (!isSelected && !isInvalid) {
                    if (isNameColumn) {
                      // Name column gets solid background to prevent transparency when scrolling
                      cellBg = 'var(--table-bg)';
                    } else if (columnGroup === 'target') {
                      // Blue tint - solid color, lighter than header
                      cellBg = theme === 'dark' ? '#1a2632' : '#eff6ff';
                    } else if (columnGroup === 'initiator') {
                      // Green tint - solid color, lighter than header
                      cellBg = theme === 'dark' ? '#1c2a27' : '#f0fdf4';
                    } else if (columnGroup === 'allAccess') {
                      // Purple tint - solid color, lighter than header
                      cellBg = theme === 'dark' ? '#25222e' : '#faf5ff';
                    }
                  }

                  return (
                    <td
                      key={cell.id}
                      data-cell-key={cellKey}
                      style={{
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--table-border)',
                        borderRight: '1px solid var(--table-border)',
                        width: cell.column.getSize(),
                        backgroundColor: isInvalid ? '#ffebee' : (isSelected ? 'var(--table-row-selected)' : cellBg),
                        cursor: 'cell',
                        position: isNameColumn ? 'sticky' : 'relative',
                        left: isNameColumn ? 0 : undefined,
                        zIndex: isNameColumn ? 15 : 1,
                        transition: 'background-color 0.15s, border-color 0.15s',
                        outline: isSelected ? '2px solid var(--link-text)' : (isInvalid ? '2px solid #ef5350' : 'none'),
                        outlineOffset: '-2px',
                        minHeight: '20px',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        fontWeight: isNameColumn && isSavedRow ? '600' : 'normal',
                        boxShadow: isNameColumn ? '2px 0 4px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                      onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                      onContextMenu={(e) => handleCellRightClick(rowIndex, colIndex, e)}
                      title={isInvalid ? 'Invalid dropdown value' : undefined}
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
          backgroundColor: fillPreview.isWarning ? '#f57c00' : '#333',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px',
          zIndex: 1001,
          fontSize: '14px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{fillPreview.operation}</div>
          <div style={{ fontSize: '13px' }}>{fillPreview.sourceValue}</div>
        </div>
      )}

      {/* Floating Navigation Panel */}
      {showFloatingNav && (
        <div style={{
          position: 'absolute',
          bottom: '60px', // Position above the footer
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          zIndex: 1000,
          opacity: showFloatingNav ? 0.9 : 0,
          transform: showFloatingNav ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          pointerEvents: showFloatingNav ? 'auto' : 'none'
        }}
        >
        {/* Auto-size Columns Button */}
        <button
          onClick={autoSizeColumns}
          title="Auto-size Columns"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--table-pagination-button-bg)',
            color: 'var(--table-pagination-text)',
            border: '1px solid var(--table-pagination-button-border)',
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
        >
          ⤢
        </button>

        {/* Top Arrow */}
        <button
          onClick={scrollToTop}
          title="Scroll to Top"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--table-pagination-button-bg)',
            color: 'var(--table-pagination-text)',
            border: '1px solid var(--table-pagination-button-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'background-color 0.2s'
          }}
        >
          ↑
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
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: 'var(--table-pagination-text)',
              border: '1px solid var(--table-pagination-button-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s'
            }}
          >
            ←
          </button>

          {/* Right Arrow */}
          <button
            onClick={scrollToRight}
            title="Scroll to Right"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--table-pagination-button-bg)',
              color: 'var(--table-pagination-text)',
              border: '1px solid var(--table-pagination-button-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s'
            }}
          >
            →
          </button>
        </div>

        {/* Bottom Arrow */}
        <button
          onClick={scrollToBottom}
          title="Scroll to Bottom"
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--table-pagination-button-bg)',
            color: 'var(--table-pagination-text)',
            border: '1px solid var(--table-pagination-button-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'background-color 0.2s'
          }}
        >
          ↓
        </button>
      </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--table-bg)',
            border: '1px solid var(--table-border)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10001,
            minWidth: '150px',
            padding: '4px 0',
            fontSize: '14px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--primary-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => handleContextMenuAction('copy')}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--table-row-hover)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Copy
          </div>
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--primary-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => handleContextMenuAction('paste')}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--table-row-hover)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Paste
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--table-border)', margin: '4px 0' }} />
          <div
            style={{
              padding: '8px 16px',
              cursor: selectedCells.size > 1 ? 'pointer' : 'not-allowed',
              backgroundColor: 'transparent',
              color: selectedCells.size > 1 ? 'var(--primary-text)' : 'var(--muted-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => selectedCells.size > 1 && handleContextMenuAction('fillDown')}
            onMouseEnter={(e) => {
              if (selectedCells.size > 1) {
                e.target.style.backgroundColor = 'var(--table-row-hover)';
              }
            }}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Fill Down
          </div>
          <div
            style={{
              padding: '8px 16px',
              cursor: selectedCells.size > 1 ? 'pointer' : 'not-allowed',
              backgroundColor: 'transparent',
              color: selectedCells.size > 1 ? 'var(--primary-text)' : 'var(--muted-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => selectedCells.size > 1 && handleContextMenuAction('fillRight')}
            onMouseEnter={(e) => {
              if (selectedCells.size > 1) {
                e.target.style.backgroundColor = 'var(--table-row-hover)';
              }
            }}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Fill Right
          </div>
          <div
            style={{
              padding: '8px 16px',
              cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
              backgroundColor: 'transparent',
              color: selectedCells.size > 0 ? 'var(--primary-text)' : 'var(--muted-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => selectedCells.size > 0 && handleContextMenuAction('clear')}
            onMouseEnter={(e) => {
              if (selectedCells.size > 0) {
                e.target.style.backgroundColor = 'var(--table-row-hover)';
              }
            }}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Clear Cell Contents
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--table-border)', margin: '4px 0' }} />
          <div
            style={{
              padding: '8px 16px',
              cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
              backgroundColor: 'transparent',
              color: selectedCells.size > 0 ? 'var(--error-color)' : 'var(--muted-text)',
              transition: 'background-color 0.2s'
            }}
            onClick={() => selectedCells.size > 0 && handleContextMenuAction('delete')}
            onMouseEnter={(e) => {
              if (selectedCells.size > 0) {
                e.target.style.backgroundColor = 'var(--table-row-hover)';
              }
            }}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Delete Selected Rows
          </div>
        </div>
      )}

      {/* Floating resize line that follows cursor during drag */}
      {resizeState.isResizing && (
        <div
          style={{
            position: 'fixed',
            left: resizeState.currentX,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: 'var(--link-text)',
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 0 0 1px var(--link-text)'
          }}
        />
      )}
    </div>
  );
});

// Enhanced Cell Components

// Enhanced searchable dropdown cell component
const VendorDropdownCell = ({ value, options = [], rowIndex, colIndex, columnKey, updateCellData, rowData, allTableData, filterFunction, invalidCells, setInvalidCells, theme = 'dark' }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

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
    availableOptions = filterFunction(options, rowData, columnKey, allTableData);
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

    // Clear invalid state for this cell if it was marked invalid
    const cellKey = `${rowIndex}-${colIndex}`;
    if (invalidCells?.has(cellKey)) {
      setInvalidCells?.(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }

    setIsOpen(false);
    setSearchText('');
    setSelectedIndex(-1);

    // Return focus to the cell trigger so keyboard navigation works
    setTimeout(() => {
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    }, 0);

    console.log('✅ Dropdown closed after selection');
  };

  const handleClear = () => {
    console.log(`🗑️ Clearing ${columnKey} for row ${rowIndex}`);
    setLocalValue('');
    updateCellData(rowIndex, columnKey, '');

    // Clear invalid state for this cell when cleared
    const cellKey = `${rowIndex}-${colIndex}`;
    if (invalidCells?.has(cellKey)) {
      setInvalidCells?.(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }

    setIsOpen(false);
    setSearchText('');
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    // Handle delete/backspace when dropdown is closed
    if (!isOpen) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleClear();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
        return;
      }
      // Check if it's a printable character (letter, number, etc.)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        // Open dropdown and set the typed character as search text
        setIsOpen(true);
        setSearchText(e.key);
        setSelectedIndex(-1);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
          handleSelect(filteredOptions[selectedIndex]);
        } else if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0]);
        }
        break;
      case 'Tab':
        // Select the top value and let Tab continue to navigate
        e.preventDefault();
        if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
          handleSelect(filteredOptions[selectedIndex]);
        } else if (filteredOptions.length > 0) {
          handleSelect(filteredOptions[0]);
        } else {
          // No selection, just close dropdown and let tab through
          setIsOpen(false);
          setSearchText('');
          setSelectedIndex(-1);
        }
        // Let the Tab event bubble up after selection is complete
        // Don't call stopPropagation so the global handler can navigate
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setSearchText('');
        setSelectedIndex(-1);
        // Return focus to the cell trigger
        setTimeout(() => {
          if (triggerRef.current) {
            triggerRef.current.focus();
          }
        }, 0);
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

      // Calculate optimal width based on longest option text
      let optimalWidth = rect.width;
      if (filteredOptions && filteredOptions.length > 0) {
        // Estimate width based on longest option text
        // Using approximate character width of 8px + padding
        const longestOption = filteredOptions.reduce((longest, option) => {
          const text = typeof option === 'string' ? option : (option.name || option.label || '');
          return text.length > longest.length ? text : longest;
        }, '');
        optimalWidth = Math.max(rect.width, longestOption.length * 8 + 24); // 24px for padding
      }

      const style = {
        position: 'fixed',
        left: Math.max(0, rect.left),
        width: Math.max(100, Math.min(optimalWidth, 500)), // Min 100px, max 500px
        zIndex: 99999,
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
        zIndex: 99999,
        maxHeight: '200px'
      };
    }
  };

  const handleFocus = () => {
    // Update the current cell in the table when this dropdown receives focus
    const cellKey = `${rowIndex}-${colIndex}`;
    // This will be handled by the table's cell click handler, so we don't need to do anything here
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        ref={triggerRef}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        tabIndex={0}
        style={{
          padding: '6px 10px',
          border: 'none',
          cursor: 'default',
          backgroundColor: 'transparent',
          color: 'var(--table-cell-text)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          transition: 'all 0.2s',
          minHeight: '32px',
          outline: 'none'
        }}
      >
        <span style={{
          color: localValue ? 'var(--table-cell-text)' : 'var(--muted-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          {localValue || ''}
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{
            color: 'var(--muted-text)',
            marginLeft: '8px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            cursor: 'pointer',
            padding: '4px 8px',
            margin: '-4px -8px -4px 0',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >▽</span>
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...getDropdownStyle(),
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            border: theme === 'dark' ? '2px solid #64ffda' : '2px solid #334155',
            borderRadius: '8px',
            boxShadow: theme === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(15, 23, 42, 0.2)',
            overflow: 'hidden'
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="🔍 Type to filter..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSelectedIndex(-1); // Reset selection when filtering
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderBottom: theme === 'dark' ? '1px solid #4a5568' : '1px solid #cbd5e1',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: theme === 'dark' ? '#2d3748' : '#ffffff',
              color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
              boxSizing: 'border-box'
            }}
          />
          <div style={{
            maxHeight: '150px',
            overflow: 'auto',
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
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
                    borderBottom: index < filteredOptions.length - 1 ? (theme === 'dark' ? '1px solid #4a5568' : '1px solid #cbd5e1') : 'none',
                    fontSize: '14px',
                    transition: 'background-color 0.15s',
                    backgroundColor: isSelected
                      ? (theme === 'dark' ? '#2d4a4f' : '#f1f5f9')
                      : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                    color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
                    userSelect: 'none'
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
                fontStyle: 'italic',
                textAlign: 'center',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                color: theme === 'dark' ? '#a0aec0' : '#64748b'
              }}>
                No options found
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Checkbox header cell with check/uncheck all functionality
const CheckboxHeaderCell = ({ columnKey, headerName, editableData, setEditableData, setHasChanges, hasActiveClientFilters, table }) => {
  // Helper function to get nested value
  const getNestedValue = (obj, path) => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  };

  // Helper function to set nested value
  const setNestedValue = (obj, path, value) => {
    if (!path) return obj;
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
    return obj;
  };

  // Calculate if all visible rows are checked
  // Check if there are any active filters (column filters or global filter)
  const hasFilters = table && (
    (table.getState().columnFilters && table.getState().columnFilters.length > 0) ||
    (table.getState().globalFilter && table.getState().globalFilter.length > 0)
  );

  const visibleRows = hasFilters ? table.getRowModel().rows : null;
  const rowsToCheck = visibleRows ? visibleRows.map(r => r.original) : editableData;

  console.log('🔍 CheckboxHeader:', { hasActiveClientFilters, hasFilters, visibleRowCount: visibleRows?.length, totalRowCount: editableData.length });

  const allChecked = useMemo(() => {
    return rowsToCheck.length > 0 && rowsToCheck.every(row => {
      const value = getNestedValue(row, columnKey);
      return Boolean(value);
    });
  }, [rowsToCheck, columnKey]);

  const someChecked = useMemo(() => {
    return rowsToCheck.some(row => {
      const value = getNestedValue(row, columnKey);
      return Boolean(value);
    });
  }, [rowsToCheck, columnKey]);

  const handleCheckAll = (e) => {
    e.stopPropagation(); // Prevent sorting

    // Batch update all rows in a single state change
    setEditableData(currentData => {
      const newData = [...currentData];

      // Recalculate allChecked based on current data
      const currentRowsToCheck = hasFilters && visibleRows
        ? visibleRows.map(r => currentData[r.index]).filter(Boolean)
        : currentData;

      const currentAllChecked = currentRowsToCheck.length > 0 && currentRowsToCheck.every(row => {
        const value = getNestedValue(row, columnKey);
        return Boolean(value);
      });

      const newValue = !currentAllChecked;

      console.log('🔲 Check All:', { columnKey, hasFilters, currentAllChecked, newValue, rowCount: currentRowsToCheck.length, visibleRowCount: visibleRows?.length });

      if (hasFilters && visibleRows) {
        // Update only filtered rows
        visibleRows.forEach(row => {
          const rowIndex = row.index;
          if (newData[rowIndex]) {
            if (columnKey.includes('.')) {
              setNestedValue(newData[rowIndex], columnKey, newValue);
            } else {
              newData[rowIndex] = {
                ...newData[rowIndex],
                [columnKey]: newValue
              };
            }
          }
        });
      } else {
        // Update all rows across all pages
        newData.forEach((_, rowIndex) => {
          if (columnKey.includes('.')) {
            setNestedValue(newData[rowIndex], columnKey, newValue);
          } else {
            newData[rowIndex] = {
              ...newData[rowIndex],
              [columnKey]: newValue
            };
          }
        });
      }

      return newData;
    });

    setHasChanges(true);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input
        type="checkbox"
        className="header-checkbox"
        checked={allChecked}
        ref={input => {
          if (input) {
            input.indeterminate = !allChecked && someChecked;
          }
        }}
        onChange={handleCheckAll}
        onClick={(e) => e.stopPropagation()}
        style={{
          cursor: 'pointer',
          transform: 'scale(1.2)',
          margin: 0,
          accentColor: 'var(--link-text)'
        }}
      />
      <span>{headerName}</span>
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
>
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          style={{
            cursor: 'pointer',
            transform: 'scale(1.3)',
            margin: 0,
            accentColor: 'var(--link-text)'
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
  const [initialTypedChar, setInitialTypedChar] = useState('');
  const cellRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value || '');
    }
  }, [value, isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleClick = (e) => {
    // Focus the cell when clicked so keyboard events work
    // Use a small timeout to ensure focus is properly set
    e.preventDefault();
    setTimeout(() => {
      if (cellRef.current) {
        cellRef.current.focus();
      }
    }, 0);
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
      // After committing, focus back on the cell div for keyboard navigation
      setTimeout(() => {
        if (cellRef.current) {
          cellRef.current.focus();
        }
      }, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setLocalValue(value || '');
      setIsEditing(false);
      // Focus back on the cell div
      setTimeout(() => {
        if (cellRef.current) {
          cellRef.current.focus();
        }
      }, 0);
    }
  };

  const handleCellKeyDown = (e) => {
    // Check if it's a printable character (not a modifier or navigation key)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      // Start editing with the typed character
      setInitialTypedChar(e.key);
      setLocalValue(e.key);
      setIsEditing(true);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      // Enter or F2 also enters edit mode
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete/Backspace clears the cell
      e.preventDefault();
      e.stopPropagation();
      setLocalValue('');
      updateCellData(rowIndex, columnKey, '');
    }
  };

  const handleBlur = () => {
    commitValue();
  };

  const commitValue = () => {
    setIsEditing(false);
    setInitialTypedChar('');
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
        onKeyDown={handleEditKeyDown}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          border: '2px solid var(--link-text)',
          borderRadius: '4px',
          outline: 'none',
          padding: '6px 8px',
          backgroundColor: 'var(--form-input-bg)',
          color: 'var(--form-input-text)',
          fontSize: '14px',
          boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)'
        }}
      />
    );
  }

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleCellKeyDown}
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
        whiteSpace: 'nowrap',
        outline: 'none'
      }}
      title={String(localValue)}
    >
      {localValue || ''}
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
          border: '2px solid var(--link-text)',
          borderRadius: '4px',
          outline: 'none',
          padding: '6px 8px',
          backgroundColor: 'var(--form-input-bg)',
          color: 'var(--form-input-text)',
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
        backgroundColor: isRevealed ? 'var(--warning-color)' : 'var(--table-bg)',
        border: isRevealed ? '1px solid var(--warning-color)' : '1px solid transparent'
      }}
      title={isRevealed ? "Double-click to edit" : "Double-click to reveal"}
    >
      {displayValue || (
        <span style={{ color: 'var(--muted-text)', fontStyle: 'italic' }}>
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