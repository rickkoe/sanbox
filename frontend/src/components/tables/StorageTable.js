import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import { Modal, Button } from "react-bootstrap";

const StorageTable = () => {
    const [storages, setStorages] = useState([]);
    const [unsavedStorages, setUnsavedStorages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [rowsToDelete, setRowsToDelete] = useState([]);
    const tableRef = useRef(null);
    const storageListApiUrl = "http://127.0.0.1:8000/api/storage/";

    // Fetch storages and initialize both storages and unsavedStorages
    const fetchStorages = () => {
        setLoading(true);
        axios.get(storageListApiUrl)
            .then(response => {
                setStorages(response.data);
                setUnsavedStorages(response.data);
                setLoading(false);
                setError(null);
                setIsDirty(false);
            })
            .catch(error => {
                console.error("Error fetching storages:", error);
                setError("Failed to load storages.");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchStorages();
    }, []);

    // Handle changes in the table data
    const handleAfterChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedUnsaved = [...unsavedStorages];

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    // If editing beyond current rows, ignore
                    if (physicalRow >= updatedUnsaved.length) return;

                    // Update the field in unsavedStorages
                    updatedUnsaved[physicalRow] = { ...updatedUnsaved[physicalRow], [prop]: newValue };
                }
            });

            // Check if last row is filled, if yes, add a blank new row
            const lastRow = updatedUnsaved[updatedUnsaved.length - 1];
            if (
                lastRow &&
                (lastRow.name?.trim() !== "" ||
                 lastRow.storage_type?.trim() !== "" ||
                 lastRow.location?.trim() !== "" ||
                 lastRow.serial_number?.trim() !== "")
            ) {
                updatedUnsaved.push({ id: null, name: "", storage_type: "", location: "", serial_number: "" });
            }

            setUnsavedStorages(updatedUnsaved);
            setIsDirty(true);
        }
    };

    // Build save payload: only include rows that are new or changed
    const buildSavePayload = () => {
        // We consider rows with id null as new
        // Also, rows with id but different from original storages are updated
        const payload = [];

        unsavedStorages.forEach((row) => {
            if (row.id === null) {
                // New row - only if name or storage_type or location or serial_number filled
                if (
                    row.name?.trim() !== "" ||
                    row.storage_type?.trim() !== "" ||
                    row.location?.trim() !== "" ||
                    row.serial_number?.trim() !== ""
                ) {
                    payload.push(row);
                }
            } else {
                // Existing row - compare with original storages
                const original = storages.find(s => s.id === row.id);
                if (!original) return;
                if (
                    original.name !== row.name ||
                    original.storage_type !== row.storage_type ||
                    original.location !== row.location ||
                    original.serial_number !== row.serial_number
                ) {
                    payload.push(row);
                }
            }
        });

        return payload;
    };

    // Save changes to backend
    const handleSaveChanges = () => {
        const payload = buildSavePayload();

        if (payload.length === 0) {
            alert("No changes to save.");
            return;
        }

        setLoading(true);
        setError(null);

        // We will do PUT for existing rows and POST for new rows
        const promises = payload.map(row => {
            if (row.id === null) {
                // New row - POST
                const postData = { ...row };
                delete postData.id;
                return axios.post(storageListApiUrl, postData);
            } else {
                // Existing row - PUT
                return axios.put(`${storageListApiUrl}${row.id}/`, row);
            }
        });

        Promise.all(promises)
            .then(() => {
                fetchStorages();
            })
            .catch(error => {
                console.error("Error saving storages:", error);
                setError("Failed to save changes.");
                setLoading(false);
            });
    };

    // Handle context menu actions (like row removal)
    const handleAfterContextMenu = (key, selection) => {
        if (key === "remove_row") {
            if (!selection || selection.length === 0) return;
            // Get physical rows from selection
            const physicalRows = selection.map(([visualRow]) => tableRef.current.hotInstance.toPhysicalRow(visualRow));
            const uniqueRows = [...new Set(physicalRows)].filter(r => r !== null && r < unsavedStorages.length);

            // Filter out rows that have id (saved rows) for deletion confirmation
            const deletableRows = uniqueRows
                .map(r => unsavedStorages[r])
                .filter(row => row.id !== null);

            if (deletableRows.length === 0) {
                // If no saved rows selected, just remove from unsavedStorages directly
                const updated = unsavedStorages.filter((_, idx) => !uniqueRows.includes(idx));
                setUnsavedStorages(updated);
                setIsDirty(true);
            } else {
                setRowsToDelete(deletableRows);
                setShowDeleteModal(true);
            }
        }
    };

    // Confirm deletion of selected rows
    const confirmDelete = () => {
        setLoading(true);
        setError(null);

        const deletePromises = rowsToDelete.map(row => axios.delete(`${storageListApiUrl}${row.id}/`));

        Promise.all(deletePromises)
            .then(() => {
                setShowDeleteModal(false);
                setRowsToDelete([]);
                fetchStorages();
            })
            .catch(error => {
                console.error("Error deleting storages:", error);
                setError("Failed to delete selected storages.");
                setLoading(false);
                setShowDeleteModal(false);
                setRowsToDelete([]);
            });
    };

    // Cancel deletion modal
    const cancelDelete = () => {
        setShowDeleteModal(false);
        setRowsToDelete([]);
    };

    // Custom renderer for Name column to apply bold if saved (id !== null)
    const nameRenderer = (instance, td, row, col, prop, value, cellProperties) => {
        const physicalRow = tableRef.current?.hotInstance.toPhysicalRow(row);
        if (physicalRow !== null && unsavedStorages[physicalRow]?.id !== null) {
            td.style.fontWeight = "bold";
        } else {
            td.style.fontWeight = "normal";
        }
        td.innerText = value || "";
        return td;
    };

    return (
        <div className="table-container">
          <div className="table-header">
            <div className="button-container">
              <Button className="save-button" onClick={handleSaveChanges}>Save</Button>
            </div>
          </div>

          {!loading && !error && (
            <HotTable
                ref={tableRef}
                data={unsavedStorages}
                colHeaders={["ID", "Name", "Type", "Location", "Serial Number"]}
                columns={[
                    { data: "id", readOnly: true },
                    { data: "name", renderer: nameRenderer },
                    { data: "storage_type", type: "dropdown", source: ["FlashSystem", "DS8000", "Switch", "Data Domain"] },
                    { data: "location" },
                    { data: "serial_number", readOnly: true },
                ]}
                manualColumnResize={true}
                autoColumnSize={true}
                afterColumnResize={() => {
                    const totalCols = tableRef.current.hotInstance.countCols();
                    const widths = [];
                    for (let i = 0; i < totalCols; i++) {
                        widths.push(tableRef.current.hotInstance.getColWidth(i));
                    }
                    localStorage.setItem("storageTableColumnWidths", JSON.stringify(widths));
                }}
                colWidths={(() => {
                    const stored = localStorage.getItem("storageTableColumnWidths");
                    if (stored) {
                        try {
                            return JSON.parse(stored);
                        } catch (e) {
                            return 200;
                        }
                    }
                    return 200;
                })()}
                columnSorting={true}
                afterChange={handleAfterChange}
                licenseKey="non-commercial-and-evaluation"
                className="htMaterial"
                dropdownMenu={true}
                stretchH="all"
                filters={true}
                rowHeaders={false}
                height="calc(100vh - 200px)"
                dragToScroll={true}
                width="100%"
                contextMenu={{
                    items: {
                        "remove_row": { name: "Remove row(s)" }
                    }
                }}
                afterContextMenuShow={(key, selection) => handleAfterContextMenu(key, selection)}
            />
          )}

          <Modal show={showDeleteModal} onHide={cancelDelete} backdrop="static" keyboard={false}>
              <Modal.Header closeButton>
                  <Modal.Title>Confirm Delete</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                  <p>Are you sure you want to delete the following storages?</p>
                  <ul>
                      {rowsToDelete.map(row => (
                          <li key={row.id}>{row.name || `ID: ${row.id}`}</li>
                      ))}
                  </ul>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" onClick={cancelDelete}>
                      Cancel
                  </Button>
                  <Button variant="danger" onClick={confirmDelete}>
                      Delete
                  </Button>
              </Modal.Footer>
          </Modal>
        </div>
    );
};

export default StorageTable;