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
import { useTableData } from './hooks/useTableData';
import { useTableColumns } from './hooks/useTableColumns';
import { useTableOperations } from './hooks/useTableOperations';
import { usePagination } from './hooks/usePagination';
import { createContextMenu } from './utils/contextMenu';
import CustomTableFilter from './components/CustomTableFilter';

console.log("Handsontable version:", Handsontable.version);
registerAllModules();

const GenericTable = forwardRef(({
  apiUrl,
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
  additionalButtons,
  storageKey,
  height = "calc(100vh - 200px)",
  getExportFilename,
  defaultVisibleColumns = [],
  // Pagination props
  enablePagination = true,
  defaultPageSize = 100,
  pageSizeOptions = [50, 100, 500, "All"]
}, ref) => {
  
  // Core state
  const [loading, setLoading] = useState(true);
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
  const [isTableReady, setIsTableReady] = useState(false); // Add this state
  
  const tableRef = useRef(null);
  const containerRef = useRef(null);

  // Custom hooks for data management
  const {
    data,
    unsavedData,
    setUnsavedData,
    originalData,
    isDirty,
    setIsDirty,
    quickSearch,
    setQuickSearch,
    fetchData,
    ensureBlankRow,
    hasNonEmptyValues,
    performQuickSearch
  } = useTableData(apiUrl, newRowTemplate, preprocessData, columns);

  // Effect to handle initial data loading and table readiness
  useEffect(() => {
    if (apiUrl) {
      console.log("GenericTable: Starting data fetch for URL:", apiUrl);
      fetchData()
        .then(() => {
          console.log("GenericTable: Data fetch completed successfully");
          setLoading(false);
          // Add a small delay to ensure DOM is ready for Handsontable
          setTimeout(() => {
            setIsTableReady(true);
          }, 100);
        })
        .catch((error) => {
          console.error("GenericTable: Data fetch failed:", error);
          setLoading(false);
          setSaveStatus(`Error loading data: ${error.message}`);
        });
    } else {
      console.log("GenericTable: No API URL provided");
      setLoading(false);
      setTimeout(() => {
        setIsTableReady(true);
      }, 100);
    }
  }, [apiUrl]);

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

  // Pagination hook - use filtered data for pagination
  const pagination = usePagination(
    unsavedData, 
    defaultPageSize, 
    storageKey ? `${storageKey}_pagination` : null
  );

  // Use paginated data for the table display
  const displayData = enablePagination ? pagination.paginatedData : unsavedData;

  // Context menu handler - define this first
  const handleAfterContextMenu = (key, selection) => {
    if (key === "remove_row") {
      handleDeleteRows(selection, tableRef.current?.hotInstance);
    }
  };

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
    unsavedData,
    setUnsavedData,
    data,
    beforeSave,
    onSave,
    saveTransform,
    onBuildPayload,
    saveUrl,
    afterSave,
    navigationRedirectPath,
    fetchData,
    hasNonEmptyValues,
    deleteUrl,
    setShowDeleteModal,
    setRowsToDelete,
    ensureBlankRow,
    columns,
    colHeaders,
    getExportFilename
  });

  // Enhanced context menu - now handleAfterContextMenu is defined
  const enhancedContextMenu = createContextMenu(tableRef, setIsDirty, handleAfterContextMenu);

  // Current visible columns and headers
  const enhancedColumns = createVisibleColumns();
  const visibleColHeaders = createVisibleHeaders();

  // Refs and imperative handle
  useImperativeHandle(ref, () => ({
    hotInstance: tableRef.current?.hotInstance,
    refreshData: fetchData,
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
        const rowData = unsavedData[physicalRow];
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
  }, [unsavedData]);

  // Column updates
  useEffect(() => {
    if (tableRef.current?.hotInstance && Object.keys(visibleColumns).length > 0) {
      const hot = tableRef.current.hotInstance;
      
      const updatedData = unsavedData.map(row => {
        const newRow = { ...row };
        columns.forEach(col => {
          if (col.data && !(col.data in newRow)) {
            newRow[col.data] = '';
          }
        });
        return newRow;
      });
      
      const needsDataUpdate = updatedData.length > 0 && 
        unsavedData.length > 0 && 
        Object.keys(updatedData[0] || {}).length !== Object.keys(unsavedData[0] || {}).length;
      
      if (needsDataUpdate) {
        setUnsavedData(updatedData);
      }
      
      hot.updateSettings({
        columns: enhancedColumns,
        colHeaders: visibleColHeaders
      });
    }
  }, [columns, colHeaders, visibleColumns, customRenderers, dropdownSources]);

  // Quick search
  useEffect(() => {
    if (originalData.length > 0) {
      const searchResults = performQuickSearch(originalData, quickSearch);
      const dataWithBlankRow = ensureBlankRow(searchResults);
      setUnsavedData(dataWithBlankRow);
      
      // Reset pagination when search changes
      if (enablePagination) {
        pagination.resetPagination();
      }
    }
  }, [quickSearch, originalData]);

  // Table change handler
  const handleAfterChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const updated = [...unsavedData];
    let dataChanged = false;
    let shouldAddNewRow = false;
    
    changes.forEach(([visualRow, prop, oldVal, newVal]) => {
      if (oldVal !== newVal) {
        const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
        if (physicalRow !== null) {
          updated[physicalRow] = { ...updated[physicalRow], [prop]: newVal, saved: false };
          dataChanged = true;
          
          if (physicalRow === updated.length - 1) {
            const isNotEmpty = Boolean(
              typeof newVal === "string" ? newVal.trim() : 
              typeof newVal === "boolean" ? newVal : 
              typeof newVal === "number" ? newVal !== 0 : 
              newVal !== null && newVal !== undefined
            );
            
            if (isNotEmpty) {
              shouldAddNewRow = true;
            }
          }
        }
      }
    });

    if (dataChanged) {
      if (shouldAddNewRow) {
        updated.push({ ...newRowTemplate });
      }
      setUnsavedData(updated);
      setIsDirty(true);
    }
  };

  // Filter change handler
  const handleFilterChange = (filteredData) => {
    const searchResults = quickSearch ? performQuickSearch(filteredData, quickSearch) : filteredData;
    const dataWithBlankRow = ensureBlankRow(searchResults);
    setUnsavedData(dataWithBlankRow);
    
    // Reset pagination when filter changes
    if (enablePagination) {
      pagination.resetPagination();
    }
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

  return (
    <div className={`modern-table-container ${enablePagination ? 'with-pagination' : ''}`}>
      <TableHeader
        loading={loading}
        isDirty={isDirty}
        onSave={handleSaveChanges}
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
        unsavedData={unsavedData}
        hasNonEmptyValues={hasNonEmptyValues}
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
          data={originalData}
          onFilterChange={handleFilterChange}
          visibleColumns={visibleColumns}
        />
      )}

      <div 
        ref={containerRef} 
        className="table-scroll-container"
        style={{ height }}
      >
        {loading && !unsavedData.length ? (
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
              data={displayData}
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
                // Force a layout recalculation after init for cross-browser compatibility
                if (tableRef.current?.hotInstance) {
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
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalRows={pagination.totalRows}
          onPageChange={pagination.handlePageChange}
          onPageSizeChange={pagination.handlePageSizeChange}
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
            
            const updatedData = unsavedData.filter(item => 
              !rowsToDelete.some(deleteItem => deleteItem.id === item.id)
            );
            const dataWithBlankRow = ensureBlankRow(updatedData);
            setUnsavedData(dataWithBlankRow);
            setSaveStatus("Items deleted successfully!");
            setIsDirty(true);
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