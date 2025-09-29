import React, { useState, useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { flexRender } from '@tanstack/react-table';

// Core hooks
import { useTableInstance } from './core/hooks/useTableInstance';
import { useVirtualization } from './core/hooks/useVirtualization';
import { useServerPagination } from './core/hooks/useServerPagination';

// Feature hooks
import { useRowSelection } from './features/selection/useRowSelection';
import { useExcelFeatures } from './features/excel-features/useExcelFeatures';
import { useAdvancedFiltering } from './features/filtering/useAdvancedFiltering';
import { useExport } from './features/export/useExport';

// Components
import { TableHeader } from './components/TableHeader';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { Pagination } from './components/ui/Pagination';

// Utils
import { createColumnDefinitions } from './utils/columnDefinitions';

/**
 * TanStack Table component - High-performance replacement for GenericTable
 *
 * Features:
 * - Virtual scrolling for large datasets
 * - Server-side pagination and filtering
 * - Excel-like copy/paste, fill operations
 * - Advanced filtering and sorting
 * - Export functionality
 * - Column management
 * - Real-time editing
 */
const TanStackTable = forwardRef(({
  // Data and API
  apiUrl,
  apiParams = {},
  data: externalData,
  saveUrl,
  deleteUrl,

  // Column configuration
  columns = [],
  colHeaders = [],
  dropdownSources = {},
  customRenderers = {},
  colWidths,

  // Table behavior
  serverPagination = false,
  defaultPageSize = 50,
  enableVirtualization = true,
  enableRowSelection = true,
  enableFiltering = true,
  enableSorting = true,
  enableExport = true,

  // Excel-like features
  enableCopyPaste = true,
  enableFillOperations = true,
  enableKeyboardNavigation = true,

  // Editing
  enableEditing = false,
  newRowTemplate = null,

  // Events
  onSave,
  onDelete,
  onSelectionChange,
  onDataChange,
  beforeSave,
  afterSave,

  // UI customization
  height = '600px',
  storageKey,
  tableName = 'tanstack_table',

  // Migration compatibility
  preprocessData,
  saveTransform,
  getCellsConfig,

  ...otherProps
}, ref) => {

  // Simple defaults without context
  const settings = { items_per_page: 50 };
  const theme = 'light';

  // Refs
  const containerRef = useRef(null);
  const tableRef = useRef(null);

  // State
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Server pagination hook (if enabled)
  const serverPaginationState = useServerPagination({
    apiUrl: serverPagination ? apiUrl : null,
    initialPageSize: settings?.items_per_page || defaultPageSize,
    storageKey,
    quickSearch: globalFilter,
    columnFilters: Object.fromEntries(columnFilters.map(f => [f.id, f.value])),
    columns,
    colHeaders,
    dropdownSources,
    enabled: serverPagination,
  });

  // Data source - use server pagination or external data
  const tableData = useMemo(() => {
    let rawData = serverPagination ? serverPaginationState.data : (externalData || []);

    // Apply preprocessing if provided
    if (preprocessData && typeof preprocessData === 'function') {
      rawData = preprocessData(rawData);
    }

    return rawData || [];
  }, [serverPagination, serverPaginationState.data, externalData, preprocessData]);

  // Row selection hook
  const rowSelectionState = useRowSelection({
    enabled: enableRowSelection,
    onSelectionChange,
  });

  // Column definitions with TanStack Table format
  const columnDefs = useMemo(() => {
    return createColumnDefinitions(
      columns,
      colHeaders,
      customRenderers,
      dropdownSources,
      {
        enableSorting,
        enableFiltering,
        enableRowSelection,
        enableEditing,
        getCellsConfig,
      }
    );
  }, [columns, colHeaders, customRenderers, dropdownSources, enableSorting, enableFiltering, enableRowSelection, enableEditing, getCellsConfig]);

  // Main table instance
  const table = useTableInstance({
    data: tableData,
    columns: columnDefs,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    rowSelection: rowSelectionState.rowSelection,
    setRowSelection: rowSelectionState.setRowSelection,

    // Server-side configuration
    manualPagination: serverPagination,
    manualSorting: serverPagination,
    manualFiltering: serverPagination,
    pagination: serverPagination ? serverPaginationState.paginationState : undefined,
    setPagination: serverPagination ? serverPaginationState.setPaginationState : undefined,

    // Feature toggles
    enableRowSelection,
    enableColumnResizing: true,
    enableSorting,
    enableFiltering,

    // Performance
    debugTable: process.env.NODE_ENV === 'development',
  });

  // Virtualization (for large datasets)
  const virtualization = useVirtualization({
    table,
    containerRef,
    enableRowVirtualization: enableVirtualization && tableData.length > 100,
    enableColumnVirtualization: false, // Usually not needed
    rowHeight: 40,
    overscan: 20,
  });

  // Excel-like features
  const excelFeatures = useExcelFeatures({
    table,
    containerRef,
    enableCopyPaste,
    enableFillOperations,
    enableKeyboardNavigation,
    onDataChange: (changes) => {
      setIsDirty(true);
      if (onDataChange) onDataChange(changes);
    },
  });

  // Advanced filtering
  const filtering = useAdvancedFiltering({
    table,
    columns: columnDefs,
    dropdownSources,
    serverSide: serverPagination,
  });

  // Export functionality
  const exportFeatures = useExport({
    table,
    filename: tableName,
    enabled: enableExport,
  });

  // Save functionality
  const handleSave = useCallback(async () => {
    if (!isDirty || !saveUrl) return;

    setIsLoading(true);
    try {
      let dataToSave = tableData;

      // Apply save transform if provided
      if (saveTransform) {
        dataToSave = saveTransform(dataToSave);
      }

      // Call beforeSave validation if provided
      if (beforeSave) {
        const validationResult = beforeSave(dataToSave);
        if (validationResult !== true) {
          throw new Error(validationResult);
        }
      }

      // Use custom save handler or default API call
      if (onSave) {
        const result = await onSave(dataToSave);
        if (!result.success) {
          throw new Error(result.message);
        }
      } else {
        // Default save implementation
        const response = await fetch(saveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
        if (!response.ok) {
          throw new Error(`Save failed: ${response.statusText}`);
        }
      }

      setIsDirty(false);

      // Refresh data after save
      if (serverPagination) {
        await serverPaginationState.refresh();
      }

      // Call afterSave if provided
      if (afterSave) {
        await afterSave(dataToSave);
      }

    } catch (error) {
      console.error('Save failed:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false);
    }
  }, [isDirty, saveUrl, tableData, saveTransform, beforeSave, onSave, afterSave, serverPagination, serverPaginationState]);

  // Imperative handle for ref access
  useImperativeHandle(ref, () => ({
    // Table instance access
    table,

    // DOM refs
    containerRef: containerRef.current,
    tableRef: tableRef.current,

    // Data access
    getData: () => tableData,
    getSelectedRows: () => table.getSelectedRowModel().rows,

    // Actions
    refresh: serverPagination ? serverPaginationState.refresh : () => {},
    save: handleSave,
    exportCSV: exportFeatures.exportCSV,
    exportExcel: exportFeatures.exportExcel,

    // State
    isDirty,
    setIsDirty,

    // Excel features
    copySelection: excelFeatures.copySelection,
    pasteFromClipboard: excelFeatures.pasteFromClipboard,
    fillDown: excelFeatures.fillDown,
    fillRight: excelFeatures.fillRight,

    // Virtualization
    scrollToRow: virtualization.scrollToIndex.row,
    scrollToColumn: virtualization.scrollToIndex.column,
  }), [
    table,
    tableData,
    handleSave,
    isDirty,
    serverPagination,
    serverPaginationState,
    exportFeatures,
    excelFeatures,
    virtualization
  ]);

  // Render loading state
  if (serverPagination && serverPaginationState.loading && tableData.length === 0) {
    return (
      <div className={`tanstack-table-container theme-${theme}`} style={{ height }}>
        <LoadingOverlay message="Loading table data..." />
      </div>
    );
  }

  return (
    <div
      className={`tanstack-table-container theme-${theme}`}
      style={{ height, display: 'flex', flexDirection: 'column' }}
    >
      {/* Table Header with controls */}
      <TableHeader
        table={table}
        isDirty={isDirty}
        isLoading={isLoading}
        onSave={handleSave}
        onExportCSV={exportFeatures.exportCSV}
        onExportExcel={exportFeatures.exportExcel}
        filtering={filtering}
        enableExport={enableExport}
      />

      {/* Main table container */}
      <div
        ref={containerRef}
        className="table-scroll-container"
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
        {...virtualization.getScrollElementProps()}
      >
        {/* Virtual container */}
        <div {...virtualization.getInnerElementProps()}>
          {/* Table */}
          <table
            ref={tableRef}
            className="tanstack-table"
            style={{ width: '100%', borderCollapse: 'collapse' }}
            {...excelFeatures.getTableProps()}
          >
            {/* Header */}
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        borderBottom: '2px solid #e0e0e0',
                        borderRight: '1px solid #e0e0e0',
                        padding: '8px 12px',
                        textAlign: 'left',
                        backgroundColor: '#f5f5f5',
                        fontWeight: '600',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {header.isPlaceholder ? null : (
                          <>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' 🔼',
                              desc: ' 🔽',
                            }[header.column.getIsSorted()] ?? null}
                          </>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody>
              {virtualization.virtualRows.map((virtualRow) => {
                const row = table.getRowModel().rows[virtualRow.index];
                if (!row) return null;

                return (
                  <tr
                    key={row.id}
                    style={{
                      position: virtualization.rowVirtualizer ? 'absolute' : 'static',
                      top: virtualization.rowVirtualizer ? virtualRow.start : 'auto',
                      height: virtualization.rowVirtualizer ? virtualRow.size : 'auto',
                      width: '100%',
                    }}
                    {...excelFeatures.getRowProps(row)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          borderBottom: '1px solid #e0e0e0',
                          borderRight: '1px solid #e0e0e0',
                          padding: '8px 12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        {...excelFeatures.getCellProps(cell)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Loading overlay for refreshing */}
        {serverPagination && serverPaginationState.loading && tableData.length > 0 && (
          <LoadingOverlay message="Updating data..." overlay />
        )}
      </div>

      {/* Pagination footer */}
      {serverPagination && (
        <Pagination
          currentPage={serverPaginationState.currentPage}
          totalPages={serverPaginationState.totalPages}
          pageSize={serverPaginationState.pageSize}
          totalItems={serverPaginationState.totalCount}
          onPageChange={serverPaginationState.handlePageChange}
          onPageSizeChange={serverPaginationState.handlePageSizeChange}
          loading={serverPaginationState.loading}
        />
      )}

      {/* Excel selection overlay */}
      {excelFeatures.SelectionOverlay && <excelFeatures.SelectionOverlay />}
    </div>
  );
});

TanStackTable.displayName = 'TanStackTable';

export default TanStackTable;