import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import { Modal, Button } from "react-bootstrap";

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

    const tableRef = useRef(null);  // Reference to the Handsontable instance

    // Fetch initial customers data from Django API
    const fetchCustomers = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/customers/")
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
                axios.delete(`http://127.0.0.1:8000/api/customers/delete/${customer.id}`)
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
                return axios.post("http://127.0.0.1:8000/api/customers/create/", customer);
            } else if (customer.id) {
                // Existing customer update (PUT request)
                return axios.put(`http://127.0.0.1:8000/api/customers/${customer.id}/`, customer);
            }
            return Promise.resolve();
        });

        Promise.all(savePromises)
            .then(() => {
                setSaveStatus("Customers saved successfully! ✅");
                fetchCustomers();
                setTimeout(() => setSaveStatus(""), 3000);
            })
            .catch(() => setSaveStatus("⚠️ Error saving customers!"));
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
                        colHeaders={["ID", "Customer Name", "Notes"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "notes" },
                        ]}
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
                        colWidths={200}
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
                </>
            )}
        </div>
    );
};

export default CustomerTable;
