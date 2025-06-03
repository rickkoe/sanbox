import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { HotTable } from '@handsontable/react';
import { Modal, Button, Spinner, Alert, Dropdown, DropdownButton } from "react-bootstrap";
import axios from "axios";
import * as XLSX from "xlsx";
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

console.log("Handsontable version:", Handsontable.version);
registerAllModules();

const GenericTable = forwardRef(({
  apiUrl,
  saveUrl,
  deleteUrl,
  saveTransform,
  columns,
  colHeaders,
  newRowTemplate,
  dropdownSources = {},
  onBuildPayload,
  onSave,
  navigationRedirectPath,
  customRenderers = {},
  preprocessData,
  colWidths,
  getCellsConfig,
  fixedColumnsLeft = 0,
  columnSorting = false,
  filters = false,
  dropdownMenu = false,
  beforeSave,
  afterSave,
  additionalButtons,
  storageKey,
  height = "calc(100vh - 200px)",
  getExportFilename,
  defaultVisibleColumns = [] 
}, ref) => {
  const [data, setData] = useState([]);
  const [unsavedData, setUnsavedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rowsToDelete, setRowsToDelete] = useState([]);
  const [showNavModal, setShowNavModal] = useState(false);
  const [nextPath, setNextPath] = useState(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const tableRef = useRef(null);
  const containerRef = useRef(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    // Initialize based on defaultVisibleColumns prop
    const initialState = columns.reduce((acc, col, index) => {
      if (defaultVisibleColumns && defaultVisibleColumns.length > 0) {
        // If defaultVisibleColumns is specified, only show those columns initially
        acc[index] = defaultVisibleColumns.includes(index);
      } else {
        // If no defaultVisibleColumns specified, show all columns (current behavior)
        acc[index] = true;
      }
      return acc;
    }, {});
    return initialState;
  });
  const [columnFilter, setColumnFilter] = useState('');

  // Add helper function to check if a column is required:
  const isRequiredColumn = (columnIndex) => {
    return defaultVisibleColumns.includes(columnIndex);
  };

  const enhancedContextMenu = {
    items: {
 "add_row_above": {
      name: "Insert row above",
      callback: (key, selection) => {
        const hot = tableRef.current?.hotInstance;
        if (hot && selection && selection.length > 0) {
          // Count total selected rows across all selection ranges
          let totalSelectedRows = 0;
          selection.forEach(range => {
            const rowCount = Math.abs(range.end.row - range.start.row) + 1;
            totalSelectedRows += rowCount;
          });
          
          // Get the topmost row from the first selection range
          const insertAtRow = Math.min(selection[0].start.row, selection[0].end.row);
          
          // Insert the same number of rows as selected
          hot.alter('insert_row_above', insertAtRow, totalSelectedRows);
          setIsDirty(true);
        }
      }
    },
    "add_row_below": {
      name: "Insert row below", 
      callback: (key, selection) => {
        const hot = tableRef.current?.hotInstance;
        if (hot && selection && selection.length > 0) {
          // Count total selected rows across all selection ranges
          let totalSelectedRows = 0;
          selection.forEach(range => {
            const rowCount = Math.abs(range.end.row - range.start.row) + 1;
            totalSelectedRows += rowCount;
          });
          
          // Get the bottommost row from the last selection range
          const insertAtRow = Math.max(selection[selection.length - 1].start.row, selection[selection.length - 1].end.row);
          
          // Insert the same number of rows as selected
          hot.alter('insert_row_below', insertAtRow, totalSelectedRows);
          setIsDirty(true);
        }
      }
    },
      "hsep1": { name: "---------" },
      "copy": {
        name: "Copy",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').copy();
          }
        }
      },
      "cut": {
        name: "Cut",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').cut();
          }
        }
      },
      "paste": {
        name: "Paste",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').paste();
          }
        }
      },
      "hsep2": "---------",
      
      "clear_cell": {
        name: "Clear content",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot && selection && selection.length > 0) {
            selection.forEach(range => {
              for (let row = range.start.row; row <= range.end.row; row++) {
                for (let col = range.start.col; col <= range.end.col; col++) {
                  hot.setDataAtCell(row, col, '');
                }
              }
            });
            setIsDirty(true);
          }
        }
      },
      "hsep3": "---------",
      
      "select_all": {
        name: "Select all",
        callback: () => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.selectAll();
          }
        }
      },
      "hsep4": "---------",
      
      "remove_row": {
        name: "Delete selected rows",
        callback: (key, selection, clickEvent) => {
          console.log("Delete menu clicked - Key:", key, "Selection:", selection);
          handleAfterContextMenu(key, selection);
        }
      },
      
      "hsep5": "---------",
      
      "export_selected": {
        name: "Export selected rows",
        callback: (key, selection) => {
          if (!selection || selection.length === 0) return;
          
          const hot = tableRef.current?.hotInstance;
          if (!hot) return;
          
          const selectedData = [];
          selection.forEach(range => {
            for (let row = range.start.row; row <= range.end.row; row++) {
              const physicalRow = hot.toPhysicalRow(row);
              if (physicalRow !== null && physicalRow < unsavedData.length) {
                selectedData.push(unsavedData[physicalRow]);
              }
            }
          });
          
          const headers = colHeaders.join(",");
          const rows = selectedData.map(row => 
            columns.map(col => {
              const val = row[col.data];
              if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
              return val ?? "";
            }).join(",")
          );
          
          const csvContent = [headers, ...rows].join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", "selected_rows.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    }
  };
  
