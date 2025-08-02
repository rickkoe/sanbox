import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
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
  { data: "exists", title: "Exists" },
  { data: "zone_type", title: "Zone Type" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
  { data: "notes", title: "Notes" },
];

// Default visible base column indices (show all base columns by default)
const DEFAULT_BASE_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5];

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null,
  name: "",
  fabric: "",
  member_count: 0,
  create: false,
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
  const [memberColumns, setMemberColumns] = useState(5); // Minimum 5 columns
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // Column visibility state for base columns
  const [visibleBaseIndices, setVisibleBaseIndices] = useState(() => {
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

  // Fetch maximum member count from database on component load
  useEffect(() => {
    const fetchMaxMembers = async () => {
      if (activeProjectId) {
        try {
          console.log(`🔄 Fetching maximum member count from database for project ${activeProjectId}...`);
          const apiUrl = `${API_ENDPOINTS.zoneMaxMembers}${activeProjectId}/max-members/`;
          console.log(`🌐 API URL: ${apiUrl}`);
          
          const response = await axios.get(apiUrl);
          const maxMembers = response.data.max_members;
          const maxZoneName = response.data.max_zone_name;
          const totalZones = response.data.total_zones;
          
          console.log(`📊 Database results - Max members: ${maxMembers}, Zone: ${maxZoneName}, Total zones: ${totalZones}`);
          
          // Ensure minimum of 5 columns
          const initialColumns = Math.max(5, maxMembers);
          console.log(`🔧 Current memberColumns: ${memberColumns}, Required: ${initialColumns}`);
          
          // Clear any stored table configuration to ensure all member columns are visible by default
          const storageKeys = [
            `table_config_zones_${activeProjectId}`,
            `zone-table-${activeProjectId}-cols${memberColumns}`,
            `zone-table-${activeProjectId}-cols${initialColumns}`,
            'zoneTableColumns',
            'zoneTableColumnWidths'
          ];
          storageKeys.forEach(key => {
            console.log(`🗑️ Clearing stored configuration: ${key}`);
            localStorage.removeItem(key);
          });
          
          // Also clear any API-stored table configuration
          try {
            console.log(`🗑️ Clearing API table configuration for zones...`);
            await axios.delete(`${API_URL}/api/core/table-config/zones/`);
          } catch (error) {
            console.log("Note: Could not clear API table config (might not exist):", error.message);
          }
          
          if (initialColumns > memberColumns) {
            console.log(`🔧 Setting initial member columns to ${initialColumns} based on database max`);
            setMemberColumns(initialColumns);
            // Add a small delay to ensure state updates
            setTimeout(() => {
              console.log(`✅ Member columns after update: ${memberColumns} -> should be ${initialColumns}`);
            }, 100);
          } else {
            console.log(`ℹ️ Current member columns (${memberColumns}) already >= required (${initialColumns})`);
          }
        } catch (error) {
          console.error("Error fetching max member count:", error);
          // Fall back to minimum of 5 if API call fails
          if (memberColumns < 5) {
            setMemberColumns(5);
          }
        }
      } else {
        console.log("⚠️ No active project ID, skipping max member fetch");
      }
    };

    fetchMaxMembers();
  }, [activeProjectId]); // Only run when project changes

  // Calculate required member columns from current page data - but don't reduce from database max
  useEffect(() => {
    if (rawData.length > 0) {
      let maxMembersOnPage = 0;

      rawData.forEach((zone) => {
        if (zone.members_details?.length) {
          maxMembersOnPage = Math.max(maxMembersOnPage, zone.members_details.length);
        }
      });

      // Only increase member columns if current page has more than what we already have
      // Don't decrease if database max was higher than current page
      const requiredColumns = Math.max(5, maxMembersOnPage);
      if (requiredColumns > memberColumns) {
        console.log(
          `Increasing member columns from ${memberColumns} to ${requiredColumns} based on current page data`
        );
        setMemberColumns(requiredColumns);
      } else {
        console.log(
          `Current page max members: ${maxMembersOnPage}, keeping existing columns: ${memberColumns}`
        );
      }
    }
  }, [rawData]); // Remove memberColumns to prevent infinite loop

  // Helper function to build payload
  const buildPayload = (row) => {
    // Extract members
    const members = [];
    for (let i = 1; i <= memberColumns; i++) {
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
    for (let i = 1; i <= memberColumns; i++) delete payload[`member_${i}`];
    delete payload.saved;

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      members,
    };
  };

  // Process data for display - removed state update to fix React warning
  const preprocessData = (data) => {
    console.log("Processing data with", memberColumns, "member columns");

    const processed = data.map((zone) => {
      const memberCount = zone.members_details?.length || 0;
      const zoneData = {
        ...zone,
        fabric: zone.fabric_details?.name || zone.fabric,
        member_count: memberCount,
        saved: true,
      };

      if (zone.members_details?.length) {
        console.log(
          `Zone ${zone.name} has ${zone.members_details.length} members`
        );
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
    name: (instance, td, row, col, prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      td.innerHTML =
        rowData && rowData.id !== null && value
          ? `<strong>${value}</strong>`
          : value || "";
      return td;
    },
    member_count: (instance, td, row, col, prop, value) => {
      td.style.textAlign = 'center';
      td.innerText = value || "0";
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

  // Cell configuration for member dropdowns
  const getCellsConfig = (hot, row, col, prop) => {
    // Member columns start after the visible base columns
    const memberColumnStartIndex = visibleBaseIndices.length;
    if (col >= memberColumnStartIndex && typeof prop === "string" && prop.startsWith("member_")) {
      const rowData = hot.getSourceDataAtRow(row);
      if (!rowData) return {};

      const rowFabric = rowData.fabric_details?.name || rowData.fabric;
      const currentValue = rowData[prop];

      // Only log for the first member column to reduce spam
      // Debug logging removed for performance

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

      // Get alias_max_zones setting, default to 1 if not available
      const aliasMaxZones = settings?.alias_max_zones || 1;

      // Available aliases = matching fabric + include_in_zoning + not used elsewhere + zone count check
      const availableAliases = memberOptions.filter((alias) => {
        const fabricMatch = alias.fabric === rowFabric;
        const includeInZoning = alias.include_in_zoning === true;
        const notUsedElsewhere =
          !usedAliases.has(alias.name) || alias.name === currentValue;
        
        // Check if alias has room for more zones (zone count < max allowed)
        const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;

        // If this alias is already the current value, allow it regardless of zone count
        const isCurrentValue = alias.name === currentValue;

        const zoneCountCheck = hasRoomForMoreZones || isCurrentValue;

        // Removed excessive logging that was causing performance issues

        return fabricMatch && includeInZoning && notUsedElsewhere && zoneCountCheck;
      });

      const sourceArray = availableAliases.map((alias) => alias.name);

      return {
        type: "dropdown",
        source: sourceArray,
      };
    }
    return {};
  };

  // Compute displayed columns and headers (base + member columns)
  const { displayedColumns, displayedHeaders, allColumns, allHeaders, defaultVisibleColumns } =
    useMemo(() => {
      // Build ALL base columns (including hidden ones) for GenericTable to know about them
      const allBaseColumns = BASE_COLUMNS.map((colConfig) => {
        const column = { data: colConfig.data };

        // Add specific column configurations
        if (colConfig.data === "fabric" || colConfig.data === "zone_type") {
          column.type = "dropdown";
        } else if (colConfig.data === "create" || colConfig.data === "exists") {
          column.type = "checkbox";
        } else if (
          colConfig.data === "imported" ||
          colConfig.data === "updated" ||
          colConfig.data === "member_count"
        ) {
          column.readOnly = true;
        }

        return column;
      });

      // Build currently visible base columns for display
      const visibleBaseColumns = visibleBaseIndices.map((index) => allBaseColumns[index]);
      const visibleBaseHeaders = visibleBaseIndices.map((index) => BASE_COLUMNS[index].title);

      // Add member columns (always show all member columns)
      const memberColumns_array = Array.from(
        { length: memberColumns },
        (_, i) => ({ data: `member_${i + 1}` })
      );
      const memberHeaders = Array.from(
        { length: memberColumns },
        (_, i) => `Member ${i + 1}`
      );

      // ALL columns and headers (for GenericTable to know about all options)
      const allCols = [...allBaseColumns, ...memberColumns_array];
      const allHdrs = [...BASE_COLUMNS.map(col => col.title), ...memberHeaders];

      // Displayed columns/headers (base visible + member)
      const displayedCols = [...visibleBaseColumns, ...memberColumns_array];
      const displayedHdrs = [...visibleBaseHeaders, ...memberHeaders];

      // Default visible column indices - base visible indices + ALL member columns
      // All member columns are visible by default
      const defaultMemberColumns = memberColumns;
      const memberIndices = Array.from(
        { length: defaultMemberColumns },
        (_, i) => BASE_COLUMNS.length + i
      );
      const defaultVisible = [...visibleBaseIndices, ...memberIndices];

      console.log(`🔧 Column indices debug:
        - BASE_COLUMNS.length: ${BASE_COLUMNS.length}
        - memberColumns: ${memberColumns}
        - visibleBaseIndices: [${visibleBaseIndices.join(', ')}]
        - memberIndices: [${memberIndices.join(', ')}]
        - defaultVisible: [${defaultVisible.join(', ')}]
        - allColumns.length: ${allCols.length}
        - allHeaders.length: ${allHdrs.length}
        - memberHeaders: [${memberHeaders.join(', ')}]
        - memberColumns_array length: ${memberColumns_array.length}`);

      return {
        displayedColumns: displayedCols,
        displayedHeaders: displayedHdrs,
        allColumns: allCols,
        allHeaders: allHdrs,
        defaultVisibleColumns: defaultVisible,
      };
    }, [visibleBaseIndices, memberColumns]);

  const dropdownSources = useMemo(
    () => ({
      fabric: fabricOptions.map((f) => f.name),
      zone_type: ["smart", "standard"],
    }),
    [fabricOptions]
  );

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (activeCustomerId) {
          console.log("Loading fabrics for customer:", activeCustomerId);
          const fabricsResponse = await axios.get(
            `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}`
          );
          console.log("Fabrics response:", fabricsResponse.data);

          // Handle paginated response structure
          const fabricsArray =
            fabricsResponse.data.results || fabricsResponse.data;
          setFabricOptions(
            fabricsArray.map((f) => ({ id: f.id, name: f.name }))
          );
          console.log("Fabric options set:", fabricsArray.length, "fabrics");
        }

        if (activeProjectId) {
          console.log("Loading aliases for project:", activeProjectId);
          
          // Fetch all aliases by handling pagination
          // Add query parameter to ensure zoned_count is calculated
          let allAliases = [];
          let page = 1;
          const baseUrl = `${API_ENDPOINTS.aliases}${activeProjectId}/`;
          const queryParams = 'include_zone_count=true&page_size=100'; // Use larger page size for efficiency
          
          while (true) {
            const url = `${baseUrl}?${queryParams}&page=${page}`;
            console.log(`Fetching aliases page ${page}: ${url}`);
            
            const aliasesResponse = await axios.get(url);
            // Pagination response logged for debugging if needed
            
            const responseData = aliasesResponse.data;
            const aliasesArray = responseData.results || responseData;
            
            if (Array.isArray(aliasesArray)) {
              allAliases = [...allAliases, ...aliasesArray];
              // Loaded aliases from page (logging reduced for performance)
              
              // Check if there are more pages
              if (aliasesArray.length === 0 || !responseData.next) {
                console.log(`No more pages. Final total: ${allAliases.length} aliases`);
                break;
              }
              page++;
            } else {
              // Handle non-paginated response
              allAliases = Array.isArray(responseData) ? responseData : [responseData];
              console.log(`Non-paginated response, loaded ${allAliases.length} aliases`);
              break;
            }
          }
          
          console.log(`Total aliases loaded: ${allAliases.length}`);
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

            const processedAlias = {
              id: a.id,
              name: a.name,
              fabric: fabricName,
              include_in_zoning: a.include_in_zoning,
              zoned_count: a.zoned_count || 0,
            };

            console.log(
              `Alias ${a.name}: fabric ID ${a.fabric} -> fabric name "${fabricName}", include_in_zoning: ${a.include_in_zoning}, zoned_count: ${a.zoned_count || 0}`,
              a.zoned_count === undefined ? '(zoned_count field missing from API)' : ''
            );
            return processedAlias;
          });

          // If zoned_count is not provided by API, calculate it from existing zones
          if (processedAliases.length > 0 && processedAliases[0].zoned_count === undefined) {
            console.log("⚠️ zoned_count not provided by API, calculating client-side...");
            
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
              console.log(`Calculated zoned_count for ${alias.name}: ${alias.zoned_count}`);
            });
            
            console.log("✅ Client-side zone count calculation complete");
          }

          setMemberOptions(processedAliases);
          console.log(
            "Member options set:",
            processedAliases.length,
            "aliases"
          );
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
        console.log("🔄 Recalculating zone counts with latest zone data...");
        
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
        
        console.log("Zone count updates:", 
          updatedMemberOptions.filter(a => aliasZoneCounts[a.name] > 0).map(a => ({ name: a.name, count: a.zoned_count }))
        );
        
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
        key={`zone-table-${memberColumns}-${allColumns.length}-${allHeaders.length}`}
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
        storageKey={`zone-table-${activeProjectId}-cols${memberColumns}`}
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
            onClick={() => {
              console.log(`Adding 1 column. Current: ${memberColumns}`);
              setMemberColumns(prev => prev + 1);
            }}
            title="Add Member Column"
            style={{
              minWidth: '32px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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
          </button>
        }
        additionalButtons={[
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
        ]}
      />
    </div>
  );
};

export default ZoneTable;
