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
  const [memberCount, setMemberCount] = useState(5); // Reduced for performance testing

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabric and alias options
  useEffect(() => {
    const loadData = async () => {
      if (!activeCustomerId || !activeProjectId) return;

      console.log('🔍 ZoneTableFast loading fabric and alias data...');
      try {
        // Load fabrics
        const fabricsResponse = await axios.get(
          `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}&page_size=10000`
        );
        const fabricsArray = fabricsResponse.data.results || fabricsResponse.data;
        const processedFabrics = fabricsArray.map((f) => ({ id: f.id, name: f.name }));
        console.log('🔍 ZoneTableFast loaded fabrics:', processedFabrics.length);
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

        console.log('🔍 ZoneTableFast loaded aliases:', processedAliases.length, 'eligible for zoning:', processedAliases.filter(a => a.include_in_zoning).length);
        setMemberOptions(processedAliases);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId]);

  // Skip dynamic member count calculation for now - use fixed count
  // useEffect(() => {
  //   const calculateMemberCount = async () => {
  //     if (!activeProjectId) return;

  //     try {
  //       const response = await axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/column-requirements/`);
  //       const data = response.data;
  //       setMemberCount(Math.max(data.recommended_columns || 5, 5));
  //     } catch (error) {
  //       console.error('Error calculating member count:', error);
  //       setMemberCount(5); // fallback
  //     }
  //   };

  //   calculateMemberCount();
  // }, [activeProjectId]);

  // Process data for display - simplified for performance
  const preprocessData = useCallback((data) => {
    console.log('🔍 ZoneTableFast preprocessData called with', data.length, 'items');
    const startTime = performance.now();
    
    const result = data.map((zone) => {
      const zoneData = {
        ...zone,
        zone_status: "valid", // Simplified - validate only on save
        fabric: zone.fabric_details?.name || zone.fabric,
        saved: true,
      };

      // Add member data to columns - TEMPORARILY DISABLED FOR PERFORMANCE TESTING
      // if (zone.members_details?.length) {
      //   zone.members_details.forEach((member, index) => {
      //     if (index < memberCount) {
      //       zoneData[`member_${index + 1}`] = member.name;
      //     }
      //   });
      // }

      return zoneData;
    });
    
    const endTime = performance.now();
    console.log(`🔍 ZoneTableFast preprocessData took ${endTime - startTime} ms`);
    return result;
  }, []);

  // Build payload for saving - optimized to reduce dependency changes
  const buildPayload = useCallback((row) => {
    console.log('🔍 ZoneTableFast buildPayload called - THIS SHOULD ONLY BE CALLED ON SAVE!');
    const startTime = performance.now();
    
    // Extract members
    const members = [];
    const currentMemberCount = memberCount; // Capture current value
    
    for (let i = 1; i <= currentMemberCount; i++) {
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

    // Clean up payload - copy row and remove internal fields
    const payload = { ...row };
    
    // Remove member fields & internal UI fields
    for (let i = 1; i <= currentMemberCount; i++) delete payload[`member_${i}`];
    delete payload.saved;
    delete payload.members_details;
    delete payload.fabric_details;
    delete payload.zone_status;
    delete payload.member_count;
    delete payload._id;
    delete payload._isNew;

    // Handle boolean fields - Zone model expects actual booleans
    const booleanFields = ['create', 'delete', 'exists'];
    booleanFields.forEach(field => {
      if (payload[field] === undefined || payload[field] === null) {
        payload[field] = false;
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].toLowerCase() === 'true';
      }
      // If already boolean, leave as-is
    });

    // Find fabric ID
    const fabricId = fabricOptions.find((f) => f.name === row.fabric)?.id;

    const finalPayload = {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members,
    };
    
    const endTime = performance.now();
    console.log(`🔍 ZoneTableFast buildPayload took ${endTime - startTime} ms`);
    return finalPayload;
  }, []); // Remove all dependencies to prevent constant re-creation

  // Save handler - individual REST API calls
  const handleSave = async (unsavedData) => {
    console.log('🔍 ZoneTableFast handleSave called with:', unsavedData);
    
    try {
      const errors = [];
      const successes = [];
      
      for (const zone of unsavedData) {
        try {
          const payload = buildPayload(zone);
          console.log(`🔍 Saving zone ${zone.name}:`, payload);
          
          // Validate payload before sending
          if (!payload.fabric) {
            errors.push(`${zone.name}: Fabric is required`);
            continue;
          }
          
          if (!payload.name || payload.name.trim() === '') {
            errors.push(`${zone.name}: Zone name is required`);
            continue;
          }
          
          let response;
          if (zone.id) {
            // Update existing zone
            console.log(`🔄 Updating zone ${zone.id}`);
            response = await axios.put(`${API_URL}/api/san/zones/${zone.id}/`, payload);
            successes.push(`Updated ${zone.name} successfully`);
          } else {
            // Create new zone
            delete payload.id;
            console.log(`🆕 Creating new zone:`, payload);
            response = await axios.post(`${API_URL}/api/san/zones/`, payload);
            successes.push(`Created ${zone.name} successfully`);
          }
          
          console.log(`✅ Zone ${zone.name} save response:`, response.data);
        } catch (error) {
          console.error('❌ Error saving zone:', error.response?.data || error.message);
          
          // More detailed error reporting
          if (error.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'object') {
              const errorMessages = Object.entries(errorData).map(([field, messages]) => 
                `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
              ).join('; ');
              errors.push(`${zone.name}: ${errorMessages}`);
            } else {
              errors.push(`${zone.name}: ${errorData}`);
            }
          } else {
            errors.push(`${zone.name}: ${error.message}`);
          }
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          message: `Errors: ${errors.join(', ')}`
        };
      }
      
      return { success: true, message: `Zones saved successfully! ${successes.join(', ')}` };
    } catch (error) {
      console.error("Error saving zones:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation - simplified for performance
  const beforeSaveValidation = useCallback((data) => {
    console.log('🔍 ZoneTableFast beforeSaveValidation called - THIS SHOULD ONLY BE CALLED ON SAVE!');
    const startTime = performance.now();
    
    // Check for zones without fabric - basic validation only
    const invalidZone = data.find(
      (zone) =>
        zone.name &&
        zone.name.trim() !== "" &&
        (!zone.fabric || zone.fabric.trim() === "")
    );

    if (invalidZone) {
      const endTime = performance.now();
      console.log(`🔍 ZoneTableFast beforeSaveValidation took ${endTime - startTime} ms`);
      return "Each zone must have a fabric selected";
    }

    const endTime = performance.now();
    console.log(`🔍 ZoneTableFast beforeSaveValidation took ${endTime - startTime} ms`);
    return true; // Simplified - detailed validation handled by server
  }, []);

  // Delete handler
  const handleDelete = useCallback(async (zoneId) => {
    try {
      await axios.delete(`${API_URL}/api/san/zones/${zoneId}/`);
      return { success: true, message: 'Zone deleted successfully!' };
    } catch (error) {
      console.error('Error deleting zone:', error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  }, []);

  // Create dropdown sources - simplified for performance, no member dropdowns for now
  const dropdownSources = useMemo(() => {
    const sources = {
      fabric: fabricOptions.map((f) => f.name),
      zone_type: ["smart", "standard"],
    };
    
    // TODO: Add dynamic member dropdown filtering by fabric
    // For now, no member dropdowns to eliminate performance issues
    console.log('🔍 ZoneTableFast dropdownSources created:', Object.keys(sources));
    return sources;
  }, [fabricOptions.length]); // Minimal dependencies


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

  // Let GenericTableFast auto-generate columns for better performance
  // const columns = useMemo(() => {
  //   const baseColumns = [
  //     { data: "zone_status", title: "Status", width: 80 },
  //     { data: "name", title: "Zone Name", width: 200 },
  //     { data: "fabric", title: "Fabric", width: 120 },
  //     { data: "zone_type", title: "Type", width: 100 },
  //     { data: "create", title: "Create", width: 80 },
  //     { data: "delete", title: "Delete", width: 80 },
  //     { data: "exists", title: "Exists", width: 80 },
  //   ];

  //   // Static member columns - no dynamic generation for performance
  //   const memberColumns = [
  //     { data: "member_1", title: "Member 1", width: 150 },
  //     { data: "member_2", title: "Member 2", width: 150 },
  //     { data: "member_3", title: "Member 3", width: 150 },
  //     { data: "member_4", title: "Member 4", width: 150 },
  //     { data: "member_5", title: "Member 5", width: 150 },
  //   ];

  //   console.log('🔍 ZoneTableFast columns created (static)');
  //   return [
  //     ...baseColumns,
  //     ...memberColumns,
  //     { data: "notes", title: "Notes", width: 200 }
  //   ];
  // }, []); // No dependencies

  if (!activeProjectId) {
    return (
      <div className="alert alert-warning">No active project selected.</div>
    );
  }

  return (
    <div className="table-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        tableName="zones"
        newRowTemplate={NEW_ZONE_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        onDelete={handleDelete}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_${config?.active_project?.name}_Zone_Table.csv`
        }
        columnActions={columnActions}
      />
    </div>
  );
};

export default ZoneTableFast;