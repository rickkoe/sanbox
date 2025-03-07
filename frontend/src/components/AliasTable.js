import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";

// Register all Handsontable modules
registerAllModules();

const AliasTable = () => {
    const [aliases, setAliases] = useState([]);
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);
    const aliasApiUrl = "http://127.0.0.1:8000/api/san/aliases/project";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";  // ✅ Fetch fabrics based on the customer

    // ✅ Fetch aliases
    const fetchAliases = () => {
        setLoading(true);
        axios.get(aliasApiUrl)
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

    // ✅ Fetch fabrics for dropdown
    const fetchFabrics = () => {
        axios.get(fabricApiUrl)
            .then(response => {
                setFabrics(response.data.map(fabric => fabric.name));  // ✅ Extract fabric names for dropdown
            })
            .catch(error => console.error("Error fetching fabrics:", error));
    };

    useEffect(() => {
        fetchAliases();
        fetchFabrics();
    }, []);

    return (
        <div className="container mt-4">
            <h2>Alisases for Project </h2>

            {loading && <div className="alert alert-info">Loading aliases...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <HotTable
                    ref={tableRef}
                    data={aliases}
                    colHeaders={["ID", "Name", "WWPN", "Fabric", "Use", "Create", "Include in Zoning"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "wwpn" },
                        { data: "fabric", type: "dropdown", source: fabrics },  // ✅ Dropdown for fabrics
                        { data: "use", type: "dropdown", source: ["init", "target", "both"] },
                        { data: "create", type: "checkbox" },
                        { data: "include_in_zoning", type: "checkbox" },
                    ]}
                    licenseKey="non-commercial-and-evaluation"
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