import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const FabricTable = () => {
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    // ✅ Fetch fabrics from the updated `/api/san/fabrics/` API
    const fetchFabrics = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/san/fabrics/")
            .then(response => {
                setFabrics(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching fabrics:", error);
                setError("Failed to load fabrics.");
                setLoading(false);
            });
    };

    // Fetch fabrics when the component mounts
    useEffect(() => {
        fetchFabrics();
    }, []);

    // Handle table edits and update Django backend
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedFabrics = [...fabrics];

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    const updatedFabric = { ...updatedFabrics[physicalRow], [prop]: newValue };
                    updatedFabrics[physicalRow] = updatedFabric;
                    setFabrics(updatedFabrics);

                    // ✅ Send update request to `/api/san/fabrics/`
                    axios.put(`http://127.0.0.1:8000/api/san/fabrics/${updatedFabric.id}/`, updatedFabric)
                        .catch(error => console.error("Error updating fabric:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">
            {loading && <div className="alert alert-info">Loading fabrics...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={fabrics}
                    colHeaders={["ID", "Name", "Zoneset Name", "VSAN", "Exists"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "zoneset_name" },
                        { data: "vsan", type: "numeric" },
                        { data: "exists", type: "checkbox" },  // Checkbox for boolean
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

export default FabricTable;