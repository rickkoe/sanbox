import { useCallback } from 'react';

/**
 * Copy/Paste functionality hook for Excel-like behavior
 * Supports multi-cell copy/paste with tab/newline delimited format
 */
export function useCopyPaste({
  table,
  selectedCells,
  selectionRange,
  enabled = true,
  onDataChange,
}) {

  // Convert selection to structured data for copying
  const getSelectedData = useCallback(() => {
    if (!selectionRange || selectedCells.size === 0) return null;

    const { startRow, endRow, startCol, endCol } = selectionRange;
    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();

    const data = [];

    for (let r = startRow; r <= endRow; r++) {
      const row = rows[r];
      if (!row) continue;

      const rowData = [];
      for (let c = startCol; c <= endCol; c++) {
        const column = columns[c];
        if (!column) continue;

        const value = row.getValue(column.id);
        rowData.push(formatValueForCopy(value));
      }
      data.push(rowData);
    }

    return data;
  }, [table, selectedCells, selectionRange]);

  // Copy selected cells to clipboard
  const copySelection = useCallback(async () => {
    if (!enabled || !selectionRange) return false;

    try {
      const data = getSelectedData();
      if (!data || data.length === 0) return false;

      // Convert to tab-delimited text (Excel format)
      const textData = data
        .map(row => row.join('\t'))
        .join('\n');

      // Create HTML format for richer copy experience
      const htmlData = createHtmlTable(data);

      // Create clipboard item with multiple formats
      const clipboardData = {
        'text/plain': textData,
        'text/html': htmlData,
      };

      // Use modern clipboard API if available
      if (navigator.clipboard && window.ClipboardItem) {
        const clipboardItems = Object.entries(clipboardData).map(([type, data]) =>
          new ClipboardItem({ [type]: new Blob([data], { type }) })
        );
        await navigator.clipboard.write(clipboardItems);
      } else {
        // Fallback to legacy method
        await navigator.clipboard.writeText(textData);
      }

      console.log(`📋 Copied ${data.length} rows, ${data[0]?.length || 0} columns`);
      return true;

    } catch (error) {
      console.error('Copy failed:', error);

      // Try alternative copy method
      try {
        const data = getSelectedData();
        const textData = data
          .map(row => row.join('\t'))
          .join('\n');

        // Create temporary textarea for fallback copy
        const textarea = document.createElement('textarea');
        textarea.value = textData;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        console.log('📋 Copied using fallback method');
        return true;
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
        return false;
      }
    }
  }, [enabled, selectionRange, getSelectedData]);

  // Paste from clipboard
  const pasteFromClipboard = useCallback(async () => {
    if (!enabled || !selectionRange) return false;

    try {
      // Try to read from clipboard
      let textData = '';

      if (navigator.clipboard && navigator.clipboard.readText) {
        textData = await navigator.clipboard.readText();
      } else {
        // Fallback - can't automatically paste, user needs to use Ctrl+V
        console.warn('Clipboard read not available, use Ctrl+V');
        return false;
      }

      if (!textData) return false;

      // Parse clipboard data
      const parsedData = parseClipboardData(textData);
      if (!parsedData || parsedData.length === 0) return false;

      // Apply paste to table
      return await applyPasteData(parsedData);

    } catch (error) {
      console.error('Paste failed:', error);
      return false;
    }
  }, [enabled, selectionRange]);

  // Parse clipboard text data into structured format
  const parseClipboardData = useCallback((text) => {
    if (!text) return null;

    // Split by lines and then by tabs
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    return lines.map(line => line.split('\t'));
  }, []);

  // Apply pasted data to table
  const applyPasteData = useCallback(async (data) => {
    if (!data || data.length === 0 || !selectionRange) return false;

    const { startRow, startCol } = selectionRange;
    const rows = table.getRowModel().rows;
    const columns = table.getVisibleLeafColumns();

    const changes = [];

    // Apply data starting from selection start position
    for (let pasteRow = 0; pasteRow < data.length; pasteRow++) {
      const tableRowIndex = startRow + pasteRow;
      const row = rows[tableRowIndex];

      if (!row) continue; // Skip if no row available

      const rowData = data[pasteRow];

      for (let pasteCol = 0; pasteCol < rowData.length; pasteCol++) {
        const tableColIndex = startCol + pasteCol;
        const column = columns[tableColIndex];

        if (!column) continue; // Skip if no column available

        const newValue = parseValueForPaste(rowData[pasteCol], column);
        const oldValue = row.getValue(column.id);

        if (newValue !== oldValue) {
          changes.push({
            rowIndex: tableRowIndex,
            columnId: column.id,
            oldValue,
            newValue,
            row,
            column,
          });
        }
      }
    }

    // Apply all changes
    if (changes.length > 0) {
      console.log(`📥 Pasting ${changes.length} changes`);

      if (onDataChange) {
        onDataChange(changes);
      }

      // Note: TanStack Table doesn't have direct cell editing like Handsontable
      // The actual data update should be handled by the parent component
      // through onDataChange callback

      return true;
    }

    return false;
  }, [table, selectionRange, onDataChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return false;

    const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
    const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';

    if (isCopy) {
      e.preventDefault();
      copySelection();
      return true;
    }

    if (isPaste) {
      e.preventDefault();
      pasteFromClipboard();
      return true;
    }

    return false;
  }, [enabled, copySelection, pasteFromClipboard]);

  return {
    copySelection,
    pasteFromClipboard,
    handleKeyDown,
    parseClipboardData,
    getSelectedData,
  };
}

// Helper functions

function formatValueForCopy(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  return String(value);
}

function parseValueForPaste(text, column) {
  if (!text || text === '') return null;

  // Check column type and parse accordingly
  const columnType = column.columnDef.meta?.type;

  switch (columnType) {
    case 'boolean':
      const lowerText = text.toLowerCase();
      return lowerText === 'true' || lowerText === 'yes' || lowerText === '1';

    case 'number':
    case 'integer':
      const num = parseFloat(text);
      return isNaN(num) ? null : num;

    case 'date':
      const date = new Date(text);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];

    default:
      return text;
  }
}

function createHtmlTable(data) {
  if (!data || data.length === 0) return '';

  const rows = data.map(row =>
    `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  ).join('');

  return `
    <table>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}