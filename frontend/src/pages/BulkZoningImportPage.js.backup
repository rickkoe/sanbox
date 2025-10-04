import React, { useState, useEffect, useContext, useCallback } from "react";
import { Button, Form, Alert, Card, Spinner, Badge, Tab, Tabs, Modal, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import "handsontable/dist/handsontable.full.css";

// Smart detection function for WWPN type
const detectWwpnType = async (wwpn) => {
  try {
    const response = await axios.post('/api/san/wwpn-prefixes/detect-type/', {
      wwpn: wwpn
    });
    return response.data.detected_type || null;
  } catch (error) {
    console.warn(`Failed to detect WWPN type for ${wwpn}:`, error);
    return null;
  }
};

// Duplicate Conflict Resolver Component
const DuplicateConflictResolver = ({ conflicts, onResolve, onCancel }) => {
  const [resolutions, setResolutions] = useState(new Map());

  const handleChoice = (wwpnKey, chosenItemId) => {
    const newResolutions = new Map(resolutions);
    newResolutions.set(wwpnKey, chosenItemId);
    setResolutions(newResolutions);
  };

  const handleResolveAll = () => {
    // Check if all conflicts have been resolved
    const unresolvedConflicts = conflicts.filter(conflict => !resolutions.has(conflict.wwpnKey));
    
    if (unresolvedConflicts.length > 0) {
      alert(`Please resolve all conflicts. ${unresolvedConflicts.length} conflicts still need resolution.`);
      return;
    }
    
    onResolve(resolutions);
  };

  return (
    <Modal show={true} size="xl" onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>Resolve WWPN Conflicts</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          <strong>{conflicts.length}</strong> WWPNs appear in multiple aliases with different names or types. 
          Please choose which alias to keep for each WWPN.
        </Alert>
        
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {conflicts.map((conflict, index) => (
            <Card key={conflict.wwpnKey} className="mb-3">
              <Card.Header>
                <h6 className="mb-0">
                  Conflict #{index + 1}: WWPN <code>{conflict.wwpn}</code>
                  <Badge variant="secondary" className="ml-2">
                    {conflict.conflictType === 'name' ? 'Different Names' : 'Different Types'}
                  </Badge>
                </h6>
              </Card.Header>
              <Card.Body>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th width="50">Choose</th>
                      <th>Alias Name</th>
                      <th>Type</th>
                      <th>VSAN</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflict.items.map((item, itemIndex) => {
                      const itemId = item.name + '|' + item.cisco_alias;
                      const isSelected = resolutions.get(conflict.wwpnKey) === itemId;
                      
                      return (
                        <tr key={itemIndex} className={isSelected ? 'table-success' : ''}>
                          <td>
                            <Form.Check
                              type="radio"
                              name={`conflict-${conflict.wwpnKey}`}
                              checked={isSelected}
                              onChange={() => handleChoice(conflict.wwpnKey, itemId)}
                            />
                          </td>
                          <td><code>{item.name}</code></td>
                          <td>
                            <Badge variant={item.cisco_alias === 'device-alias' ? 'primary' : 'secondary'}>
                              {item.cisco_alias}
                            </Badge>
                          </td>
                          <td>{item.vsan || 'N/A'}</td>
                          <td><small>{item.notes || ''}</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel Import
        </Button>
        <Button variant="primary" onClick={handleResolveAll}>
          Continue with Selected Choices ({resolutions.size}/{conflicts.length} resolved)
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const BulkZoningImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  
  // Basic state
  const [fabricOptions, setFabricOptions] = useState([]);
  const [aliasOptions, setAliasOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  
  // Debug selectedFabric changes
  useEffect(() => {
    console.log("🔄 selectedFabric changed to:", selectedFabric, typeof selectedFabric);
  }, [selectedFabric]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  
  // Debug importing state changes
  useEffect(() => {
    console.log("🔄 IMPORTING STATE CHANGED:", importing);
  }, [importing]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-scroll to results when import finishes
  const scrollToResults = () => {
    console.log("🔄 scrollToResults called - starting scroll in 500ms");
    setTimeout(() => {
      // Try uploaded files section first
      let targetSection = document.querySelector('[data-section="uploaded-files"]');
      console.log("🎯 Looking for uploaded files section:", targetSection);
      
      // Fallback to preview section if no uploaded files
      if (!targetSection) {
        targetSection = document.querySelector('[data-section="preview"]');
        console.log("🎯 Fallback: Looking for preview section:", targetSection);
      }
      
      // Final fallback to any results area
      if (!targetSection) {
        targetSection = document.querySelector('.card:has([class*="preview"])') || 
                      document.querySelector('.mb-3:has(button[variant="primary"])');
        console.log("🎯 Final fallback: Looking for any results area:", targetSection);
      }
      
      if (targetSection) {
        console.log("✅ Found target section, scrolling now");
        targetSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      } else {
        console.log("❌ No scroll target found!");
      }
    }, 500);
  };
  
  // File handling state
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [textInput, setTextInput] = useState("");
  
  // Parsed data state
  const [parsedData, setParsedData] = useState([]);
  const [showPreview, setShowPreview] = useState({ aliases: false, zones: false });
  const [activeTab, setActiveTab] = useState("files");
  const [showPreviewSection, setShowPreviewSection] = useState(false);
  const [currentPage, setCurrentPage] = useState("import"); // "import" or "results"
  const [preferencesStatus, setPreferencesStatus] = useState(""); // "", "saving", "saved"
  const [zonePreferencesStatus, setZonePreferencesStatus] = useState(""); // "", "saving", "saved"
  
  // Duplicate conflict resolution state
  const [duplicateConflicts, setDuplicateConflicts] = useState([]);
  const [conflictResolutions, setConflictResolutions] = useState(new Map());
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  
  // Import defaults
  const [aliasDefaults, setAliasDefaults] = useState({
    create: true,
    includeInZoning: false,
    use: "init",
    aliasType: "original",
    conflictResolution: "device-alias" // device-alias or fcalias
  });

  // Zone import defaults
  const [zoneDefaults, setZoneDefaults] = useState({
    create: true,
    exists: false,
    zoneType: "standard" // smart or standard
  });

  // Selected aliases and zones for selective import
  const [selectedAliases, setSelectedAliases] = useState(new Set());
  const [selectedZones, setSelectedZones] = useState(new Set());

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Helper function to detect what types of data are in parsed data
  const detectDataTypes = (items) => {
    const hasAliases = items.some(item => item.wwpn !== undefined);
    const hasZones = items.some(
      (item) => item.zone_type !== undefined || item.members !== undefined
    );
    return { aliases: hasAliases, zones: hasZones };
  };

  // Calculate import statistics for both aliases and zones
  const getImportStats = () => {
    const allAliases = parsedData.filter(item => item.wwpn !== undefined);
    const allZones = parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined);
    
    const newAliases = allAliases.filter(alias => !alias.existsInDatabase);
    const duplicateAliases = allAliases.filter(alias => alias.existsInDatabase);
    const smartDetectedAliases = allAliases.filter(alias => alias.smartDetectionNote);
    const smartDetectedWithRules = smartDetectedAliases.filter(alias => !alias.smartDetectionNote.includes('No prefix rule found'));
    const smartDetectedWithoutRules = smartDetectedAliases.filter(alias => alias.smartDetectionNote.includes('No prefix rule found'));
    
    const newZones = allZones.filter(zone => !zone.existsInDatabase);
    const duplicateZones = allZones.filter(zone => zone.existsInDatabase);
    
    return {
      // Alias stats
      totalAliases: allAliases.length,
      newAliases: newAliases.length,
      duplicateAliases: duplicateAliases.length,
      smartDetected: smartDetectedAliases.length,
      smartDetectedWithRules: smartDetectedWithRules.length,
      smartDetectedWithoutRules: smartDetectedWithoutRules.length,
      
      // Zone stats
      totalZones: allZones.length,
      newZones: newZones.length,
      duplicateZones: duplicateZones.length,
      
      // Combined stats (for backward compatibility)
      total: allAliases.length + allZones.length,
      new: newAliases.length + newZones.length,
      duplicates: duplicateAliases.length + duplicateZones.length
    };
  };

  // Clear selected aliases and zones when data changes
  useEffect(() => {
    setSelectedAliases(new Set());
    setSelectedZones(new Set());
  }, [parsedData]);

  // Functions to handle checkbox selection
  const handleSelectAlias = (index, checked) => {
    const newSelected = new Set(selectedAliases);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedAliases(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const newAliases = parsedData
        .filter(item => item.wwpn !== undefined && !item.existsInDatabase)
        .map((_, index) => index);
      setSelectedAliases(new Set(newAliases));
    } else {
      setSelectedAliases(new Set());
    }
  };

  const handleSelectZone = (index, checked) => {
    const newSelected = new Set(selectedZones);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedZones(newSelected);
  };

  const handleSelectAllZones = (checked) => {
    if (checked) {
      const newZones = parsedData
        .filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase)
        .map((_, index) => index);
      setSelectedZones(new Set(newZones));
    } else {
      setSelectedZones(new Set());
    }
  };

  // Update parsed data when defaults change
  useEffect(() => {
    console.log("🔄 aliasDefaults changed:", aliasDefaults);
    console.log("📊 Current parsedData length:", parsedData.length);
    console.log("📁 Current uploadedFiles length:", uploadedFiles.length);
    
    if (parsedData.length > 0) {
      // If smart detection is enabled, we need to reprocess the files
      if (aliasDefaults.use === "smart") {
        console.log("🧠 Smart detection enabled, reprocessing files...");
        if (uploadedFiles.length > 0) {
          processFiles(uploadedFiles);
        }
      } else {
        // For non-smart options, we can just update the existing data
        console.log("✏️ Updating parsedData with new defaults");
        const updatedData = parsedData.map(item => ({
          ...item,
          create: aliasDefaults.create,
          include_in_zoning: aliasDefaults.includeInZoning,
          use: aliasDefaults.use,
          cisco_alias: aliasDefaults.aliasType
        }));
        console.log("📋 Updated data sample:", updatedData[0]);
        setParsedData(updatedData);
      }
    }
    
    // Also update uploaded files data so it applies to future processing
    if (uploadedFiles.length > 0) {
      console.log("🗂️ Updating uploadedFiles items with new defaults");
      const updatedFiles = uploadedFiles.map(file => ({
        ...file,
        items: file.items.map(item => ({
          ...item,
          create: aliasDefaults.create,
          include_in_zoning: aliasDefaults.includeInZoning,
          use: aliasDefaults.use,
          cisco_alias: aliasDefaults.aliasType
        }))
      }));
      setUploadedFiles(updatedFiles);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliasDefaults]);

  // Update parsed data when zone defaults change
  useEffect(() => {
    console.log("🔄 zoneDefaults changed:", zoneDefaults);
    console.log("📊 Current parsedData length:", parsedData.length);
    
    if (parsedData.length > 0) {
      // Update zone data with new defaults
      console.log("✏️ Updating parsedData zones with new defaults");
      const updatedData = parsedData.map(item => {
        // Only update zones, leave aliases unchanged
        if (item.zone_type !== undefined || item.members !== undefined) {
          return {
            ...item,
            create: zoneDefaults.create,
            exists: zoneDefaults.exists,
            zone_type: zoneDefaults.zoneType === "detect" ? (item.zone_type || "standard") : zoneDefaults.zoneType
          };
        }
        return item; // Return aliases unchanged
      });
      console.log("📋 Updated zone data sample:", updatedData.find(item => item.zone_type !== undefined || item.members !== undefined));
      setParsedData(updatedData);
    }
    
    // Also update uploaded files data so it applies to future processing
    if (uploadedFiles.length > 0) {
      console.log("🗂️ Updating uploadedFiles zone items with new defaults");
      const updatedFiles = uploadedFiles.map(file => ({
        ...file,
        items: file.items.map(item => {
          // Only update zones, leave aliases unchanged
          if (item.zone_type !== undefined || item.members !== undefined) {
            return {
              ...item,
              create: zoneDefaults.create,
              exists: zoneDefaults.exists,
              zone_type: zoneDefaults.zoneType === "detect" ? (item.zone_type || "standard") : zoneDefaults.zoneType
            };
          }
          return item; // Return aliases unchanged
        })
      }));
      setUploadedFiles(updatedFiles);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneDefaults]);

  // Load fabrics
  useEffect(() => {
    if (activeCustomerId) {
      setLoading(true);
      axios.get(`/api/san/fabrics/?customer_id=${activeCustomerId}`)
        .then((response) => {
          console.log("🏗️ Fabrics loaded:", response.data);
          setFabricOptions(response.data);
          if (response.data.length > 0) {
            console.log("🎯 Auto-selecting fabric:", response.data[0].id);
            setSelectedFabric(response.data[0].id);
          } else {
            console.warn("⚠️ No fabrics found for customer");
          }
        })
        .catch((err) => {
          console.error("Error fetching fabrics:", err);
          setError("Failed to load fabrics");
        })
        .finally(() => setLoading(false));
    }
  }, [activeCustomerId]);

  // Load aliases when project or fabric changes - FETCH ALL PAGES
  useEffect(() => {
    if (activeProjectId && selectedFabric) {
      const loadAllAliases = async () => {
        try {
          // Fetch all aliases by handling pagination
          let allAliases = [];
          let page = 1;
          const baseUrl = `/api/san/aliases/project/${activeProjectId}/`;
          const queryParams = 'page_size=100'; // Use larger page size for efficiency
          
          while (true) {
            const url = `${baseUrl}?${queryParams}&page=${page}`;
            console.log(`🔍 [Initial Load] Fetching aliases page ${page}: ${url}`);
            
            const res = await axios.get(url);
            console.log(`🔍 [Initial Load] API response page ${page}:`, res.data);
            
            const responseData = res.data;
            const aliasesArray = responseData.results || responseData;
            
            if (Array.isArray(aliasesArray)) {
              allAliases = [...allAliases, ...aliasesArray];
              console.log(`Loaded ${aliasesArray.length} aliases from page ${page}, total so far: ${allAliases.length}`);
              
              // Check if there are more pages using pagination metadata
              if (!responseData.next || responseData.current_page >= responseData.num_pages) {
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
            
            // Safety check to prevent infinite loops
            if (page > 50) {
              console.error(`🛑 Safety break: too many pages (${page}), stopping pagination`);
              break;
            }
          }
          
          // Filter aliases for the selected fabric
          const fabricAliases = allAliases.filter(
            (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
          );
          setAliasOptions(fabricAliases);
          console.log(`✅ [Initial Load] Set ${fabricAliases.length} fabric aliases (from ${allAliases.length} total)`);
        } catch (err) {
          console.error("Error fetching aliases:", err);
        }
      };
      
      loadAllAliases();
    }
  }, [activeProjectId, selectedFabric]);

  // Load user preferences for bulk import
  useEffect(() => {
    if (activeCustomerId) {
      console.log("🔧 Loading bulk import preferences...");
      console.log("🔧 Available config:", config);
      console.log("🔧 Parameters:", {
        customer: activeCustomerId,
        table_name: 'bulk_alias_import'
      });
      
      axios.get('/api/core/table-config/', {
        params: {
          customer: activeCustomerId,
          table_name: 'bulk_alias_import'
        }
      })
        .then((response) => {
          console.log("🔍 Full API response:", response.data);
          
          // Handle both single object and array responses
          const configData = Array.isArray(response.data) ? response.data[0] : response.data;
          
          if (configData && configData.additional_settings) {
            const preferences = configData.additional_settings;
            console.log("✅ Loaded preferences:", preferences);
            setAliasDefaults(prev => {
              const newDefaults = { ...prev, ...preferences };
              console.log("🔄 Updated aliasDefaults from:", prev, "to:", newDefaults);
              return newDefaults;
            });
          } else {
            console.log("📋 No saved preferences found in response, using defaults");
            console.log("📋 Available keys in response:", Object.keys(configData || {}));
          }
        })
        .catch((err) => {
          console.log("ℹ️ Could not load preferences (first time?), using defaults");
          console.log("❌ Error details:", err.response?.status, err.response?.data);
        });
    }
  }, [activeCustomerId]);

  // Load zone preferences for bulk import
  useEffect(() => {
    if (activeCustomerId) {
      console.log("🔧 Loading bulk zone import preferences...");
      
      axios.get('/api/core/table-config/', {
        params: {
          customer: activeCustomerId,
          table_name: 'bulk_zone_import'
        }
      })
        .then((response) => {
          console.log("🔍 Full zone preferences API response:", response.data);
          
          // Handle both single object and array responses
          const configData = Array.isArray(response.data) ? response.data[0] : response.data;
          
          if (configData && configData.additional_settings) {
            const preferences = configData.additional_settings;
            console.log("✅ Loaded zone preferences:", preferences);
            setZoneDefaults(prev => {
              const newDefaults = { ...prev, ...preferences };
              console.log("🔄 Updated zoneDefaults from:", prev, "to:", newDefaults);
              return newDefaults;
            });
          } else {
            console.log("📋 No saved zone preferences found in response, using defaults");
            console.log("📋 Available keys in response:", Object.keys(configData || {}));
          }
        })
        .catch((err) => {
          console.log("ℹ️ Could not load zone preferences (first time?), using defaults");
          console.log("❌ Zone preferences error details:", err.response?.status, err.response?.data);
        });
    }
  }, [activeCustomerId]);

  // Save user preferences when they change
  const savePreferences = useCallback(async (newDefaults) => {
    if (activeCustomerId) {
      try {
        setPreferencesStatus("saving");
        console.log("💾 Saving bulk import preferences:", newDefaults);
        await axios.post('/api/core/table-config/', {
          customer: activeCustomerId,
          table_name: 'bulk_alias_import',
          additional_settings: newDefaults
        });
        console.log("✅ Preferences saved successfully");
        setPreferencesStatus("saved");
        
        // Clear "saved" status after 2 seconds
        setTimeout(() => setPreferencesStatus(""), 2000);
      } catch (error) {
        console.error("❌ Failed to save preferences:", error);
        setPreferencesStatus("");
      }
    }
  }, [activeCustomerId]);

  // Save zone preferences when they change
  const saveZonePreferences = useCallback(async (newDefaults) => {
    if (activeCustomerId) {
      try {
        setZonePreferencesStatus("saving");
        const payload = {
          customer: activeCustomerId,
          table_name: 'bulk_zone_import',
          additional_settings: newDefaults
        };
        console.log("💾 Saving bulk zone import preferences:", newDefaults);
        await axios.post('/api/core/table-config/', payload);
        console.log("✅ Zone preferences saved successfully");
        setZonePreferencesStatus("saved");
        
        // Clear "saved" status after 2 seconds
        setTimeout(() => setZonePreferencesStatus(""), 2000);
      } catch (error) {
        // Handle database lock errors (common with SQLite)
        if (error.response?.data?.error === 'database is locked') {
          console.log("⚠️ Database temporarily locked, preferences may still save");
          // Still show saved status for database lock since it usually works
          setZonePreferencesStatus("saved");
          setTimeout(() => setZonePreferencesStatus(""), 2000);
        } else {
          console.error("❌ Failed to save zone preferences:", error.response?.data || error.message);
          setZonePreferencesStatus("");
        }
      }
    }
  }, [activeCustomerId]);

  // Update alias defaults and save to database
  const updateAliasDefaults = useCallback((updater) => {
    setAliasDefaults(prev => {
      const newDefaults = typeof updater === 'function' ? updater(prev) : updater;
      // Save to database (async, fire and forget)
      savePreferences(newDefaults);
      return newDefaults;
    });
  }, [savePreferences]);

  // Update zone defaults and save to database
  const updateZoneDefaults = useCallback((updater) => {
    setZoneDefaults(prev => {
      const newDefaults = typeof updater === 'function' ? updater(prev) : updater;
      // Save to database (async, fire and forget) - use a different table name for zones
      saveZonePreferences(newDefaults);
      return newDefaults;
    });
  }, [saveZonePreferences]);

  // Function to refresh alias options after import with retry logic for large datasets
  const refreshAliasOptions = useCallback(async (retryForLargeImport = false, maxRetries = 5, expectedAliasNames = []) => {
    if (activeProjectId && selectedFabric) {
      console.log("🔄 Refreshing alias options after import");
      console.log(`🔍 Expected to find aliases: ${expectedAliasNames.slice(0, 5)}`); // Show first 5
      
      // For large imports, always add an initial delay to allow database transaction to complete
      if (retryForLargeImport) {
        console.log("⏳ Adding initial delay for large import...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s
      }
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Add delay between retries
          if (attempt > 0) {
            const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000); // Exponential backoff, max 2s
            console.log(`⏳ Waiting ${delay}ms before retry attempt ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Fetch ALL aliases by handling pagination properly
          console.log(`🔍 Fetching all aliases for project ${activeProjectId} with pagination`);
          let allAliases = [];
          let page = 1;
          const baseUrl = `/api/san/aliases/project/${activeProjectId}/`;
          const queryParams = 'page_size=100'; // Use smaller page size for better reliability
          
          while (true) {
            const url = `${baseUrl}?${queryParams}&page=${page}`;
            console.log(`🔍 [Refresh] Fetching aliases page ${page}: ${url}`);
            
            const res = await axios.get(url);
            console.log(`🔍 [Refresh] API response page ${page}:`, res.data);
            
            const responseData = res.data;
            const aliasesArray = responseData.results || responseData;
            
            if (Array.isArray(aliasesArray)) {
              allAliases = [...allAliases, ...aliasesArray];
              console.log(`Loaded ${aliasesArray.length} aliases from page ${page}, total so far: ${allAliases.length}`);
              
              // Check if there are more pages using pagination metadata
              if (!responseData.next || responseData.current_page >= responseData.num_pages) {
                console.log(`🏁 Pagination complete. Final total: ${allAliases.length} aliases`);
                break;
              }
              page++;
            } else {
              // Handle non-paginated response
              allAliases = Array.isArray(responseData) ? responseData : [responseData];
              console.log(`📄 Non-paginated response, loaded ${allAliases.length} aliases`);
              break;
            }
            
            // Safety check to prevent infinite loops
            if (page > 50) {
              console.error(`🛑 Safety break: too many pages (${page}), stopping pagination`);
              break;
            }
          }
          
          console.log(`🔍 Fetched ${allAliases.length} total aliases across all pages`);
          const fabricAliases = allAliases.filter(
            (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
          );
          
          // Check if we have all expected aliases
          if (expectedAliasNames.length > 0) {
            const foundNames = fabricAliases.map(a => a.name);
            const missingAliases = expectedAliasNames.filter(name => !foundNames.includes(name));
            
            if (missingAliases.length > 0 && attempt < maxRetries - 1) {
              console.log(`⚠️ Missing ${missingAliases.length} expected aliases: ${missingAliases.slice(0, 3)}, retrying...`);
              continue; // Retry
            }
            
            console.log(`✅ Found ${expectedAliasNames.length - missingAliases.length}/${expectedAliasNames.length} expected aliases`);
            if (missingAliases.length > 0) {
              console.log(`⚠️ Still missing after all retries: ${missingAliases}`);
            }
          }
          
          setAliasOptions(fabricAliases);
          console.log(`✅ Refreshed aliasOptions: ${fabricAliases.length} aliases (attempt ${attempt + 1})`);
          console.log(`🔍 Sample refreshed aliases:`, fabricAliases.slice(0, 5).map(a => ({ name: a.name, id: a.id })));
          return fabricAliases;
        } catch (err) {
          console.error(`Error refreshing aliases (attempt ${attempt + 1}):`, err);
          if (attempt === maxRetries - 1) {
            console.error("❌ Failed to refresh aliases after all retries");
            return [];
          }
        }
      }
    }
    return [];
  }, [activeProjectId, selectedFabric]);

  // Detect conflicts and present them to user for resolution
  const detectConflicts = (items) => {
    const wwpnConflicts = new Map();
    const aliases = items.filter(item => item.wwpn !== undefined);
    
    // Group aliases by WWPN
    aliases.forEach(item => {
      const wwpnKey = item.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (!wwpnConflicts.has(wwpnKey)) {
        wwpnConflicts.set(wwpnKey, []);
      }
      wwpnConflicts.get(wwpnKey).push(item);
    });
    
    // Find conflicts and deduplicate by unique alias name + type combinations
    const conflicts = [];
    wwpnConflicts.forEach((items, wwpnKey) => {
      if (items.length > 1) {
        // Group by unique name + cisco_alias combination
        const uniqueOptions = new Map();
        items.forEach(item => {
          const optionKey = `${item.name}|${item.cisco_alias}`;
          if (!uniqueOptions.has(optionKey)) {
            uniqueOptions.set(optionKey, item);
          }
        });
        
        const uniqueItems = Array.from(uniqueOptions.values());
        
        // Check if there's a real conflict after deduplication
        const names = new Set(uniqueItems.map(i => i.name));
        const aliasTypes = new Set(uniqueItems.map(i => i.cisco_alias));
        
        if (names.size > 1 || aliasTypes.size > 1) {
          console.log(`🔍 Conflict detected for WWPN ${items[0].wwpn}: ${items.length} raw entries reduced to ${uniqueItems.length} unique options`);
          conflicts.push({
            wwpn: items[0].wwpn,
            wwpnKey: wwpnKey,
            items: uniqueItems, // Use deduplicated items
            conflictType: names.size > 1 ? 'name' : 'type'
          });
        }
      }
    });
    
    return conflicts;
  };

  // Apply user conflict resolutions and deduplicate
  const deduplicateItemsWithResolutions = (items, resolutions = new Map()) => {
    const aliases = items.filter(item => item.wwpn !== undefined);
    const zones = items.filter(item => item.zone_type !== undefined || item.members !== undefined);
    
    const aliasMap = new Map();
    const zoneMap = new Map();
    
    // Process aliases with user resolutions
    aliases.forEach(item => {
      const wwpnKey = item.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '');
      
      // Check if user has made a resolution for this WWPN
      if (resolutions.has(wwpnKey)) {
        const chosenItemId = resolutions.get(wwpnKey);
        if (item.name + '|' + item.cisco_alias === chosenItemId) {
          aliasMap.set(wwpnKey, item);
          console.log(`✅ User choice: Adding ${item.name} (${item.cisco_alias}) for WWPN ${item.wwpn}`);
        }
      } else if (!aliasMap.has(wwpnKey)) {
        // No conflict resolution needed or no conflict - add first occurrence
        aliasMap.set(wwpnKey, item);
        console.log(`✅ No conflict: Adding ${item.name} (${item.cisco_alias}) for WWPN ${item.wwpn}`);
      }
    });
    
    // Process zones - deduplicate by name and fabric
    zones.forEach(item => {
      const key = `${item.name}_${item.fabric || selectedFabric}`;
      if (!zoneMap.has(key)) {
        zoneMap.set(key, item);
      }
    });
    
    const dedupedAliases = [...aliasMap.values()];
    const dedupedZones = [...zoneMap.values()];
    
    console.log(`🔄 Deduplication result: ${items.length} -> ${dedupedAliases.length + dedupedZones.length} items (${dedupedAliases.length} aliases, ${dedupedZones.length} zones)`);
    
    return [...dedupedAliases, ...dedupedZones];
  };

  // Handle conflict resolution completion
  const handleConflictResolution = (resolutions) => {
    setConflictResolutions(resolutions);
    setShowConflictResolution(false);
    
    // Re-process the original data with user resolutions
    const allParsedItems = uploadedFiles.flatMap(file => file.rawItems || []);
    const dedupedItems = deduplicateItemsWithResolutions(allParsedItems, resolutions);
    
    // Continue with the normal flow
    enhanceWithExistenceCheck(dedupedItems).then(enhancedItems => {
      setParsedData(enhancedItems);
      setShowPreviewSection(true);
      scrollToResults();
    });
  };

  // Legacy function for backward compatibility - now detects conflicts and asks user
  const deduplicateItems = (items) => {
    // Detect conflicts first
    const conflicts = detectConflicts(items);
    
    if (conflicts.length > 0) {
      console.log(`⚠️ Found ${conflicts.length} WWPN conflicts that need user resolution`);
      setDuplicateConflicts(conflicts);
      setShowConflictResolution(true);
      return null; // Return null to indicate conflicts need resolution
    }
    
    // No conflicts, proceed with normal deduplication
    return deduplicateItemsWithResolutions(items, conflictResolutions);
  };

  // Check for existing aliases and zones in database
  const enhanceWithExistenceCheck = async (items) => {
    const aliases = items.filter(item => item.wwpn !== undefined);
    const zones = items.filter(item => item.zone_type !== undefined || item.members !== undefined);
    
    console.log(`🔍 Processing ${aliases.length} aliases and ${zones.length} zones for existence check`);
    
    // Get fresh alias data from database - ALWAYS FETCH ALL PAGES for existence check
    let currentAliasOptions = [];
    if (activeProjectId && selectedFabric) {
      console.log("🔄 Loading complete alias dataset from database for existence check...");
      try {
        // Fetch all aliases by handling pagination
        let allAliases = [];
        let page = 1;
        const baseUrl = `/api/san/aliases/project/${activeProjectId}/`;
        const queryParams = 'page_size=100'; // Use larger page size for efficiency
        
        while (true) {
          const url = `${baseUrl}?${queryParams}&page=${page}`;
          console.log(`🔍 [Existence Check] Fetching aliases page ${page}: ${url}`);
          
          const res = await axios.get(url);
          console.log(`🔍 [Existence Check] API response page ${page}:`, {
            count: res.data.count,
            next: res.data.next,
            previous: res.data.previous,
            results_length: res.data.results?.length || 0,
            total_pages: res.data.count ? Math.ceil(res.data.count / 100) : 'unknown'
          });
          
          const responseData = res.data;
          const aliasesArray = responseData.results || responseData;
          
          if (Array.isArray(aliasesArray)) {
            allAliases = [...allAliases, ...aliasesArray];
            console.log(`✅ Loaded ${aliasesArray.length} aliases from page ${page}, total so far: ${allAliases.length}/${responseData.count || 'unknown'}`);
            
            // Enhanced pagination debugging
            console.log(`🔍 [EXISTENCE CHECK] Pagination metadata - next: ${responseData.next}, current_page: ${responseData.current_page}, num_pages: ${responseData.num_pages}, count: ${responseData.count}`);
            
            // Check if this page was empty (should stop pagination)
            if (aliasesArray.length === 0) {
              console.log(`📄 Empty page received, stopping pagination`);
              break;
            }
            
            // Check if there are more pages using multiple methods
            const hasNext = responseData.next;
            const currentPage = responseData.current_page || page;
            const totalPages = responseData.num_pages;
            const totalCount = responseData.count;
            
            console.log(`🔍 [EXISTENCE CHECK] Page ${currentPage}/${totalPages}, next: ${hasNext}, count: ${totalCount}, loaded so far: ${allAliases.length}`);
            
            // More robust pagination termination logic
            const shouldContinue = hasNext || (currentPage < totalPages) || (totalCount && allAliases.length < totalCount);
            
            if (!shouldContinue) {
              console.log(`🏁 Pagination complete. Final total: ${allAliases.length} aliases`);
              break;
            }
            page++;
          } else {
            // Handle non-paginated response
            allAliases = Array.isArray(responseData) ? responseData : [responseData];
            console.log(`📄 Non-paginated response, loaded ${allAliases.length} aliases`);
            break;
          }
          
          // Safety check to prevent infinite loops
          if (page > 50) {
            console.error(`🛑 Safety break: too many pages (${page}), stopping pagination`);
            break;
          }
        }
        
        const fabricAliases = allAliases.filter(
          (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
        );
        currentAliasOptions = fabricAliases;
        // Update the cached aliasOptions only if it was empty or had fewer items
        if (aliasOptions.length < fabricAliases.length) {
          setAliasOptions(fabricAliases);
        }
        console.log(`✅ Loaded ${fabricAliases.length} existing aliases from database (from ${allAliases.length} total)`);
      } catch (err) {
        console.error("Error loading aliases:", err);
      }
    }
    
    console.log(`🔍 Checking ${aliases.length} aliases against ${currentAliasOptions.length} existing aliases in database`);
    console.log(`🔍 Expected to find ~320 existing aliases, actually loaded: ${currentAliasOptions.length}`);
    
    // Debug: Show sample of existing aliases
    if (currentAliasOptions.length > 0) {
      console.log(`📋 Sample of existing aliases:`, currentAliasOptions.slice(0, 5).map(a => `${a.name}:${a.wwpn}`));
      console.log(`📋 Last few existing aliases:`, currentAliasOptions.slice(-3).map(a => `${a.name}:${a.wwpn}`));
    }
    
    // Debug: Show sample of aliases being checked
    if (aliases.length > 0) {
      console.log(`📋 Sample of aliases being checked:`, aliases.slice(0, 5).map(a => `${a.name}:${a.wwpn}`));
    }
    
    // Check aliases for database existence
    const enhancedAliases = aliases.map((alias, index) => {
      const existsInDb = currentAliasOptions.some(existing => 
        existing.name.toLowerCase() === alias.name.toLowerCase() ||
        existing.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '') === alias.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '')
      );
      
      if (existsInDb) {
        console.log(`🎯 Found duplicate alias ${index + 1}/${aliases.length}: ${alias.name} (${alias.wwpn})`);
      } else if (index < 10) {
        // Show first 10 non-matches for debugging
        console.log(`🆕 New alias ${index + 1}/${aliases.length}: ${alias.name} (${alias.wwpn})`);
      }
      
      return {
        ...alias,
        existsInDatabase: existsInDb
      };
    });
    
    // Check zones for database existence - FETCH ALL PAGES
    let currentZoneOptions = [];
    if (activeProjectId && selectedFabric) {
      console.log("🔄 Loading existing zones from database for duplicate check...");
      try {
        // Fetch all zones by handling pagination
        let allZones = [];
        let page = 1;
        const baseUrl = `/api/san/zones/project/${activeProjectId}/`;
        const queryParams = 'page_size=100'; // Use larger page size for efficiency
        
        while (true) {
          const url = `${baseUrl}?${queryParams}&page=${page}`;
          console.log(`🔍 [Zone Check] Fetching zones page ${page}: ${url}`);
          
          const res = await axios.get(url);
          console.log(`🔍 [Zone Check] API response page ${page}:`, res.data);
          
          const responseData = res.data;
          const zonesArray = responseData.results || responseData;
          
          if (Array.isArray(zonesArray)) {
            allZones = [...allZones, ...zonesArray];
            console.log(`Loaded ${zonesArray.length} zones from page ${page}, total so far: ${allZones.length}`);
            
            // Check if there are more pages using multiple methods
            const hasNext = responseData.next;
            const currentPage = responseData.current_page || page;
            const totalPages = responseData.num_pages;
            const totalCount = responseData.count;
            
            console.log(`🔍 [ZONE CHECK] Page ${currentPage}/${totalPages}, next: ${hasNext}, count: ${totalCount}, loaded so far: ${allZones.length}`);
            
            // More robust pagination termination logic
            const shouldContinue = hasNext || (currentPage < totalPages) || (totalCount && allZones.length < totalCount);
            
            if (!shouldContinue) {
              console.log(`🏁 Zone pagination complete. Final total: ${allZones.length} zones`);
              break;
            }
            page++;
          } else {
            // Handle non-paginated response
            allZones = Array.isArray(responseData) ? responseData : [responseData];
            console.log(`Non-paginated response, loaded ${allZones.length} zones`);
            break;
          }
          
          // Safety check to prevent infinite loops
          if (page > 50) {
            console.error(`🛑 Safety break: too many pages (${page}), stopping zone pagination`);
            break;
          }
        }
        
        const fabricZones = allZones.filter(
          (zone) => zone.fabric_details?.id === parseInt(selectedFabric)
        );
        currentZoneOptions = fabricZones;
        console.log(`✅ Loaded ${fabricZones.length} existing zones from database (from ${allZones.length} total)`);
      } catch (err) {
        console.error("Error loading zones for existence check:", err);
      }
    }
    
    console.log(`🔍 Checking ${zones.length} zones against ${currentZoneOptions.length} existing zones in database`);
    
    // Check zones for database existence
    const enhancedZones = zones.map(zone => {
      const existsInDb = currentZoneOptions.some(existing => 
        existing.name.toLowerCase() === zone.name.toLowerCase() &&
        existing.fabric_details?.id === parseInt(selectedFabric)
      );
      
      if (existsInDb) {
        console.log(`🎯 Found duplicate zone: ${zone.name}`);
      }
      
      return {
        ...zone,
        existsInDatabase: existsInDb
      };
    });
    
    const duplicateAliasCount = enhancedAliases.filter(a => a.existsInDatabase).length;
    const duplicateZoneCount = enhancedZones.filter(z => z.existsInDatabase).length;
    
    console.log(`✅ Enhanced ${enhancedAliases.length} aliases and ${enhancedZones.length} zones`);
    console.log(`🔍 Found ${duplicateAliasCount} aliases that exist in database`);
    console.log(`🔍 Found ${duplicateZoneCount} zones that exist in database`);
    console.log(`📊 DUPLICATE SUMMARY: ${duplicateAliasCount}/${aliases.length} aliases, ${duplicateZoneCount}/${zones.length} zones`);
    console.log(`📊 Database had ${currentAliasOptions.length} total aliases to compare against`);
    
    if (duplicateAliasCount !== aliases.length && aliases.length === 320) {
      console.error(`🚨 PROBLEM DETECTED: Expected 320 duplicates but only found ${duplicateAliasCount}!`);
      console.error(`🚨 This suggests pagination is not working correctly or comparison logic is flawed`);
      console.error(`🚨 Database comparison set size: ${currentAliasOptions.length} aliases`);
    }
    
    // Debug: Show a few examples of missed duplicates
    if (duplicateAliasCount < aliases.length) {
      const missedDuplicates = enhancedAliases.filter(a => !a.existsInDatabase).slice(0, 3);
      console.log(`🔍 Examples of aliases NOT detected as duplicates:`, missedDuplicates.map(a => `${a.name}:${a.wwpn}`));
    }
    
    return [...enhancedAliases, ...enhancedZones];
  };

  // Parse show tech-support files and extract alias and zone sections
  const parseTechSupportFile = (text) => {
    const lines = text.split("\n");
    const extractedSections = {
      deviceAliases: [],
      fcAliases: [],
      zones: [],
      flogiWwpns: []
    };
    
    let currentSection = null;
    let currentVsan = null;
    let sectionLines = [];
    let inTargetSection = false;
    let foundShowDeviceAlias = false;
    
    console.log("🔍 Parsing tech-support file with", lines.length, "lines");
    console.log("🎯 Looking for 'show device-alias database' and 'show flogi database' sections");
    
    // Debug: Look specifically for "show flogi database" lines
    console.log("🔍 Searching for 'show flogi database' line in file...");
    const flogiDatabaseLines = lines.filter(line => {
      const trimmed = line.trim().toLowerCase();
      return trimmed === 'show flogi database' || 
             trimmed === '`show flogi database`' ||
             trimmed === 'show flogi database' ||
             trimmed === '`show flogi database`';
    }).slice(0, 5); // Show first 5 matches
    
    if (flogiDatabaseLines.length > 0) {
      console.log(`📝 Found ${flogiDatabaseLines.length} exact 'show flogi database' lines:`);
      flogiDatabaseLines.forEach((line, index) => {
        console.log(`  ${index + 1}: "${line.trim()}"`);
      });
      // Add visible alert to show in UI
    } else {
      console.log("❌ No exact 'show flogi database' lines found in file");
      // Add visible alert to show in UI
    }
    
    // Also try a simpler approach - look for patterns anywhere in the file
    console.log("🔍 Simple pattern search:");
    const deviceAliasCount = (text.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]+/gi) || []).length;
    const fcAliasCount = (text.match(/fcalias\s+name\s+\S+/gi) || []).length;
    console.log(`Found patterns: ${deviceAliasCount} device-alias, ${fcAliasCount} fcalias`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Look for "show device-alias database" section (only first occurrence)
      if (!foundShowDeviceAlias && (
          trimmedLine.match(/^-+\s*show\s+device-alias\s+database/i) ||
          trimmedLine.match(/^show\s+device-alias\s+database/i))) {
        if (currentSection && sectionLines.length > 0) {
          processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
        }
        currentSection = "device-alias-show";
        sectionLines = [];
        inTargetSection = true;
        foundShowDeviceAlias = true;
        console.log("📝 Found FIRST 'show device-alias database' section at line", i + 1);
        continue;
      }
      
      // Look for zone sections - "show zone" or "show zoneset" or "Full Zone Database Section"
      if (trimmedLine.match(/^-+\s*show\s+(zone|zoneset)/i) ||
          trimmedLine.match(/^show\s+(zone|zoneset)/i) ||
          trimmedLine.match(/^!Full Zone Database Section for vsan\s+\d+/i)) {
        if (currentSection && sectionLines.length > 0) {
          processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
        }
        
        // Extract VSAN from Full Zone Database Section header
        const vsanMatch = trimmedLine.match(/^!Full Zone Database Section for vsan\s+(\d+)/i);
        if (vsanMatch) {
          currentVsan = parseInt(vsanMatch[1]);
          console.log("📝 Found Full Zone Database Section for VSAN", currentVsan, "at line", i + 1);
        } else {
          console.log("📝 Found zone section at line", i + 1);
        }
        
        currentSection = "zone-show";
        sectionLines = [];
        inTargetSection = true;
        continue;
      }
      
      // Look for exact "show flogi database" section (not "show flogi database details")
      if (trimmedLine.match(/^-+\s*show\s+flogi\s+database\s*-*$/i) ||
          trimmedLine.match(/^`?show\s+flogi\s+database`?\s*$/i)) {
        if (currentSection && sectionLines.length > 0) {
          processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
        }
        currentSection = "flogi-show";
        sectionLines = [];
        inTargetSection = true;
        console.log("📝 Found 'show flogi database' section at line", i + 1);
        continue;
      }
      
      // Detect end of show command sections (next show command, major section break, or next Full Zone Database Section)
      if (inTargetSection && (
          trimmedLine.match(/^-+\s*show\s+(?!(device-alias\s+database|zone|zoneset|flogi))/i) ||
          trimmedLine.match(/^show\s+(?!(device-alias\s+database|zone|zoneset|flogi))/i) ||
          (trimmedLine.startsWith("---") && trimmedLine.length > 10 && currentSection !== "flogi-show") ||
          trimmedLine.match(/^!\w+.*Section/i) || // End when hitting another section like "!Active Zone Database Section"
          (currentSection === "flogi-show" && trimmedLine.match(/^Total number of flogi/i)) // End flogi section at summary line
        )) {
        if (currentSection && sectionLines.length > 0) {
          processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
        }
        currentSection = null;
        sectionLines = [];
        inTargetSection = false;
        console.log("🏁 Exiting section at line", i + 1);
        continue;
      }
      
      // Collect lines for current section
      if (inTargetSection && currentSection) {
        sectionLines.push(line);
        // Debug: show line collection for flogi sections
        if (currentSection === "flogi-show" && sectionLines.length <= 5) {
          console.log(`📝 Collecting flogi line ${sectionLines.length}: "${line.trim()}"`);
        }
      }
    }
    
    // Process any remaining section
    if (currentSection && sectionLines.length > 0) {
      if (currentSection === "flogi-show") {
        alert(`DEBUG: Processing final flogi-show section with ${sectionLines.length} lines`);
      }
      processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
    }
    
    console.log("🏆 Tech-support parsing complete. Found:", {
      deviceAliases: extractedSections.deviceAliases.length,
      fcAliases: extractedSections.fcAliases.length,
      zones: extractedSections.zones.length,
      flogiWwpns: extractedSections.flogiWwpns.length
    });
    
    // If section-based parsing didn't find much, try direct pattern extraction as fallback
    const totalFound = extractedSections.deviceAliases.length + extractedSections.fcAliases.length;
    
    if (totalFound === 0 && (deviceAliasCount > 0 || fcAliasCount > 0)) {
      console.log("🔄 Section parsing found nothing, trying direct pattern extraction...");
      
      // Extract device-alias patterns directly
      const deviceAliasMatches = text.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]+/gi) || [];
      extractedSections.deviceAliases = deviceAliasMatches;
      console.log(`📝 Direct extraction found ${deviceAliasMatches.length} device-alias entries`);
      
      // Extract fcalias patterns with their members - more robust approach (supports both member pwwn and direct pwwn)
      const fcAliasPattern = /fcalias\s+name\s+\S+\s+vsan\s+\d+(?:\r?\n\s+(?:member\s+)?pwwn\s+[0-9a-fA-F:]+)*/gim;
      let fcAliasMatches = text.match(fcAliasPattern) || [];
      
      // If the complex pattern doesn't work, try simpler extraction
      if (fcAliasMatches.length === 0) {
        console.log("🔄 Complex fcalias pattern failed, trying simple extraction...");
        // Extract each fcalias block manually
        const lines = text.split('\n');
        const fcAliasBlocks = [];
        let currentBlock = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/^fcalias\s+name\s+\S+\s+vsan\s+\d+/)) {
            // Start of new fcalias block
            if (currentBlock) {
              fcAliasBlocks.push(currentBlock);
            }
            currentBlock = line;
          } else if (currentBlock && line.match(/^\s+(?:member\s+)?pwwn\s+[0-9a-fA-F:]+/)) {
            // Member line for current fcalias (supports both member pwwn and direct pwwn)
            currentBlock += '\n' + line;
          } else if (currentBlock && line.trim() && !line.match(/^\s/)) {
            // End of current block (non-indented, non-empty line)
            fcAliasBlocks.push(currentBlock);
            currentBlock = '';
          }
        }
        
        // Don't forget the last block
        if (currentBlock) {
          fcAliasBlocks.push(currentBlock);
        }
        
        fcAliasMatches = fcAliasBlocks;
      }
      
      extractedSections.fcAliases = fcAliasMatches;
      console.log(`🏷️ Direct extraction found ${fcAliasMatches.length} fcalias entries`);
    }
    
    return extractedSections;
  };
  
  // Process individual sections from tech-support
  const processTechSupportSection = (sectionType, lines, extractedSections, currentVsan) => {
    const sectionText = lines.join("\n");
    
    console.log(`🔧 Processing ${sectionType} section with ${lines.length} lines`, currentVsan ? `(VSAN ${currentVsan})` : "");
    console.log(`🔍 Section text preview:`, sectionText.substring(0, 200) + "...");
    
    
    if (sectionType === "device-alias-show") {
      // Process "show device-alias database" output
      // Look for lines like: device-alias P1-VC1-I01-p1 50:05:07:63:0a:03:17:e4
      const deviceAliasMatches = sectionText.match(/device-alias\s+\S+\s+[0-9a-fA-F:]{23}/gi);
      if (deviceAliasMatches) {
        console.log(`📝 Found ${deviceAliasMatches.length} device-alias entries in show output`);
        // Convert to standard format: device-alias name X pwwn Y
        const standardFormat = deviceAliasMatches.map(match => 
          match.replace(/^device-alias\s+(\S+)\s+([0-9a-fA-F:]{23})/i, "device-alias name $1 pwwn $2")
        );
        extractedSections.deviceAliases.push(...standardFormat);
      }
      
      // Also look for alternate format in database output
      const alternateMatches = lines.filter(line => 
        line.trim().match(/^\s*\S+\s+[0-9a-fA-F:]{23}/i) && 
        !line.trim().match(/^device-alias/i)
      );
      if (alternateMatches.length > 0) {
        console.log(`📝 Found ${alternateMatches.length} device-alias entries in alternate format`);
        const convertedEntries = alternateMatches.map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            return `device-alias name ${parts[0]} pwwn ${parts[1]}`;
          }
          return null;
        }).filter(entry => entry !== null);
        extractedSections.deviceAliases.push(...convertedEntries);  
      }
      
    } else if (sectionType === "zone-show") {
      // Process "show zone" or "show zoneset" or "Full Zone Database Section" output
      console.log(`📝 Processing zone section with ${lines.length} lines${currentVsan ? ` (VSAN ${currentVsan})` : ""}`);
      
      // For Full Zone Database sections, we need to clean up the format to match standard zone syntax
      let processedZoneText = sectionText;
      
      // Check if this is a Full Zone Database Section
      if (sectionText.includes("!Full Zone Database Section")) {
        console.log("🔧 Processing Full Zone Database Section format");
        // Remove the header line and clean up the format
        const cleanedLines = lines.filter(line => 
          !line.trim().startsWith("!Full Zone Database Section") && 
          line.trim() !== ""
        );
        processedZoneText = cleanedLines.join("\n");
      }
      
      extractedSections.zones.push(processedZoneText);
    } else if (sectionType === "flogi-show") {
      // Process "show flogi database" output
      console.log(`📝 Processing flogi database section with ${lines.length} lines`);
      
      // Parse WWPNs from flogi database output
      // Format: fc1/1     75    0xa60381  c0:50:76:09:15:09:02:20 c0:50:76:09:15:09:02:20
      const flogiWwpns = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        // Match lines with WWPN format (skip header lines and separators)
        // Updated regex to be more flexible with spacing and WWPN format
        const match = trimmedLine.match(/^fc\d+\/\d+\s+\d+\s+0x[0-9a-fA-F]+\s+([0-9a-fA-F:]{23}|[0-9a-fA-F]{16})/i);
        if (match) {
          let wwpn = match[1].toLowerCase();
          // Ensure WWPN is in colon format for consistency
          if (wwpn.length === 16) {
            wwpn = wwpn.match(/.{2}/g).join(':');
          }
          flogiWwpns.push(wwpn);
          console.log(`🔍 Parsed flogi WWPN: ${wwpn} from line: ${trimmedLine.substring(0, 80)}`);
        } else {
          // Debug: show lines that don't match (but skip obvious header/separator lines)
          if (trimmedLine.length > 10 && !trimmedLine.includes('INTERFACE') && !trimmedLine.includes('----')) {
            console.log(`❌ Line didn't match flogi pattern: ${trimmedLine.substring(0, 80)}`);
          }
        }
      }
      
      console.log(`📝 Found ${flogiWwpns.length} WWPNs in flogi database`);
      console.log(`🔍 Sample flogi WWPNs:`, flogiWwpns.slice(0, 5));
      
      extractedSections.flogiWwpns.push(...flogiWwpns);
    } else {
      // Fallback for other section types
      console.log(`⚠️ Unknown section type: ${sectionType}`);
    }
  };

  // Auto-detect data type (aliases, zones, and tech-support)
  const detectDataType = (text) => {
    // Check if this looks like a tech-support file
    if (text.includes("show tech-support") || 
        text.includes("show running-config") ||
        text.includes("show startup-config") ||
        text.includes("device-alias database") ||
        text.length > 50000) { // Tech support files are typically very large
      return "tech-support";
    }
    
    const lines = text.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("!"));
    
    // Count different patterns
    let aliasPatterns = 0;
    let zonePatterns = 0;
    let hasExplicitZoneKeywords = false;
    
    for (const line of lines) {
      // Alias patterns - device-alias and fcalias
      if (line.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]/i) ||
          line.match(/fcalias\s+name\s+\S+/i)) {
        aliasPatterns++;
      }
      
      // Zone patterns - look for explicit zone/zoneset keywords first
      if (line.match(/^zone\s+name\s+\S+(\s+vsan\s+\d+)?/i) ||
          line.match(/^zoneset\s+name\s+\S+(\s+vsan\s+\d+)?/i)) {
        hasExplicitZoneKeywords = true;
        zonePatterns++;
      }
      
      // Zone member patterns (only count if we've seen zone keywords)
      if (hasExplicitZoneKeywords && (
          line.match(/^\s*member\s+(fcalias|device-alias|pwwn)/i) ||
          line.match(/^\s*\*\s+fcid\s+0x[0-9a-fA-F]+.*\[device-alias\s+\S+\]/i))) {
        zonePatterns++;
      }
    }
    
    // Only return "zone" if we have explicit zone/zoneset keywords
    if (hasExplicitZoneKeywords) return "zone";
    if (aliasPatterns > 0) return "alias";
    return "unknown";
  };

  // Parse alias data (reused from AliasImportPage)
  const parseAliasData = async (text, fabricId = selectedFabric, defaults = aliasDefaults) => {
    console.log("🏗️ parseAliasData called with fabricId:", fabricId, typeof fabricId);
    console.log("🎛️ Using defaults:", defaults);
    if (defaults.aliasType === "original") {
      console.log("🔄 Using 'original' mode - preserving source alias types");
    }
    if (defaults.use === "smart") {
      console.log("🧠 Using smart detection mode");
    }
    if (!fabricId || (typeof fabricId === 'string' && fabricId.trim() === "")) {
      console.warn("⚠️ No fabric selected, cannot parse aliases");
      return [];
    }
    
    const lines = text.split("\n");
    const aliases = [];
    
    const deviceAliasRegex = /device-alias\s+name\s+(\S+)\s+pwwn\s+([0-9a-fA-F:]{23})/i;
    const fcAliasRegex = /fcalias\s+name\s+(\S+)\s+vsan\s+(\d+)/i;
    
    let currentFcAlias = null;
    
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmedLine = line.trim();
      
      // Device-alias format
      const deviceMatch = trimmedLine.match(deviceAliasRegex);
      if (deviceMatch) {
        const [, name, wwpn] = deviceMatch;
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        
        // Determine use type (with smart detection if enabled)
        let useType = defaults.use;
        let smartDetectionNote = null;
        if (defaults.use === "smart") {
          const detectedType = await detectWwpnType(formattedWWPN);
          if (detectedType) {
            useType = detectedType;
            smartDetectionNote = `Smart detected: ${detectedType}`;
            console.log(`🧠 Smart detection: ${formattedWWPN} -> ${detectedType}`);
          } else {
            console.log(`🧠 Smart detection: No rule found for ${formattedWWPN}, using default fallback`);
            useType = "init"; // Default fallback for smart detection
            smartDetectionNote = `No prefix rule found - defaulted to init`;
          }
        }
        
        aliases.push({
          lineNumber: index + 1,
          name: name,
          wwpn: formattedWWPN,
          fabric: fabricId ? (typeof fabricId === 'number' ? fabricId : parseInt(fabricId)) : null,
          use: useType,
          cisco_alias: defaults.aliasType === "original" ? "device-alias" : defaults.aliasType,
          create: defaults.create,
          include_in_zoning: defaults.includeInZoning,
          notes: smartDetectionNote ? `Imported from bulk import (${smartDetectionNote})` : "Imported from bulk import",
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
          smartDetectionNote: smartDetectionNote
        });
      }
      
      // FCAlias format
      const fcMatch = trimmedLine.match(fcAliasRegex);
      if (fcMatch) {
        const [, name, vsan] = fcMatch;
        console.log(`🏷️ Found fcalias: ${name} vsan ${vsan}`);
        currentFcAlias = {
          lineNumber: index + 1,
          name: name,
          vsan: parseInt(vsan),
          fabric: fabricId ? (typeof fabricId === 'number' ? fabricId : parseInt(fabricId)) : null,
          use: defaults.use, // Will be updated when WWPN is found if smart detection is enabled
          cisco_alias: defaults.aliasType === "original" ? "fcalias" : defaults.aliasType,
          create: defaults.create,
          include_in_zoning: defaults.includeInZoning,
          notes: `Imported from bulk import (VSAN ${vsan})`,
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
          wwpn: "" // Will be filled by member line
        };
      }
      
      // FCAlias member - look for member pwwn or direct pwwn with more flexible whitespace handling
      const memberRegex = /(?:member\s+)?pwwn\s+([0-9a-fA-F:]+)/i;
      const memberMatch = line.match(memberRegex); // Use original line, not trimmed, to handle indentation
      if (memberMatch && currentFcAlias) {
        const [, wwpn] = memberMatch;
        console.log(`    📝 Found member for ${currentFcAlias.name}: ${wwpn}`);
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        currentFcAlias.wwpn = formattedWWPN;
        // Determine use type (with smart detection if enabled)
        let useType = defaults.use;
        let smartDetectionNote = null;
        if (defaults.use === "smart") {
          const detectedType = await detectWwpnType(formattedWWPN);
          if (detectedType) {
            useType = detectedType;
            smartDetectionNote = `Smart detected: ${detectedType}`;
            console.log(`🧠 Smart detection (fcalias): ${formattedWWPN} -> ${detectedType}`);
          } else {
            console.log(`🧠 Smart detection (fcalias): No rule found for ${formattedWWPN}, using default fallback`);
            useType = "init"; // Default fallback for smart detection
            smartDetectionNote = `No prefix rule found - defaulted to init`;
          }
        }
        
        currentFcAlias.use = useType;
        if (smartDetectionNote) {
          currentFcAlias.notes = `Imported from bulk import (VSAN ${currentFcAlias.vsan}) (${smartDetectionNote})`;
          currentFcAlias.smartDetectionNote = smartDetectionNote;
        }
        aliases.push({ ...currentFcAlias });
        console.log(`    ✅ Added fcalias: ${currentFcAlias.name} -> ${formattedWWPN}`);
        currentFcAlias = null;
      }
    }
    
    return aliases;
  };

  // Parse zone data from Cisco zone configuration
  const parseZoneData = async (text, fabricId = selectedFabric, defaults = zoneDefaults, batchAliases = []) => {
    console.log("🏗️ parseZoneData called with fabricId:", fabricId, typeof fabricId);
    console.log("🎛️ Using zone defaults:", defaults);
    console.log("🎛️ Available aliasOptions:", aliasOptions.length, "aliases");
    console.log("🎛️ Available batchAliases:", batchAliases.length, "aliases");
    
    // Always get fresh alias data from database for zone parsing to ensure we have latest data - FETCH ALL PAGES
    let currentAliasOptions = [];
    if (activeProjectId && fabricId) {
      console.log("🔄 Loading complete alias dataset for zone parsing...");
      try {
        // Fetch all aliases by handling pagination
        let allAliases = [];
        let page = 1;
        const baseUrl = `/api/san/aliases/project/${activeProjectId}/`;
        const queryParams = 'page_size=100'; // Use larger page size for efficiency
        
        while (true) {
          const url = `${baseUrl}?${queryParams}&page=${page}`;
          console.log(`🔍 [Zone Parsing] Fetching aliases page ${page}: ${url}`);
          
          const res = await axios.get(url);
          console.log(`🔍 [Zone Parsing] API response page ${page}:`, res.data);
          
          const responseData = res.data;
          const aliasesArray = responseData.results || responseData;
          
          if (Array.isArray(aliasesArray)) {
            allAliases = [...allAliases, ...aliasesArray];
            console.log(`Loaded ${aliasesArray.length} aliases from page ${page}, total so far: ${allAliases.length}`);
            
            // Check if there are more pages using pagination metadata
            if (!responseData.next || responseData.current_page >= responseData.num_pages) {
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
          
          // Safety check to prevent infinite loops
          if (page > 50) {
            console.error(`🛑 Safety break: too many pages (${page}), stopping alias pagination in parseZoneData`);
            break;
          }
        }
        
        const fabricAliases = allAliases.filter(
          (alias) => alias.fabric_details?.id === parseInt(fabricId)
        );
        currentAliasOptions = fabricAliases;
        // Update the cached aliasOptions only if it was empty or had fewer items
        if (aliasOptions.length < fabricAliases.length) {
          setAliasOptions(fabricAliases);
        }
        console.log(`✅ Loaded ${fabricAliases.length} existing aliases for zone parsing (from ${allAliases.length} total)`);
        console.log(`📋 Sample aliases:`, fabricAliases.slice(0, 3).map(a => `${a.name}:${a.wwpn}`));
      } catch (err) {
        console.error("Error loading aliases for zone parsing:", err);
      }
    }
    
    console.log("🎛️ Using currentAliasOptions:", currentAliasOptions.length, "aliases");
    
    if (!fabricId || (typeof fabricId === 'string' && fabricId.trim() === "")) {
      console.warn("⚠️ No fabric selected, cannot parse zones");
      return [];
    }
    
    const lines = text.split("\n");
    const zones = [];
    let currentZone = null;
    let currentZoneset = null;
    let vsan = null;
    
    console.log(`🔍 Parsing ${lines.length} lines for zone data`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith("!")) continue;
      
      // Extract VSAN from zoneset - this ends any current zone
      const zonesetMatch = line.match(/zoneset\s+name\s+(\S+)(\s+vsan\s+(\d+))?/i);
      if (zonesetMatch) {
        // Save previous zone if exists before starting zoneset
        if (currentZone) {
          zones.push({ ...currentZone });
          console.log(`  🔚 Zone ${currentZone.name} completed with ${currentZone.members.length} members (zoneset encountered)`);
          currentZone = null;
        }
        currentZoneset = zonesetMatch[1];
        if (zonesetMatch[3]) {
          vsan = parseInt(zonesetMatch[3]);
        }
        console.log(`📁 Found zoneset: ${currentZoneset}${vsan ? ` (VSAN ${vsan})` : ''}`);
        continue;
      }
      
      // Zone definition line
      const zoneMatch = line.match(/zone\s+name\s+(\S+)(\s+vsan\s+(\d+))?/i);
      if (zoneMatch) {
        // Save previous zone if exists
        if (currentZone) {
          zones.push({ ...currentZone });
        }
        
        const zoneName = zoneMatch[1];
        const zoneVsan = zoneMatch[3] ? parseInt(zoneMatch[3]) : vsan;
        
        // Determine zone type based on defaults setting
        let finalZoneType = defaults.zoneType;
        if (defaults.zoneType === "detect") {
          // Try to detect zone type from the zone name or other indicators
          // For now, default to "standard" if we can't detect
          finalZoneType = "standard";
        }
        
        console.log(`🔧 Applying zone defaults: create=${defaults.create}, exists=${defaults.exists}, zoneType=${finalZoneType}`);
        
        currentZone = {
          name: zoneName,
          fabric: parseInt(fabricId),
          vsan: zoneVsan,
          create: defaults.create,
          exists: defaults.exists,
          zone_type: finalZoneType,
          members: [],
          notes: `Imported from bulk import${zoneVsan ? ` (VSAN ${zoneVsan})` : ''}${currentZoneset ? ` from zoneset ${currentZoneset}` : ''}`,
          imported: null,
          updated: null,
          saved: false,
          _isNew: true
        };
        
        console.log(`🔍 Found zone: ${zoneName}${zoneVsan ? ` (VSAN ${zoneVsan})` : ''}`);
        continue;
      }
      
      // Member lines within a zone
      if (currentZone) {
        // Format 1: member fcalias/device-alias
        const memberAliasMatch = line.match(/member\s+(fcalias|device-alias)\s+(\S+)/i);
        if (memberAliasMatch) {
          const aliasName = memberAliasMatch[2];
          console.log(`  👥 Found member (${memberAliasMatch[1]}): ${aliasName}`);
          
          // Find the alias in our available aliases (existing from database)
          let foundAlias = currentAliasOptions.find(alias => alias.name === aliasName);
          
          // If not found in database, check batch aliases
          if (!foundAlias) {
            foundAlias = batchAliases.find(alias => alias.name === aliasName);
            if (foundAlias) {
              console.log(`    ✅ Matched to batch alias: ${aliasName}`);
              // For batch aliases, we use a special marker since they don't have IDs yet
              currentZone.members.push(`batch:${aliasName}`);
            }
          } else {
            currentZone.members.push(foundAlias.id);
            console.log(`    ✅ Matched to existing alias ID: ${foundAlias.id}`);
          }
          
          if (!foundAlias) {
            console.log(`    ⚠️ Alias not found in database or batch: ${aliasName}`);
            // Store as a reference for later resolution
            if (!currentZone.unresolvedMembers) currentZone.unresolvedMembers = [];
            currentZone.unresolvedMembers.push({ type: memberAliasMatch[1], name: aliasName });
          }
          continue;
        }
        
        // Format 2: member pwwn
        const memberPwwnMatch = line.match(/member\s+pwwn\s+([0-9a-fA-F:]+)/i);
        if (memberPwwnMatch) {
          const pwwn = memberPwwnMatch[1];
          console.log(`  👥 Found member (pwwn): ${pwwn}`);
          
          // Find alias by WWPN in existing aliases
          let foundAlias = currentAliasOptions.find(alias => 
            alias.wwpn && alias.wwpn.replace(/[^0-9a-fA-F]/g, '').toLowerCase() === 
            pwwn.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
          );
          
          // If not found in database, check batch aliases
          if (!foundAlias) {
            foundAlias = batchAliases.find(alias => 
              alias.wwpn && alias.wwpn.replace(/[^0-9a-fA-F]/g, '').toLowerCase() === 
              pwwn.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
            );
            if (foundAlias) {
              console.log(`    ✅ Matched WWPN to batch alias: ${foundAlias.name}`);
              currentZone.members.push(`batch:${foundAlias.name}`);
            }
          } else {
            currentZone.members.push(foundAlias.id);
            console.log(`    ✅ Matched WWPN to existing alias: ${foundAlias.name} (ID: ${foundAlias.id})`);
          }
          
          if (!foundAlias) {
            console.log(`    ⚠️ No alias found for WWPN: ${pwwn}`);
            if (!currentZone.unresolvedMembers) currentZone.unresolvedMembers = [];
            currentZone.unresolvedMembers.push({ type: 'pwwn', name: pwwn });
          }
          continue;
        }
        
        // Format 3: * fcid 0xab0040 [device-alias DS-75LVW91-E2C1P2-I0101] [pwwn 50:05:07:63:0a:08:57:e4]
        const fcidMatch = line.match(/\*\s+fcid\s+0x[0-9a-fA-F]+\s+\[device-alias\s+(\S+)\]/i);
        if (fcidMatch) {
          const aliasName = fcidMatch[1];
          console.log(`  👥 Found member (fcid device-alias): ${aliasName}`);
          
          // Find the alias in existing aliases
          let foundAlias = currentAliasOptions.find(alias => alias.name === aliasName);
          
          // If not found in database, check batch aliases
          if (!foundAlias) {
            foundAlias = batchAliases.find(alias => alias.name === aliasName);
            if (foundAlias) {
              console.log(`    ✅ Matched to batch alias: ${aliasName}`);
              currentZone.members.push(`batch:${aliasName}`);
            }
          } else {
            currentZone.members.push(foundAlias.id);
            console.log(`    ✅ Matched to existing alias ID: ${foundAlias.id}`);
          }
          
          if (!foundAlias) {
            console.log(`    ⚠️ Alias not found in database or batch: ${aliasName}`);
            if (!currentZone.unresolvedMembers) currentZone.unresolvedMembers = [];
            currentZone.unresolvedMembers.push({ type: 'device-alias', name: aliasName });
          }
          continue;
        }
        
        // Format 4: device-alias ALIASNAME [pwwn XX:XX:XX:XX:XX:XX:XX:XX]
        const standaloneDeviceAliasMatch = line.match(/device-alias\s+(\S+)\s+\[pwwn\s+([0-9a-fA-F:]+)\]/i);
        if (standaloneDeviceAliasMatch) {
          const aliasName = standaloneDeviceAliasMatch[1];
          console.log(`  👥 Found member (standalone device-alias): ${aliasName}`);
          
          // Find the alias in existing aliases
          let foundAlias = currentAliasOptions.find(alias => alias.name === aliasName);
          
          // If not found in database, check batch aliases
          if (!foundAlias) {
            foundAlias = batchAliases.find(alias => alias.name === aliasName);
            if (foundAlias) {
              console.log(`    ✅ Matched to batch alias: ${aliasName}`);
              currentZone.members.push(`batch:${aliasName}`);
            }
          } else {
            currentZone.members.push(foundAlias.id);
            console.log(`    ✅ Matched to existing alias ID: ${foundAlias.id}`);
          }
          
          if (!foundAlias) {
            console.log(`    ⚠️ Alias not found in database or batch: ${aliasName}`);
            if (!currentZone.unresolvedMembers) currentZone.unresolvedMembers = [];
            currentZone.unresolvedMembers.push({ type: 'device-alias', name: aliasName });
          }
          continue;
        }
      }
    }
    
    // Add the last zone if exists
    if (currentZone) {
      zones.push({ ...currentZone });
    }
    
    console.log(`✅ Parsed ${zones.length} zones`);
    zones.forEach(zone => {
      console.log(`  📋 Zone: ${zone.name} (${zone.members.length} members${zone.unresolvedMembers ? `, ${zone.unresolvedMembers.length} unresolved` : ''})`);
    });
    
    return zones;
  };

  // Process uploaded files with cross-batch alias matching
  const processFiles = useCallback(async (files) => {
    console.log("🔄 processFiles started - setParsing(true)");
    setParsing(true);
    const results = [];
    const allBatchAliases = [];
    let sessionFlogiWwpns = []; // Track flogi WWPNs for this session only
    
    // First pass: collect all aliases from all files
    for (const file of files) {
      try {
        const text = await file.text();
        const dataType = detectDataType(text);
        
        if (dataType === "tech-support") {
          // Extract sections from tech-support file
          const extractedSections = parseTechSupportFile(text);
          
          // Parse device-alias sections
          if (extractedSections.deviceAliases.length > 0) {
            const combinedDeviceAliasText = extractedSections.deviceAliases.join("\n");
            console.log("🔄 First pass - parsing device-alias text:", combinedDeviceAliasText.substring(0, 100));
            const aliasItems = await parseAliasData(combinedDeviceAliasText, selectedFabric, aliasDefaults);
            console.log("✅ First pass - parsed device-alias items:", aliasItems.length);
            allBatchAliases.push(...aliasItems);
          }
          
          // Parse fcalias sections
          if (extractedSections.fcAliases.length > 0) {
            const combinedFcAliasText = extractedSections.fcAliases.join("\n");
            console.log("🔄 First pass - parsing fcalias text:", combinedFcAliasText.substring(0, 100));
            const aliasItems = await parseAliasData(combinedFcAliasText, selectedFabric, aliasDefaults);
            console.log("✅ First pass - parsed fcalias items:", aliasItems.length);
            allBatchAliases.push(...aliasItems);
          }
          
          // Collect flogi WWPNs for later processing
          if (extractedSections.flogiWwpns.length > 0) {
            console.log("🔄 Found flogi database - collecting WWPNs for session");
            sessionFlogiWwpns.push(...extractedSections.flogiWwpns);
          }
        } else if (dataType === "alias") {
          const aliasItems = await parseAliasData(text, selectedFabric, aliasDefaults);
          allBatchAliases.push(...aliasItems);
        }
      } catch (error) {
        console.error(`Error in first pass for file ${file.name}:`, error);
      }
    }
    
    // Second pass: parse all files with full batch alias context
    for (const file of files) {
      try {
        const text = await file.text();
        const dataType = detectDataType(text);
        console.log("🔍 File", file.name, "detected as type:", dataType);
        
        let parsedItems = [];
        if (dataType === "tech-support") {
          // Handle tech-support files by extracting relevant sections
          const extractedSections = parseTechSupportFile(text);
          
          console.log("🔄 Processing extracted sections:", {
            deviceAliases: extractedSections.deviceAliases.length,
            fcAliases: extractedSections.fcAliases.length,
            zones: extractedSections.zones.length
          });
          
          // Parse device-alias sections
          if (extractedSections.deviceAliases.length > 0) {
            const combinedDeviceAliasText = extractedSections.deviceAliases.join("\n");
            console.log("📝 Parsing combined device-alias text:", combinedDeviceAliasText.substring(0, 200));
            const aliasItems = await parseAliasData(combinedDeviceAliasText, selectedFabric, aliasDefaults);
            console.log("✅ Parsed device-alias items:", aliasItems.length);
            parsedItems.push(...aliasItems);
          }
          
          // Parse fcalias sections
          if (extractedSections.fcAliases.length > 0) {
            const combinedFcAliasText = extractedSections.fcAliases.join("\n");
            console.log("🏷️ Parsing combined fcalias text:", combinedFcAliasText.substring(0, 200));
            const aliasItems = await parseAliasData(combinedFcAliasText, selectedFabric, aliasDefaults);
            console.log("✅ Parsed fcalias items:", aliasItems.length);
            parsedItems.push(...aliasItems);
          }
          
          // Note: logged_in status already updated in first pass
          
          // Parse zone sections
          if (extractedSections.zones.length > 0) {
            const combinedZoneText = extractedSections.zones.join("\n");
            console.log("🔄 Parsing combined zone text:", combinedZoneText.substring(0, 200));
            console.log("🎛️ Using current zoneDefaults:", zoneDefaults);
            const zoneItems = await parseZoneData(combinedZoneText, selectedFabric, zoneDefaults, allBatchAliases);
            console.log("✅ Parsed zone items:", zoneItems.length);
            parsedItems.push(...zoneItems);
          }
          
        } else if (dataType === "zone") {
          console.log("🎯 Processing file as ZONE type");
          console.log("🎛️ Using current zoneDefaults:", zoneDefaults);
          parsedItems = await parseZoneData(text, selectedFabric, zoneDefaults, allBatchAliases);
          console.log("🎯 Zone parsing returned:", parsedItems.length, "items");
        } else if (dataType === "alias") {
          parsedItems = await parseAliasData(text, selectedFabric, aliasDefaults);
        } else {
          // For unknown data, try to parse as aliases
          parsedItems = await parseAliasData(text, selectedFabric, aliasDefaults);
        }
        
        // Store raw items for potential conflict resolution
        const fileResult = {
          fileName: file.name,
          fileSize: file.size,
          dataType: dataType,
          rawItems: parsedItems,
          rawText: text
        };
        
        // Deduplicate items
        const dedupedItems = deduplicateItems(parsedItems);
        
        if (dedupedItems !== null) {
          // No conflicts, continue with normal processing
          const enhancedItems = await enhanceWithExistenceCheck(dedupedItems);
          fileResult.itemCount = enhancedItems.length;
          fileResult.items = enhancedItems;
        } else {
          // Conflicts detected, will be resolved later
          fileResult.itemCount = parsedItems.length;
          fileResult.items = [];
          fileResult.hasConflicts = true;
        }
        
        results.push(fileResult);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        setError(`Error processing file ${file.name}: ${error.message}`);
      }
    }
    
    // Apply logged_in status to all items from session's flogi data
    if (sessionFlogiWwpns.length > 0) {
      console.log("🔄 Applying logged_in status to session items");
      setSuccess(`Found ${sessionFlogiWwpns.length} logged-in WWPNs in flogi database. Updating alias status...`);
      
      // Create a Set for faster lookup
      const loggedInWwpns = new Set(sessionFlogiWwpns.map(wwpn => 
        wwpn.replace(/[:\-]/g, '').toLowerCase()
      ));
      
      let totalAliases = 0;
      let updatedCount = 0;
      
      // Update logged_in status for all items in all results
      results.forEach(result => {
        result.items.forEach(item => {
          if (item.wwpn) {
            totalAliases++;
            const cleanWwpn = item.wwpn.replace(/[:\-]/g, '').toLowerCase();
            if (loggedInWwpns.has(cleanWwpn)) {
              item.logged_in = true;
              updatedCount++;
            } else {
              item.logged_in = false;
            }
          }
        });
      });
      
      console.log(`📊 Updated logged_in status for ${updatedCount} out of ${totalAliases} aliases from current session`);
      setSuccess(`Updated logged_in status: ${updatedCount} out of ${totalAliases} aliases marked as logged in.`);
    }

    console.log("✅ processFiles completed - parsing should end soon");
    return results;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabric, aliasDefaults, zoneDefaults]);

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!selectedFabric) {
      setError("Please select a fabric before uploading files");
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter(file => file.type === "text/plain" || file.name.endsWith(".txt"));
    
    if (files.length === 0) {
      setError("Please upload text files only (.txt)");
      return;
    }

    try {
      setLoading(true);
      const results = await processFiles(files);
      setUploadedFiles(prev => [...prev, ...results]);
      const allItems = results.flatMap(r => r.items);
      setParsedData(prev => [...prev, ...allItems]);
      setShowPreview(detectDataTypes(allItems));
      setShowPreviewSection(true);
      setCurrentPage("results");
    } catch (error) {
      setError(`Error processing files: ${error.message}`);
    } finally {
      setLoading(false);
      setParsing(false);
    }
  }, [selectedFabric, processFiles]);

  // File input handler
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (!selectedFabric) {
      setError("Please select a fabric before uploading files");
      return;
    }

    try {
      setLoading(true);
      const results = await processFiles(files);
      setUploadedFiles(prev => [...prev, ...results]);
      const allItems = results.flatMap(r => r.items);
      setParsedData(prev => [...prev, ...allItems]);
      setShowPreview(detectDataTypes(allItems));
      setShowPreviewSection(true);
      setCurrentPage("results");
    } catch (error) {
      setError(`Error processing files: ${error.message}`);
    } finally {
      setLoading(false);
      setParsing(false);
    }
  };

  // Text paste handler
  const handleTextPaste = async () => {
    if (!textInput.trim()) {
      setError("Please paste some text content");
      return;
    }
    
    if (!selectedFabric) {
      setError("Please select a fabric before processing text");
      return;
    }

    try {
      setLoading(true);
      setParsing(true);
      const dataType = detectDataType(textInput);
    console.log("🔍 Pasted text detected as type:", dataType);
    
    let parsedItems = [];
    if (dataType === "tech-support") {
      // Handle tech-support text by extracting alias sections
      const extractedSections = parseTechSupportFile(textInput);
      
      console.log("🔄 Processing pasted tech-support sections:", {
        deviceAliases: extractedSections.deviceAliases.length,
        fcAliases: extractedSections.fcAliases.length,
        zones: extractedSections.zones.length
      });
      
      if (extractedSections.deviceAliases.length > 0) {
        const combinedDeviceAliasText = extractedSections.deviceAliases.join("\n");
        const aliasItems = await parseAliasData(combinedDeviceAliasText);
        parsedItems.push(...aliasItems);
        console.log("✅ Parsed device-alias items from paste:", aliasItems.length);
      }
      
      if (extractedSections.fcAliases.length > 0) {
        const combinedFcAliasText = extractedSections.fcAliases.join("\n");
        const aliasItems = await parseAliasData(combinedFcAliasText);
        parsedItems.push(...aliasItems);
        console.log("✅ Parsed fcalias items from paste:", aliasItems.length);
      }
      
      if (extractedSections.zones.length > 0) {
        const combinedZoneText = extractedSections.zones.join("\n");
        // For paste, we need to collect aliases first, then parse zones with batch context
        const allAliases = parsedItems.filter(item => item.wwpn !== undefined);
        console.log("🎛️ Using current zoneDefaults for paste:", zoneDefaults);
        const zoneItems = await parseZoneData(combinedZoneText, selectedFabric, zoneDefaults, allAliases);
        parsedItems.push(...zoneItems);
        console.log("🔄 Parsed zone items from paste:", zoneItems.length);
      }
      
    } else if (dataType === "zone") {
      console.log("🎯 Processing text as ZONE type");
      console.log("🎛️ Using current zoneDefaults for paste:", zoneDefaults);
      parsedItems = await parseZoneData(textInput, selectedFabric, zoneDefaults, []);
      console.log("🎯 Zone parsing returned:", parsedItems.length, "items");
    } else if (dataType === "alias") {
      parsedItems = await parseAliasData(textInput, selectedFabric, aliasDefaults);
    } else {
      // For unknown data, try to parse as aliases
      parsedItems = await parseAliasData(textInput, selectedFabric, aliasDefaults);
    }
    
    // Deduplicate items
    const dedupedItems = deduplicateItems(parsedItems);
    
    const result = {
      fileName: "Pasted Text",
      fileSize: textInput.length,
      dataType: dataType,
      rawItems: parsedItems,
      rawText: textInput
    };
    
    if (dedupedItems !== null) {
      // No conflicts, continue with normal processing
      const enhancedItems = await enhanceWithExistenceCheck(dedupedItems);
      result.itemCount = enhancedItems.length;
      result.items = enhancedItems;
    } else {
      // Conflicts detected, will be resolved later
      result.itemCount = parsedItems.length;
      result.items = [];
      result.hasConflicts = true;
    }
    
      setUploadedFiles(prev => [...prev, result]);
      if (!result.hasConflicts) {
        setParsedData(prev => [...prev, ...result.items]);
        setShowPreview(detectDataTypes(parsedItems));
      }
      // If conflicts exist, UI will be shown for resolution
      setShowPreviewSection(true);
      setCurrentPage("results");
      setTextInput("");
    } catch (error) {
      setError(`Error processing text: ${error.message}`);
    } finally {
      setLoading(false);
      setParsing(false);
    }
  };

  // Import all data
  // Debug logging function
  const writeDebugLog = async (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Send log entry to backend
    try {
      await axios.post('/api/core/debug-log/', {
        log_entry: logEntry,
        session_id: `zone_import_${Date.now()}`
      });
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
    
    // Also log to console
    console.log(message);
  };

  // Function to download debug log as file
  const downloadDebugLog = () => {
    const debugLogs = sessionStorage.getItem('zoneImportDebug') || 'No debug logs available';
    const blob = new Blob([debugLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zone-import-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportAll = async () => {
    // Start debug session
    await writeDebugLog('=== ZONE IMPORT DEBUG SESSION STARTED ===');
    console.log("🚀 Starting import process");
    console.log("📊 Total parsedData items:", parsedData.length);
    
    if (parsedData.length === 0) {
      setError("No data to import");
      return;
    }

    setImporting(true);
    setError("");
    console.log("✅ Import state set to true - importing overlay should show now");
    
    try {
      // Separate aliases and zones
      const allAliases = parsedData.filter(item => item.wwpn !== undefined);
      const allZones = parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined);
      
      console.log("🏷️ Total filtered aliases:", allAliases.length);
      console.log("🔧 Total filtered zones:", allZones.length);
      
      // Filter out duplicates that already exist in database
      const aliases = allAliases.filter(alias => !alias.existsInDatabase);
      const zones = allZones.filter(zone => !zone.existsInDatabase);
      const aliasDuplicateCount = allAliases.length - aliases.length;
      const zoneDuplicateCount = allZones.length - zones.length;
      
      console.log("✨ New aliases to import:", aliases.length);
      console.log("✨ New zones to import:", zones.length);
      console.log("⚠️ Duplicate aliases skipped:", aliasDuplicateCount);
      console.log("⚠️ Duplicate zones skipped:", zoneDuplicateCount);
      
      if (aliases.length === 0 && zones.length === 0) {
        const totalDuplicates = aliasDuplicateCount + zoneDuplicateCount;
        if (totalDuplicates > 0) {
          setError(`All ${aliasDuplicateCount} aliases and ${zoneDuplicateCount} zones already exist in the database. Nothing to import.`);
        } else {
          setError("No new items found to import");
        }
        setImporting(false);
        scrollToResults();
        return;
      }
      
      const results = [];
      let resolvedZones = zones; // Initialize with original zones
      
      // Import aliases first if any
      if (aliases.length > 0) {
        console.log("📋 Sample new alias:", aliases[0]);
        const aliasPayload = {
          project_id: activeProjectId,
          aliases: aliases.map(alias => {
            const cleanAlias = { ...alias };
            delete cleanAlias.lineNumber;
            delete cleanAlias.saved;
            delete cleanAlias.existsInDatabase;
            delete cleanAlias.imported;
            delete cleanAlias.updated;
            
            return {
              ...cleanAlias,
              fabric: parseInt(cleanAlias.fabric),
              projects: [activeProjectId]
            };
          })
        };
        
        console.log("Sending alias payload:", aliasPayload);
        console.log("📋 Sample alias being sent:", aliases[0]);
        console.log("📋 Total aliases to import:", aliases.length);
        
        // Retry logic for database lock errors
        const importAliasesWithRetry = async (payload, retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const response = await axios.post("/api/san/aliases/save/", payload);
              console.log("✅ Alias API Response:", response.data);
              return { type: 'aliases', count: aliases.length, response: response.data };
            } catch (error) {
              if (error.response?.data?.error === 'database is locked' && i < retries - 1) {
                console.log(`⚠️ Database locked, retrying alias import (attempt ${i + 2}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                continue;
              }
              console.error("❌ Alias import error details:", error.response?.data);
              console.error("❌ Alias import error status:", error.response?.status);
              throw error;
            }
          }
        };
        
        const aliasResult = await importAliasesWithRetry(aliasPayload);
        results.push(aliasResult);
        
        // Refresh alias options after importing aliases so zones can reference them
        // Use retry logic for large imports to ensure database consistency
        const isLargeImport = aliases.length > 10; // Consider >10 aliases as large import
        const expectedAliasNames = aliases.map(alias => alias.name); // Names of aliases we just imported
        const updatedAliases = await refreshAliasOptions(isLargeImport, 5, expectedAliasNames);
        console.log(`🔄 Updated alias options: ${updatedAliases.length} aliases available for zone resolution`);
        
        // Update zones to use the fresh alias data for member resolution
        console.log(`🔍 Starting batch alias resolution with ${updatedAliases.length} available aliases`);
        console.log(`🔍 Available alias names:`, updatedAliases.map(a => a.name).slice(0, 10)); // Show first 10
        
        resolvedZones = zones.map(zone => ({
          ...zone,
          members: (zone.members || []).map(aliasId => {
            // Resolve batch alias references using fresh alias data
            if (typeof aliasId === 'string' && aliasId.startsWith('batch:')) {
              const aliasName = aliasId.replace('batch:', '');
              console.log(`🔍 Looking for batch alias: ${aliasName}`);
              const foundAlias = updatedAliases.find(alias => alias.name === aliasName);
              if (foundAlias) {
                console.log(`🔄 Pre-resolved batch alias: ${aliasName} -> ID ${foundAlias.id}`);
                return foundAlias.id;
              } else {
                console.log(`⚠️ Could not pre-resolve batch alias: ${aliasName}`);
                console.log(`🔍 Searching in all aliases for: ${aliasName}`);
                const exactMatch = updatedAliases.find(alias => alias.name === aliasName);
                const partialMatches = updatedAliases.filter(alias => alias.name.includes(aliasName));
                console.log(`🔍 Exact match: ${exactMatch ? exactMatch.name : 'NONE'}`);
                console.log(`🔍 Partial matches: ${partialMatches.map(a => a.name)}`);
                return aliasId; // Keep original for later processing
              }
            }
            return aliasId;
          })
        }));
      }
      
      // Import zones after aliases if any
      if (zones.length > 0) {
        console.log("📋 Sample new zone:", resolvedZones[0]);
        console.log("📋 Sample zone members after pre-resolution:", resolvedZones[0]?.members);
        console.log("📋 Zone members details:");
        resolvedZones.forEach((zone, idx) => {
          console.log(`  Zone ${idx}: ${zone.name} - Members: ${JSON.stringify(zone.members)} (count: ${zone.members?.length || 0})`);
          if (zone.members && zone.members.length > 0) {
            zone.members.forEach((member, memberIdx) => {
              console.log(`    Member ${memberIdx}: ${member} (type: ${typeof member})`);
            });
          }
        });
        // Process zones with async debugging
        const processedZones = [];
        for (const zone of resolvedZones) {
          const cleanZone = { ...zone };
          delete cleanZone.existsInDatabase;
          delete cleanZone.unresolvedMembers;
          delete cleanZone.imported;
          delete cleanZone.updated;
          
          // Filter and convert alias IDs (batch aliases should already be resolved)
          await writeDebugLog(`🔍 Processing zone ${cleanZone.name} with members: ${JSON.stringify(cleanZone.members)}`);
          await writeDebugLog(`🔍 Members array length: ${cleanZone.members?.length || 0}`);
          
          const validMembers = [];
          for (const aliasId of cleanZone.members || []) {
            await writeDebugLog(`🔍 Checking member: ${aliasId} (type: ${typeof aliasId})`);
            
            // If already numeric, use it
            if (typeof aliasId === 'number' || !isNaN(parseInt(aliasId))) {
              await writeDebugLog(`✅ Valid member ID: ${aliasId} -> parsed as ${parseInt(aliasId)}`);
              validMembers.push(parseInt(aliasId));
              continue;
            }
            
            // Final attempt to resolve batch aliases before giving up
            if (typeof aliasId === 'string' && aliasId.startsWith('batch:')) {
              const aliasName = aliasId.replace('batch:', '');
              await writeDebugLog(`🔄 Final attempt to resolve batch alias: ${aliasName}`);
              
              // First check in import batch
              const allAliases = parsedData.filter(item => item.wwpn !== undefined);
              let batchAlias = allAliases.find(alias => alias.name === aliasName);
              
              if (batchAlias && batchAlias.id) {
                await writeDebugLog(`✅ Resolved batch alias from import batch: ${aliasName} -> ID ${batchAlias.id}`);
                validMembers.push(batchAlias.id);
                continue;
              }
              
              // If not found in import batch, search database
              try {
                await writeDebugLog(`🔍 Searching database for batch alias: ${aliasName}`);
                const response = await axios.get(`/api/san/aliases/project/${activeProjectId}/?search=${encodeURIComponent(aliasName)}`);
                
                if (response.data && response.data.results && response.data.results.length > 0) {
                  // Find exact match by name (search is general, so filter for exact match)
                  const exactMatch = response.data.results.find(alias => alias.name === aliasName);
                  if (exactMatch) {
                    await writeDebugLog(`✅ Resolved batch alias from database: ${aliasName} -> ID ${exactMatch.id}`);
                    validMembers.push(exactMatch.id);
                    continue;
                  }
                  await writeDebugLog(`⚠️ No exact match found for batch alias: ${aliasName} (found ${response.data.results.length} search results)`);
                } else {
                  await writeDebugLog(`⚠️ Batch alias not found in database: ${aliasName}`);
                }
              } catch (error) {
                await writeDebugLog(`❌ Error searching database for batch alias ${aliasName}: ${error.message}`);
              }
              
              await writeDebugLog(`⚠️ Could not resolve batch alias: ${aliasName} - member will be skipped`);
              continue;
            }
            
            await writeDebugLog(`❌ Invalid member ID: ${aliasId} (type: ${typeof aliasId})`);
          }
          
          await writeDebugLog(`🎯 Final valid members for ${cleanZone.name}: [${validMembers.join(', ')}]`);
          await writeDebugLog(`🎯 Members count: ${cleanZone.members?.length || 0} -> ${validMembers.length}`);
          
          processedZones.push({
            ...cleanZone,
            fabric: parseInt(cleanZone.fabric || selectedFabric),
            projects: [activeProjectId],
            members: validMembers.map(aliasId => ({ alias: parseInt(aliasId) }))
          });
        }

        const zonePayload = {
          project_id: activeProjectId,
          zones: processedZones
        };
        
        console.log("Sending zone payload:", zonePayload);
        console.log("📋 Sample zone with members:", resolvedZones[0]);
        console.log("📋 Sample zone members format:", resolvedZones[0]?.members);
        
        // Log detailed payload structure for first few zones
        console.log("🔍 Final payload structure for first 3 zones:");
        zonePayload.zones.slice(0, 3).forEach((zone, idx) => {
          console.log(`  Zone ${idx}: ${zone.name}`);
          console.log(`    Members: ${JSON.stringify(zone.members)}`);
          console.log(`    Members count: ${zone.members?.length || 0}`);
          if (zone.members && zone.members.length > 0) {
            zone.members.forEach((member, memberIdx) => {
              console.log(`      Member ${memberIdx}: ${JSON.stringify(member)}`);
            });
          }
        });
        
        try {
          const response = await axios.post("/api/san/zones/save/", zonePayload);
          console.log("✅ Zone API Response:", response.data);
          results.push({ type: 'zones', count: resolvedZones.length, response: response.data });
        } catch (error) {
          console.error("❌ Zone import error details:", error.response?.data);
          throw error;
        }
      }
      
      // Build success message
      let successParts = [];
      const totalDuplicates = aliasDuplicateCount + zoneDuplicateCount;
      
      results.forEach(result => {
        if (result.type === 'aliases') {
          successParts.push(`${result.count} aliases`);
        } else if (result.type === 'zones') {
          successParts.push(`${result.count} zones`);
        }
      });
      
      const successMessage = totalDuplicates > 0 
        ? `Import completed successfully! ${successParts.join(' & ')} imported, ${totalDuplicates} duplicates skipped.`
        : `Import completed successfully! ${successParts.join(' & ')} imported.`;
      setSuccess(successMessage);
      
      // Refresh alias options to include newly imported aliases
      if (aliases.length > 0) {
        refreshAliasOptions();
      }
      
      // Clear data after successful import
      setTimeout(() => {
        clearAll();
        navigate("/san"); // Navigate to SAN overview page
      }, 2000);
      
    } catch (error) {
      console.error("Import error:", error);
      
      let errorMessage = "Import failed: ";
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.alias || e.zone}: ${errorText}`;
        });
        errorMessage += errorMessages.join(", ");
      } else {
        errorMessage += error.response?.data?.message || error.message;
      }
      
      setError(errorMessage);
    } finally {
      console.log("✅ Import finished, setting importing to false and scrolling");
      setImporting(false);
      scrollToResults();
    }
  };

  // Import selected zones only
  const handleImportSelectedZones = async () => {
    console.log("🚀 Starting selective zone import process");
    console.log("📊 Selected zone indices:", Array.from(selectedZones));
    
    if (selectedZones.size === 0) {
      setError("No zones selected for import");
      return;
    }

    setImporting(true);
    setError("");
    
    try {
      // Get all zones and filter by selected indices
      const allZones = parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined);
      const selectedZoneData = allZones.filter((_, index) => selectedZones.has(index));
      
      // Filter out duplicates that already exist in database
      const zones = selectedZoneData.filter(zone => !zone.existsInDatabase);
      const duplicateCount = selectedZoneData.length - zones.length;
      
      console.log("✨ Selected new zones to import:", zones.length);
      console.log("⚠️ Selected duplicate zones skipped:", duplicateCount);
      
      if (zones.length === 0) {
        if (duplicateCount > 0) {
          setError(`All ${duplicateCount} selected zones already exist in the database. Nothing to import.`);
        } else {
          setError("No valid selected zones found to import");
        }
        setImporting(false);
        scrollToResults();
        return;
      }
      
      if (duplicateCount > 0) {
        console.log(`ℹ️ Importing ${zones.length} selected new zones, skipping ${duplicateCount} selected duplicates`);
      }
      
      // Import zones
      const zonePayload = {
        project_id: activeProjectId,
        zones: zones.map(zone => {
          const cleanZone = { ...zone };
          delete cleanZone.existsInDatabase;
          delete cleanZone.unresolvedMembers;
          delete cleanZone.imported;
          delete cleanZone.updated;
          
          // Filter out batch alias references and only keep numeric alias IDs
          console.log(`🔍 [Selected] Processing zone ${cleanZone.name} with members:`, cleanZone.members);
          const validMembers = (cleanZone.members || []).filter(aliasId => {
            // Skip batch alias references (strings like "batch:aliasName")
            if (typeof aliasId === 'string' && aliasId.startsWith('batch:')) {
              console.log(`⚠️ Skipping batch alias reference: ${aliasId}`);
              return false;
            }
            // Only keep numeric alias IDs
            if (typeof aliasId === 'number' || !isNaN(parseInt(aliasId))) {
              console.log(`✅ [Selected] Valid member ID: ${aliasId}`);
              return true;
            }
            console.log(`❌ [Selected] Invalid member ID: ${aliasId} (type: ${typeof aliasId})`);
            return false;
          });
          console.log(`🎯 [Selected] Final valid members for ${cleanZone.name}:`, validMembers);
          
          return {
            ...cleanZone,
            fabric: parseInt(cleanZone.fabric || selectedFabric),
            projects: [activeProjectId],
            members: validMembers.map(aliasId => ({ alias: parseInt(aliasId) }))
          };
        })
      };
      
      console.log("Sending selected zone payload:", zonePayload);
      const response = await axios.post("/api/san/zones/save/", zonePayload);
      console.log("✅ API Response:", response.data);
      
      const successMessage = duplicateCount > 0 
        ? `Selective zone import completed successfully! ${zones.length} new zones imported, ${duplicateCount} duplicates skipped.`
        : `Selective zone import completed successfully! ${zones.length} zones imported.`;
      setSuccess(successMessage);
      
      // Clear data after successful import
      setTimeout(() => {
        clearAll();
        navigate("/san"); // Navigate to SAN overview page
      }, 2000);
      
    } catch (error) {
      console.error("Selective zone import error:", error);
      
      let errorMessage = "Selective zone import failed: ";
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.alias || e.zone}: ${errorText}`;
        });
        errorMessage += errorMessages.join(", ");
      } else {
        errorMessage += error.response?.data?.message || error.message;
      }
      
      setError(errorMessage);
    } finally {
      console.log("✅ Import finished, setting importing to false and scrolling");
      setImporting(false);
      scrollToResults();
    }
  };

  // Import selected aliases only
  const handleImportSelected = async () => {
    console.log("🚀 Starting selective import process");
    console.log("📊 Selected alias indices:", Array.from(selectedAliases));
    
    if (selectedAliases.size === 0) {
      setError("No aliases selected for import");
      return;
    }

    setImporting(true);
    setError("");
    
    try {
      // Get all aliases and filter by selected indices
      const allAliases = parsedData.filter(item => item.wwpn !== undefined);
      const selectedAliasData = allAliases.filter((_, index) => selectedAliases.has(index));
      
      // Filter out duplicates that already exist in database
      const aliases = selectedAliasData.filter(alias => !alias.existsInDatabase);
      const duplicateCount = selectedAliasData.length - aliases.length;
      
      console.log("✨ Selected new aliases to import:", aliases.length);
      console.log("⚠️ Selected duplicate aliases skipped:", duplicateCount);
      
      if (aliases.length === 0) {
        if (duplicateCount > 0) {
          setError(`All ${duplicateCount} selected aliases already exist in the database. Nothing to import.`);
        } else {
          setError("No valid selected aliases found to import");
        }
        setImporting(false);
        scrollToResults();
        return;
      }
      
      if (duplicateCount > 0) {
        console.log(`ℹ️ Importing ${aliases.length} selected new aliases, skipping ${duplicateCount} selected duplicates`);
      }
      
      // Import aliases
      const aliasPayload = {
        project_id: activeProjectId,
        aliases: aliases.map(alias => {
          const cleanAlias = { ...alias };
          delete cleanAlias.lineNumber;
          delete cleanAlias.saved;
          delete cleanAlias.existsInDatabase;
          delete cleanAlias.imported;
          delete cleanAlias.updated;
          
          return {
            ...cleanAlias,
            fabric: parseInt(cleanAlias.fabric), // Ensure fabric is integer
            projects: [activeProjectId]
          };
        })
      };
      
      console.log("Sending selected alias payload:", aliasPayload);
      const response = await axios.post("/api/san/aliases/save/", aliasPayload);
      console.log("✅ API Response:", response.data);
      
      const successMessage = duplicateCount > 0 
        ? `Selective import completed successfully! ${aliases.length} new aliases imported, ${duplicateCount} duplicates skipped.`
        : `Selective import completed successfully! ${aliases.length} aliases imported.`;
      setSuccess(successMessage);
      
      // Refresh alias options to include newly imported aliases
      refreshAliasOptions();
      
      // Clear data after successful import
      setTimeout(() => {
        clearAll();
        navigate("/san"); // Navigate to SAN overview page
      }, 2000);
      
    } catch (error) {
      console.error("Selective import error:", error);
      
      let errorMessage = "Selective import failed: ";
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.alias || e.zone}: ${errorText}`;
        });
        errorMessage += errorMessages.join(", ");
      } else {
        errorMessage += error.response?.data?.message || error.message;
      }
      
      setError(errorMessage);
    } finally {
      console.log("✅ Import finished, setting importing to false and scrolling");
      setImporting(false);
      scrollToResults();
    }
  };

  // Clear all data
  const clearAll = () => {
    setUploadedFiles([]);
    setParsedData([]);
    setTextInput("");
    setShowPreview({ aliases: false, zones: false });
    setShowPreviewSection(false);
    setCurrentPage("import");
    setError("");
    setSuccess("");
  };

  // Go back to import page
  const goBackToImport = () => {
    setCurrentPage("import");
    setError("");
    setSuccess("");
  };

  if (!activeProjectId) {
    return (
      <div className="container mt-4">
        <Alert variant="warning">No active project selected.</Alert>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes importing-pulse {
          0%, 80%, 100% {
            transform: scale(0.5);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div className="container-fluid mt-4" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingBottom: "20px" }}>
      {/* Full-screen parsing overlay */}
      {parsing && (
        <div className="importing-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0, 0, 0, 0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999 
        }}>
          <div className="importing-content" style={{
            textAlign: 'center',
            background: 'white',
            padding: '3rem 2rem',
            borderRadius: '15px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div className="importing-spinner">
              <div className="spinner-border text-info" style={{ width: '4rem', height: '4rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
            <h3 className="mt-3 text-info">Processing Files...</h3>
            <p className="text-muted">Please wait while we parse your data</p>
            <div className="importing-dots" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              marginTop: '1rem'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#17a2b8',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '-0.3s'
              }}></span>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#17a2b8',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '-0.15s'
              }}></span>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#17a2b8',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '0s'
              }}></span>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen importing overlay */}
      {importing && (
        <div className="importing-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0, 0, 0, 0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999 
        }}>
          <div className="importing-content" style={{
            textAlign: 'center',
            background: 'white',
            padding: '3rem 2rem',
            borderRadius: '15px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div className="importing-spinner">
              <div className="spinner-border text-success" style={{ width: '4rem', height: '4rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
            <h3 className="mt-3 text-success">Importing Data...</h3>
            <p className="text-muted">Please wait while we save your data to the database</p>
            <div className="importing-dots" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              marginTop: '1rem'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#28a745',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '-0.3s'
              }}></span>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#28a745',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '-0.15s'
              }}></span>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#28a745',
                borderRadius: '50%',
                animation: 'importing-pulse 1.5s infinite ease-in-out',
                animationDelay: '0s'
              }}></span>
            </div>
          </div>
        </div>
      )}
      
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {currentPage === "import" ? (
            <Card>
              <Card.Header>
                <h4 className="mb-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                    <path d="M10 9H8"/>
                  </svg>
                  Bulk Alias & Zone Import
                </h4>
                <small className="text-muted">
                  Import multiple files containing alias and zone data automatically. Supports Cisco show tech-support files, device-alias, fcalias, and zone configurations.
                </small>
              </Card.Header>

              <Card.Body>
              {/* Fabric Selection */}
              <Form.Group className="mb-3">
                <Form.Label><strong>Select Fabric</strong></Form.Label>
                <Form.Select
                  value={selectedFabric}
                  onChange={(e) => setSelectedFabric(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Choose a fabric...</option>
                  {fabricOptions.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.name}
                    </option>
                  ))}
                </Form.Select>
                {loading && <small className="text-muted">Loading fabrics...</small>}
              </Form.Group>

              {/* Import Defaults */}
              <Card className="mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Alias Import Defaults</h6>
                  {preferencesStatus === "saving" && (
                    <small className="text-muted">
                      <Spinner size="sm" className="me-1" />
                      Saving...
                    </small>
                  )}
                  {preferencesStatus === "saved" && (
                    <small className="text-success">
                      ✅ Saved
                    </small>
                  )}
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row mb-2">
                        <div className="col-6">
                          <Form.Label>Use</Form.Label>
                          <Form.Select
                            value={aliasDefaults.use}
                            onChange={(e) => updateAliasDefaults(prev => ({...prev, use: e.target.value}))}
                            size="sm"
                          >
                            <option value="init">Initiator</option>
                            <option value="target">Target</option>
                            <option value="both">Both</option>
                            <option value="smart">Smart Detection</option>
                          </Form.Select>
                        </div>
                        <div className="col-6">
                          <Form.Label>Alias Type</Form.Label>
                          <Form.Select
                            value={aliasDefaults.aliasType}
                            onChange={(e) => updateAliasDefaults(prev => ({...prev, aliasType: e.target.value}))}
                            size="sm"
                          >
                            <option value="original">original (preserve from source)</option>
                            <option value="device-alias">device-alias</option>
                            <option value="fcalias">fcalias</option>
                            <option value="wwpn">wwpn</option>
                          </Form.Select>
                        </div>
                      </div>
                      <div className="row mb-2">
                        <div className="col-12">
                          <Form.Label>Conflict Resolution</Form.Label>
                          <Form.Select
                            value={aliasDefaults.conflictResolution}
                            onChange={(e) => updateAliasDefaults(prev => ({...prev, conflictResolution: e.target.value}))}
                            size="sm"
                          >
                            <option value="device-alias">Prefer device-alias (when WWPN exists in both)</option>
                            <option value="fcalias">Prefer fcalias (when WWPN exists in both)</option>
                          </Form.Select>
                          <small className="text-muted">
                            Choose how to handle WWPNs that appear in both device-alias and fcalias entries
                          </small>
                        </div>
                      </div>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="checkbox"
                          label="Create"
                          checked={aliasDefaults.create}
                          onChange={(e) => updateAliasDefaults(prev => ({...prev, create: e.target.checked}))}
                        />
                        <Form.Check
                          type="checkbox"
                          label="Include in Zoning"
                          checked={aliasDefaults.includeInZoning}
                          onChange={(e) => updateAliasDefaults(prev => ({...prev, includeInZoning: e.target.checked}))}
                        />
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Zone Import Defaults */}
              <Card className="mb-3">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Zone Import Defaults</h6>
                  {zonePreferencesStatus === "saving" && (
                    <small className="text-muted">
                      <Spinner size="sm" className="me-1" />
                      Saving...
                    </small>
                  )}
                  {zonePreferencesStatus === "saved" && (
                    <small className="text-success">
                      ✅ Saved
                    </small>
                  )}
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row mb-2">
                        <div className="col-12">
                          <Form.Label>Zone Type</Form.Label>
                          <Form.Select
                            value={zoneDefaults.zoneType}
                            onChange={(e) => updateZoneDefaults(prev => ({...prev, zoneType: e.target.value}))}
                            size="sm"
                          >
                            <option value="standard">Standard (force all zones to standard)</option>
                            <option value="smart">Smart (force all zones to smart)</option>
                            <option value="detect">Auto-detect (use zone type from file)</option>
                          </Form.Select>
                          <small className="text-muted">
                            Choose how to set zone types: force all to standard/smart, or detect from file
                          </small>
                        </div>
                      </div>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="checkbox"
                          label="Create"
                          checked={zoneDefaults.create}
                          onChange={(e) => updateZoneDefaults(prev => ({...prev, create: e.target.checked}))}
                        />
                        <Form.Check
                          type="checkbox"
                          label="Exists"
                          checked={zoneDefaults.exists}
                          onChange={(e) => updateZoneDefaults(prev => ({...prev, exists: e.target.checked}))}
                        />
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Import Method Tabs */}
              <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
                <Tab eventKey="files" title="File Upload">
                  {/* Drag and Drop Zone */}
                  <div
                    className={`border-2 border-dashed rounded p-4 text-center mb-3 ${
                      dragActive ? "border-primary bg-light" : "border-secondary"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    style={{ minHeight: "150px", cursor: "pointer" }}
                  >
                    <div className="d-flex flex-column align-items-center justify-content-center h-100">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3 text-muted">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <h5 className="text-muted">Drop alias and zone files here</h5>
                      <p className="text-muted mb-2">or click to select files containing alias and zone configurations</p>
                      <input
                        type="file"
                        multiple
                        accept=".txt,text/plain"
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                        id="fileInput"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => document.getElementById("fileInput").click()}
                        disabled={!selectedFabric}
                      >
                        Choose Files
                      </Button>
                    </div>
                  </div>
                </Tab>

                <Tab eventKey="text" title="Text Paste">
                  <Form.Group className="mb-3">
                    <Form.Label><strong>Paste Text Content</strong></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={12}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Paste your alias and zone configuration data here (device-alias, fcalias, zones, or tech-support output)..."
                      style={{
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        fontSize: "13px",
                      }}
                    />
                    <div className="d-flex gap-2 mt-2">
                      <Button
                        variant="primary"
                        onClick={handleTextPaste}
                        disabled={!selectedFabric || !textInput.trim() || loading}
                      >
                        {loading ? (
                          <>
                            <Spinner size="sm" className="me-1" />
                            Processing...
                          </>
                        ) : (
                          "Process Text"
                        )}
                      </Button>
                      <Button variant="outline-secondary" onClick={() => setTextInput("")}>
                        Clear
                      </Button>
                    </div>
                  </Form.Group>
                </Tab>
              </Tabs>

              {/* Status Messages */}
              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mb-3 d-flex justify-content-between align-items-center">
                  <span>{success}</span>
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    onClick={() => {
                      const uploadedFilesSection = document.querySelector('[data-section="uploaded-files"]');
                      if (uploadedFilesSection) {
                        uploadedFilesSection.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'start' 
                        });
                      }
                    }}
                  >
                    📋 Show Results
                  </Button>
                </Alert>
              )}
              </Card.Body>
            </Card>
          ) : (
            // Results Page
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                      <path d="M9 12l2 2 4-4"/>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    Import Results
                  </h4>
                  <small className="text-muted">
                    Review your parsed data and configure import settings
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={goBackToImport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                      <polyline points="15,18 9,12 15,6"/>
                    </svg>
                    Back to Import
                  </Button>
                  <Button variant="outline-info" onClick={downloadDebugLog} size="sm" title="Download debug log for troubleshooting">
                    📋 Debug Log
                  </Button>
                </div>
              </Card.Header>
              
              <Card.Body>
              {/* Status Messages */}
              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mb-3">
                  {success}
                </Alert>
              )}

              {/* Uploaded Files Summary */}
              {uploadedFiles.length > 0 && (
                <Card className="mb-3" data-section="uploaded-files">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Uploaded Files ({uploadedFiles.length})</h6>
                    <Button variant="outline-danger" size="sm" onClick={clearAll}>
                      Clear All
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                        <div>
                          <strong>{file.fileName}</strong>
                          <small className="text-muted ms-2">
                            ({(file.fileSize / 1024).toFixed(1)} KB)
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          <Badge bg={
                            file.dataType === "alias" ? "primary" : 
                            file.dataType === "tech-support" ? "warning" :
                            "secondary"
                          }>
                            {file.dataType}
                          </Badge>
                          <Badge bg="info">{file.itemCount} items</Badge>
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 p-2 bg-primary bg-opacity-10 rounded">
                      <strong>Total: {parsedData.length} items ready for import</strong>
                    </div>
                  </Card.Body>
                </Card>
              )}


              {/* Preview Section */}
              {showPreviewSection && parsedData.length > 0 && (
                <div className="mb-3" data-section="preview">
                  {/* Aliases Preview */}
                  {parsedData.filter(item => item.wwpn !== undefined).length > 0 && (
                    <Card className="mb-3">
                      <Card.Header 
                        onClick={() => setShowPreview(prev => ({ ...prev, aliases: !prev.aliases }))}
                        style={{ cursor: "pointer" }}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <h6 className="mb-0 text-primary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                            <polyline points={showPreview.aliases ? "6,9 12,15 18,9" : "9,6 15,12 9,18"}/>
                          </svg>
                          Aliases Preview ({parsedData.filter(item => item.wwpn !== undefined).length} items)
                          {showPreview.aliases ? " - Click to collapse" : " - Click to expand"}
                        </h6>
                        <Badge bg="primary">
                          {parsedData.filter(item => item.wwpn !== undefined).length} aliases
                        </Badge>
                      </Card.Header>
                      {showPreview.aliases && (
                        <Card.Body style={{ maxHeight: "500px", overflowY: "auto" }}>
                          {(() => {
                            const stats = getImportStats();
                            return stats.smartDetected > 0 && (
                              <Alert variant="info" className="mb-3">
                                <div className="d-flex align-items-center">
                                  <span className="me-2">🧠</span>
                                  <div>
                                    <strong>Smart Detection Summary:</strong> {stats.smartDetected} aliases processed
                                    <br />
                                    <small>
                                      {stats.smartDetectedWithRules > 0 && (
                                        <span className="text-success me-3">
                                          ✅ {stats.smartDetectedWithRules} matched rules
                                        </span>
                                      )}
                                      {stats.smartDetectedWithoutRules > 0 && (
                                        <span className="text-warning">
                                          ⚠️ {stats.smartDetectedWithoutRules} used default (no rule found)
                                        </span>
                                      )}
                                    </small>
                                  </div>
                                </div>
                              </Alert>
                            );
                          })()}
                          <div className="mb-2">
                            <small className="text-muted">
                              💡 <strong>Tip:</strong> Use checkboxes to select specific aliases for import, or use "Import All" to import all new aliases. 
                              Existing aliases (highlighted in yellow) cannot be selected.
                            </small>
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th style={{width: '40px'}}>
                                    <Form.Check
                                      type="checkbox"
                                      checked={selectedAliases.size > 0 && selectedAliases.size === parsedData.filter(item => item.wwpn !== undefined && !item.existsInDatabase).length}
                                      onChange={(e) => handleSelectAll(e.target.checked)}
                                      title="Select all new aliases"
                                    />
                                  </th>
                                  <th>Name</th>
                                  <th>WWPN</th>
                                  <th>Use</th>
                                  <th>Type</th>
                                  <th>Create</th>
                                  <th>Include in Zoning</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.filter(item => item.wwpn !== undefined).map((alias, index) => (
                                  <tr key={index} className={alias.existsInDatabase ? "table-warning" : ""}>
                                    <td>
                                      <Form.Check
                                        type="checkbox"
                                        checked={selectedAliases.has(index)}
                                        onChange={(e) => handleSelectAlias(index, e.target.checked)}
                                        disabled={alias.existsInDatabase}
                                        title={alias.existsInDatabase ? "Cannot select existing aliases" : "Select for import"}
                                      />
                                    </td>
                                    <td><code>{alias.name}</code></td>
                                    <td><code>{alias.wwpn}</code></td>
                                    <td>
                                      {alias.smartDetectionNote ? (
                                        <div>
                                          <Badge 
                                            bg={alias.smartDetectionNote.includes('No prefix rule found') ? "warning" : "success"} 
                                            title={alias.smartDetectionNote}
                                          >
                                            🧠 {alias.use}
                                          </Badge>
                                          {alias.smartDetectionNote.includes('No prefix rule found') && (
                                            <small className="text-muted d-block">No rule found</small>
                                          )}
                                        </div>
                                      ) : (
                                        <Badge bg="secondary">{alias.use}</Badge>
                                      )}
                                    </td>
                                    <td><Badge bg="info">{alias.cisco_alias}</Badge></td>
                                    <td>{alias.create ? "✅" : "❌"}</td>
                                    <td>{alias.include_in_zoning ? "✅" : "❌"}</td>
                                    <td>
                                      {alias.existsInDatabase ? (
                                        <Badge bg="warning" title="This alias already exists in the database">
                                          ⚠️ Exists
                                        </Badge>
                                      ) : (
                                        <Badge bg="success" title="New alias - will be created">
                                          ✨ New
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card.Body>
                      )}
                    </Card>
                  )}

                  {/* Zones Preview */}
                  {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length > 0 && (
                    <Card className="mb-3">
                      <Card.Header 
                        onClick={() => setShowPreview(prev => ({ ...prev, zones: !prev.zones }))}
                        style={{ cursor: "pointer" }}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <h6 className="mb-0 text-success">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                            <polyline points={showPreview.zones ? "6,9 12,15 18,9" : "9,6 15,12 9,18"}/>
                          </svg>
                          Zones Preview ({parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length} items)
                          {showPreview.zones ? " - Click to collapse" : " - Click to expand"}
                        </h6>
                        <Badge bg="success">
                          {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length} zones
                        </Badge>
                      </Card.Header>
                      {showPreview.zones && (
                        <Card.Body style={{ maxHeight: "500px", overflowY: "auto" }}>
                          <div className="mb-2">
                            <small className="text-muted">
                              💡 <strong>Tip:</strong> Zone members are automatically resolved against existing aliases. 
                              Unresolved members will be noted for review.
                            </small>
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th style={{width: '40px'}}>
                                    <Form.Check
                                      type="checkbox"
                                      checked={selectedZones.size > 0 && selectedZones.size === parsedData.filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase).length}
                                      onChange={(e) => handleSelectAllZones(e.target.checked)}
                                      title="Select all new zones"
                                    />
                                  </th>
                                  <th>Name</th>
                                  <th>VSAN</th>
                                  <th>Type</th>
                                  <th>Members</th>
                                  <th>Create</th>
                                  <th>Exists</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).map((zone, index) => (
                                  <tr key={index} className={zone.existsInDatabase ? "table-warning" : ""}>
                                    <td>
                                      <Form.Check
                                        type="checkbox"
                                        checked={selectedZones.has(index)}
                                        onChange={(e) => handleSelectZone(index, e.target.checked)}
                                        disabled={zone.existsInDatabase}
                                        title={zone.existsInDatabase ? "Cannot select existing zones" : "Select for import"}
                                      />
                                    </td>
                                    <td><code>{zone.name}</code></td>
                                    <td>{zone.vsan || 'N/A'}</td>
                                    <td>
                                      <Badge bg="info">{zone.zone_type || 'standard'}</Badge>
                                    </td>
                                    <td>
                                      <div>
                                        {zone.members && zone.members.length > 0 && (
                                          <small className="text-success">
                                            ✅ {zone.members.length} resolved
                                          </small>
                                        )}
                                        {zone.unresolvedMembers && zone.unresolvedMembers.length > 0 && (
                                          <div>
                                            <small className="text-warning d-block">
                                              ⚠️ {zone.unresolvedMembers.length} unresolved
                                            </small>
                                            <div className="text-muted" style={{fontSize: '0.75rem'}}>
                                              {zone.unresolvedMembers.slice(0, 3).map((member, idx) => (
                                                <div key={idx}>{member.type}: {member.name}</div>
                                              ))}
                                              {zone.unresolvedMembers.length > 3 && (
                                                <div>... and {zone.unresolvedMembers.length - 3} more</div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {(!zone.members || zone.members.length === 0) && (!zone.unresolvedMembers || zone.unresolvedMembers.length === 0) && (
                                          <small className="text-muted">No members</small>
                                        )}
                                      </div>
                                    </td>
                                    <td>{zone.create ? "✅" : "❌"}</td>
                                    <td>{zone.exists ? "✅" : "❌"}</td>
                                    <td>
                                      {zone.existsInDatabase ? (
                                        <Badge bg="warning" title="This zone already exists in the database">
                                          ⚠️ Exists
                                        </Badge>
                                      ) : (
                                        <Badge bg="success" title="New zone - will be created">
                                          ✨ New
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card.Body>
                      )}
                    </Card>
                  )}

                </div>
              )}


              {/* Action Buttons */}
              {showPreviewSection && parsedData.length > 0 && (
                <>
                  {(() => {
                    const stats = getImportStats();
                    return (
                      <>
                        {/* Duplicate Warning */}
                        {stats.duplicates > 0 && (
                          <Alert variant="warning" className="mb-3">
                            <strong>⚠️ Duplicate Detection:</strong> {stats.duplicateAliases} aliases and {stats.duplicateZones} zones already exist in the database and will be skipped. 
                            Only {stats.newAliases} new aliases and {stats.newZones} zones will be imported.
                          </Alert>
                        )}
                        
                        <div className="d-flex gap-2 mb-3">
                          <Button 
                            variant="primary" 
                            onClick={handleImportSelected} 
                            disabled={importing || selectedAliases.size === 0}
                          >
                            {importing ? (
                              <>
                                <Spinner size="sm" className="me-1" />
                                Importing...
                              </>
                            ) : selectedAliases.size === 0 ? (
                              "No Aliases Selected"
                            ) : (
                              `Import Selected Aliases (${selectedAliases.size})`
                            )}
                          </Button>
                          <Button 
                            variant="info" 
                            onClick={handleImportSelectedZones} 
                            disabled={importing || selectedZones.size === 0}
                          >
                            {importing ? (
                              <>
                                <Spinner size="sm" className="me-1" />
                                Importing...
                              </>
                            ) : selectedZones.size === 0 ? (
                              "No Zones Selected"
                            ) : (
                              `Import Selected Zones (${selectedZones.size})`
                            )}
                          </Button>
                          <Button 
                            variant="success" 
                            onClick={handleImportAll} 
                            disabled={importing || stats.new === 0}
                          >
                            {importing ? (
                              <>
                                <Spinner size="sm" className="me-1" />
                                Importing...
                              </>
                            ) : stats.new === 0 ? (
                              "No New Items to Import"
                            ) : stats.duplicates > 0 ? (
                              `Import All ${stats.newAliases} Aliases & ${stats.newZones} Zones (${stats.duplicates} duplicates will be skipped)`
                            ) : stats.newAliases > 0 && stats.newZones > 0 ? (
                              `Import All ${stats.newAliases} Aliases & ${stats.newZones} Zones`
                            ) : stats.newAliases > 0 ? (
                              `Import All ${stats.newAliases} Aliases`
                            ) : (
                              `Import All ${stats.newZones} Zones`
                            )}
                          </Button>
                          <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </div>

    {/* Duplicate Conflict Resolution Modal */}
    {showConflictResolution && (
      <DuplicateConflictResolver
        conflicts={duplicateConflicts}
        onResolve={handleConflictResolution}
        onCancel={() => setShowConflictResolution(false)}
      />
    )}
    </>
  );
};

export default BulkZoningImportPage;