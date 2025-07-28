import React, { useState, useEffect, useContext, useCallback } from "react";
import { Button, Form, Alert, Card, Spinner, Badge, Tab, Tabs } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import "handsontable/dist/handsontable.full.css";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // File handling state
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [textInput, setTextInput] = useState("");
  
  // Parsed data state
  const [parsedData, setParsedData] = useState([]);
  const [showPreview, setShowPreview] = useState({ aliases: false });
  const [activeTab, setActiveTab] = useState("files");
  const [showPreviewSection, setShowPreviewSection] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState(""); // "", "saving", "saved"
  
  // Import defaults
  const [aliasDefaults, setAliasDefaults] = useState({
    create: true,
    includeInZoning: false,
    use: "init",
    aliasType: "original",
    conflictResolution: "device-alias" // device-alias, fcalias, or both
  });

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Calculate import statistics
  const getImportStats = () => {
    const allAliases = parsedData.filter(item => item.wwpn !== undefined);
    const newAliases = allAliases.filter(alias => !alias.existsInDatabase);
    const duplicateAliases = allAliases.filter(alias => alias.existsInDatabase);
    
    return {
      total: allAliases.length,
      new: newAliases.length,
      duplicates: duplicateAliases.length
    };
  };

  // Update parsed data when defaults change
  useEffect(() => {
    console.log("🔄 aliasDefaults changed:", aliasDefaults);
    console.log("📊 Current parsedData length:", parsedData.length);
    console.log("📁 Current uploadedFiles length:", uploadedFiles.length);
    
    if (parsedData.length > 0) {
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

  // Load aliases when project or fabric changes
  useEffect(() => {
    if (activeProjectId && selectedFabric) {
      axios.get(`/api/san/aliases/project/${activeProjectId}/`)
        .then((res) => {
          // Filter aliases for the selected fabric
          const fabricAliases = res.data.filter(
            (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
          );
          setAliasOptions(fabricAliases);
        })
        .catch((err) => {
          console.error("Error fetching aliases:", err);
        });
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

  // Update alias defaults and save to database
  const updateAliasDefaults = useCallback((updater) => {
    setAliasDefaults(prev => {
      const newDefaults = typeof updater === 'function' ? updater(prev) : updater;
      // Save to database (async, fire and forget)
      savePreferences(newDefaults);
      return newDefaults;
    });
  }, [savePreferences]);

  // Function to refresh alias options after import
  const refreshAliasOptions = useCallback(() => {
    if (activeProjectId && selectedFabric) {
      console.log("🔄 Refreshing alias options after import");
      axios.get(`/api/san/aliases/project/${activeProjectId}/`)
        .then((res) => {
          const fabricAliases = res.data.filter(
            (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
          );
          setAliasOptions(fabricAliases);
          console.log(`✅ Refreshed aliasOptions: ${fabricAliases.length} aliases`);
        })
        .catch((err) => {
          console.error("Error refreshing aliases:", err);
        });
    }
  }, [activeProjectId, selectedFabric]);

  // Deduplicate aliases and handle conflicts
  const deduplicateItems = (items) => {
    const aliasMap = new Map();
    const wwpnConflicts = new Map(); // Track WWPNs that appear in multiple alias types
    
    // First pass: identify conflicts
    items.forEach(item => {
      if (item.wwpn !== undefined) {
        const wwpn = item.wwpn;
        if (!wwpnConflicts.has(wwpn)) {
          wwpnConflicts.set(wwpn, []);
        }
        wwpnConflicts.get(wwpn).push(item);
      }
    });
    
    // Second pass: resolve conflicts and deduplicate
    items.forEach(item => {
      if (item.wwpn !== undefined) {
        const key = `${item.name}_${item.wwpn}`;
        const wwpnEntries = wwpnConflicts.get(item.wwpn);
        
        // Check if there's a conflict (same WWPN, different cisco_alias types)
        const hasConflict = wwpnEntries.length > 1 && 
          new Set(wwpnEntries.map(e => e.cisco_alias)).size > 1;
        
        if (hasConflict) {
          console.log(`⚠️ WWPN conflict detected: ${item.wwpn} exists as both ${wwpnEntries.map(e => e.cisco_alias).join(' and ')}`);
          
          // Apply conflict resolution strategy
          if (aliasDefaults.conflictResolution === "device-alias" && item.cisco_alias !== "device-alias") {
            console.log(`🔄 Skipping ${item.cisco_alias} entry for ${item.name}, preferring device-alias`);
            return; // Skip non-device-alias entries
          } else if (aliasDefaults.conflictResolution === "fcalias" && item.cisco_alias !== "fcalias") {
            console.log(`🔄 Skipping ${item.cisco_alias} entry for ${item.name}, preferring fcalias`);
            return; // Skip non-fcalias entries
          }
          // If "both" is selected, allow all entries through
        }
        
        // Standard deduplication by name and WWPN
        if (!aliasMap.has(key)) {
          aliasMap.set(key, item);
        }
      }
    });
    
    const deduped = [...aliasMap.values()];
    const conflictCount = items.length - deduped.length;
    console.log(`🔄 Deduplication: ${items.length} -> ${deduped.length} aliases (removed ${conflictCount} duplicates/conflicts)`);
    
    if (conflictCount > 0) {
      console.log(`⚙️ Conflict resolution: ${aliasDefaults.conflictResolution}`);
    }
    
    return deduped;
  };

  // Check for existing aliases in database
  const enhanceWithExistenceCheck = async (items) => {
    const aliases = items.filter(item => item.wwpn !== undefined);
    
    // Get fresh alias data from database if needed
    let currentAliasOptions = aliasOptions;
    if (aliasOptions.length === 0 && activeProjectId && selectedFabric) {
      console.log("🔄 aliasOptions is empty, loading fresh data from database...");
      try {
        const res = await axios.get(`/api/san/aliases/project/${activeProjectId}/`);
        const fabricAliases = res.data.filter(
          (alias) => alias.fabric_details?.id === parseInt(selectedFabric)
        );
        currentAliasOptions = fabricAliases;
        setAliasOptions(fabricAliases);
        console.log(`✅ Loaded ${fabricAliases.length} existing aliases from database`);
      } catch (err) {
        console.error("Error loading aliases:", err);
      }
    }
    
    console.log(`🔍 Checking ${aliases.length} aliases against ${currentAliasOptions.length} existing aliases in database`);
    
    // Check aliases for database existence
    const enhancedAliases = aliases.map(alias => {
      const existsInDb = currentAliasOptions.some(existing => 
        existing.name.toLowerCase() === alias.name.toLowerCase() ||
        existing.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '') === alias.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '')
      );
      
      if (existsInDb) {
        console.log(`🎯 Found duplicate: ${alias.name} (${alias.wwpn})`);
      }
      
      return {
        ...alias,
        existsInDatabase: existsInDb
      };
    });
    
    console.log(`✅ Enhanced ${enhancedAliases.length} aliases`);
    console.log(`🔍 Found ${enhancedAliases.filter(a => a.existsInDatabase).length} aliases that exist in database`);
    
    return enhancedAliases;
  };

  // Parse show tech-support files and extract alias sections only
  const parseTechSupportFile = (text) => {
    const lines = text.split("\n");
    const extractedSections = {
      deviceAliases: [],
      fcAliases: []
    };
    
    let currentSection = null;
    let currentVsan = null;
    let sectionLines = [];
    let inTargetSection = false;
    let foundShowDeviceAlias = false;
    
    console.log("🔍 Parsing tech-support file with", lines.length, "lines");
    console.log("🎯 Looking for 'show device-alias database' sections only");
    
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
      
      
      // Detect end of show command sections (next show command or major section break)
      if (inTargetSection && (
          trimmedLine.match(/^-+\s*show\s+(?!(device-alias\s+database))/i) ||
          trimmedLine.match(/^show\s+(?!(device-alias\s+database))/i) ||
          (trimmedLine.startsWith("---") && trimmedLine.length > 10)
        )) {
        if (currentSection && sectionLines.length > 0) {
          processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
        }
        currentSection = null;
        sectionLines = [];
        inTargetSection = false;
        console.log("🏁 Exiting show section at line", i + 1);
        continue;
      }
      
      // Collect lines for current section
      if (inTargetSection && currentSection) {
        sectionLines.push(line);
      }
    }
    
    // Process any remaining section
    if (currentSection && sectionLines.length > 0) {
      processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
    }
    
    console.log("🏆 Tech-support parsing complete. Found:", {
      deviceAliases: extractedSections.deviceAliases.length,
      fcAliases: extractedSections.fcAliases.length
    });
    
    // If section-based parsing didn't find much, try direct pattern extraction as fallback
    const totalFound = extractedSections.deviceAliases.length + extractedSections.fcAliases.length;
    
    if (totalFound === 0 && (deviceAliasCount > 0 || fcAliasCount > 0)) {
      console.log("🔄 Section parsing found nothing, trying direct pattern extraction...");
      
      // Extract device-alias patterns directly
      const deviceAliasMatches = text.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]+/gi) || [];
      extractedSections.deviceAliases = deviceAliasMatches;
      console.log(`📝 Direct extraction found ${deviceAliasMatches.length} device-alias entries`);
      
      // Extract fcalias patterns with their members - more robust approach
      const fcAliasPattern = /fcalias\s+name\s+\S+\s+vsan\s+\d+(?:\r?\n\s+member\s+pwwn\s+[0-9a-fA-F:]+)*/gim;
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
          } else if (currentBlock && line.match(/^\s+member\s+pwwn\s+[0-9a-fA-F:]+/)) {
            // Member line for current fcalias
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
      
    } else {
      // Fallback for other section types
      console.log(`⚠️ Unknown section type: ${sectionType}`);
    }
  };

  // Auto-detect data type (focused on aliases and tech-support)
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
    
    // Count alias patterns
    let aliasPatterns = 0;
    
    for (const line of lines) {
      // Alias patterns - device-alias and fcalias
      if (line.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]/i) ||
          line.match(/fcalias\s+name\s+\S+/i)) {
        aliasPatterns++;
      }
    }
    
    if (aliasPatterns > 0) return "alias";
    return "unknown";
  };

  // Parse alias data (reused from AliasImportPage)
  const parseAliasData = (text, fabricId = selectedFabric, defaults = aliasDefaults) => {
    console.log("🏗️ parseAliasData called with fabricId:", fabricId, typeof fabricId);
    console.log("🎛️ Using defaults:", defaults);
    if (defaults.aliasType === "original") {
      console.log("🔄 Using 'original' mode - preserving source alias types");
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
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Device-alias format
      const deviceMatch = trimmedLine.match(deviceAliasRegex);
      if (deviceMatch) {
        const [, name, wwpn] = deviceMatch;
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        
        aliases.push({
          lineNumber: index + 1,
          name: name,
          wwpn: formattedWWPN,
          fabric: fabricId ? (typeof fabricId === 'number' ? fabricId : parseInt(fabricId)) : null,
          use: defaults.use,
          cisco_alias: defaults.aliasType === "original" ? "device-alias" : defaults.aliasType,
          create: defaults.create,
          include_in_zoning: defaults.includeInZoning,
          notes: "Imported from bulk import",
          imported: new Date().toISOString(),
          updated: null,
          saved: false
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
          use: defaults.use,
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
      
      // FCAlias member - look for member pwwn with more flexible whitespace handling
      const memberRegex = /member\s+pwwn\s+([0-9a-fA-F:]+)/i;
      const memberMatch = line.match(memberRegex); // Use original line, not trimmed, to handle indentation
      if (memberMatch && currentFcAlias) {
        const [, wwpn] = memberMatch;
        console.log(`    📝 Found member for ${currentFcAlias.name}: ${wwpn}`);
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        currentFcAlias.wwpn = formattedWWPN;
        aliases.push({ ...currentFcAlias });
        console.log(`    ✅ Added fcalias: ${currentFcAlias.name} -> ${formattedWWPN}`);
        currentFcAlias = null;
      }
    });
    
    return aliases;
  };


  // Process uploaded files with cross-batch alias matching
  const processFiles = useCallback(async (files) => {
    const results = [];
    const allBatchAliases = [];
    
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
            const aliasItems = parseAliasData(combinedDeviceAliasText, selectedFabric, aliasDefaults);
            console.log("✅ First pass - parsed device-alias items:", aliasItems.length);
            allBatchAliases.push(...aliasItems);
          }
          
          // Parse fcalias sections
          if (extractedSections.fcAliases.length > 0) {
            const combinedFcAliasText = extractedSections.fcAliases.join("\n");
            console.log("🔄 First pass - parsing fcalias text:", combinedFcAliasText.substring(0, 100));
            const aliasItems = parseAliasData(combinedFcAliasText, selectedFabric, aliasDefaults);
            console.log("✅ First pass - parsed fcalias items:", aliasItems.length);
            allBatchAliases.push(...aliasItems);
          }
        } else if (dataType === "alias") {
          const aliasItems = parseAliasData(text, selectedFabric, aliasDefaults);
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
        
        let parsedItems = [];
        if (dataType === "tech-support") {
          // Handle tech-support files by extracting relevant sections
          const extractedSections = parseTechSupportFile(text);
          
          console.log("🔄 Processing extracted sections:", {
            deviceAliases: extractedSections.deviceAliases.length,
            fcAliases: extractedSections.fcAliases.length
          });
          
          // Parse device-alias sections
          if (extractedSections.deviceAliases.length > 0) {
            const combinedDeviceAliasText = extractedSections.deviceAliases.join("\n");
            console.log("📝 Parsing combined device-alias text:", combinedDeviceAliasText.substring(0, 200));
            const aliasItems = parseAliasData(combinedDeviceAliasText, selectedFabric, aliasDefaults);
            console.log("✅ Parsed device-alias items:", aliasItems.length);
            parsedItems.push(...aliasItems);
          }
          
          // Parse fcalias sections
          if (extractedSections.fcAliases.length > 0) {
            const combinedFcAliasText = extractedSections.fcAliases.join("\n");
            console.log("🏷️ Parsing combined fcalias text:", combinedFcAliasText.substring(0, 200));
            const aliasItems = parseAliasData(combinedFcAliasText, selectedFabric, aliasDefaults);
            console.log("✅ Parsed fcalias items:", aliasItems.length);
            parsedItems.push(...aliasItems);
          }
          
        } else if (dataType === "alias") {
          parsedItems = parseAliasData(text, selectedFabric, aliasDefaults);
        } else {
          // For unknown data, try to parse as aliases
          parsedItems = parseAliasData(text, selectedFabric, aliasDefaults);
        }
        
        // Deduplicate items
        const dedupedItems = deduplicateItems(parsedItems);
        
        // Enhance with existence check and cross-referencing
        const enhancedItems = await enhanceWithExistenceCheck(dedupedItems);
        
        results.push({
          fileName: file.name,
          fileSize: file.size,
          dataType: dataType,
          itemCount: enhancedItems.length,
          items: enhancedItems,
          rawText: text
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        setError(`Error processing file ${file.name}: ${error.message}`);
      }
    }
    
    return results;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabric, aliasDefaults]);

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

    setLoading(true);
    const results = await processFiles(files);
    setUploadedFiles(prev => [...prev, ...results]);
    setParsedData(prev => [...prev, ...results.flatMap(r => r.items)]);
    setLoading(false);
    setShowPreview({ aliases: true });
    setShowPreviewSection(true);
  }, [selectedFabric, processFiles]);

  // File input handler
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (!selectedFabric) {
      setError("Please select a fabric before uploading files");
      return;
    }

    setLoading(true);
    const results = await processFiles(files);
    setUploadedFiles(prev => [...prev, ...results]);
    setParsedData(prev => [...prev, ...results.flatMap(r => r.items)]);
    setLoading(false);
    setShowPreview({ aliases: true });
    setShowPreviewSection(true);
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

    setLoading(true);
    const dataType = detectDataType(textInput);
    
    let parsedItems = [];
    if (dataType === "tech-support") {
      // Handle tech-support text by extracting alias sections
      const extractedSections = parseTechSupportFile(textInput);
      
      console.log("🔄 Processing pasted tech-support sections:", {
        deviceAliases: extractedSections.deviceAliases.length,
        fcAliases: extractedSections.fcAliases.length
      });
      
      if (extractedSections.deviceAliases.length > 0) {
        const combinedDeviceAliasText = extractedSections.deviceAliases.join("\n");
        const aliasItems = parseAliasData(combinedDeviceAliasText);
        parsedItems.push(...aliasItems);
        console.log("✅ Parsed device-alias items from paste:", aliasItems.length);
      }
      
      if (extractedSections.fcAliases.length > 0) {
        const combinedFcAliasText = extractedSections.fcAliases.join("\n");
        const aliasItems = parseAliasData(combinedFcAliasText);
        parsedItems.push(...aliasItems);
        console.log("✅ Parsed fcalias items from paste:", aliasItems.length);
      }
      
    } else if (dataType === "alias") {
      parsedItems = parseAliasData(textInput, selectedFabric, aliasDefaults);
    } else {
      // For unknown data, try to parse as aliases
      parsedItems = parseAliasData(textInput, selectedFabric, aliasDefaults);
    }
    
    // Deduplicate items
    const dedupedItems = deduplicateItems(parsedItems);
    
    // Enhance with existence check and cross-referencing
    const enhancedItems = await enhanceWithExistenceCheck(dedupedItems);
    
    const result = {
      fileName: "Pasted Text",
      fileSize: textInput.length,
      dataType: dataType,
      itemCount: enhancedItems.length,
      items: enhancedItems,
      rawText: textInput
    };
    
    setUploadedFiles(prev => [...prev, result]);
    setParsedData(prev => [...prev, ...enhancedItems]);
    setLoading(false);
    setShowPreview({ aliases: true });
    setShowPreviewSection(true);
    setTextInput("");
  };

  // Import all data
  const handleImportAll = async () => {
    console.log("🚀 Starting import process");
    console.log("📊 Total parsedData items:", parsedData.length);
    
    if (parsedData.length === 0) {
      setError("No data to import");
      return;
    }

    setImporting(true);
    setError("");
    console.log("✅ Import state set to true");
    
    try {
      // Get aliases only
      const allAliases = parsedData.filter(item => item.wwpn !== undefined);
      console.log("🏷️ Total filtered aliases:", allAliases.length);
      
      // Filter out duplicates that already exist in database
      const aliases = allAliases.filter(alias => !alias.existsInDatabase);
      const duplicateCount = allAliases.length - aliases.length;
      
      console.log("✨ New aliases to import:", aliases.length);
      console.log("⚠️ Duplicate aliases skipped:", duplicateCount);
      if (aliases.length > 0) {
        console.log("📋 Sample new alias:", aliases[0]);
      }
      
      if (aliases.length === 0) {
        if (duplicateCount > 0) {
          setError(`All ${duplicateCount} aliases already exist in the database. Nothing to import.`);
        } else {
          setError("No aliases found to import");
        }
        setImporting(false);
        return;
      }
      
      if (duplicateCount > 0) {
        console.log(`ℹ️ Importing ${aliases.length} new aliases, skipping ${duplicateCount} duplicates`);
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
      
      console.log("Sending alias payload:", aliasPayload);
      const response = await axios.post("/api/san/aliases/save/", aliasPayload);
      console.log("✅ API Response:", response.data);
      
      const successMessage = duplicateCount > 0 
        ? `Import completed successfully! ${aliases.length} new aliases imported, ${duplicateCount} duplicates skipped.`
        : `Import completed successfully! ${aliases.length} aliases imported.`;
      setSuccess(successMessage);
      
      // Refresh alias options to include newly imported aliases
      refreshAliasOptions();
      
      // Clear data after successful import
      setTimeout(() => {
        clearAll();
        navigate("/san/aliases"); // Navigate to aliases page or dashboard
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
      setImporting(false);
    }
  };

  // Clear all data
  const clearAll = () => {
    setUploadedFiles([]);
    setParsedData([]);
    setTextInput("");
    setShowPreview({ aliases: false });
    setShowPreviewSection(false);
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
    <div className="container-fluid mt-4" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingBottom: "50px" }}>
      <div className="row justify-content-center">
        <div className="col-lg-10">
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
                Bulk Alias Import
              </h4>
              <small className="text-muted">
                Import multiple files containing alias data automatically. Supports Cisco show tech-support files, device-alias, and fcalias configurations.
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
                            <option value="both">Import both (create separate entries)</option>
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
                      <h5 className="text-muted">Drop alias files here</h5>
                      <p className="text-muted mb-2">or click to select files containing alias configurations</p>
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
                      placeholder="Paste your alias configuration data here (device-alias, fcalias, or tech-support output)..."
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
                <Alert variant="success" className="mb-3">
                  {success}
                </Alert>
              )}

              {/* Uploaded Files Summary */}
              {uploadedFiles.length > 0 && (
                <Card className="mb-3">
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
                <div className="mb-3">
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
                        <Card.Body style={{ maxHeight: "400px", overflowY: "auto" }}>
                          <div className="table-responsive">
                            <table className="table table-sm">
                              <thead>
                                <tr>
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
                                    <td><code>{alias.name}</code></td>
                                    <td><code>{alias.wwpn}</code></td>
                                    <td><Badge bg="secondary">{alias.use}</Badge></td>
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
                            <strong>⚠️ Duplicate Detection:</strong> {stats.duplicates} aliases already exist in the database and will be skipped. 
                            Only {stats.new} new aliases will be imported.
                          </Alert>
                        )}
                        
                        <div className="d-flex gap-2">
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
                              "No New Aliases to Import"
                            ) : stats.duplicates > 0 ? (
                              `Import ${stats.new} New Aliases (${stats.duplicates} duplicates will be skipped)`
                            ) : (
                              `Import All ${stats.new} Aliases`
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
        </div>
      </div>
    </div>
  );
};

export default BulkZoningImportPage;