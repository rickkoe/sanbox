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
    const [aliases, setAliases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const [memberColumns, setMemberColumns] = useState(1);
    const tableRef = useRef(null);

    const zoneApiUrl = "http://127.0.0.1:8000/api/san/zones/project/";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";
    const aliasApiUrl = "http://127.0.0.1:8000/api/san/aliases/project/";

    useEffect(() => {
        if (config?.active_project?.id) {
            fetchZones(config.active_project.id);
            fetchAliases(config.active_project.id);
        }
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    const fetchZones = async (projectId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${zoneApiUrl}${projectId}/`);
            const zonesData = response.data.map(zone => {
                const zoneData = { ...zone };
                zone.members_details.forEach((member, index) => {
                    zoneData[`member_${index + 1}`] = member.name;
                });
                return zoneData;
            });

            setZones(zonesData);
            setUnsavedZones(zonesData);
        } catch (error) {
            console.error("Error fetching zones:", error);
            setError("Failed to load zones.");
        } finally {
            setLoading(false);
        }
    };

    const fetchFabrics = async (customerId) => {
        try {
            const response = await axios.get(`${fabricApiUrl}${customerId}/`);
            setFabrics(response.data.map(fabric => ({ id: fabric.id, name: fabric.name })));
        } catch (error) {
            console.error("Error fetching fabrics:", error);
        }
    };

    const fetchAliases = async (projectId) => {
        try {
            const response = await axios.get(`${aliasApiUrl}${projectId}/`);
            setAliases(response.data.map(alias => ({ id: alias.id, name: alias.name })));
        } catch (error) {
            console.error("Error fetching aliases:", error);
        }
    };

    const handleTableChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const updatedZones = [...unsavedZones];
        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;
                updatedZones[physicalRow][prop] = newValue;
            }
        });
        setUnsavedZones(updatedZones);
    };

    const handleSave = async () => {
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }

        setSaveStatus("Saving...");

        const payload = unsavedZones.map(zone => ({
            ...zone,
            projects: [config.active_project.id],
            fabric: fabrics.find(f => f.name === zone.fabric_details.name)?.id,
            members: Object.keys(zone)
                .filter(key => key.startsWith("member_"))
                .map(key => aliases.find(alias => alias.name === zone[key])?.id)
                .filter(Boolean)
        }));

        try {
            await axios.post(`http://127.0.0.1:8000/api/san/zones/save/`, { 
                project_id: config.active_project.id,
                zones: payload
            });
            setSaveStatus("Zones saved successfully! ✅");
            fetchZones(config.active_project.id);
        } catch (error) {
            console.error("Error saving zones:", error);
            setSaveStatus("⚠️ Error saving zones! Please try again.");
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
                    <Button className="save-button mb-3" onClick={handleSave}>Save Zones</Button>
                    <HotTable
                        ref={tableRef}
                        data={unsavedZones}
                        colHeaders={["ID", "Name", "Fabric", "Create", "Exists", "Zone Type", "Notes", ...Array.from({length: 5}, (_, i) => `Member ${i + 1}`)]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "fabric_details.name", type: "dropdown", source: fabrics.map(f => f.name) },
                            { data: "create", type: "checkbox" },
                            { data: "exists", type: "checkbox" },
                            { data: "zone_type", type: "dropdown", source: ["smart", "standard"] },
                            { data: "notes" },
                            ...Array.from({ length: 5 }, (_, i) => ({
                                data: `member_${i + 1}`,
                                type: "dropdown",
                                source: aliases.map(alias => alias.name)
                            })),
                        ]}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                    />
                </>
            )}
        </div>
    );
};

export default ZoneTable;