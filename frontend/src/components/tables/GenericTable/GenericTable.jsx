import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { HotTable } from '@handsontable/react';
import { Modal } from "react-bootstrap";
import axios from "axios";
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

// Import sub-components
import TableHeader from './components/TableHeader';
import StatusMessage from './components/StatusMessage';
import DeleteModal from './components/DeleteModal';
import NavigationModal from './components/NavigationModal';
import ScrollButtons from './components/ScrollButtons';
import { useTableColumns } from './hooks/useTableColumns';
import { useTableOperations } from './hooks/useTableOperations';
import { createContextMenu } from './utils/contextMenu';
import CustomTableFilter from './components/CustomTableFilter';

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
  storageKey,
  height = "calc(100vh - 200px)",
  getExportFilename,
  defaultVisibleColumns = []
}, ref) => {
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
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
  
  // Simple data state - no pagination complexity
  const [rawData, setRawData] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const tableRef = useRef(null);
  const containerRef = useRef(null);

  // Simple data fetching - no pagination
  const fetchData = async () => {
    if (!apiUrl) return;
    
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

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [apiUrl, JSON.stringify(apiParams)]);

  // Simple refresh function
  const refresh = async () => {
    console.log('🔄 Refreshing data...');
    await fetchData();
  };

  // Process and filter data
  const data = React.useMemo(() => {
    if (!rawData) return [];
    
    let processed = preprocessData ? preprocessData(rawData) : rawData;
    let processedArray = processed || [];
    
    // Apply quick search
    if (quickSearch) {
      const searchLower = quickSearch.toLowerCase();
      processedArray = processedArray.filter(row => {
        return columns.some((col) => {
          const value = row[col.data];
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
          
          const value = row[column.data];
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
  }, [rawData, preprocessData, newRowTemplate, quickSearch, columnFilters, columns]);

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
    isRequiredColumn
  } = useTableColumns(columns, colHeaders, defaultVisibleColumns, customRenderers, dropdownSources);

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

  // Context menu handler
  const handleAfterContextMenu = (key, selection) => {
    if (key === "remove_row") {
      handleDeleteRows(selection, tableRef.current?.hotInstance);
    }
  };

  // Enhanced context menu
  const enhancedContextMenu = createContextMenu(tableRef, setIsDirty, handleAfterContextMenu);

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
        
        console.log('Scroll position:', { firstRenderedRow, lastRenderedRow, totalRows, isAtTop: firstRenderedRow <= 0, isAtBottom: lastRenderedRow >= totalRows - 1 });
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

  // Filter change handler
  const handleFilterChange = (filters) => {
    console.log("Filter change:", filters);
    setColumnFilters(filters);
  };

  // Column resize handler
  const handleAfterColumnResize = (currentColumn, newSize, isDoubleClick) => {
    if (tableRef.current && tableRef.current.hotInstance) {
      const totalCols = tableRef.current.hotInstance.countCols();
      const widths = [];
      for (let i = 0; i < totalCols; i++) {
        widths.push(tableRef.current.hotInstance.getColWidth(i));
      }
      localStorage.setItem(storageKey || "tableColumnWidths", JSON.stringify(widths));
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
        // Check if this is a modified existing row
        else if (row.id && modifiedRows[row.id]) {
          modifiedExistingRows.push(modifiedRows[row.id]);
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
          
          // Simple refresh - no pagination complexity!
          console.log('🔄 Refreshing after save');
          await refresh();
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
        await refresh();
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
        loading={loading || dataLoading}
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
        pagination={null} // Remove the custom pagination since we fixed hasNonEmptyValues
        data={preprocessData ? preprocessData(rawData) : rawData}
        onFilterChange={handleFilterChange}
      />

      <StatusMessage saveStatus={saveStatus} />

      {showCustomFilter && (
        <CustomTableFilter
          columns={columns}
          colHeaders={colHeaders}
          data={data}
          onFilterChange={handleFilterChange}
          visibleColumns={visibleColumns}
        />
      )}

      <div 
        ref={containerRef} 
        className="table-scroll-container"
        style={{ height, overflow: 'hidden' }}
      >
        {dataLoading && (!data || data.length === 0) ? (
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
              ref={tableRef}
              data={data || []}
              colHeaders={visibleColHeaders}
              columns={enhancedColumns}
              licenseKey="non-commercial-and-evaluation"
              rowHeaders={false}
              columnSorting={columnSorting}
              filters={filters}
              dropdownMenu={dropdownMenu}
              width="100%"
              height={height}
              fixedRowsTop={0}
              fixedColumnsLeft={0}
              allowHtml={false}
              preventOverflow={false}
              afterChange={handleAfterChange}
              afterSelection={(r, c, r2, c2) => updateSelectedCount()}
              afterDeselect={() => setSelectedCount(0)}
              manualColumnResize={true}
              afterColumnResize={handleAfterColumnResize}
              afterScrollHorizontally={() => {
                setTimeout(() => {
                  if (tableRef.current?.hotInstance) {
                    tableRef.current.hotInstance.render();
                  }
                }, 10);
              }}
              afterScrollVertically={() => {
                setTimeout(() => {
                  const hot = tableRef.current?.hotInstance;
                  if (hot) {
                    hot.render();
                    
                    // Update scroll button states
                    try {
                      const totalRows = data?.length || 0;
                      const firstRenderedRow = hot.view.wt.wtTable.getFirstRenderedRow();
                      const lastRenderedRow = hot.view.wt.wtTable.getLastRenderedRow();
                      
                      setIsAtTop(firstRenderedRow <= 0);
                      setIsAtBottom(lastRenderedRow >= totalRows - 1);
                      
                      console.log('Scroll update:', { firstRenderedRow, lastRenderedRow, totalRows, isAtTop: firstRenderedRow <= 0, isAtBottom: lastRenderedRow >= totalRows - 1 });
                    } catch (error) {
                      console.log('Scroll update error:', error);
                    }
                  }
                }, 10);
              }}
              stretchH="all"
              contextMenu={enhancedContextMenu}
              afterContextMenuAction={(key, selection) => handleAfterContextMenu(key, selection)}
              beforeRemoveRow={() => false}
              colWidths={colWidths}
              cells={getCellsConfig ? cellsFunc : undefined}
              viewportRowRenderingOffset={10}
              viewportColumnRenderingOffset={10}
              renderAllRows={false}
              preventOverflow={false}
              afterInit={() => {
                if (tableRef.current?.hotInstance) {
                  console.log('Table initialized with data:', data?.length || 0);
                  setTimeout(() => {
                    tableRef.current.hotInstance.render();
                  }, 0);
                }
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
            
            setSaveStatus("Items deleted successfully!");
            await refresh(); // Simple refresh
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