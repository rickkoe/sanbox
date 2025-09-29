import { useState, useCallback, useMemo } from 'react';

/**
 * Row selection hook for TanStack Table
 * Provides row-level selection functionality with callbacks
 */
export function useRowSelection({
  enabled = true,
  onSelectionChange,
  initialSelection = {},
}) {
  const [rowSelection, setRowSelection] = useState(initialSelection);

  // Handle selection changes with callback
  const handleSelectionChange = useCallback((updaterOrValue) => {
    const newSelection = typeof updaterOrValue === 'function'
      ? updaterOrValue(rowSelection)
      : updaterOrValue;

    setRowSelection(newSelection);

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    }
  }, [rowSelection, onSelectionChange]);

  // Selection utilities
  const selectionUtils = useMemo(() => ({
    getSelectedRowIds: () => Object.keys(rowSelection).filter(key => rowSelection[key]),
    getSelectedRowCount: () => Object.values(rowSelection).filter(Boolean).length,
    isRowSelected: (rowId) => Boolean(rowSelection[rowId]),
    selectRow: (rowId) => handleSelectionChange({ ...rowSelection, [rowId]: true }),
    deselectRow: (rowId) => handleSelectionChange({ ...rowSelection, [rowId]: false }),
    toggleRow: (rowId) => handleSelectionChange({
      ...rowSelection,
      [rowId]: !rowSelection[rowId]
    }),
    selectAll: (rowIds) => {
      const allSelected = {};
      rowIds.forEach(id => { allSelected[id] = true; });
      handleSelectionChange(allSelected);
    },
    deselectAll: () => handleSelectionChange({}),
    isAllSelected: (rowIds) => rowIds.every(id => rowSelection[id]),
    isPartiallySelected: (rowIds) => {
      const selectedCount = rowIds.filter(id => rowSelection[id]).length;
      return selectedCount > 0 && selectedCount < rowIds.length;
    },
  }), [rowSelection, handleSelectionChange]);

  return {
    rowSelection,
    setRowSelection: enabled ? handleSelectionChange : () => {},
    ...selectionUtils,
    enabled,
  };
}