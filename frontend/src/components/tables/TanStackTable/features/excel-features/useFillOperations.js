import { useCallback } from 'react';

/**
 * Fill operations hook for Excel-like fill down/right/up/left functionality
 * Supports smart pattern detection and auto-increment for numbers and dates
 */
export function useFillOperations({
  table,
  selectedCells,
  selectionRange,
  enabled = true,
  onDataChange,
}) {

  // Fill down - copy top row values to all selected rows below
  const fillDown = useCallback(() => {
    if (!enabled || !selectionRange) return false;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    if (startRow >= endRow) return false; // Need at least 2 rows

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const changes = [];

    // Use first row as source
    const sourceRow = rows[startRow];
    if (!sourceRow) return false;

    // Fill each column in the selection
    for (let col = startCol; col <= endCol; col++) {
      const column = columns[col];
      if (!column) continue;

      const sourceValue = sourceRow.getValue(column.id);

      // Detect if we should auto-increment (numbers, dates, sequences)
      const shouldAutoIncrement = detectAutoIncrement(sourceValue, startRow, endRow);
      let currentValue = sourceValue;

      // Apply to all rows below the first
      for (let row = startRow + 1; row <= endRow; row++) {
        const targetRow = rows[row];
        if (!targetRow) continue;

        const oldValue = targetRow.getValue(column.id);

        if (shouldAutoIncrement) {
          currentValue = incrementValue(currentValue, row - startRow);
        }

        if (currentValue !== oldValue) {
          changes.push({
            rowIndex: row,
            columnId: column.id,
            oldValue,
            newValue: currentValue,
            row: targetRow,
            column,
          });
        }
      }
    }

    if (changes.length > 0) {
      console.log(`⬇️ Fill down: ${changes.length} changes`);
      if (onDataChange) onDataChange(changes);
      return true;
    }

    return false;
  }, [enabled, selectionRange, table, onDataChange]);

  // Fill right - copy leftmost column values to all selected columns to the right
  const fillRight = useCallback(() => {
    if (!enabled || !selectionRange) return false;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    if (startCol >= endCol) return false; // Need at least 2 columns

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const changes = [];

    // Use first column as source for each row
    for (let row = startRow; row <= endRow; row++) {
      const sourceRow = rows[row];
      if (!sourceRow) continue;

      const sourceColumn = columns[startCol];
      if (!sourceColumn) continue;

      const sourceValue = sourceRow.getValue(sourceColumn.id);

      // Detect if we should auto-increment
      const shouldAutoIncrement = detectAutoIncrement(sourceValue, startCol, endCol);
      let currentValue = sourceValue;

      // Apply to all columns to the right
      for (let col = startCol + 1; col <= endCol; col++) {
        const column = columns[col];
        if (!column) continue;

        const oldValue = sourceRow.getValue(column.id);

        if (shouldAutoIncrement) {
          currentValue = incrementValue(currentValue, col - startCol);
        }

        if (currentValue !== oldValue) {
          changes.push({
            rowIndex: row,
            columnId: column.id,
            oldValue,
            newValue: currentValue,
            row: sourceRow,
            column,
          });
        }
      }
    }

    if (changes.length > 0) {
      console.log(`➡️ Fill right: ${changes.length} changes`);
      if (onDataChange) onDataChange(changes);
      return true;
    }

    return false;
  }, [enabled, selectionRange, table, onDataChange]);

  // Fill up - copy bottom row values to all selected rows above
  const fillUp = useCallback(() => {
    if (!enabled || !selectionRange) return false;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    if (startRow >= endRow) return false; // Need at least 2 rows

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const changes = [];

    // Use last row as source
    const sourceRow = rows[endRow];
    if (!sourceRow) return false;

    // Fill each column in the selection
    for (let col = startCol; col <= endCol; col++) {
      const column = columns[col];
      if (!column) continue;

      const sourceValue = sourceRow.getValue(column.id);

      // Detect if we should auto-decrement (reverse increment)
      const shouldAutoIncrement = detectAutoIncrement(sourceValue, startRow, endRow);
      let currentValue = sourceValue;

      // Apply to all rows above the last
      for (let row = endRow - 1; row >= startRow; row--) {
        const targetRow = rows[row];
        if (!targetRow) continue;

        const oldValue = targetRow.getValue(column.id);

        if (shouldAutoIncrement) {
          currentValue = incrementValue(currentValue, -(endRow - row));
        }

        if (currentValue !== oldValue) {
          changes.push({
            rowIndex: row,
            columnId: column.id,
            oldValue,
            newValue: currentValue,
            row: targetRow,
            column,
          });
        }
      }
    }

    if (changes.length > 0) {
      console.log(`⬆️ Fill up: ${changes.length} changes`);
      if (onDataChange) onDataChange(changes);
      return true;
    }

    return false;
  }, [enabled, selectionRange, table, onDataChange]);

  // Fill left - copy rightmost column values to all selected columns to the left
  const fillLeft = useCallback(() => {
    if (!enabled || !selectionRange) return false;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    if (startCol >= endCol) return false; // Need at least 2 columns

    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();
    const changes = [];

    // Use last column as source for each row
    for (let row = startRow; row <= endRow; row++) {
      const sourceRow = rows[row];
      if (!sourceRow) continue;

      const sourceColumn = columns[endCol];
      if (!sourceColumn) continue;

      const sourceValue = sourceRow.getValue(sourceColumn.id);

      // Detect if we should auto-decrement
      const shouldAutoIncrement = detectAutoIncrement(sourceValue, startCol, endCol);
      let currentValue = sourceValue;

      // Apply to all columns to the left
      for (let col = endCol - 1; col >= startCol; col--) {
        const column = columns[col];
        if (!column) continue;

        const oldValue = sourceRow.getValue(column.id);

        if (shouldAutoIncrement) {
          currentValue = incrementValue(currentValue, -(endCol - col));
        }

        if (currentValue !== oldValue) {
          changes.push({
            rowIndex: row,
            columnId: column.id,
            oldValue,
            newValue: currentValue,
            row: sourceRow,
            column,
          });
        }
      }
    }

    if (changes.length > 0) {
      console.log(`⬅️ Fill left: ${changes.length} changes`);
      if (onDataChange) onDataChange(changes);
      return true;
    }

    return false;
  }, [enabled, selectionRange, table, onDataChange]);

  // Smart fill based on pattern detection
  const smartFill = useCallback((direction = 'down') => {
    if (!enabled || !selectionRange) return false;

    // Analyze existing values to detect patterns
    const pattern = detectPattern();
    if (!pattern) {
      // No pattern detected, use simple copy
      switch (direction) {
        case 'down': return fillDown();
        case 'right': return fillRight();
        case 'up': return fillUp();
        case 'left': return fillLeft();
        default: return false;
      }
    }

    // Apply pattern-based fill
    return applyPatternFill(pattern, direction);
  }, [enabled, selectionRange, fillDown, fillRight, fillUp, fillLeft]);

  // Handle keyboard shortcuts for fill operations
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return false;

    const isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl+D = Fill Down
    if (isCtrl && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      fillDown();
      return true;
    }

    // Ctrl+R = Fill Right
    if (isCtrl && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      fillRight();
      return true;
    }

    // Ctrl+Shift+D = Fill Up
    if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      fillUp();
      return true;
    }

    // Ctrl+Shift+R = Fill Left
    if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      fillLeft();
      return true;
    }

    return false;
  }, [enabled, fillDown, fillRight, fillUp, fillLeft]);

  // Detect pattern in selected range
  const detectPattern = useCallback(() => {
    if (!selectionRange) return null;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();

    // For now, implement simple pattern detection
    // Could be enhanced with more sophisticated pattern recognition
    if (endRow - startRow >= 1 && endCol === startCol) {
      // Single column, multiple rows - check for numeric sequence
      const column = columns[startCol];
      if (!column) return null;

      const values = [];
      for (let row = startRow; row <= Math.min(startRow + 2, endRow); row++) {
        const rowData = rows[row];
        if (rowData) {
          const value = rowData.getValue(column.id);
          values.push(value);
        }
      }

      return analyzeSequence(values);
    }

    return null;
  }, [selectionRange, table]);

  // Apply pattern-based fill
  const applyPatternFill = useCallback((pattern, direction) => {
    // Implementation would depend on pattern structure
    // For now, fallback to simple fill
    switch (direction) {
      case 'down': return fillDown();
      case 'right': return fillRight();
      case 'up': return fillUp();
      case 'left': return fillLeft();
      default: return false;
    }
  }, [fillDown, fillRight, fillUp, fillLeft]);

  return {
    fillDown,
    fillRight,
    fillUp,
    fillLeft,
    smartFill,
    handleKeyDown,
    detectPattern,
  };
}

