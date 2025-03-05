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
    const [selectedRows, setSelectedRows] = useState([]);  // ✅ Store multiple selected row indexes
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
    const confirmDeleteRows = (selection) => {
        const rowIndexes = selection.map(sel => [...Array(sel.end.row - sel.start.row + 1).keys()].map(i => sel.start.row + i)).flat();  // ✅ Get all selected row indexes
        const selectedCustomers = rowIndexes.map(index => unsavedCustomers[index]);  // ✅ Get customer objects
    
        console.log("🛠 Selected Rows for Deletion:", selectedCustomers);  // ✅ Debugging
    
        setSelectedRows(selectedCustomers);  // ✅ Store all selected customers
        setShowModal(true);
    };

    // ✅ Handle row deletion
    const handleDelete = () => {
        setShowModal(false);
    
        if (selectedRows.length === 0) return;  // ✅ Prevent errors if no rows are selected
    
        const updatedCustomers = [...unsavedCustomers];
        const customersToDelete = selectedRows.filter(customer => customer.id);  // ✅ Only delete saved customers
    
        if (customersToDelete.length > 0) {
            console.log("🛠 Sending DELETE requests for:", customersToDelete.map(c => c.id));
    
            const deletePromises = customersToDelete.map(customer => 
                axios.delete(`http://127.0.0.1:8000/api/customers/delete/${customer.id}`)
            );
    
            Promise.all(deletePromises)
                .then(() => {
                    console.log("✅ Successfully deleted customers:", customersToDelete.map(c => c.id));
                    const remainingCustomers = updatedCustomers.filter(c => !selectedRows.includes(c));
                    setUnsavedCustomers([...remainingCustomers]);  // ✅ Update state
                    setSaveStatus("Customers deleted successfully! ✅");
                    setTimeout(() => setSaveStatus(""), 3000);
                })
                .catch(error => {
                    console.error("❌ Error deleting customers:", error);
                    setSaveStatus("⚠️ Error deleting customers!");
                });
        } else {
            console.log("🛠 Deleting unsaved rows.");
            const remainingCustomers = updatedCustomers.filter(c => !selectedRows.includes(c));
            setUnsavedCustomers([...remainingCustomers]);  // ✅ Remove unsaved rows
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
        <div className="container">
            {loading && <div className="alert alert-info">Loading customers...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <>
                    {/* ✅ Save Button */}
                    <button
                        type="button"
                        className={`btn btn-sm ${saveStatus === "Saving..." ? "btn-secondary" : "btn-secondary"} mb-2`}
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
                                "remove_rows": {
                                    name: "Delete Selected Rows",  // ✅ Updated label for multiple deletion
                                    callback: (key, selection) => {
                                        confirmDeleteRows(selection);  // ✅ Handle multiple row deletion
                                    }
                                }
                            }
                        }}
                        className="handsontable htMaterial"
                        dropdownMenu={true}
                        filters={true}
                        sort={true}
                        rowHeaders={false}  
                        selectionMode="multiple"  // ✅ Enables multi-row selection
                    />

                    {/* ✅ Bootstrap Delete Confirmation Modal */}
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