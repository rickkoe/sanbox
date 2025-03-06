import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import { Modal, Button } from "react-bootstrap";

const CustomerTable = () => {
    const [customers, setCustomers] = useState([]);
    const [unsavedCustomers, setUnsavedCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const [selectedRows, setSelectedRows] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const tableRef = useRef(null);

    const fetchCustomers = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/customers/")
            .then(response => {
                const customerData = response.data;
                customerData.push({ id: "", name: "" });
                setCustomers(customerData);
                setUnsavedCustomers([...customerData]);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load customers.");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedCustomers = [...unsavedCustomers];
            let shouldAddNewRow = false;

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    updatedCustomers[physicalRow] = { ...updatedCustomers[physicalRow], [prop]: newValue };

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

    const confirmDeleteRows = (selection) => {
        const rowIndexes = selection.flatMap(sel => Array.from({ length: sel.end.row - sel.start.row + 1 }, (_, i) => sel.start.row + i));
        const selectedCustomers = rowIndexes.map(index => unsavedCustomers[index]);
        setSelectedRows(selectedCustomers);
        setShowModal(true);
    };

    const handleDelete = () => {
        setShowModal(false);

        if (selectedRows.length === 0) return;

        const updatedCustomers = unsavedCustomers.filter(c => !selectedRows.includes(c));
        const customersToDelete = selectedRows.filter(customer => customer.id);

        if (customersToDelete.length > 0) {
            Promise.all(customersToDelete.map(customer => axios.delete(`http://127.0.0.1:8000/api/customers/delete/${customer.id}`)))
                .then(() => {
                    setUnsavedCustomers(updatedCustomers);
                    setSaveStatus("Customers deleted successfully! ✅");
                    setTimeout(() => setSaveStatus(""), 3000);
                })
                .catch(error => setSaveStatus("⚠️ Error deleting customers!"));
        } else {
            setUnsavedCustomers(updatedCustomers);
        }
    };

    const handleSave = () => {
        setSaveStatus("Saving...");

        const savePromises = unsavedCustomers.map(customer => {
            if (!customer.id && customer.name.trim() !== "") {
                return axios.post("http://127.0.0.1:8000/api/customers/create/", customer);
            } else if (customer.id) {
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
            .catch(() => {
                setSaveStatus("⚠️ Error saving customers! Please try again.");
            });
    };

    return (
        <div className="container">
            {loading && <div className="alert alert-info">Loading customers...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <>
                    <button
                        type="button"
                        className={`btn btn-sm ${saveStatus === "Saving..." ? "btn-secondary" : "btn-primary"} mb-2`}
                        onClick={handleSave}
                        disabled={saveStatus === "Saving..."}
                    >
                        {saveStatus || "Save"}
                    </button>

                    <HotTable
                        ref={tableRef}
                        data={unsavedCustomers}
                        colHeaders={["ID", "Customer Name"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" }
                        ]}
                        licenseKey="non-commercial-and-evaluation"
                        afterChange={handleTableChange}
                        contextMenu={{
                            items: {
                                remove_rows: {
                                    name: "Delete Selected Rows",
                                    callback: (key, selection) => confirmDeleteRows(selection)
                                }
                            }
                        }}
                        className="handsontable htMaterial"
                        dropdownMenu
                        filters
                        sort
                        rowHeaders={false}
                        selectionMode="multiple"
                    />

                    <Modal show={showModal} onHide={() => setShowModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Confirm Deletion</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            Are you sure you want to delete the selected customers?
                            <ul>
                                {selectedRows.map((customer, index) => <li key={index}>{customer.name || "Unnamed Customer"}</li>)}
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
