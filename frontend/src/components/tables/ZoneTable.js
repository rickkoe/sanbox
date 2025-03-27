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
    const zoneSaveApiUrl = "http://127.0.0.1:8000/api/san/zones/save/";

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
                const zoneData = { ...zone, fabric: zone.fabric_details?.name || zone.fabric };
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
            setFabrics(response.data.map(fabric => ({ id: fabric.id, name: fabric.name })));
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
        }
    };

    const fetchAliases = async (projectId) => {
        try {
            const response = await axios.get(`${aliasApiUrl}${projectId}/`);
            console.log("Aliases",response.data)
            setAliases(response.data.map(alias => ({
                id: alias.id,
                name: alias.name,
                fabric: alias.fabric_details?.name,
                include_in_zoning: alias.include_in_zoning
            })));
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

                if (physicalRow === updatedZones.length - 1) {
                    let isNotEmpty = false;
                    if (typeof newValue === "string") {
                        isNotEmpty = newValue.trim() !== "";
                    } else if (typeof newValue === "boolean") {
                        isNotEmpty = newValue === true;
                    } else if (typeof newValue === "number") {
                        isNotEmpty = newValue !== 0;
                    } else {
                        isNotEmpty = newValue !== null && newValue !== undefined;
                    }
                    if (isNotEmpty) {
                        shouldAddNewRow = true;
                    }
                }
            }
        });

        if (shouldAddNewRow) {
            updatedZones.push({ id: null, name: "", fabric: "", members: [], create: false, exists: false, zone_type: "smart" });
        }

        setUnsavedZones(updatedZones);
    };

    const handleSave = async () => {
        // Validate: if an existing zone has a blank name, show an error and abort save.
        const invalidZone = unsavedZones.find(zone => zone.id && (!zone.name || zone.name.trim() === ""));
        if (invalidZone) {
            setSaveStatus("⚠️ Zone name is required for existing zones. Please restore the original name or remove the zone.");
            return;
        }
    
        if (!config?.active_project?.id) {
            setSaveStatus("⚠️ No active project selected!");
            return;
        }
    
        setSaveStatus("Saving...");
    
        // Only filter out new zones with a blank name; existing zones are always included.
        const payload = unsavedZones
            .filter(zone => zone.id || (zone.name && zone.name.trim() !== ""))
            .map(zone => ({
                ...zone,
                projects: [config.active_project.id],
                fabric: fabrics.find(f => f.name === zone.fabric)?.id,
                members: Array.from({ length: memberColumns }, (_, i) => {
                    const memberName = zone[`member_${i + 1}`];
                    if (!memberName) return null;
                    const foundAlias = aliases.find(alias => alias.name === memberName);
                    if (!foundAlias) return null;
                    // If an existing member detail exists for this slot, include its id for updating
                    if (zone.members_details && zone.members_details[i] && zone.members_details[i].id) {
                        return { id: zone.members_details[i].id, alias: foundAlias.id };
                    }
                    // Otherwise, return the new member data
                    return { alias: foundAlias.id };
                }).filter(Boolean)
            }));
    
        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));
    
        try {
            const response = await axios.post(
                zoneSaveApiUrl,
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
        const newCount = memberColumns + parseInt(newColumnsCount);
        setMemberColumns(newCount);
        setNewColumnsCount(1);
        setTimeout(() => {
            if (tableRef.current && tableRef.current.hotInstance) {
                const totalCols = tableRef.current.hotInstance.countCols();
                const newWidths = [];
                // Assume the first 7 columns are static, and member columns come afterward.
                for (let i = 0; i < totalCols; i++) {
                    if (i < 7) {
                        // Preserve existing width for static columns.
                        newWidths[i] = tableRef.current.hotInstance.getColWidth(i);
                    } else {
                        // Set member columns to 200px.
                        newWidths[i] = 200;
                    }
                }
                tableRef.current.hotInstance.updateSettings({ colWidths: newWidths });
                tableRef.current.hotInstance.render();
                localStorage.setItem("aliasTableColumnWidths", JSON.stringify(newWidths));
            }
        }, 0);
    };

    return (
        <div className="table-container">
            <div>
                <Button className="save-button" onClick={handleSave}>Save</Button>
                <Button onClick={handleAddColumns} className="save-button">Add Member Columns</Button>
                <Button className="save-button"> Generate Zoning Scripts </Button>
            </div>
            
            <HotTable
                ref={tableRef}
                data={unsavedZones}
                colHeaders={["ID", "Name", "Fabric",  "Notes", "Create", "Exists", "Zone Type", ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)]}
                columns={[
                    { data: "id", readOnly: true, className: "htCenter" },
                    { data: "name" },
                    { data: "fabric", type: "dropdown", source: fabrics.map(f => f.name) },
                    { data: "notes" },
                    { data: "create", type: "checkbox", className: "htCenter" },
                    { data: "exists", type: "checkbox", className: "htCenter" },
                    { data: "zone_type", type: "dropdown", source: ["smart", "standard"], className: "htCenter" },
                    ...Array.from({ length: memberColumns }, (_, i) => ({ data: `member_${i + 1}` })),
                ]}
                manualColumnResize={true}
                autoColumnSize={true}
                afterColumnResize={(currentColumn, newSize, isDoubleClick) => {
                    // Retrieve the number of columns
                    const totalCols = tableRef.current.hotInstance.countCols();
                    const widths = [];
                    for (let i = 0; i < totalCols; i++) {
                        widths.push(tableRef.current.hotInstance.getColWidth(i));
                    }
                    localStorage.setItem("zoneTableColumnWidths", JSON.stringify(widths));
                }}
                colWidths={(() => {
                    const stored = localStorage.getItem("zoneTableColumnWidths");
                    if (stored) {
                        try {
                            return JSON.parse(stored);
                        } catch (e) {
                            return 200;
                        }
                    }
                    return 200;
                })()}
                cells={(row, col) => {
                    // Ensure the tableRef and its hotInstance are available
                    if (!tableRef.current || !tableRef.current.hotInstance) {
                      return {};
                    }
                    // Member columns are assumed to start at index 7
                    if (col >= 7) {
                      const rowData = tableRef.current.hotInstance.getSourceDataAtRow(row);
                      if (!rowData) return {};
                      const rowFabric = rowData.fabric_details?.name || rowData.fabric;
                      // Determine which member field this is (e.g. member_1, member_2, etc.)
                      const memberIndex = col - 6; // since col 7 -> member_1, etc.
                      const currentValue = rowData[`member_${memberIndex}`];
                  
                      // Gather all alias names used in member columns from all rows except the current row.
                      const allRows = tableRef.current.hotInstance.getSourceData();
                      const usedAliases = new Set();
                      allRows.forEach((data, idx) => {
                        if (idx !== row) {
                          for (let i = 1; i <= memberColumns; i++) {
                            const aliasValue = data[`member_${i}`];
                            if (aliasValue && aliasValue.trim() !== "") {
                              usedAliases.add(aliasValue);
                            }
                          }
                        }
                      });
                      
                      // Also, gather alias names used in the current row, excluding the current cell
                      for (let i = 1; i <= memberColumns; i++) {
                        if (i !== memberIndex) {
                          const aliasValue = rowData[`member_${i}`];
                          if (aliasValue && aliasValue.trim() !== "") {
                            usedAliases.add(aliasValue);
                          }
                        }
                      }
                  
                      return {
                        type: "dropdown",
                        source: aliases
                          .filter(alias => 
                            alias.fabric === rowFabric &&
                            alias.include_in_zoning === true
                          )
                          .filter(alias => {
                            // Always include the current selection even if it's used elsewhere
                            if (alias.name === currentValue) return true;
                            return !usedAliases.has(alias.name);
                          })
                          .map(alias => alias.name)
                      };
                    }
                  }}
                afterChange={handleTableChange}
                licenseKey="non-commercial-and-evaluation"
                columnSorting={true}
                className= "htMaterial"
                dropdownMenu={true}
                filters={true}
                rowHeaders={false}
                height="calc(100vh - 200px)"
                dragToScroll={true}
                width="100%"
            />
        </div>
    );
};

export default ZoneTable;