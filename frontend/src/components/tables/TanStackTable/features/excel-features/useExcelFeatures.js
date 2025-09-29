import { useCallback, useRef, useState, useEffect } from 'react';
import { useCopyPaste } from './useCopyPaste';
import { useFillOperations } from './useFillOperations';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useSelection } from './useSelection';

/**
 * Main Excel-like features hook
 * Combines all Excel functionality: copy/paste, fill operations, keyboard navigation, selection
 */
export function useExcelFeatures({
  table,
  containerRef,
  enableCopyPaste = true,
  enableFillOperations = true,
  enableKeyboardNavigation = true,
  enableSelection = true,
  onDataChange,
  onSelectionChange,
}) {
  // Selection state
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectionRange, setSelectionRange] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Refs for event handling
  const eventHandlersRef = useRef({});
  const lastClickRef = useRef(null);

  // Individual feature hooks
  const selection = useSelection({
    table,
    containerRef,
    enabled: enableSelection,
    selectedCells,
    setSelectedCells,
    selectionRange,
    setSelectionRange,
    isSelecting,
    setIsSelecting,
    onSelectionChange,
  });

  const copyPaste = useCopyPaste({
    table,
    selectedCells,
    selectionRange,
    enabled: enableCopyPaste,
    onDataChange,
  });

  const fillOperations = useFillOperations({
    table,
    selectedCells,
    selectionRange,
    enabled: enableFillOperations,
    onDataChange,
  });

  const keyboardNavigation = useKeyboardNavigation({
    table,
    containerRef,
    selectedCells,
    setSelectedCells,
    selectionRange,
    setSelectionRange,
    enabled: enableKeyboardNavigation,
  });

  // Clear selection when table data changes
  useEffect(() => {
    setSelectedCells(new Set());
    setSelectionRange(null);
  }, [table.getRowModel().rows.length]);

  // Combined event handlers for table elements
  const getTableProps = useCallback(() => ({
    onMouseDown: (e) => {
      // Delegate to selection handler
      if (selection.handleMouseDown) {
        selection.handleMouseDown(e);
      }
    },
    onMouseMove: (e) => {
      if (selection.handleMouseMove) {
        selection.handleMouseMove(e);
      }
    },
    onMouseUp: (e) => {
      if (selection.handleMouseUp) {
        selection.handleMouseUp(e);
      }
    },
    onKeyDown: (e) => {
      // Handle keyboard events in priority order

      // 1. Copy/Paste shortcuts
      if (enableCopyPaste && copyPaste.handleKeyDown && copyPaste.handleKeyDown(e)) {
        return; // Event was handled
      }

      // 2. Fill operations shortcuts
      if (enableFillOperations && fillOperations.handleKeyDown && fillOperations.handleKeyDown(e)) {
        return; // Event was handled
      }

      // 3. Keyboard navigation
      if (enableKeyboardNavigation && keyboardNavigation.handleKeyDown) {
        keyboardNavigation.handleKeyDown(e);
      }
    },
    tabIndex: 0, // Make table focusable
    style: {
      outline: 'none', // Remove browser focus outline
      userSelect: 'none', // Prevent text selection
    },
  }), [
    selection,
    copyPaste,
    fillOperations,
    keyboardNavigation,
    enableCopyPaste,
    enableFillOperations,
    enableKeyboardNavigation,
  ]);

  // Props for individual rows
  const getRowProps = useCallback((row) => {
    const rowIndex = row.index;

    return {
      'data-row-index': rowIndex,
      onMouseDown: (e) => {
        lastClickRef.current = { type: 'row', index: rowIndex, timestamp: Date.now() };

        // Handle row selection
        if (e.shiftKey && selectionRange) {
          // Extend selection to this row
          const startRow = Math.min(selectionRange.startRow, rowIndex);
          const endRow = Math.max(selectionRange.endRow, rowIndex);

          const newSelection = new Set();
          for (let r = startRow; r <= endRow; r++) {
            const rowCells = table.getRowModel().rows[r]?.getVisibleCells() || [];
            rowCells.forEach((cell, c) => {
              newSelection.add(`${r}-${c}`);
            });
          }

          setSelectedCells(newSelection);
          setSelectionRange({
            ...selectionRange,
            endRow: rowIndex,
            endCol: table.getVisibleLeafColumns().length - 1,
          });

        } else if (e.ctrlKey || e.metaKey) {
          // Add/remove row from selection
          const rowCells = row.getVisibleCells();
          const newSelection = new Set(selectedCells);

          const isRowSelected = rowCells.every((cell, c) =>
            selectedCells.has(`${rowIndex}-${c}`)
          );

          if (isRowSelected) {
            // Remove row
            rowCells.forEach((cell, c) => {
              newSelection.delete(`${rowIndex}-${c}`);
            });
          } else {
            // Add row
            rowCells.forEach((cell, c) => {
              newSelection.add(`${rowIndex}-${c}`);
            });
          }

          setSelectedCells(newSelection);

        } else {
          // Select entire row
          const rowCells = row.getVisibleCells();
          const newSelection = new Set();

          rowCells.forEach((cell, c) => {
            newSelection.add(`${rowIndex}-${c}`);
          });

          setSelectedCells(newSelection);
          setSelectionRange({
            startRow: rowIndex,
            endRow: rowIndex,
            startCol: 0,
            endCol: rowCells.length - 1,
          });
        }

        e.preventDefault();
      },
      className: `table-row ${selectedCells.has(`${rowIndex}-0`) ? 'row-selected' : ''}`,
    };
  }, [selectedCells, selectionRange, table]);

  // Props for individual cells
  const getCellProps = useCallback((cell) => {
    const rowIndex = cell.row.index;
    const colIndex = cell.column.getIndex?.() || 0;
    const cellKey = `${rowIndex}-${colIndex}`;
    const isSelected = selectedCells.has(cellKey);

    return {
      'data-row-index': rowIndex,
      'data-col-index': colIndex,
      'data-cell-key': cellKey,
      className: `table-cell ${isSelected ? 'cell-selected' : ''}`,
      onMouseDown: (e) => {
        lastClickRef.current = {
          type: 'cell',
          row: rowIndex,
          col: colIndex,
          timestamp: Date.now()
        };

        // Handle cell selection
        if (e.shiftKey && selectionRange) {
          // Extend selection
          const startRow = Math.min(selectionRange.startRow, rowIndex);
          const endRow = Math.max(selectionRange.endRow, rowIndex);
          const startCol = Math.min(selectionRange.startCol, colIndex);
          const endCol = Math.max(selectionRange.endCol, colIndex);

          const newSelection = new Set();
          for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
              newSelection.add(`${r}-${c}`);
            }
          }

          setSelectedCells(newSelection);
          setSelectionRange({
            ...selectionRange,
            endRow: rowIndex,
            endCol: colIndex,
          });

        } else if (e.ctrlKey || e.metaKey) {
          // Toggle cell selection
          const newSelection = new Set(selectedCells);
          if (selectedCells.has(cellKey)) {
            newSelection.delete(cellKey);
          } else {
            newSelection.add(cellKey);
          }
          setSelectedCells(newSelection);

        } else {
          // Select single cell
          setSelectedCells(new Set([cellKey]));
          setSelectionRange({
            startRow: rowIndex,
            endRow: rowIndex,
            startCol: colIndex,
            endCol: colIndex,
          });
        }

        // Focus the table for keyboard events
        if (containerRef?.current) {
          containerRef.current.focus();
        }

        e.preventDefault();
      },
      style: {
        backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
        border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        cursor: 'cell',
      },
    };
  }, [selectedCells, selectionRange, containerRef]);

  // Utility methods
  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setSelectionRange(null);
  }, []);

  const selectAll = useCallback(() => {
    const rows = table.getRowModel().rows;
    const cols = table.getVisibleLeafColumns();

    const newSelection = new Set();
    rows.forEach((row, r) => {
      cols.forEach((col, c) => {
        newSelection.add(`${r}-${c}`);
      });
    });

    setSelectedCells(newSelection);
    setSelectionRange({
      startRow: 0,
      endRow: rows.length - 1,
      startCol: 0,
      endCol: cols.length - 1,
    });
  }, [table]);

  const selectRow = useCallback((rowIndex) => {
    const cols = table.getVisibleLeafColumns();
    const newSelection = new Set();

    cols.forEach((col, c) => {
      newSelection.add(`${rowIndex}-${c}`);
    });

    setSelectedCells(newSelection);
    setSelectionRange({
      startRow: rowIndex,
      endRow: rowIndex,
      startCol: 0,
      endCol: cols.length - 1,
    });
  }, [table]);

  const selectColumn = useCallback((colIndex) => {
    const rows = table.getRowModel().rows;
    const newSelection = new Set();

    rows.forEach((row, r) => {
      newSelection.add(`${r}-${colIndex}`);
    });

    setSelectedCells(newSelection);
    setSelectionRange({
      startRow: 0,
      endRow: rows.length - 1,
      startCol: colIndex,
      endCol: colIndex,
    });
  }, [table]);

  // Expose all features and utilities
  return {
    // Selection state
    selectedCells,
    selectionRange,
    isSelecting,

    // Event handlers
    getTableProps,
    getRowProps,
    getCellProps,

    // Selection utilities
    clearSelection,
    selectAll,
    selectRow,
    selectColumn,

    // Copy/Paste
    copySelection: copyPaste.copySelection,
    pasteFromClipboard: copyPaste.pasteFromClipboard,

    // Fill operations
    fillDown: fillOperations.fillDown,
    fillRight: fillOperations.fillRight,
    fillUp: fillOperations.fillUp,
    fillLeft: fillOperations.fillLeft,

    // Keyboard navigation
    navigateUp: keyboardNavigation.navigateUp,
    navigateDown: keyboardNavigation.navigateDown,
    navigateLeft: keyboardNavigation.navigateLeft,
    navigateRight: keyboardNavigation.navigateRight,

    // Feature states (for debugging)
    _debug: process.env.NODE_ENV === 'development' ? {
      copyPasteEnabled: enableCopyPaste,
      fillOperationsEnabled: enableFillOperations,
      keyboardNavigationEnabled: enableKeyboardNavigation,
      selectionEnabled: enableSelection,
      selectedCellCount: selectedCells.size,
    } : undefined,
  };
}