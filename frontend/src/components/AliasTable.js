import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const AliasTable = () => {
    const [aliases, setAliases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    // ✅ Fetch aliases from the updated `/api/san/aliases/` API
    const fetchAliases = () => {
        setLoading(true);
        axios.get("http://127.0.0.1:8000/api/san/aliases/")
            .then(response => {
                setAliases(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching aliases:", error);
                setError("Failed to load aliases.");
                setLoading(false);
            });
    };

    // Fetch aliases when the component mounts
    useEffect(() => {
        fetchAliases();
    }, []);

    // Handle table edits and update Django backend
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedAliases = [...aliases];

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;

                    const updatedAlias = { ...updatedAliases[physicalRow], [prop]: newValue };
                    updatedAliases[physicalRow] = updatedAlias;
                    setAliases(updatedAliases);

                    // ✅ Send update request to `/api/san/aliases/`
                    axios.put(`http://127.0.0.1:8000/api/san/aliases/${updatedAlias.id}/`, updatedAlias)
                        .catch(error => console.error("Error updating alias:", error));
                }
            });
        }
    };

    return (
        <div className="container mt-4">
            {loading && <div className="alert alert-info">Loading aliases...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={aliases}
                    colHeaders={["ID", "Name", "WWPN", "Use", "Create", "Include in Zoning"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "wwpn" },
                        { data: "use", type: "dropdown", source: ["init", "target", "both"] },  // Dropdown for choices
                        { data: "create", type: "checkbox" },  // Checkbox for boolean
                        { data: "include_in_zoning", type: "checkbox" },  // Checkbox for boolean
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

export default AliasTable;