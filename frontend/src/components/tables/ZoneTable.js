import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable";

// API endpoints
const API_ENDPOINTS = {
  zones: "http://127.0.0.1:8000/api/san/zones/project/",
  fabrics: "http://127.0.0.1:8000/api/san/fabrics/",
  aliases: "http://127.0.0.1:8000/api/san/aliases/project/",
  zoneSave: "http://127.0.0.1:8000/api/san/zones/save/",
  zoneDelete: "http://127.0.0.1:8000/api/san/zones/delete/"
};

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null, name: "", fabric: "", create: false, exists: false,
  zone_type: "", notes: "", imported: null, updated: null, saved: false
};

const ZoneTable = () => {
  const { config } = useContext(ConfigContext);
  const [fabricOptions, setFabricOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberColumns, setMemberColumns] = useState(5);
  const [newColumnsCount, setNewColumnsCount] = useState(1);
  const [rawData, setRawData] = useState([]); // Store raw data for member column calculation
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Calculate required member columns from data
  useEffect(() => {
    if (rawData.length > 0) {
      let maxMembers = memberColumns;
      
      rawData.forEach(zone => {
        if (zone.members_details?.length) {
          maxMembers = Math.max(maxMembers, zone.members_details.length);
        }
      });
      
      if (maxMembers > memberColumns) {
        console.log(`Increasing member columns from ${memberColumns} to ${maxMembers}`);
        setMemberColumns(maxMembers);
      }
    }
  }, [rawData, memberColumns]);

  // Helper function to build payload (moved outside useMemo to avoid circular reference)
  const buildPayload = (row) => {
    // Extract members
    const members = [];
    for (let i = 1; i <= memberColumns; i++) {
      const memberName = row[`member_${i}`];
      if (memberName) {
        const alias = memberOptions.find(a => a.name === memberName);
        if (alias) {
          if (row.members_details?.[i-1]?.id) {
            members.push({ id: row.members_details[i-1].id, alias: alias.id });
          } else {
            members.push({ alias: alias.id });
          }
        }
      }
    }
    
    // Clean up payload
    const fabricId = fabricOptions.find(f => f.name === row.fabric)?.id;
    
    const payload = { ...row };
    // Remove member fields & saved flag
    for (let i = 1; i <= memberColumns; i++) delete payload[`member_${i}`];
    delete payload.saved;
    
    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members
    };
  };

  // Table configuration
  const tableConfig = useMemo(() => ({
    colHeaders: [
      "Name", "Fabric", "Create", "Exists", "Zone Type", "Imported", "Updated", "Notes", 
      ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)
    ],
    columns: [
      { data: "name" },
      { data: "fabric", type: "dropdown" },
      { data: "create", type: "checkbox" },
      { data: "exists", type: "checkbox" },
      { data: "zone_type", type: "dropdown" },
      { data: "imported", readOnly: true },
      { data: "updated", readOnly: true },
      { data: "notes" },
      ...Array.from({ length: memberColumns }, (_, i) => ({ data: `member_${i + 1}` }))
    ],
    dropdownSources: {
      fabric: fabricOptions.map(f => f.name),
      zone_type: ["smart", "standard"]
    },
    // Process data for display (simplified - no member column detection here)
    preprocessData: (data) => {
      console.log('Processing data with', memberColumns, 'member columns');
      setRawData(data); // Store raw data for member column calculation
      
      const processed = data.map(zone => {
        const zoneData = { 
          ...zone, 
          fabric: zone.fabric_details?.name || zone.fabric,
          saved: true 
        };
        
        if (zone.members_details?.length) {
          console.log(`Zone ${zone.name} has ${zone.members_details.length} members`);
          zone.members_details.forEach((member, idx) => {
            zoneData[`member_${idx + 1}`] = member.name;
          });
        }
        
        return zoneData;
      });
      
      return processed;
    },
    // Custom renderers
    customRenderers: {
      name: (instance, td, row, col, prop, value) => {
        const rowData = instance.getSourceDataAtRow(row);
        td.innerHTML = rowData && rowData.id !== null && value ? 
          `<strong>${value}</strong>` : 
          value || "";
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
    // Cell configuration for member dropdowns
    getCellsConfig: (hot, row, col, prop) => {
      if (col >= 8 && typeof prop === 'string' && prop.startsWith('member_')) {
        const rowData = hot.getSourceDataAtRow(row);
        if (!rowData) return {};
        
        const rowFabric = rowData.fabric_details?.name || rowData.fabric;
        const currentValue = rowData[prop];
        
        // Find used aliases to exclude
        const usedAliases = new Set();
        hot.getSourceData().forEach((data, idx) => {
          if (idx !== row) {
            for (let i = 1; i <= memberColumns; i++) {
              const val = data[`member_${i}`];
              if (val) usedAliases.add(val);
            }
          }
        });
        
        // Add used aliases from current row (except current cell)
        for (let i = 1; i <= memberColumns; i++) {
          if (`member_${i}` !== prop) {
            const val = rowData[`member_${i}`];
            if (val) usedAliases.add(val);
          }
        }
        
        // Available aliases = matching fabric + include_in_zoning + not used elsewhere
        return {
          type: "dropdown",
          source: memberOptions
            .filter(alias => 
              alias.fabric === rowFabric &&
              alias.include_in_zoning === true &&
              (!usedAliases.has(alias.name) || alias.name === currentValue)
            )
            .map(alias => alias.name)
        };
      }
      return {};
    },
    // Prepare payload for saving
    onBuildPayload: buildPayload, // Use the external function
    // Custom save handler
    onSave: async (unsavedData) => {
      try {
        const payload = unsavedData
          .filter(zone => zone.id || (zone.name && zone.name.trim() !== ""))
          .map(buildPayload); // Use the external function
        
        await axios.post(API_ENDPOINTS.zoneSave, { 
          project_id: activeProjectId, 
          zones: payload 
        });
        
        return { success: true, message: "Zones saved successfully! ✅" };
      } catch (error) {
        console.error("Error saving zones:", error);
        return { 
          success: false, 
          message: `Error: ${error.response?.data?.message || error.message}` 
        };
      }
    },
    // Pre-save validation
    beforeSave: (data) => {
      const invalidZone = data.find(zone => 
        zone.name && zone.name.trim() !== "" && (!zone.fabric || zone.fabric.trim() === "")
      );
      
      return invalidZone ? "Each zone must have a fabric selected" : true;
    }
  }), [memberColumns, fabricOptions, memberOptions, activeProjectId]);

  // Load data
  useEffect(() => {
    if (activeCustomerId) {
      axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`)
        .then(res => setFabricOptions(res.data.map(f => ({ id: f.id, name: f.name }))))
        .catch(err => console.error("Error fetching fabrics:", err));
    }
    
    if (activeProjectId) {
      axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/`)
        .then(res => setMemberOptions(res.data.map(a => ({
          id: a.id, name: a.name, fabric: a.fabric_details?.name, include_in_zoning: a.include_in_zoning
        }))))
        .catch(err => console.error("Error fetching aliases:", err));
    }
  }, [activeCustomerId, activeProjectId]);

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  return (
    <div className="table-container">
      <GenericTable
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Zone Table.csv`}
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.zoneSave}
        deleteUrl={API_ENDPOINTS.zoneDelete}
        newRowTemplate={NEW_ZONE_TEMPLATE}
        storageKey="zoneTableColumnWidths"
        {...tableConfig}
        additionalButtons={
          <>
            <Button 
              className={`save-button ${isAddingColumn ? 'adding-column' : ''}`}
              onClick={async () => {
                console.log(`Adding 1 column. Current: ${memberColumns}`);
                
                // Trigger animation
                setIsAddingColumn(true);
                
                // Add the column
                setMemberColumns(prev => prev + 1);
                
                // Reset animation after a short delay
                setTimeout(() => {
                  setIsAddingColumn(false);
                }, 600);
              }}
              disabled={isAddingColumn} // Prevent spam clicking during animation
            >
              <span className="button-icon">
                {isAddingColumn ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                )}
              </span>
              {isAddingColumn ? 'Adding Column...' : 'Add Member Column'}
            </Button>
            <Button
              className="save-button"
              onClick={() => {
                if (tableRef.current?.isDirty) {
                  if (window.confirm("You have unsaved changes. Save before generating scripts?")) {
                    tableRef.current.refreshData().then(() => navigate("/san/zones/zone-scripts"));
                  }
                } else {
                  navigate("/san/zones/zone-scripts");
                }
              }}
            >
              Generate Zoning Scripts
            </Button>
            <Button variant="outline-primary" onClick={() => navigate('/san/zones/import')}>
              Import Zones
            </Button>
          </>
        }
      />
    </div>
  );
};

export default ZoneTable;