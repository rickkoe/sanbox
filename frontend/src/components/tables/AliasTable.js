import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert } from "react-bootstrap";
// import "../../styles/tables.css";

// Register all Handsontable modules
registerAllModules();

const AliasTable = () => {
    const { config } = useContext(ConfigContext);
    const [aliases, setAliases] = useState([]);
    const [unsavedAliases, setUnsavedAliases] = useState([]);
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const tableRef = useRef(null);

    const aliasApiUrl = "http://127.0.0.1:8000/api/san/aliases/project/";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";

    useEffect(() => {
        if (config?.active_project?.id) {
            fetchAliases(config.active_project.id);
        }
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    useEffect(() => {
        console.log("AliasTable debug:", { loading, error, config });
    }, [loading, error, config]);

    // ✅ Ensure a blank row is always present
    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", wwpn: "", fabric: "", use: "", create: false, include_in_zoning: false }];
        }
        return data;
    };

    // ✅ Fetch aliases for the active project
    const fetchAliases = async (projectId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${aliasApiUrl}${projectId}/`);
            const data = ensureBlankRow(response.data);
            setAliases(data);
            setUnsavedAliases([...data]);
        } catch (error) {
            console.error("❌ Error fetching aliases:", error);
            setError("Failed to load aliases.");
            setAliases(ensureBlankRow([]));  // Ensure at least one blank row
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

        const updatedAliases = [...unsavedAliases];
        let shouldAddNewRow = false;

        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;

                updatedAliases[physicalRow][prop] = newValue;

                // ✅ If editing last row, add a new blank row
                if (physicalRow === updatedAliases.length - 1 && newValue.trim() !== "") {
                    shouldAddNewRow = true;
                }
            }
        });

        if (shouldAddNewRow) {
            updatedAliases.push({ id: null, name: "", wwpn: "", fabric: "", use: "", create: false, include_in_zoning: false });
        }

        setUnsavedAliases(updatedAliases);
    };

    // ✅ Save updated & new aliases
    const handleSave = async () => {
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }

        setSaveStatus("Saving...");

        const payload = unsavedAliases
            .filter(alias => alias.name.trim())  // ✅ Only send valid entries
            .map(alias => ({
                ...alias,
                projects: [config.active_project.id],  // ✅ Assign project
                fabric: fabrics.find(f => f.name === alias.fabric_details.name)?.id,  // ✅ Convert fabric name back to ID
            }));

        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));

        try {
            const response = await axios.post(
                `http://127.0.0.1:8000/api/san/aliases/save/`,
                { project_id: config.active_project.id, aliases: payload }
            );

            console.log("✅ Save Response:", response.data);
            setSaveStatus("Aliases saved successfully! ✅");
            fetchAliases(config.active_project.id);  // ✅ Refresh table
        } catch (error) {
            console.error("❌ Error saving aliases:", error);

            if (error.response) {
                console.error("❌ API Response Error:", JSON.stringify(error.response.data, null, 2));

                if (error.response.data.details) {
                    const errorMessages = error.response.data.details.map(e => {
                        const errorText = Object.values(e.errors).flat().join(", "); // ✅ Convert error object to string
                        return `Can't save alias name: "${e.alias}".  ${errorText}`;
                    });

                    setSaveStatus(`⚠️ Error: ${errorMessages.join(" | ")}`);
                } else {
                    setSaveStatus("⚠️ Error saving aliases! Please try again.");
                }
            } else {
                setSaveStatus("⚠️ Network error. Try again.");
            }
        }
    };

    return (
        
        <div className="table-container">
            

            {loading ? (
                <Alert variant="info">Loading aliases...</Alert>
            ) : error ? (
                <Alert variant="danger">{error}</Alert>
            ) : (
                <>

                    <HotTable
                        ref={tableRef}
                        data={unsavedAliases}
                        colHeaders={["ID", "Name", "WWPN", "Fabric", "Use", "Create", "Include in Zoning"]}
                        columns={[
                            { data: "id", readOnly: true },
                            { data: "name" },
                            { data: "wwpn" },
                            { 
                                data: "fabric_details.name", 
                                type: "dropdown", 
                                source: fabrics.map(f => f.name)  // ✅ Use fabric names
                            },
                            { data: "use", type: "dropdown", source: ["init", "target", "both"] },
                            { data: "create", type: "checkbox" },
                            { data: "include_in_zoning", type: "checkbox" },
                        ]}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                        className="handsontable"
                        dropdownMenu={true}
                        filters={true}
                        rowHeaders={false}
                    />


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

export default AliasTable;