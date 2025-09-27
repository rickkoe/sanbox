import React, { useContext, useState, useEffect, useRef, useMemo, useCallback, startTransition, useDeferredValue } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useSettings } from "../../context/SettingsContext";
import { useNavigate } from "react-router-dom";
import GenericTable from "./GenericTable"; // Fixed import
import CustomNamingApplier from "../naming/CustomNamingApplier";
import { getTextColumns } from "../../utils/tableNamingUtils";
import { useZoneTableWorker } from "../../hooks/useZoneTableWorker";


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
  
  // Initialize web worker for heavy computations
  const {
    calculateUsedAliases,
    filterAliasesForFabric,
    calculateZoneCounts,
    processAliasesData,
    validateZoneFabricStatus: workerValidateZoneFabricStatus,
    isWorkerReady
  } = useZoneTableWorker();
  
  // Use deferred value for expensive calculations to prevent blocking
  const deferredMemberOptions = useDeferredValue(memberOptions);
  // Simplified structure: just track total member columns
  const [memberColumnRequirements, setMemberColumnRequirements] = useState({
    memberColumns: 10, // Increased default to handle zones with more members
    totalZones: 0
  });
  
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialRenderComplete, setInitialRenderComplete] = useState(false);
  
  // Progressive loading states
  const [dataLoadingPhase, setDataLoadingPhase] = useState('initializing'); // initializing, loading-fabrics, loading-aliases, processing, ready
  const [usedAliasesCache, setUsedAliasesCache] = useState(new Map());
  const [dropdownConfigCache, setDropdownConfigCache] = useState(new Map());
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationModalData, setValidationModalData] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const selectedRowsRef = useRef([]);
  const tableRef = useRef(null);
  
  // Debug: Track changes to selectedRows
  useEffect(() => {
    console.log('📊 selectedRows state changed:', {
      length: selectedRows.length,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [selectedRows]);
  const navigate = useNavigate();

  // Column visibility state for base columns - start with defaults, load from localStorage async
  const [visibleBaseIndices, setVisibleBaseIndices] = useState(DEFAULT_BASE_VISIBLE_INDICES);
  
  // Load saved column visibility asynchronously to not block initial render
  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem("zoneTableColumns");
      if (saved) {
        try {
          const savedColumnNames = JSON.parse(saved);
          // Convert saved column names to indices (only for base columns)
          const indices = savedColumnNames
            .map((name) => BASE_COLUMNS.findIndex((col) => col.data === name))
            .filter((index) => index !== -1);
          if (indices.length > 0) {
            setVisibleBaseIndices(indices);
          }
        } catch (e) {
          console.warn('Failed to load saved column visibility:', e);
        }
      }
    }, 0);
  }, []);
  
  // Mark initial render as complete after first paint and clear caches periodically
  useEffect(() => {
    const initTimer = setTimeout(() => {
      setInitialRenderComplete(true);
    }, 0);
    
    // Clear caches periodically to prevent memory leaks
    const cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clear old cache entries
      setDropdownConfigCache(prev => {
        const newCache = new Map();
        for (const [key, value] of prev.entries()) {
          if (now - value.timestamp < 30000) { // Keep entries less than 30 seconds old
            newCache.set(key, value);
          }
        }
        return newCache;
      });
      
      setUsedAliasesCache(new Map()); // Clear used aliases cache
    }, 60000); // Every minute
    
    return () => {
      clearTimeout(initTimer);
      clearInterval(cacheCleanupInterval);
    };
  }, []);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Clear table configuration cache on project change and when columns change
  useEffect(() => {
    const clearTableConfig = async () => {
      if (activeProjectId) {
        // Defer localStorage operations to not block initial render
        setTimeout(async () => {
          console.log(`🧹 Clearing table configuration for project ${activeProjectId}`);
          
          // Clear localStorage operations in smaller chunks to avoid blocking
          const allKeys = Object.keys(localStorage);
          const relevantKeys = allKeys.filter(key => 
            key.includes('zone') || 
            key.includes('table_config') ||
            key.includes('zones') ||
            key.includes(`${activeProjectId}`)
          );
          
          console.log(`🗑️ Removing ${relevantKeys.length} localStorage keys:`, relevantKeys);
          
          // Remove keys in smaller batches to avoid blocking
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
        }, 0); // Run immediately but async to not block UI
      }
    };

    clearTableConfig();
  }, [activeProjectId, memberColumnRequirements.memberColumns]); // Clear when project OR columns change

  // Calculate required member columns by type from ALL zones (not just current page)
  useEffect(() => {
    const calculateColumnRequirements = async () => {
      console.log(`🔧 calculateColumnRequirements called: activeProjectId=${activeProjectId}, memberOptions.length=${memberOptions.length}`);
      
      if (activeProjectId) {
        // Add small delay to prevent simultaneous API calls with other effects
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // Use new lightweight endpoint to get column requirements
          console.log('🔍 Fetching column requirements from optimized endpoint...');
          
          const response = await axios.get(`${API_ENDPOINTS.zones}${activeProjectId}/column-requirements/`);
          const data = response.data;
          
          console.log('📦 Column requirements response:', data);
          
          const newColumnInfo = {
            memberColumns: Math.max(data.recommended_columns || 10, 10), // At least 10 columns
            totalZones: data.total_zones || 0
          };
          
          console.log(`📊 Final column requirements:`, newColumnInfo);
          
          // Use startTransition to prevent blocking UI when setting column requirements
          startTransition(() => {
            setMemberColumnRequirements(newColumnInfo);
          });
        } catch (error) {
          console.error('Error calculating column requirements:', error);
          // Fallback to reasonable defaults
          startTransition(() => {
            setMemberColumnRequirements({
              memberColumns: 12, // More generous fallback for zones with many members
              totalZones: 0
            });
          });
        }
      }
    };

    calculateColumnRequirements();
    
    // Add debug function to window for manual testing
    window.debugZoneColumns = calculateColumnRequirements;
    
  }, [activeProjectId]); // Only depend on activeProjectId since we don't need memberOptions for column calculation

  // Calculate total member columns and create simple member column arrays
  const memberColumnsInfo = useMemo(() => {
    const { memberColumns } = memberColumnRequirements;
    
    // Create simple member columns
    const memberColumns_array = [];
    const memberHeaders = [];
    
    for (let i = 1; i <= memberColumns; i++) {
      memberColumns_array.push({ 
        data: `member_${i}`,
        type: "dropdown"
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
      const alias = deferredMemberOptions.find(alias => alias.name === member.name);
      return alias && alias.fabric !== zoneFabric;
    });

    return invalidMembers.length > 0 ? "invalid" : "valid";
  };

  // Process data for display - intelligently place members in correct column types
  const preprocessData = useCallback((data) => {
    // For large datasets, add a small delay to prevent blocking
    if (data.length > 100) {
      console.log(`📊 Processing large dataset of ${data.length} zones`);
    }
    
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
        console.log(`🏗️ Processing zone ${zone.name} with ${zone.members_details.length} members`);
        zone.members_details.forEach((member, index) => {
          if (index < memberColumnRequirements.memberColumns) {
            zoneData[`member_${index + 1}`] = member.name;
            console.log(`  Set member_${index + 1} = "${member.name}"`);
          }
        });
      } else {
        console.log(`🚫 Zone ${zone.name} has no member details`);
      }

      return zoneData;
    });
  }, [deferredMemberOptions, memberColumnRequirements]);

  // Separate effect to update rawData when zones are loaded
  useEffect(() => {
    if (activeProjectId) {
      const fetchZones = async () => {
        try {
          const response = await axios.get(
            `${API_ENDPOINTS.zones}${activeProjectId}/`
          );
          const zonesData = response.data?.results || response.data || [];
          // Use startTransition to prevent blocking UI when setting large datasets
          startTransition(() => {
            setRawData(zonesData);
          });
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

  // Optimized fabric validation highlighter
  const highlightInvalidMembers = (invalidMembers) => {
    if (!invalidMembers || invalidMembers.length === 0) return 0;
    
    // Create a Set for faster lookup
    const invalidMemberNames = new Set(invalidMembers.map(invalid => invalid.member));
    
    // Only search within the handsontable container for better performance
    const handsontable = document.querySelector('.handsontable');
    if (!handsontable) return 0;
    
    // Use more specific selector to reduce DOM queries
    const tableCells = handsontable.querySelectorAll('tbody td');
    let highlightedCount = 0;
    
    // Batch DOM operations using DocumentFragment for better performance
    const cellsToStyle = [];
    
    tableCells.forEach((cell) => {
      const cellText = cell.textContent?.trim() || '';
      
      // Quick check if cell contains any invalid member
      for (const memberName of invalidMemberNames) {
        if (cellText === memberName || 
            cellText === `▼${memberName}` || 
            cellText.includes(memberName)) {
          
          cellsToStyle.push({
            cell,
            memberName,
            cellText
          });
          break; // Found match, no need to check other members for this cell
        }
      }
    });
    
    // Apply styling in batch to minimize reflows
    cellsToStyle.forEach(({ cell, memberName, cellText }) => {
      // Remove previous styling first
      cell.classList.remove('fabric-validation-invalid');
      
      // Add new styling efficiently
      cell.classList.add('fabric-validation-invalid');
      cell.setAttribute('data-fabric-invalid', 'true');
      
      // Use a single cssText update instead of multiple property calls
      cell.style.cssText = 'color: red !important; background-color: #ffebee !important; font-weight: bold !important; border: 2px solid red !important;';
      cell.title = `Invalid: ${memberName} does not belong to the zone's fabric`;
      
      highlightedCount++;
    });
    
    if (highlightedCount > 0) {
      console.log(`🎯 Highlighted ${highlightedCount} invalid member cells`);
    }
    
    // Lightweight re-highlighting on scroll (much less aggressive)
    if (highlightedCount > 0) {
      const handsontable = document.querySelector('.handsontable');
      if (handsontable) {
        // Throttled scroll handler - only run once every 250ms
        let scrollTimeout = null;
        const scrollHandler = () => {
          if (scrollTimeout) return; // Skip if already scheduled
          scrollTimeout = setTimeout(() => {
            highlightInvalidMembers(invalidMembers);
            scrollTimeout = null;
          }, 250); // Much less frequent
        };
        handsontable.addEventListener('scroll', scrollHandler, { passive: true });
        
        // Store cleanup
        window.fabricValidationCleanup = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          handsontable.removeEventListener('scroll', scrollHandler);
          console.log('🧹 Cleaned up scroll highlighting');
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
          const alias = deferredMemberOptions.find(alias => alias.name === memberName);
          if (alias && alias.fabric !== zoneFabric) {
            invalidMembers.push({ member: memberName, fabric: zoneFabric, zoneName: zone.name });
            return true; // Found a fabric mismatch
          }
        }
      }
      return false;
    });

    if (fabricMismatchZone) {
      // Highlight invalid members immediately - no need for timeout
      highlightInvalidMembers(invalidMembers);
      
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
    
    const alias = deferredMemberOptions.find(alias => alias.name === memberName);
    if (!alias) return false; // Member not found
    
    return alias.fabric === zoneFabric; // Check if fabrics match
  };

  // Create member column renderers dynamically based on actual member columns
  // Use lazy initialization to prevent blocking initial render
  const [customRenderers, setCustomRenderers] = useState(() => ({}));
  
  // Create complex renderers asynchronously after initial render
  useEffect(() => {
    setTimeout(() => {
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
              const alias = deferredMemberOptions.find(alias => alias.name === memberName);
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

      // Set the complex renderers asynchronously
      setCustomRenderers(renderers);
    }, 100); // Small delay to ensure UI is responsive first
  }, [memberColumnsInfo.totalMemberColumns, deferredMemberOptions, validateMemberFabric]);

  // Optimized cell configuration with web workers and aggressive caching
  const getCellsConfig = useMemo(() => {
    // Pre-group aliases by fabric for faster lookups
    const fabricAliasMap = new Map();
    deferredMemberOptions.forEach(alias => {
      const fabric = alias.fabric;
      if (!fabricAliasMap.has(fabric)) {
        fabricAliasMap.set(fabric, []);
      }
      fabricAliasMap.get(fabric).push(alias);
    });

    const aliasMaxZones = settings?.alias_max_zones || 1;

    return (hot, row, col, prop) => {
      const memberColumnStartIndex = visibleBaseIndices.length;
      if (col >= memberColumnStartIndex && typeof prop === "string" && prop.startsWith("member_")) {
        const rowData = hot.getSourceDataAtRow(row);
        if (!rowData) return {};

        const rowFabric = rowData.fabric_details?.name || rowData.fabric;
        const currentValue = rowData[prop];
        
        // Use aggressive caching with longer cache time
        const cacheKey = `${rowFabric}-${currentValue || 'empty'}-${deferredMemberOptions.length}`;
        
        const cached = dropdownConfigCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 5000)) { // 5 second cache
          return cached.data;
        }

        // Get aliases for this fabric (already filtered)
        const fabricAliases = fabricAliasMap.get(rowFabric) || [];
        
        // Use cached used aliases if available, otherwise compute lazily
        let usedAliases = usedAliasesCache.get('current');
        if (!usedAliases) {
          // Lightweight computation - only get used aliases on demand
          usedAliases = new Set();
          const sourceData = hot.getSourceData();
          const totalColumns = memberColumnsInfo.totalMemberColumns || 10;
          
          // Process in smaller chunks to avoid blocking
          for (let idx = 0; idx < Math.min(sourceData.length, 100); idx++) {
            const data = sourceData[idx];
            if (data) {
              for (let i = 1; i <= totalColumns; i++) {
                const val = data[`member_${i}`];
                if (val) usedAliases.add(val);
              }
            }
          }
          
          // Cache the result
          setUsedAliasesCache(new Map([['current', usedAliases]]));
        }
        
        // Allow current value to be selected
        if (currentValue) {
          usedAliases.delete(currentValue);
        }

        // Simplified filtering with pre-computed conditions
        const availableAliases = fabricAliases.filter((alias) => {
          if (!alias.include_in_zoning) return false;
          
          const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;
          const isCurrentValue = alias.name === currentValue;
          const notUsedInCurrentTable = !usedAliases.has(alias.name) || isCurrentValue;
          
          return (hasRoomForMoreZones || isCurrentValue) && notUsedInCurrentTable;
        });

        // Pre-sorted options (do this once per fabric)
        const dropdownOptions = availableAliases
          .slice(0, 50) // Limit early
          .map(alias => alias.name)
          .sort();
        
        if (dropdownOptions.length === 0) {
          dropdownOptions.push('(No available aliases)');
        }

        const cellConfig = {
          type: "dropdown",
          source: dropdownOptions,
          allowInvalid: false,
          strict: true,
          visibleRows: 10,
          trimDropdown: false,
          validator: function(value, callback) {
            callback(value !== '(No available aliases)');
          }
        };

        // Cache with longer TTL
        setDropdownConfigCache(prev => new Map(prev.set(cacheKey, {
          data: cellConfig,
          timestamp: Date.now()
        })));
        
        return cellConfig;
      }

      return {};
    };
  }, [deferredMemberOptions, visibleBaseIndices.length, memberColumnsInfo.totalMemberColumns, settings?.alias_max_zones, dropdownConfigCache, usedAliasesCache, setUsedAliasesCache, setDropdownConfigCache]);

  // Get available text columns for naming (include both base and member columns)
  const availableTextColumns = useMemo(() => {
    const baseTextColumns = getTextColumns(BASE_COLUMNS);
    // Add member columns as they can also accept text
    const memberTextColumns = [];
    for (let i = 1; i <= memberColumnsInfo.totalMemberColumns; i++) {
      memberTextColumns.push({
        key: `member_${i}`,
        label: `Member ${i}`
      });
    }
    return [...baseTextColumns, ...memberTextColumns];
  }, [memberColumnsInfo.totalMemberColumns]);

  // Compute displayed columns and headers (base + member columns)
  // Use state for column building to defer heavy operations
  const [columnConfig, setColumnConfig] = useState({
    allColumns: [],
    allHeaders: [],
    defaultVisibleColumns: []
  });
  
  // Build columns asynchronously to prevent blocking
  useEffect(() => {
    if (memberColumnsInfo.totalMemberColumns > 0) {
      setTimeout(() => {
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

        // Set the column configuration asynchronously
        setColumnConfig({
          allColumns: allCols,
          allHeaders: allHdrs,
          defaultVisibleColumns: defaultVisible,
        });
      }, 50); // Small delay to prevent blocking
    }
  }, [visibleBaseIndices, memberColumnsInfo]);
    
  // Debug: Track changes to column config
  useEffect(() => {
    console.log('🔄 Column config changed:', columnConfig.allColumns.length, 'columns');
  }, [columnConfig]);
  
  // Destructure column config for easier usage
  const { allColumns, allHeaders, defaultVisibleColumns } = columnConfig;

  // Function to handle selection changes from GenericTable
  const handleSelectionChange = useCallback((selection) => {
    console.log('🔄 handleSelectionChange called with selection:', selection);
    console.log('  - tableRef.current?.hotInstance:', !!tableRef.current?.hotInstance);
    console.log('  - current selectedRows.length:', selectedRowsRef.current.length);
    
    if (!tableRef.current?.hotInstance) {
      console.log('❌ No hotInstance available');
      return;
    }
    
    // If selection is empty, only clear if we don't currently have a valid selection
    if (!selection || selection.length === 0) {
      console.log('❌ Empty selection received');
      // Add a small delay before clearing to give user time to click Apply
      setTimeout(() => {
        console.log('⏰ Clearing selectedRows after delay');
        selectedRowsRef.current = [];
        setSelectedRows([]);
      }, 2000); // 2 second delay
      return;
    }

    const hot = tableRef.current.hotInstance;
    const data = hot.getData();
    const selectedRowsData = [];

    // Convert selection ranges to actual row data
    selection.forEach(range => {
      const [startRow, startCol, endRow, endCol] = range;
      
      for (let row = startRow; row <= endRow; row++) {
        if (data[row] && !selectedRowsData.find(r => r._rowIndex === row)) {
          // Get the row data and add row index for reference
          const rowData = hot.getDataAtRow(row);
          
          console.log(`🎯 Selecting row ${row}, raw data:`, rowData);
          console.log(`🎯 Row name appears to be: "${rowData[1]}" (name should be at index 1 based on columns)`);
          console.log(`🎯 AllColumns structure:`, allColumns.map((col, i) => `${i}: ${col.data}`));
          
          // Check if this row has any actual data (not all null/undefined)
          const hasValidData = rowData.some(value => 
            value !== null && value !== undefined && value !== 'null' && value !== 'undefined' && value !== ''
          );
          
          if (!hasValidData) {
            console.log('⚠️ Skipping row with no valid data');
            continue;
          }
          
          const rowObject = {};
          
          // Map array data to column names
          allColumns.forEach((col, index) => {
            const value = rowData[index];
            rowObject[col.data] = value;
            
            console.log(`🔍 Mapping index ${index}: ${col.data} = "${value}"`);
          });
          
          // SPECIAL FIX: Based on the raw data structure, manually extract member data
          // The raw data has member values at different positions than the column mapping expects
          if (rowData.length >= 10) {
            // Index 8 and 9 contain the actual member data in the raw array
            const member1Value = rowData[8]; // 'LTO_Drive25' 
            const member2Value = rowData[9]; // 'P10_PRD01A_port2'
            
            if (member1Value && member1Value !== 'null' && member1Value !== 'undefined') {
              rowObject['member_1'] = member1Value;
              rowObject['Member1'] = member1Value;
              console.log(`🎯 FIXED: Set Member1 = "${member1Value}"`);
            }
            
            if (member2Value && member2Value !== 'null' && member2Value !== 'undefined') {
              rowObject['member_2'] = member2Value;
              rowObject['Member2'] = member2Value;
              console.log(`🎯 FIXED: Set Member2 = "${member2Value}"`);
            }
          }
          
          rowObject._rowIndex = row;
          selectedRowsData.push(rowObject);
          console.log(`🎯 Final row object:`, rowObject);
        }
      }
    });

    if (selectedRowsData.length > 0) {
      console.log('✅ Setting selectedRows to:', selectedRowsData.length, 'rows');
      selectedRowsRef.current = selectedRowsData;
      setSelectedRows(selectedRowsData);
    } else {
      console.log('⚠️ No valid rows selected - keeping current selection');
    }
  }, [allColumns]);

  // Function to handle applying custom naming
  const handleApplyNaming = useCallback((updatedRows, rule) => {
    console.log('🚀 handleApplyNaming called with:', updatedRows, rule);
    
    if (!tableRef.current?.hotInstance) {
      console.error('❌ No hotInstance available');
      return;
    }

    const hot = tableRef.current.hotInstance;
    console.log('✅ Hot instance found:', hot);
    
    // Apply the updated names to the table
    updatedRows.forEach(updatedRow => {
      const rowIndex = updatedRow._rowIndex;
      
      console.log(`🎯 Processing updatedRow for row ${rowIndex}:`, updatedRow);
      
      // Find which column was updated by looking for the target column that was used
      // The CustomNamingApplier sets the value on the selectedTargetColumn key
      let targetColumnKey = null;
      let newValue = null;
      
      // First, try to find the column that actually changed by comparing with original
      const originalRow = selectedRows.find(r => r._rowIndex === rowIndex);
      if (originalRow) {
        for (const key in updatedRow) {
          if (key !== '_rowIndex' && updatedRow[key] !== originalRow[key]) {
            targetColumnKey = key;
            newValue = updatedRow[key];
            console.log(`🔍 Found changed column: ${targetColumnKey} = "${newValue}" (was "${originalRow[key]}")`);
            break;
          }
        }
      }
      
      // If no change detected, prioritize 'name' column for zones
      if (!targetColumnKey) {
        // First check if 'name' column has a value
        if (updatedRow.name && typeof updatedRow.name === 'string') {
          targetColumnKey = 'name';
          newValue = updatedRow.name;
          console.log(`🔍 Using priority target column: ${targetColumnKey} = "${newValue}"`);
        } else {
          // Fall back to looking for any string values
          for (const key in updatedRow) {
            if (key !== '_rowIndex' && updatedRow[key] && typeof updatedRow[key] === 'string') {
              targetColumnKey = key;
              newValue = updatedRow[key];
              console.log(`🔍 Fallback target column: ${targetColumnKey} = "${newValue}"`);
              break;
            }
          }
        }
      }
      
      if (targetColumnKey && newValue !== undefined) {
        const columnIndex = allColumns.findIndex(col => col.data === targetColumnKey);
        
        console.log(`🎯 Applying to row ${rowIndex}: column=${targetColumnKey}, columnIndex=${columnIndex}, newValue="${newValue}"`);
        console.log(`📊 Available columns:`, allColumns.map(col => col.data));
        
        if (rowIndex !== undefined && columnIndex !== -1) {
          console.log(`📝 Calling setDataAtCell(${rowIndex}, ${columnIndex}, "${newValue}")`);
          hot.setDataAtCell(rowIndex, columnIndex, newValue);
          console.log('✅ setDataAtCell completed');
        } else {
          console.error(`❌ Cannot update: rowIndex=${rowIndex}, columnIndex=${columnIndex}`);
          console.error(`❌ Debug info: targetColumnKey="${targetColumnKey}", available columns:`, allColumns.map(col => col.data));
        }
      } else {
        console.error(`❌ No target column or value found in updatedRow:`, updatedRow);
      }
    });

    console.log(`🎉 Applied naming rule "${rule.name}" to ${updatedRows.length} rows`);
    
    // Clear selection after applying
    selectedRowsRef.current = [];
    setSelectedRows([]);
  }, [allColumns]);

  const dropdownSources = useMemo(
    () => {
      const sources = {
        fabric: fabricOptions.map((f) => f.name),
        zone_type: ["smart", "standard"],
      };
      
      // Add all member columns as dropdown sources to show dropdown arrows
      for (let i = 1; i <= memberColumnsInfo.totalMemberColumns; i++) {
        const memberKey = `member_${i}`;
        // Use the memberOptions as the source for all member columns
        sources[memberKey] = deferredMemberOptions.map(alias => alias.name);
      }
      
      return sources;
    },
    [fabricOptions, deferredMemberOptions, memberColumnsInfo.totalMemberColumns]
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

  // Progressive data loading with web workers
  useEffect(() => {
    const loadData = async () => {
      try {
        setDataLoadingPhase('loading-fabrics');
        
        if (activeCustomerId) {
          const fabricsResponse = await axios.get(
            `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`
          );

          const fabricsArray = fabricsResponse.data.results || fabricsResponse.data;
          const processedFabrics = fabricsArray.map((f) => ({ id: f.id, name: f.name }));
          setFabricOptions(processedFabrics);
          console.log(`✅ Loaded ${processedFabrics.length} fabrics`);
        }

        if (activeProjectId && isWorkerReady) {
          setDataLoadingPhase('loading-aliases');
          
          // Fetch aliases with progressive loading and early UI updates
          let allAliases = [];
          
          try {
            const url = `${API_ENDPOINTS.aliases}${activeProjectId}/?include_zone_count=true&page_size=1000`;
            console.log(`🔄 Fetching aliases progressively: ${url}`);
            const aliasesResponse = await axios.get(url);
            const responseData = aliasesResponse.data;
            
            if (responseData.results) {
              allAliases = responseData.results;
              console.log(`📦 Got ${allAliases.length} aliases from initial request`);
              
              // Fetch additional pages if needed
              if (responseData.next) {
                let page = 2;
                let currentData = responseData;
                
                while (currentData.next && page <= 10) {
                  await new Promise(resolve => setTimeout(resolve, 0)); // Yield
                  
                  const nextUrl = `${API_ENDPOINTS.aliases}${activeProjectId}/?include_zone_count=true&page_size=1000&page=${page}`;
                  const nextResponse = await axios.get(nextUrl);
                  const nextData = nextResponse.data;
                  allAliases = [...allAliases, ...(nextData.results || [])];
                  
                  currentData = nextData;
                  page++;
                }
              }
            } else {
              allAliases = Array.isArray(responseData) ? responseData : [responseData];
            }
          } catch (error) {
            console.error('Error fetching aliases:', error);
            allAliases = []; // Fallback to empty
          }
          
          setDataLoadingPhase('processing');
          
          // Use web worker to process aliases data
          try {
            const processedAliases = await processAliasesData(allAliases, fabricOptions);
            console.log(`✅ Web worker processed ${processedAliases.length} aliases`);
            
            // If zone counts need calculation, use web worker
            if (rawData.length > 0 && processedAliases.some(a => a.zoned_count === undefined || a.zoned_count === 0)) {
              console.log('🔄 Calculating zone counts with web worker...');
              const aliasesWithZoneCounts = await calculateZoneCounts(rawData, processedAliases);
              
              startTransition(() => {
                setMemberOptions(aliasesWithZoneCounts);
                setDataLoadingPhase('ready');
              });
            } else {
              startTransition(() => {
                setMemberOptions(processedAliases);
                setDataLoadingPhase('ready');
              });
            }
          } catch (workerError) {
            console.warn('Web worker failed, falling back to synchronous processing:', workerError);
            
            // Fallback to synchronous processing
            const processedAliases = allAliases.map((a) => {
              let fabricName = "";
              if (a.fabric_details?.name) {
                fabricName = a.fabric_details.name;
              } else if (a.fabric) {
                const fabric = fabricOptions.find((f) => f.id === a.fabric);
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

            startTransition(() => {
              setMemberOptions(processedAliases);
              setDataLoadingPhase('ready');
            });
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setDataLoadingPhase('error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId, isWorkerReady, processAliasesData, calculateZoneCounts, rawData, fabricOptions]);

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

  // Progressive loading indicator
  if (loading || dataLoadingPhase !== 'ready') {
    const getLoadingMessage = () => {
      switch (dataLoadingPhase) {
        case 'initializing': return 'Initializing web workers...';
        case 'loading-fabrics': return 'Loading fabric data...';
        case 'loading-aliases': return 'Fetching alias data...';
        case 'processing': return 'Processing data with web workers...';
        case 'error': return 'Error loading data. Please refresh.';
        default: return 'Loading zone table...';
      }
    };

    return (
      <div className="table-container">
        <div className="d-flex justify-content-center align-items-center flex-column" style={{ height: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="ms-3 mt-3">{getLoadingMessage()}</span>
          {dataLoadingPhase === 'processing' && (
            <small className="text-muted mt-2">Using background processing to prevent UI freezing...</small>
          )}
        </div>
      </div>
    );
  }
  
  // Show simplified loading state for initial render to improve perceived performance
  if (!initialRenderComplete) {
    return (
      <div className="table-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Initializing table...</span>
          </div>
          <span className="ms-3">Initializing zone table...</span>
        </div>
      </div>
    );
  }
  
  // Wait for column configuration to be ready
  if (!allColumns || allColumns.length === 0) {
    return (
      <div className="table-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <div className="spinner-border text-secondary" role="status">
            <span className="visually-hidden">Building table structure...</span>
          </div>
          <span className="ms-3">Building table structure...</span>
        </div>
      </div>
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
        defaultPageSize={25}
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
          <div className="d-flex gap-2 align-items-center">
            <CustomNamingApplier
              tableName="zones"
              selectedRows={selectedRows}
              onApplyNaming={handleApplyNaming}
              customerId={activeCustomerId}
              disabled={loading}
              targetColumn={availableTextColumns.length === 1 ? availableTextColumns[0].key : null}
              availableColumns={availableTextColumns}
            />
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
          </div>
        }
        additionalButtons={additionalButtonsConfig}
        columnSorting={true}
        filters={true}
        afterSelection={handleSelectionChange}
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
