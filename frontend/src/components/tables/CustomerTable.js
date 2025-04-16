import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import { Modal, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const CustomerTable = () => {
    // Customers fetched from the API (initial data)
    const [customers, setCustomers] = useState([]);
    // Unsaved changes made by the user
    const [unsavedCustomers, setUnsavedCustomers] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading status
    const [error, setError] = useState(null);      // Error message state
    const [saveStatus, setSaveStatus] = useState("");  // Save status feedback

    // Manage row selections for deletion
    const [selectedRows, setSelectedRows] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [nextPath, setNextPath] = useState(null);
    const navigate = useNavigate();

    const tableRef = useRef(null);  // Reference to the Handsontable instance
    const customersApiUrl = "http://127.0.0.1:8000/api/customers/";
    const customerDeleteApiUrl = "http://127.0.0.1:8000/api/customers/delete/";
    const customerCreateApiUrl = "http://127.0.0.1:8000/api/customers/create/";
    const customerSaveApiUrl = "http://127.0.0.1:8000/api/customers/";

    // Fetch initial customers data from Django API
    const fetchCustomers = () => {
        setLoading(true);
        axios.get(customersApiUrl)
            .then(response => {
                const customerData = response.data;
                customerData.push({ id: "", name: "" });  // Adds empty row for new entries
                setCustomers(customerData);
                setUnsavedCustomers([...customerData]);
                setLoading(false);
            })
            .catch(error => {
                setError("Failed to load customers.");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchCustomers();  // Initial data fetch
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const originalPushState = window.history.pushState;
        window.history.pushState = function(state, title, url) {
            setNextPath(url);
            setShowNavigationModal(true);
            // Do not call originalPushState to block navigation
        };
        return () => {
            window.history.pushState = originalPushState;
        };
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, "", window.location.pathname);
            setNextPath(window.location.pathname);
            setShowNavigationModal(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isDirty]);

    // Handle changes in the table (not immediately saved)
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedCustomers = [...unsavedCustomers];
            let shouldAddNewRow = false;

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    updatedCustomers[physicalRow][prop] = newValue;

                    // Add new blank row automatically when the last row is edited
                    if (physicalRow === updatedCustomers.length - 1 && newValue.trim() !== "") {
                        shouldAddNewRow = true;
                    }
                }
            });

            if (shouldAddNewRow) {
                updatedCustomers.push({ id: "", name: "" });
            }

            setIsDirty(true);
            setUnsavedCustomers(updatedCustomers);
        }
    };

    // Prepare deletion modal with selected rows
    const confirmDeleteRows = (selection) => {
        const rowIndexes = selection.flatMap(sel =>
            [...Array(sel.end.row - sel.start.row + 1).keys()].map(i => sel.start.row + i)
        );

        const selectedCustomers = rowIndexes.map(index => unsavedCustomers[index]);
        setSelectedRows(selectedCustomers);
        setShowModal(true);
    };

    // Handle confirmed row deletion
    const handleDelete = () => {
        setShowModal(false);

        const customersToDelete = selectedRows.filter(customer => customer.id);

        if (customersToDelete.length > 0) {
            const deletePromises = customersToDelete.map(customer =>
                axios.delete(`${customerDeleteApiUrl}${customer.id}`)
            );

            Promise.all(deletePromises)
                .then(() => {
                    setSaveStatus("Customers deleted successfully! ✅");
                    fetchCustomers();
                    setTimeout(() => setSaveStatus(""), 3000);
                })
                .catch(() => setSaveStatus("⚠️ Error deleting customers!"));
        } else {
            const remainingCustomers = unsavedCustomers.filter(c => !selectedRows.includes(c));
            setUnsavedCustomers(remainingCustomers);
        }
    };

    // Save all unsaved changes to Django API
    const handleSave = () => {
        setSaveStatus("Saving...");

        const savePromises = unsavedCustomers.map(customer => {
            if (!customer.id && customer.name.trim() !== "") {
                // New customer entry (POST request)
                return axios.post(customerCreateApiUrl, customer);
            } else if (customer.id) {
                // Existing customer update (PUT request)
                return axios.put(`${customerSaveApiUrl}${customer.id}/`, customer);
            }
            return Promise.resolve();
        });

        Promise.all(savePromises)
        .then(() => {
            setSaveStatus("Customers saved successfully! ✅");
            setIsDirty(false); // Reset dirty flag after successful save
            fetchCustomers();
            setTimeout(() => setSaveStatus(""), 3000);
        })
        .catch(() => setSaveStatus("⚠️ Error saving customers!"));
    };

    const handleNavigationAttempt = (path) => {
        if (isDirty) {
            setNextPath(path);
            setShowNavigationModal(true);
        } else {
            navigate(path);
        }
    };

    return (
        <div className="table-container">
            {loading && <div className="alert alert-info">Loading customers...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <>
                    <div>
                        <Button className="save-button" onClick={handleSave}>Save</Button>
                    </div>

                    {/* Customer Table (Handsontable) */}
                    <HotTable
                        ref={tableRef}
                        data={unsavedCustomers}
                        fixedColumnsLeft={2}
                        colHeaders={["ID", "Customer Name", "Notes"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "notes" },
                        ]}
                        manualColumnResize={true}
                        autoColumnSize={true}
                        afterColumnResize={(currentColumn, newSize, isDoubleClick) => {
                            // Retrieve the number of columns
                            const totalCols = tableRef.current.hotInstance.countCols();
                            const widths = [];
                            for (let i = 0; i < totalCols; i++) {
                                widths.push(tableRef.current.hotInstance.getColWidth(i));
                            }
                            localStorage.setItem("customerTableColumnWidths", JSON.stringify(widths));
                        }}
                        colWidths={(() => {
                            const stored = localStorage.getItem("customerTableColumnWidths");
                            if (stored) {
                                try {
                                    return JSON.parse(stored);
                                } catch (e) {
                                    return 200;
                                }
                            }
                            return 200;
                        })()}
                        licenseKey="non-commercial-and-evaluation"
                        afterChange={handleTableChange}
                        contextMenu={{
                            items: {
                                "remove_rows": {
                                    name: "Delete Selected Rows",
                                    callback: (key, selection) => confirmDeleteRows(selection)
                                }
                            }
                        }}
                        columnSorting={true}
                        className= "htMaterial"
                        dropdownMenu={true}
                        stretchH="all"
                        filters={true}
                        rowHeaders={false}
                        height="calc(100vh - 200px)"
                        dragToScroll={true}
                        width="100%"
                    />

                    {/* Deletion confirmation modal */}
                    <Modal show={showModal} onHide={() => setShowModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Confirm Deletion</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            Are you sure you want to delete the following customers?
                            <ul>
                                {selectedRows.map((customer, index) => (
                                    <li key={index}>{customer.name || "Unnamed Customer"}</li>
                                ))}
                            </ul>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button variant="danger" onClick={handleDelete}>Delete</Button>
                        </Modal.Footer>
                    </Modal>

                    {/* Navigation blocking modal */}
                    <Modal show={showNavigationModal} onHide={() => setShowNavigationModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Unsaved Changes</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            You have unsaved changes. Are you sure you want to leave?
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowNavigationModal(false)}>
                                Stay on this page
                            </Button>
                            <Button variant="primary" onClick={() => {
                                setIsDirty(false);
                                setShowNavigationModal(false);
                                navigate(nextPath);
                            }}>
                                Leave
                            </Button>
                        </Modal.Footer>
                    </Modal>
                </>
            )}
        </div>
    );
};

export default CustomerTable;
