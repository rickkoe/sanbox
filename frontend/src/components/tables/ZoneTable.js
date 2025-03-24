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
    const [newColumnsCount, setNewColumnsCount] = useState(1); // To capture user input for new columns
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

    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", fabric: "", members: [], create: false, exists: false, zone_type: "smart" }];
        }
        return data;
    };

    const fetchZones = async (projectId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${zoneApiUrl}${projectId}/`);
            const zones = response.data.map(zone => {
                const zoneData = { ...zone };
                zone.members_details.forEach((member, index) => {
                    zoneData[`member_${index + 1}`] = member.name;
                });
                return zoneData;
            });
    
            const dataWithBlankRow = ensureBlankRow(zones);
            setZones(dataWithBlankRow);
            setUnsavedZones([...dataWithBlankRow]);
    
            const maxMembers = Math.max(...zones.map(zone => zone.members.length), 1);
            setMemberColumns(maxMembers);  // Ensure the columns match the maximum number of members in any zone
    
        } catch (error) {
            console.error("❌ Error fetching zones:", error);
            setError("Failed to load zones.");
            setZones(ensureBlankRow([]));
        } finally {
            setLoading(false);
        }
    };

    const fetchFabrics = async (customerId) => {
        try {
            const response = await axios.get(`${fabricApiUrl}${customerId}/`);
            setFabrics(response.data.map(fabric_details => ({ id: fabric_details.id, name: fabric_details.name })));
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
        }
    };

    const fetchAliases = async (projectId) => {
        try {
            const response = await axios.get(`${aliasApiUrl}${projectId}/`);
            setAliases(response.data.map(alias => ({ id: alias.id, name: alias.name })));
        } catch (error) {
            console.error("❌ Error fetching aliases:", error);
        }
    };

    const handleTableChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const updatedZones = [...unsavedZones];
        let shouldAddNewRow = false;

        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;

                updatedZones[physicalRow][prop] = newValue;

                if (physicalRow === updatedZones.length - 1 && newValue.trim() !== "") {
                    shouldAddNewRow = true;
                }
            }
        });

        if (shouldAddNewRow) {
            updatedZones.push({ id: null, name: "", fabric: "", members: [], create: false, exists: false, zone_type: "smart" });
        }

        setUnsavedZones(updatedZones);
    };

    const handleSave = async () => {
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }

        setSaveStatus("Saving...");

        const payload = unsavedZones
            .filter(zone => zone.name.trim())
            .map(zone => ({
                ...zone,
                projects: [config.active_project.id],
                fabric: fabrics.find(f => f.name === zone.fabric)?.id,
                members: Array.from({length: memberColumns}, (_, i) => zone[`member_${i + 1}`])
                    .filter(Boolean)
                    .map(memberName => {
                        const foundAlias = aliases.find(alias => alias.name === memberName);
                        return foundAlias ? foundAlias.id : null;
                    }).filter(Boolean)
            }));

        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));

        try {
            const response = await axios.post(
                `http://127.0.0.1:8000/api/san/zones/save/`,
                { project_id: config.active_project.id, zones: payload }
            );

            console.log("✅ Save Response:", response.data);
            setSaveStatus("Zones saved successfully! ✅");
            fetchZones(config.active_project.id);
        } catch (error) {
            console.error("❌ Error saving zones:", error);
            setSaveStatus("⚠️ Error saving zones! Please try again.");
        }
    };

    const handleAddColumns = () => {
        setMemberColumns(prev => prev + parseInt(newColumnsCount));
        setNewColumnsCount(1);
    };

    return (
        <div className="table-container">
            <h2>Zones for {config?.active_project?.name || "Project"}</h2>
            <div>
                <Button className="save-button" onClick={handleSave}>Save</Button>
                <Button onClick={handleAddColumns} className="save-button">Add Member Columns</Button>
            </div>
            
            <HotTable
                ref={tableRef}
                data={unsavedZones}
                colHeaders={["ID", "Name", "Fabric", "Create", "Exists", "Zone Type", "Notes", ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)]}
                columns={[
                    { data: "id", readOnly: true },
                    { data: "name" },
                    { data: "fabric_details.name", type: "dropdown", source: fabrics.map(f => f.name) },
                    { data: "create", type: "checkbox" },
                    { data: "exists", type: "checkbox" },
                    { data: "zone_type", type: "dropdown", source: ["smart", "standard"] },
                    { data: "notes" },
                    ...Array.from({length: memberColumns}, (_, i) => ({ 
                        data: `member_${i + 1}`,
                        type: "dropdown", 
                        source: aliases.map(alias => alias.name)
                    })),
                ]}
                afterChange={handleTableChange}
                licenseKey="non-commercial-and-evaluation"
                columnSorting={true}
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
        </div>
    );
};

export default ZoneTable;