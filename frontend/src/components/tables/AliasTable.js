import React, { useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable";

// API endpoints
const API_ENDPOINTS = {
  aliases: "http://127.0.0.1:8000/api/san/aliases/project/",
  fabrics: "http://127.0.0.1:8000/api/san/fabrics/customer/",
  aliasSave: "http://127.0.0.1:8000/api/san/aliases/save/",
  aliasDelete: "http://127.0.0.1:8000/api/san/aliases/delete/"
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
  saved: false
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
      axios.get(`${API_ENDPOINTS.fabrics}${activeCustomerId}/`)
        .then(res => setFabricOptions(res.data.map(f => ({ id: f.id, name: f.name }))))
        .catch(err => console.error("Error fetching fabrics:", err));
    }
  }, [activeCustomerId]);

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  // Table configuration
  const tableConfig = {
    colHeaders: [
      "Name", "WWPN", "Use", "Fabric", "Alias Type", "Create", 
      "Include in Zoning", "Imported", "Updated", "Notes"
    ],
    columns: [
      { data: "name" },
      { data: "wwpn" },
      { data: "use", type: "dropdown", className: "htCenter" },
      { data: "fabric_details.name", type: "dropdown" },
      { data: "cisco_alias", type: "dropdown", className: "htCenter" },
      { data: "create", type: "checkbox", className: "htCenter" },
      { data: "include_in_zoning", type: "checkbox", className: "htCenter" },
      { data: "imported", readOnly: true },
      { data: "updated", readOnly: true },
      { data: "notes" }
    ],
    dropdownSources: {
      "use": ["init", "target", "both"],
      "fabric_details.name": fabricOptions.map(f => f.name),
      "cisco_alias": ["device-alias", "fcalias", "wwpn"]
    },
    // Process data for display
    preprocessData: (data) => {
      return data.map(alias => ({
        ...alias,
        saved: true
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
      imported: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      },
      updated: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      }
    },
    // Prepare payload for saving
    onBuildPayload: (row) => {
      // Get fabric ID from name
      const fabricId = fabricOptions.find(f => f.name === (row.fabric_details?.name || row.fabric))?.id;
      
      // Clean up payload
      const payload = { ...row };
      delete payload.saved;
      delete payload.fabric_details;
      
      return {
        ...payload,
        projects: [activeProjectId],
        fabric: fabricId
      };
    },
    // Custom save handler
    onSave: async (unsavedData) => {
      try {
        // WWPN validation
        const invalidWWPN = unsavedData.find(alias => 
          alias.name && alias.name.trim() !== "" && 
          (!alias.wwpn || !/^([0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{16}$/.test(alias.wwpn))
        );
        
        if (invalidWWPN) {
          return { 
            success: false, 
            message: `⚠️ Invalid WWPN format for alias "${invalidWWPN.name}"`
          };
        }
        
        const payload = unsavedData
          .filter(alias => alias.id || (alias.name && alias.name.trim() !== ""))
          .map(tableConfig.onBuildPayload);
        
        await axios.post(API_ENDPOINTS.aliasSave, { 
          project_id: activeProjectId, 
          aliases: payload 
        });
        
        return { success: true, message: "Aliases saved successfully! ✅" };
      } catch (error) {
        console.error("Error saving aliases:", error);
        // Handle structured error response from API
        if (error.response?.data?.details) {
          const errorMessages = error.response.data.details.map(e => {
            const errorText = Object.values(e.errors).flat().join(", ");
            return `Can't save alias "${e.alias}": ${errorText}`;
          });
          return { success: false, message: `⚠️ ${errorMessages.join(" | ")}` };
        }
        
        return { 
          success: false, 
          message: `⚠️ Error: ${error.response?.data?.message || error.message}` 
        };
      }
    },
    // Pre-save validation
    beforeSave: (data) => {
      // Validate fabric is selected for aliases with a name
      const invalidAlias = data.find(alias => 
        alias.name && alias.name.trim() !== "" && 
        (!alias.fabric_details?.name && !alias.fabric)
      );
      
      if (invalidAlias) {
        return `Alias "${invalidAlias.name}" must have a fabric selected`;
      }
      
      return true;
    }
  };

  return (
    <div className="table-container">
      <GenericTable
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.aliases}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.aliasSave}
        deleteUrl={API_ENDPOINTS.aliasDelete}
        newRowTemplate={NEW_ALIAS_TEMPLATE}
        fixedColumnsLeft={1}
        columnSorting={true}
        filters={true}
        storageKey="aliasTableColumnWidths"
        {...tableConfig}
        additionalButtons={
          <Button
            className="save-button"
            onClick={() => {
              if (tableRef.current?.isDirty) {
                if (window.confirm("You have unsaved changes. Save before generating scripts?")) {
                  // Save first
                  tableRef.current.refreshData().then(() => navigate("/san/aliases/alias-scripts"));
                }
              } else {
                navigate("/san/aliases/alias-scripts");
              }
            }}
          >
            Generate Alias Scripts
          </Button>
        }
      />
    </div>
  );
};

export default AliasTable;