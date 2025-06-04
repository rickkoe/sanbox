import React, { useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable";

// API endpoints
const API_ENDPOINTS = {
  aliases: "http://127.0.0.1:8000/api/san/aliases/project/",
  fabrics: "http://127.0.0.1:8000/api/san/fabrics/",
  zones: "http://127.0.0.1:8000/api/san/zones/project/", // Add zones endpoint
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
  saved: false,
  zoned_count: 0 // Add zoned count to template
};

const AliasTable = () => {
  const { config } = useContext(ConfigContext);
  const [fabricOptions, setFabricOptions] = useState([]);
  const [zonesData, setZonesData] = useState([]); // Store zones data
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

  // Load zones data for counting
  useEffect(() => {
    if (activeProjectId) {
      axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/`)
        .then(res => {
          setZonesData(res.data);
        })
        .catch(err => console.error("Error fetching zones:", err));
    }
  }, [activeProjectId]);

  // Function to calculate zoned count for an alias
  const calculateZonedCount = (aliasName) => {
    if (!aliasName || !zonesData.length) return 0;
    
    return zonesData.filter(zone => {
      // Check if this alias is in any of the zone's members
      return zone.members_details && zone.members_details.some(member => 
        member.name === aliasName
      );
    }).length;
  };

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  // Table configuration
  const tableConfig = {
    colHeaders: [
      "Name", "WWPN", "Use", "Fabric", "Alias Type", "Create", 
      "Include in Zoning", "Zoned Count", "Imported", "Updated", "Notes"
    ],
    columns: [
      { data: "name" },
      { data: "wwpn" },
      { data: "use", type: "dropdown", className: "htCenter" },
      { data: "fabric_details.name", type: "dropdown" },
      { data: "cisco_alias", type: "dropdown", className: "htCenter" },
      { data: "create", type: "checkbox", className: "htCenter" },
      { data: "include_in_zoning", type: "checkbox", className: "htCenter" },
      { data: "zoned_count", readOnly: true, className: "htCenter" }, // Add zoned count column
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
        saved: true,
        zoned_count: calculateZonedCount(alias.name) // Calculate zoned count
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
        td.title = count === 0 ? "Not used in any zones" : 
                  count === 1 ? "Used in 1 zone" : 
                  `Used in ${count} zones`;
        
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
      delete payload.zoned_count; // Don't send calculated field to server
      
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
        defaultVisibleColumns={[0, 1, 2, 3, 5, 6, 7, 8, 9, 10]} // Include Zoned Count (index 7)
        
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