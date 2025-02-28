import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const StorageTable = () => {
    const [storages, setStorages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    // ✅ Fetch storages from the updated `/api/storage/storages/` API
    const fetchStorages = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/storage/storages/")
            .then(response => {
                setStorages(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching storages:", error);
                setError("Failed to load storages.");
                setLoading(false);
            });
    };

    // Fetch storages when the component mounts
    useEffect(() => {
        fetchStorages();
    }, []);

    // Handle table edits and update Django backend
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedStorages = [...storages];

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    const updatedStorage = { ...updatedStorages[physicalRow], [prop]: newValue };
                    updatedStorages[physicalRow] = updatedStorage;
                    setStorages(updatedStorages);

                    // ✅ Send update request to `/api/storage/storages/`
                    axios.put(`http://127.0.0.1:8000/api/storage/storages/${updatedStorage.id}/`, updatedStorage)
                        .catch(error => console.error("Error updating storage:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">
            <h2>Storage Devices</h2>

            {loading && <div className="alert alert-info">Loading storages...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={storages}
                    colHeaders={["ID", "Name", "Type", "Location", "Serial Number"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "storage_type", type: "dropdown", source: ["FlashSystem", "DS8000", "Switch", "Data Domain"] },
                        { data: "location" },
                        { data: "serial_number" },
                    ]}
                    licenseKey="non-commercial-and-evaluation"
                    afterChange={handleTableChange}
                    className="handsontable"
                    dropdownMenu={true}
                    filters={true}
                    rowHeaders={false}
                />
            )}
        </div>
    );
};

export default StorageTable;