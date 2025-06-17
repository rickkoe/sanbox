import React, { useState, useEffect, useContext, useRef } from "react";
import { Button, Form, Alert, Card, Spinner, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";

const AliasImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const previewTableRef = useRef(null);

  const [fabricOptions, setFabricOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  const [importFormat, setImportFormat] = useState("device-alias"); // New state for format selection
  const [rawText, setRawText] = useState("");
  const [parsedAliases, setParsedAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showProjectCopy, setShowProjectCopy] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedSourceProject, setSelectedSourceProject] = useState("");
  const [sourceProjectAliases, setSourceProjectAliases] = useState([]);
  const [selectedAliasesToCopy, setSelectedAliasesToCopy] = useState([]);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics and projects on component mount
  useEffect(() => {
    if (activeCustomerId) {
      setLoading(true);

      // Load fabrics
      const fabricsPromise = axios.get(
        `/api/san/fabrics/?customer_id=${activeCustomerId}`
      );

      // Load projects for this customer using existing endpoint
      const projectsPromise = axios.get(
        `/api/customers/projects/${activeCustomerId}/`
      );

      Promise.all([fabricsPromise, projectsPromise])
        .then(([fabricsRes, projectsRes]) => {
          setFabricOptions(fabricsRes.data);
          if (fabricsRes.data.length > 0) {
            setSelectedFabric(fabricsRes.data[0].id);
          }

          // Filter out the current project from available projects
          const otherProjects = projectsRes.data.filter(
            (project) => project.id !== activeProjectId
          );
          setAvailableProjects(otherProjects);
        })
        .catch((err) => {
          console.error("Error fetching data:", err);
          setError("Failed to load fabrics and projects");
        })
        .finally(() => setLoading(false));
    }
  }, [activeCustomerId, activeProjectId]);

  // Parse device-alias database text
  const parseDeviceAliasText = (text) => {
    const lines = text.split("\n");
    const aliases = [];

    // Regex to match device-alias lines
    const deviceAliasRegex =
      /device-alias\s+name\s+(\S+)\s+pwwn\s+([0-9a-fA-F:]{23})/;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(deviceAliasRegex);

      if (match) {
        const [, name, wwpn] = match;

        // Format WWPN to standard format (xx:xx:xx:xx:xx:xx:xx:xx)
        const formattedWWPN =
          wwpn
            .toLowerCase()
            .replace(/[^0-9a-f]/g, "")
            .match(/.{2}/g)
            ?.join(":") || wwpn;

        aliases.push({
          lineNumber: index + 1,
          name: name,
          wwpn: formattedWWPN,
          use: "init", // Default to 'init'
          fabric: selectedFabric,
          cisco_alias: "device-alias",
          create: true,
          include_in_zoning: false,
          notes: `Imported from device-alias database`,
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
        });
      }
    });

    return aliases;
  };

  // Parse fcalias configuration text
  const parseFcaliasText = (text) => {
    const lines = text.split("\n");
    const aliases = [];
    let currentAlias = null;

    // Regex patterns for fcalias
    const fcaliasNameRegex = /fcalias\s+name\s+(\S+)(?:\s+vsan\s+(\d+))?/;
    const pwwnRegex = /^\s*(?:member\s+)?pwwn\s+([0-9a-fA-F:]{23})/;
    const commentRegex = /^\s*!/;

    const saveCurrentAlias = () => {
      if (currentAlias && currentAlias.wwpns.length > 0) {
        currentAlias.wwpns.forEach((wwpn, wwpnIndex) => {
          const aliasName = currentAlias.wwpns.length > 1 
            ? `${currentAlias.name}_${wwpnIndex + 1}` 
            : currentAlias.name;
            
          aliases.push({
            lineNumber: currentAlias.lineNumber,
            name: aliasName,
            wwpn: wwpn,
            use: "init", // Default to 'init'
            fabric: selectedFabric,
            cisco_alias: "fcalias",
            create: true,
            include_in_zoning: false,
            notes: `Imported from fcalias config${currentAlias.vsan ? ` (VSAN ${currentAlias.vsan})` : ''}${currentAlias.wwpns.length > 1 ? ` - WWPN ${wwpnIndex + 1} of ${currentAlias.wwpns.length}` : ''}`,
            imported: new Date().toISOString(),
            updated: null,
            saved: false,
          });
        });
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || commentRegex.test(trimmedLine)) {
        return;
      }
      
      // Check for fcalias name line
      const nameMatch = trimmedLine.match(fcaliasNameRegex);
      if (nameMatch) {
        // Save the previous alias before starting a new one
        saveCurrentAlias();
        
        const [, name, vsan] = nameMatch;
        currentAlias = {
          lineNumber: index + 1,
          name: name,
          vsan: vsan || null,
          wwpns: []
        };
      }
      
      // Check for pwwn line (must have a current alias context)
      const wwpnMatch = trimmedLine.match(pwwnRegex);
      if (wwpnMatch && currentAlias) {
        const wwpn = wwpnMatch[1];
        
        // Format WWPN to standard format
        const formattedWWPN =
          wwpn
            .toLowerCase()
            .replace(/[^0-9a-f]/g, "")
            .match(/.{2}/g)
            ?.join(":") || wwpn;

        currentAlias.wwpns.push(formattedWWPN);
      }
    });

    // Save the last alias after processing all lines
    saveCurrentAlias();

    return aliases;
  };

  // Unified parsing function
  const parseAliasText = (text, format) => {
    if (format === "device-alias") {
      return parseDeviceAliasText(text);
    } else if (format === "fcalias") {
      return parseFcaliasText(text);
    }
    return [];
  };

  // Check for duplicate aliases in database
  const checkForDuplicates = async (aliases) => {
    setCheckingDuplicates(true);
    try {
      // Get all existing aliases for the selected fabric
      const response = await axios.get(
        `/api/san/aliases/fabric/${selectedFabric}/`
      );
      const existingAliases = response.data;

      const duplicateEntries = [];
      const uniqueAliases = [];

      aliases.forEach((alias) => {
        // Check for name or WWPN duplicates within the same fabric
        const nameMatch = existingAliases.find(
          (existing) => existing.name.toLowerCase() === alias.name.toLowerCase()
        );
        const wwpnMatch = existingAliases.find(
          (existing) =>
            existing.wwpn.toLowerCase().replace(/[^0-9a-f]/g, "") ===
            alias.wwpn.toLowerCase().replace(/[^0-9a-f]/g, "")
        );

        if (nameMatch || wwpnMatch) {
          duplicateEntries.push({
            ...alias,
            duplicateType:
              nameMatch && wwpnMatch ? "both" : nameMatch ? "name" : "wwpn",
            existingAlias: nameMatch || wwpnMatch,
          });
        } else {
          uniqueAliases.push(alias);
        }
      });

      setDuplicates(duplicateEntries);
      return uniqueAliases;
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      setError(
        "Failed to check for duplicate aliases: " +
          (error.response?.data?.error || error.message)
      );
      return aliases; // Return original aliases if check fails
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // Handle text parsing
  const handleParse = async () => {
    setError("");
    setSuccess("");

    if (!selectedFabric) {
      setError("Please select a fabric");
      return;
    }

    if (!rawText.trim()) {
      setError(`Please paste ${importFormat} content`);
      return;
    }

    try {
      const parsed = parseAliasText(rawText, importFormat);

      if (parsed.length === 0) {
        setError(
          `No valid ${importFormat} entries found. Please check the format.`
        );
        return;
      }

      // Check for duplicates
      const uniqueAliases = await checkForDuplicates(parsed);

      setParsedAliases(parsed);
      setPreviewData([...uniqueAliases]); // Only show unique aliases for import
      setShowPreview(true);

      // Show success message with duplicate info
      let message = `Successfully parsed ${parsed.length} ${importFormat} entries`;
      if (duplicates.length > 0) {
        message += `. ${duplicates.length} duplicate(s) found and will be skipped.`;
      }
      if (uniqueAliases.length > 0) {
        message += ` ${uniqueAliases.length} unique aliases ready for import.`;
      }
      setSuccess(message);
    } catch (err) {
      setError("Error parsing text: " + err.message);
    }
  };

  // Handle changes in the preview table
  const handlePreviewChange = (changes, source) => {
    if (source === "loadData" || !changes) return;

    const updatedData = [...previewData];
    changes.forEach(([row, prop, oldVal, newVal]) => {
      if (updatedData[row]) {
        updatedData[row] = { ...updatedData[row], [prop]: newVal };
      }
    });
    setPreviewData(updatedData);
  };

  // Handle import to database
  const handleImport = async () => {
    if (!activeProjectId) {
      setError("No active project selected");
      return;
    }

    setImporting(true);
    setError("");

    try {
      // Use the edited previewData instead of original parsedAliases
      const payload = {
        project_id: activeProjectId,
        aliases: previewData.map((alias) => ({
          name: alias.name,
          wwpn: alias.wwpn,
          use: alias.use,
          fabric: alias.fabric,
          cisco_alias: alias.cisco_alias,
          create: alias.create,
          include_in_zoning: alias.include_in_zoning,
          notes: alias.notes,
          imported: alias.imported,
          projects: [activeProjectId],
        })),
      };

      await axios.post("/api/san/aliases/save/", payload);

      setSuccess(`Successfully imported ${previewData.length} aliases!`);

      // Redirect to alias table after successful import
      setTimeout(() => {
        navigate("/san/aliases");
      }, 2000);
    } catch (error) {
      console.error("Import error:", error);

      // Handle structured error response
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.alias}: ${errorText}`;
        });
        setError(`Import failed:\n${errorMessages.join("\n")}`);
      } else {
        setError(
          `Import failed: ${error.response?.data?.message || error.message}`
        );
      }
    } finally {
      setImporting(false);
    }
  };

  // Load aliases from selected source project
  const loadSourceProjectAliases = async (projectId) => {
    if (!projectId) {
      setSourceProjectAliases([]);
      return;
    }

    try {
      const response = await axios.get(
        `/api/san/aliases/project/${projectId}/`
      );
      setSourceProjectAliases(response.data);
    } catch (error) {
      console.error("Error loading source project aliases:", error);
      setError("Failed to load aliases from source project");
    }
  };

  // Handle copying aliases from another project
  const handleCopyFromProject = async () => {
    if (selectedAliasesToCopy.length === 0) {
      setError("Please select aliases to copy");
      return;
    }

    setImporting(true);
    setError("");

    try {
      // Add current project to the selected aliases
      const copyPayload = {
        project_id: activeProjectId,
        alias_ids: selectedAliasesToCopy,
      };

      await axios.post("/api/san/aliases/copy-to-project/", copyPayload);

      setSuccess(
        `Successfully copied ${selectedAliasesToCopy.length} aliases to current project!`
      );
      setShowProjectCopy(false);
      setSelectedAliasesToCopy([]);
      setSelectedSourceProject("");

      // Redirect to alias table after successful copy
      setTimeout(() => {
        navigate("/san/aliases");
      }, 2000);
    } catch (error) {
      console.error("Copy error:", error);
      setError(
        `Copy failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setImporting(false);
    }
  };

  // Handle format change - clear existing data
  const handleFormatChange = (newFormat) => {
    setImportFormat(newFormat);
    setRawText("");
    setParsedAliases([]);
    setPreviewData([]);
    setDuplicates([]);
    setError("");
    setSuccess("");
    setShowPreview(false);
  };

  // Get placeholder text based on format
  const getPlaceholderText = () => {
    if (importFormat === "device-alias") {
      return `Paste your device-alias database output here, for example:

device-alias database
  device-alias name PRD03A_sys1a pwwn c0:50:76:09:15:09:01:08
  device-alias name PRD03A_sys2a pwwn c0:50:76:09:15:09:01:0a
  device-alias name MGT01A_MGT_1a pwwn c0:50:76:09:15:09:02:b0
  ...`;
    } else {
      return `Paste your fcalias configuration here, for example:

fcalias name API01A1_iasp01b vsan 76
  pwwn c0:50:76:09:e3:f8:02:fc
fcalias name API01A1_iasp02b vsan 76
  member pwwn c0:50:76:09:e3:f8:02:fe
fcalias name vwsfs003p_c2p1_virt vsan 75
    member pwwn 50:05:07:68:10:15:73:be
    !           [vwsfs003p_c3p1_virt]
  ...`;
    }
  };

  if (!activeProjectId) {
    return (
      <div className="container mt-4">
        <Alert variant="warning">No active project selected.</Alert>
      </div>
    );
  }

  const selectedFabricName =
    fabricOptions.find((f) => f.id.toString() === selectedFabric.toString())
      ?.name || "";

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <Card>
            <Card.Header>
              <h4 className="mb-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="me-2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
                Import Device Aliases
              </h4>
              <small className="text-muted">
                Import aliases from Cisco device-alias database or fcalias configuration
              </small>
            </Card.Header>

            <Card.Body>
              {/* Import Format Selection */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Import Format</strong>
                </Form.Label>
                <div className="d-flex gap-3">
                  <Form.Check
                    type="radio"
                    name="importFormat"
                    id="device-alias"
                    label="Device-Alias Database"
                    checked={importFormat === "device-alias"}
                    onChange={() => handleFormatChange("device-alias")}
                  />
                  <Form.Check
                    type="radio"
                    name="importFormat"
                    id="fcalias"
                    label="FCAlias Configuration"
                    checked={importFormat === "fcalias"}
                    onChange={() => handleFormatChange("fcalias")}
                  />
                </div>
                <Form.Text className="text-muted">
                  {importFormat === "device-alias" 
                    ? "Import from 'show device-alias database' command output"
                    : "Import from fcalias configuration sections"
                  }
                </Form.Text>
              </Form.Group>

              {/* Fabric Selection */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Select Fabric</strong>
                </Form.Label>
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
                {loading && (
                  <small className="text-muted">Loading fabrics...</small>
                )}
              </Form.Group>

              {/* Text Input */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>
                    {importFormat === "device-alias" 
                      ? "Device-Alias Database Content" 
                      : "FCAlias Configuration Content"
                    }
                  </strong>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={12}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={getPlaceholderText()}
                  style={{
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: "13px",
                  }}
                />
                <Form.Text className="text-muted">
                  {importFormat === "device-alias" 
                    ? 'Paste the output from "show device-alias database" command'
                    : 'Paste fcalias configuration sections from your switch config'
                  }
                </Form.Text>
              </Form.Group>

              {/* Action Buttons */}
              <div className="d-flex gap-2 mb-3">
                <Button
                  variant="primary"
                  onClick={handleParse}
                  disabled={
                    !selectedFabric || !rawText.trim() || checkingDuplicates
                  }
                >
                  {checkingDuplicates ? (
                    <>
                      <Spinner size="sm" className="me-1" />
                      Checking for duplicates...
                    </>
                  ) : (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="me-1"
                      >
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                      Parse Text
                    </>
                  )}
                </Button>

                <Button
                  variant="outline-info"
                  onClick={() => setShowProjectCopy(true)}
                  disabled={availableProjects.length === 0}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="me-1"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy from Project
                </Button>

                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    setRawText("");
                    setParsedAliases([]);
                    setPreviewData([]);
                    setDuplicates([]);
                    setError("");
                    setSuccess("");
                    setShowPreview(false);
                  }}
                >
                  Clear
                </Button>
              </div>

              {/* Status Messages */}
              {error && (
                <Alert variant="danger" className="mb-3">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {error}
                  </pre>
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mb-3">
                  {success}
                </Alert>
              )}

              {/* Duplicates Warning */}
              {duplicates.length > 0 && (
                <Alert variant="warning" className="mb-3">
                  <Alert.Heading className="h6">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="me-2"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {duplicates.length} Duplicate(s) Found - Will Be Skipped
                  </Alert.Heading>
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {duplicates.map((duplicate, index) => (
                      <div
                        key={index}
                        className="mb-2 p-2"
                        style={{
                          backgroundColor: "#fff3cd",
                          borderRadius: "4px",
                          border: "1px solid #ffeaa7",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong style={{ fontFamily: "monospace" }}>
                              {duplicate.name}
                            </strong>
                            <br />
                            <small
                              className="text-muted"
                              style={{ fontFamily: "monospace" }}
                            >
                              WWPN: {duplicate.wwpn}
                            </small>
                          </div>
                          <span className="badge bg-warning text-dark">
                            {duplicate.duplicateType === "both"
                              ? "Name & WWPN"
                              : duplicate.duplicateType === "name"
                              ? "Name"
                              : "WWPN"}{" "}
                            duplicate
                          </span>
                        </div>
                        <small className="text-muted">
                          Matches existing alias:{" "}
                          <strong>{duplicate.existingAlias.name}</strong>
                        </small>
                      </div>
                    ))}
                  </div>
                </Alert>
              )}

              {/* Preview and Import */}
              {showPreview && previewData.length > 0 && (
                <Card className="mt-4">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      Preview & Edit ({previewData.length} unique aliases)
                      {duplicates.length > 0 && (
                        <small className="text-muted ms-2">
                          ({duplicates.length} duplicates skipped)
                        </small>
                      )}
                    </h5>
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={() => {
                          // Reset to original parsed data
                          setPreviewData([...parsedAliases]);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="me-1"
                        >
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                          <path d="M3 21v-5h5" />
                        </svg>
                        Reset Changes
                      </Button>
                      <Button
                        variant="success"
                        onClick={handleImport}
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <Spinner size="sm" className="me-1" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="me-1"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h4" />
                              <polyline points="17,6 9,14 5,10" />
                            </svg>
                            Import to {selectedFabricName}
                          </>
                        )}
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body style={{ padding: "0" }}>
                    <div style={{ height: "400px", width: "100%" }}>
                      <HotTable
                        ref={previewTableRef}
                        data={previewData}
                        colHeaders={[
                          "Name",
                          "WWPN",
                          "Use",
                          "Fabric",
                          "Alias Type",
                          "Create",
                          "Include in Zoning",
                          "Notes",
                        ]}
                        columns={[
                          { data: "name", width: 200 },
                          {
                            data: "wwpn",
                            width: 180,
                            validator: (value, callback) => {
                              // WWPN validation
                              const wwpnPattern =
                                /^([0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}$/;
                              callback(wwpnPattern.test(value));
                            },
                          },
                          {
                            data: "use",
                            type: "dropdown",
                            source: ["init", "target", "both"],
                            width: 100,
                            className: "htCenter",
                          },
                          {
                            data: "fabric",
                            type: "dropdown",
                            source: fabricOptions.map((f) => f.id.toString()),
                            width: 120,
                            renderer: (instance, td, row, col, prop, value) => {
                              // Show fabric name instead of ID
                              const fabric = fabricOptions.find(
                                (f) => f.id.toString() === value?.toString()
                              );
                              td.innerText = fabric ? fabric.name : value || "";
                              return td;
                            },
                          },
                          {
                            data: "cisco_alias",
                            type: "dropdown",
                            source: ["device-alias", "fcalias", "wwpn"],
                            width: 120,
                            className: "htCenter",
                          },
                          {
                            data: "create",
                            type: "checkbox",
                            width: 80,
                            className: "htCenter",
                          },
                          {
                            data: "include_in_zoning",
                            type: "checkbox",
                            width: 120,
                            className: "htCenter",
                          },
                          { data: "notes", width: 200 },
                        ]}
                        licenseKey="non-commercial-and-evaluation"
                        height="350"
                        width="100%"
                        afterChange={handlePreviewChange}
                        stretchH="all"
                        manualColumnResize={true}
                        contextMenu={true}
                        copyPaste={true}
                        fillHandle={true}
                        className="preview-table"
                        viewportRowRenderingOffset={30}
                        viewportColumnRenderingOffset={10}
                      />
                    </div>
                    <div className="p-3 bg-light border-top">
                      <small className="text-muted">
                        <strong>Tip:</strong> You can edit any cell by
                        double-clicking. Use dropdowns to change Use, Fabric, or
                        Alias Type. Right-click for context menu options.
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Show message when no unique aliases found */}
              {showPreview &&
                previewData.length === 0 &&
                duplicates.length > 0 && (
                  <Alert variant="info" className="mt-4">
                    <Alert.Heading className="h6">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="me-2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      No New Aliases to Import
                    </Alert.Heading>
                    All parsed aliases already exist in the database. No import
                    needed.
                  </Alert>
                )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Project Copy Modal */}
      <Modal
        show={showProjectCopy}
        onHide={() => setShowProjectCopy(false)}
        size="lg"
        className="modern-modal"
      >
        <Modal.Header closeButton className="modern-modal-header">
          <Modal.Title>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="me-2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Aliases from Another Project
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="modern-modal-body">
          {/* Source Project Selection */}
          <Form.Group className="mb-3">
            <Form.Label>
              <strong>Source Project</strong>
            </Form.Label>
            <Form.Select
              value={selectedSourceProject}
              onChange={(e) => {
                setSelectedSourceProject(e.target.value);
                loadSourceProjectAliases(e.target.value);
                setSelectedAliasesToCopy([]);
              }}
            >
              <option value="">Choose a project...</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Select a project to copy aliases from
            </Form.Text>
          </Form.Group>

          {/* Aliases Selection */}
          {sourceProjectAliases.length > 0 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>
                  Available Aliases ({sourceProjectAliases.length})
                </strong>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() =>
                      setSelectedAliasesToCopy(
                        sourceProjectAliases.map((alias) => alias.id)
                      )
                    }
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setSelectedAliasesToCopy([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                }}
              >
                {sourceProjectAliases.map((alias) => (
                  <div
                    key={alias.id}
                    className={`p-2 border-bottom ${
                      selectedAliasesToCopy.includes(alias.id)
                        ? "bg-primary bg-opacity-10"
                        : ""
                    }`}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (selectedAliasesToCopy.includes(alias.id)) {
                        setSelectedAliasesToCopy((prev) =>
                          prev.filter((id) => id !== alias.id)
                        );
                      } else {
                        setSelectedAliasesToCopy((prev) => [...prev, alias.id]);
                      }
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong style={{ fontFamily: "monospace" }}>
                          {alias.name}
                        </strong>
                        <br />
                        <small
                          className="text-muted"
                          style={{ fontFamily: "monospace" }}
                        >
                          WWPN: {alias.wwpn} | Fabric:{" "}
                          {alias.fabric_details?.name || "Unknown"}
                        </small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-info">{alias.use}</span>
                        {selectedAliasesToCopy.includes(alias.id) && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-primary"
                          >
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 text-muted">
                <small>
                  <strong>{selectedAliasesToCopy.length}</strong> aliases
                  selected for copying
                </small>
              </div>
            </div>
          )}

          {selectedSourceProject && sourceProjectAliases.length === 0 && (
            <Alert variant="info">
              No aliases found in the selected project.
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer className="modern-modal-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setShowProjectCopy(false);
              setSelectedAliasesToCopy([]);
              setSelectedSourceProject("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleCopyFromProject}
            disabled={selectedAliasesToCopy.length === 0 || importing}
          >
            {importing ? (
              <>
                <Spinner size="sm" className="me-1" />
                Copying...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="me-1"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy {selectedAliasesToCopy.length} Aliases
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AliasImportPage;