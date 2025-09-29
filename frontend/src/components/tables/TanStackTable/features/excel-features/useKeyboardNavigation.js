import { useCallback } from 'react';

/**
 * Keyboard navigation hook for Excel-like arrow key movement
 * Supports Shift+Arrow for selection extension and Ctrl+Arrow for jump navigation
 */
export function useKeyboardNavigation({
  table,
  containerRef,
  selectedCells,
  setSelectedCells,
  selectionRange,
  setSelectionRange,
  enabled = true,
}) {

  // Get current active cell (last selected cell or first in range)
  const getActiveCell = useCallback(() => {
    if (!selectionRange) return null;

    // Use the end position as the active cell
    return {
      row: selectionRange.endRow,
      col: selectionRange.endCol,
    };
  }, [selectionRange]);

  // Navigate to a specific cell
  const navigateToCell = useCallback((rowIndex, colIndex, extend = false) => {
    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();

    // Bounds checking
    const maxRow = rows.length - 1;
    const maxCol = columns.length - 1;

    const targetRow = Math.max(0, Math.min(maxRow, rowIndex));
    const targetCol = Math.max(0, Math.min(maxCol, colIndex));

    if (extend && selectionRange) {
      // Extend selection to target cell
      const newRange = {
        startRow: selectionRange.startRow,
        startCol: selectionRange.startCol,
        endRow: targetRow,
        endCol: targetCol,
      };

      updateSelectionFromRange(newRange);
      setSelectionRange(newRange);

    } else {
      // Move to target cell (single cell selection)
      const cellKey = `${targetRow}-${targetCol}`;
      setSelectedCells(new Set([cellKey]));
      setSelectionRange({
        startRow: targetRow,
        endRow: targetRow,
        startCol: targetCol,
        endCol: targetCol,
      });
    }

    // Scroll to make the cell visible
    scrollToCell(targetRow, targetCol);
  }, [table, selectionRange, setSelectedCells, setSelectionRange]);

  // Update selected cells based on range
  const updateSelectionFromRange = useCallback((range) => {
    const { startRow, endRow, startCol, endCol } = range;
    const newSelection = new Set();

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        newSelection.add(`${row}-${col}`);
      }
    }

    setSelectedCells(newSelection);
  }, [setSelectedCells]);

  // Scroll to make a cell visible
  const scrollToCell = useCallback((rowIndex, colIndex) => {
    if (!containerRef?.current) return;

    // Find the cell element
    const cellElement = containerRef.current.querySelector(
      `[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`
    );

    if (cellElement) {
      cellElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [containerRef]);

  // Navigation functions
  const navigateUp = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    navigateToCell(activeCell.row - 1, activeCell.col, extend);
    return true;
  }, [getActiveCell, navigateToCell]);

  const navigateDown = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    navigateToCell(activeCell.row + 1, activeCell.col, extend);
    return true;
  }, [getActiveCell, navigateToCell]);

  const navigateLeft = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    navigateToCell(activeCell.row, activeCell.col - 1, extend);
    return true;
  }, [getActiveCell, navigateToCell]);

  const navigateRight = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    navigateToCell(activeCell.row, activeCell.col + 1, extend);
    return true;
  }, [getActiveCell, navigateToCell]);

  // Jump navigation (Ctrl+Arrow) - jump to data boundaries
  const jumpUp = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const column = columns[activeCell.col];

    if (!column) return false;

    // Find first non-empty cell above, or go to top
    let targetRow = 0;

    for (let row = activeCell.row - 1; row >= 0; row--) {
      const rowData = rows[row];
      const value = rowData?.getValue(column.id);

      // If we hit empty cell after non-empty cells, stop before it
      if (value === null || value === undefined || value === '') {
        targetRow = row + 1;
        break;
      }
    }

    navigateToCell(targetRow, activeCell.col, extend);
    return true;
  }, [getActiveCell, navigateToCell, table]);

  const jumpDown = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const column = columns[activeCell.col];

    if (!column) return false;

    // Find last non-empty cell below, or go to bottom
    let targetRow = rows.length - 1;

    for (let row = activeCell.row + 1; row < rows.length; row++) {
      const rowData = rows[row];
      const value = rowData?.getValue(column.id);

      // If we hit empty cell after non-empty cells, stop before it
      if (value === null || value === undefined || value === '') {
        targetRow = row - 1;
        break;
      }
    }

    navigateToCell(targetRow, activeCell.col, extend);
    return true;
  }, [getActiveCell, navigateToCell, table]);

  const jumpLeft = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const row = rows[activeCell.row];

    if (!row) return false;

    // Find first non-empty cell to the left, or go to leftmost
    let targetCol = 0;

    for (let col = activeCell.col - 1; col >= 0; col--) {
      const column = columns[col];
      const value = row.getValue(column.id);

      // If we hit empty cell after non-empty cells, stop before it
      if (value === null || value === undefined || value === '') {
        targetCol = col + 1;
        break;
      }
    }

    navigateToCell(activeCell.row, targetCol, extend);
    return true;
  }, [getActiveCell, navigateToCell, table]);

  const jumpRight = useCallback((extend = false) => {
    const activeCell = getActiveCell();
    if (!activeCell) return false;

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const row = rows[activeCell.row];

    if (!row) return false;

    // Find last non-empty cell to the right, or go to rightmost
    let targetCol = columns.length - 1;

    for (let col = activeCell.col + 1; col < columns.length; col++) {
      const column = columns[col];
      const value = row.getValue(column.id);

      // If we hit empty cell after non-empty cells, stop before it
      if (value === null || value === undefined || value === '') {
        targetCol = col - 1;
        break;
      }
    }

    navigateToCell(activeCell.row, targetCol, extend);
    return true;
  }, [getActiveCell, navigateToCell, table]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e) => {
    if (!enabled || !selectionRange) return false;

    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (isCtrl) {
          jumpUp(isShift);
        } else {
          navigateUp(isShift);
        }
        return true;

      case 'ArrowDown':
        e.preventDefault();
        if (isCtrl) {
          jumpDown(isShift);
        } else {
          navigateDown(isShift);
        }
        return true;

      case 'ArrowLeft':
        e.preventDefault();
        if (isCtrl) {
          jumpLeft(isShift);
        } else {
          navigateLeft(isShift);
        }
        return true;

      case 'ArrowRight':
        e.preventDefault();
        if (isCtrl) {
          jumpRight(isShift);
        } else {
          navigateRight(isShift);
        }
        return true;

      case 'Home':
        e.preventDefault();
        if (isCtrl) {
          // Ctrl+Home: Go to A1
          navigateToCell(0, 0, isShift);
        } else {
          // Home: Go to beginning of row
          const activeCell = getActiveCell();
          if (activeCell) {
            navigateToCell(activeCell.row, 0, isShift);
          }
        }
        return true;

      case 'End':
        e.preventDefault();
        if (isCtrl) {
          // Ctrl+End: Go to last cell with data
          const rows = table.getRowModel().rows;
          const columns = table.getVisibleLeafColumns();
          navigateToCell(rows.length - 1, columns.length - 1, isShift);
        } else {
          // End: Go to end of row
          const activeCell = getActiveCell();
          const columns = table.getVisibleLeafColumns();
          if (activeCell) {
            navigateToCell(activeCell.row, columns.length - 1, isShift);
          }
        }
        return true;

      case 'PageUp':
        e.preventDefault();
        {
          const activeCell = getActiveCell();
          if (activeCell) {
            // Move up by ~10 rows (or to top)
            const targetRow = Math.max(0, activeCell.row - 10);
            navigateToCell(targetRow, activeCell.col, isShift);
          }
        }
        return true;

      case 'PageDown':
        e.preventDefault();
        {
          const activeCell = getActiveCell();
          if (activeCell) {
            // Move down by ~10 rows (or to bottom)
            const rows = table.getRowModel().rows;
            const targetRow = Math.min(rows.length - 1, activeCell.row + 10);
            navigateToCell(targetRow, activeCell.col, isShift);
          }
        }
        return true;

      case 'Tab':
        e.preventDefault();
        if (isShift) {
          navigateLeft(false);
        } else {
          navigateRight(false);
        }
        return true;

      case 'Enter':
        e.preventDefault();
        if (isShift) {
          navigateUp(false);
        } else {
          navigateDown(false);
        }
        return true;

      default:
        return false;
    }
  }, [
    enabled,
    selectionRange,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    jumpUp,
    jumpDown,
    jumpLeft,
    jumpRight,
    navigateToCell,
    getActiveCell,
    table,
  ]);

  return {
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    jumpUp,
    jumpDown,
    jumpLeft,
    jumpRight,
    navigateToCell,
    handleKeyDown,
    getActiveCell,
    scrollToCell,
  };
}