const createVisibleColumns = () => {
  return columns
    .map((col, index) => {
      if (!visibleColumns[index]) return null;
      
      const isDropdown = dropdownSources.hasOwnProperty(col.data);
      const columnConfig = {
        ...col,
        type: isDropdown ? "dropdown" : col.type,
        source: isDropdown ? dropdownSources[col.data] : undefined,
      };
      
      if (customRenderers[col.data]) {
        columnConfig.renderer = customRenderers[col.data];
      }
      
      return columnConfig;
    })
    .filter(col => col !== null); // Remove null entries (hidden columns)
};

// Function to create visible headers
const createVisibleHeaders = () => {
  return colHeaders.filter((header, index) => visibleColumns[index]);
};

// Create the current visible columns and headers
const enhancedColumns = createVisibleColumns();
const visibleColHeaders = createVisibleHeaders();

const toggleColumnVisibility = (columnIndex) => {
  // Prevent hiding required columns
  if (isRequiredColumn(columnIndex) && visibleColumns[columnIndex]) {
    return; // Don't allow hiding required columns
  }
  
  const newVisibleState = {
    ...visibleColumns,
    [columnIndex]: !visibleColumns[columnIndex]
  };
  
  setVisibleColumns(newVisibleState);
};

const toggleAllColumns = (showAll) => {
  const newVisibleState = columns.reduce((acc, col, index) => {
    // Required columns are always visible
    if (isRequiredColumn(index)) {
      acc[index] = true;
    } else {
      acc[index] = showAll;
    }
    return acc;
  }, {});
  
  setVisibleColumns(newVisibleState);
};

// Add useEffect to update table when visibleColumns changes
useEffect(() => {
  if (tableRef.current?.hotInstance) {
    const hot = tableRef.current.hotInstance;
    const newColumns = createVisibleColumns();
    const newHeaders = createVisibleHeaders();
    
    // Update both columns and headers together
    hot.updateSettings({
      columns: newColumns,
      colHeaders: newHeaders
    });
  }
}, [visibleColumns, customRenderers, dropdownSources]); // Re-run when any of these change


