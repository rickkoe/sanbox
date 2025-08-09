import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
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

// All possible alias columns
const ALL_COLUMNS = [
  { data: "name", title: "Name" },
  { data: "wwpn", title: "WWPN" },
  { data: "use", title: "Use" },
  { data: "fabric_details.name", title: "Fabric" },
  { data: "cisco_alias", title: "Alias Type" },
  { data: "create", title: "Create" },
  { data: "delete", title: "Delete" },
  { data: "include_in_zoning", title: "Include in Zoning" },
  { data: "zoned_count", title: "Zoned Count" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
  { data: "notes", title: "Notes" }
];

// Default visible columns (show all by default for compatibility)
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Template for new rows
const NEW_ALIAS_TEMPLATE = {
  id: null,
  name: "",
  wwpn: "",
  use: "",
  fabric: "",
  fabric_details: { name: "" },
  cisco_alias: "",
  create: false,
  delete: false,
  include_in_zoning: false,
  notes: "",
  imported: null,
  updated: null,
  saved: false,
  _isNew: true, // Make sure this is here
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
  const [dataLoaded, setDataLoaded] = useState(false);
  const tableRef = useRef(null);
  const navigate = useNavigate();

  // Column visibility state
  const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
    const saved = localStorage.getItem("aliasTableColumns");
    if (saved) {
      try {
        const savedColumnNames = JSON.parse(saved);
        // Convert saved column names to indices
        const indices = savedColumnNames
          .map(name => ALL_COLUMNS.findIndex(col => col.data === name))
          .filter(index => index !== -1);
        return indices.length > 0 ? indices : DEFAULT_VISIBLE_INDICES;
      } catch (e) {
        return DEFAULT_VISIBLE_INDICES;
      }
    }
    return DEFAULT_VISIBLE_INDICES;
  });

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // No need for useMemo - we pass all columns to GenericTable and let it handle filtering

  // Load fabrics
  useEffect(() => {
    const loadFabrics = async () => {
      if (activeCustomerId) {
        try {
          console.log('Loading fabrics for customer:', activeCustomerId);
          const response = await axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`);
          console.log('Fabrics loaded:', response.data);
          // Handle paginated response structure
          const fabricsArray = response.data.results || response.data;
          setFabricOptions(fabricsArray.map(f => ({ id: f.id, name: f.name })));
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

  // Trigger table refresh when fabrics are loaded
  useEffect(() => {
    if (fabricOptions.length > 0 && tableRef.current && dataLoaded) {
      console.log('Refreshing table with fabric options:', fabricOptions);
      tableRef.current.refreshData();
    }
  }, [fabricOptions, dataLoaded]);

  // Set dataLoaded when data is processed, but outside of render
  useEffect(() => {
    if (tableRef.current?.data?.length > 0) {
      setDataLoaded(true);
    }
  }, [tableRef.current?.data]);

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
    console.log('🔧 buildPayload called with row:', row);
    
    let fabricId;

    if (row.fabric_details?.name) {
      console.log('🔍 Looking for fabric by fabric_details.name:', row.fabric_details.name);
      const fabric = fabricOptions.find(f => f.name === row.fabric_details.name);
      fabricId = fabric ? fabric.id : null;
      console.log('🎯 Found fabric by name:', fabric);
    } else if (row.fabric) {
      console.log('🔍 Looking for fabric by row.fabric:', row.fabric, typeof row.fabric);
      if (typeof row.fabric === "number") {
        fabricId = row.fabric;
        console.log('🎯 Using numeric fabric ID directly:', fabricId);
      } else {
        const fabric = fabricOptions.find(f => f.name === row.fabric || f.id.toString() === row.fabric);
        fabricId = fabric ? fabric.id : parseInt(row.fabric);
        console.log('🎯 Found fabric by string lookup:', fabric, 'fabricId:', fabricId);
      }
    }

    console.log('🏁 Final fabricId:', fabricId, 'isNaN:', isNaN(fabricId));

    if (!fabricId || isNaN(fabricId)) {
      console.error('❌ Invalid fabric ID for alias:', row.name);
      throw new Error(`Alias "${row.name}" must have a valid fabric selected`);
    }

    const payload = { ...row };
    delete payload.saved;
    delete payload.fabric_details;
    delete payload.zoned_count;

    if (payload.wwpn) {
      payload.wwpn = formatWWPN(payload.wwpn);
    }

    const result = {
      ...payload,
      projects: [activeProjectId],
      fabric: parseInt(fabricId),
    };

    console.log('✅ buildPayload result:', result);
    return result;
  };

  // Custom save handler
  const handleSave = async (unsavedData) => {
    console.log('🔥 handleSave called with unsavedData:', unsavedData);
    
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
        .filter(alias => {
          console.log(`🔍 Filtering alias:`, alias);
          const shouldInclude = alias.id || (alias.name && alias.name.trim() !== "");
          console.log(`Should include: ${shouldInclude}`);
          return shouldInclude;
        })
        .map(alias => {
          console.log(`🔧 Building payload for alias:`, alias);
          const result = buildPayload(alias);
          console.log(`✅ Built payload:`, result);
          return result;
        });

      console.log('🚀 Final payload being sent:', payload);

      await axios.post(API_ENDPOINTS.aliasSave, {
        project_id: activeProjectId,
        aliases: payload,
      });

      return { success: true, message: "Aliases saved successfully! ✅" };
    } catch (error) {
      console.error("❌ Error saving aliases:", error);
      
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
    const invalidAlias = data.find(alias => {
      // Skip validation for rows without a name
      if (!alias.name || alias.name.trim() === "") {
        return false;
      }
      
      // Check if fabric is selected in any of the possible formats
      const hasFabric = (alias.fabric_details?.name && alias.fabric_details.name.trim() !== "") || 
                       (alias.fabric && alias.fabric.toString().trim() !== "") || 
                       (typeof alias.fabric === 'number' && alias.fabric > 0);
      
      console.log(`Validating alias "${alias.name}":`, {
        fabric_details_name: alias.fabric_details?.name,
        fabric: alias.fabric,
        hasFabric
      });
      
      return !hasFabric;
    });

    if (invalidAlias) {
      console.log('Invalid alias found:', invalidAlias);
      return `Alias "${invalidAlias.name}" must have a fabric selected`;
    }

    return true;
  };

  // Process data for display
  const preprocessData = (data) => {
    console.log('preprocessData called with:', data.length, 'aliases');
    console.log('Current fabricOptions:', fabricOptions);
    
    const processedData = data.map((alias) => {
      // Find fabric name for this alias
      let fabricName = '';
      if (alias.fabric) {
        const fabric = fabricOptions.find(f => f.id === alias.fabric);
        fabricName = fabric ? fabric.name : `Unknown Fabric (ID: ${alias.fabric})`;
        console.log(`Alias ${alias.name}: fabric ID ${alias.fabric} -> ${fabricName}`);
      }

      return {
        ...alias,
        saved: true,
        wwpn: formatWWPN(alias.wwpn),
        fabric_details: {
          name: fabricName
        }
      };
    });
    
    return processedData;
  };

  // Custom renderers
  const customRenderers = {
    name: (instance, td, row, col, prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      
      // Make bold if row is saved and has an ID (not a new row)
      if (rowData?.saved && rowData?.id) {
        td.innerHTML = `<strong>${value || ""}</strong>`;
      } else {
        td.innerHTML = value || "";
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
        tableName="aliases"
        serverPagination={true}
        defaultPageSize={50}
        storageKey={`alias-table-${activeProjectId}`}
        colHeaders={ALL_COLUMNS.map(col => col.title)}
        columns={ALL_COLUMNS.map(col => {
          const column = { data: col.data };
          
          // Add specific column configurations
          if (col.data === "wwpn") {
            column.validator = (value, callback) => {
              if (!value || isValidWWPNFormat(value)) {
                callback(true);
              } else {
                callback(false);
              }
            };
          } else if (col.data === "use") {
            column.type = "dropdown";
            column.className = "htCenter";
          } else if (col.data === "fabric_details.name") {
            column.type = "dropdown";
          } else if (col.data === "cisco_alias") {
            column.type = "dropdown";
            column.className = "htCenter";
          } else if (col.data === "create" || col.data === "delete" || col.data === "include_in_zoning") {
            column.type = "checkbox";
            column.className = "htCenter";
          } else if (col.data === "zoned_count" || col.data === "imported" || col.data === "updated") {
            column.readOnly = true;
            if (col.data === "zoned_count") {
              column.className = "htCenter";
            }
          }
          
          return column;
        })}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        afterChange={handleWWPNChange}
        columnSorting={true}
        filters={false}
        storageKey="aliasTableColumnWidths"
        defaultVisibleColumns={visibleColumnIndices}
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Alias_Table.csv`}
        additionalButtons={[
          {
            text: "Bulk Import",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <path d="M16 13H8"/>
                <path d="M16 17H8"/>
                <path d="M10 9H8"/>
              </svg>
            ),
            onClick: () => navigate('/san/bulk-import')
          }
        ]}
      />
    </div>
  );
};

export default AliasTable;