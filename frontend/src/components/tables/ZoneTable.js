import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

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
    const [isDirty, setIsDirty] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [nextPath, setNextPath] = useState(null);
    const tableRef = useRef(null);
    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [rowsToDelete, setRowsToDelete] = useState([]);

    const zoneApiUrl = "http://127.0.0.1:8000/api/san/zones/project/";
    const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";
    const aliasApiUrl = "http://127.0.0.1:8000/api/san/aliases/project/";
    const zoneSaveApiUrl = "http://127.0.0.1:8000/api/san/zones/save/";
    const zoneDeleteApiUrl = "http://127.0.0.1:8000/api/san/zones/delete/";


    useEffect(() => {
        if (config?.active_project?.id) {
            fetchZones(config.active_project.id);
            fetchAliases(config.active_project.id);
        }
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const originalPushState = window.history.pushState;
        window.history.pushState = function(state, title, url) {
            setNextPath(url);
            setShowModal(true);
            // Do not call originalPushState to block navigation
        };
        return () => {
            window.history.pushState = originalPushState;
        };
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, "", window.location.pathname);
            setNextPath(window.location.pathname);
            setShowModal(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isDirty]);

    const handleNavigationAttempt = (path) => {
        if (isDirty) {
            setNextPath(path);
            setShowModal(true);
        } else {
            navigate(path);
        }
    };

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
                const zoneData = { ...zone, fabric: zone.fabric_details?.name || zone.fabric, saved: true };
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
                updatedZones[physicalRow].saved = false;

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

        setIsDirty(true);
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
            setIsDirty(false);
            fetchZones(config.active_project.id);
        } catch (error) {
            console.error("❌ Error saving zones:", error);
            setSaveStatus("⚠️ Error saving zones! Please try again.");
        }
    };
    // Handle row removal with a Bootstrap modal instead of window.confirm
    const handleRemoveRows = (index, amount, physicalRows, source, event) => {
      if (event) {
          event.preventDefault(); // 🛑 Prevent immediate deletion
      }
      setRowsToDelete(physicalRows);
      setShowDeleteModal(true);
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
                localStorage.setItem("zoneTableColumnWidths", JSON.stringify(newWidths));
            }
        }, 0);
    };
    const confirmDeleteRows = () => {
      const updatedZones = [...unsavedZones];
      const wasDirty = isDirty; // Save current dirty status

      rowsToDelete.forEach(rowIndex => {
          const zoneToDelete = updatedZones[rowIndex];
          if (zoneToDelete && zoneToDelete.id) {
              axios.delete(`${zoneDeleteApiUrl}${zoneToDelete.id}/`)
                  .then(response => {
                      console.log("Deleted zone", zoneToDelete.id);
                  })
                  .catch(error => {
                      console.error("Error deleting zone", zoneToDelete.id, error);
                  });
          }
      });

      const remainingZones = updatedZones.filter((_, idx) => !rowsToDelete.includes(idx));
      setUnsavedZones(remainingZones);

      if (wasDirty) {
          setIsDirty(true); // Leave as dirty
      } else {
          setIsDirty(false); // Stay clean if no prior changes
      }
      setShowDeleteModal(false);
  };

    return (
        <div className="table-container">
            <div>
            <Button className="save-button" onClick={handleSave} disabled={loading || saveStatus === "Saving..."}>
            {saveStatus === "Saving..." ? (
                <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
                </>
            ) : (
                "Save"
            )}
            </Button>
                <Button className="save-button" onClick={handleAddColumns}>Add Member Columns</Button>
                <Button
                  className="save-button"
                  onClick={async () => {
                    if (isDirty) {
                      await handleSave();
                      if (!isDirty) {
                        alert("Zones saved successfully! Redirecting to script generation...");
                        navigate("/san/zones/zone-scripts");
                      }
                    } else {
                      navigate("/san/zones/zone-scripts");
                    }
                  }}
                >
                  Generate Zoning Scripts
                </Button>
            </div>
            
            <HotTable
                ref={tableRef}
                data={unsavedZones}
                fixedColumnsLeft={1}
                colHeaders={["Name", "Fabric", "Create", "Exists", "Zone Type","Imported", "Updated", "Notes", ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)]}
                columns={[
                    {
                        data: "name",
                        renderer: (instance, td, row, col, prop, value, cellProperties) => {
                          const rowData = instance.getSourceDataAtRow(row);
                          if (rowData?.saved && value) {
                            td.innerHTML = `<strong>${value}</strong>`;
                          } else {
                            td.innerText = value || "";
                          }
                          return td;
                        }
                    },
                    { data: "fabric", type: "dropdown", source: fabrics.map(f => f.name) },
                    { data: "create", type: "checkbox", className: "htCenter" },
                    { data: "exists", type: "checkbox", className: "htCenter" },
                    { data: "zone_type", type: "dropdown", source: ["smart", "standard"], className: "htCenter" },
                    { 
                      data: "imported", 
                      readOnly: true,
                      renderer: (instance, td, row, col, prop, value, cellProperties) => {
                        if (value) {
                          const date = new Date(value);
                          td.innerText = date.toLocaleString(); // or customize formatting
                        } else {
                          td.innerText = "";
                        }
                        return td;
                      }
                  },
                  { 
                    data: "updated", 
                    readOnly: true,
                    renderer: (instance, td, row, col, prop, value, cellProperties) => {
                      if (value) {
                        const date = new Date(value);
                        td.innerText = date.toLocaleString(); // or customize formatting
                      } else {
                        td.innerText = "";
                      }
                      return td;
                    }
                },
                  { data: "notes" },
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
                        // fall through to below
                      }
                    }
                    const staticColumns = [200, 150, 180, 200, 100, 100, 120]; // Name, Fabric, Imported, Notes, Create, Exists, Zone Type
                    const dynamicMemberColumns = Array.from({ length: memberColumns }, () => 250);
                    return [...staticColumns, ...dynamicMemberColumns];
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
                contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo']}
                beforeRemoveRow={(index, amount, physicalRows, source, event) => {
                    if (event) {
                        event.preventDefault();
                    }
                    setRowsToDelete(physicalRows);
                    setShowDeleteModal(true);
                    return false; // 🛑 prevent Handsontable from removing rows automatically
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
            <Modal show={showModal} onHide={() => setShowModal(false)}>
              <Modal.Header closeButton>
                <Modal.Title>Unsaved Changes</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                You have unsaved changes. Are you sure you want to leave?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Stay on this page
                </Button>
                <Button variant="primary" onClick={() => {
                  setIsDirty(false);
                  setShowModal(false);
                  navigate(nextPath);
                }}>
                  Leave
                </Button>
              </Modal.Footer>
            </Modal>
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete the following {rowsToDelete.length} zone{rowsToDelete.length > 1 ? "s" : ""}?
                    <br />
                    <strong>
                        {rowsToDelete.map(idx => unsavedZones[idx]?.name).filter(name => name).join(", ")}
                    </strong>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeleteRows}>
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ZoneTable;