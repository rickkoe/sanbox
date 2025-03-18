import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert } from "react-bootstrap";

// Register all Handsontable modules
registerAllModules();

const FabricTable = () => {
    const { config, loading: configLoading } = useContext(ConfigContext);
    const [fabrics, setFabrics] = useState([]);
    const [unsavedFabrics, setUnsavedFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const tableRef = useRef(null);

    useEffect(() => {
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    // ✅ Ensure a blank row is always present
    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", zoneset_name: "", vsan: "", exists: false }];
        }
        return data;
    };

    // ✅ Fetch fabrics for the active customer
    const fetchFabrics = async (customerId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`http://127.0.0.1:8000/api/san/fabrics/customer/${customerId}/`);
            const data = ensureBlankRow(response.data);
            setFabrics(data);
            setUnsavedFabrics([...data]);
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
            setError("Failed to load fabrics.");
            setFabrics(ensureBlankRow([]));  // Ensure at least one blank row
        } finally {
            setLoading(false);
        }
    };

    // ✅ Handle table edits & auto-add new row when needed
    const handleTableChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const updatedFabrics = [...unsavedFabrics];
        let shouldAddNewRow = false;

        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;

                updatedFabrics[physicalRow][prop] = newValue;

                // ✅ If editing last row, add a new blank row
                if (physicalRow === updatedFabrics.length - 1 && newValue.trim() !== "") {
                    shouldAddNewRow = true;
                }
            }
        });

        if (shouldAddNewRow) {
            updatedFabrics.push({ id: null, name: "", zoneset_name: "", vsan: "", exists: false });
        }

        setUnsavedFabrics(updatedFabrics);
    };

    // ✅ Save updated & new fabrics
    const handleSave = async () => {
        if (!config?.customer?.id) {
            setSaveStatus("⚠️ No active customer selected!");
            return;
        }
    
        setSaveStatus("Saving...");
    
        try {
            // ✅ Ensure new fabrics include `customer_id`
            const payload = unsavedFabrics
                .filter(fabric => fabric.name.trim())  // ✅ Exclude empty rows
                .map(fabric => ({
                    ...fabric,
                    customer: config.customer.id  // ✅ Assign customer to new rows
                }));
    
            const response = await axios.post(
                `http://127.0.0.1:8000/api/san/fabrics/save/`,
                { customer_id: config.customer.id, fabrics: payload }
            );
    
            console.log("✅ Save Response:", response.data);
            setSaveStatus("Fabrics saved successfully! ✅");
            fetchFabrics(config.customer.id);  // ✅ Refresh table
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
                        data={unsavedFabrics}
                        colHeaders={["ID", "Name", "Zoneset Name", "VSAN", "Exists"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "zoneset_name" },
                            { data: "vsan", type: "numeric" },
                            { data: "exists", type: "checkbox" },
                        ]}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                        className="handsontable"
                        dropdownMenu={true}
                        filters={true}
                        rowHeaders={false}
                    />

                    <Button variant="secondary" className="mt-3" onClick={handleSave}>
                        Save Fabrics
                    </Button>

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