import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";

// Register all Handsontable modules
registerAllModules();

const AliasTable = () => {
    const { config } = useContext(ConfigContext);  // ✅ Get active config (active project & customer)
    const [aliases, setAliases] = useState([]);
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const tableRef = useRef(null);

    const aliasApiUrl = "http://127.0.0.1:8000/api/san/aliases/project/";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";

    // ✅ Fetch aliases based on the active project
    const fetchAliases = async () => {
        if (!config?.active_project?.id) return;
        setLoading(true);
        try {
            const response = await axios.get(`${aliasApiUrl}${config.active_project.id}/`);
            console.log("✅ API Response for Aliases:", response.data);  // 🔍 Debugging
            const aliasData = response.data;
            aliasData.push({ id: "", name: "", wwpn: "", fabric: "", use: "", create: false, include_in_zoning: false }); // ✅ Add blank row
            setAliases(aliasData);
        } catch (error) {
            console.error("❌ Error fetching aliases:", error);
            setError("Failed to load aliases.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ Fetch fabrics based on the active customer
    const fetchFabrics = async () => {
        if (!config?.customer?.id) return;
        try {
            const response = await axios.get(`${fabricApiUrl}${config.customer.id}/`);
            setFabrics(response.data.map(fabric => fabric.name));  // ✅ Extract fabric names for dropdown
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
        }
    };

    useEffect(() => {
        if (config?.active_project?.id) fetchAliases();
        if (config?.customer?.id) fetchFabrics();
    }, [config]);  // ✅ Re-fetch when the active config changes

    // ✅ Handle table edits and dynamically add a new row
    const handleTableChange = (changes, source) => {
        if (source === "edit" && changes) {
            const updatedAliases = [...aliases];
            let shouldAddNewRow = false;

            changes.forEach(([visualRow, prop, oldValue, newValue]) => {
                if (oldValue !== newValue) {
                    const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                    if (physicalRow === null) return;
                    updatedAliases[physicalRow][prop] = newValue;

                    // ✅ Add new blank row when the last row is edited
                    if (physicalRow === updatedAliases.length - 1 && newValue.trim() !== "") {
                        shouldAddNewRow = true;
                    }
                }
            });

            if (shouldAddNewRow) {
                updatedAliases.push({ id: "", name: "", wwpn: "", fabric: "", use: "", create: false, include_in_zoning: false });
            }

            setAliases(updatedAliases);
        }
    };

    // ✅ Save aliases to Django backend
    const handleSave = async () => {
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }
    
        setSaveStatus("Saving...");
        const payload = aliases
            .filter(alias => alias.name.trim())  // ✅ Remove empty rows
            .map(alias => ({
                ...alias,
                projects: [config.active_project.id]  // ✅ Assign project ID as a list
            }));
    
        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));
    
        try {
            const response = await axios.post(`http://127.0.0.1:8000/api/san/aliases/save/`, {
                project_id: config.active_project.id,
                aliases: payload
            });
    
            console.log("✅ Save Response:", response.data);
            setSaveStatus("Aliases saved successfully! ✅");
            fetchAliases();  // ✅ Refresh table
        } catch (error) {
            console.error("❌ Error saving aliases:", error);
            if (error.response) {
                console.error("❌ API Response Error:", error.response.data);
                if (error.response.data.details) {
                    setSaveStatus(`⚠️ Error: ${error.response.data.details.map(e => `${e.alias}: ${e.errors}`).join(" | ")}`);
                } else {
                    setSaveStatus("⚠️ Error saving aliases! Please try again.");
                }
            } else {
                setSaveStatus("⚠️ Network error. Try again.");
            }
        }
    };

    return (
        <div className="container mt-4">
            <h2>Aliases for {config?.active_project?.name || "Project"}</h2>

            {loading && <div className="alert alert-info">Loading aliases...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <>
                    {/* ✅ Save Button */}
                    <Button className={`btn btn-sm ${saveStatus === "Saving..." ? "btn-secondary" : "btn-primary"} mb-2`}
                        onClick={handleSave}
                        disabled={saveStatus === "Saving..."}>
                        {saveStatus || "Save"}
                    </Button>

                    {/* ✅ Alias Table */}
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
                        afterChange={handleTableChange}
                        className="handsontable"
                        dropdownMenu={true}
                        filters={true}
                        rowHeaders={false}
                    />
                </>
            )}
        </div>
    );
};

export default AliasTable;