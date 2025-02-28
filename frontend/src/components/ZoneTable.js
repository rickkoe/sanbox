import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const ZoneTable = () => {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    // ✅ Fetch zones from the updated `/api/san/zones/` API
    const fetchZones = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/san/zones/")
            .then(response => {
                setZones(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching zones:", error);
                setError("Failed to load zones.");
                setLoading(false);
            });
    };

    // Fetch zones when the component mounts
    useEffect(() => {
        fetchZones();
    }, []);

    // Handle table edits and update Django backend
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedZones = [...zones];

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    const updatedZone = { ...updatedZones[physicalRow], [prop]: newValue };
                    updatedZones[physicalRow] = updatedZone;
                    setZones(updatedZones);

                    // ✅ Send update request to `/api/san/zones/`
                    axios.put(`http://127.0.0.1:8000/api/san/zones/${updatedZone.id}/`, updatedZone)
                        .catch(error => console.error("Error updating zone:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">
            {loading && <div className="alert alert-info">Loading zones...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={zones}
                    colHeaders={["ID", "Name", "Create", "Exists", "Zone Type"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "create", type: "checkbox" },
                        { data: "exists", type: "checkbox" },
                        { data: "zone_type", type: "dropdown", source: ["smart", "standard"] },  // Dropdown for zone type
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

export default ZoneTable;