// Filter columns based on search
const filteredColumns = columns.filter((col, index) => {
  const columnName = (colHeaders[index] || col.data).toLowerCase();
  return columnName.includes(columnFilter.toLowerCase());
});


  const updateSelectedCount = () => {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    const sel = hot.getSelected() || [];
    const rowSet = new Set();
    sel.forEach(([r1, , r2]) => {
      const start = Math.min(r1, r2);
      const end = Math.max(r1, r2);
      for (let row = start; row <= end; row++) {
        const physicalRow = hot.toPhysicalRow(row);
        const rowData = unsavedData[physicalRow];
        if (rowData && rowData.id != null) {
          rowSet.add(physicalRow);
        }
      }
    });
    setSelectedCount(rowSet.size);
  };

  useImperativeHandle(ref, () => ({
    hotInstance: tableRef.current?.hotInstance,
    refreshData: fetchData,
    isDirty,
    setIsDirty
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const hasScrollableContent = container.scrollHeight > container.clientHeight;
      setShowScrollButtons(hasScrollableContent);
      
      if (hasScrollableContent) {
        setIsAtTop(container.scrollTop <= 10);
        setIsAtBottom(container.scrollTop + container.clientHeight >= container.scrollHeight - 10);
      }
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [unsavedData]);

  const scrollToTop = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(apiUrl);
      let responseData = response.data;
      
      if (preprocessData && typeof preprocessData === 'function') {
        responseData = preprocessData(responseData);
      }
      
      setData(responseData);
      const dataWithBlankRow = ensureBlankRow(responseData);
      setUnsavedData(dataWithBlankRow);
      setIsDirty(false);
      setSaveStatus("");
    } catch (error) {
      console.error("Fetch error:", error);
      setSaveStatus(`Error loading data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const ensureBlankRow = (rows) => {
    if (!Array.isArray(rows)) return [{ ...newRowTemplate }];
    
    if (rows.length === 0 || hasNonEmptyValues(rows[rows.length - 1])) {
      return [...rows, { ...newRowTemplate }];
    }
    return rows;
  };

  const hasNonEmptyValues = (row) => {
    if (!row) return false;
    
    return Object.keys(row).some(key => {
      if (key === 'id' || key === 'saved') return false;
      
      const value = row[key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'boolean') return value === true;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
  };

  useEffect(() => {
    if (apiUrl) {
      fetchData();
    }
  }, [apiUrl]);

  const handleAfterChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const updated = [...unsavedData];
    let dataChanged = false;
    let shouldAddNewRow = false;
    
    changes.forEach(([visualRow, prop, oldVal, newVal]) => {
      if (oldVal !== newVal) {
        const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
        if (physicalRow !== null) {
          updated[physicalRow] = { ...updated[physicalRow], [prop]: newVal, saved: false };
          dataChanged = true;
          
          if (physicalRow === updated.length - 1) {
            const isNotEmpty = Boolean(
              typeof newVal === "string" ? newVal.trim() : 
              typeof newVal === "boolean" ? newVal : 
              typeof newVal === "number" ? newVal !== 0 : 
              newVal !== null && newVal !== undefined
            );
            
            if (isNotEmpty) {
              shouldAddNewRow = true;
            }
          }
        }
      }
    });

    if (dataChanged) {
      if (shouldAddNewRow) {
        updated.push({ ...newRowTemplate });
      }
      
      setUnsavedData(updated);
      setIsDirty(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!isDirty) {
      setSaveStatus("No changes to save");
      return;
    }

    if (beforeSave && typeof beforeSave === 'function') {
      const validationResult = beforeSave(unsavedData);
      if (validationResult !== true) {
        setSaveStatus(validationResult);
        return;
      }
    }

    setLoading(true);
    setSaveStatus("Saving...");

    try {
      if (onSave && typeof onSave === 'function') {
        const result = await onSave(unsavedData);
        setSaveStatus(result.message);
        if (result.success) {
          await fetchData();
          if (afterSave && typeof afterSave === 'function') {
            afterSave();
          }
          handleSuccessfulSave();
        }
      } else {
        const transformedData = typeof saveTransform === 'function' ? saveTransform(unsavedData) : unsavedData;
        const payload = [];

        transformedData.forEach(row => {
          const isNew = row.id == null;
          const original = data.find(d => d.id === row.id);
          const isModified = original ? JSON.stringify(row) !== JSON.stringify(original) : false;

          if ((isNew && hasNonEmptyValues(row)) || (original && isModified)) {
            payload.push(onBuildPayload ? onBuildPayload(row) : row);
          }
        });

        if (payload.length === 0) {
          setSaveStatus("No changes to save");
          setLoading(false);
          return;
        }

        await Promise.all(payload.map(row => {
          if (row.id == null) {
            const postData = { ...row };
            delete postData.id;
            delete postData.saved;
            return axios.post(saveUrl.endsWith("/") ? saveUrl : `${saveUrl}/`, postData);
          } else {
            const putData = { ...row };
            delete putData.saved;
            return axios.put(`${saveUrl}${row.id}/`, putData);
          }
        }));

        setSaveStatus("Save successful!");
        await fetchData();
        if (afterSave && typeof afterSave === 'function') {
          afterSave();
        }
        handleSuccessfulSave();
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus(`Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulSave = () => {
    if (navigationRedirectPath) {
      setTimeout(() => {
        window.location.href = navigationRedirectPath;
      }, 1000);
    }
  };

  const handleAfterContextMenu = (key, selection) => {
    console.log("Context menu action:", key, "Selection:", selection);
    
    if (key === "remove_row") {
      if (!selection || selection.length === 0) {
        console.log("No selection found");
        return;
      }
      
      const hot = tableRef.current?.hotInstance;
      if (!hot) {
        console.log("No hot instance found");
        return;
      }
      
      const visualRows = [];
      selection.forEach(range => {
        for (let row = range.start.row; row <= range.end.row; row++) {
          visualRows.push(row);
        }
      });
      
      console.log("Visual rows selected:", visualRows);
      
      const physicalRows = visualRows
        .map(visualRow => hot.toPhysicalRow(visualRow))
        .filter(physicalRow => physicalRow !== null && physicalRow < unsavedData.length)
        .filter((row, index, arr) => arr.indexOf(row) === index);
      
      console.log("Physical rows:", physicalRows);
      console.log("Unsaved data length:", unsavedData.length);
      
      if (physicalRows.length === 0) {
        console.log("No valid rows to delete");
        return;
      }
      
      const sortedRows = [...physicalRows].sort((a, b) => b - a);
      
      const rowsWithId = [];
      const rowsWithoutId = [];
      
      sortedRows.forEach(rowIndex => {
        const rowData = unsavedData[rowIndex];
        console.log(`Row ${rowIndex}:`, rowData);
        
        if (rowData && rowData.id !== null && rowData.id !== undefined) {
          rowsWithId.push(rowIndex);
        } else {
          rowsWithoutId.push(rowIndex);
        }
      });
      
      console.log("Rows with ID (need server deletion):", rowsWithId);
      console.log("Rows without ID (local deletion only):", rowsWithoutId);
      
      if (rowsWithoutId.length > 0) {
        const updated = [...unsavedData];
        rowsWithoutId.forEach(rowIndex => {
          console.log(`Removing local row at index ${rowIndex}`);
          updated.splice(rowIndex, 1);
        });
        
        const dataWithBlankRow = ensureBlankRow(updated);
        setUnsavedData(dataWithBlankRow);
        setIsDirty(true);
        
        if (rowsWithId.length === 0) {
          setSaveStatus("Rows deleted successfully!");
        }
      }
      
      if (rowsWithId.length > 0) {
        const rowsToDeleteData = rowsWithId.map(rowIndex => unsavedData[rowIndex]);
        console.log("Rows to delete from server:", rowsToDeleteData);
        setRowsToDelete(rowsToDeleteData);
        setShowDeleteModal(true);
      }
    }
  };

  const confirmDelete = async () => {
    console.log("Confirming delete for:", rowsToDelete);
    setLoading(true);
    
    try {
      const deletePromises = rowsToDelete.map(row => {
        console.log(`Deleting row with ID ${row.id} from server`);
        return axios.delete(`${deleteUrl}${row.id}/`);
      });
      
      await Promise.all(deletePromises);
      
      const updatedData = unsavedData.filter(item => 
        !rowsToDelete.some(deleteItem => deleteItem.id === item.id)
      );
      
      console.log("Updated data after server deletion:", updatedData.length, "rows remaining");
      
      const dataWithBlankRow = ensureBlankRow(updatedData);
      setUnsavedData(dataWithBlankRow);
      
      setSaveStatus("Items deleted successfully!");
      setIsDirty(true);
    } catch (error) {
      console.error("Delete error:", error);
      setSaveStatus(`Delete failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setShowDeleteModal(false);
      setRowsToDelete([]);
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setRowsToDelete([]);
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    
    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.includes('#')) {
        e.preventDefault();
        setNextPath(link.href);
        setShowNavModal(true);
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isDirty]);


  const cellsFunc = (row, col, prop) => {
    if (getCellsConfig && typeof getCellsConfig === 'function' && tableRef.current?.hotInstance) {
      return getCellsConfig(tableRef.current.hotInstance, row, col, prop);
    }
    return {};
  };

  const handleAfterColumnResize = (currentColumn, newSize, isDoubleClick) => {
    if (tableRef.current && tableRef.current.hotInstance) {
      const totalCols = tableRef.current.hotInstance.countCols();
      const widths = [];
      for (let i = 0; i < totalCols; i++) {
        widths.push(tableRef.current.hotInstance.getColWidth(i));
      }
      localStorage.setItem(storageKey || "tableColumnWidths", JSON.stringify(widths));
    }
  };

  const handleExportCSV = () => {
    if (!unsavedData.length) return;

    const headers = colHeaders.join(",");
    const rows = unsavedData
      .filter(row => hasNonEmptyValues(row))
      .map(row => columns.map(col => {
        const val = row[col.data];
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return val ?? "";
      }).join(","));

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = typeof getExportFilename === 'function'
      ? getExportFilename()
      : "table_export.csv";

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!unsavedData.length) return;

    const filteredData = unsavedData.filter(row => hasNonEmptyValues(row));

    const exportData = filteredData.map(row =>
      columns.reduce((acc, col) => {
        const val = row[col.data];
        acc[col.data] = val ?? "";
        return acc;
      }, {})
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const filename = typeof getExportFilename === "function"
      ? getExportFilename().replace(/\.csv$/, ".xlsx")
      : "table_export.xlsx";

    XLSX.writeFile(workbook, filename);
  };

  const getSaveStatusIcon = () => {
    if (saveStatus.includes("Error") || saveStatus.includes("failed")) return "❌";
    if (saveStatus.includes("successful") || saveStatus.includes("Save successful")) return "✅";
    if (saveStatus.includes("No changes")) return "ℹ️";
    return "⚠️";
  };

  const getSaveStatusVariant = () => {
    if (saveStatus.includes("Error") || saveStatus.includes("failed")) return "error";
    if (saveStatus.includes("successful") || saveStatus.includes("Save successful")) return "success";
    if (saveStatus.includes("No changes")) return "info";
    return "warning";
  };

  return (
    <div className="modern-table-container">
      {/* Modern Header */}
      <div className="modern-table-header">
        <div className="header-left">
          <div className="action-group">
            <button 
              className={`modern-btn modern-btn-primary ${loading ? 'loading' : ''} ${!isDirty ? 'disabled' : ''}`}
              onClick={handleSaveChanges} 
              disabled={loading || !isDirty}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17,21 17,13 7,13 7,21"/>
                    <polyline points="7,3 7,8 15,8"/>
                  </svg>
                  Save Changes
                </>
              )}
            </button>
            
    <div className="export-dropdown" style={{ position: 'relative' }}>
      <button 
        className="modern-btn modern-btn-secondary dropdown-toggle"
        onClick={() => setShowExportDropdown(!showExportDropdown)}
        onBlur={(e) => {
          // Only close if clicking outside the dropdown
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setTimeout(() => setShowExportDropdown(false), 150);
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </button>
      <div 
        className={`dropdown-menu ${showExportDropdown ? 'show' : ''}`}
        style={{
          opacity: showExportDropdown ? 1 : 0,
          visibility: showExportDropdown ? 'visible' : 'hidden',
          transform: showExportDropdown ? 'translateY(0)' : 'translateY(-10px)'
        }}
      >
        <button 
          onClick={() => {
            handleExportCSV();
            setShowExportDropdown(false);
          }} 
          className="dropdown-item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          Export as CSV
        </button>
        <button 
          onClick={() => {
            handleExportExcel();
            setShowExportDropdown(false);
          }} 
          className="dropdown-item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          Export as Excel
        </button>
      </div>
    </div>

<div className="export-dropdown" style={{ position: 'relative' }}>
  <button 
    className="modern-btn modern-btn-secondary dropdown-toggle"
    onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
    onBlur={(e) => {
      // Only close if the new focus is NOT on the filter input or any dropdown element
      const dropdownContainer = e.currentTarget.parentElement;
      if (!dropdownContainer.contains(e.relatedTarget)) {
        setTimeout(() => setShowColumnsDropdown(false), 150);
      }
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="9" y1="9" x2="15" y2="9"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
    Columns
  </button>
  
  <div 
    className={`dropdown-menu columns-dropdown-menu ${showColumnsDropdown ? 'show' : ''}`}
    style={{
      opacity: showColumnsDropdown ? 1 : 0,
      visibility: showColumnsDropdown ? 'visible' : 'hidden',
      transform: showColumnsDropdown ? 'translateY(0)' : 'translateY(-10px)',
      minWidth: '220px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}
    onMouseDown={(e) => {
      // Prevent the button from losing focus when clicking inside dropdown
      if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
      }
    }}
  >
    {/* Search Filter */}
    <div className="dropdown-filter">
      <input
        type="text"
        placeholder="Search columns..."
        value={columnFilter}
        onChange={(e) => setColumnFilter(e.target.value)}
        className="filter-input"
        autoComplete="off"
        tabIndex={0}
      />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="filter-icon">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    </div>

    {/* Select All Checkbox */}
    <div className="dropdown-select-all">
      <label 
        className="dropdown-checkbox-item select-all-item"
        onMouseDown={(e) => e.preventDefault()}
      >
        <input
          type="checkbox"
          checked={Object.values(visibleColumns).every(visible => visible)}
          ref={(el) => {
            if (el) {
              const someVisible = Object.values(visibleColumns).some(visible => visible);
              const allVisible = Object.values(visibleColumns).every(visible => visible);
              el.indeterminate = someVisible && !allVisible;
            }
          }}
          onChange={(e) => {
            toggleAllColumns(e.target.checked);
          }}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontWeight: '600', color: '#2563eb' }}>
          {Object.values(visibleColumns).every(visible => visible) ? 'Unselect All' : 'Select All'}
        </span>
      </label>
    </div>

    {/* Column List */}
<div className="dropdown-columns-list">
  {filteredColumns.map((col, filteredIndex) => {
    const originalIndex = columns.findIndex(originalCol => originalCol === col);
    const isRequired = isRequiredColumn(originalIndex);
    const isChecked = visibleColumns[originalIndex];
    
    return (
      <label 
        key={originalIndex}
        className="dropdown-checkbox-item"
        style={{ 
          cursor: isRequired ? 'not-allowed' : 'pointer', 
          userSelect: 'none',
          opacity: isRequired ? 0.7 : 1,
          backgroundColor: isRequired ? '#f3f4f6' : 'transparent'
        }}
        onMouseDown={(e) => e.preventDefault()}
        title={isRequired ? 'This column is required and cannot be hidden' : ''}
      >
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isRequired && isChecked} // Disable unchecking required columns
          onChange={(e) => {
            if (!isRequired || !isChecked) {
              toggleColumnVisibility(originalIndex);
            }
          }}
          style={{ 
            marginRight: '8px',
            cursor: isRequired && isChecked ? 'not-allowed' : 'pointer'
          }}
        />
        <span style={{
          fontWeight: isRequired ? '600' : 'normal',
          color: isRequired ? '#1f2937' : '#374151'
        }}>
          {colHeaders[originalIndex] || col.data}
          {isRequired && (
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '10px', 
              color: '#059669',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              REQUIRED
            </span>
          )}
        </span>
      </label>
    );
  })}
  {filteredColumns.length === 0 && columnFilter && (
    <div className="no-results">
      <span>No columns found matching "{columnFilter}"</span>
    </div>
  )}
</div>

    {/* Footer */}
    <div className="columns-dropdown-footer">
      <button 
        onClick={() => {
          setColumnFilter(''); // Clear filter when closing
          setShowColumnsDropdown(false);
        }} 
        className="dropdown-item"
        style={{ fontWeight: '500', color: '#6b7280' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Close
      </button>
    </div>
  </div>
</div>

            {additionalButtons && (
              <div className="additional-buttons">
                {additionalButtons}
              </div>
            )}
          </div>
        </div>

        <div className="header-right">
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{unsavedData.filter(row => hasNonEmptyValues(row)).length}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Selected</span>
              <span className="stat-value">{selectedCount}</span>
            </div>
            {isDirty && (
              <>
                <div className="stat-divider"></div>
                <div className="unsaved-indicator">
                  <div className="unsaved-dot"></div>
                  <span>Unsaved changes</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {saveStatus && (
        <div className={`status-message status-${getSaveStatusVariant()}`}>
          <span className="status-icon">{getSaveStatusIcon()}</span>
          <span className="status-text">{saveStatus}</span>
        </div>
      )}

      {/* Table Container */}
      <div 
        ref={containerRef} 
        className="table-scroll-container"
        style={{ height }}
      >
        {loading && !unsavedData.length ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="spinner large"></div>
              <span>Loading data...</span>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <HotTable
              ref={tableRef}
              data={unsavedData}
              colHeaders={visibleColHeaders}
              columns={enhancedColumns}
              licenseKey="non-commercial-and-evaluation"
              rowHeaders={false}

              
              filters={true}
              dropdownMenu={true}
              
              width="100%"
              afterChange={handleAfterChange}
              afterSelection={(r, c, r2, c2) => updateSelectedCount()}
              afterDeselect={() => setSelectedCount(0)}
              
              manualColumnResize={true}
              afterColumnResize={handleAfterColumnResize}
              afterScrollHorizontally={() => {
                setTimeout(() => {
                  if (tableRef.current?.hotInstance) {
                    tableRef.current.hotInstance.render();
                  }
                }, 10);
              }}
              
              stretchH="all"
              contextMenu={enhancedContextMenu}
              afterContextMenuAction={(key, selection) => handleAfterContextMenu(key, selection)}
              beforeRemoveRow={() => false}
              colWidths={colWidths}
              cells={getCellsConfig ? cellsFunc : undefined}
              viewportRowRenderingOffset={30}
              viewportColumnRenderingOffset={30}
              preventOverflow={false}
            />
          </div>
        )}

        {/* Floating Scroll Buttons */}
        {showScrollButtons && (
          <div className="scroll-buttons">
            {!isAtTop && (
              <button
                onClick={scrollToTop}
                className="scroll-btn scroll-btn-up"
                title="Scroll to top"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18,15 12,9 6,15"/>
                </svg>
              </button>
            )}
            {!isAtBottom && (
              <button
                onClick={scrollToBottom}
                className="scroll-btn scroll-btn-down"
                title="Scroll to bottom"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={cancelDelete} backdrop="static" className="modern-modal">
        <Modal.Header closeButton className="modern-modal-header">
          <Modal.Title>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="modern-modal-body">
          <p>Are you sure you want to delete the following items? This action cannot be undone.</p>
          <div className="delete-items-list">
            {rowsToDelete.map(r => (
              <div key={r.id} className="delete-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {r.name || `ID: ${r.id}`}
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer className="modern-modal-footer">
          <button className="modern-btn modern-btn-secondary" onClick={cancelDelete}>
            Cancel
          </button>
          <button className="modern-btn modern-btn-danger" onClick={confirmDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
            </svg>
            Delete Items
          </button>
        </Modal.Footer>
      </Modal>

      {/* Unsaved Navigation Modal */}
      <Modal show={showNavModal} onHide={() => setShowNavModal(false)} backdrop="static" className="modern-modal">
        <Modal.Header closeButton className="modern-modal-header">
          <Modal.Title>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Unsaved Changes
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="modern-modal-body">
          <p>You have unsaved changes that will be lost if you navigate away. Are you sure you want to continue?</p>
        </Modal.Body>
        <Modal.Footer className="modern-modal-footer">
          <button className="modern-btn modern-btn-secondary" onClick={() => setShowNavModal(false)}>
            Stay & Save
          </button>
          <button 
            className="modern-btn modern-btn-danger"
            onClick={() => {
              setIsDirty(false);
              window.location.href = nextPath;
            }}
          >
            Leave Without Saving
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
});

export default GenericTable;