import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { HotTable } from '@handsontable/react';
import { Modal } from "react-bootstrap";
import axios from "axios";
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import { useSettings } from '../../../context/SettingsContext';

// Import sub-components
import TableHeader from './components/TableHeader';
import StatusMessage from './components/StatusMessage';
import DeleteModal from './components/DeleteModal';
import NavigationModal from './components/NavigationModal';
import ScrollButtons from './components/ScrollButtons';
import { useTableColumns } from './hooks/useTableColumns';
import { useTableOperations } from './hooks/useTableOperations';
import { useServerPagination } from './hooks/useServerPagination';
import { createContextMenu } from './utils/contextMenu';
import CustomTableFilter from './components/CustomTableFilter';

// Custom CSS for better dropdown styling - using very specific selectors and high specificity
const dropdownStyles = `
  /* Use very high specificity to override Handsontable defaults */
  html body div.handsontableEditor.autocompleteEditor.htMacScroll.listbox.handsontable,
  html body .handsontableEditor.autocompleteEditor,
  html body .autocompleteEditor.handsontable {
    min-width: 280px !important;
    width: 280px !important;
    max-width: 400px !important;
  }
  
  /* Force row heights with extremely high specificity */
  html body div.handsontableEditor.autocompleteEditor div.ht_master div.wtHolder div.wtHider table.htCore tbody tr,
  html body .handsontableEditor.autocompleteEditor .ht_master .wtHolder table tbody tr,
  html body .autocompleteEditor.handsontable .ht_master table tbody tr {
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
  }
  
  /* Force cell heights and styling with maximum specificity */
  html body div.handsontableEditor.autocompleteEditor div.ht_master div.wtHolder div.wtHider table.htCore tbody tr td,
  html body .handsontableEditor.autocompleteEditor .ht_master .wtHolder table tbody tr td,
  html body .autocompleteEditor.handsontable .ht_master table tbody tr td {
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
    padding: 14px 18px !important;
    line-height: 16px !important;
    font-size: 14px !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    vertical-align: middle !important;
    min-width: 240px !important;
    width: 240px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  /* Hover effects with high specificity */
  html body div.handsontableEditor.autocompleteEditor div.ht_master div.wtHolder div.wtHider table.htCore tbody tr td:hover,
  html body .handsontableEditor.autocompleteEditor .ht_master .wtHolder table tbody tr td:hover,
  html body .autocompleteEditor.handsontable .ht_master table tbody tr td:hover {
    background-color: #e3f2fd !important;
  }
  
  /* For dropdown menus (member dropdowns) */
  html body .handsontable .htDropdownMenu {
    min-width: 280px !important;
    max-width: 400px !important;
    z-index: 9999 !important;
  }
  
  html body .handsontable .htDropdownMenu .ht_master .wtHolder table tbody tr {
    height: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
  }
  
  html body .handsontable .htDropdownMenu .ht_master .wtHolder table tbody tr td {
    height: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
    padding: 12px 16px !important;
    line-height: 16px !important;
    font-size: 14px !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    vertical-align: middle !important;
    min-width: 220px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  html body .handsontable .htDropdownMenu .ht_master .wtHolder table tbody tr td:hover {
    background-color: #e3f2fd !important;
  }
  
  /* Context Menu Styling - Make container taller to show all options */
  html body .htContextMenu {
    min-width: 200px !important;
    max-width: 300px !important;
    z-index: 10000 !important;
  }
  
  html body .htContextMenu .ht_master {
    min-height: 280px !important;
    max-height: 350px !important;
  }
  
  html body .htContextMenu .ht_master .wtHolder {
    min-height: 280px !important;
    max-height: 350px !important;
    overflow-y: visible !important;
  }
`;

console.log("Handsontable version:", Handsontable.version);
registerAllModules();

