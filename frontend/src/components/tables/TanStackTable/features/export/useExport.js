import { useCallback } from 'react';
import * as XLSX from 'xlsx';

/**
 * Export functionality hook for TanStack Table
 * Provides CSV and Excel export capabilities
 */
export function useExport({
  table,
  filename = 'table_export',
  enabled = true,
}) {

  // Export to CSV format
  const exportCSV = useCallback(async (options = {}) => {
    if (!enabled) return false;

    try {
      const {
        includeHeaders = true,
        visibleOnly = true,
        selectedOnly = false,
        customFilename,
      } = options;

      const data = getData(visibleOnly, selectedOnly);
      const headers = getHeaders(visibleOnly);

      if (data.length === 0) {
        console.warn('No data to export');
        return false;
      }

      // Convert to CSV format
      const csvContent = convertToCSV(data, headers, includeHeaders);

      // Download CSV file
      const finalFilename = customFilename || `${filename}_${getTimestamp()}.csv`;
      downloadFile(csvContent, finalFilename, 'text/csv');

      console.log(`📊 Exported ${data.length} rows to CSV: ${finalFilename}`);
      return true;

    } catch (error) {
      console.error('CSV export failed:', error);
      return false;
    }
  }, [enabled, table, filename]);

  // Export to Excel format
  const exportExcel = useCallback(async (options = {}) => {
    if (!enabled) return false;

    try {
      const {
        includeHeaders = true,
        visibleOnly = true,
        selectedOnly = false,
        customFilename,
        sheetName = 'Sheet1',
        includeMetadata = false,
      } = options;

      const data = getData(visibleOnly, selectedOnly);
      const headers = getHeaders(visibleOnly);

      if (data.length === 0) {
        console.warn('No data to export');
        return false;
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Convert data to worksheet format
      const worksheetData = includeHeaders ? [headers, ...data] : data;
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Apply basic formatting
      const range = XLSX.utils.decode_range(worksheet['!ref']);

      // Style headers if included
      if (includeHeaders) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
          const cell = worksheet[cellAddress];
          if (cell) {
            cell.s = {
              font: { bold: true },
              fill: { fgColor: { rgb: 'F0F0F0' } },
            };
          }
        }
      }

      // Auto-size columns
      const columnWidths = headers.map((header, index) => {
        const maxLength = Math.max(
          header.toString().length,
          ...data.map(row => (row[index] || '').toString().length)
        );
        return { width: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Add metadata sheet if requested
      if (includeMetadata) {
        addMetadataSheet(workbook, data.length, headers.length);
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });

      const finalFilename = customFilename || `${filename}_${getTimestamp()}.xlsx`;
      downloadFile(
        new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        finalFilename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      console.log(`📈 Exported ${data.length} rows to Excel: ${finalFilename}`);
      return true;

    } catch (error) {
      console.error('Excel export failed:', error);
      return false;
    }
  }, [enabled, table, filename]);

  // Get data for export
  const getData = useCallback((visibleOnly = true, selectedOnly = false) => {
    let rows = table.getRowModel().rows;

    // Filter to selected rows only if requested
    if (selectedOnly) {
      rows = table.getSelectedRowModel().rows;
    }

    // Get visible columns
    const columns = visibleOnly
      ? table.getVisibleLeafColumns()
      : table.getAllLeafColumns();

    // Extract data
    return rows.map(row =>
      columns.map(column => {
        const value = row.getValue(column.id);
        return formatValueForExport(value);
      })
    );
  }, [table]);

  // Get headers for export
  const getHeaders = useCallback((visibleOnly = true) => {
    const columns = visibleOnly
      ? table.getVisibleLeafColumns()
      : table.getAllLeafColumns();

    return columns.map(column =>
      typeof column.columnDef.header === 'string'
        ? column.columnDef.header
        : column.id
    );
  }, [table]);

  // Export filtered/sorted data
  const exportFiltered = useCallback(async (format = 'csv', options = {}) => {
    const exportOptions = {
      ...options,
      visibleOnly: true,
      selectedOnly: false,
    };

    if (format === 'excel') {
      return await exportExcel(exportOptions);
    } else {
      return await exportCSV(exportOptions);
    }
  }, [exportCSV, exportExcel]);

  // Export selected data only
  const exportSelected = useCallback(async (format = 'csv', options = {}) => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      console.warn('No rows selected for export');
      return false;
    }

    const exportOptions = {
      ...options,
      visibleOnly: true,
      selectedOnly: true,
    };

    if (format === 'excel') {
      return await exportExcel(exportOptions);
    } else {
      return await exportCSV(exportOptions);
    }
  }, [table, exportCSV, exportExcel]);

  // Get export statistics
  const getExportStats = useCallback(() => {
    const allRows = table.getRowModel().rows;
    const filteredRows = table.getFilteredRowModel().rows;
    const selectedRows = table.getSelectedRowModel().rows;
    const visibleColumns = table.getVisibleLeafColumns();
    const allColumns = table.getAllLeafColumns();

    return {
      totalRows: allRows.length,
      filteredRows: filteredRows.length,
      selectedRows: selectedRows.length,
      visibleColumns: visibleColumns.length,
      allColumns: allColumns.length,
      canExportSelected: selectedRows.length > 0,
    };
  }, [table]);

  return {
    exportCSV,
    exportExcel,
    exportFiltered,
    exportSelected,
    getExportStats,
    enabled,
  };
}

// Helper functions

function formatValueForExport(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function convertToCSV(data, headers, includeHeaders) {
  const rows = includeHeaders ? [headers, ...data] : data;

  return rows.map(row =>
    row.map(cell => {
      const stringValue = String(cell || '');

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',')
  ).join('\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/:/g, '-');
}

function addMetadataSheet(workbook, rowCount, columnCount) {
  const metadata = [
    ['Export Metadata', ''],
    ['Exported On', new Date().toISOString()],
    ['Total Rows', rowCount],
    ['Total Columns', columnCount],
    ['Export Tool', 'TanStack Table'],
    ['Format Version', '1.0'],
  ];

  const metadataWorksheet = XLSX.utils.aoa_to_sheet(metadata);
  XLSX.utils.book_append_sheet(workbook, metadataWorksheet, 'Metadata');
}