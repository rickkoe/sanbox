import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules, including filtering
registerAllModules();

const CustomerTable = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    // Fetch customers from Django API
    const fetchCustomers = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/customers/")
            .then(response => {
                setCustomers(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching customers:", error);
                setError("Failed to load customers.");
                setLoading(false);
            });
    };

    // Fetch customers on component mount
    useEffect(() => {
        fetchCustomers();
    }, []);

    // Preserve filter state
    const saveFilterState = () => {
        if (tableRef.current) {
            const filtersPlugin = tableRef.current.hotInstance.getPlugin("Filters");
            if (filtersPlugin) {
                return filtersPlugin.getSelectedColumn();
            }
        }
        return null;
    };
    
    const restoreFilterState = (selectedColumn) => {
        if (tableRef.current && selectedColumn !== null) {
            const filtersPlugin = tableRef.current.hotInstance.getPlugin("Filters");
            if (filtersPlugin) {
                filtersPlugin.clearConditions();
                filtersPlugin.filter();
            }
        }
    };

    // Handle table edits and update Django backend
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedCustomers = [...customers];
            const filtersPlugin = tableRef.current.hotInstance.getPlugin("Filters");
    
            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    // Get the correct row from the original dataset
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;
    
                    const updatedCustomer = { ...updatedCustomers[physicalRow], [prop]: newValue };
    
                    // Update React state
                    updatedCustomers[physicalRow] = updatedCustomer;
                    setCustomers(updatedCustomers);
    
                    // Send update request to Django
                    axios.put(`http://127.0.0.1:8000/api/customers/${updatedCustomer.id}/`, updatedCustomer)
                        .then(() => {
                            setTimeout(() => filtersPlugin.filter(), 50); // Keep filters applied
                        })
                        .catch(error => console.error("Error updating customer:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">
            <h2>Customers</h2>

            {loading && <div className="alert alert-info">Loading customers...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={customers}
                    colHeaders={["ID", "Name"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" }
                    ]}
                    licenseKey="non-commercial-and-evaluation"
                    afterChange={handleTableChange}  // Handle edits
                    className="handsontable"
                    dropdownMenu={true}  // Enables filtering menu
                    filters={true}  // Enables filtering
                    rowHeaders={false}  // Removes row headers
                />
            )}
        </div>
    );
};

export default CustomerTable;