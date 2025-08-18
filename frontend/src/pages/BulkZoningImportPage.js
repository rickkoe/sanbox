import React, { useState, useEffect, useContext, useCallback } from "react";
import { Button, Alert, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import "handsontable/dist/handsontable.full.css";
import {
  ImportHeader,
  ImportDefaults,
  ImportTabs,
  UploadedFilesList,
  PreviewSection,
  ImportActions,
  ImportOverlay
} from "../components/bulk-import";
import { useBulkImport } from "../utils/useBulkImport";
import { getImportStats } from "../utils/dataProcessing";
import { parseAliasData } from "../utils/aliasParser";
import { parseZoneData } from "../utils/zoneParser";
import { detectDataType } from "../utils/techSupportParser";
import { importAliases, importZones, refreshAliasOptions } from "../services/bulkImportApi";

const BulkZoningImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  
  // Basic state
  const [fabricOptions, setFabricOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [textInput, setTextInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState({ aliases: false, zones: false });
  const [activeTab, setActiveTab] = useState("files");
  const [showPreviewSection, setShowPreviewSection] = useState(false);
  const [currentPage, setCurrentPage] = useState("import");
  const [textLoading, setTextLoading] = useState(false);
  
  // Import defaults
  const [aliasDefaults, setAliasDefaults] = useState({
    create: true,
    includeInZoning: false,
    use: "init",
    aliasType: "original",
    conflictResolution: "device-alias"
  });

  const [zoneDefaults, setZoneDefaults] = useState({
    create: true,
    exists: false,
    zoneType: "standard"
  });

  // Selected aliases and zones for selective import
  const [selectedAliases, setSelectedAliases] = useState(new Set());
  const [selectedZones, setSelectedZones] = useState(new Set());

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Use the bulk import hook
  const {
    uploadedFiles,
    parsedData,
    loading,
    parsing,
    importing,
    aliasOptions,
    setImporting,
    setParsedData,
    processFiles
  } = useBulkImport(selectedFabric, aliasDefaults, zoneDefaults);

  // Auto-scroll to results when import finishes
  const scrollToResults = () => {
    console.log("🔄 scrollToResults called - starting scroll in 500ms");
    setTimeout(() => {
      let targetSection = document.querySelector('[data-section="uploaded-files"]');
      if (!targetSection) {
        targetSection = document.querySelector('[data-section="preview"]');
      }
      if (targetSection) {
        console.log("✅ Found target section, scrolling now");
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
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

  // Load existing preferences on mount
  useEffect(() => {
    if (activeCustomerId) {
      const loadPreferences = async () => {
        try {
          // Load alias preferences
          const aliasParams = new URLSearchParams({
            customer: activeCustomerId,
            table_name: 'bulk_import_alias_defaults'
          });
          const aliasResponse = await axios.get(`/api/core/table-config/?${aliasParams.toString()}`);
          
          if (aliasResponse.data && aliasResponse.data.customer) {
            const savedConfig = aliasResponse.data;
            const savedAliasDefaults = savedConfig.additional_settings || {};
            setAliasDefaults({
              create: savedAliasDefaults.create ?? true,
              includeInZoning: savedAliasDefaults.includeInZoning ?? false,
              use: savedAliasDefaults.use ?? "init",
              aliasType: savedAliasDefaults.aliasType ?? "original",
              conflictResolution: savedAliasDefaults.conflictResolution ?? "device-alias"
            });
            console.log("Loaded existing alias preferences:", savedAliasDefaults);
          }

          // Load zone preferences
          const zoneParams = new URLSearchParams({
            customer: activeCustomerId,
            table_name: 'bulk_import_zone_defaults'
          });
          const zoneResponse = await axios.get(`/api/core/table-config/?${zoneParams.toString()}`);
          
          if (zoneResponse.data && zoneResponse.data.customer) {
            const savedConfig = zoneResponse.data;
            const savedZoneDefaults = savedConfig.additional_settings || {};
            setZoneDefaults({
              create: savedZoneDefaults.create ?? true,
              exists: savedZoneDefaults.exists ?? false,
              zoneType: savedZoneDefaults.zoneType ?? "standard"
            });
            console.log("Loaded existing zone preferences:", savedZoneDefaults);
          }
          
          // Mark preferences as loaded to enable auto-save
          setPreferencesLoaded(true);
        } catch (error) {
          console.error("Error loading preferences:", error);
          // Continue with default values if loading fails
          setPreferencesLoaded(true);
        }
      };
      
      loadPreferences();
    }
  }, [activeCustomerId]);

  // Auto-save preferences when they change (but not on initial load)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  
  useEffect(() => {
    // Only auto-save if preferences have been loaded and this isn't the initial load
    if (activeCustomerId && aliasDefaults && preferencesLoaded) {
      const saveAliasPreferences = async () => {
        const payload = {
          customer: activeCustomerId,
          table_name: 'bulk_import_alias_defaults',
          visible_columns: [],
          column_widths: {},
          filters: {},
          sorting: {},
          page_size: 25,
          additional_settings: aliasDefaults
        };
        
        try {
          await axios.post('/api/core/table-config/', payload);
          console.log("Alias preferences auto-saved");
        } catch (error) {
          console.error("Error auto-saving alias preferences:", error);
        }
      };
      
      // Add a small delay to prevent auto-save during the initial state setting
      const timeoutId = setTimeout(saveAliasPreferences, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [aliasDefaults, activeCustomerId, preferencesLoaded]);

  useEffect(() => {
    // Only auto-save if preferences have been loaded and this isn't the initial load
    if (activeCustomerId && zoneDefaults && preferencesLoaded) {
      const saveZonePreferences = async () => {
        const payload = {
          customer: activeCustomerId,
          table_name: 'bulk_import_zone_defaults',
          visible_columns: [],
          column_widths: {},
          filters: {},
          sorting: {},
          page_size: 25,
          additional_settings: zoneDefaults
        };
        
        try {
          await axios.post('/api/core/table-config/', payload);
          console.log("Zone preferences auto-saved");
        } catch (error) {
          console.error("Error auto-saving zone preferences:", error);
        }
      };
      
      // Add a small delay to prevent auto-save during the initial state setting
      // Use a longer delay for zone preferences to avoid race condition with alias preferences
      const timeoutId = setTimeout(saveZonePreferences, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [zoneDefaults, activeCustomerId, preferencesLoaded]);

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
    console.log("🔄 handleDrop called", e.dataTransfer.files);
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!selectedFabric) {
      setError("Please select a fabric before uploading files");
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      console.log("📁 Dropped files:", files);
      console.log("🔧 About to call processFiles with:", files);
      try {
        console.log("🔄 Calling processFiles...");
        await processFiles(files);
        console.log("✅ processFiles completed successfully");
        setShowPreviewSection(true);
        setSuccess(`Successfully processed ${files.length} file(s)`);
        scrollToResults();
      } catch (error) {
        console.error("❌ Error in processFiles:", error);
        setError("Error processing files: " + error.message);
      }
    }
  }, [selectedFabric, processFiles]);

  const handleFileSelect = async (e) => {
    console.log("🔄 handleFileSelect called", e.target.files);
    if (!selectedFabric) {
      setError("Please select a fabric before selecting files");
      return;
    }

    const files = Array.from(e.target.files);
    console.log("📁 Selected files:", files);
    if (files.length > 0) {
      try {
        await processFiles(files);
        setShowPreviewSection(true);
        setSuccess(`Successfully processed ${files.length} file(s)`);
        scrollToResults();
      } catch (error) {
        setError("Error processing files: " + error.message);
      }
    }
  };

  const handleTextPaste = async () => {
    if (!selectedFabric) {
      setError("Please select a fabric before processing text");
      return;
    }

    if (!textInput.trim()) {
      setError("Please paste some text content to process");
      return;
    }

    try {
      setTextLoading(true);
      const dataType = detectDataType(textInput);
      
      let parsedItems = [];
      if (dataType === 'alias') {
        parsedItems = await parseAliasData(textInput, selectedFabric, aliasDefaults);
      } else if (dataType === 'zone') {
        parsedItems = await parseZoneData(textInput, selectedFabric, zoneDefaults, aliasOptions);
      }

      setParsedData(parsedItems);
      setShowPreviewSection(true);
      setSuccess(`Successfully processed ${parsedItems.length} items from text input`);
      scrollToResults();
    } catch (error) {
      setError("Error processing text: " + error.message);
    } finally {
      setTextLoading(false);
    }
  };

  // Simplified import handlers (complex logic moved to separate utilities)
  const handleImportSelected = async () => {
    setImporting(true);
    setError("");
    try {
      // Get selected items from parsed data
      const selectedAliasItems = Array.from(selectedAliases)
        .map(index => parsedData.filter(item => item.wwpn !== undefined && !item.existsInDatabase)[index])
        .filter(Boolean);
      const selectedZoneItems = Array.from(selectedZones)
        .map(index => parsedData.filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase)[index])
        .filter(Boolean);
      
      console.log("Importing selected items:", { aliases: selectedAliasItems.length, zones: selectedZoneItems.length });
      
      let importedAliases = 0;
      let importedZones = 0;
      
      // Import selected aliases if any
      if (selectedAliasItems.length > 0) {
        await importAliases(selectedAliasItems, activeProjectId);
        importedAliases = selectedAliasItems.length;
      }
      
      // Import selected zones if any
      if (selectedZoneItems.length > 0) {
        await importZones(selectedZoneItems, activeProjectId);
        importedZones = selectedZoneItems.length;
      }
      
      setSuccess(`Successfully imported ${importedAliases} aliases and ${importedZones} zones`);
    } catch (error) {
      setError("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportAll = async () => {
    setImporting(true);
    setError("");
    try {
      const stats = getImportStats(parsedData);
      console.log("Importing all new items:", stats);
      
      // Filter out items that already exist in the database
      const newAliases = parsedData.filter(item => item.wwpn !== undefined && !item.existsInDatabase);
      const newZones = parsedData.filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase);
      
      let importedAliases = 0;
      let importedZones = 0;
      
      // Import aliases if any
      if (newAliases.length > 0) {
        await importAliases(newAliases, activeProjectId);
        importedAliases = newAliases.length;
      }
      
      // Import zones if any
      if (newZones.length > 0) {
        // After importing aliases, we need to refresh alias options to get the new IDs
        // and re-resolve zone members against the updated alias list
        console.log('🔄 Refreshing aliases after import to resolve zone members');
        const updatedAliasOptions = await refreshAliasOptions(selectedFabric);
        console.log(`🔄 Got ${updatedAliasOptions.length} updated aliases from database`);
        
        // Show sample of what we got back
        if (updatedAliasOptions.length > 0) {
          console.log('Sample updated aliases:', updatedAliasOptions.slice(0, 3).map(a => ({id: a.id, name: a.name, wwpn: a.wwpn})));
        }
        
        // Re-resolve zone members with the updated alias list (now with IDs)
        const { resolveZoneMembers } = await import('../utils/dataProcessing');
        const resolvedZones = resolveZoneMembers(newZones, [], updatedAliasOptions);
        
        console.log(`🔄 Re-resolved ${resolvedZones.length} zones`);
        if (resolvedZones.length > 0) {
          console.log('Sample resolved zone:', {
            name: resolvedZones[0].name,
            members: resolvedZones[0].members?.length || 0,
            resolvedMembers: resolvedZones[0].resolvedMembers?.length || 0,
            sampleResolvedMember: resolvedZones[0].resolvedMembers?.[0]
          });
        }
        
        await importZones(resolvedZones, activeProjectId);
        importedZones = newZones.length;
      }
      
      setSuccess(`Successfully imported ${importedAliases} aliases and ${importedZones} zones`);
    } catch (error) {
      setError("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportSelectedZones = async () => {
    setImporting(true);
    setError("");
    try {
      // Get selected zone items from parsed data (only new zones)
      const selectedZoneItems = Array.from(selectedZones)
        .map(index => parsedData.filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase)[index])
        .filter(Boolean);
      
      console.log("Importing selected zones:", selectedZoneItems.length);
      
      if (selectedZoneItems.length > 0) {
        await importZones(selectedZoneItems, activeProjectId);
        setSuccess(`Successfully imported ${selectedZoneItems.length} zones`);
      } else {
        setSuccess("No zones selected for import");
      }
    } catch (error) {
      setError("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Load fabrics on mount
  useEffect(() => {
    const loadFabrics = async () => {
      try {
        const response = await axios.get('/api/san/fabrics/');
        setFabricOptions(response.data.results || response.data || []);
      } catch (error) {
        console.error("Error loading fabrics:", error);
        setError("Failed to load fabrics");
      }
    };
    
    if (activeProjectId) {
      loadFabrics();
    }
  }, [activeProjectId]);

  if (!activeProjectId) {
    return (
      <div className="container mt-4">
        <Alert variant="warning">No active project selected.</Alert>
      </div>
    );
  }

  return (
    <>
      <ImportOverlay parsing={parsing} importing={importing} />
      <div className="container-fluid mt-4" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingBottom: "20px" }}>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {currentPage === "import" ? (
            <>
              <ImportHeader
                selectedFabric={selectedFabric}
                setSelectedFabric={setSelectedFabric}
                fabricOptions={fabricOptions}
                loading={loading}
              />
              
              <Card>
                <Card.Body>
                <ImportDefaults
                  aliasDefaults={aliasDefaults}
                  setAliasDefaults={setAliasDefaults}
                  zoneDefaults={zoneDefaults}
                  setZoneDefaults={setZoneDefaults}
                />

                <ImportTabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  dragActive={dragActive}
                  selectedFabric={selectedFabric}
                  handleDrag={handleDrag}
                  handleDrop={handleDrop}
                  handleFileSelect={handleFileSelect}
                  textInput={textInput}
                  setTextInput={setTextInput}
                  loading={textLoading}
                  handleTextPaste={handleTextPaste}
                />

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
                      View Results
                    </Button>
                  </Alert>
                )}

                <UploadedFilesList uploadedFiles={uploadedFiles} parsedData={parsedData} />

                <PreviewSection
                  showPreviewSection={showPreviewSection}
                  parsedData={parsedData}
                  showPreview={showPreview}
                  setShowPreview={setShowPreview}
                  selectedAliases={selectedAliases}
                  selectedZones={selectedZones}
                  handleSelectAlias={handleSelectAlias}
                  handleSelectAll={handleSelectAll}
                  handleSelectZone={handleSelectZone}
                  handleSelectAllZones={handleSelectAllZones}
                  getImportStats={() => getImportStats(parsedData)}
                />

                <ImportActions
                  showPreviewSection={showPreviewSection}
                  parsedData={parsedData}
                  getImportStats={() => getImportStats(parsedData)}
                  importing={importing}
                  selectedAliases={selectedAliases}
                  selectedZones={selectedZones}
                  handleImportSelected={handleImportSelected}
                  handleImportAll={handleImportAll}
                  handleImportSelectedZones={handleImportSelectedZones}
                />
                </Card.Body>
              </Card>
            </>
          ) : (
            <div>Results page content here...</div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default BulkZoningImportPage;