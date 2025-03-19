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
    const { config } = useContext(ConfigContext);  // ✅ Get active config (active project)
    const [zones, setZones] = useState([]);
    const [unsavedZones, setUnsavedZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const tableRef = useRef(null);

    const zoneApiUrl = "http://127.0.0.1:8000/api/san/zones/project/";

    useEffect(() => {
        if (config?.active_project?.id) {
            fetchZones(config.active_project.id);
        }
    }, [config]);

    // ✅ Ensure a blank row is always present
    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", create: false, exists: false, zone_type: "" }];
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
            updatedZones.push({ id: null, name: "", create: false, exists: false, zone_type: "" });
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

            if (error.response) {
                console.error("❌ API Response Error:", JSON.stringify(error.response.data, null, 2));

                if (error.response.data.details) {
                    const errorMessages = error.response.data.details.map(e => {
                        const errorText = Object.values(e.errors).flat().join(", "); // ✅ Convert error object to string
                        return `Can't save zone name: "${e.zone}".  ${errorText}`;
                    });

                    setSaveStatus(`⚠️ Error: ${errorMessages.join(" | ")}`);
                } else {
                    setSaveStatus("⚠️ Error saving zones! Please try again.");
                }
            } else {
                setSaveStatus("⚠️ Network error. Try again.");
            }
        }
    };

    return (
        <div className="container mt-4">
            <h2>Zones for {config?.active_project?.name || "Project"}</h2>

            {loading ? (
                <Alert variant="info">Loading zones...</Alert>
            ) : error ? (
                <Alert variant="danger">{error}</Alert>
            ) : (
                <>
                    <HotTable
                        ref={tableRef}
                        data={unsavedZones}
                        colHeaders={["ID", "Name", "Create", "Exists", "Zone Type"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "create", type: "checkbox" },
                            { data: "exists", type: "checkbox" },
                            { data: "zone_type", type: "dropdown", source: ["smart", "standard"] },
                        ]}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                        className="handsontable"
                        dropdownMenu={true}
                        filters={true}
                        rowHeaders={false}
                    />

                    <Button variant="secondary" className="mt-3" onClick={handleSave}>
                        Save Zones
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

export default ZoneTable;