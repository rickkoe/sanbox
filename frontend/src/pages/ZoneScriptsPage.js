import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Alert, Spinner, Modal, Form } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import { useSanVendor } from "../context/SanVendorContext";
import { useTheme } from "../context/ThemeContext";
import JSZip from "jszip";
import "../styles/scriptspages.css";

const ZoneScriptsPage = () => {
  const { config } = useContext(ConfigContext);
  const { sanVendor } = useSanVendor();
  const { theme } = useTheme();
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [activeTab, setActiveTab] = useState(null);
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedFabrics, setSelectedFabrics] = useState({});
  const [downloadFilename, setDownloadFilename] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // Create settings modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSettings, setCreateSettings] = useState({ zones: {}, aliases: {} });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState({ zones: null, aliases: null });
  const [fabricFilter, setFabricFilter] = useState("all");
  const [fabrics, setFabrics] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    // Wait until we actually have config loaded (assuming that an empty config means it's not loaded yet).
    if (!config || Object.keys(config).length === 0) {
      return;
    }

    if (!config.active_project?.id) {
      setError("No active project selected");
      setLoading(false);
      return;
    }

    const fetchScriptsAndFabrics = async () => {
      try {
        const projectId = config.active_project.id;
        const customerId = config.customer?.id;

        console.log("Fetching zone scripts and fabrics...", { projectId, customerId, sanVendor });

        // Fetch both scripts and fabrics in parallel
        const [scriptsResponse, fabricsResponse] = await Promise.all([
          axios.get(`/api/san/zone-scripts/${projectId}/?vendor=${sanVendor}`),
          customerId ? axios.get(`/api/san/fabrics/?customer_id=${customerId}`) : Promise.resolve({ data: [] })
        ]);

        console.log("Scripts API response:", scriptsResponse.data);
        console.log("Fabrics API response:", fabricsResponse.data);

        // Check for warnings from the backend
        if (scriptsResponse.data.warnings && scriptsResponse.data.warnings.length > 0) {
          console.warn("⚠️ API returned warnings:", scriptsResponse.data.warnings);
          setWarnings(scriptsResponse.data.warnings);
        } else {
          setWarnings([]);
        }

        // Process the scripts response based on its structure
        let processedScripts = {};

        if (scriptsResponse.data.zone_scripts) {
          if (
            typeof Object.values(scriptsResponse.data.zone_scripts)[0] === "object"
          ) {
            // New format with fabric_info
            processedScripts = scriptsResponse.data.zone_scripts;
          } else {
            // Old format (array of commands)
            processedScripts = Object.entries(
              scriptsResponse.data.zone_scripts
            ).reduce((acc, [key, value]) => {
              acc[key] = {
                commands: value,
                fabric_info: { san_vendor: sanVendor }, // Default to global context
              };
              return acc;
            }, {});
          }
        }

        console.log("Processed scripts:", processedScripts);
        console.log("Number of fabrics with scripts:", Object.keys(processedScripts).length);

        setScripts(processedScripts);
        setFabrics(fabricsResponse.data || []);

        if (!activeTab && Object.keys(processedScripts).length > 0) {
          setActiveTab(Object.keys(processedScripts)[0]);
        }

        // Initialize all fabrics as selected
        const initialSelection = {};
        Object.keys(processedScripts).forEach(key => {
          initialSelection[key] = true;
        });
        setSelectedFabrics(initialSelection);

        // If no scripts were returned, provide a helpful message
        if (Object.keys(processedScripts).length === 0) {
          console.warn("No zone scripts returned. Check if zones have 'create' flag set to true.");
        }
      } catch (err) {
        console.error("Error fetching zone scripts or fabrics:", err);
        console.error("Error details:", err.response?.data || err.message);
        setError(`Error loading data: ${err.response?.data?.detail || err.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchScriptsAndFabrics();
  }, [config, sanVendor]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const header = `### ${activeTab.toUpperCase()} zone COMMANDS`;
      const commands = scripts[activeTab].commands || scripts[activeTab];
      const commandsText = Array.isArray(commands) ? commands.join("\n") : "";

      const textToCopy = `${header}\n${commandsText}`;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopyButtonText("Copied!");
          setTimeout(() => setCopyButtonText("Copy to clipboard"), 5000);
        })
        .catch((err) => {
          console.error("Clipboard copy failed:", err);
          alert("Failed to copy to clipboard.");
        });
    } else {
      alert("No active code block to copy.");
    }
  };

  const getDefaultFilename = () => {
    const projectName = config.active_project?.name || "project";
    const customerName = config.customer?.name || "Customer";
    const now = new Date();
    const timestamp =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      "." +
      String(now.getMinutes()).padStart(2, "0") +
      "." +
      String(now.getSeconds()).padStart(2, "0");
    const cleanProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
    return `${customerName}_${cleanProjectName}_Zone_Scripts_${timestamp}.zip`;
  };

  const handleOpenDownloadModal = () => {
    setDownloadFilename(getDefaultFilename());
    setShowDownloadModal(true);
  };

  // Load create settings when modal opens
  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);

    try {
      const projectId = config.active_project?.id;
      if (!projectId) {
        console.error("No project ID found");
        alert("No active project found. Please select a project first.");
        return;
      }

      console.log("Loading create settings for project:", projectId);

      // Fetch zones and aliases (fabrics already loaded on page load)
      // If fabrics haven't been loaded yet, fetch them too
      const customerId = config.customer?.id;
      const fetchPromises = [
        axios.get(`/api/san/zones/project/${projectId}/?page_size=1000`),
        axios.get(`/api/san/aliases/project/${projectId}/?page_size=1000`)
      ];

      // Only fetch fabrics if they haven't been loaded yet
      if (fabrics.length === 0 && customerId) {
        fetchPromises.push(axios.get(`/api/san/fabrics/?customer_id=${customerId}`));
      }

      const responses = await Promise.all(fetchPromises);
      const zonesRes = responses[0];
      const aliasesRes = responses[1];
      const fabricsRes = responses[2]; // May be undefined if already loaded

      console.log("Zones response:", zonesRes.data);
      console.log("Aliases response:", aliasesRes.data);

      // Update fabrics if we just fetched them
      if (fabricsRes) {
        console.log("Fabrics response:", fabricsRes.data);
        setFabrics(fabricsRes.data || []);
      }

      // Initialize create settings
      const zones = {};
      const aliases = {};

      // Handle paginated response
      const zonesData = zonesRes.data.results || zonesRes.data || [];
      const aliasesData = aliasesRes.data.results || aliasesRes.data || [];

      console.log(`Processing ${zonesData.length} zones and ${aliasesData.length} aliases`);

      zonesData.forEach(zone => {
        zones[zone.id] = {
          id: zone.id,
          name: zone.name,
          create: zone.create || false,
          fabric: zone.fabric,
          fabric_name: zone.fabric_details?.name || "Unknown"
        };
      });

      aliasesData.forEach(alias => {
        aliases[alias.id] = {
          id: alias.id,
          name: alias.name,
          create: alias.create || false,
          fabric: alias.fabric,
          fabric_name: alias.fabric_details?.name || "Unknown"
        };
      });

      setCreateSettings({ zones, aliases });
      console.log("Create settings loaded:", {
        zoneCount: Object.keys(zones).length,
        aliasCount: Object.keys(aliases).length
      });
    } catch (error) {
      console.error("Error loading create settings:", error);
      console.error("Error details:", error.response?.data || error.message);
      alert(`Failed to load settings: ${error.response?.data?.detail || error.message || "Unknown error"}. Please try again.`);
    }
  };

  const handleToggleCreate = (type, id, index, event) => {
    if (event?.shiftKey && lastClickedIndex[type] !== null) {
      // Shift-click: select range
      const items = Object.values(createSettings[type]);
      const start = Math.min(lastClickedIndex[type], index);
      const end = Math.max(lastClickedIndex[type], index);
      const newValue = !createSettings[type][id].create;

      setCreateSettings(prev => {
        const updated = { ...prev[type] };
        for (let i = start; i <= end; i++) {
          const item = items[i];
          updated[item.id] = { ...updated[item.id], create: newValue };
        }
        return { ...prev, [type]: updated };
      });
    } else {
      // Normal click
      setCreateSettings(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          [id]: {
            ...prev[type][id],
            create: !prev[type][id].create
          }
        }
      }));
    }
    setLastClickedIndex(prev => ({ ...prev, [type]: index }));
  };

  const handleDragSelect = (type, id, isEntering) => {
    if (isDragging && isEntering) {
      setCreateSettings(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          [id]: {
            ...prev[type][id],
            create: true
          }
        }
      }));
    }
  };

  const handleSelectAllCreate = (type, checked) => {
    setCreateSettings(prev => ({
      ...prev,
      [type]: Object.keys(prev[type]).reduce((acc, id) => {
        acc[id] = { ...prev[type][id], create: checked };
        return acc;
      }, {})
    }));
  };

  const handleSaveCreateSettings = async () => {
    try {
      setIsSavingSettings(true);

      // Prepare data for batch update
      const zonesToUpdate = Object.values(createSettings.zones).map(z => ({ id: z.id, create: z.create }));
      const aliasesToUpdate = Object.values(createSettings.aliases).map(a => ({ id: a.id, create: a.create }));

      // Send updates to backend
      await Promise.all([
        axios.post('/api/san/zones/bulk-update-create/', { zones: zonesToUpdate }),
        axios.post('/api/san/aliases/bulk-update-create/', { aliases: aliasesToUpdate })
      ]);

      setShowCreateModal(false);
      setIsSavingSettings(false);

      // Reload the page to refresh scripts
      window.location.reload();
    } catch (error) {
      console.error("Error saving create settings:", error);
      alert("Failed to save settings. Please try again.");
      setIsSavingSettings(false);
    }
  };

  const handleSelectAll = (checked) => {
    const newSelection = {};
    Object.keys(scripts).forEach(key => {
      newSelection[key] = checked;
    });
    setSelectedFabrics(newSelection);
  };

  const handleToggleFabric = (fabricName) => {
    setSelectedFabrics(prev => ({
      ...prev,
      [fabricName]: !prev[fabricName]
    }));
  };

  const handleDownloadSelected = async () => {
    const selectedCount = Object.values(selectedFabrics).filter(Boolean).length;

    if (selectedCount === 0) {
      alert("Please select at least one fabric to download.");
      return;
    }

    try {
      setIsDownloading(true);

      const zip = new JSZip();

      // Add each selected fabric's commands as a separate text file
      Object.entries(scripts).forEach(([fabricName, fabricData]) => {
        if (!selectedFabrics[fabricName]) return;

        const commands = Array.isArray(fabricData)
          ? fabricData
          : fabricData.commands;
        const fabricInfo = fabricData.fabric_info || { san_vendor: sanVendor };
        const vendor = fabricInfo.san_vendor;

        // Create file content
        const header = `### ${fabricName.toUpperCase()} ZONE COMMANDS`;
        const commandsText = Array.isArray(commands) ? commands.join("\n") : "";
        const fileContent = `${header}\n${commandsText}`;

        // Create filename with fabric name, project name and timestamp (local time)
        const vendorPrefix = vendor === "CI" ? "Cisco" : "Brocade";
        const projectName = config.active_project?.name || "project";
        const now = new Date();
        const timestamp =
          now.getFullYear() +
          "-" +
          String(now.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(now.getDate()).padStart(2, "0") +
          "_" +
          String(now.getHours()).padStart(2, "0") +
          "." +
          String(now.getMinutes()).padStart(2, "0") +
          "." +
          String(now.getSeconds()).padStart(2, "0");
        const cleanFabricName = fabricName.replace(/[^a-zA-Z0-9-_]/g, "_");
        const cleanProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
        const fileName = `${vendorPrefix}_${cleanFabricName}_${cleanProjectName}_zone_scripts_${timestamp}.txt`;

        zip.file(fileName, fileContent);
      });

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFilename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close modal
      setShowDownloadModal(false);
      setIsDownloading(false);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to create download. Please try again.");
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="scripts-page-container">
        <div className="loading-state">
          <Spinner animation="border" role="status" />
          <span>Loading zone scripts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scripts-page-container">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  const currentScript = activeTab && scripts[activeTab];
  const commands = currentScript && (Array.isArray(currentScript) ? currentScript : currentScript.commands);
  const fabricInfo = currentScript && (currentScript.fabric_info || { san_vendor: sanVendor });
  const vendor = fabricInfo && fabricInfo.san_vendor;

  return (
    <div className="scripts-page-container">
      {/* Page Header */}
      <div className="scripts-header">
        <div className="scripts-header-content">
          <div className="header-title-section">
            <button
              className="back-btn"
              onClick={() => navigate("/san/zones")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <div>
              <h1 className="scripts-title">Zone Scripts</h1>
              <p className="scripts-description">Generate and manage SAN zoning configuration scripts</p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="script-action-btn script-action-btn-secondary"
              onClick={handleCopyToClipboard}
              disabled={!activeTab}
            >
              {copyButtonText === "Copied!" ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H13a2,2,0,0,1,2,2V5"/>
                  </svg>
                  Copy
                </>
              )}
            </button>

            <button
              className="script-action-btn script-action-btn-secondary"
              onClick={handleOpenCreateModal}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Manage Create
            </button>

            <button
              className="script-action-btn script-action-btn-primary"
              onClick={handleOpenDownloadModal}
              disabled={!scripts || Object.keys(scripts).length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="scripts-content">
        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            {warnings.map((warning, index) => (
              <Alert key={index} variant="warning" style={{ marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <strong>Warning:</strong> {warning}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {scripts && Object.keys(scripts).length > 0 ? (
          <>
            {/* Fabric Selector */}
            <div className="script-selector-section">
              <label htmlFor="fabric-select" className="selector-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Select Fabric
              </label>
              <select
                id="fabric-select"
                className="script-selector"
                value={activeTab || ""}
                onChange={(e) => setActiveTab(e.target.value)}
              >
                <option value="">Choose a fabric...</option>
                {Object.entries(scripts).map(([fabricName, fabricData]) => {
                  const fabricInfo = fabricData.fabric_info || { san_vendor: sanVendor };
                  const vendor = fabricInfo.san_vendor;
                  const vendorLabel = vendor === "CI" ? "Cisco" : "Brocade";

                  return (
                    <option key={fabricName} value={fabricName}>
                      [{vendorLabel}] {fabricName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Script Display */}
            {activeTab && currentScript ? (
              <div className="script-display-card">
                <div className="script-card-header">
                  <div className="script-info">
                    <span className={`vendor-badge vendor-badge-${vendor === "CI" ? "cisco" : "brocade"}`}>
                      {vendor === "CI" ? "Cisco" : "Brocade"}
                    </span>
                    <h3 className="script-title">{activeTab}</h3>
                  </div>
                  <div className="script-meta">
                    <span className="command-count">{commands?.length || 0} commands</span>
                  </div>
                </div>

                <div className="script-code-container">
                  <div className="code-block">
                    {vendor === "CI" && <pre className="code-line">config t</pre>}
                    {vendor === "CI" && <pre className="code-line code-line-empty"> </pre>}
                    {commands && commands.map((command, index) => (
                      <pre key={index} className="code-line">{command}</pre>
                    ))}
                    {vendor === "CI" && <pre className="code-line code-line-empty"> </pre>}
                    {vendor === "CI" && <pre className="code-line">copy run start</pre>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <p>Select a fabric from the dropdown to view scripts</p>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>No zone scripts available</p>
            <small>Verify the "Create" column is checked for the zones you want to include</small>
          </div>
        )}
      </div>

      {/* Download Modal */}
      <Modal
        show={showDownloadModal}
        onHide={() => setShowDownloadModal(false)}
        centered
        className={`download-modal theme-${theme}`}
      >
        <Modal.Header closeButton className="download-modal-header">
          <Modal.Title>Download Zone Scripts</Modal.Title>
        </Modal.Header>
        <Modal.Body className="download-modal-body">
          <div className="download-modal-section">
            <label className="download-modal-label">Filename</label>
            <input
              type="text"
              className="download-filename-input"
              value={downloadFilename}
              onChange={(e) => setDownloadFilename(e.target.value)}
            />
          </div>

          <div className="download-modal-section">
            <div className="select-all-header">
              <Form.Check
                type="checkbox"
                id="select-all-fabrics"
                label="Select All"
                checked={Object.keys(scripts).length > 0 && Object.values(selectedFabrics).every(Boolean)}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.values(selectedFabrics).filter(Boolean).length} of {Object.keys(scripts).length} selected
              </span>
            </div>

            <div className="fabric-list">
              {Object.entries(scripts).map(([fabricName, fabricData]) => {
                const fabricInfo = fabricData.fabric_info || { san_vendor: sanVendor };
                const vendor = fabricInfo.san_vendor;
                const vendorLabel = vendor === "CI" ? "Cisco" : "Brocade";
                const commands = Array.isArray(fabricData) ? fabricData : fabricData.commands;

                return (
                  <div key={fabricName} className="fabric-item">
                    <Form.Check
                      type="checkbox"
                      id={`fabric-${fabricName}`}
                      checked={selectedFabrics[fabricName] || false}
                      onChange={() => handleToggleFabric(fabricName)}
                      className="fabric-checkbox"
                    />
                    <label htmlFor={`fabric-${fabricName}`} className="fabric-label">
                      <span className={`vendor-badge-sm vendor-badge-${vendor === "CI" ? "cisco" : "brocade"}`}>
                        {vendorLabel}
                      </span>
                      <span className="fabric-name">{fabricName}</span>
                      <span className="fabric-command-count">{commands?.length || 0} commands</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="download-modal-footer">
          <button
            className="modal-btn modal-btn-secondary"
            onClick={() => setShowDownloadModal(false)}
            disabled={isDownloading}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={handleDownloadSelected}
            disabled={isDownloading || Object.values(selectedFabrics).filter(Boolean).length === 0}
          >
            {isDownloading ? (
              <>
                <div className="btn-spinner"></div>
                Downloading...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download ({Object.values(selectedFabrics).filter(Boolean).length})
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Create Settings Modal */}
      <Modal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        centered
        size="lg"
        className={`download-modal theme-${theme}`}
      >
        <Modal.Header closeButton className="download-modal-header">
          <Modal.Title>Manage Create Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body className="download-modal-body">
          <p style={{ color: 'var(--secondary-text)', marginBottom: '1.5rem' }}>
            Control which aliases and zones should be included in script generation by toggling their "Create" settings.
          </p>

          {/* Fabric Filter and Search */}
          <div className="download-modal-section">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="download-modal-label">Filter by Fabric</label>
                <select
                  className="script-selector"
                  style={{ maxWidth: '100%' }}
                  value={fabricFilter}
                  onChange={(e) => setFabricFilter(e.target.value)}
                >
                  <option value="all">All Fabrics</option>
                  {fabrics.map(fabric => (
                    <option key={fabric.id} value={fabric.id}>{fabric.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="download-modal-label">Search</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="download-filename-input"
                    placeholder="Search aliases and zones..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ paddingRight: searchText ? '2.5rem' : '1rem' }}
                  />
                  {searchText && (
                    <button
                      onClick={() => setSearchText("")}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted-text)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.25rem'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Aliases Section */}
          <div className="download-modal-section">
            <div className="select-all-header">
              <Form.Check
                type="checkbox"
                id="select-all-aliases"
                label="Aliases"
                checked={Object.keys(createSettings.aliases).length > 0 && Object.values(createSettings.aliases).filter(a => (fabricFilter === "all" || String(a.fabric) === String(fabricFilter)) && (searchText === "" || a.name.toLowerCase().includes(searchText.toLowerCase()))).every(a => a.create)}
                onChange={(e) => handleSelectAllCreate('aliases', e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.values(createSettings.aliases).filter(a => (fabricFilter === "all" || String(a.fabric) === String(fabricFilter)) && (searchText === "" || a.name.toLowerCase().includes(searchText.toLowerCase())) && a.create).length} of {Object.values(createSettings.aliases).filter(a => (fabricFilter === "all" || String(a.fabric) === String(fabricFilter)) && (searchText === "" || a.name.toLowerCase().includes(searchText.toLowerCase()))).length} selected
              </span>
            </div>

            <div
              className="fabric-list"
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {Object.values(createSettings.aliases)
                .filter(alias => (fabricFilter === "all" || String(alias.fabric) === String(fabricFilter)) && (searchText === "" || alias.name.toLowerCase().includes(searchText.toLowerCase())))
                .map((alias, index) => (
                <div
                  key={alias.id}
                  className="fabric-item"
                  onMouseEnter={() => handleDragSelect('aliases', alias.id, true)}
                >
                  <Form.Check
                    type="checkbox"
                    id={`alias-${alias.id}`}
                    checked={alias.create}
                    onChange={(e) => handleToggleCreate('aliases', alias.id, index, e)}
                    className="fabric-checkbox"
                  />
                  <label
                    htmlFor={`alias-${alias.id}`}
                    className="fabric-label"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <span className="fabric-name">{alias.name}</span>
                    <span className="fabric-tag">{alias.fabric_name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Zones Section */}
          <div className="download-modal-section">
            <div className="select-all-header">
              <Form.Check
                type="checkbox"
                id="select-all-zones"
                label="Zones"
                checked={Object.keys(createSettings.zones).length > 0 && Object.values(createSettings.zones).filter(z => (fabricFilter === "all" || String(z.fabric) === String(fabricFilter)) && (searchText === "" || z.name.toLowerCase().includes(searchText.toLowerCase()))).every(z => z.create)}
                onChange={(e) => handleSelectAllCreate('zones', e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.values(createSettings.zones).filter(z => (fabricFilter === "all" || String(z.fabric) === String(fabricFilter)) && (searchText === "" || z.name.toLowerCase().includes(searchText.toLowerCase())) && z.create).length} of {Object.values(createSettings.zones).filter(z => (fabricFilter === "all" || String(z.fabric) === String(fabricFilter)) && (searchText === "" || z.name.toLowerCase().includes(searchText.toLowerCase()))).length} selected
              </span>
            </div>

            <div
              className="fabric-list"
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {Object.values(createSettings.zones)
                .filter(zone => (fabricFilter === "all" || String(zone.fabric) === String(fabricFilter)) && (searchText === "" || zone.name.toLowerCase().includes(searchText.toLowerCase())))
                .map((zone, index) => (
                <div
                  key={zone.id}
                  className="fabric-item"
                  onMouseEnter={() => handleDragSelect('zones', zone.id, true)}
                >
                  <Form.Check
                    type="checkbox"
                    id={`zone-${zone.id}`}
                    checked={zone.create}
                    onChange={(e) => handleToggleCreate('zones', zone.id, index, e)}
                    className="fabric-checkbox"
                  />
                  <label
                    htmlFor={`zone-${zone.id}`}
                    className="fabric-label"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <span className="fabric-name">{zone.name}</span>
                    <span className="fabric-tag">{zone.fabric_name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="download-modal-footer">
          <button
            className="modal-btn modal-btn-secondary"
            onClick={() => setShowCreateModal(false)}
            disabled={isSavingSettings}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={handleSaveCreateSettings}
            disabled={isSavingSettings}
          >
            {isSavingSettings ? (
              <>
                <div className="btn-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
                Save Settings
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ZoneScriptsPage;