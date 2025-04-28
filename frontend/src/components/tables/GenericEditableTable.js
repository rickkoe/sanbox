import React, { useEffect, useState, useRef } from "react";
import { HotTable } from '@handsontable/react-wrapper';
import { Modal, Button } from "react-bootstrap";
import axios from "axios";

const GenericEditableTable = ({
  apiUrl,
  columns,
  colHeaders,
  newRowTemplate,
  dropdownSources = {},
}) => {
  const [data, setData] = useState([]);
  const [unsavedData, setUnsavedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rowsToDelete, setRowsToDelete] = useState([]);
  const tableRef = useRef(null);

  // Fetch data
  const fetchData = async () => {
    try {
      const response = await axios.get(apiUrl);
      setData(response.data);
      setUnsavedData(response.data);
      setIsDirty(false);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAfterChange = (changes, source) => {
    if (source === "edit" && changes) {
      const updated = [...unsavedData];
      changes.forEach(([visualRow, prop, oldVal, newVal]) => {
        if (oldVal !== newVal) {
          const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
          if (physicalRow !== null) {
            updated[physicalRow] = { ...updated[physicalRow], [prop]: newVal };
          }
        }
      });
      // Auto-add new blank row
      const lastRow = updated[updated.length - 1];
      if (lastRow && Object.values(lastRow).some(val => val?.toString().trim() !== "")) {
        updated.push({ ...newRowTemplate });
      }
      setUnsavedData(updated);
      setIsDirty(true);
    }
  };

  const handleSaveChanges = async () => {
    const payload = [];

    unsavedData.forEach(row => {
      if (row.id === null) {
        if (Object.values(row).some(val => val?.toString().trim() !== "")) {
          payload.push({ ...row });
        }
      } else {
        const original = data.find(d => d.id === row.id);
        if (original && JSON.stringify(row) !== JSON.stringify(original)) {
          payload.push(row);
        }
      }
    });

    if (payload.length === 0) {
      alert("No changes to save.");
      return;
    }

    setLoading(true);

    try {
      await Promise.all(payload.map(row => {
        if (row.id === null) {
          const postData = { ...row };
          delete postData.id;
          return axios.post(apiUrl, postData);
        } else {
          return axios.put(`${apiUrl}${row.id}/`, row);
        }
      }));
      fetchData();
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleAfterContextMenu = (key, selection) => {
    if (key === "remove_row") {
      if (!selection || selection.length === 0) return;
      const physicalRows = selection.map(([visualRow]) => tableRef.current.hotInstance.toPhysicalRow(visualRow));
      const uniqueRows = [...new Set(physicalRows)].filter(r => r !== null && r < unsavedData.length);
      const deletableRows = uniqueRows.map(r => unsavedData[r]).filter(r => r.id !== null);

      if (deletableRows.length === 0) {
        const updated = unsavedData.filter((_, idx) => !uniqueRows.includes(idx));
        setUnsavedData(updated);
        setIsDirty(true);
      } else {
        setRowsToDelete(deletableRows);
        setShowDeleteModal(true);
      }
    }
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await Promise.all(rowsToDelete.map(row => axios.delete(`${apiUrl}${row.id}/`)));
      setShowDeleteModal(false);
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setRowsToDelete([]);
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <Button className="save-button" onClick={handleSaveChanges}>Save</Button>
      </div>

      {!loading && (
        <HotTable
          ref={tableRef}
          data={unsavedData}
          colHeaders={colHeaders}
          columns={columns.map(col => ({
            data: col.data,
            type: dropdownSources[col.data] ? "dropdown" : undefined,
            source: dropdownSources[col.data],
            readOnly: col.readOnly,
            renderer: col.renderer,
          }))}
          afterChange={handleAfterChange}
          contextMenu={{ items: { remove_row: { name: "Remove row(s)" } } }}
          afterContextMenuShow={(key, selection) => handleAfterContextMenu(key, selection)}
          stretchH="all"
          height="calc(100vh - 200px)"
          licenseKey="non-commercial-and-evaluation"
          rowHeaders={false}
          filters={true}
          dropdownMenu={true}
          autoColumnSize={true}
          manualColumnResize={true}
        />
      )}

      <Modal show={showDeleteModal} onHide={cancelDelete} backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete the following items?</p>
          <ul>{rowsToDelete.map(r => <li key={r.id}>{r.name || `ID: ${r.id}`}</li>)}</ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelDelete}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GenericEditableTable;