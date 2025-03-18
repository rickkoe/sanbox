import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";  // ✅ Import ConfigContext
import { Button, Alert } from "react-bootstrap";

// Register all Handsontable modules
registerAllModules();

const FabricTable = () => {
    const { config, loading: configLoading } = useContext(ConfigContext);
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");  // ✅ Save status
    const tableRef = useRef(null);

    useEffect(() => {
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    const fetchFabrics = async (customerId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`http://127.0.0.1:8000/api/san/fabrics/customer/${customerId}/`);
            const data = response.data.length > 0 ? response.data : [{ id: null, name: "", zoneset_name: "", vsan: "", exists: false }];
            setFabrics(data);
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
            setError("Failed to load fabrics.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ Add an empty row when changes are made
    const handleAfterChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const lastRow = fabrics[fabrics.length - 1];
        if (lastRow.name.trim() || lastRow.zoneset_name.trim()) {
            setFabrics([...fabrics, { id: null, name: "", zoneset_name: "", vsan: "", exists: false }]);
        }
    };

    // ✅ Save fabrics to the backend
    const handleSave = async () => {
        setSaveStatus("Saving...");

        try {
            const response = await axios.post(
                `http://127.0.0.1:8000/api/san/fabrics/save/`,
                { customer_id: config.customer.id, fabrics: fabrics.filter(fabric => fabric.name.trim()) }
            );

            console.log("✅ Save Response:", response.data);
            setSaveStatus("Fabrics saved successfully! ✅");
            fetchFabrics(config.customer.id);  // ✅ Refresh data after save
        } catch (error) {
            console.error("❌ Error saving fabrics:", error);
            setSaveStatus("⚠️ Error saving fabrics! Please try again.");
        }
    };

    return (
        <div className="container mt-4">
            <h2>Fabrics for {config?.customer?.name || "Customer"}</h2>

            {configLoading ? (
                <Alert variant="info">Loading configuration...</Alert>
            ) : loading ? (
                <Alert variant="info">Loading fabrics...</Alert>
            ) : error ? (
                <Alert variant="danger">{error}</Alert>
            ) : (
                <>
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
                        afterChange={handleAfterChange}  // ✅ Trigger empty row addition
                        licenseKey="non-commercial-and-evaluation"
                        className="handsontable"
                        dropdownMenu={true}
                        filters={true}
                        rowHeaders={false}
                    />

                    {/* ✅ Save Button */}
                    <Button variant="secondary" className="mt-3" onClick={handleSave}>
                        Save Fabrics
                    </Button>

                    {/* ✅ Save Status Message */}
                    {saveStatus && (
                        <Alert variant={saveStatus.includes("Error") ? "danger" : "success"} className="mt-2">
                            {saveStatus}
                        </Alert>
                    )}
                </>
            )}
        </div>
    );
};

export default FabricTable;