const GenericTable = forwardRef(({
  apiUrl,
  apiParams = {},
  saveUrl,
  deleteUrl,
  saveTransform,
  columns,
  colHeaders,
  newRowTemplate,
  dropdownSources = {},
  onBuildPayload,
  onSave,
  navigationRedirectPath,
  customRenderers = {},
  preprocessData,
  colWidths,
  getCellsConfig,
  fixedColumnsLeft = 0,
  columnSorting = false,
  filters = false,
  dropdownMenu = false,
  beforeSave,
  afterSave,
  afterChange,
  additionalButtons,
  headerButtons,
  storageKey,
  height = "100%",
  getExportFilename,
  defaultVisibleColumns = [],
  tableName = 'generic_table',  // Add tableName prop
  serverPagination = false,
  defaultPageSize = 100,
  userId = null  // Add userId prop for user-specific settings
}, ref) => {
  
  // Get settings for default page size
  const { settings, updateSettings } = useSettings();
  
  // Callback to update global settings when table page size changes
  const handleGlobalPageSizeChange = useCallback(async (newPageSize) => {
    try {
      await updateSettings({ ...settings, items_per_page: newPageSize });
    } catch (error) {
      console.error('Failed to update global page size setting:', error);
    }
  }, [settings, updateSettings]);
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [forceRefreshKey, setForceRefreshKey] = useState(0); // Force table re-render
  const [bulkModifiedData, setBulkModifiedData] = useState(null); // Store bulk changes across all pages
  
  // Handle bulk boolean updates (local only - no database save)
  const handleBulkUpdate = async (result) => {
    if (result.success) {
      const { field, value } = result;
      
      console.log(`🔄 Starting bulk local update: ${field} = ${value}`);
      
      if (serverPagination && serverPaginationHook) {
        // For server pagination, we need to fetch all data across all pages
        setLoading(true);
        let allData = [];
        let totalUpdated = 0;
        
        try {
          // Get total count and calculate pages needed
          const currentPageSize = serverPaginationHook.pageSize;
          const totalCount = serverPaginationHook.totalCount;
          const totalPages = currentPageSize === "All" ? 1 : Math.ceil(totalCount / currentPageSize);
          
          console.log(`📊 Fetching ${totalPages} pages of data (${totalCount} total records)`);
          
          // If pageSize is "All", just get current data
          if (currentPageSize === "All") {
            allData = [...serverPaginationHook.data];
          } else {
            // Fetch all pages
            for (let page = 1; page <= totalPages; page++) {
              console.log(`📡 Fetching page ${page}/${totalPages}`);
              const pageUrl = `${apiUrl}?page=${page}&page_size=${currentPageSize}`;
              const response = await axios.get(pageUrl);
              const pageData = response.data.results || response.data;
              allData = [...allData, ...pageData];
            }
          }
          
          console.log(`📦 Fetched ${allData.length} total records`);
          
          // Apply preprocessing if needed
          const processedData = preprocessData ? preprocessData(allData) : allData;
          
          // Apply the boolean change to all records
          const updatedData = processedData.map(row => {
            if (row && row.id && row[field] !== undefined) {
              totalUpdated++;
              return { 
                ...row, 
                [field]: value,
                saved: false // Mark as unsaved
              };
            }
            return row;
          });
          
          // Store ALL the modified data for saving later
          setBulkModifiedData(updatedData.filter(row => row && row.id && row[field] !== undefined));
          
          // Update the current page data in the server pagination hook
          const currentPageStart = (serverPaginationHook.currentPage - 1) * (currentPageSize === "All" ? totalCount : currentPageSize);
          const currentPageEnd = currentPageSize === "All" ? totalCount : currentPageStart + currentPageSize;
          const currentPageData = updatedData.slice(currentPageStart, currentPageEnd);
          
          // Force the server pagination hook to use our updated data
          serverPaginationHook.data.splice(0, serverPaginationHook.data.length, ...currentPageData);
          
          // Mark all current page rows as modified
          const newModifiedRows = { ...modifiedRows };
          currentPageData.forEach((row, index) => {
            if (row && row.id && row[field] !== undefined) {
              newModifiedRows[index] = true;
            }
          });
          
          setModifiedRows(newModifiedRows);
          setIsDirty(true);
          
          // Force table re-render
          setForceRefreshKey(prev => prev + 1);
          
          setSaveStatus(`✏️ Updated ${totalUpdated} rows across all pages. Click Save to persist changes.`);
          console.log(`✅ Bulk local update complete: ${totalUpdated} rows updated across ${totalPages} pages`);
          
        } catch (error) {
          console.error('❌ Error fetching all data for bulk update:', error);
          setSaveStatus(`❌ Error loading all data: ${error.message}`);
        } finally {
          setLoading(false);
        }
        
      } else {
        // For client-side tables, update all current data
        if (tableRef.current?.hotInstance) {
          const hot = tableRef.current.hotInstance;
          const sourceData = hot.getSourceData();
          let updatedCount = 0;
          
          // Apply the boolean change to all rows
          const updatedData = sourceData.map(row => {
            if (row && row.id && row[field] !== undefined) {
              updatedCount++;
              return { 
                ...row, 
                [field]: value,
                saved: false // Mark as unsaved
              };
            }
            return row;
          });
          
          // Update the modified rows tracker
          const newModifiedRows = { ...modifiedRows };
          sourceData.forEach((row, index) => {
            if (row && row.id && row[field] !== undefined) {
              newModifiedRows[index] = true;
            }
          });
          
          setModifiedRows(newModifiedRows);
          setIsDirty(true);
          
          // Load the updated data into the table
          hot.loadData(updatedData);
          hot.render();
          
          setSaveStatus(`✏️ Updated ${updatedCount} rows locally. Click Save to persist changes.`);
          console.log(`✅ Local bulk update complete: ${updatedCount} rows modified`);
        } else {
          setSaveStatus(`❌ Could not apply bulk update: table not ready`);
        }
      }
      
    } else {
      setSaveStatus(result.message);
    }
    
    // Clear status after 10 seconds (longer since this is important info)
    setTimeout(() => setSaveStatus(""), 10000);
  };
  const [selectedCount, setSelectedCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rowsToDelete, setRowsToDelete] = useState([]);
  const [showNavModal, setShowNavModal] = useState(false);
  const [nextPath, setNextPath] = useState(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [showCustomFilter, setShowCustomFilter] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [isTableReady, setIsTableReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [modifiedRows, setModifiedRows] = useState({});
  
  // Conditional data handling - server pagination or simple fetching
  const serverPaginationHook = useServerPagination(
    serverPagination ? apiUrl : null,
    settings?.items_per_page || defaultPageSize,
    storageKey,
    quickSearch,
    columnFilters,
    columns,
    handleGlobalPageSizeChange
  );
  
  // Simple data state for non-paginated tables
  const [rawData, setRawData] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const tableRef = useRef(null);
  const containerRef = useRef(null);

  // Inject custom dropdown styles and force height with JavaScript
  useEffect(() => {
    const styleId = 'handsontable-dropdown-styles';
    
    // Remove existing styles if any
    const existingStyles = document.getElementById(styleId);
    if (existingStyles) {
      existingStyles.remove();
    }
    
    // Add new styles
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = dropdownStyles;
    document.head.appendChild(styleElement);
    
    // Force dropdown heights with direct DOM manipulation
    const forceDropdownHeights = () => {
      // Target autocomplete dropdowns
      const autocompleteDropdowns = document.querySelectorAll('.handsontableEditor.autocompleteEditor');
      autocompleteDropdowns.forEach(dropdown => {
        // Force container height
        dropdown.style.setProperty('min-height', '200px', 'important');
        
        // Force row and cell heights
        const rows = dropdown.querySelectorAll('tr');
        rows.forEach(row => {
          row.style.setProperty('height', '48px', 'important');
          row.style.setProperty('min-height', '48px', 'important');
          
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            cell.style.setProperty('height', '48px', 'important');
            cell.style.setProperty('min-height', '48px', 'important');
            cell.style.setProperty('padding', '16px 20px', 'important');
            cell.style.setProperty('line-height', '16px', 'important');
            cell.style.setProperty('vertical-align', 'middle', 'important');
            cell.style.setProperty('box-sizing', 'border-box', 'important');
          });
        });
      });
      
      // Target regular dropdown menus
      const dropdownMenus = document.querySelectorAll('.htDropdownMenu');
      dropdownMenus.forEach(dropdown => {
        const rows = dropdown.querySelectorAll('tr');
        rows.forEach(row => {
          row.style.setProperty('height', '44px', 'important');
          row.style.setProperty('min-height', '44px', 'important');
          
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            cell.style.setProperty('height', '44px', 'important');
            cell.style.setProperty('min-height', '44px', 'important');
            cell.style.setProperty('padding', '14px 18px', 'important');
            cell.style.setProperty('line-height', '16px', 'important');
            cell.style.setProperty('vertical-align', 'middle', 'important');
            cell.style.setProperty('box-sizing', 'border-box', 'important');
          });
        });
      });
      
      // Target context menus - focus on making container taller, not individual items
      const contextMenus = document.querySelectorAll('.htContextMenu');
      contextMenus.forEach(menu => {
        // Force container to be taller and wider - moderate height
        menu.style.setProperty('min-width', '220px', 'important');
        menu.style.setProperty('min-height', '280px', 'important');
        menu.style.setProperty('max-height', '350px', 'important');
        
        // Force the master container to be taller
        const master = menu.querySelector('.ht_master');
        if (master) {
          master.style.setProperty('min-height', '280px', 'important');
          master.style.setProperty('max-height', '350px', 'important');
        }
        
        // Force the holder to be taller and remove scroll
        const holder = menu.querySelector('.ht_master .wtHolder');
        if (holder) {
          holder.style.setProperty('min-height', '280px', 'important');
          holder.style.setProperty('max-height', '350px', 'important');
          holder.style.setProperty('overflow-y', 'visible', 'important');
          holder.style.setProperty('overflow', 'visible', 'important');
        }
      });
    };
    
    // Run immediately
    forceDropdownHeights();
    
    // Set up mutation observer to catch dynamically created dropdowns
    const observer = new MutationObserver((mutations) => {
      let foundDropdowns = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.classList && (
              node.classList.contains('handsontableEditor') || 
              node.classList.contains('htDropdownMenu') ||
              node.classList.contains('autocompleteEditor') ||
              node.classList.contains('htContextMenu')
            )) {
              foundDropdowns = true;
            }
            // Also check descendants
            if (node.querySelectorAll) {
              const dropdowns = node.querySelectorAll('.handsontableEditor, .htDropdownMenu, .autocompleteEditor, .htContextMenu');
              if (dropdowns.length > 0) {
                foundDropdowns = true;
              }
            }
          }
        });
      });
      
      if (foundDropdowns) {
        // Small delay to ensure DOM is ready
        setTimeout(forceDropdownHeights, 10);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also run periodically as a fallback
    const interval = setInterval(forceDropdownHeights, 1000);
    
    // Cleanup on unmount
    return () => {
      observer.disconnect();
      clearInterval(interval);
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  // Simple data fetching - no pagination
  const fetchData = async () => {
    if (!apiUrl || serverPagination) return; // Skip if using server pagination
    
    setDataLoading(true);
    try {
      console.log('🌐 Fetching data from:', apiUrl);
      const response = await axios.get(apiUrl, { params: apiParams });
      const responseData = response.data;
      
      // Handle both array and paginated responses
      const dataArray = Array.isArray(responseData) ? responseData : responseData.results || [];
      console.log('✅ Fetched', dataArray.length, 'items');
      
      setRawData(dataArray);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      setRawData([]);
    } finally {
      setDataLoading(false);
    }
  };

  // Get data and loading state based on pagination mode
  const currentData = serverPagination ? serverPaginationHook.data : rawData;
  const currentLoading = serverPagination ? serverPaginationHook.loading : dataLoading;
  

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [apiUrl, JSON.stringify(apiParams)]);

  // Smart refresh function - handles both pagination modes
  const refresh = async () => {
    console.log('🔄 Refreshing data...');
    if (serverPagination) {
      await serverPaginationHook.refresh();
    } else {
      await fetchData();
    }
  };

  // Process and filter data
  const data = React.useMemo(() => {
    if (!currentData) return [];
    
    let processed = preprocessData ? preprocessData(currentData) : currentData;
    let processedArray = processed || [];
    
    // Apply bulk modifications to the current page data if available
    if (serverPagination && bulkModifiedData && bulkModifiedData.length > 0) {
      console.log(`🔄 Applying bulk modifications to data processing for page ${serverPaginationHook?.currentPage}...`);
      
      const bulkDataMap = new Map();
      bulkModifiedData.forEach(bulkRow => {
        if (bulkRow.id) {
          bulkDataMap.set(bulkRow.id, bulkRow);
        }
      });
      
      let appliedCount = 0;
      processedArray = processedArray.map(row => {
        if (row.id && bulkDataMap.has(row.id)) {
          appliedCount++;
          const modifiedRow = bulkDataMap.get(row.id);
          console.log(`📝 Applying bulk modification to row ${row.id} in data processing`);
          return { ...modifiedRow }; // Use the bulk modified version
        }
        return row;
      });
      
      if (appliedCount > 0) {
        console.log(`✅ Applied ${appliedCount} bulk modifications in data processing`);
      }
    }
    
    // For server pagination, skip client-side filtering as it's handled server-side
    if (serverPagination) {
      // Only add blank row for new entries if we have a template and no filters/search
      if (newRowTemplate && !quickSearch && Object.keys(columnFilters).length === 0) {
        // Check if we need to add a blank row
        const hasBlankRow = processedArray.length > 0 && 
          processedArray[processedArray.length - 1] && 
          !processedArray[processedArray.length - 1].id &&
          processedArray[processedArray.length - 1]._isNew;
        
        if (!hasBlankRow) {
          // Initialize the blank row with default values
          const blankRow = { 
            ...newRowTemplate, 
            saved: false,
            _isNew: true
          };
          processedArray.push(blankRow);
          console.log('Added blank row to table. Total rows:', processedArray.length);
        }
      }
      return processedArray;
    }
    
    // Client-side filtering for non-server pagination tables
    // Apply quick search
    if (quickSearch) {
      const searchLower = quickSearch.toLowerCase();
      processedArray = processedArray.filter(row => {
        return columns.some((col) => {
          // Handle nested object values (like fabric_details.name)
          let value;
          if (col.data.includes('.')) {
            const keys = col.data.split('.');
            let nestedValue = row;
            for (const key of keys) {
              nestedValue = nestedValue?.[key];
              if (nestedValue === null || nestedValue === undefined) break;
            }
            value = nestedValue;
          } else {
            value = row[col.data];
          }
          
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }
    
    // Apply column filters
    if (Object.keys(columnFilters).length > 0) {
      processedArray = processedArray.filter(row => {
        return Object.entries(columnFilters).every(([colIndex, filter]) => {
          const column = columns[parseInt(colIndex)];
          if (!column) return true;
          
          // Handle nested object values (like fabric_details.name)
          let value;
          if (column.data.includes('.')) {
            const keys = column.data.split('.');
            let nestedValue = row;
            for (const key of keys) {
              nestedValue = nestedValue?.[key];
              if (nestedValue === null || nestedValue === undefined) break;
            }
            value = nestedValue;
          } else {
            value = row[column.data];
          }
          
          if (value === null || value === undefined) return false;
          
          const stringValue = String(value).toLowerCase();
          const filterValue = String(filter.value).toLowerCase();
          
          switch (filter.type) {
            case 'contains':
              return stringValue.includes(filterValue);
            case 'equals':
              return stringValue === filterValue;
            case 'starts_with':
              return stringValue.startsWith(filterValue);
            case 'ends_with':
              return stringValue.endsWith(filterValue);
            case 'not_contains':
              return !stringValue.includes(filterValue);
            case 'multi_select':
              if (!Array.isArray(filter.value)) return true;
              // Handle boolean values
              const actualValue = typeof value === 'boolean' ? (value ? 'True' : 'False') : stringValue;
              return filter.value.map(v => v.toLowerCase()).includes(actualValue.toLowerCase());
            default:
              return true;
          }
        });
      });
    }
    
    // ALWAYS add blank row for new entries if we have a template (but only when not filtering)
    if (newRowTemplate && !quickSearch && Object.keys(columnFilters).length === 0) {
      // Check if we need to add a blank row
      const hasBlankRow = processedArray.length > 0 && 
        processedArray[processedArray.length - 1] && 
        !processedArray[processedArray.length - 1].id &&
        processedArray[processedArray.length - 1]._isNew;
      
      if (!hasBlankRow) {
        // Initialize the blank row with default values
        const blankRow = { 
          ...newRowTemplate, 
          saved: false,
          _isNew: true
        };
        processedArray.push(blankRow);
        console.log('Added blank row to table. Total rows:', processedArray.length);
      }
    }
    
    return processedArray;
  }, [currentData, preprocessData, newRowTemplate, quickSearch, columnFilters, columns, serverPagination, forceRefreshKey, bulkModifiedData, serverPaginationHook?.currentPage]);

  // Column management
  const {
    visibleColumns,
    setVisibleColumns,
    columnFilter,
    setColumnFilter,
    createVisibleColumns,
    createVisibleHeaders,
    toggleColumnVisibility,
    toggleAllColumns,
    isRequiredColumn,
    tableConfig,
    isConfigLoaded,
    configError,
    updateConfig,
    resetConfiguration
  } = useTableColumns(columns, colHeaders, defaultVisibleColumns, customRenderers, dropdownSources, tableName, userId);

  // Load saved filters when configuration is loaded
  useEffect(() => {
    console.log('Filter loading check:', { isConfigLoaded, 'tableConfig?.filters': tableConfig?.filters });
    if (isConfigLoaded && tableConfig?.filters && Object.keys(tableConfig.filters).length > 0) {
      console.log('Loading filters from config:', tableConfig.filters);
      setColumnFilters(tableConfig.filters);
      lastSavedFiltersRef.current = tableConfig.filters; // Initialize the last saved reference
    } else if (isConfigLoaded) {
      console.log('No filters to load, tableConfig:', tableConfig);
      lastSavedFiltersRef.current = {}; // Initialize with empty filters
    }
  }, [isConfigLoaded, tableConfig?.filters]);

  // Load saved sorting when configuration is loaded
  useEffect(() => {
    if (isConfigLoaded && tableConfig?.sorting && Array.isArray(tableConfig.sorting) && tableConfig.sorting.length > 0) {
      lastSavedSortingRef.current = tableConfig.sorting; // Initialize the last saved reference
      
      // Apply sorting configuration to the table instance when it's ready
      setTimeout(() => {
        const hotInstance = tableRef.current?.hotInstance;
        if (hotInstance && hotInstance.getPlugin('columnSorting')) {
          try {
            // Set flag to prevent saving during restoration
            isLoadingSortingRef.current = true;
            
            const sortingPlugin = hotInstance.getPlugin('columnSorting');
            sortingPlugin.sort(tableConfig.sorting);
            
            // Clear the flag after a short delay to allow the sorting to complete
            setTimeout(() => {
              isLoadingSortingRef.current = false;
            }, 800); // Increased delay to ensure loading is complete
          } catch (error) {
            console.warn('Failed to apply saved sorting:', error);
            isLoadingSortingRef.current = false;
          }
        }
      }, 100);
    } else if (isConfigLoaded) {
      lastSavedSortingRef.current = []; // Initialize with empty sorting
      isLoadingSortingRef.current = false;
    }
  }, [isConfigLoaded, tableConfig?.sorting]);

  // Log column widths loading
  useEffect(() => {
    if (isConfigLoaded && tableConfig?.column_widths) {
      console.log('Column widths available in config:', tableConfig.column_widths);
    }
  }, [isConfigLoaded, tableConfig?.column_widths]);

  // Note: Filter saving is now handled in handleFilterChange to avoid duplicate saves

  // Debug column creation
  useEffect(() => {
    console.log('Column debug:', {
      columns: columns?.length,
      colHeaders: colHeaders?.length,
      visibleColumns: Object.keys(visibleColumns || {}),
      enhancedColumns: createVisibleColumns()?.length,
      data: data?.length
    });
  }, [columns, colHeaders, visibleColumns, data, createVisibleColumns]);

  // Table operations
  const {
    handleSaveChanges,
    handleDeleteRows,
    handleExportCSV,
    handleExportExcel
  } = useTableOperations({
    isDirty,
    setIsDirty,
    loading,
    setLoading,
    setSaveStatus,
    unsavedData: data,
    setUnsavedData: () => {},
    data,
    beforeSave,
    onSave,
    saveTransform,
    onBuildPayload,
    saveUrl,
    afterSave,
    navigationRedirectPath,
    fetchData: refresh,
    hasNonEmptyValues: (row) => row && Object.keys(row).length > 0,
    deleteUrl,
    setShowDeleteModal,
    setRowsToDelete,
    ensureBlankRow: (data) => data,
    columns,
    colHeaders,
    getExportFilename
  });

  // Effect to handle table readiness
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTableReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Current visible columns and headers
  const enhancedColumns = createVisibleColumns();
  const visibleColHeaders = createVisibleHeaders();

  // Convert saved column widths to array format for Handsontable
  const getColumnWidths = () => {
    console.log('🎯 Always auto-sizing columns on table load');
    return undefined; // Always force auto-sizing
  };

  const dynamicColWidths = getColumnWidths();

  // Context menu handler
  const handleAfterContextMenu = (key, selection) => {
    if (key === "remove_row") {
      handleDeleteRows(selection, tableRef.current?.hotInstance);
    }
  };

  // Enhanced context menu
  const enhancedContextMenu = createContextMenu(tableRef, setIsDirty, handleAfterContextMenu);

  // Optimized scroll handler for better performance
  const handleScrollVertically = useCallback(() => {
    // Update scroll button states without forcing render
    const hot = tableRef.current?.hotInstance;
    if (hot && data?.length > 0) {
      try {
        const totalRows = data.length;
        const firstRenderedRow = hot.view.wt.wtTable.getFirstRenderedRow();
        const lastRenderedRow = hot.view.wt.wtTable.getLastRenderedRow();
        
        setIsAtTop(firstRenderedRow <= 0);
        setIsAtBottom(lastRenderedRow >= totalRows - 1);
      } catch (error) {
        // Ignore scroll update errors
      }
    }
  }, [data?.length]);

  // Refs and imperative handle
  useImperativeHandle(ref, () => ({
    hotInstance: tableRef.current?.hotInstance,
    refreshData: refresh,
    isDirty,
    setIsDirty
  }));

  // Update selected count
  const updateSelectedCount = () => {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    const sel = hot.getSelected() || [];
    const rowSet = new Set();
    sel.forEach(([r1, , r2]) => {
      const start = Math.min(r1, r2);
      const end = Math.max(r1, r2);
      for (let row = start; row <= end; row++) {
        const physicalRow = hot.toPhysicalRow(row);
        const rowData = data[physicalRow];
        if (rowData && rowData.id != null) {
          rowSet.add(physicalRow);
        }
      }
    });
    setSelectedCount(rowSet.size);
  };

  // Scroll detection using Handsontable's viewport
  useEffect(() => {
    const hot = tableRef.current?.hotInstance;
    if (!hot || !data || data.length === 0) {
      setShowScrollButtons(false);
      return;
    }

    const checkScrollPosition = () => {
      try {
        const totalRows = data.length;
        const firstRenderedRow = hot.view.wt.wtTable.getFirstRenderedRow();
        const lastRenderedRow = hot.view.wt.wtTable.getLastRenderedRow();
        
        setShowScrollButtons(totalRows > 10); // Show buttons if more than 10 rows
        setIsAtTop(firstRenderedRow <= 0);
        setIsAtBottom(lastRenderedRow >= totalRows - 1);
        
      } catch (error) {
        // Fallback in case of any issues
        setShowScrollButtons(data.length > 10);
        setIsAtTop(false); // Changed default to false so top button shows
        setIsAtBottom(false);
        console.log('Scroll detection error:', error);
      }
    };

    // Initial check
    setTimeout(checkScrollPosition, 100);

    // We'll handle scroll detection through the existing afterScrollVertically callback
  }, [data]);

  // Table change handler
  const handleAfterChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    // Call custom afterChange if provided
    if (afterChange) {
      afterChange(changes, source);
    }
    
    // Handle mutual exclusivity between create and delete checkboxes
    const hotInstance = tableRef.current?.hotInstance;
    if (hotInstance) {
      changes.forEach(([row, prop, oldValue, newValue]) => {
        // Only handle boolean changes for create/delete columns
        if ((prop === 'create' || prop === 'delete') && newValue === true && oldValue !== newValue) {
          const currentRowData = hotInstance.getSourceDataAtRow(row);
          if (currentRowData) {
            // If create is checked, uncheck delete
            if (prop === 'create' && newValue === true && currentRowData.delete === true) {
              hotInstance.setDataAtRowProp(row, 'delete', false);
              console.log(`🔄 Auto-unchecked delete for row ${row} because create was checked`);
            }
            // If delete is checked, uncheck create
            else if (prop === 'delete' && newValue === true && currentRowData.create === true) {
              hotInstance.setDataAtRowProp(row, 'create', false);
              console.log(`🔄 Auto-unchecked create for row ${row} because delete was checked`);
            }
          }
        }
      });
    }
    
    // Track changes for both existing and new rows
    const newModifiedRows = { ...modifiedRows };
    let hasChanges = false;
    let shouldAddNewRow = false;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue !== newValue) {
        const rowData = hot.getSourceDataAtRow(row);
        if (rowData) {
          // For new rows (no id), use a temporary key
          const rowKey = rowData.id || `new_${row}`;
          
          if (!newModifiedRows[rowKey]) {
            newModifiedRows[rowKey] = { ...rowData };
          }
          newModifiedRows[rowKey][prop] = newValue;
          
          // Update the source data directly AND the data array
          rowData[prop] = newValue;
          if (data[row]) {
            data[row][prop] = newValue;
          }
          
          hasChanges = true;
          
          // Only add new row for user input (not programmatic changes)
          // AND only if this is actually new content (not just formatting)
          if (source === "edit" && !rowData.id && newValue && newValue.toString().trim() !== '' && oldValue !== newValue) {
            const isLastRow = row === hot.countRows() - 1;
            
            // Make sure this isn't just a formatting change (like WWPN formatting)
            const isFormattingChange = typeof oldValue === 'string' && typeof newValue === 'string' && 
              oldValue.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === newValue.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            
            if (isLastRow && !isFormattingChange) {
              shouldAddNewRow = true;
            }
          }
        }
      }
    });
    
    if (hasChanges) {
      setModifiedRows(newModifiedRows);
      setIsDirty(true);
      
      // Force a render to show the changes immediately
      setTimeout(() => {
        if (hot) {
          hot.render();
        }
      }, 0);
    }
    
    // Add new blank row if needed - but only for genuine user input
    if (shouldAddNewRow && newRowTemplate) {
      setTimeout(() => {
        const currentData = hot.getSourceData();
        const lastRow = currentData[currentData.length - 1];
        
        if (lastRow) {
          // Double-check that the last row actually has meaningful content
          const hasRealData = Object.keys(lastRow).some(key => {
            const value = lastRow[key];
            return key !== 'id' && 
                   key !== 'saved' && 
                   key !== '_isNew' && 
                   value && 
                   value.toString().trim() !== '';
          });
          
          // Only add if there's no blank row already
          const isLastRowBlank = !lastRow.id && lastRow._isNew && !hasRealData;
          
          if (hasRealData && !isLastRowBlank) {
            const newBlankRow = { 
              ...newRowTemplate, 
              saved: false,
              _isNew: true 
            };
            currentData.push(newBlankRow);
            hot.loadData(currentData);
            console.log('✅ Added new blank row after user input');
          }
        }
      }, 150); // Slightly longer delay to avoid race conditions
    }
  };

  // Filter change handler with debounced saving
  const filterSaveTimeoutRef = useRef(null);
  const lastSavedFiltersRef = useRef(null);
  
  // Sorting save handler with debounced saving
  const sortingSaveTimeoutRef = useRef(null);
  const lastSavedSortingRef = useRef(null);
  const isLoadingSortingRef = useRef(false);
  
  const handleFilterChange = (filters) => {
    console.log("Filter change:", filters);
    setColumnFilters(filters);
    
    // Save filters to backend configuration with debouncing
    if (isConfigLoaded && updateConfig && !configError) {
      // Only save if filters actually changed
      const filtersString = JSON.stringify(filters);
      const lastSavedString = JSON.stringify(lastSavedFiltersRef.current);
      
      if (filtersString === lastSavedString) {
        console.log('Filters unchanged, skipping save');
        return;
      }
      
      // Clear existing timeout
      if (filterSaveTimeoutRef.current) {
        clearTimeout(filterSaveTimeoutRef.current);
      }
      
      // Set new timeout to save filters
      filterSaveTimeoutRef.current = setTimeout(() => {
        try {
          updateConfig('filters', filters);
          lastSavedFiltersRef.current = filters;
          console.log('Filters saved to backend configuration:', filters);
        } catch (error) {
          console.warn('Failed to save filter configuration:', error);
        }
      }, 300); // 300ms delay for filter changes from AdvancedFilter
    }
  };

  // Sorting change handler with debounced saving
  const handleAfterColumnSort = (...args) => {
    
    // Don't save if we're currently loading/restoring sorting configuration
    if (isLoadingSortingRef.current) {
      return;
    }
    
    // Extract sort configuration from the arguments
    // The callback receives: (currentSortConfig, destinationSortConfig, isTriggeredByUser)
    let sortConfig = null;
    
    if (args.length >= 1 && Array.isArray(args[0])) {
      sortConfig = args[0];
    } else if (args.length >= 2 && Array.isArray(args[1])) {
      sortConfig = args[1];
    }
    
    // Fallback: get from plugin if needed
    if (!sortConfig) {
      const hotInstance = tableRef.current?.hotInstance;
      if (hotInstance && hotInstance.getPlugin('columnSorting')) {
        try {
          const sortingPlugin = hotInstance.getPlugin('columnSorting');
          sortConfig = sortingPlugin.getSortConfig();
        } catch (error) {
          console.warn('Failed to get sort config from plugin:', error);
        }
      }
    }
    
    if (!sortConfig) {
      return;
    }
    
    // Save sorting to backend configuration with debouncing
    if (isConfigLoaded && updateConfig && !configError) {
      // Only save if sorting actually changed
      const sortingString = JSON.stringify(sortConfig);
      const lastSavedString = JSON.stringify(lastSavedSortingRef.current);
      
      if (sortingString === lastSavedString) {
        return;
      }
      
      // Clear existing timeout
      if (sortingSaveTimeoutRef.current) {
        clearTimeout(sortingSaveTimeoutRef.current);
      }
      
      // Set new timeout to save sorting - increased delay for rapid clicks
      sortingSaveTimeoutRef.current = setTimeout(() => {
        try {
          updateConfig('sorting', sortConfig);
          lastSavedSortingRef.current = sortConfig;
        } catch (error) {
          console.warn('Failed to save sorting configuration:', error);
        }
      }, 500); // 500ms delay to handle rapid double-clicks better
    }
  };

  // Column resize handler
  const handleAfterColumnResize = (currentColumn, newSize, isDoubleClick) => {
    if (tableRef.current && tableRef.current.hotInstance) {
      const totalCols = tableRef.current.hotInstance.countCols();
      const widths = {};
      
      // Create column widths object mapping column headers to widths
      for (let i = 0; i < totalCols; i++) {
        const width = tableRef.current.hotInstance.getColWidth(i);
        const headerName = visibleColHeaders[i];
        if (headerName) {
          widths[headerName] = width;
        }
      }
      
      // Save to table configuration if available, otherwise fallback to localStorage
      if (!configError && updateConfig) {
        console.log('Saving column widths to table configuration:', widths);
        updateConfig('column_widths', widths);
      } else {
        // Fallback to localStorage for backward compatibility
        const widthsArray = [];
        for (let i = 0; i < totalCols; i++) {
          widthsArray.push(tableRef.current.hotInstance.getColWidth(i));
        }
        localStorage.setItem(storageKey || "tableColumnWidths", JSON.stringify(widthsArray));
      }
    }
  };

  // Cells configuration function
  const cellsFunc = (row, col, prop) => {
    if (getCellsConfig && typeof getCellsConfig === 'function' && tableRef.current?.hotInstance) {
      return getCellsConfig(tableRef.current.hotInstance, row, col, prop);
    }
    return {};
  };

  // Navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Cleanup filter and sorting save timeouts on unmount
  useEffect(() => {
    return () => {
      if (filterSaveTimeoutRef.current) {
        clearTimeout(filterSaveTimeoutRef.current);
      }
      if (sortingSaveTimeoutRef.current) {
        clearTimeout(sortingSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        e.preventDefault();
        setNextPath(link.href);
        setShowNavModal(true);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isDirty]);

  const scrollToTop = () => {
    const hot = tableRef.current?.hotInstance;
    if (hot) {
      hot.scrollViewportTo(0, 0);
    }
  };

  const scrollToBottom = () => {
    const hot = tableRef.current?.hotInstance;
    if (hot && data && data.length > 0) {
      const lastRowIndex = data.length - 1;
      hot.scrollViewportTo(lastRowIndex, 0);
    }
  };

  // Save modified rows - SIMPLIFIED VERSION
  const handleSaveModifiedRows = async () => {
    if (!isDirty) return;
    
    setLoading(true);
    setSaveStatus("Saving changes...");
    
    try {
      const hot = tableRef.current?.hotInstance;
      if (!hot) {
        throw new Error("Table instance not found");
      }
      
      const allData = hot.getSourceData();
      
      // Separate new rows from modified existing rows
      const newRows = [];
      const modifiedExistingRows = [];
      
      // Handle bulk modified data first (if any)
      if (bulkModifiedData && bulkModifiedData.length > 0) {
        console.log(`📦 Adding ${bulkModifiedData.length} bulk modified rows to save payload`);
        modifiedExistingRows.push(...bulkModifiedData);
      }
      
      // Handle regular table modifications
      allData.forEach((row, index) => {
        const rowKey = row.id || `new_${index}`;
        
        // Check if this is a new row with data
        if (!row.id && modifiedRows[rowKey]) {
          // Check if the row has any non-empty values
          const hasData = Object.entries(modifiedRows[rowKey]).some(([key, value]) => {
            return key !== 'id' && key !== 'saved' && key !== '_isNew' && value && value.toString().trim() !== '';
          });
          
          if (hasData) {
            newRows.push(modifiedRows[rowKey]);
          }
        }
        // Check if this is a modified existing row (and not already in bulk data)
        else if (row.id && modifiedRows[row.id]) {
          // Only add if it's not already in bulk modified data
          const alreadyInBulk = bulkModifiedData && bulkModifiedData.some(bulkRow => bulkRow.id === row.id);
          if (!alreadyInBulk) {
            modifiedExistingRows.push(modifiedRows[row.id]);
          }
        }
      });
      
      const payload = [...newRows, ...modifiedExistingRows];
      
      if (payload.length === 0) {
        setSaveStatus("No changes to save");
        setLoading(false);
        return;
      }
      
      if (beforeSave) {
        const validationResult = await beforeSave(payload);
        if (validationResult !== true) {
          setSaveStatus(validationResult);
          setLoading(false);
          return;
        }
      }
      
      if (onSave) {
        // Use custom save handler
        const result = await onSave(payload);
        if (result.success) {
          setSaveStatus(result.message);
          setModifiedRows({});
          setIsDirty(false);
          setBulkModifiedData(null); // Clear bulk changes after successful save
          
          // Force complete cache clear and refresh for server pagination
          console.log('🔄 Refreshing after save with cache clear');
          if (serverPagination && serverPaginationHook) {
            // Clear all cached pages to ensure fresh data
            serverPaginationHook.resetPagination();
            await serverPaginationHook.refresh();
          } else {
            await refresh();
          }
          console.log('✅ Refresh completed');
        } else {
          setSaveStatus(result.message);
        }
      } else if (saveUrl) {
        // Default save behavior
        await axios.post(saveUrl, payload);
        setSaveStatus("Changes saved successfully!");
        setModifiedRows({});
        setIsDirty(false);
        setBulkModifiedData(null); // Clear bulk changes after successful save
        
        // Force complete cache clear and refresh for server pagination
        if (serverPagination && serverPaginationHook) {
          // Clear all cached pages to ensure fresh data
          serverPaginationHook.resetPagination();
          await serverPaginationHook.refresh();
        } else {
          await refresh();
        }
      }
      
      if (afterSave) {
        await afterSave(payload);
      }
    } catch (error) {
      setSaveStatus(`Save failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  return (
    <div className="modern-table-container">
      <TableHeader
        loading={loading || currentLoading}
        isDirty={isDirty}
        onSave={handleSaveModifiedRows}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        columns={columns}
        colHeaders={colHeaders}
        visibleColumns={visibleColumns}
        columnFilter={columnFilter}
        setColumnFilter={setColumnFilter}
        toggleColumnVisibility={toggleColumnVisibility}
        toggleAllColumns={toggleAllColumns}
        isRequiredColumn={isRequiredColumn}
        quickSearch={quickSearch}
        setQuickSearch={setQuickSearch}
        unsavedData={data}
        hasNonEmptyValues={(row) => {
          // Only count rows that have an ID (real data from server)
          // This excludes blank template rows which have id: null
          return row && row.id;
        }}
        selectedCount={selectedCount}
        showCustomFilter={showCustomFilter}
        setShowCustomFilter={setShowCustomFilter}
        additionalButtons={additionalButtons}
        headerButtons={headerButtons}
        columnFilters={columnFilters}
        onClearAllFilters={() => {
          setColumnFilters({});
          if (updateConfig && !configError) {
            updateConfig('filters', {});
          }
        }}
        pagination={serverPagination ? serverPaginationHook : null}
        data={preprocessData ? preprocessData(currentData) : currentData}
        onFilterChange={handleFilterChange}
        apiUrl={serverPagination ? apiUrl : null}
        serverPagination={serverPagination}
        onBulkUpdate={handleBulkUpdate}
      />

      <StatusMessage saveStatus={saveStatus} />

      {showCustomFilter && (
        <CustomTableFilter
          columns={columns}
          colHeaders={colHeaders}
          data={data}
          onFilterChange={handleFilterChange}
          visibleColumns={visibleColumns}
          initialFilters={columnFilters}
          apiUrl={serverPagination ? apiUrl : null}
          serverPagination={serverPagination}
        />
      )}
      

      <div 
        ref={containerRef} 
        className="table-scroll-container"
        style={{ height, overflow: 'hidden' }}
      >
        {currentLoading && (!data || data.length === 0) ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="spinner large"></div>
              <span>Loading data...</span>
            </div>
          </div>
        ) : !isTableReady ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="spinner large"></div>
              <span>Initializing table...</span>
            </div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <HotTable
              key={forceRefreshKey}
              ref={tableRef}
              data={data || []}
              colHeaders={visibleColHeaders}
              columns={enhancedColumns}
              licenseKey="non-commercial-and-evaluation"
              rowHeaders={false}
              columnSorting={columnSorting}
              dragToScroll={true}
              filters={filters}
              dropdownMenu={dropdownMenu}
              width="100%"
              height={height}
              fixedRowsTop={0}
              fixedColumnsLeft={0}
              allowHtml={false}
              preventOverflow={false}
              minSpareRows={serverPagination ? 5 : 3}
              afterChange={handleAfterChange}
              afterSelection={(r, c, r2, c2) => updateSelectedCount()}
              afterDeselect={() => setSelectedCount(0)}
              manualColumnResize={true}
              afterColumnResize={handleAfterColumnResize}
              afterColumnSort={handleAfterColumnSort}
              afterScrollVertically={handleScrollVertically}
              afterScrollHorizontally={() => {
                // Aggressive alignment fix for scroll boundary issues
                const hot = tableRef.current?.hotInstance;
                if (hot) {
                  const forceAlignment = () => {
                    try {
                      const container = hot.rootElement;
                      const topClone = container.querySelector('.ht_clone_top');
                      const master = container.querySelector('.ht_master');
                      
                      if (topClone && master) {
                        const topTable = topClone.querySelector('.wtTable');
                        const masterTable = master.querySelector('.wtTable');
                        const masterHolder = master.querySelector('.wtHolder');
                        
                        if (topTable && masterTable && masterHolder) {
                          // Get the exact scroll position
                          const scrollLeft = masterHolder.scrollLeft;
                          const maxScrollLeft = masterHolder.scrollWidth - masterHolder.clientWidth;
                          
                          // Force exact positioning using transform
                          const translateX = -Math.min(scrollLeft, maxScrollLeft);
                          topTable.style.transform = `translate3d(${translateX}px, 0, 0)`;
                          
                          // Also ensure the master table has no conflicting transforms
                          masterTable.style.transform = 'translate3d(0, 0, 0)';
                          
                          // Force immediate render
                          hot.render();
                        }
                      }
                    } catch (e) {
                      // Silently ignore
                    }
                  };
                  
                  // Immediate alignment
                  forceAlignment();
                  
                  // Additional alignment after browser layout
                  requestAnimationFrame(forceAlignment);
                  
                  // Final alignment with delay for any async operations
                  setTimeout(forceAlignment, 16);
                }
              }}
              stretchH="all"
              contextMenu={enhancedContextMenu}
              afterContextMenuAction={(key, selection) => handleAfterContextMenu(key, selection)}
              beforeRemoveRow={() => false}
              colWidths={dynamicColWidths}
              cells={getCellsConfig ? cellsFunc : undefined}
              viewportRowRenderingOffset={30}
              viewportColumnRenderingOffset={5}
              renderAllRows={false}
              afterInit={(hot) => {
                setIsTableReady(true);
                
                // Always auto-size columns on table load using the same method as context menu
                setTimeout(() => {
                  // Get the hot instance from the ref if the parameter is not available
                  const hotInstance = hot || tableRef.current?.hotInstance;
                  
                  if (hotInstance) {
                    console.log('🎯 Auto-sizing columns on table load using updateSettings method...');
                    
                    // Use the same method as the context menu for consistent results
                    hotInstance.updateSettings({
                      colWidths: undefined // This triggers auto-sizing
                    });
                    
                    console.log('✨ Auto-sizing triggered on table load');
                  } else {
                    console.log('⚠️ Hot instance not available for auto-sizing');
                  }
                }, 300); // Delay to ensure table is fully initialized
              }}
            />
          </div>
        )}

        <ScrollButtons
          showScrollButtons={showScrollButtons}
          isAtTop={isAtTop}
          isAtBottom={isAtBottom}
          scrollToTop={scrollToTop}
          scrollToBottom={scrollToBottom}
        />
      </div>

      <DeleteModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        rowsToDelete={rowsToDelete}
        onConfirm={async () => {
          setLoading(true);
          try {
            const deletePromises = rowsToDelete.map(row => 
              axios.delete(`${deleteUrl}${row.id}/`)
            );
            await Promise.all(deletePromises);
            
            console.log("🗑️ Deletion successful, clearing cache and refreshing...");
            setSaveStatus("Items deleted successfully!");
            
            // Clear cache before refresh to ensure fresh data
            if (serverPagination && serverPaginationHook) {
              // Reset pagination cache to force fresh data load
              serverPaginationHook.resetPagination();
            }
            
            await refresh(); // Refresh with cleared cache
            
            // Mark table as clean after successful deletion
            setIsDirty(false);
          } catch (error) {
            setSaveStatus(`Delete failed: ${error.response?.data?.message || error.message}`);
          } finally {
            setShowDeleteModal(false);
            setRowsToDelete([]);
            setLoading(false);
          }
        }}
        onCancel={() => {
          setShowDeleteModal(false);
          setRowsToDelete([]);
        }}
      />

      <NavigationModal
        show={showNavModal}
        onHide={() => setShowNavModal(false)}
        onLeave={() => {
          setIsDirty(false);
          window.location.href = nextPath;
        }}
      />
    </div>
  );
});

export default GenericTable;