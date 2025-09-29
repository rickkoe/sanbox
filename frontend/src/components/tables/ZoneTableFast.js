import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import GenericTableFast from "./GenericTable/GenericTableFast";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || "";
const API_ENDPOINTS = {
  zones: `${API_URL}/api/san/zones/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  aliases: `${API_URL}/api/san/aliases/project/`,
  zoneSave: `${API_URL}/api/san/zones/save/`,
  zoneDelete: `${API_URL}/api/san/zones/delete/`,
};

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null,
  zone_status: "valid",
  name: "",
  fabric: "",
  member_count: 0,
  create: false,
  delete: false,
  exists: false,
  zone_type: "",
  notes: "",
  imported: null,
  updated: null,
  saved: false,
};

const ZoneTableFast = () => {
  const { config } = useContext(ConfigContext);
  const { settings } = useSettings();
  const tableRef = useRef(null);
  
  // State for dropdown sources
  const [fabricOptions, setFabricOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberCount, setMemberCount] = useState(20);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabric and alias options
  useEffect(() => {
    const loadData = async () => {
      if (!activeCustomerId || !activeProjectId) return;

      try {
        // Load fabrics
        const fabricsResponse = await axios.get(
          `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}&page_size=10000`
        );
        const fabricsArray = fabricsResponse.data.results || fabricsResponse.data;
        const processedFabrics = fabricsArray.map((f) => ({ id: f.id, name: f.name }));
        setFabricOptions(processedFabrics);

        // Load aliases  
        const aliasesResponse = await axios.get(
          `${API_ENDPOINTS.aliases}${activeProjectId}/?include_zone_count=true&page_size=1000`
        );
        const aliasesData = aliasesResponse.data.results || aliasesResponse.data;
        
        const processedAliases = aliasesData.map((a) => {
          let fabricName = "";
          if (a.fabric_details?.name) {
            fabricName = a.fabric_details.name;
          } else if (a.fabric) {
            const fabric = processedFabrics.find((f) => f.id === a.fabric);
            fabricName = fabric ? fabric.name : "";
          }

          return {
            id: a.id,
            name: a.name,
            fabric: fabricName,
            include_in_zoning: a.include_in_zoning,
            zoned_count: a.zoned_count || 0,
            use: a.use,
          };
        });

        setMemberOptions(processedAliases);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId]);

  // Calculate required member columns
  useEffect(() => {
    const calculateMemberCount = async () => {
      if (!activeProjectId) return;

      try {
        const response = await axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/column-requirements/`);
        const data = response.data;
        setMemberCount(Math.max(data.recommended_columns || 20, 20));
      } catch (error) {
        console.error('Error calculating member count:', error);
        setMemberCount(20); // fallback
      }
    };

    calculateMemberCount();
  }, [activeProjectId]);

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((zone) => {
      const memberCount = zone.members_details?.length || 0;
      
      // Validate zone fabric status
      let zoneStatus = "valid";
      if (zone.fabric && zone.members_details?.length) {
        const zoneFabric = zone.fabric_details?.name || zone.fabric;
        const invalidMembers = zone.members_details.filter(member => {
          const alias = memberOptions.find(alias => alias.name === member.name);
          return alias && alias.fabric !== zoneFabric;
        });
        zoneStatus = invalidMembers.length > 0 ? "invalid" : "valid";
      }
      
      const zoneData = {
        ...zone,
        zone_status: zoneStatus,
        fabric: zone.fabric_details?.name || zone.fabric,
        member_count: memberCount,
        saved: true,
      };

      // Add member data to columns
      if (zone.members_details?.length) {
        zone.members_details.forEach((member, index) => {
          if (index < memberCount) {
            zoneData[`member_${index + 1}`] = member.name;
          }
        });
      }

      return zoneData;
    });
  }, [memberOptions]);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    // Extract members
    const members = [];
    for (let i = 1; i <= memberCount; i++) {
      const memberName = row[`member_${i}`];
      if (memberName) {
        const alias = memberOptions.find((a) => a.name === memberName);
        if (alias) {
          if (row.members_details?.[i - 1]?.id) {
            members.push({
              id: row.members_details[i - 1].id,
              alias: alias.id,
            });
          } else {
            members.push({ alias: alias.id });
          }
        }
      }
    }

    // Clean up payload
    const fabricId = fabricOptions.find((f) => f.name === row.fabric)?.id;
    const payload = { ...row };
    
    // Remove member fields & saved flag
    for (let i = 1; i <= memberCount; i++) delete payload[`member_${i}`];
    delete payload.saved;

    // Handle boolean fields
    const booleanFields = ['create', 'delete', 'exists'];
    booleanFields.forEach(field => {
      if (payload[field] === 'unknown' || payload[field] === undefined || payload[field] === null || payload[field] === '') {
        payload[field] = false;
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].toLowerCase() === 'true';
      }
    });

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members,
    };
  }, [memberCount, memberOptions, fabricOptions, activeProjectId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((zone) => zone.id || (zone.name && zone.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(API_ENDPOINTS.zoneSave, {
        project_id: activeProjectId,
        zones: payload,
      });

      return { success: true, message: "Zones saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving zones:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for zones without fabric
    const invalidZone = data.find(
      (zone) =>
        zone.name &&
        zone.name.trim() !== "" &&
        (!zone.fabric || zone.fabric.trim() === "")
    );

    if (invalidZone) {
      return "Each zone must have a fabric selected";
    }

    // Check for fabric mismatch between zone and members
    const fabricMismatchZone = data.find((zone) => {
      if (!zone.name || zone.name.trim() === "" || !zone.fabric) return false;
      
      const zoneFabric = zone.fabric;
      
      for (let i = 1; i <= memberCount; i++) {
        const memberName = zone[`member_${i}`];
        if (memberName) {
          const alias = memberOptions.find(alias => alias.name === memberName);
          if (alias && alias.fabric !== zoneFabric) {
            return true; // Found a fabric mismatch
          }
        }
      }
      return false;
    });

    if (fabricMismatchZone) {
      return `Zone "${fabricMismatchZone.name}" contains members that don't belong to fabric "${fabricMismatchZone.fabric}". Please fix before saving.`;
    }

    return true;
  }, [memberOptions, memberCount]);

  // Create dropdown sources
  const dropdownSources = useMemo(() => {
    const sources = {
      fabric: fabricOptions.map((f) => f.name),
      zone_type: ["smart", "standard"],
    };
    
    // Add member column dropdown sources
    for (let i = 1; i <= memberCount; i++) {
      const memberKey = `member_${i}`;
      sources[memberKey] = memberOptions
        .filter(alias => alias.include_in_zoning)
        .map(alias => alias.name);
    }
    
    return sources;
  }, [fabricOptions, memberOptions, memberCount]);


  // Add member column
  const handleAddColumn = useCallback(() => {
    setMemberCount(prev => prev + 1);
  }, []);

  // Column actions for the dropdown
  const columnActions = useMemo(() => [
    {
      text: "Add Member Column",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      onClick: handleAddColumn,
    },
  ], [handleAddColumn]);


  if (!activeProjectId) {
    return (
      <div className="alert alert-warning">No active project selected.</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.zoneSave}
        deleteUrl={API_ENDPOINTS.zoneDelete}
        tableName="zones"
        memberCount={memberCount}
        newRowTemplate={NEW_ZONE_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_${config?.active_project?.name}_Zone_Table.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default ZoneTableFast;