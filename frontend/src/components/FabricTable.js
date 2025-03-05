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
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";  // ✅ Fetch fabrics for active customer

    // ✅ Fetch fabrics for the active customer
    const fetchFabrics = () => {
        setLoading(true);
        axios.get(fabricApiUrl)
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

    useEffect(() => {
        fetchFabrics();
    }, []);

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
                        { data: "exists", type: "checkbox" },
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

export default FabricTable;