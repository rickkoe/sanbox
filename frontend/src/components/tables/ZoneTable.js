import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable"; // Fixed import

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  zones: `${API_URL}/api/san/zones/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  aliases: `${API_URL}/api/san/aliases/project/`,
  zoneSave: `${API_URL}/api/san/zones/save/`,
  zoneDelete: `${API_URL}/api/san/zones/delete/`
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
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Calculate required member columns from data - moved to useEffect to avoid render issues
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

  // Helper function to build payload
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

  // Process data for display - removed state update to fix React warning
  const preprocessData = (data) => {
    console.log('Processing data with', memberColumns, 'member columns');
    
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
  };

  // Separate effect to update rawData when zones are loaded
  useEffect(() => {
    if (activeProjectId) {
      const fetchZones = async () => {
        try {
          const response = await axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/`);
          const zonesData = response.data?.results || response.data || [];
          setRawData(zonesData);
        } catch (error) {
          console.error('Error fetching zones for member column calculation:', error);
        }
      };
      
      fetchZones();
    }
  }, [activeProjectId]);

  // Custom save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter(zone => zone.id || (zone.name && zone.name.trim() !== ""))
        .map(buildPayload);
      
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
  };

  // Pre-save validation
  const beforeSaveValidation = (data) => {
    const invalidZone = data.find(zone => 
      zone.name && zone.name.trim() !== "" && (!zone.fabric || zone.fabric.trim() === "")
    );
    
    return invalidZone ? "Each zone must have a fabric selected" : true;
  };

  // Custom renderers
  const customRenderers = {
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
  };

  // Cell configuration for member dropdowns
  const getCellsConfig = (hot, row, col, prop) => {
    if (col >= 8 && typeof prop === 'string' && prop.startsWith('member_')) {
      const rowData = hot.getSourceDataAtRow(row);
      if (!rowData) return {};
      
      const rowFabric = rowData.fabric_details?.name || rowData.fabric;
      const currentValue = rowData[prop];
      
      // Only log for the first member column to reduce spam
      if (prop === 'member_1') {
        console.log(`Member dropdown for row ${row}:`);
        console.log(`  Row fabric: "${rowFabric}"`);
        console.log(`  Available aliases for this fabric:`, memberOptions.filter(a => a.fabric === rowFabric));
        console.log(`  Aliases with include_in_zoning=true:`, memberOptions.filter(a => a.include_in_zoning === true));
      }
      
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
      const availableAliases = memberOptions.filter(alias => {
        const fabricMatch = alias.fabric === rowFabric;
        const includeInZoning = alias.include_in_zoning === true;
        const notUsedElsewhere = !usedAliases.has(alias.name) || alias.name === currentValue;
        
        return fabricMatch && includeInZoning && notUsedElsewhere;
      });
      
      const sourceArray = availableAliases.map(alias => alias.name);
      
      return {
        type: "dropdown",
        source: sourceArray
      };
    }
    return {};
  };

  // Dynamic columns and headers based on memberColumns
  const colHeaders = useMemo(() => [
    "Name", "Fabric", "Create", "Exists", "Zone Type", "Imported", "Updated", "Notes", 
    ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)
  ], [memberColumns]);

  const columns = useMemo(() => [
    { data: "name" },
    { data: "fabric", type: "dropdown" },
    { data: "create", type: "checkbox" },
    { data: "exists", type: "checkbox" },
    { data: "zone_type", type: "dropdown" },
    { data: "imported", readOnly: true },
    { data: "updated", readOnly: true },
    { data: "notes" },
    ...Array.from({ length: memberColumns }, (_, i) => ({ data: `member_${i + 1}` }))
  ], [memberColumns]);

  const dropdownSources = useMemo(() => ({
    fabric: fabricOptions.map(f => f.name),
    zone_type: ["smart", "standard"]
  }), [fabricOptions]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (activeCustomerId) {
          console.log('Loading fabrics for customer:', activeCustomerId);
          const fabricsResponse = await axios.get(`${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`);
          console.log('Fabrics response:', fabricsResponse.data);
          
          // Handle paginated response structure
          const fabricsArray = fabricsResponse.data.results || fabricsResponse.data;
          setFabricOptions(fabricsArray.map(f => ({ id: f.id, name: f.name })));
          console.log('Fabric options set:', fabricsArray.length, 'fabrics');
        }
        
        if (activeProjectId) {
          console.log('Loading aliases for project:', activeProjectId);
          const aliasesResponse = await axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/`);
          console.log('Aliases response:', aliasesResponse.data);
          
          const aliasesArray = aliasesResponse.data.results || aliasesResponse.data;
          const processedAliases = aliasesArray.map(a => {
            // Handle different fabric reference structures
            let fabricName = '';
            if (a.fabric_details?.name) {
              fabricName = a.fabric_details.name;
            } else if (a.fabric) {
              // If fabric is an ID, find the name in fabricOptions
              const fabric = fabricOptions.find(f => f.id === a.fabric);
              fabricName = fabric ? fabric.name : '';
            }
            
            const processedAlias = {
              id: a.id, 
              name: a.name, 
              fabric: fabricName, 
              include_in_zoning: a.include_in_zoning
            };
            
            console.log(`Alias ${a.name}: fabric ID ${a.fabric} -> fabric name "${fabricName}", include_in_zoning: ${a.include_in_zoning}`);
            return processedAlias;
          });
          
          setMemberOptions(processedAliases);
          console.log('Member options set:', processedAliases.length, 'aliases');
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId]);

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  if (loading) {
    return <div className="alert alert-info">Loading fabrics and aliases...</div>;
  }

  return (
    <div className="table-container">
      <GenericTable
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.zoneSave}
        deleteUrl={API_ENDPOINTS.zoneDelete}
        newRowTemplate={NEW_ZONE_TEMPLATE}
        colHeaders={colHeaders}
        columns={columns}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getCellsConfig={getCellsConfig}
        storageKey="zoneTableColumnWidths"
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Zone_Table.csv`}
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
                }, 1);
              }}
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