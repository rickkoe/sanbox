import React, {
  useEffect,
  useReducer,
  useRef,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import { ConfigContext } from "../../../context/ConfigContext";
import { Button, Alert, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

// API endpoints defined once at the top for better maintainability
const API_ENDPOINTS = {
  zones: "/api/san/zones/project/",
  fabrics: "/api/san/fabrics/customer/",
  aliases: "/api/san/aliases/project/",
  zoneSave: "/api/san/zones/save/",
  zoneDelete: "/api/san/zones/delete/",
};

// Initial state
const initialState = {
  zones: [],
  unsavedZones: [],
  fabrics: [],
  aliases: [],
  loading: false,
  error: null,
  saveStatus: "",
  memberColumns: 1,
  newColumnsCount: 1,
  isDirty: false,
  showModal: false,
  nextPath: null,
  showDeleteModal: false,
  rowsToDelete: [],
};

// Reducer function to handle all state changes
function reducer(state, action) {
  switch (action.type) {
    case "SET_ZONES":
      return {
        ...state,
        zones: action.payload,
        unsavedZones: [...action.payload],
      };
    case "SET_FABRICS":
      return { ...state, fabrics: action.payload };
    case "SET_ALIASES":
      return { ...state, aliases: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SAVE_STATUS":
      return { ...state, saveStatus: action.payload };
    case "UPDATE_ZONES":
      return {
        ...state,
        unsavedZones: action.payload,
        isDirty: true,
      };
    case "SET_DIRTY":
      return { ...state, isDirty: action.payload };
    case "SET_MEMBER_COLUMNS":
      return { ...state, memberColumns: action.payload };
    case "SET_NEW_COLUMNS_COUNT":
      return { ...state, newColumnsCount: action.payload };
    case "TOGGLE_MODAL":
      return { ...state, showModal: action.payload };
    case "SET_NEXT_PATH":
      return { ...state, nextPath: action.payload };
    case "TOGGLE_DELETE_MODAL":
      return { ...state, showDeleteModal: action.payload };
    case "SET_ROWS_TO_DELETE":
      return { ...state, rowsToDelete: action.payload };
    default:
      return state;
  }
}

const OldZoneTable = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    zones,
    unsavedZones,
    fabrics,
    aliases,
    loading,
    error,
    saveStatus,
    memberColumns,
    newColumnsCount,
    isDirty,
    showModal,
    nextPath,
    showDeleteModal,
    rowsToDelete,
  } = state;

  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);
  const navigate = useNavigate();

  // Helper functions
  const ensureBlankRow = useCallback((data) => {
    if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
      return [
        ...data,
        {
          id: null,
          name: "",
          fabric: "",
          members: [],
          create: false,
          exists: false,
          zone_type: "smart",
        },
      ];
    }
    return data;
  }, []);

  // Data fetching functions
  const fetchZones = useCallback(
    async (projectId) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const response = await axios.get(`${API_ENDPOINTS.zones}${projectId}/`);

        const zones = response.data.map((zone) => {
          const zoneData = {
            ...zone,
            fabric: zone.fabric_details?.name || zone.fabric,
            saved: true,
          };

          zone.members_details.forEach((member, index) => {
            zoneData[`member_${index + 1}`] = member.name;
          });

          return zoneData;
        });

        const dataWithBlankRow = ensureBlankRow(zones);
        dispatch({ type: "SET_ZONES", payload: dataWithBlankRow });

        const maxMembers = Math.max(
          ...zones.map((zone) => zone.members.length),
          1
        );
        dispatch({ type: "SET_MEMBER_COLUMNS", payload: maxMembers });
      } catch (error) {
        console.error("❌ Error fetching zones:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to load zones." });
        dispatch({ type: "SET_ZONES", payload: ensureBlankRow([]) });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [ensureBlankRow]
  );

  const fetchFabrics = useCallback(async (customerId) => {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.fabrics}${customerId}/`
      );
      dispatch({
        type: "SET_FABRICS",
        payload: response.data.map((fabric) => ({
          id: fabric.id,
          name: fabric.name,
        })),
      });
    } catch (error) {
      console.error("❌ Error fetching fabrics:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to load fabrics." });
    }
  }, []);

  const fetchAliases = useCallback(async (projectId) => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.aliases}${projectId}/`);
      dispatch({
        type: "SET_ALIASES",
        payload: response.data.map((alias) => ({
          id: alias.id,
          name: alias.name,
          fabric: alias.fabric_details?.name,
          include_in_zoning: alias.include_in_zoning,
        })),
      });
    } catch (error) {
      console.error("❌ Error fetching aliases:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to load aliases." });
    }
  }, []);

  // Event handlers
  const handleTableChange = useCallback(
    (changes, source) => {
      if (!changes || source === "loadData") return;

      const updatedZones = [...unsavedZones];
      let shouldAddNewRow = false;

      changes.forEach(([visualRow, prop, oldValue, newValue]) => {
        if (oldValue !== newValue) {
          const physicalRow =
            tableRef.current.hotInstance.toPhysicalRow(visualRow);
          if (physicalRow === null) return;

          updatedZones[physicalRow][prop] = newValue;
          updatedZones[physicalRow].saved = false;

          if (physicalRow === updatedZones.length - 1) {
            const isNotEmpty = Boolean(
              typeof newValue === "string"
                ? newValue.trim()
                : typeof newValue === "boolean"
                ? newValue
                : typeof newValue === "number"
                ? newValue !== 0
                : newValue !== null && newValue !== undefined
            );

            if (isNotEmpty) {
              shouldAddNewRow = true;
            }
          }
        }
      });

      if (shouldAddNewRow) {
        updatedZones.push({
          id: null,
          name: "",
          fabric: "",
          members: [],
          create: false,
          exists: false,
          zone_type: "smart",
        });
      }

      dispatch({ type: "UPDATE_ZONES", payload: updatedZones });
    },
    [unsavedZones]
  );

  const handleSave = useCallback(async () => {
    // Validate: if an existing zone has a blank name, show an error and abort save.
    const invalidZone = unsavedZones.find(
      (zone) => zone.id && (!zone.name || zone.name.trim() === "")
    );
    if (invalidZone) {
      dispatch({
        type: "SET_SAVE_STATUS",
        payload:
          "⚠️ Zone name is required for existing zones. Please restore the original name or remove the zone.",
      });
      return;
    }

    if (!config?.active_project?.id) {
      dispatch({
        type: "SET_SAVE_STATUS",
        payload: "⚠️ No active project selected!",
      });
      return;
    }

    dispatch({ type: "SET_SAVE_STATUS", payload: "Saving..." });

    // Only filter out new zones with a blank name; existing zones are always included.
    const payload = unsavedZones
      .filter((zone) => zone.id || (zone.name && zone.name.trim() !== ""))
      .map((zone) => ({
        ...zone,
        projects: [config.active_project.id],
        fabric: fabrics.find((f) => f.name === zone.fabric)?.id,
        members: Array.from({ length: memberColumns }, (_, i) => {
          const memberName = zone[`member_${i + 1}`];
          if (!memberName) return null;

          const foundAlias = aliases.find((alias) => alias.name === memberName);
          if (!foundAlias) return null;

          // If an existing member detail exists for this slot, include its id for updating
          if (
            zone.members_details &&
            zone.members_details[i] &&
            zone.members_details[i].id
          ) {
            return { id: zone.members_details[i].id, alias: foundAlias.id };
          }

          // Otherwise, return the new member data
          return { alias: foundAlias.id };
        }).filter(Boolean),
      }));

    try {
      const response = await axios.post(API_ENDPOINTS.zoneSave, {
        project_id: config.active_project.id,
        zones: payload,
      });

      dispatch({
        type: "SET_SAVE_STATUS",
        payload: "Zones saved successfully! ✅",
      });
      dispatch({ type: "SET_DIRTY", payload: false });
      fetchZones(config.active_project.id);
    } catch (error) {
      console.error("❌ Error saving zones:", error);
      dispatch({
        type: "SET_SAVE_STATUS",
        payload: "⚠️ Error saving zones! Please try again.",
      });
    }
  }, [unsavedZones, config, fabrics, aliases, memberColumns, fetchZones]);

  const handleAddColumns = useCallback(() => {
    const newCount = memberColumns + parseInt(newColumnsCount);
    dispatch({ type: "SET_MEMBER_COLUMNS", payload: newCount });
    dispatch({ type: "SET_NEW_COLUMNS_COUNT", payload: 1 });

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
        localStorage.setItem(
          "zoneTableColumnWidths",
          JSON.stringify(newWidths)
        );
      }
    }, 0);
  }, [memberColumns, newColumnsCount]);

  const confirmDeleteRows = useCallback(() => {
    const updatedZones = [...unsavedZones];
    const wasDirty = isDirty;

    rowsToDelete.forEach((rowIndex) => {
      const zoneToDelete = updatedZones[rowIndex];
      if (zoneToDelete && zoneToDelete.id) {
        axios
          .delete(`${API_ENDPOINTS.zoneDelete}${zoneToDelete.id}/`)
          .then((response) => {
            console.log("Deleted zone", zoneToDelete.id);
          })
          .catch((error) => {
            console.error("Error deleting zone", zoneToDelete.id, error);
          });
      }
    });

    const remainingZones = updatedZones.filter(
      (_, idx) => !rowsToDelete.includes(idx)
    );
    dispatch({ type: "UPDATE_ZONES", payload: remainingZones });
    dispatch({ type: "SET_DIRTY", payload: wasDirty });
    dispatch({ type: "TOGGLE_DELETE_MODAL", payload: false });
  }, [unsavedZones, rowsToDelete, isDirty]);

  // Data loading effects
  useEffect(() => {
    if (config?.active_project?.id) {
      fetchZones(config.active_project.id);
      fetchAliases(config.active_project.id);
    }
    if (config?.customer?.id) {
      fetchFabrics(config.customer.id);
    }
  }, [config, fetchZones, fetchAliases, fetchFabrics]);

  // Navigation warning effects
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const originalPushState = window.history.pushState;
    window.history.pushState = function (state, title, url) {
      dispatch({ type: "SET_NEXT_PATH", payload: url });
      dispatch({ type: "TOGGLE_MODAL", payload: true });
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
      dispatch({ type: "SET_NEXT_PATH", payload: window.location.pathname });
      dispatch({ type: "TOGGLE_MODAL", payload: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  // Table configuration
  const getColumnDefinitions = useCallback(() => {
    return [
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
        },
      },
      { data: "fabric", type: "dropdown", source: fabrics.map((f) => f.name) },
      { data: "create", type: "checkbox", className: "htCenter" },
      { data: "exists", type: "checkbox", className: "htCenter" },
      {
        data: "zone_type",
        type: "dropdown",
        source: ["smart", "standard"],
        className: "htCenter",
      },
      {
        data: "imported",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value, cellProperties) => {
          if (value) {
            const date = new Date(value);
            td.innerText = date.toLocaleString();
          } else {
            td.innerText = "";
          }
          return td;
        },
      },
      {
        data: "updated",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value, cellProperties) => {
          if (value) {
            const date = new Date(value);
            td.innerText = date.toLocaleString();
          } else {
            td.innerText = "";
          }
          return td;
        },
      },
      { data: "notes" },
      ...Array.from({ length: memberColumns }, (_, i) => ({
        data: `member_${i + 1}`,
      })),
    ];
  }, [fabrics, memberColumns]);

  const getColumnWidths = useCallback(() => {
    const stored = localStorage.getItem("zoneTableColumnWidths");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // fall through to default
      }
    }

    const staticColumns = [200, 150, 180, 200, 100, 100, 120]; // Name, Fabric, etc.
    const dynamicMemberColumns = Array.from(
      { length: memberColumns },
      () => 250
    );
    return [...staticColumns, ...dynamicMemberColumns];
  }, [memberColumns]);

  const getCellsConfig = useCallback(
    (row, col) => {
      // Ensure the tableRef and its hotInstance are available
      if (!tableRef.current || !tableRef.current.hotInstance) {
        return {};
      }

      // Member columns are assumed to start at index 7
      if (col >= 7) {
        const rowData = tableRef.current.hotInstance.getSourceDataAtRow(row);
        if (!rowData) return {};

        const rowFabric = rowData.fabric_details?.name || rowData.fabric;
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
            .filter(
              (alias) =>
                alias.fabric === rowFabric && alias.include_in_zoning === true
            )
            .filter((alias) => {
              // Always include the current selection even if it's used elsewhere
              if (alias.name === currentValue) return true;
              return !usedAliases.has(alias.name);
            })
            .map((alias) => alias.name),
        };
      }

      return {};
    },
    [aliases, memberColumns]
  );

  return (
    <div className="table-container">
      <div>
        <Button
          className="save-button"
          onClick={handleSave}
          disabled={loading || saveStatus === "Saving..."}
        >
          {saveStatus === "Saving..." ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>

        <Button className="save-button" onClick={handleAddColumns}>
          Add Member Columns
        </Button>

        <Button
          className="save-button"
          onClick={async () => {
            if (isDirty) {
              await handleSave();
              if (!isDirty) {
                alert(
                  "Zones saved successfully! Redirecting to script generation..."
                );
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

      {error && <Alert variant="danger">{error}</Alert>}

      <HotTable
        ref={tableRef}
        data={unsavedZones}
        fixedColumnsLeft={1}
        colHeaders={[
          "Name",
          "Fabric",
          "Create",
          "Exists",
          "Zone Type",
          "Imported",
          "Updated",
          "Notes",
          ...Array.from({ length: memberColumns }, (_, i) => `Member ${i + 1}`),
        ]}
        columns={getColumnDefinitions()}
        manualColumnResize={true}
        autoColumnSize={true}
        afterColumnResize={(currentColumn, newSize, isDoubleClick) => {
          if (tableRef.current && tableRef.current.hotInstance) {
            const totalCols = tableRef.current.hotInstance.countCols();
            const widths = [];
            for (let i = 0; i < totalCols; i++) {
              widths.push(tableRef.current.hotInstance.getColWidth(i));
            }
            localStorage.setItem(
              "zoneTableColumnWidths",
              JSON.stringify(widths)
            );
          }
        }}
        colWidths={getColumnWidths()}
        cells={getCellsConfig}
        contextMenu={[
          "row_above",
          "row_below",
          "remove_row",
          "---------",
          "undo",
          "redo",
        ]}
        beforeRemoveRow={(index, amount, physicalRows, source, event) => {
          if (event) {
            event.preventDefault();
          }
          dispatch({ type: "SET_ROWS_TO_DELETE", payload: physicalRows });
          dispatch({ type: "TOGGLE_DELETE_MODAL", payload: true });
          return false; // 🛑 prevent Handsontable from removing rows automatically
        }}
        afterChange={handleTableChange}
        licenseKey="non-commercial-and-evaluation"
        columnSorting={true}
        className="htMaterial"
        dropdownMenu={true}
        filters={true}
        rowHeaders={false}
        height="calc(100vh - 200px)"
        dragToScroll={true}
        width="100%"
      />

      {/* Navigation Confirmation Modal */}
      <Modal
        show={showModal}
        onHide={() => dispatch({ type: "TOGGLE_MODAL", payload: false })}
      >
        <Modal.Header closeButton>
          <Modal.Title>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes. Are you sure you want to leave?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: false })}
          >
            Stay on this page
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: "SET_DIRTY", payload: false });
              dispatch({ type: "TOGGLE_MODAL", payload: false });
              navigate(nextPath);
            }}
          >
            Leave
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onHide={() => dispatch({ type: "TOGGLE_DELETE_MODAL", payload: false })}
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the following {rowsToDelete.length}{" "}
          zone{rowsToDelete.length > 1 ? "s" : ""}?
          <br />
          <strong>
            {rowsToDelete
              .map((idx) => unsavedZones[idx]?.name)
              .filter((name) => name)
              .join(", ")}
          </strong>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() =>
              dispatch({ type: "TOGGLE_DELETE_MODAL", payload: false })
            }
          >
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

export default OldZoneTable;
