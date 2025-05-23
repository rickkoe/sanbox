import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { HotTable } from '@handsontable/react';
import { Modal, Button, Spinner, Alert, Dropdown, DropdownButton } from "react-bootstrap";
import axios from "axios";
import * as XLSX from "xlsx";
import Handsontable from 'handsontable'; // <- Make sure this is here
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

registerAllModules();
/**
 * A generic reusable table component for all CRUD operations
 * @param {Object} props - Component props
 * @param {string} props.apiUrl - URL for fetching data
 * @param {string} props.saveUrl - URL for saving data
 * @param {string} props.deleteUrl - URL for deleting data
 * @param {Array} props.columns - Column definitions for the table
 * @param {Array} props.colHeaders - Column header texts
 * @param {Object} props.newRowTemplate - Template for new row
 * @param {Object} props.dropdownSources - Sources for dropdown fields
 * @param {Function} props.onBuildPayload - Function to build payload for saving
 * @param {Function} props.onSave - Custom save handler if needed
 * @param {string} props.navigationRedirectPath - Path to redirect after save
 * @param {Object} props.customRenderers - Custom cell renderers
 * @param {Function} props.preprocessData - Function to preprocess data before rendering
 * @param {Array} props.colWidths - Column widths
 * @param {Function} props.getCellsConfig - Function to get dynamic cell configuration
 * @param {number} props.fixedColumnsLeft - Number of columns to fix on the left
 * @param {boolean} props.columnSorting - Enable column sorting
 * @param {boolean} props.filters - Enable column filters
 * @param {React.Ref} ref - Forwarded ref
 */
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
  getExportFilename
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
  // Helper to update selected row count (only count rows with a non-null id)
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

  // Expose the table reference and methods to the parent component
  useImperativeHandle(ref, () => ({
    hotInstance: tableRef.current?.hotInstance,
    refreshData: fetchData,
    isDirty,
    setIsDirty
  }));

  // Set up scroll detection to show/hide scroll buttons
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only show buttons if there's enough content to scroll
      const hasScrollableContent = container.scrollHeight > container.clientHeight;
      setShowScrollButtons(hasScrollableContent);
      
      // Check if we're at the top or bottom
      if (hasScrollableContent) {
        setIsAtTop(container.scrollTop <= 10);
        setIsAtBottom(container.scrollTop + container.clientHeight >= container.scrollHeight - 10);
      }
    };

    // Initial check
    handleScroll();
    
    // Add event listener
    container.addEventListener('scroll', handleScroll);
    
    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [unsavedData]); // Re-check when data changes

  // Scroll functions
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

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(apiUrl);
      let responseData = response.data;
      
      // Apply custom data preprocessing if provided
      if (preprocessData && typeof preprocessData === 'function') {
        responseData = preprocessData(responseData);
      }
      
      setData(responseData);
      
      // Ensure there's always a blank row at the end
      const dataWithBlankRow = ensureBlankRow(responseData);
      setUnsavedData(dataWithBlankRow);
      setIsDirty(false);
      setSaveStatus("");
    } catch (error) {
      console.error("Fetch error:", error);
      setSaveStatus(`❌ Error loading data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper to ensure there's always a blank row at the end
  const ensureBlankRow = (rows) => {
    if (!Array.isArray(rows)) return [{ ...newRowTemplate }];
    
    if (rows.length === 0 || hasNonEmptyValues(rows[rows.length - 1])) {
      return [...rows, { ...newRowTemplate }];
    }
    return rows;
  };

  // Check if a row has any non-empty values
  const hasNonEmptyValues = (row) => {
    if (!row) return false;
    
    return Object.keys(row).some(key => {
      // Skip id field in the check
      if (key === 'id') return false;
      if (key === 'saved') return false;
      
      const value = row[key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'boolean') return value === true;
      if (Array.isArray(value)) return value.length > 0;
      return true; // Any other non-null value is considered non-empty
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
          
          // If editing the last row and it now has content, prepare to add a new row
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
      // Add a new blank row if needed
      if (shouldAddNewRow) {
        updated.push({ ...newRowTemplate });
      }
      
      setUnsavedData(updated);
      setIsDirty(true);
    }
  };

  const handleSaveChanges = async () => {
    // Skip saving if there are no unsaved changes
    if (!isDirty) {
      setSaveStatus("⚠️ No changes to save.");
      return;
    }

    // Run pre-save validation if provided
    if (beforeSave && typeof beforeSave === 'function') {
      const validationResult = beforeSave(unsavedData);
      if (validationResult !== true) {
        setSaveStatus(`⚠️ ${validationResult}`);
        return;
      }
    }

    setLoading(true);
    setSaveStatus("Saving...");

    try {
      // If custom save handler is provided, use it
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
        // Default save implementation
        // Apply saveTransform if provided
        const transformedData = typeof saveTransform === 'function' ? saveTransform(unsavedData) : unsavedData;
        console.log("Transformed save data:", transformedData);

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
          setSaveStatus("⚠️ No changes to save.");
          setLoading(false);
          return;
        }

        await Promise.all(payload.map(row => {
          if (row.id == null) {
            const postData = { ...row };
            delete postData.id;
            delete postData.saved;
            // Ensure saveUrl ends with a trailing slash for POST, but don't duplicate slashes
            return axios.post(saveUrl.endsWith("/") ? saveUrl : `${saveUrl}/`, postData);
          } else {
            const putData = { ...row };
            delete putData.saved;
            // Ensure trailing slash for PUT
            return axios.put(`${saveUrl}${row.id}/`, putData);
          }
        }));

        setSaveStatus("✅ Save successful!");
        await fetchData();
        if (afterSave && typeof afterSave === 'function') {
          afterSave();
        }
        handleSuccessfulSave();
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus(`❌ Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulSave = () => {
    // Redirect after successful save if a redirect path is provided
    if (navigationRedirectPath) {
      setTimeout(() => {
        window.location.href = navigationRedirectPath;
      }, 1000);
    }
  };

  const handleAfterContextMenu = (key, selection) => {
    if (key === "remove_row") {
      if (!selection || selection.length === 0) return;
      
      const physicalRows = selection.map(([visualRow]) => {
        return tableRef.current.hotInstance.toPhysicalRow(visualRow);
      }).filter(r => r !== null && r < unsavedData.length);
      
      // Get unique rows in descending order (to avoid index shifting issues when deleting)
      const uniqueRows = [...new Set(physicalRows)].sort((a, b) => b - a);
      
      // Split rows into those with IDs (requiring server deletion) and those without
      const rowsWithId = uniqueRows.filter(r => unsavedData[r].id !== null);
      const rowsWithoutId = uniqueRows.filter(r => unsavedData[r].id === null);
      
      // For rows without IDs, remove them directly
      if (rowsWithoutId.length > 0) {
        const updated = [...unsavedData];
        rowsWithoutId.forEach(rowIndex => {
          updated.splice(rowIndex, 1);
        });
        
        // Ensure we still have a blank row at the end
        const dataWithBlankRow = ensureBlankRow(updated);
        setUnsavedData(dataWithBlankRow);
        setIsDirty(true);
      }
      
      // For rows with IDs, show confirmation modal
      if (rowsWithId.length > 0) {
        setRowsToDelete(rowsWithId.map(r => unsavedData[r]));
        setShowDeleteModal(true);
      }
    }
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      // Delete each item on the server
      await Promise.all(rowsToDelete.map(row => axios.delete(`${deleteUrl}${row.id}/`)));
      
      // Remove deleted items from local data
      const updatedData = unsavedData.filter(item => 
        !rowsToDelete.some(deleteItem => deleteItem.id === item.id)
      );
      
      // Ensure we still have a blank row at the end
      const dataWithBlankRow = ensureBlankRow(updatedData);
      setUnsavedData(dataWithBlankRow);
      
      setSaveStatus("✅ Items deleted successfully!");
      setIsDirty(true);
    } catch (error) {
      console.error("Delete error:", error);
      setSaveStatus(`❌ Delete failed: ${error.message}`);
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

  // 🚨 Handle navigation away with unsaved changes
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

  // Intercept links when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    
    const handleClick = (e) => {
      // Check if the clicked element is a link or inside a link
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

  // Apply custom renderers to columns
  const enhancedColumns = columns.map(col => {
    const isDropdown = dropdownSources.hasOwnProperty(col.data);
    const columnConfig = {
      ...col,
      type: isDropdown ? "dropdown" : col.type,
      source: isDropdown ? dropdownSources[col.data] : undefined,
    };
    
    // Add renderer if a custom one exists for this column
    if (customRenderers[col.data]) {
      columnConfig.renderer = customRenderers[col.data];
    }
    
    return columnConfig;
  });

  // Custom cell configuration function for the HotTable cells option
  const cellsFunc = (row, col, prop) => {
    if (getCellsConfig && typeof getCellsConfig === 'function' && tableRef.current?.hotInstance) {
      return getCellsConfig(tableRef.current.hotInstance, row, col, prop);
    }
    return {};
  };

  // Save column widths after resize
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

  // Styles for the scroll buttons
  const scrollButtonsStyles = {
    container: {
      position: 'fixed',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    button: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(13, 110, 253, 0.8)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.3s ease',
      fontSize: '1.5rem',
      opacity: 0.7
    },
    buttonHover: {
      backgroundColor: 'rgba(13, 110, 253, 1)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      opacity: 1
    }
  };

  // Export CSV handler
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

  return (
    <div className="table-container">
      <div className="table-header d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <Button className="save-button" onClick={handleSaveChanges} disabled={loading}>
            {loading ? (
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
            ) : (
              "Save"
            )}
          </Button>
          <DropdownButton
            id="export-dropdown"
            title="Export"
            variant="secondary"
            className="export-button"
          >
            <Dropdown.Item onClick={handleExportCSV}>Export as CSV</Dropdown.Item>
            <Dropdown.Item onClick={handleExportExcel}>Export as Excel</Dropdown.Item>
          </DropdownButton>
          
          {/* Render additional buttons if provided */}
          {additionalButtons && additionalButtons}
        </div>
        <div className="counts">
          <em>
            <strong>{unsavedData.filter(row => hasNonEmptyValues(row)).length}</strong> total items | <strong>{selectedCount}</strong> selected
          </em>
        </div>
        {saveStatus && (
          <Alert variant={saveStatus.includes("❌") ? "danger" : saveStatus.includes("⚠️") ? "warning" : "success"} 
                 className="mt-2 py-1 save-status">
            {saveStatus}
          </Alert>
        )}
      </div>

      {/* Table with scrollable container */}
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          height, 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {loading && !unsavedData.length ? (
          <div className="loading-indicator">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          <HotTable
            ref={tableRef}
            data={unsavedData}
            colHeaders={colHeaders}
            columns={enhancedColumns}
            afterChange={handleAfterChange}
            contextMenu={{ items: { remove_row: { name: "Remove row(s)" } } }}
            afterContextMenuAction={(key, selection) => handleAfterContextMenu(key, selection)}
            beforeRemoveRow={() => false}
            stretchH="all"
            licenseKey="non-commercial-and-evaluation"
            rowHeaders={false}
            
            // CRITICAL: Enable filters and dropdownMenu properly
            filters={true}
            dropdownMenu={true}
            
            // Alternative: Use explicit dropdownMenu configuration
            // dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
            
            autoColumnSize={true}
            manualColumnResize={true}
            fixedColumnsLeft={fixedColumnsLeft}
            columnSorting={columnSorting}
            colWidths={colWidths}
            cells={getCellsConfig ? cellsFunc : undefined}
            afterColumnResize={handleAfterColumnResize}
            afterSelection={(r, c, r2, c2) => updateSelectedCount()}
            afterDeselect={() => setSelectedCount(0)}
            
            // Add these settings to ensure proper rendering
            viewportRowRenderingOffset={30}
            viewportColumnRenderingOffset={30}
          />
        )}

        {/* Scroll buttons */}
        {showScrollButtons && (
          <div style={{
            ...scrollButtonsStyles.container,
            bottom: '20px'
          }}>
            {!isAtTop && (
              <button
                onClick={scrollToTop}
                style={scrollButtonsStyles.button}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = scrollButtonsStyles.buttonHover.backgroundColor;
                  e.currentTarget.style.boxShadow = scrollButtonsStyles.buttonHover.boxShadow;
                  e.currentTarget.style.opacity = scrollButtonsStyles.buttonHover.opacity;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = scrollButtonsStyles.button.backgroundColor;
                  e.currentTarget.style.boxShadow = scrollButtonsStyles.button.boxShadow;
                  e.currentTarget.style.opacity = scrollButtonsStyles.button.opacity;
                }}
                title="Scroll to top"
              >
                ↑
              </button>
            )}
            {!isAtBottom && (
              <button
                onClick={scrollToBottom}
                style={scrollButtonsStyles.button}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = scrollButtonsStyles.buttonHover.backgroundColor;
                  e.currentTarget.style.boxShadow = scrollButtonsStyles.buttonHover.boxShadow;
                  e.currentTarget.style.opacity = scrollButtonsStyles.buttonHover.opacity;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = scrollButtonsStyles.button.backgroundColor;
                  e.currentTarget.style.boxShadow = scrollButtonsStyles.button.boxShadow;
                  e.currentTarget.style.opacity = scrollButtonsStyles.button.opacity;
                }}
                title="Scroll to bottom"
              >
                ↓
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={cancelDelete} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete the following items?</p>
          <ul>
            {rowsToDelete.map(r => (
              <li key={r.id}>{r.name || `ID: ${r.id}`}</li>
            ))}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelDelete}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Unsaved Navigation Modal */}
      <Modal show={showNavModal} onHide={() => setShowNavModal(false)} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes. Are you sure you want to navigate away?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNavModal(false)}>Stay</Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setIsDirty(false);
              window.location.href = nextPath;
            }}
          >
            Leave
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
});

export default GenericTable;