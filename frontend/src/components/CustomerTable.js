import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";  // ✅ Import Bootstrap modal

// Register all Handsontable modules
registerAllModules();

const CustomerTable = () => {
    const [customers, setCustomers] = useState([]);
    const [unsavedCustomers, setUnsavedCustomers] = useState([]);  
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");  
    const [showModal, setShowModal] = useState(false);  
    const [deleteRowIndex, setDeleteRowIndex] = useState(null);  
    const tableRef = useRef(null);

    // ✅ Fetch customers from Django API
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
            .catch(error => {
                console.error("Error fetching customers:", error);
                setError("Failed to load customers.");
                setLoading(false);
            });
    };

    // ✅ Fetch customers on component mount
    useEffect(() => {
        fetchCustomers();
    }, []);

    // ✅ Handle table edits (store changes but don't save yet)
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

    // ✅ Show delete confirmation modal
    const confirmDeleteRow = (rowIndex) => {
        setDeleteRowIndex(rowIndex);
        setShowModal(true);
    };

    // ✅ Handle row deletion
    const handleDelete = () => {
        const updatedCustomers = [...unsavedCustomers];
        const deletedCustomer = updatedCustomers[deleteRowIndex];

        setShowModal(false);  

        if (deletedCustomer.id) {
            // ✅ Send DELETE request to Django
            axios.delete(`http://127.0.0.1:8000/api/customers/delete/${deletedCustomer.id}`)
                .then(() => {
                    updatedCustomers.splice(deleteRowIndex, 1);  
                    setUnsavedCustomers(updatedCustomers);
                    setSaveStatus("Customer deleted successfully! ✅");
                    setTimeout(() => setSaveStatus(""), 3000);
                })
                .catch(error => {
                    console.error("❌ Error deleting customer:", error);
                    setSaveStatus("⚠️ Error deleting customer!");
                });
        } else {
            updatedCustomers.splice(deleteRowIndex, 1);  
            setUnsavedCustomers(updatedCustomers);
        }
    };

    // ✅ Handle save button click
    const handleSave = () => {
        setSaveStatus("Saving...");

        const savePromises = unsavedCustomers.map((customer) => {
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
            .catch(error => {
                console.error("❌ Error saving customers:", error);
                setSaveStatus("⚠️ Error saving customers! Please try again.");
            });
    };

    return (
        <div className="container mt-4">
            <h2>Customers</h2>

            {loading && <div className="alert alert-info">Loading customers...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <>
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
                                "remove_row": {
                                    name: "Delete Row",
                                    callback: (key, selection) => {
                                        const rowIndex = selection[0].start.row;
                                        confirmDeleteRow(rowIndex);  
                                    }
                                }
                            }
                        }}
                        className="handsontable htMaterial"
                        dropdownMenu={true}
                        filters={true}
                        sort={true}
                        rowHeaders={true}
                    />

                    {/* ✅ Save Button */}
                    <button
                        type="button"
                        className={`btn ${saveStatus === "Saving..." ? "btn-secondary" : "btn-primary"} mt-3`}
                        onClick={handleSave}
                        disabled={saveStatus === "Saving..."}
                    >
                        {saveStatus === "Saving..." ? (
                            <> <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving... </>
                        ) : saveStatus.includes("successfully") ? (
                            <> ✅ Saved </>
                        ) : (
                            <> Save </>
                        )}
                    </button>

                    {/* ✅ Bootstrap Delete Confirmation Modal */}
                    <Modal show={showModal} onHide={() => setShowModal(false)}>
                        <Modal.Header closeButton>
                            <Modal.Title>Confirm Deletion</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            Are you sure you want to delete this customer?
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