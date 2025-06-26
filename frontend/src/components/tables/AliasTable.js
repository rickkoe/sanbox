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
  zoned_count: 0
};

// WWPN formatting utilities
const formatWWPN = (value) => {
  if (!value) return "";
  
  const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  
  if (cleanValue.length !== 16) {
    return value;
  }
  
  return cleanValue.match(/.{2}/g).join(':');
};

const isValidWWPNFormat = (value) => {
  if (!value) return true;
  
  const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
  return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
};

const AliasTable = () => {
  const { config } = useContext(ConfigContext);
  const [fabricOptions, setFabricOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const navigate = useNavigate();

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics
  useEffect(() => {
    const loadFabrics = async () => {
      if (activeCustomerId) {
        try {
          const response = await axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`);
          setFabricOptions(response.data.map(f => ({ id: f.id, name: f.name })));
        } catch (error) {
          console.error("Error fetching fabrics:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadFabrics();
  }, [activeCustomerId]);

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  if (loading) {
    return <div className="alert alert-info">Loading fabrics...</div>;
  }

  // Custom WWPN change handler
  const handleWWPNChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    
    changes.forEach(([row, prop, oldVal, newVal]) => {
      if (prop === 'wwpn' && newVal !== oldVal) {
        const formattedValue = formatWWPN(newVal);
        
        if (formattedValue !== newVal && formattedValue.length === 23) {
          setTimeout(() => {
            hot.setDataAtCell(row, hot.propToCol(prop), formattedValue);
          }, 0);
        }
      }
    });
  };

  // Build payload function
  const buildPayload = (row) => {
    let fabricId;

    if (row.fabric_details?.name) {
      const fabric = fabricOptions.find(f => f.name === row.fabric_details.name);
      fabricId = fabric ? fabric.id : null;
    } else if (row.fabric) {
      if (typeof row.fabric === "number") {
        fabricId = row.fabric;
      } else {
        const fabric = fabricOptions.find(f => f.name === row.fabric || f.id.toString() === row.fabric);
        fabricId = fabric ? fabric.id : parseInt(row.fabric);
      }
    }

    if (!fabricId || isNaN(fabricId)) {
      throw new Error(`Alias "${row.name}" must have a valid fabric selected`);
    }

    const payload = { ...row };
    delete payload.saved;
    delete payload.fabric_details;
    delete payload.zoned_count;

    if (payload.wwpn) {
      payload.wwpn = formatWWPN(payload.wwpn);
    }

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: parseInt(fabricId),
    };
  };

  // Custom save handler
  const handleSave = async (unsavedData) => {
    try {
      const invalidWWPN = unsavedData.find((alias) => {
        if (!alias.name || alias.name.trim() === "") return false;
        if (!alias.wwpn) return true;

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
        .filter(alias => alias.id || (alias.name && alias.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(API_ENDPOINTS.aliasSave, {
        project_id: activeProjectId,
        aliases: payload,
      });

      return { success: true, message: "Aliases saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving aliases:", error);
      
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `Can't save alias "${e.alias}": ${errorText}`;
        });
        return { success: false, message: `⚠️ ${errorMessages.join(" | ")}` };
      }

      return {
        success: false,
        message: `⚠️ Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Before save validation
  const beforeSaveValidation = (data) => {
    const invalidAlias = data.find(
      alias => alias.name && 
               alias.name.trim() !== "" && 
               !alias.fabric_details?.name && 
               !alias.fabric?.trim()
    );

    if (invalidAlias) {
      return `Alias "${invalidAlias.name}" must have a fabric selected`;
    }

    return true;
  };

  // Process data for display
  const preprocessData = (data) => {
    return data.map((alias) => ({
      ...alias,
      saved: true,
      wwpn: formatWWPN(alias.wwpn),
    }));
  };

  // Custom renderers
  const customRenderers = {
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
      td.innerText = value || "";

      if (value) {
        td.style.fontFamily = "monospace";
      } else {
        td.style.fontFamily = "";
      }

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
        td.title = "Enter WWPN (16 hex characters, auto-formatted with colons)";
      }

      return td;
    },
    zoned_count: (instance, td, row, col, prop, value) => {
      const count = value || 0;
      td.innerText = count;
      td.style.textAlign = "center";
      td.style.fontWeight = "600";

      if (count === 0) {
        td.style.color = "#6b7280";
        td.style.backgroundColor = "#f9fafb";
      } else if (count === 1) {
        td.style.color = "#059669";
        td.style.backgroundColor = "#ecfdf5";
      } else {
        td.style.color = "#dc2626";
        td.style.backgroundColor = "#fef2f2";
      }

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
    },
  };

  const colHeaders = [
    "Name", "WWPN", "Use", "Fabric", "Alias Type", "Create", 
    "Include in Zoning", "Zoned Count", "Imported", "Updated", "Notes",
  ];

  const columns = [
    { data: "name" },
    {
      data: "wwpn",
      validator: (value, callback) => {
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
    { data: "zoned_count", readOnly: true, className: "htCenter" },
    { data: "imported", readOnly: true },
    { data: "updated", readOnly: true },
    { data: "notes" },
  ];

  const dropdownSources = {
    use: ["init", "target", "both"],
    "fabric_details.name": fabricOptions.map(f => f.name),
    cisco_alias: ["device-alias", "fcalias", "wwpn"],
  };

  return (
    <div className="table-container">
      <GenericTable
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.aliases}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.aliasSave}
        deleteUrl={API_ENDPOINTS.aliasDelete}
        newRowTemplate={NEW_ALIAS_TEMPLATE}
        colHeaders={colHeaders}
        columns={columns}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        afterChange={handleWWPNChange}
        columnSorting={true}
        filters={true}
        storageKey="aliasTableColumnWidths"
        defaultVisibleColumns={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Alias_Table.csv`}
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