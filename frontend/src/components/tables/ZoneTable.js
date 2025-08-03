import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable"; // Fixed import

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || "";

const API_ENDPOINTS = {
  zones: `${API_URL}/api/san/zones/project/`,
  zoneMaxMembers: `${API_URL}/api/san/zones/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  aliases: `${API_URL}/api/san/aliases/project/`,
  zoneSave: `${API_URL}/api/san/zones/save/`,
  zoneDelete: `${API_URL}/api/san/zones/delete/`,
};

// Base zone columns (excluding dynamic member columns)
const BASE_COLUMNS = [
  { data: "name", title: "Name" },
  { data: "fabric", title: "Fabric" },
  { data: "member_count", title: "Members" },
  { data: "create", title: "Create" },
  { data: "delete", title: "Delete" },
  { data: "exists", title: "Exists" },
  { data: "zone_type", title: "Zone Type" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
  { data: "notes", title: "Notes" },
];

// Default visible base column indices (show all base columns by default)
const DEFAULT_BASE_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6];

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null,
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

const ZoneTable = () => {
  const { config } = useContext(ConfigContext);
  const { settings } = useSettings();
  const [fabricOptions, setFabricOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  // New structure: track different column types
  const [memberColumnConfig, setMemberColumnConfig] = useState({
    init: 2,    // Initiator columns
    target: 2,  // Target columns  
    both: 1     // Both (any use) columns
  });
  
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [showColumnTypeSelector, setShowColumnTypeSelector] = useState(false);

  // Column visibility state for base columns
  const [visibleBaseIndices] = useState(() => {
    const saved = localStorage.getItem("zoneTableColumns");
    if (saved) {
      try {
        const savedColumnNames = JSON.parse(saved);
        // Convert saved column names to indices (only for base columns)
        const indices = savedColumnNames
          .map((name) => BASE_COLUMNS.findIndex((col) => col.data === name))
          .filter((index) => index !== -1);
        return indices.length > 0 ? indices : DEFAULT_BASE_VISIBLE_INDICES;
      } catch (e) {
        return DEFAULT_BASE_VISIBLE_INDICES;
      }
    }
    return DEFAULT_BASE_VISIBLE_INDICES;
  });

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Clear table configuration cache on project change and when columns change
  useEffect(() => {
    const clearTableConfig = async () => {
      if (activeProjectId) {
        console.log(`🧹 Aggressively clearing ALL table configuration for project ${activeProjectId}`);
        
        // Clear ALL possible storage keys
        const allKeys = Object.keys(localStorage);
        const relevantKeys = allKeys.filter(key => 
          key.includes('zone') || 
          key.includes('table_config') ||
          key.includes('zones') ||
          key.includes(`${activeProjectId}`)
        );
        
        console.log(`🗑️ Removing ${relevantKeys.length} localStorage keys:`, relevantKeys);
        relevantKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Set a flag to force auto-sizing on next table render
        localStorage.setItem('force_autosize_columns', 'true');
        console.log('🎯 Set force auto-size flag');
        
        // Also clear any API-stored table configuration  
        try {
          // Try multiple approaches to delete the config
          const deleteUrls = [
            `${API_URL}/api/core/table-config/zones/?customer_id=${activeCustomerId}`,
            `${API_URL}/api/core/table-config/zones/`,
            `${API_URL}/api/core/table-config/?table_name=zones&customer_id=${activeCustomerId}`,
            `${API_URL}/api/core/table-config/?table_name=zones`
          ];
          
          for (const url of deleteUrls) {
            try {
              const response = await axios.delete(url);
              console.log(`🗑️ Successfully deleted API table config from: ${url}`, response.status);
            } catch (error) {
              console.log(`🗑️ No config found at: ${url}`, error.response?.status);
            }
          }
          
          // Also try to clear by setting empty configuration
          try {
            const clearResponse = await axios.post(`${API_URL}/api/core/table-config/`, {
              table_name: 'zones',
              customer: activeCustomerId,
              visible_columns: [],
              column_widths: {},
              filters: {}
            });
            console.log(`🗑️ Reset table config:`, clearResponse.status);
          } catch (error) {
            console.log(`🗑️ Could not reset config:`, error.response?.status);
          }
          
        } catch (error) {
          console.log(`🗑️ Error during config cleanup:`, error.response?.status);
        }
      }
    };

    clearTableConfig();
  }, [activeProjectId, memberColumnConfig.init, memberColumnConfig.target, memberColumnConfig.both]); // Clear when project OR columns change

  // Calculate required member columns by type from current page data
  useEffect(() => {
    if (rawData.length > 0 && memberOptions.length > 0) {
      let maxInitMembers = 0;
      let maxTargetMembers = 0;
      let maxBothMembers = 0;

      console.log(`🔍 Analyzing ${rawData.length} zones for column requirements...`);

      rawData.forEach((zone, zoneIndex) => {
        if (zone.members_details?.length) {
          let initCount = 0;
          let targetCount = 0;
          let bothCount = 0;
          
          zone.members_details.forEach((member) => {
            // Find the alias to get its use type
            const alias = memberOptions.find(a => a.name === member.name);
            const useType = alias?.use;
            
            console.log(`  Zone ${zoneIndex + 1} member "${member.name}": use="${useType}"`);
            
            if (useType === 'init') {
              initCount++;
            } else if (useType === 'target') {
              targetCount++;
            } else {
              // null, undefined, or 'both' go to both columns
              bothCount++;
            }
          });
          
          console.log(`  Zone ${zoneIndex + 1} counts: init=${initCount}, target=${targetCount}, both=${bothCount}`);
          
          maxInitMembers = Math.max(maxInitMembers, initCount);
          maxTargetMembers = Math.max(maxTargetMembers, targetCount);
          maxBothMembers = Math.max(maxBothMembers, bothCount);
        }
      });

      console.log(`📊 Max members found: init=${maxInitMembers}, target=${maxTargetMembers}, both=${maxBothMembers}`);

      // Ensure minimum columns and update if we need more of any type
      const requiredInit = Math.max(2, maxInitMembers);
      const requiredTarget = Math.max(2, maxTargetMembers);
      const requiredBoth = Math.max(1, maxBothMembers);
      
      console.log(`📋 Required columns: init=${requiredInit}, target=${requiredTarget}, both=${requiredBoth}`);
      console.log(`📋 Current columns: init=${memberColumnConfig.init}, target=${memberColumnConfig.target}, both=${memberColumnConfig.both}`);
      
      const needsUpdate = 
        requiredInit !== memberColumnConfig.init ||
        requiredTarget !== memberColumnConfig.target ||
        requiredBoth !== memberColumnConfig.both;
        
      if (needsUpdate) {
        console.log(`🔄 Updating columns: Target ${memberColumnConfig.target}→${requiredTarget}, Init ${memberColumnConfig.init}→${requiredInit}, Both ${memberColumnConfig.both}→${requiredBoth}`);
        setMemberColumnConfig({
          init: requiredInit,
          target: requiredTarget,
          both: requiredBoth
        });
      } else {
        console.log(`✅ No column update needed`);
      }
    }
  }, [rawData, memberOptions]); // Remove memberColumnConfig dependency to prevent infinite loop

  // Calculate total member columns and create typed member column arrays
  const memberColumnsInfo = useMemo(() => {
    const { init, target, both } = memberColumnConfig;
    const totalMemberColumns = init + target + both;
    
    // Create typed member columns with specific data attributes
    const memberColumns_array = [];
    const memberHeaders = [];
    
    let columnIndex = 1;
    
    // Add target columns FIRST
    for (let i = 0; i < target; i++) {
      memberColumns_array.push({ 
        data: `member_${columnIndex}`,
        memberType: 'target'
      });
      memberHeaders.push(`Target ${i + 1}`);
      columnIndex++;
    }
    
    // Add initiator columns SECOND
    for (let i = 0; i < init; i++) {
      memberColumns_array.push({ 
        data: `member_${columnIndex}`,
        memberType: 'init'
      });
      memberHeaders.push(`Initiator ${i + 1}`);
      columnIndex++;
    }
    
    // Add both/any columns LAST
    for (let i = 0; i < both; i++) {
      memberColumns_array.push({ 
        data: `member_${columnIndex}`,
        memberType: 'both'
      });
      memberHeaders.push(`Any ${i + 1}`);
      columnIndex++;
    }
    
    console.log(`🏷️ Generated column headers:`, memberHeaders);
    console.log(`📋 Column breakdown: ${target} target, ${init} init, ${both} both = ${totalMemberColumns} total`);
    
    return {
      totalMemberColumns,
      memberColumns_array,
      memberHeaders,
      columnTypeMap: memberColumns_array.reduce((map, col) => {
        map[col.data] = col.memberType;
        return map;
      }, {})
    };
  }, [memberColumnConfig]);

  // Helper function to build payload
  const buildPayload = (row) => {
    // Extract members
    const members = [];
    const totalColumns = memberColumnsInfo.totalMemberColumns;
    for (let i = 1; i <= totalColumns; i++) {
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
    for (let i = 1; i <= totalColumns; i++) delete payload[`member_${i}`];
    delete payload.saved;

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members,
    };
  };

  // Process data for display - intelligently place members in correct column types
  const preprocessData = useCallback((data) => {
    return data.map((zone) => {
      const memberCount = zone.members_details?.length || 0;
      const zoneData = {
        ...zone,
        fabric: zone.fabric_details?.name || zone.fabric,
        member_count: memberCount,
        saved: true,
      };

      if (zone.members_details?.length) {
        // Separate members by their use type
        const initMembers = [];
        const targetMembers = [];
        const bothMembers = [];
        
        zone.members_details.forEach((member) => {
          // Find the alias to get its use type
          const alias = memberOptions.find(a => a.name === member.name);
          const useType = alias?.use;
          
          if (useType === 'init') {
            initMembers.push(member.name);
          } else if (useType === 'target') {
            targetMembers.push(member.name);
          } else {
            // null, undefined, or 'both' go to both columns
            bothMembers.push(member.name);
          }
        });
        
        // Place members in appropriate columns based on new order: Target → Initiator → Any
        let columnIndex = 1;
        
        // Place target members in target columns FIRST
        for (let i = 0; i < memberColumnConfig.target; i++) {
          if (i < targetMembers.length) {
            zoneData[`member_${columnIndex}`] = targetMembers[i];
          }
          columnIndex++;
        }
        
        // Place init members in init columns SECOND
        for (let i = 0; i < memberColumnConfig.init; i++) {
          if (i < initMembers.length) {
            zoneData[`member_${columnIndex}`] = initMembers[i];
          }
          columnIndex++;
        }
        
        // Place both/other members in both columns LAST
        for (let i = 0; i < memberColumnConfig.both; i++) {
          if (i < bothMembers.length) {
            zoneData[`member_${columnIndex}`] = bothMembers[i];
          }
          columnIndex++;
        }
      }

      return zoneData;
    });
  }, [memberOptions, memberColumnConfig]);

  // Separate effect to update rawData when zones are loaded
  useEffect(() => {
    if (activeProjectId) {
      const fetchZones = async () => {
        try {
          const response = await axios.get(
            `${API_ENDPOINTS.zones}${activeProjectId}/`
          );
          const zonesData = response.data?.results || response.data || [];
          setRawData(zonesData);
        } catch (error) {
          console.error(
            "Error fetching zones for member column calculation:",
            error
          );
        }
      };

      fetchZones();
    }
  }, [activeProjectId]);

  // Custom save handler
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
  const beforeSaveValidation = (data) => {
    const invalidZone = data.find(
      (zone) =>
        zone.name &&
        zone.name.trim() !== "" &&
        (!zone.fabric || zone.fabric.trim() === "")
    );

    return invalidZone ? "Each zone must have a fabric selected" : true;
  };

  // Custom renderers
  const customRenderers = {
    name: (instance, td, row, _col, _prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      td.innerHTML =
        rowData && rowData.id !== null && value
          ? `<strong>${value}</strong>`
          : value || "";
      return td;
    },
    member_count: (_instance, td, _row, _col, _prop, value) => {
      td.style.textAlign = 'center';
      td.innerText = value || "0";
      return td;
    },
    imported: (_instance, td, _row, _col, _prop, value) => {
      td.innerText = value ? new Date(value).toLocaleString() : "";
      return td;
    },
    updated: (_instance, td, _row, _col, _prop, value) => {
      td.innerText = value ? new Date(value).toLocaleString() : "";
      return td;
    },
  };

  // Memoized cell configuration for member dropdowns - optimized for performance with use type filtering
  const getCellsConfig = useMemo(() => {
    // Pre-calculate fabric and use-type based alias groups for better performance
    const fabricUseAliasMap = new Map();
    memberOptions.forEach(alias => {
      // Keep the original use value, don't default to 'both'
      const useValue = alias.use === null || alias.use === undefined ? 'null' : alias.use;
      const key = `${alias.fabric}-${useValue}`;
      if (!fabricUseAliasMap.has(key)) {
        fabricUseAliasMap.set(key, []);
      }
      fabricUseAliasMap.get(key).push(alias);
      
    });

    const aliasMaxZones = settings?.alias_max_zones || 1;
    
    // Cache dropdown sources to avoid recalculation
    const dropdownCache = new Map();

    return (hot, row, col, prop) => {
      const memberColumnStartIndex = visibleBaseIndices.length;
      if (col >= memberColumnStartIndex && typeof prop === "string" && prop.startsWith("member_")) {
        const rowData = hot.getSourceDataAtRow(row);
        if (!rowData) return {};

        const rowFabric = rowData.fabric_details?.name || rowData.fabric;
        const currentValue = rowData[prop];
        
        // Determine the expected member type for this column
        const columnType = memberColumnsInfo.columnTypeMap[prop];
        if (!columnType) return {};
        
        
        // Create cache key based on fabric, column type, and current value
        const cacheKey = `${rowFabric}-${columnType}-${currentValue || 'empty'}-${row}`;
        
        if (dropdownCache.has(cacheKey)) {
          return dropdownCache.get(cacheKey);
        }

        // Get aliases for this fabric and use type combination - STRICT FILTERING
        let relevantAliases = [];
        
        if (columnType === 'both') {
          // For "both" columns, show aliases with use=both or null/undefined (any use)
          relevantAliases = [
            ...(fabricUseAliasMap.get(`${rowFabric}-both`) || []),
            ...(fabricUseAliasMap.get(`${rowFabric}-null`) || [])
          ];
        } else if (columnType === 'init') {
          // For initiator columns, show ONLY aliases with use=init
          const lookupKey = `${rowFabric}-init`;
          relevantAliases = [
            ...(fabricUseAliasMap.get(lookupKey) || [])
          ];
        } else if (columnType === 'target') {
          // For target columns, show ONLY aliases with use=target
          const lookupKey = `${rowFabric}-target`;
          relevantAliases = [
            ...(fabricUseAliasMap.get(lookupKey) || [])
          ];
        }
        
        
        // Build used aliases set more efficiently (only when cache miss)
        const usedAliases = new Set();
        const sourceData = hot.getSourceData();
        const totalColumns = memberColumnsInfo.totalMemberColumns;
        
        for (let idx = 0; idx < sourceData.length; idx++) {
          if (idx !== row) {
            const data = sourceData[idx];
            for (let i = 1; i <= totalColumns; i++) {
              const val = data[`member_${i}`];
              if (val) usedAliases.add(val);
            }
          }
        }

        // Add used aliases from current row (except current cell)
        for (let i = 1; i <= totalColumns; i++) {
          if (`member_${i}` !== prop) {
            const val = rowData[`member_${i}`];
            if (val) usedAliases.add(val);
          }
        }

        // Filter available aliases with optimized logic
        const availableAliases = relevantAliases.filter((alias) => {
          const includeInZoning = alias.include_in_zoning === true;
          const notUsedElsewhere = !usedAliases.has(alias.name) || alias.name === currentValue;
          const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;
          const isCurrentValue = alias.name === currentValue;
          const zoneCountCheck = hasRoomForMoreZones || isCurrentValue;

          return includeInZoning && notUsedElsewhere && zoneCountCheck;
        });

        const result = {
          type: "dropdown",
          source: availableAliases.map(alias => alias.name),
        };
        
        // Cache the result but limit cache size
        if (dropdownCache.size > 100) {
          dropdownCache.clear();
        }
        dropdownCache.set(cacheKey, result);
        
        return result;
      }
      return {};
    };
  }, [memberOptions, visibleBaseIndices.length, memberColumnsInfo.columnTypeMap, memberColumnsInfo.totalMemberColumns, settings?.alias_max_zones]);

  // Compute displayed columns and headers (base + member columns)
  const { allColumns, allHeaders, defaultVisibleColumns } =
    useMemo(() => {
      // Build ALL base columns (including hidden ones) for GenericTable to know about them
      const allBaseColumns = BASE_COLUMNS.map((colConfig) => {
        const column = { data: colConfig.data };

        // Add specific column configurations
        if (colConfig.data === "fabric" || colConfig.data === "zone_type") {
          column.type = "dropdown";
        } else if (colConfig.data === "create" || colConfig.data === "delete" || colConfig.data === "exists") {
          column.type = "checkbox";
          column.className = "htCenter";
        } else if (
          colConfig.data === "imported" ||
          colConfig.data === "updated" ||
          colConfig.data === "member_count"
        ) {
          column.readOnly = true;
        }

        return column;
      });

      // ALL columns and headers (for GenericTable to know about all options)
      const allCols = [...allBaseColumns, ...memberColumnsInfo.memberColumns_array];
      const allHdrs = [...BASE_COLUMNS.map(col => col.title), ...memberColumnsInfo.memberHeaders];

      // Default visible column indices - base visible indices + ALL member columns
      const memberIndices = Array.from(
        { length: memberColumnsInfo.totalMemberColumns },
        (_, i) => BASE_COLUMNS.length + i
      );
      const defaultVisible = [...visibleBaseIndices, ...memberIndices];

      return {
        allColumns: allCols,
        allHeaders: allHdrs,
        defaultVisibleColumns: defaultVisible,
      };
    }, [visibleBaseIndices, memberColumnsInfo]);

  const dropdownSources = useMemo(
    () => ({
      fabric: fabricOptions.map((f) => f.name),
      zone_type: ["smart", "standard"],
    }),
    [fabricOptions]
  );

  // Memoized handlers for better performance  
  const handleAddColumn = useCallback((columnType) => {
    setMemberColumnConfig(prev => ({
      ...prev,
      [columnType]: prev[columnType] + 1
    }));
    setShowColumnTypeSelector(false);
  }, []);

  const additionalButtonsConfig = useMemo(() => [
    {
      text: "Generate Zoning Scripts",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
      ),
      onClick: () => {
        if (tableRef.current?.isDirty) {
          if (
            window.confirm(
              "You have unsaved changes. Save before generating scripts?"
            )
          ) {
            tableRef.current
              .refreshData()
              .then(() => navigate("/san/zones/zone-scripts"));
          }
        } else {
          navigate("/san/zones/zone-scripts");
        }
      },
    },
    {
      text: "Bulk Import",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      ),
      onClick: () => navigate("/san/bulk-import"),
    },
  ], [navigate]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (activeCustomerId) {
          const fabricsResponse = await axios.get(
            `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`
          );

          // Handle paginated response structure
          const fabricsArray =
            fabricsResponse.data.results || fabricsResponse.data;
          setFabricOptions(
            fabricsArray.map((f) => ({ id: f.id, name: f.name }))
          );
        }

        if (activeProjectId) {
          
          // Fetch ALL aliases - use a large page size or no pagination for dropdown data
          let allAliases = [];
          
          try {
            // First, try to get all aliases with a very large page size
            const url = `${API_ENDPOINTS.aliases}${activeProjectId}/?include_zone_count=true&page_size=10000`;
            console.log(`🔄 Fetching all aliases with large page size: ${url}`);
            const aliasesResponse = await axios.get(url);
            const responseData = aliasesResponse.data;
            
            if (responseData.results) {
              // Paginated response
              allAliases = responseData.results;
              console.log(`📦 Got ${allAliases.length} aliases from large page request`);
              
              // If there might be more, fall back to pagination
              if (responseData.next) {
                console.log(`⚠️ Still more pages available, falling back to pagination...`);
                let page = 2;
                while (responseData.next) {
                  const nextUrl = `${API_ENDPOINTS.aliases}${activeProjectId}/?include_zone_count=true&page_size=10000&page=${page}`;
                  const nextResponse = await axios.get(nextUrl);
                  const nextData = nextResponse.data;
                  allAliases = [...allAliases, ...(nextData.results || [])];
                  console.log(`📦 Got ${nextData.results?.length || 0} more aliases from page ${page}. Total: ${allAliases.length}`);
                  
                  if (!nextData.next) break;
                  page++;
                }
              }
            } else {
              // Non-paginated response
              allAliases = Array.isArray(responseData) ? responseData : [responseData];
              console.log(`📦 Got ${allAliases.length} aliases from non-paginated response`);
            }
          } catch (error) {
            console.error('❌ Error fetching aliases with large page size, falling back to pagination:', error);
            
            // Fallback to original pagination approach
            let page = 1;
            const baseUrl = `${API_ENDPOINTS.aliases}${activeProjectId}/`;
            const queryParams = 'include_zone_count=true&page_size=100';
            
            while (true) {
              const url = `${baseUrl}?${queryParams}&page=${page}`;
              console.log(`🔄 Fetching aliases page ${page}: ${url}`);
              const aliasesResponse = await axios.get(url);
              const responseData = aliasesResponse.data;
              const aliasesArray = responseData.results || responseData;
              
              if (Array.isArray(aliasesArray)) {
                allAliases = [...allAliases, ...aliasesArray];
                console.log(`📦 Page ${page}: got ${aliasesArray.length} aliases. Total so far: ${allAliases.length}`);
                
                // Check if there are more pages
                if (aliasesArray.length === 0 || !responseData.next) {
                  console.log(`✅ No more pages. Final total: ${allAliases.length} aliases`);
                  break;
                }
                page++;
              } else {
                // Handle non-paginated response
                allAliases = Array.isArray(responseData) ? responseData : [responseData];
                console.log(`📦 Non-paginated fallback: ${allAliases.length} aliases`);
                break;
              }
            }
          }
          const aliasesArray = allAliases;
          const processedAliases = aliasesArray.map((a) => {
            // Handle different fabric reference structures
            let fabricName = "";
            if (a.fabric_details?.name) {
              fabricName = a.fabric_details.name;
            } else if (a.fabric) {
              // If fabric is an ID, find the name in fabricOptions
              const fabric = fabricOptions.find((f) => f.id === a.fabric);
              fabricName = fabric ? fabric.name : "";
            }

            return {
              id: a.id,
              name: a.name,
              fabric: fabricName,
              include_in_zoning: a.include_in_zoning,
              zoned_count: a.zoned_count || 0,
              use: a.use, // CRITICAL: Include the use field!
            };
          });

          // If zoned_count is not provided by API, calculate it from existing zones
          if (processedAliases.length > 0 && processedAliases[0].zoned_count === undefined) {
            // Calculate zone counts for each alias
            const aliasZoneCounts = {};
            rawData.forEach(zone => {
              if (zone.members_details) {
                zone.members_details.forEach(member => {
                  if (member.name) {
                    aliasZoneCounts[member.name] = (aliasZoneCounts[member.name] || 0) + 1;
                  }
                });
              }
            });
            
            // Update processedAliases with calculated zone counts
            processedAliases.forEach(alias => {
              alias.zoned_count = aliasZoneCounts[alias.name] || 0;
            });
          }

          setMemberOptions(processedAliases);
          
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId]); // Remove fabricOptions to prevent infinite loop

  // Separate effect to calculate zone counts when both zones and aliases are loaded
  useEffect(() => {
    if (rawData.length > 0 && memberOptions.length > 0) {
      // Check if we need to calculate zone counts client-side
      const needsCalculation = memberOptions.some(alias => alias.zoned_count === undefined || alias.zoned_count === 0);
      
      if (needsCalculation) {
        // Calculate zone counts for each alias
        const aliasZoneCounts = {};
        rawData.forEach(zone => {
          if (zone.members_details) {
            zone.members_details.forEach(member => {
              if (member.name) {
                aliasZoneCounts[member.name] = (aliasZoneCounts[member.name] || 0) + 1;
              }
            });
          }
        });
        
        // Update member options with calculated zone counts
        const updatedMemberOptions = memberOptions.map(alias => ({
          ...alias,
          zoned_count: aliasZoneCounts[alias.name] || 0
        }));
        
        setMemberOptions(updatedMemberOptions);
      }
    }
  }, [rawData]); // Remove memberOptions to prevent infinite loop

  // Close column type selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColumnTypeSelector && !event.target.closest('.position-relative')) {
        setShowColumnTypeSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnTypeSelector]);

  if (!activeProjectId) {
    return (
      <div className="alert alert-warning">No active project selected.</div>
    );
  }

  if (loading) {
    return (
      <div className="alert alert-info">Loading fabrics and aliases...</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTable
        key={`zone-table-${memberColumnsInfo.totalMemberColumns}-${allColumns.length}-${allHeaders.length}`}
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.zones}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.zoneSave}
        deleteUrl={API_ENDPOINTS.zoneDelete}
        newRowTemplate={NEW_ZONE_TEMPLATE}
        tableName="zones"
        colHeaders={allHeaders}
        columns={allColumns}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        serverPagination={true}
        defaultPageSize={50}
        storageKey={`zone-table-${activeProjectId}-cols${memberColumnsInfo.totalMemberColumns}`}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getCellsConfig={getCellsConfig}
        defaultVisibleColumns={defaultVisibleColumns}
        initialVisibleColumns={defaultVisibleColumns}
        getExportFilename={() =>
          `${config?.customer?.name}_${config?.active_project?.name}_Zone_Table.csv`
        }
        headerButtons={
          <div className="position-relative">
            <button
              className="modern-btn modern-btn-secondary dropdown-toggle"
              onClick={() => setShowColumnTypeSelector(!showColumnTypeSelector)}
              title="Add Member Column"
              style={{
                minWidth: '120px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Column {showColumnTypeSelector ? '▲' : '▼'}
            </button>
            {showColumnTypeSelector && (
              <div 
                style={{ 
                  position: 'absolute',
                  top: '100%', 
                  left: '0', 
                  zIndex: 1000,
                  minWidth: '200px',
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  marginTop: '2px',
                  padding: '4px 0'
                }}
              >
                <button
                  onClick={() => handleAddColumn('init')}
                  style={{ 
                    padding: '12px 16px', 
                    border: 'none', 
                    backgroundColor: 'white',
                    width: '100%', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  <strong>Initiator</strong> Column
                  <br />
                  <small style={{color: '#666'}}>For host/server WWPNs</small>
                </button>
                <button
                  onClick={() => handleAddColumn('target')}
                  style={{ 
                    padding: '12px 16px', 
                    border: 'none', 
                    backgroundColor: 'white',
                    width: '100%', 
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  <strong>Target</strong> Column
                  <br />
                  <small style={{color: '#666'}}>For storage/switch WWPNs</small>
                </button>
                <button
                  onClick={() => handleAddColumn('both')}
                  style={{ 
                    padding: '12px 16px', 
                    border: 'none', 
                    backgroundColor: 'white',
                    width: '100%', 
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  <strong>Any Use</strong> Column
                  <br />
                  <small style={{color: '#666'}}>For any member type</small>
                </button>
              </div>
            )}
          </div>
        }
        additionalButtons={additionalButtonsConfig}
      />
    </div>
  );
};

export default ZoneTable;
