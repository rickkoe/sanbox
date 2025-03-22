import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert } from "react-bootstrap";

// Register all Handsontable modules
registerAllModules();

const ZoneTable = () => {
    const { config } = useContext(ConfigContext);
    const [zones, setZones] = useState([]);
    const [unsavedZones, setUnsavedZones] = useState([]);
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const tableRef = useRef(null);

    const zoneApiUrl = "http://127.0.0.1:8000/api/san/zones/project/";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";

    useEffect(() => {
        if (config?.active_project?.id) {
            fetchZones(config.active_project.id);
        }
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    // ✅ Ensure a blank row is always present
    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", fabric: "", create: false, exists: false, zone_type: "smart" }];
        }
        return data;
    };

    // ✅ Fetch zones for the active project
    const fetchZones = async (projectId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${zoneApiUrl}${projectId}/`);
            const data = ensureBlankRow(response.data);
            setZones(data);
            setUnsavedZones([...data]);
        } catch (error) {
            console.error("❌ Error fetching zones:", error);
            setError("Failed to load zones.");
            setZones(ensureBlankRow([]));  // Ensure at least one blank row
        } finally {
            setLoading(false);
        }
    };

    // ✅ Fetch fabrics for the active customer
    const fetchFabrics = async (customerId) => {
        try {
            const response = await axios.get(`${fabricApiUrl}${customerId}/`);
            setFabrics(response.data.map(fabric => ({ id: fabric.id, name: fabric.name }))); // ✅ Ensure ID and Name
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
        }
    };

    // ✅ Handle table edits & auto-add new row when needed
    const handleTableChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const updatedZones = [...unsavedZones];
        let shouldAddNewRow = false;

        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;

                updatedZones[physicalRow][prop] = newValue;

                // ✅ If editing last row, add a new blank row
                if (physicalRow === updatedZones.length - 1 && newValue.trim() !== "") {
                    shouldAddNewRow = true;
                }
            }
        });

        if (shouldAddNewRow) {
            updatedZones.push({ id: null, name: "", fabric: "", create: false, exists: false, zone_type: "smart" });
        }

        setUnsavedZones(updatedZones);
    };

    // ✅ Save updated & new zones
    const handleSave = async () => {
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }

        setSaveStatus("Saving...");

        const payload = unsavedZones
            .filter(zone => zone.name.trim())  // ✅ Only send valid entries
            .map(zone => ({
                ...zone,
                projects: [config.active_project.id],  // ✅ Assign project
                fabric: fabrics.find(f => f.name === zone.fabric_details.name)?.id,  // ✅ Convert fabric name back to ID
            }));

        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));

        try {
            const response = await axios.post(
                `http://127.0.0.1:8000/api/san/zones/save/`,
                { project_id: config.active_project.id, zones: payload }
            );

            console.log("✅ Save Response:", response.data);
            setSaveStatus("Zones saved successfully! ✅");
            fetchZones(config.active_project.id);  // ✅ Refresh table
        } catch (error) {
            console.error("❌ Error saving zones:", error);
            setSaveStatus("⚠️ Error saving zones! Please try again.");
        }
    };

    return (
        <div className="table-container">

            {loading ? (
                <Alert variant="info">Loading zones...</Alert>
            ) : error ? (
                <Alert variant="danger">{error}</Alert>
            ) : (
                <>
                    <Button className="save-button" onClick={handleSave}>
                        Save
                    </Button>
                    <HotTable
                        ref={tableRef}
                        data={unsavedZones}
                        colHeaders={["ID", "Name", "Fabric", "Create", "Exists", "Zone Type"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { 
                                data: "fabric_details.name", 
                                type: "dropdown", 
                                source: fabrics.map(f => f.name)  // ✅ Use fabric names
                            },
                            { data: "create", type: "checkbox" },
                            { data: "exists", type: "checkbox" },
                            { data: "zone_type", type: "dropdown", source: ["smart", "standard"] },
                        ]}
                        columnSorting={true}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                        className= "htMaterial"
                        dropdownMenu={true}
                        stretchH="all"
                        filters={true}
                        rowHeaders={false}
                        colWidths={200}
                        height="calc(100vh - 200px)"
                        dragToScroll={true}
                        width="100%"
                    />

                    {saveStatus && (
                        <Alert variant={saveStatus.includes("Error") ? "danger" : "success"}>
                            {saveStatus}
                        </Alert>
                    )}
                </>
            )}
        </div>
    );
};

export default ZoneTable;