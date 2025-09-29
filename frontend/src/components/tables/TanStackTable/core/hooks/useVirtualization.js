import { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtualization hook for high-performance table rendering
 * Handles both row and column virtualization for large datasets
 */
export function useVirtualization({
  table,
  containerRef,
  enableRowVirtualization = true,
  enableColumnVirtualization = false,
  rowHeight = 35,
  columnWidth = 150,
  estimateRowSize,
  estimateColumnSize,
  overscan = 50,
  scrollMargin = 0,
}) {
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  // Row virtualization
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef?.current,
    estimateSize: estimateRowSize || (() => rowHeight),
    overscan,
    scrollMargin,
    enabled: enableRowVirtualization && rows.length > 100, // Only virtualize for large datasets
  });

  // Column virtualization (optional, for very wide tables)
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => containerRef?.current,
    estimateSize: estimateColumnSize || (() => columnWidth),
    overscan: 10,
    scrollMargin,
    enabled: enableColumnVirtualization && columns.length > 50,
  });

  // Virtual items
  const virtualRows = enableRowVirtualization && rows.length > 100
    ? rowVirtualizer.getVirtualItems()
    : rows.map((_, index) => ({ index, start: index * rowHeight, size: rowHeight }));

  const virtualColumns = enableColumnVirtualization && columns.length > 50
    ? columnVirtualizer.getVirtualItems()
    : columns.map((_, index) => ({ index, start: index * columnWidth, size: columnWidth }));

  // Calculate total sizes for scroll areas
  const totalRowHeight = enableRowVirtualization && rows.length > 100
    ? rowVirtualizer.getTotalSize()
    : rows.length * rowHeight;

  const totalColumnWidth = enableColumnVirtualization && columns.length > 50
    ? columnVirtualizer.getTotalSize()
    : columns.reduce((acc, column) => acc + (column.getSize?.() || columnWidth), 0);

  // Scroll-to utilities
  const scrollToIndex = useMemo(() => ({
    row: (index, options = {}) => {
      if (enableRowVirtualization && rows.length > 100) {
        rowVirtualizer.scrollToIndex(index, options);
      } else {
        // Fallback for non-virtualized tables
        const element = containerRef?.current;
        if (element) {
          element.scrollTo({
            top: index * rowHeight,
            behavior: options.smooth ? 'smooth' : 'auto'
          });
        }
      }
    },
    column: (index, options = {}) => {
      if (enableColumnVirtualization && columns.length > 50) {
        columnVirtualizer.scrollToIndex(index, options);
      } else {
        const element = containerRef?.current;
        if (element) {
          const scrollLeft = virtualColumns
            .slice(0, index)
            .reduce((acc, col) => acc + (columns[col.index]?.getSize?.() || columnWidth), 0);
          element.scrollTo({
            left: scrollLeft,
            behavior: options.smooth ? 'smooth' : 'auto'
          });
        }
      }
    },
  }), [
    enableRowVirtualization,
    enableColumnVirtualization,
    rows.length,
    columns.length,
    rowVirtualizer,
    columnVirtualizer,
    containerRef,
    rowHeight,
    columnWidth,
    virtualColumns,
  ]);

  // Range calculations for visible cells
  const visibleRange = useMemo(() => ({
    rowStart: virtualRows[0]?.index || 0,
    rowEnd: virtualRows[virtualRows.length - 1]?.index || rows.length - 1,
    columnStart: virtualColumns[0]?.index || 0,
    columnEnd: virtualColumns[virtualColumns.length - 1]?.index || columns.length - 1,
  }), [virtualRows, virtualColumns, rows.length, columns.length]);

  // Performance metrics (dev only)
  const metrics = useMemo(() => {
    if (process.env.NODE_ENV !== 'development') return {};

    return {
      totalRows: rows.length,
      totalColumns: columns.length,
      visibleRows: virtualRows.length,
      visibleColumns: virtualColumns.length,
      rowVirtualizationActive: enableRowVirtualization && rows.length > 100,
      columnVirtualizationActive: enableColumnVirtualization && columns.length > 50,
      estimatedMemoryUsage: `${Math.round((virtualRows.length * virtualColumns.length * 100) / 1024)}KB`,
    };
  }, [rows.length, columns.length, virtualRows.length, virtualColumns.length, enableRowVirtualization, enableColumnVirtualization]);

  return {
    // Virtualizer instances
    rowVirtualizer: enableRowVirtualization && rows.length > 100 ? rowVirtualizer : null,
    columnVirtualizer: enableColumnVirtualization && columns.length > 50 ? columnVirtualizer : null,

    // Virtual items
    virtualRows,
    virtualColumns,

    // Dimensions
    totalRowHeight,
    totalColumnWidth,

    // Utilities
    scrollToIndex,
    visibleRange,

    // Performance info
    metrics,

    // Helper functions
    getRowProps: (virtualRow) => ({
      key: virtualRow.index,
      'data-index': virtualRow.index,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: virtualRow.size,
        transform: `translateY(${virtualRow.start}px)`,
      },
    }),

    getCellProps: (virtualRow, virtualColumn) => ({
      style: {
        position: 'absolute',
        top: virtualRow.start,
        left: virtualColumn.start,
        width: virtualColumn.size,
        height: virtualRow.size,
        borderRight: '1px solid #e0e0e0',
        borderBottom: '1px solid #e0e0e0',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      },
    }),

    // Layout helpers
    getScrollElementProps: () => ({
      style: {
        height: '100%',
        width: '100%',
        overflow: 'auto',
      },
    }),

    getInnerElementProps: () => ({
      style: {
        height: totalRowHeight,
        width: totalColumnWidth,
        position: 'relative',
      },
    }),
  };
}

/**
 * Simplified hook for basic row virtualization (most common case)
 */
export function useRowVirtualization({ table, containerRef, rowHeight = 35, overscan = 50 }) {
  return useVirtualization({
    table,
    containerRef,
    enableRowVirtualization: true,
    enableColumnVirtualization: false,
    rowHeight,
    overscan,
  });
}

/**
 * Hook for performance monitoring of virtualized tables
 */
export function useVirtualizationMetrics(virtualization) {
  return useMemo(() => {
    if (process.env.NODE_ENV !== 'development') return null;

    const { metrics, virtualRows, virtualColumns } = virtualization;

    return {
      ...metrics,
      renderRatio: {
        rows: `${virtualRows.length}/${metrics.totalRows} (${Math.round((virtualRows.length / metrics.totalRows) * 100)}%)`,
        columns: `${virtualColumns.length}/${metrics.totalColumns} (${Math.round((virtualColumns.length / metrics.totalColumns) * 100)}%)`,
      },
    };
  }, [virtualization]);
}