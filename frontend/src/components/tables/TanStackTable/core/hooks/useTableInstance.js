import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  advancedTextFilter,
  multiSelectFilter,
  numberRangeFilter,
  dateFilter,
  booleanFilter,
  enhancedGlobalFilter,
} from '../../utils/customFilterFunctions';

/**
 * Core TanStack table instance hook
 * Replaces Handsontable with TanStack Table while maintaining similar API
 */
export function useTableInstance({
  data = [],
  columns = [],
  options = {},
  sorting = [],
  setSorting,
  columnFilters = [],
  setColumnFilters,
  rowSelection = {},
  setRowSelection,
  globalFilter = '',
  setGlobalFilter,
  pagination = { pageIndex: 0, pageSize: 50 },
  setPagination,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  enableRowSelection = true,
  enableColumnResizing = true,
  enableSorting = true,
  enableFiltering = true,
  getRowId = (row, index) => row.id?.toString() || index.toString(),
  ...additionalOptions
}) {

  // Memoize table options for performance
  const tableOptions = useMemo(() => ({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
      ...(manualPagination ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    ...(manualPagination ? { onPaginationChange: setPagination } : {}),

    // Row models
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(enableFiltering ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    ...(!manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),

    // Custom filter functions
    filterFns: {
      advancedTextFilter,
      multiSelectFilter,
      numberRangeFilter,
      dateFilter,
      booleanFilter,
    },
    globalFilterFn: enhancedGlobalFilter,

    // Configuration
    manualPagination,
    manualSorting,
    manualFiltering,
    enableRowSelection,
    enableColumnResizing,
    enableSorting,
    enableFiltering,
    enableColumnFilters: enableFiltering,
    enableGlobalFilter: enableFiltering,
    getRowId,

    // Performance optimizations
    debugTable: process.env.NODE_ENV === 'development',
    debugHeaders: process.env.NODE_ENV === 'development',
    debugColumns: process.env.NODE_ENV === 'development',

    // Additional options
    ...additionalOptions,
    ...options,
  }), [
    data,
    columns,
    sorting,
    columnFilters,
    rowSelection,
    globalFilter,
    pagination,
    setSorting,
    setColumnFilters,
    setRowSelection,
    setGlobalFilter,
    setPagination,
    manualPagination,
    manualSorting,
    manualFiltering,
    enableRowSelection,
    enableColumnResizing,
    enableSorting,
    enableFiltering,
    getRowId,
    additionalOptions,
    options,
  ]);

  const table = useReactTable(tableOptions);

  // Enhanced table instance with additional utilities
  return useMemo(() => ({
    // Core table instance
    ...table,

    // Convenience methods that match GenericTable API
    getVisibleRows: () => table.getRowModel().rows,
    getVisibleColumns: () => table.getVisibleLeafColumns(),
    getTotalRowCount: () => manualPagination ? (options.pageCount || 0) * pagination.pageSize : table.getFilteredRowModel().rows.length,
    getSelectedRowIds: () => Object.keys(rowSelection),
    getSelectedRows: () => table.getFilteredSelectedRowModel().rows,

    // Cell access methods
    getCellValue: (rowIndex, columnId) => {
      const row = table.getRowModel().rows[rowIndex];
      return row?.getValue(columnId);
    },

    setCellValue: (rowIndex, columnId, value) => {
      // This will be handled by the editing feature
      console.warn('setCellValue should be handled by editing feature');
    },

    // Utility methods for Excel-like features
    getAllCells: () => {
      const rows = table.getRowModel().rows;
      const columns = table.getVisibleLeafColumns();
      return rows.flatMap((row, rowIndex) =>
        columns.map((column, colIndex) => ({
          rowIndex,
          colIndex,
          columnId: column.id,
          value: row.getValue(column.id),
          row,
          column,
        }))
      );
    },

    // Performance helpers
    invalidateRowData: () => {
      // TanStack Table handles this automatically through state changes
    },

    render: () => {
      // TanStack Table doesn't have explicit render, it's handled by React
    },

  }), [table, manualPagination, options.pageCount, pagination.pageSize, rowSelection]);
}

export { flexRender };