// Helper functions

function detectAutoIncrement(value, start, end) {
  // Only auto-increment if we have multiple positions and value is incrementable
  if (end <= start) return false;

  // Check if value is a number
  if (typeof value === 'number') return true;

  // Check if value is a date
  if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
    return true;
  }

  // Check if value looks like a sequence (e.g., "Item 1", "Version 2")
  if (typeof value === 'string') {
    const match = value.match(/(\d+)$/);
    return match !== null;
  }

  return false;
}

function incrementValue(value, increment) {
  if (typeof value === 'number') {
    return value + increment;
  }

  if (value instanceof Date) {
    const newDate = new Date(value);
    newDate.setDate(newDate.getDate() + increment);
    return newDate;
  }

  if (typeof value === 'string') {
    // Try to parse as date first
    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime())) {
      dateValue.setDate(dateValue.getDate() + increment);
      return dateValue.toISOString().split('T')[0]; // Return as date string
    }

    // Look for trailing number
    const match = value.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const number = parseInt(match[2], 10);
      return prefix + (number + increment);
    }
  }

  // If no increment pattern found, return original value
  return value;
}

function analyzeSequence(values) {
  if (values.length < 2) return null;

  // Check for numeric sequence
  const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));

  if (numericValues.length >= 2) {
    const diff = numericValues[1] - numericValues[0];

    // Check if it's an arithmetic sequence
    let isArithmetic = true;
    for (let i = 2; i < numericValues.length; i++) {
      if (Math.abs((numericValues[i] - numericValues[i-1]) - diff) > 0.0001) {
        isArithmetic = false;
        break;
      }
    }

    if (isArithmetic) {
      return {
        type: 'arithmetic',
        increment: diff,
        startValue: numericValues[0],
      };
    }
  }

  // Could add more pattern types (geometric, date sequences, etc.)

  return null;
}