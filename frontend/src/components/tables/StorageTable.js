import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const StorageTable = () => {
    const [storages, setStorages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);
    const storageListApiUrl = "http://127.0.0.1:8000/api/storage/";

    // ✅ Fetch storages from the updated `/api/storage/storages/` API
    const fetchStorages = () => {
        setLoading(true);
        axios.get(storageListApiUrl)
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
                    axios.put(`${storageListApiUrl}${updatedStorage.id}/`, updatedStorage)
                        .catch(error => console.error("Error updating storage:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">

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
                    manualColumnResize={true}
                    autoColumnSize={true}
                    afterColumnResize={(currentColumn, newSize, isDoubleClick) => {
                        // Retrieve the number of columns
                        const totalCols = tableRef.current.hotInstance.countCols();
                        const widths = [];
                        for (let i = 0; i < totalCols; i++) {
                            widths.push(tableRef.current.hotInstance.getColWidth(i));
                        }
                        localStorage.setItem("aliasTableColumnWidths", JSON.stringify(widths));
                    }}
                    colWidths={(() => {
                        const stored = localStorage.getItem("aliasTableColumnWidths");
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
                    afterChange={handleTableChange}
                    licenseKey="non-commercial-and-evaluation"
                    className= "htMaterial"
                    dropdownMenu={true}
                    stretchH="all"
                    filters={true}
                    rowHeaders={false}
                    height="calc(100vh - 200px)"
                    dragToScroll={true}
                    width="100%"
                />
            )}
        </div>
    );
};

export default StorageTable;