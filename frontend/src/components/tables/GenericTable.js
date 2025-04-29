import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { HotTable } from '@handsontable/react';
import { Modal, Button, Spinner, Alert } from "react-bootstrap";
import axios from "axios";

const GenericTable = forwardRef(({
  apiUrl,
  saveUrl,
  deleteUrl,
  columns,
  colHeaders,
  newRowTemplate,
  dropdownSources = {},
  onBuildPayload,
  onSave, // Custom save handler if needed
  navigationRedirectPath,
  customRenderers = {},
  preprocessData, // Function to preprocess data before rendering
  colWidths, // Optional column widths
  getCellsConfig, // Function to get dynamic cell configuration
  fixedColumnsLeft = 0,
  columnSorting = false,
  filters = false
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
  const tableRef = useRef(null);

  // Expose the table reference and methods to the parent component
  useImperativeHandle(ref, () => ({
    hotInstance: tableRef.current?.hotInstance,
    refreshData: fetchData
  }));

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
    
    changes.forEach(([visualRow, prop, oldVal, newVal]) => {
      if (oldVal !== newVal) {
        const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
        if (physicalRow !== null) {
          updated[physicalRow] = { ...updated[physicalRow], [prop]: newVal };
          dataChanged = true;
        }
      }
    });

    if (dataChanged) {
      // Check if the last row has any data and add a new blank row if needed
      const dataWithBlankRow = ensureBlankRow(updated);
      setUnsavedData(dataWithBlankRow);
      setIsDirty(true);
    }
  };

  const handleSaveChanges = async () => {
    // Skip saving if there are no unsaved changes
    if (!isDirty) {
      setSaveStatus("⚠️ No changes to save.");
      return;
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
          handleSuccessfulSave();
        }
      } else {
        // Default save implementation
        const payload = [];

        unsavedData.forEach(row => {
          const isNew = row.id == null;
          const original = data.find(d => d.id === row.id);
          const isModified = JSON.stringify(row) !== JSON.stringify(original);

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
            return axios.post(saveUrl, postData);
          } else {
            return axios.put(`${saveUrl}${row.id}/`, row);
          }
        }));

        setSaveStatus("✅ Save successful!");
        await fetchData();
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
      localStorage.setItem("zoneTableColumnWidths", JSON.stringify(widths));
    }
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <Button className="save-button" onClick={handleSaveChanges} disabled={loading}>
          {loading ? (
            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
          ) : (
            "Save"
          )}
        </Button>
        {saveStatus && (
          <Alert variant={saveStatus.includes("❌") ? "danger" : saveStatus.includes("⚠️") ? "warning" : "success"} 
                 className="mt-2 py-1 save-status">
            {saveStatus}
          </Alert>
        )}
      </div>

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
          beforeRemoveRow={() => false} // Prevent automatic row removal
          stretchH="all"
          height="calc(100vh - 200px)"
          licenseKey="non-commercial-and-evaluation"
          rowHeaders={false}
          filters={filters}
          dropdownMenu={true}
          autoColumnSize={true}
          manualColumnResize={true}
          fixedColumnsLeft={fixedColumnsLeft}
          columnSorting={columnSorting}
          colWidths={colWidths}
          cells={getCellsConfig ? cellsFunc : undefined}
          afterColumnResize={handleAfterColumnResize}
        />
      )}

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