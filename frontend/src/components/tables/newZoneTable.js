import React, { useContext, useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable";

// API endpoints object to match the original ZoneTable.js endpoints
const API_ENDPOINTS = {
  zones: "http://127.0.0.1:8000/api/san/zones/project/",
  fabrics: "http://127.0.0.1:8000/api/san/fabrics/customer/",
  aliases: "http://127.0.0.1:8000/api/san/aliases/project/",
  zoneSave: "http://127.0.0.1:8000/api/san/zones/save/",
  zoneDelete: "http://127.0.0.1:8000/api/san/zones/delete/"
};

// Template for new rows - matches the original
const NEW_ZONE_TEMPLATE = {
  id: null,
  name: "",
  fabric: "",
  create: false,
  exists: false,
  zone_type: "smart",
  notes: "",
  imported: null,
  updated: null
};

// List of available zone types
const ZONE_TYPES = ["smart", "standard"];

// Navigation path after successful save
const NAVIGATION_REDIRECT_PATH = "/san/zones/zone-scripts";

const NewZoneTable = () => {
  const { config } = useContext(ConfigContext);
  const [fabricOptions, setFabricOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberColumns, setMemberColumns] = useState(5); // Default number of member columns
  const [newColumnsCount, setNewColumnsCount] = useState(1);
  const tableRef = useRef(null);
  const navigate = useNavigate();

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id || config?.active_customer?.id;

  // Fetch fabric options
  useEffect(() => {
    const fetchFabrics = async () => {
      if (!activeCustomerId) return;
      
      try {
        const response = await axios.get(`${API_ENDPOINTS.fabrics}${activeCustomerId}/`);
        setFabricOptions(response.data.map(fabric => ({ id: fabric.id, name: fabric.name })));
      } catch (error) {
        console.error("Error fetching fabrics:", error);
        setError("Failed to load fabric options. Please try refreshing.");
      }
    };

    fetchFabrics();
  }, [activeCustomerId]);

  // Fetch member options (aliases)
  useEffect(() => {
    const fetchAliases = async () => {
      if (!activeProjectId) return;
      
      try {
        const response = await axios.get(`${API_ENDPOINTS.aliases}${activeProjectId}/`);
        setMemberOptions(response.data.map(alias => ({
          id: alias.id,
          name: alias.name,
          fabric: alias.fabric_details?.name,
          include_in_zoning: alias.include_in_zoning
        })));
      } catch (error) {
        console.error("Error fetching aliases:", error);
        // Silently fail - members might be optional
      } finally {
        setIsLoading(false);
      }
    };

    fetchAliases();
  }, [activeProjectId]);

  // Define column headers dynamically based on member columns
  const getColumnHeaders = useCallback(() => {
    return [
      "Name", "Fabric", "Create", "Exists", "Zone Type", "Imported", "Updated", "Notes", 
      ...Array.from({length: memberColumns}, (_, i) => `Member ${i + 1}`)
    ];
  }, [memberColumns]);

  // Define base columns
  const getBaseColumns = useCallback(() => {
    return [
      { data: "name" },
      { data: "fabric", type: "dropdown" },
      { data: "create", type: "checkbox" },
      { data: "exists", type: "checkbox" },
      { data: "zone_type", type: "dropdown" },
      { data: "imported", readOnly: true },
      { data: "updated", readOnly: true },
      { data: "notes" },
      ...Array.from({ length: memberColumns }, (_, i) => ({ data: `member_${i + 1}` }))
    ];
  }, [memberColumns]);

  // Create dropdown sources object for the table
  const getDropdownSources = useCallback(() => {
    return {
      fabric: fabricOptions.map(f => f.name),
      zone_type: ZONE_TYPES
    };
  }, [fabricOptions]);

  // Custom data preprocessing before rendering
  const preprocessData = useCallback((data) => {
    return data.map(zone => {
      const zoneData = { 
        ...zone, 
        fabric: zone.fabric_details?.name || zone.fabric,
        saved: true 
      };
      
      // Process member columns if members_details exists
      if (zone.members_details && Array.isArray(zone.members_details)) {
        zone.members_details.forEach((member, index) => {
          zoneData[`member_${index + 1}`] = member.name;
        });

        // Update member columns count if needed
        if (zone.members_details.length > memberColumns) {
          setMemberColumns(zone.members_details.length);
        }
      }
      
      return zoneData;
    });
  }, [memberColumns]);

  // Custom renderers for specific columns
  const customRenderers = {
    // Bold the name if it's a saved row
    name: function(instance, td, row, col, prop, value, cellProperties) {
      const rowData = instance.getSourceDataAtRow(row);
      if (rowData && rowData.id !== null && value) {
        td.innerHTML = `<strong>${value}</strong>`;
      } else {
        td.innerText = value || "";
      }
      return td;
    },
    // Format date/time for imported & updated columns
    imported: function(instance, td, row, col, prop, value, cellProperties) {
      if (value) {
        const date = new Date(value);
        td.innerText = date.toLocaleString();
      } else {
        td.innerText = "";
      }
      return td;
    },
    updated: function(instance, td, row, col, prop, value, cellProperties) {
      if (value) {
        const date = new Date(value);
        td.innerText = date.toLocaleString();
      } else {
        td.innerText = "";
      }
      return td;
    }
  };

  // Handle dynamic member dropdown configuration
  const getCellsConfig = useCallback((hot, row, col, prop) => {
    // Member columns are assumed to start at index 7
    if (col >= 7 && prop.startsWith('member_')) {
      const rowData = hot.getSourceDataAtRow(row);
      if (!rowData) return {};
      
      const rowFabric = rowData.fabric_details?.name || rowData.fabric;
      const memberIndex = parseInt(prop.split('_')[1]);
      const currentValue = rowData[prop];
  
      // Gather all alias names used in member columns from all rows except the current row
      const allRows = hot.getSourceData();
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
        const aliasKey = `member_${i}`;
        if (aliasKey !== prop) {
          const aliasValue = rowData[aliasKey];
          if (aliasValue && aliasValue.trim() !== "") {
            usedAliases.add(aliasValue);
          }
        }
      }
  
      // Filter aliases by fabric and unused status
      const availableAliases = memberOptions
        .filter(alias => 
          alias.fabric === rowFabric && 
          alias.include_in_zoning === true &&
          (!usedAliases.has(alias.name) || alias.name === currentValue)
        )
        .map(alias => alias.name);

      return {
        type: "dropdown",
        source: availableAliases
      };
    }
    
    return {};
  }, [memberOptions, memberColumns]);

  // Prepare the payload for saving
  const buildPayload = (row) => {
    // Extract member data
    const members = [];
    for (let i = 1; i <= memberColumns; i++) {
      const memberName = row[`member_${i}`];
      if (memberName && memberName.trim() !== "") {
        const foundAlias = memberOptions.find(alias => alias.name === memberName);
        if (foundAlias) {
          // If an existing member detail exists for this slot, include its id for updating
          if (row.members_details && row.members_details[i-1] && row.members_details[i-1].id) {
            members.push({ id: row.members_details[i-1].id, alias: foundAlias.id });
          } else {
            // Otherwise, return the new member data
            members.push({ alias: foundAlias.id });
          }
        }
      }
    }

    return {
      ...row,
      projects: [activeProjectId],
      fabric: fabricOptions.find(f => f.name === row.fabric)?.id,
      members
    };
  };

  // Special save handler to handle complex zoning data structure
  const handleSave = async (unsavedData) => {
    // Filter rows for saving - each row needs proper validation
    const payload = unsavedData
      .filter(zone => zone.id || (zone.name && zone.name.trim() !== ""))
      .map(buildPayload);

    try {
      await axios.post(
        API_ENDPOINTS.zoneSave,
        { project_id: activeProjectId, zones: payload }
      );
      
      return { success: true, message: "Zones saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving zones:", error);
      return { success: false, message: "Error saving zones. Please try again." };
    }
  };

  // Column width management
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
    const dynamicMemberColumns = Array.from({ length: memberColumns }, () => 250);
    return [...staticColumns, ...dynamicMemberColumns];
  }, [memberColumns]);

  // Handle adding more member columns
  const handleAddColumns = () => {
    setMemberColumns(prev => prev + parseInt(newColumnsCount));
    setNewColumnsCount(1);
  };

  // Show loading or error state
  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  return (
    <div className="zone-table-container">
      <div className="table-controls">
        <Button className="control-button" onClick={handleAddColumns}>
          Add Member Columns
        </Button>
        <input 
          type="number" 
          min="1" 
          max="10"
          value={newColumnsCount}
          onChange={(e) => setNewColumnsCount(parseInt(e.target.value) || 1)}
          style={{ width: "60px", marginLeft: "10px" }}
        />
        
        <Button
          className="control-button"
          onClick={() => navigate("/san/zones/zone-scripts")}
        >
          Generate Zoning Scripts
        </Button>
      </div>
      
      <GenericTable
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.zoneSave}
        deleteUrl={API_ENDPOINTS.zoneDelete}
        columns={getBaseColumns()}
        colHeaders={getColumnHeaders()}
        newRowTemplate={NEW_ZONE_TEMPLATE}
        dropdownSources={getDropdownSources()}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        navigationRedirectPath={NAVIGATION_REDIRECT_PATH}
        colWidths={getColumnWidths()}
        getCellsConfig={getCellsConfig}
        fixedColumnsLeft={1}
        columnSorting={true}
        filters={true}
      />
    </div>
  );
};

export default NewZoneTable;