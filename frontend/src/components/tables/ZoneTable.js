import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
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
  { data: "zone_status", title: "Status" },
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
const DEFAULT_BASE_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null,
  zone_status: "valid", // Default to valid for new zones
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
  // Simplified structure: just track total member columns
  const [memberColumnRequirements, setMemberColumnRequirements] = useState({
    memberColumns: 5,
    totalZones: 0
  });
  
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationModalData, setValidationModalData] = useState(null);
  const tableRef = useRef(null);
  const navigate = useNavigate();

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
  }, [activeProjectId, memberColumnRequirements.memberColumns]); // Clear when project OR columns change

  // Calculate required member columns by type from ALL zones (not just current page)
  useEffect(() => {
    const calculateColumnRequirements = async () => {
      console.log(`🔧 calculateColumnRequirements called: activeProjectId=${activeProjectId}, memberOptions.length=${memberOptions.length}`);
      
      if (activeProjectId && memberOptions.length > 0) {
        try {
          // Use new lightweight endpoint to get column requirements
          console.log('🔍 Fetching column requirements from optimized endpoint...');
          
          const response = await axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/column-requirements/`);
          const data = response.data;
          
          console.log('📦 Column requirements response:', data);
          
          const newColumnInfo = {
            memberColumns: Math.max(data.recommended_columns || 5, 5), // At least 5 columns
            totalZones: data.total_zones || 0
          };
          
          console.log(`📊 Final column requirements:`, newColumnInfo);
          
          setMemberColumnRequirements(newColumnInfo);
        } catch (error) {
          console.error('Error calculating column requirements:', error);
          // Fallback to reasonable defaults
          setMemberColumnRequirements({
            memberColumns: 6,
            totalZones: 0
          });
        }
      }
    };

    calculateColumnRequirements();
    
    // Add debug function to window for manual testing
    window.debugZoneColumns = calculateColumnRequirements;
    
  }, [activeProjectId, memberOptions]); // Remove memberColumnConfig and rawData dependencies

  // Calculate total member columns and create simple member column arrays
  const memberColumnsInfo = useMemo(() => {
    const { memberColumns } = memberColumnRequirements;
    
    // Create simple member columns
    const memberColumns_array = [];
    const memberHeaders = [];
    
    for (let i = 1; i <= memberColumns; i++) {
      memberColumns_array.push({ 
        data: `member_${i}`
      });
      memberHeaders.push(`Member ${i}`);
    }
    
    console.log(`🏷️ Generated column headers:`, memberHeaders);
    console.log(`📋 Column breakdown: ${memberColumns} member columns total`);
    
    return {
      totalMemberColumns: memberColumns,
      memberColumns_array,
      memberHeaders
    };
  }, [memberColumnRequirements]);

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

    // Handle boolean fields - convert "unknown" values to default False
    const booleanFields = ['create', 'delete', 'exists'];
    booleanFields.forEach(field => {
      if (payload[field] === 'unknown' || payload[field] === undefined || payload[field] === null || payload[field] === '') {
        payload[field] = false; // Set to default False
      } else if (typeof payload[field] === 'string') {
        // Convert string representations to boolean
        payload[field] = payload[field].toLowerCase() === 'true';
      }
    });

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members,
    };
  };

  // Function to validate zone fabric consistency
  const validateZoneFabricStatus = (zone) => {
    if (!zone.fabric || !zone.members_details?.length) {
      return "valid"; // Empty zones or zones without fabric are considered valid
    }

    const zoneFabric = zone.fabric_details?.name || zone.fabric;
    
    // Check if all members belong to the same fabric as the zone
    const invalidMembers = zone.members_details.filter(member => {
      const alias = memberOptions.find(alias => alias.name === member.name);
      return alias && alias.fabric !== zoneFabric;
    });

    return invalidMembers.length > 0 ? "invalid" : "valid";
  };

  // Process data for display - intelligently place members in correct column types
  const preprocessData = useCallback((data) => {
    return data.map((zone) => {
      const memberCount = zone.members_details?.length || 0;
      
      // Validate zone fabric status
      const zoneStatus = validateZoneFabricStatus(zone);
      
      const zoneData = {
        ...zone,
        zone_status: zoneStatus,
        fabric: zone.fabric_details?.name || zone.fabric,
        member_count: memberCount,
        saved: true,
      };

      if (zone.members_details?.length) {
        // Simply place all members sequentially in member columns
        zone.members_details.forEach((member, index) => {
          if (index < memberColumnRequirements.memberColumns) {
            zoneData[`member_${index + 1}`] = member.name;
          }
        });
      }

      return zoneData;
    });
  }, [memberOptions, memberColumnRequirements]);

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

  // BULLETPROOF fabric validation highlighter - finds cells by content and forces styling
  const highlightInvalidMembers = (invalidMembers) => {
    console.log(`🎯 BULLETPROOF: Highlighting ${invalidMembers.length} invalid members`);
    
    // Find ALL table cells in the document
    const allCells = document.querySelectorAll('td');
    let highlightedCount = 0;
    
    allCells.forEach((cell) => {
      const cellText = cell.textContent?.trim() || '';
      
      // Check if this cell contains any of our invalid member names
      invalidMembers.forEach(invalid => {
        const memberName = invalid.member;
        
        // Check various text patterns the cell might contain
        if (cellText === memberName || 
            cellText === `▼${memberName}` || 
            cellText.includes(memberName)) {
          
          console.log(`🎯 FOUND INVALID MEMBER CELL: "${cellText}" -> highlighting`);
          
          // BRUTE FORCE STYLING - every possible way to make it red
          cell.className = (cell.className || '') + ' fabric-validation-invalid';
          cell.setAttribute('data-fabric-invalid', 'true');
          
          // Set cssText directly (highest priority)
          cell.style.cssText = 'color: red !important; background-color: #ffebee !important; font-weight: bold !important; border: 2px solid red !important;';
          
          // Also set individual properties as backup
          cell.style.setProperty('color', 'red', 'important');
          cell.style.setProperty('background-color', '#ffebee', 'important'); 
          cell.style.setProperty('font-weight', 'bold', 'important');
          cell.style.setProperty('border', '2px solid red', 'important');
          
          cell.title = `Invalid: ${memberName} does not belong to the zone's fabric`;
          highlightedCount++;
        }
      });
    });
    
    console.log(`🎯 BULLETPROOF: Highlighted ${highlightedCount} cells total`);
    
    // AGGRESSIVE: Keep re-applying styling continuously during scroll
    if (highlightedCount > 0) {
      // Set up continuous highlighting intervals
      const intervals = [
        setInterval(() => highlightInvalidMembers(invalidMembers), 200),  // Every 200ms
        setInterval(() => highlightInvalidMembers(invalidMembers), 500),  // Every 500ms
        setInterval(() => highlightInvalidMembers(invalidMembers), 1000)  // Every 1s
      ];
      
      // Also watch for scroll events and re-highlight immediately
      const handsontable = document.querySelector('.handsontable');
      if (handsontable) {
        const scrollHandler = () => {
          setTimeout(() => highlightInvalidMembers(invalidMembers), 10);
          setTimeout(() => highlightInvalidMembers(invalidMembers), 50);
          setTimeout(() => highlightInvalidMembers(invalidMembers), 100);
        };
        handsontable.addEventListener('scroll', scrollHandler);
        
        // Store cleanup
        window.fabricValidationCleanup = () => {
          intervals.forEach(interval => clearInterval(interval));
          handsontable.removeEventListener('scroll', scrollHandler);
          console.log('🧹 Cleaned up continuous highlighting');
        };
      }
      
      // Clean up after 30 seconds to prevent memory leaks
      setTimeout(() => {
        if (window.fabricValidationCleanup) {
          window.fabricValidationCleanup();
          window.fabricValidationCleanup = null;
        }
      }, 30000);
    }
    
    return highlightedCount > 0;
  };

  // Pre-save validation
  const beforeSaveValidation = (data) => {
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

    // Check for fabric mismatch between zone and members with highlighting
    const invalidMembers = [];
    const fabricMismatchZone = data.find((zone) => {
      if (!zone.name || zone.name.trim() === "" || !zone.fabric) return false;
      
      const zoneFabric = zone.fabric;
      const totalColumns = memberColumnsInfo.totalMemberColumns || 10;
      
      for (let i = 1; i <= totalColumns; i++) {
        const memberName = zone[`member_${i}`];
        if (memberName) {
          const alias = memberOptions.find(alias => alias.name === memberName);
          if (alias && alias.fabric !== zoneFabric) {
            invalidMembers.push({ member: memberName, fabric: zoneFabric, zoneName: zone.name });
            return true; // Found a fabric mismatch
          }
        }
      }
      return false;
    });

    if (fabricMismatchZone) {
      // Use the bulletproof highlighter
      setTimeout(() => highlightInvalidMembers(invalidMembers), 100);
      
      return `Zone "${fabricMismatchZone.name}" contains members that don't belong to fabric "${fabricMismatchZone.fabric}". Please fix the highlighted members before saving.`;
    }

    // Clear any previous validation highlighting if save is successful
    if (window.fabricValidationCleanup) {
      window.fabricValidationCleanup();
      window.fabricValidationCleanup = null;
    }
    document.querySelectorAll('.fabric-validation-invalid').forEach(cell => {
      cell.classList.remove('fabric-validation-invalid');
      cell.removeAttribute('data-fabric-invalid');
      cell.style.cssText = '';
      cell.title = '';
    });

    return true;
  };

  // Helper function to validate if member belongs to zone's fabric
  const validateMemberFabric = (memberName, zoneFabric) => {
    if (!memberName || !zoneFabric) return true; // Don't validate empty cells
    
    const alias = memberOptions.find(alias => alias.name === memberName);
    if (!alias) return false; // Member not found
    
    return alias.fabric === zoneFabric; // Check if fabrics match
  };

  // Create member column renderers dynamically based on actual member columns
  const customRenderers = useMemo(() => {
    const renderers = {
      zone_status: (instance, td, row, _col, _prop, value) => {
        td.style.textAlign = 'center';
        td.style.fontSize = '16px';
        
        // Get the full row data to access zone details
        const rowData = instance.getSourceDataAtRow(row);
        const zoneFabric = rowData?.fabric || '';
        
        if (value === 'invalid') {
          // Red X for invalid zones - make it clickable
          td.innerHTML = '<span style="color: #dc2626; font-weight: bold; font-size: 18px; cursor: pointer;">✗</span>';
          td.style.backgroundColor = '#fef2f2';
          td.style.cursor = 'pointer';
          
          // Find which members are invalid
          const invalidMembers = [];
          const validMembers = [];
          const totalMemberColumns = memberColumnsInfo.totalMemberColumns || 10;
          
          for (let i = 1; i <= totalMemberColumns; i++) {
            const memberName = rowData[`member_${i}`];
            if (memberName) {
              const alias = memberOptions.find(alias => alias.name === memberName);
              if (alias && alias.fabric !== zoneFabric) {
                invalidMembers.push({
                  name: memberName,
                  actualFabric: alias.fabric,
                  expectedFabric: zoneFabric
                });
              } else if (alias) {
                validMembers.push(memberName);
              }
            }
          }
          
          // Add click handler for modal
          td.onclick = (e) => {
            e.stopPropagation();
            setValidationModalData({
              zoneName: rowData.name,
              zoneFabric: zoneFabric,
              invalidMembers: invalidMembers,
              validMembers: validMembers
            });
            setShowValidationModal(true);
          };
          
          if (invalidMembers.length > 0) {
            td.title = `Click for details - Invalid: These members do not belong to fabric "${zoneFabric}":\n• ${invalidMembers.map(m => `${m.name} (fabric: ${m.actualFabric})`).join('\n• ')}`;
          } else {
            td.title = 'Click for details - Invalid: Zone contains members that do not belong to the zone\'s fabric';
          }
        } else {
          // Green checkmark for valid zones
          td.innerHTML = '<span style="color: #059669; font-weight: bold; font-size: 18px;">✓</span>';
          td.style.backgroundColor = '#f0fdf4';
          
          // Show count of valid members
          const validMembers = [];
          const totalMemberColumns = memberColumnsInfo.totalMemberColumns || 10;
          
          for (let i = 1; i <= totalMemberColumns; i++) {
            const memberName = rowData[`member_${i}`];
            if (memberName) {
              validMembers.push(memberName);
            }
          }
          
          if (validMembers.length > 0) {
            td.title = `Valid: All ${validMembers.length} members belong to fabric "${zoneFabric}":\n• ${validMembers.join('\n• ')}`;
          } else {
            td.title = 'Valid: Zone has no members or no fabric conflicts';
          }
        }
        return td;
      },
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

    // Simple member column renderers (no complex styling)
    const totalMemberColumns = memberColumnsInfo.totalMemberColumns || 10;
    for (let i = 1; i <= totalMemberColumns; i++) {
      const columnKey = `member_${i}`;
      renderers[columnKey] = (instance, td, row, _col, _prop, value) => {
        td.innerText = value || '';
        return td;
      };
    }

    return renderers;
  }, [memberColumnsInfo.totalMemberColumns, memberOptions, validateMemberFabric]);

  // Simplified cell configuration for member dropdowns
  const getCellsConfig = useMemo(() => {
    // Group aliases by fabric only (no use type filtering)
    const fabricAliasMap = new Map();
    memberOptions.forEach(alias => {
      const fabric = alias.fabric;
      if (!fabricAliasMap.has(fabric)) {
        fabricAliasMap.set(fabric, []);
      }
      fabricAliasMap.get(fabric).push(alias);
    });

    const aliasMaxZones = settings?.alias_max_zones || 1;
    
    // Smart cache that invalidates when table data changes
    const dropdownCache = new Map();
    let usedAliasesCache = null;
    let lastDataLength = 0;

    return (hot, row, col, prop) => {
      const memberColumnStartIndex = visibleBaseIndices.length;
      if (col >= memberColumnStartIndex && typeof prop === "string" && prop.startsWith("member_")) {
        const rowData = hot.getSourceDataAtRow(row);
        if (!rowData) return {};

        const rowFabric = rowData.fabric_details?.name || rowData.fabric;
        const currentValue = rowData[prop];
        
        // Lightweight cache with periodic refresh
        const cacheKey = `${rowFabric}-${currentValue || 'empty'}`;
        
        // Check cache but refresh every few calls to catch changes
        const now = Date.now();
        const cached = dropdownCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 1000)) { // 1 second cache
          return cached.data;
        }

        // Get all aliases for this fabric (no type filtering)
        const fabricAliases = fabricAliasMap.get(rowFabric) || [];
        
        // Calculate used aliases fresh each time (but cache the dropdown result)
        const sourceData = hot.getSourceData();
        const usedAliases = new Set();
        const totalColumns = memberColumnsInfo.totalMemberColumns || 10;
        
        for (let idx = 0; idx < sourceData.length; idx++) {
          const data = sourceData[idx];
          if (data) {
            for (let i = 1; i <= totalColumns; i++) {
              const val = data[`member_${i}`];
              if (val) usedAliases.add(val);
            }
          }
        }
        
        // Allow current value to be selected
        if (currentValue) {
          usedAliases.delete(currentValue);
        }
        
        // Debug logging to see what's happening
        if (usedAliases.size > 0) {
          console.log(`🔍 Cell ${prop}: usedAliases=${Array.from(usedAliases).slice(0,5).join(',')}, currentValue="${currentValue}"`);
        }

        // Filter available aliases
        const availableAliases = fabricAliases.filter((alias) => {
          const includeInZoning = alias.include_in_zoning === true;
          const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;
          const isCurrentValue = alias.name === currentValue;
          
          // For editing: prevent duplicates within the current table session
          // Only allow alias if it's not used elsewhere in the table OR it's the current value
          const notUsedInCurrentTable = !usedAliases.has(alias.name) || isCurrentValue;
          
          // Zone count check: alias must have room for more zones OR be the current value
          const zoneCountCheck = hasRoomForMoreZones || isCurrentValue;

          return includeInZoning && notUsedInCurrentTable && zoneCountCheck;
        });

        // Debug logging removed for performance

        // Sort aliases by name for consistent ordering
        availableAliases.sort((a, b) => a.name.localeCompare(b.name));
        const dropdownOptions = availableAliases.map(alias => alias.name);
        
        // Ensure consistent maximum size to prevent layout shifts
        if (dropdownOptions.length > 50) {
          dropdownOptions.splice(50); // Limit to 50 options max
        }
        
        // Add placeholder if no options available (but don't interfere with logic)
        if (dropdownOptions.length === 0) {
          dropdownOptions.push('(No available aliases)');
        }

        const cellConfig = {
          type: "dropdown",
          source: dropdownOptions,
          allowInvalid: false,
          strict: true,
          // Prevent table jumping by stabilizing dropdown behavior
          visibleRows: 10,
          trimDropdown: false,
          // Prevent placeholder selection
          validator: function(value, callback) {
            if (value === '(No available aliases)') {
              callback(false);
            } else {
              callback(true);
            }
          }
        };

        // Cache the result with timestamp
        dropdownCache.set(cacheKey, {
          data: cellConfig,
          timestamp: Date.now()
        });
        return cellConfig;
      }

      return {};
    };
  }, [memberOptions, visibleBaseIndices.length, memberColumnsInfo.totalMemberColumns, settings?.alias_max_zones]);

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
          colConfig.data === "member_count" ||
          colConfig.data === "zone_status"
        ) {
          column.readOnly = true;
          // Center align status column
          if (colConfig.data === "zone_status") {
            column.className = "htCenter";
          }
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

  // Simplified handler for adding member columns
  const handleAddColumn = useCallback(() => {
    setMemberColumnRequirements(prev => ({
      ...prev,
      memberColumns: prev.memberColumns + 1
    }));
  }, []);

  const additionalButtonsConfig = useMemo(() => [
    {
      text: "Generate Zone Creation Scripts",
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
              .then(() => navigate("/san/zones/zone-creation-scripts"));
          }
        } else {
          navigate("/san/zones/zone-creation-scripts");
        }
      },
    },
    {
      text: "Generate Deletion Scripts",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      ),
      onClick: () => {
        if (tableRef.current?.isDirty) {
          if (
            window.confirm(
              "You have unsaved changes. Save before generating deletion scripts?"
            )
          ) {
            tableRef.current
              .refreshData()
              .then(() => navigate("/san/zones/zone-deletion-scripts"));
          }
        } else {
          navigate("/san/zones/zone-deletion-scripts");
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

          // Debug: log alias details
          console.log(`🔍 Loaded ${processedAliases.length} aliases for dropdown:`, processedAliases.map(a => ({
            name: a.name,
            fabric: a.fabric,
            include_in_zoning: a.include_in_zoning,
            use: a.use
          })));

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
        defaultPageSize={'All'}
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
          <button
            className="modern-btn modern-btn-secondary"
            onClick={handleAddColumn}
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
            Add Member Column
          </button>
        }
        additionalButtons={additionalButtonsConfig}
        columnSorting={true}
        filters={true}
      />
      
      {/* Fabric Validation Modal */}
      {showValidationModal && validationModalData && (
        <div 
          className="modal fade show d-block" 
          style={{backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999}}
          onClick={() => setShowValidationModal(false)}
        >
          <div 
            className="modal-dialog modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <span className="me-2">⚠️</span>
                  Zone Fabric Validation Issues
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowValidationModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <h6 className="text-primary">Zone Details</h6>
                  <div className="bg-light p-3 rounded">
                    <strong>Zone Name:</strong> {validationModalData.zoneName}<br/>
                    <strong>Expected Fabric:</strong> <span className="badge bg-primary">{validationModalData.zoneFabric}</span>
                  </div>
                </div>
                
                {validationModalData.invalidMembers.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-danger">
                      <span className="me-2">❌</span>
                      Invalid Members ({validationModalData.invalidMembers.length})
                    </h6>
                    <div className="alert alert-danger">
                      <p className="mb-2">
                        <strong>These members belong to different fabrics and need to be fixed:</strong>
                      </p>
                      <ul className="mb-0">
                        {validationModalData.invalidMembers.map((member, index) => (
                          <li key={index} className="mb-1">
                            <code className="bg-white text-danger p-1 rounded">{member.name}</code>
                            <span className="ms-2">→ belongs to fabric</span>
                            <span className="badge bg-warning text-dark ms-1">{member.actualFabric}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {validationModalData.validMembers.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-success">
                      <span className="me-2">✅</span>
                      Valid Members ({validationModalData.validMembers.length})
                    </h6>
                    <div className="alert alert-success">
                      <p className="mb-2">
                        <strong>These members correctly belong to fabric "{validationModalData.zoneFabric}":</strong>
                      </p>
                      <div className="d-flex flex-wrap gap-1">
                        {validationModalData.validMembers.map((member, index) => (
                          <span key={index} className="badge bg-success">{member}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="alert alert-info">
                  <h6 className="text-info mb-2">
                    <span className="me-2">💡</span>
                    How to Fix
                  </h6>
                  <ul className="mb-0">
                    <li>Change the zone's fabric to match the members' fabric, OR</li>
                    <li>Remove invalid members and replace with aliases from the correct fabric, OR</li>
                    <li>Move the invalid aliases to the correct fabric in the Alias Table</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowValidationModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneTable;
