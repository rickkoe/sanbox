import React, { useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  aliases: `${API_URL}/api/san/aliases/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  aliasSave: `${API_URL}/api/san/aliases/save/`,
  aliasDelete: `${API_URL}/api/san/aliases/delete/`
};

// Template for new rows
const NEW_ALIAS_TEMPLATE = {
  id: null,
  name: "",
  wwpn: "",
  use: "",
  fabric: "",
  cisco_alias: "",
  create: false,
  include_in_zoning: false,
  notes: "",
  imported: null,
  updated: null,
  saved: false,
  zoned_count: 0 // Keep for new rows
};

// WWPN formatting utilities
const formatWWPN = (value) => {
  if (!value) return "";
  
  // Remove all non-hex characters and convert to uppercase
  const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  
  // If not 16 characters, return as-is to allow partial input
  if (cleanValue.length !== 16) {
    return value; // Return original to show user input during typing
  }
  
  // Format as XX:XX:XX:XX:XX:XX:XX:XX
  return cleanValue.match(/.{2}/g).join(':');
};

const isValidWWPNFormat = (value) => {
  if (!value) return true; // Allow empty values
  
  // Check if it's already in correct format or can be formatted
  const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
  return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
};

const AliasTable = () => {
  const { config } = useContext(ConfigContext);
  const [fabricOptions, setFabricOptions] = useState([]);
  const tableRef = useRef(null);
  const navigate = useNavigate();

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics
  useEffect(() => {
    if (activeCustomerId) {
      axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`)
        .then(res => {
          setFabricOptions(res.data.map(f => ({ id: f.id, name: f.name })));
        })
        .catch(err => console.error("Error fetching fabrics:", err));
    }
  }, [activeCustomerId]);

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  // Custom WWPN change handler
  const handleWWPNChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    
    changes.forEach(([row, prop, oldVal, newVal]) => {
      if (prop === 'wwpn' && newVal !== oldVal) {
        // Format the WWPN value
        const formattedValue = formatWWPN(newVal);
        
        // Only update if the formatted value is different from input
        if (formattedValue !== newVal && formattedValue.length === 23) { // 16 chars + 7 colons = 23
          // Use setTimeout to avoid issues with Handsontable's change cycle
          setTimeout(() => {
            hot.setDataAtCell(row, hot.propToCol(prop), formattedValue);
          }, 0);
        }
      }
    });
  };

  // Table configuration
  const tableConfig = {
    colHeaders: [
      "Name",
      "WWPN",
      "Use",
      "Fabric",
      "Alias Type",
      "Create",
      "Include in Zoning",
      "Zoned Count",
      "Imported",
      "Updated",
      "Notes",
    ],
    columns: [
      { data: "name" },
      {
        data: "wwpn",
        validator: (value, callback) => {
          // Allow empty values or valid WWPN formats
          if (!value || isValidWWPNFormat(value)) {
            callback(true);
          } else {
            callback(false);
          }
        },
      },
      { data: "use", type: "dropdown", className: "htCenter" },
      { data: "fabric_details.name", type: "dropdown" },
      { data: "cisco_alias", type: "dropdown", className: "htCenter" },
      { data: "create", type: "checkbox", className: "htCenter" },
      { data: "include_in_zoning", type: "checkbox", className: "htCenter" },
      { data: "zoned_count", readOnly: true, className: "htCenter" }, // Zoned count column
      { data: "imported", readOnly: true },
      { data: "updated", readOnly: true },
      { data: "notes" },
    ],
    dropdownSources: {
      use: ["init", "target", "both"],
      "fabric_details.name": fabricOptions.map((f) => f.name),
      cisco_alias: ["device-alias", "fcalias", "wwpn"],
    },
    // Process data for display
    preprocessData: (data) => {
      return data.map((alias) => ({
        ...alias,
        saved: true,
        // Format WWPN on data load
        wwpn: formatWWPN(alias.wwpn),
      }));
    },
    // Custom renderers
    customRenderers: {
      name: (instance, td, row, col, prop, value) => {
        const rowData = instance.getSourceDataAtRow(row);
        td.innerText = value || "";
        if (rowData?.saved) {
          td.style.fontWeight = "bold";
        } else {
          td.style.fontWeight = "normal";
        }
        return td;
      },
      wwpn: (instance, td, row, col, prop, value) => {
        const rowData = instance.getSourceDataAtRow(row);
        td.innerText = value || "";

        // Use monospace font for better hex readability, but no colors
        if (value) {
          td.style.fontFamily = "monospace";
        } else {
          td.style.fontFamily = "";
        }

        // Add tooltip for WWPN format help
        if (value) {
          const cleanValue = value.replace(/[^0-9a-fA-F]/g, "");
          if (cleanValue.length > 0 && cleanValue.length < 16) {
            td.title = `WWPN should be 16 hex characters (currently ${cleanValue.length})`;
          } else if (cleanValue.length === 16) {
            td.title = "Valid WWPN format";
          } else if (cleanValue.length > 16) {
            td.title = "WWPN too long - should be 16 hex characters";
          }
        } else {
          td.title =
            "Enter WWPN (16 hex characters, auto-formatted with colons)";
        }

        return td;
      },
      zoned_count: (instance, td, row, col, prop, value) => {
        const count = value || 0;
        td.innerText = count;
        td.style.textAlign = "center";
        td.style.fontWeight = "600";

        // Color coding based on count
        if (count === 0) {
          td.style.color = "#6b7280"; // Gray for unused aliases
          td.style.backgroundColor = "#f9fafb";
        } else if (count === 1) {
          td.style.color = "#059669"; // Green for single use
          td.style.backgroundColor = "#ecfdf5";
        } else {
          td.style.color = "#dc2626"; // Red for multiple uses (potential issue)
          td.style.backgroundColor = "#fef2f2";
        }

        // Add tooltip
        td.title =
          count === 0
            ? "Not used in any zones"
            : count === 1
            ? "Used in 1 zone"
            : `Used in ${count} zones`;

        return td;
      },
      imported: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      },
      updated: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      },
    },
    // Custom after change handler to format WWPN
    afterChange: handleWWPNChange,
    // Prepare payload for saving
    // Replace the onBuildPayload function in your AliasTable.js with this:

    onBuildPayload: (row) => {
      // Get fabric ID from name - handle both display name and direct ID
      let fabricId;

      // First try to get from fabric_details.name (display format)
      if (row.fabric_details?.name) {
        const fabric = fabricOptions.find(
          (f) => f.name === row.fabric_details.name
        );
        fabricId = fabric ? fabric.id : null;
      }
      // Fallback to direct fabric value (might be ID already)
      else if (row.fabric) {
        // If it's already a number, use it directly
        if (typeof row.fabric === "number") {
          fabricId = row.fabric;
        } else {
          // Try to find by name first, then by ID
          const fabric = fabricOptions.find(
            (f) => f.name === row.fabric || f.id.toString() === row.fabric
          );
          fabricId = fabric ? fabric.id : parseInt(row.fabric);
        }
      }

      // Ensure fabricId is a valid integer
      if (!fabricId || isNaN(fabricId)) {
        console.error(`Invalid fabric for alias ${row.name}:`, {
          fabricId,
          "row.fabric": row.fabric,
          "row.fabric_details": row.fabric_details,
        });
        throw new Error(
          `Alias "${row.name}" must have a valid fabric selected`
        );
      }

      // Clean up payload
      const payload = { ...row };
      delete payload.saved;
      delete payload.fabric_details;
      delete payload.zoned_count; // Don't send calculated field to server

      // Ensure WWPN is properly formatted before saving
      if (payload.wwpn) {
        payload.wwpn = formatWWPN(payload.wwpn);
      }

      return {
        ...payload,
        projects: [activeProjectId],
        fabric: parseInt(fabricId), // Ensure it's an integer
      };
    },
    // Custom save handler
    onSave: async (unsavedData) => {
      try {
        // Enhanced WWPN validation
        const invalidWWPN = unsavedData.find((alias) => {
          if (!alias.name || alias.name.trim() === "") return false;

          if (!alias.wwpn) return true; // Missing WWPN

          const cleanWWPN = alias.wwpn.replace(/[^0-9a-fA-F]/g, "");
          return cleanWWPN.length !== 16 || !/^[0-9a-fA-F]+$/.test(cleanWWPN);
        });

        if (invalidWWPN) {
          return {
            success: false,
            message: `⚠️ Invalid WWPN format for alias "${invalidWWPN.name}". Must be 16 hex characters.`,
          };
        }

        const payload = unsavedData
          .filter(
            (alias) => alias.id || (alias.name && alias.name.trim() !== "")
          )
          .map(tableConfig.onBuildPayload);

        await axios.post(API_ENDPOINTS.aliasSave, {
          project_id: activeProjectId,
          aliases: payload,
        });

        return { success: true, message: "Aliases saved successfully! ✅" };
      } catch (error) {
        console.error("Error saving aliases:", error);
        // Handle structured error response from API
        if (error.response?.data?.details) {
          const errorMessages = error.response.data.details.map((e) => {
            const errorText = Object.values(e.errors).flat().join(", ");
            return `Can't save alias "${e.alias}": ${errorText}`;
          });
          return { success: false, message: `⚠️ ${errorMessages.join(" | ")}` };
        }

        return {
          success: false,
          message: `⚠️ Error: ${
            error.response?.data?.message || error.message
          }`,
        };
      }
    },
    beforeSave: (data) => {
      const invalidAlias = data.find(
        (alias) =>
          alias.name &&
          alias.name.trim() !== "" &&
          !alias.fabric_details?.name &&
          !alias.fabric?.trim()
      );

      if (invalidAlias) {
        return `Alias "${invalidAlias.name}" must have a fabric selected`;
      }

      return true;
    },
  };

  return (
    <div className="table-container">
      <GenericTable
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Alias Table.csv`}
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.aliases}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.aliasSave}
        deleteUrl={API_ENDPOINTS.aliasDelete}
        newRowTemplate={NEW_ALIAS_TEMPLATE}
        columnSorting={true}
        filters={true}
        storageKey="aliasTableColumnWidths"
        
        // Updated column indices: 0=Name, 1=WWPN, 2=Use, 3=Fabric, 4=Alias Type, 5=Create, 6=Include in Zoning, 7=Zoned Count, 8=Imported, 9=Updated, 10=Notes
        defaultVisibleColumns={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} // Include Zoned Count (index 7)
        
        {...tableConfig}
        additionalButtons={
          <>
            <Button
              className="save-button"
              onClick={() => {
                if (tableRef.current?.isDirty) {
                  if (window.confirm("You have unsaved changes. Save before generating scripts?")) {
                    tableRef.current.refreshData().then(() => navigate("/san/aliases/alias-scripts"));
                  }
                } else {
                  navigate("/san/aliases/alias-scripts");
                }
              }}
            >
              Generate Alias Scripts
            </Button>
            <Button variant="outline-primary" onClick={() => navigate('/san/aliases/import')}>
              Import Aliases
            </Button>
          </>
        }
      />
    </div>
  );
};

export default AliasTable;