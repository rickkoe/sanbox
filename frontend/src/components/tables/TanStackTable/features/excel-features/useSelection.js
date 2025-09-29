import { useCallback, useRef, useEffect } from 'react';

/**
 * Excel-like cell selection hook
 * Handles mouse-based range selection with drag support
 */
export function useSelection({
  table,
  containerRef,
  enabled = true,
  selectedCells,
  setSelectedCells,
  selectionRange,
  setSelectionRange,
  isSelecting,
  setIsSelecting,
  onSelectionChange,
}) {
  const mouseStateRef = useRef({
    isDragging: false,
    startCell: null,
    currentCell: null,
  });

  // Handle mouse down on table cells
  const handleMouseDown = useCallback((e) => {
    if (!enabled) return;

    const cellElement = e.target.closest('[data-cell-key]');
    if (!cellElement) return;

    const rowIndex = parseInt(cellElement.getAttribute('data-row-index'), 10);
    const colIndex = parseInt(cellElement.getAttribute('data-col-index'), 10);

    if (isNaN(rowIndex) || isNaN(colIndex)) return;

    mouseStateRef.current = {
      isDragging: true,
      startCell: { row: rowIndex, col: colIndex },
      currentCell: { row: rowIndex, col: colIndex },
    };

    setIsSelecting(true);

    // Handle different selection modes
    if (e.shiftKey && selectionRange) {
      // Extend existing selection
      const newRange = {
        startRow: selectionRange.startRow,
        startCol: selectionRange.startCol,
        endRow: rowIndex,
        endCol: colIndex,
      };

      updateSelectionFromRange(newRange);
      setSelectionRange(newRange);

    } else if (e.ctrlKey || e.metaKey) {
      // Toggle cell selection
      const cellKey = `${rowIndex}-${colIndex}`;
      const newSelection = new Set(selectedCells);

      if (selectedCells.has(cellKey)) {
        newSelection.delete(cellKey);
      } else {
        newSelection.add(cellKey);
      }

      setSelectedCells(newSelection);

    } else {
      // Start new selection
      const cellKey = `${rowIndex}-${colIndex}`;
      setSelectedCells(new Set([cellKey]));
      setSelectionRange({
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      });
    }

    e.preventDefault();
  }, [enabled, selectedCells, setSelectedCells, selectionRange, setSelectionRange, setIsSelecting]);

  // Handle mouse move for drag selection
  const handleMouseMove = useCallback((e) => {
    if (!enabled || !mouseStateRef.current.isDragging) return;

    const cellElement = e.target.closest('[data-cell-key]');
    if (!cellElement) return;

    const rowIndex = parseInt(cellElement.getAttribute('data-row-index'), 10);
    const colIndex = parseInt(cellElement.getAttribute('data-col-index'), 10);

    if (isNaN(rowIndex) || isNaN(colIndex)) return;

    const { startCell } = mouseStateRef.current;
    if (!startCell) return;

    // Update current cell
    mouseStateRef.current.currentCell = { row: rowIndex, col: colIndex };

    // Create selection range
    const newRange = {
      startRow: Math.min(startCell.row, rowIndex),
      endRow: Math.max(startCell.row, rowIndex),
      startCol: Math.min(startCell.col, colIndex),
      endCol: Math.max(startCell.col, colIndex),
    };

    updateSelectionFromRange(newRange);
    setSelectionRange(newRange);

    e.preventDefault();
  }, [enabled, setSelectedCells, setSelectionRange]);

  // Handle mouse up to end selection
  const handleMouseUp = useCallback((e) => {
    if (!enabled) return;

    if (mouseStateRef.current.isDragging) {
      mouseStateRef.current.isDragging = false;
      setIsSelecting(false);

      // Notify selection change
      if (onSelectionChange && selectionRange) {
        const selectedData = getSelectedCellsData();
        onSelectionChange(selectedData);
      }
    }
  }, [enabled, setIsSelecting, onSelectionChange, selectionRange]);

  // Update selected cells based on range
  const updateSelectionFromRange = useCallback((range) => {
    const { startRow, endRow, startCol, endCol } = range;
    const newSelection = new Set();

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        newSelection.add(`${row}-${col}`);
      }
    }

    setSelectedCells(newSelection);
  }, [setSelectedCells]);

  // Get data for selected cells
  const getSelectedCellsData = useCallback(() => {
    if (!selectionRange) return [];

    const { startRow, endRow, startCol, endCol } = selectionRange;
    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const data = [];

    for (let r = startRow; r <= endRow; r++) {
      const row = rows[r];
      if (!row) continue;

      for (let c = startCol; c <= endCol; c++) {
        const column = columns[c];
        if (!column) continue;

        const value = row.getValue(column.id);
        data.push({
          rowIndex: r,
          colIndex: c,
          columnId: column.id,
          value,
          row,
          column,
        });
      }
    }

    return data;
  }, [table, selectionRange]);

  // Handle clicks outside to clear selection
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (e) => {
      // Check if click is outside the table container
      if (containerRef?.current && !containerRef.current.contains(e.target)) {
        setSelectedCells(new Set());
        setSelectionRange(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [enabled, containerRef, setSelectedCells, setSelectionRange]);

  // Handle global mouse up (in case mouse leaves table during drag)
  useEffect(() => {
    if (!enabled) return;

    const handleGlobalMouseUp = () => {
      if (mouseStateRef.current.isDragging) {
        mouseStateRef.current.isDragging = false;
        setIsSelecting(false);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [enabled, setIsSelecting]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getSelectedCellsData,
    updateSelectionFromRange,
  };
}