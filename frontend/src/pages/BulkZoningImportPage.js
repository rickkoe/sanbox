import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { Button, Form, Alert, Card, Spinner, Badge, Tab, Tabs } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";

const BulkZoningImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  
  // Basic state
  const [fabricOptions, setFabricOptions] = useState([]);
  const [aliasOptions, setAliasOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
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
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("files");
  const [showPreviewSection, setShowPreviewSection] = useState(false);
  const [unmatchedWWPNs, setUnmatchedWWPNs] = useState([]);
  
  // Import defaults
  const [aliasDefaults, setAliasDefaults] = useState({
    create: true,
    includeInZoning: false,
    use: "init",
    aliasType: "device-alias"
  });
  
  const [zoneDefaults, setZoneDefaults] = useState({
    create: true,
    exists: false,
    zoneType: "standard"
  });

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics
  useEffect(() => {
    if (activeCustomerId) {
      setLoading(true);
      axios.get(`/api/san/fabrics/?customer_id=${activeCustomerId}`)
        .then((response) => {
          setFabricOptions(response.data);
          if (response.data.length > 0) {
            setSelectedFabric(response.data[0].id);
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

  // Auto-detect data type
  const detectDataType = (text) => {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("!"));
    
    // Count different patterns
    let aliasPatterns = 0;
    let zonePatterns = 0;
    
    for (const line of lines) {
      // Alias patterns
      if (line.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]/i) ||
          line.match(/fcalias\s+name\s+\S+\s+vsan\s+\d+/i)) {
        aliasPatterns++;
      }
      
      // Zone patterns
      if (line.match(/zone\s+name\s+\S+\s+vsan\s+\d+/i) ||
          line.match(/zoneset\s+name\s+\S+\s+vsan\s+\d+/i) ||
          line.match(/member\s+pwwn\s+[0-9a-fA-F:]/i)) {
        zonePatterns++;
      }
    }
    
    if (aliasPatterns > zonePatterns) return "alias";
    if (zonePatterns > aliasPatterns) return "zone";
    return "mixed"; // Or could be empty/unknown
  };

  // Parse alias data (reused from AliasImportPage)
  const parseAliasData = (text) => {
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
          fabric: selectedFabric,
          use: aliasDefaults.use,
          cisco_alias: aliasDefaults.aliasType,
          create: aliasDefaults.create,
          include_in_zoning: aliasDefaults.includeInZoning,
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
        currentFcAlias = {
          lineNumber: index + 1,
          name: name,
          vsan: parseInt(vsan),
          fabric: selectedFabric,
          use: aliasDefaults.use,
          cisco_alias: "fcalias",
          create: aliasDefaults.create,
          include_in_zoning: aliasDefaults.includeInZoning,
          notes: `Imported from bulk import (VSAN ${vsan})`,
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
          wwpn: "" // Will be filled by member line
        };
      }
      
      // FCAlias member
      const memberRegex = /member\s+pwwn\s+([0-9a-fA-F:]{23})/i;
      const memberMatch = trimmedLine.match(memberRegex);
      if (memberMatch && currentFcAlias) {
        const [, wwpn] = memberMatch;
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        currentFcAlias.wwpn = formattedWWPN;
        aliases.push({ ...currentFcAlias });
        currentFcAlias = null;
      }
    });
    
    return aliases;
  };

  // Parse zone data with cross-batch alias matching
  const parseZoneData = (text, batchAliases = []) => {
    const lines = text.split("\n");
    const zones = [];
    let currentZone = null;
    let currentZoneset = null;
    let vsanId = null;

    // Combine database aliases with batch aliases for matching
    const allAliasesForMatching = [...aliasOptions, ...batchAliases];

    const vsanHeaderRegex = /!Active Zone Database Section for vsan (\d+)/;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Extract VSAN ID from header
      const vsanMatch = trimmedLine.match(vsanHeaderRegex);
      if (vsanMatch) {
        vsanId = parseInt(vsanMatch[1]);
        return;
      }

      // Zoneset declaration
      const zonesetRegex = /^zoneset\s+name\s+(\S+)\s+vsan\s+(\d+)/i;
      const zonesetMatch = trimmedLine.match(zonesetRegex);
      if (zonesetMatch) {
        const [, zonesetName, zonesetVsan] = zonesetMatch;
        currentZoneset = { name: zonesetName, vsan: parseInt(zonesetVsan) };
        return;
      }

      // Zone name line
      const zoneNameRegex = /^zone\s+name\s+(\S+)\s+vsan\s+(\d+)/i;
      const zoneMatch = trimmedLine.match(zoneNameRegex);
      if (zoneMatch) {
        if (currentZone) zones.push(currentZone);

        const [, zoneName, zoneVsan] = zoneMatch;
        let notes = `Imported from bulk import (VSAN ${zoneVsan})`;
        if (currentZoneset) {
          notes += ` - Zoneset: ${currentZoneset.name}`;
        }

        currentZone = {
          lineNumber: index + 1,
          name: zoneName,
          vsan: parseInt(zoneVsan),
          fabric: selectedFabric,
          zone_type: zoneDefaults.zoneType,
          create: zoneDefaults.create,
          exists: zoneDefaults.exists,
          notes: notes,
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
          members: []
        };
        return;
      }

      // Member patterns
      const memberRegex = /^\s+member\s+pwwn\s+([0-9a-fA-F:]{23})/i;
      const fcidMemberRegex = /^\s*\*\s+fcid\s+0x[0-9a-fA-F]+\s+\[device-alias\s+([^\]]+)\]\s+\[pwwn\s+([0-9a-fA-F:]{23})\]/i;
      const deviceAliasMemberRegex = /^\s*device-alias\s+([^\[]+)\s+\[pwwn\s+([0-9a-fA-F:]{23})\]/i;

      const memberMatch = trimmedLine.match(memberRegex);
      const fcidMemberMatch = trimmedLine.match(fcidMemberRegex);
      const deviceAliasMemberMatch = trimmedLine.match(deviceAliasMemberRegex);

      if (currentZone && (memberMatch || fcidMemberMatch || deviceAliasMemberMatch)) {
        let wwpn = "";
        if (memberMatch) wwpn = memberMatch[1];
        else if (fcidMemberMatch) wwpn = fcidMemberMatch[2];
        else if (deviceAliasMemberMatch) wwpn = deviceAliasMemberMatch[2];

        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        currentZone.members.push(formattedWWPN);
        
        // Try to match WWPN to existing or batch aliases
        const matchingAlias = allAliasesForMatching.find(
          (alias) =>
            alias.wwpn.toLowerCase().replace(/[^0-9a-f]/g, "") ===
            formattedWWPN.toLowerCase().replace(/[^0-9a-f]/g, "")
        );
        
        if (matchingAlias) {
          if (!currentZone.memberAliases) currentZone.memberAliases = [];
          currentZone.memberAliases.push(matchingAlias.name);
        } else {
          if (!currentZone.unmatchedWWPNs) currentZone.unmatchedWWPNs = [];
          currentZone.unmatchedWWPNs.push(formattedWWPN);
        }
      }
    });

    if (currentZone) zones.push(currentZone);
    return zones;
  };

  // Process uploaded files with cross-batch alias matching
  const processFiles = async (files) => {
    const results = [];
    const allBatchAliases = [];
    
    // First pass: collect all aliases from all files
    for (const file of files) {
      try {
        const text = await file.text();
        const dataType = detectDataType(text);
        
        if (dataType === "alias" || dataType === "mixed") {
          const aliasItems = parseAliasData(text);
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
        if (dataType === "alias") {
          parsedItems = parseAliasData(text);
        } else if (dataType === "zone") {
          parsedItems = parseZoneData(text, allBatchAliases);
        } else {
          // For mixed data, parse both with batch context
          const aliasItems = parseAliasData(text);
          const zoneItems = parseZoneData(text, allBatchAliases);
          parsedItems = [...aliasItems, ...zoneItems];
        }
        
        results.push({
          fileName: file.name,
          fileSize: file.size,
          dataType: dataType,
          itemCount: parsedItems.length,
          items: parsedItems,
          rawText: text
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        setError(`Error processing file ${file.name}: ${error.message}`);
      }
    }
    
    return results;
  };

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
    setShowPreview(true);
    setShowPreviewSection(true);
    
    // Collect unmatched WWPNs from zones
    const allUnmatched = [];
    results.flatMap(r => r.items).forEach(item => {
      if (item.unmatchedWWPNs) {
        item.unmatchedWWPNs.forEach(wwpn => {
          allUnmatched.push({
            zoneName: item.name,
            wwpn: wwpn,
            fileName: results.find(r => r.items.includes(item))?.fileName || "Unknown"
          });
        });
      }
    });
    setUnmatchedWWPNs(allUnmatched);
  }, [selectedFabric]);

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
    setShowPreview(true);
    setShowPreviewSection(true);
    
    // Collect unmatched WWPNs from zones (same logic as drop handler)
    const allUnmatched = [];
    results.flatMap(r => r.items).forEach(item => {
      if (item.unmatchedWWPNs) {
        item.unmatchedWWPNs.forEach(wwpn => {
          allUnmatched.push({
            zoneName: item.name,
            wwpn: wwpn,
            fileName: results.find(r => r.items.includes(item))?.fileName || "File Upload"
          });
        });
      }
    });
    setUnmatchedWWPNs(allUnmatched);
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
    if (dataType === "alias") {
      parsedItems = parseAliasData(textInput);
    } else if (dataType === "zone") {
      // For zones, first collect any aliases from the same text input
      const batchAliases = parseAliasData(textInput);
      parsedItems = parseZoneData(textInput, batchAliases);
    } else {
      // For mixed data, parse aliases first, then zones with alias context
      const aliasItems = parseAliasData(textInput);
      const zoneItems = parseZoneData(textInput, aliasItems);
      parsedItems = [...aliasItems, ...zoneItems];
    }
    
    const result = {
      fileName: "Pasted Text",
      fileSize: textInput.length,
      dataType: dataType,
      itemCount: parsedItems.length,
      items: parsedItems,
      rawText: textInput
    };
    
    setUploadedFiles(prev => [...prev, result]);
    setParsedData(prev => [...prev, ...parsedItems]);
    setLoading(false);
    setShowPreview(true);
    setShowPreviewSection(true);
    setTextInput("");
    
    // Collect unmatched WWPNs from zones (text paste)
    const allUnmatched = [];
    parsedItems.forEach(item => {
      if (item.unmatchedWWPNs) {
        item.unmatchedWWPNs.forEach(wwpn => {
          allUnmatched.push({
            zoneName: item.name,
            wwpn: wwpn,
            fileName: "Pasted Text"
          });
        });
      }
    });
    setUnmatchedWWPNs(prev => [...prev, ...allUnmatched]);
  };

  // Import all data
  const handleImportAll = async () => {
    if (parsedData.length === 0) {
      setError("No data to import");
      return;
    }

    setImporting(true);
    setError("");
    
    try {
      // Separate aliases and zones
      const aliases = parsedData.filter(item => item.wwpn !== undefined);
      const zones = parsedData.filter(item => item.members !== undefined);
      
      let aliasResults = null;
      let zoneResults = null;
      
      // Import aliases if any
      if (aliases.length > 0) {
        const aliasPayload = {
          project_id: activeProjectId,
          aliases: aliases.map(alias => {
            const cleanAlias = { ...alias };
            delete cleanAlias.lineNumber;
            delete cleanAlias.saved;
            return {
              ...cleanAlias,
              projects: [activeProjectId]
            };
          })
        };
        
        aliasResults = await axios.post("/api/san/aliases/save/", aliasPayload);
      }
      
      // Import zones if any
      if (zones.length > 0) {
        const zonePayload = {
          project_id: activeProjectId,
          zones: zones.map(zone => {
            const cleanZone = { ...zone };
            delete cleanZone.lineNumber;
            delete cleanZone.saved;
            delete cleanZone.members; // Will be handled separately if needed
            return {
              ...cleanZone,
              projects: [activeProjectId],
              members: [] // For now, import zones without members
            };
          })
        };
        
        zoneResults = await axios.post("/api/san/zones/save/", zonePayload);
      }
      
      // Success message
      let message = "Import completed successfully! ";
      if (aliases.length > 0) message += `${aliases.length} aliases imported. `;
      if (zones.length > 0) message += `${zones.length} zones imported.`;
      
      setSuccess(message);
      
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
    setShowPreview(false);
    setShowPreviewSection(false);
    setUnmatchedWWPNs([]);
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
                Bulk Zoning Import
              </h4>
              <small className="text-muted">
                Import multiple files containing alias or zone data automatically
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
                <Card.Header>
                  <h6 className="mb-0">Import Defaults</h6>
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-md-6">
                      <h6>Alias Defaults</h6>
                      <div className="row mb-2">
                        <div className="col-6">
                          <Form.Label>Use</Form.Label>
                          <Form.Select
                            value={aliasDefaults.use}
                            onChange={(e) => setAliasDefaults(prev => ({...prev, use: e.target.value}))}
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
                            onChange={(e) => setAliasDefaults(prev => ({...prev, aliasType: e.target.value}))}
                            size="sm"
                          >
                            <option value="device-alias">device-alias</option>
                            <option value="fcalias">fcalias</option>
                            <option value="wwpn">wwpn</option>
                          </Form.Select>
                        </div>
                      </div>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="checkbox"
                          label="Create"
                          checked={aliasDefaults.create}
                          onChange={(e) => setAliasDefaults(prev => ({...prev, create: e.target.checked}))}
                        />
                        <Form.Check
                          type="checkbox"
                          label="Include in Zoning"
                          checked={aliasDefaults.includeInZoning}
                          onChange={(e) => setAliasDefaults(prev => ({...prev, includeInZoning: e.target.checked}))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <h6>Zone Defaults</h6>
                      <div className="row mb-2">
                        <div className="col-6">
                          <Form.Label>Zone Type</Form.Label>
                          <Form.Select
                            value={zoneDefaults.zoneType}
                            onChange={(e) => setZoneDefaults(prev => ({...prev, zoneType: e.target.value}))}
                            size="sm"
                          >
                            <option value="standard">Standard</option>
                            <option value="smart">Smart</option>
                          </Form.Select>
                        </div>
                      </div>
                      <div className="d-flex gap-3">
                        <Form.Check
                          type="checkbox"
                          label="Create"
                          checked={zoneDefaults.create}
                          onChange={(e) => setZoneDefaults(prev => ({...prev, create: e.target.checked}))}
                        />
                        <Form.Check
                          type="checkbox"
                          label="Exists"
                          checked={zoneDefaults.exists}
                          onChange={(e) => setZoneDefaults(prev => ({...prev, exists: e.target.checked}))}
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
                      <h5 className="text-muted">Drop text files here</h5>
                      <p className="text-muted mb-2">or click to select files</p>
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
                      placeholder="Paste your alias or zone configuration data here..."
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
                          <Badge bg={file.dataType === "alias" ? "primary" : file.dataType === "zone" ? "success" : "secondary"}>
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

              {/* Unmatched WWPNs Warning */}
              {unmatchedWWPNs.length > 0 && (
                <Alert variant="warning" className="mb-3">
                  <Alert.Heading className="h6">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {unmatchedWWPNs.length} Unmatched WWPN(s) Found
                  </Alert.Heading>
                  <p>The following WWPNs could not be matched to existing aliases:</p>
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {unmatchedWWPNs.map((unmatched, index) => (
                      <div key={index} className="mb-1" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        <strong>{unmatched.zoneName}</strong> ({unmatched.fileName}): {unmatched.wwpn}
                      </div>
                    ))}
                  </div>
                </Alert>
              )}

              {/* Preview Section */}
              {showPreviewSection && parsedData.length > 0 && (
                <Card className="mb-3">
                  <Card.Header 
                    onClick={() => setShowPreview(!showPreview)}
                    style={{ cursor: "pointer" }}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <h6 className="mb-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                      Import Preview ({parsedData.length} items)
                      {showPreview ? " - Click to collapse" : " - Click to expand"}
                    </h6>
                    <Badge bg="info">
                      {parsedData.filter(item => item.wwpn !== undefined).length} aliases, {parsedData.filter(item => item.members !== undefined).length} zones
                    </Badge>
                  </Card.Header>
                  {showPreview && (
                    <Card.Body style={{ maxHeight: "400px", overflowY: "auto" }}>
                      {/* Aliases Preview */}
                      {parsedData.filter(item => item.wwpn !== undefined).length > 0 && (
                        <div className="mb-4">
                          <h6 className="text-primary">Aliases ({parsedData.filter(item => item.wwpn !== undefined).length})</h6>
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
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.filter(item => item.wwpn !== undefined).map((alias, index) => (
                                  <tr key={index}>
                                    <td><code>{alias.name}</code></td>
                                    <td><code>{alias.wwpn}</code></td>
                                    <td><Badge bg="secondary">{alias.use}</Badge></td>
                                    <td><Badge bg="info">{alias.cisco_alias}</Badge></td>
                                    <td>{alias.create ? "✅" : "❌"}</td>
                                    <td>{alias.include_in_zoning ? "✅" : "❌"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Zones Preview */}
                      {parsedData.filter(item => item.members !== undefined).length > 0 && (
                        <div>
                          <h6 className="text-success">Zones ({parsedData.filter(item => item.members !== undefined).length})</h6>
                          <div className="table-responsive">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>VSAN</th>
                                  <th>Type</th>
                                  <th>Create</th>
                                  <th>Exists</th>
                                  <th>Members</th>
                                  <th>Matched Aliases</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.filter(item => item.members !== undefined).map((zone, index) => (
                                  <tr key={index}>
                                    <td><code>{zone.name}</code></td>
                                    <td><Badge bg="warning">{zone.vsan}</Badge></td>
                                    <td><Badge bg="info">{zone.zone_type}</Badge></td>
                                    <td>{zone.create ? "✅" : "❌"}</td>
                                    <td>{zone.exists ? "✅" : "❌"}</td>
                                    <td><Badge bg="secondary">{zone.members?.length || 0}</Badge></td>
                                    <td><Badge bg="success">{zone.memberAliases?.length || 0}</Badge></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  )}
                </Card>
              )}

              {/* Action Buttons */}
              {showPreview && parsedData.length > 0 && (
                <div className="d-flex gap-2">
                  <Button variant="success" onClick={handleImportAll} disabled={importing}>
                    {importing ? (
                      <>
                        <Spinner size="sm" className="me-1" />
                        Importing...
                      </>
                    ) : (
                      `Import All ${parsedData.length} Items`
                    )}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BulkZoningImportPage;