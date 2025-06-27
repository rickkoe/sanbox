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
import TablePagination from './components/TablePagination';
import { useTableColumns } from './hooks/useTableColumns';
import { useTableOperations } from './hooks/useTableOperations';
import { useServerPagination } from './hooks/useServerPagination';
import { createContextMenu } from './utils/contextMenu';
import CustomTableFilter from './components/CustomTableFilter';

console.log("Handsontable version:", Handsontable.version);
registerAllModules();

const GenericTable = forwardRef(({
  apiUrl,
  apiParams = {}, // Add this prop
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
  afterChange, // Add this prop
  additionalButtons,
  storageKey,
  height = "calc(100vh - 200px)",
  getExportFilename,
  defaultVisibleColumns = [],
  // Pagination props
  enablePagination = true,
  defaultPageSize = 100,
  pageSizeOptions = [50, 100, 500, "All"],
  serverSidePagination = true // Add this back with a default
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
  const [isTableReady, setIsTableReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [modifiedRows, setModifiedRows] = useState({});
  
  const tableRef = useRef(null);
  const containerRef = useRef(null);

  // State for client-side data when not using server pagination
  const [clientData, setClientData] = useState([]);
  const [clientLoading, setClientLoading] = useState(true);

  // Fetch data for client-side mode
  useEffect(() => {
    if (!serverSidePagination && apiUrl) {
      setClientLoading(true);
      axios.get(apiUrl)
        .then(response => {
          const responseData = response.data;
          // Handle both array and paginated responses
          const dataArray = Array.isArray(responseData) ? responseData : responseData.results || [];
          setClientData(dataArray);
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          setClientData([]);
        })
        .finally(() => {
          setClientLoading(false);
        });
    }
  }, [apiUrl, serverSidePagination]);

  // Always call the hook, but pass null URL if not needed
  const serverPaginationResult = useServerPagination(
    serverSidePagination ? apiUrl : null,
    defaultPageSize,
    storageKey ? `${storageKey}_server` : null,
    apiParams // Pass the apiParams to the hook
  );

  // Choose data source based on pagination mode
  const rawData = serverSidePagination ? serverPaginationResult.data : clientData;
  const dataLoading = serverSidePagination ? serverPaginationResult.loading : clientLoading;

  // Process data if preprocessor is provided
  const data = React.useMemo(() => {
    if (!rawData) return [];
    
    // Ensure we have an array
    let dataArray = rawData;
    if (rawData.results && Array.isArray(rawData.results)) {
      dataArray = rawData.results;
    } else if (!Array.isArray(rawData)) {
      console.error('Unexpected data format:', rawData);
      return [];
    }
    
    const processed = preprocessData ? preprocessData(dataArray) : dataArray;
    
    // Add blank row for new entries if we have a template
    if (newRowTemplate && processed && processed.length >= 0) {
      const hasEmptyRow = processed.length === 0 || 
        (processed[processed.length - 1] && !processed[processed.length - 1].id);
      
      if (!hasEmptyRow) {
        // Initialize the blank row with default values
        const blankRow = { 
          ...newRowTemplate, 
          saved: false,
          _isNew: true  // Internal flag to identify new rows
        };
        processed.push(blankRow);
      }
    }
    
    return processed || [];
  }, [rawData, preprocessData, serverSidePagination, newRowTemplate]);

  // Refresh function
  const refresh = serverSidePagination ? serverPaginationResult.refresh : () => {
    if (apiUrl) {
      setClientLoading(true);
      axios.get(apiUrl)
        .then(response => {
          const responseData = response.data;
          const dataArray = Array.isArray(responseData) ? responseData : responseData.results || [];
          setClientData(dataArray);
        })
        .catch(error => {
          console.error('Error fetching data:', error);
        })
        .finally(() => {
          setClientLoading(false);
        });
    }
  };

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
    setUnsavedData: () => {}, // Not used in server-side mode
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
    // Set table ready after a short delay, regardless of data
    const timer = setTimeout(() => {
      setIsTableReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Current visible columns and headers
  const enhancedColumns = createVisibleColumns();
  const visibleColHeaders = createVisibleHeaders();

  // Pagination object
  const pagination = serverSidePagination ? {
    paginatedData: data,
    currentPage: serverPaginationResult.currentPage,
    totalPages: serverPaginationResult.totalPages,
    totalRows: serverPaginationResult.totalCount,
    pageSize: serverPaginationResult.pageSize,
    handlePageChange: serverPaginationResult.handlePageChange,
    handlePageSizeChange: serverPaginationResult.handlePageSizeChange,
    resetPagination: serverPaginationResult.resetPagination
  } : {
    // Client-side pagination
    paginatedData: data, // For now, show all data
    currentPage: 1,
    totalPages: 1,
    totalRows: data.length,
    pageSize: data.length,
    handlePageChange: () => {},
    handlePageSizeChange: () => {},
    resetPagination: () => {}
  };

  // Extract values for the table pagination component
  const { currentPage, totalPages, pageSize, totalRows: totalCount, handlePageChange, handlePageSizeChange } = pagination;

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

  // Scroll detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const hasScrollableContent = container.scrollHeight > container.clientHeight;
      setShowScrollButtons(hasScrollableContent);
      
      if (hasScrollableContent) {
        setIsAtTop(container.scrollTop <= 10);
        setIsAtBottom(container.scrollTop + container.clientHeight >= container.scrollHeight - 10);
      }
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
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
    
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue !== newValue) {
        const rowData = data[row];
        if (rowData) {
          // For new rows (no id), use a temporary key
          const rowKey = rowData.id || `new_${row}`;
          
          if (!newModifiedRows[rowKey]) {
            newModifiedRows[rowKey] = { ...rowData };
          }
          newModifiedRows[rowKey][prop] = newValue;
          
          // Update the data array directly for new rows
          if (!rowData.id) {
            data[row][prop] = newValue;
          }
          
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      setModifiedRows(newModifiedRows);
      setIsDirty(true);
    }
  };

  // Filter change handler
  const handleFilterChange = (filteredData) => {
    // For server-side pagination, this would need to be handled by the API
    console.log("Filter change - server-side implementation needed");
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
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  // Save modified rows
  const handleSaveModifiedRows = async () => {
    if (!isDirty) return;
    
    setLoading(true);
    setSaveStatus("Saving changes...");
    
    try {
      // Get current table data to include new rows
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
            return key !== 'id' && key !== 'saved' && value && value.toString().trim() !== '';
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
        const result = await onSave(payload);
        if (result.success) {
          setSaveStatus(result.message);
          setModifiedRows({});
          setIsDirty(false);
          refresh(); // Refresh data from server
        } else {
          setSaveStatus(result.message);
        }
      } else if (saveUrl) {
        // Default save behavior
        await axios.post(saveUrl, payload);
        setSaveStatus("Changes saved successfully!");
        setModifiedRows({});
        setIsDirty(false);
        refresh();
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
    <div className={`modern-table-container ${enablePagination ? 'with-pagination' : ''}`}>
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
        quickSearch={serverSidePagination ? serverPaginationResult.searchTerm : ''}
        setQuickSearch={serverSidePagination ? serverPaginationResult.handleSearch : () => {}}
        unsavedData={data}
        hasNonEmptyValues={(row) => row && Object.keys(row).length > 0}
        selectedCount={selectedCount}
        showCustomFilter={showCustomFilter}
        setShowCustomFilter={setShowCustomFilter}
        additionalButtons={additionalButtons}
        pagination={enablePagination ? pagination : null}
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
        style={{ height }}
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
              stretchH="all"
              contextMenu={enhancedContextMenu}
              afterContextMenuAction={(key, selection) => handleAfterContextMenu(key, selection)}
              beforeRemoveRow={() => false}
              colWidths={colWidths}
              cells={getCellsConfig ? cellsFunc : undefined}
              viewportRowRenderingOffset={30}
              viewportColumnRenderingOffset={30}
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

      {/* Pagination */}
      {enablePagination && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRows={totalCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}

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
            refresh(); // Refresh data from server
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