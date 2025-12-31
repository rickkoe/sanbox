import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Alert, Spinner, Modal, Form } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import JSZip from "jszip";
import "../../styles/scriptspages.css";

/**
 * StorageScriptsContent - Reusable component for displaying storage scripts
 *
 * @param {number} storageId - Optional: if provided, filter to this storage system
 * @param {string} storageName - Optional: storage system name for display (when storageId is provided)
 * @param {boolean} hideStorageSelector - Whether to hide the storage system dropdown
 * @param {string} backPath - Path for the back button (defaults to "/storage/systems")
 */
const StorageScriptsContent = ({
  storageId = null,
  storageName = null,
  hideStorageSelector = false,
  backPath = "/storage/systems"
}) => {
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();
  const [mkHostScripts, setMkHostScripts] = useState({});
  const [volumeScripts, setVolumeScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [activeTab, setActiveTab] = useState(null);
  const [scriptType, setScriptType] = useState("mkhost"); // "mkhost" or "volume"
  const navigate = useNavigate();

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState({});
  const [downloadFilename, setDownloadFilename] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  // Get the current scripts based on scriptType
  const scripts = scriptType === "mkhost" ? mkHostScripts : volumeScripts;

  useEffect(() => {
    // Wait until we actually have config loaded
    if (!config || Object.keys(config).length === 0) {
      return;
    }

    if (!config.active_project?.id) {
      setError("No active project selected");
      setLoading(false);
      return;
    }

    const fetchScripts = async () => {
      try {
        const projectId = config.active_project.id;

        // Build API URLs based on whether we're filtering to a specific storage
        let mkHostUrl, volumeUrl;
        if (storageId) {
          mkHostUrl = `/api/storage/mkhost-scripts/project/${projectId}/storage/${storageId}/`;
          volumeUrl = `/api/storage/volume-scripts/project/${projectId}/storage/${storageId}/`;
        } else {
          mkHostUrl = `/api/storage/mkhost-scripts/project/${projectId}/`;
          volumeUrl = `/api/storage/volume-scripts/project/${projectId}/`;
        }

        // Fetch both mkhost scripts and volume DSCLI scripts in parallel
        const [mkHostResponse, volumeResponse] = await Promise.all([
          axios.get(mkHostUrl),
          axios.get(volumeUrl)
        ]);

        console.log('MkHost scripts response:', mkHostResponse.data);
        console.log('Volume scripts response:', volumeResponse.data);

        const mkHostData = mkHostResponse.data.storage_scripts || {};
        const volumeData = volumeResponse.data.storage_scripts || {};

        setMkHostScripts(mkHostData);
        setVolumeScripts(volumeData);

        // Set first tab as active based on current script type
        const currentScripts = scriptType === "mkhost" ? mkHostData : volumeData;
        const scriptKeys = Object.keys(currentScripts);
        if (!activeTab && scriptKeys.length > 0) {
          setActiveTab(scriptKeys[0]);
        }

        // Initialize all storage systems as selected
        const initialSelection = {};
        Object.keys(mkHostData).forEach(key => {
          initialSelection[key] = true;
        });
        Object.keys(volumeData).forEach(key => {
          initialSelection[key] = true;
        });
        setSelectedStorage(initialSelection);
      } catch (err) {
        console.error("Error fetching storage scripts:", err);
        setError("Error fetching storage scripts");
      } finally {
        setLoading(false);
      }
    };

    fetchScripts();
  }, [config, storageId]);

  // Update activeTab when scriptType changes
  useEffect(() => {
    const currentScripts = scriptType === "mkhost" ? mkHostScripts : volumeScripts;
    const scriptKeys = Object.keys(currentScripts);
    if (scriptKeys.length > 0) {
      setActiveTab(scriptKeys[0]);
    } else {
      setActiveTab(null);
    }
  }, [scriptType, mkHostScripts, volumeScripts]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const scriptData = scripts[activeTab];
      const headerType = scriptType === "mkhost" ? "MKHOST" : "MKVOL";
      const header = `### ${activeTab.toUpperCase()} ${headerType} COMMANDS`;
      const commands = scriptData.commands || [];
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
    const cleanCustomerName = customerName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const scriptTypeName = scriptType === "mkhost" ? "MkHost" : "MkVol";

    // Include storage name in filename if filtering to single storage
    if (storageName) {
      const cleanStorageName = storageName.replace(/[^a-zA-Z0-9-_]/g, "_");
      return `${cleanCustomerName}_${cleanProjectName}_${cleanStorageName}_${scriptTypeName}_Scripts_${timestamp}.zip`;
    }
    return `${cleanCustomerName}_${cleanProjectName}_Storage_${scriptTypeName}_Scripts_${timestamp}.zip`;
  };

  const handleOpenDownloadModal = () => {
    setDownloadFilename(getDefaultFilename());
    setShowDownloadModal(true);
  };

  const handleSelectAll = (checked) => {
    const newSelection = {};
    Object.keys(scripts).forEach(key => {
      newSelection[key] = checked;
    });
    setSelectedStorage(prev => ({ ...prev, ...newSelection }));
  };

  const handleToggleStorage = (storageName) => {
    setSelectedStorage(prev => ({
      ...prev,
      [storageName]: !prev[storageName]
    }));
  };

  const handleDownloadSelected = async () => {
    const selectedCount = Object.entries(selectedStorage)
      .filter(([key, val]) => val && scripts[key])
      .length;

    if (selectedCount === 0) {
      alert("Please select at least one storage system to download.");
      return;
    }

    try {
      setIsDownloading(true);

      const zip = new JSZip();
      const scriptTypeName = scriptType === "mkhost" ? "mkhost" : "mkvol";

      // Add each selected storage system's commands as a separate text file
      Object.entries(scripts).forEach(([storageNameKey, storageData]) => {
        if (!selectedStorage[storageNameKey]) return;

        const commands = storageData.commands || [];
        const storageType = storageData.storage_type || "Unknown";
        const headerType = scriptType === "mkhost" ? "MKHOST" : "MKVOL";

        // Create file content
        const header = `### ${storageNameKey.toUpperCase()} ${headerType} COMMANDS (${storageType})`;
        const commandsText = Array.isArray(commands) ? commands.join("\n") : "";
        const fileContent = `${header}\n${commandsText}`;

        // Create filename with storage name, project name and timestamp
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
        const cleanStorageName = storageNameKey.replace(/[^a-zA-Z0-9-_]/g, "_");
        const cleanProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
        const fileName = `${storageType}_${cleanStorageName}_${cleanProjectName}_${scriptTypeName}_scripts_${timestamp}.txt`;

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
          <span>Loading storage scripts...</span>
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
  const commands = currentScript ? (currentScript.commands || []) : [];
  const storageType = currentScript ? (currentScript.storage_type || "Unknown") : "";
  const hostCount = currentScript ? (currentScript.host_count || 0) : 0;
  const volumeCount = currentScript ? (currentScript.volume_count || 0) : 0;
  const rangeCount = currentScript ? (currentScript.range_count || 0) : 0;

  // Check if there are any scripts available
  const hasMkHostScripts = Object.keys(mkHostScripts).length > 0;
  const hasVolumeScripts = Object.keys(volumeScripts).length > 0;
  const hasAnyScripts = hasMkHostScripts || hasVolumeScripts;

  // Determine title based on context
  const pageTitle = storageName ? `${storageName} Scripts` : "Storage Scripts";
  const pageDescription = storageName
    ? `Generate DSCLI commands for ${storageName}`
    : "Generate DSCLI commands for storage systems";

  return (
    <div className="scripts-page-container">
      {/* Page Header */}
      <div className="scripts-header">
        <div className="scripts-header-content">
          <div className="header-title-section">
            <button
              className="back-btn"
              onClick={() => navigate(backPath)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <div>
              <h1 className="scripts-title">{pageTitle}</h1>
              <p className="scripts-description">{pageDescription}</p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="script-action-btn script-action-btn-secondary"
              onClick={handleCopyToClipboard}
              disabled={!activeTab || !scripts[activeTab]}
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
        {hasAnyScripts ? (
          <>
            {/* Script Type Toggle */}
            <div className="script-type-toggle">
              <button
                className={`script-type-btn ${scriptType === "mkhost" ? "active" : ""}`}
                onClick={() => setScriptType("mkhost")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                MkHost Commands
                {hasMkHostScripts && (
                  <span className="script-count-badge">{Object.keys(mkHostScripts).length}</span>
                )}
              </button>
              <button
                className={`script-type-btn ${scriptType === "volume" ? "active" : ""}`}
                onClick={() => setScriptType("volume")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                MkVol Commands
                {hasVolumeScripts && (
                  <span className="script-count-badge">{Object.keys(volumeScripts).length}</span>
                )}
              </button>
            </div>

            {Object.keys(scripts).length > 0 ? (
              <>
                {/* Storage Selector - only show if not hiding it */}
                {!hideStorageSelector && (
                  <div className="script-selector-section">
                    <label htmlFor="storage-select" className="selector-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="6" width="20" height="4" rx="1"/>
                        <rect x="2" y="14" width="20" height="4" rx="1"/>
                      </svg>
                      Select Storage System
                    </label>
                    <select
                      id="storage-select"
                      className="script-selector"
                      value={activeTab || ""}
                      onChange={(e) => setActiveTab(e.target.value)}
                    >
                      <option value="">Choose a storage system...</option>
                      {Object.entries(scripts).map(([storageNameKey, storageData]) => {
                        const type = storageData.storage_type || "Unknown";
                        const hosts = storageData.host_count || 0;
                        const vols = storageData.volume_count || 0;

                        return (
                          <option key={storageNameKey} value={storageNameKey}>
                            [{type}] {storageNameKey} {scriptType === "mkhost" ? `(${hosts} hosts)` : `(${vols} volumes)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Script Display */}
                {activeTab && currentScript ? (
                  <div className="script-display-card">
                    <div className="script-card-header">
                      <div className="script-info">
                        <span className={`vendor-badge vendor-badge-${storageType === "FlashSystem" ? "flashsystem" : storageType === "DS8000" ? "ds8000" : "generic"}`}>
                          {storageType}
                        </span>
                        <h3 className="script-title">{activeTab}</h3>
                      </div>
                      <div className="script-meta">
                        {scriptType === "mkhost" ? (
                          <span className="command-count">{hostCount} hosts - {commands.length} commands</span>
                        ) : (
                          <span className="command-count">{volumeCount} volumes in {rangeCount} ranges - {commands.length} commands</span>
                        )}
                      </div>
                    </div>

                    <div className="script-code-container">
                      {commands.length > 0 ? (
                        <div className="code-block">
                          {commands.map((command, index) => (
                            <pre key={index} className="code-line">{command}</pre>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state-inline">
                          <p>{scriptType === "mkhost" ? "No hosts found for this storage system" : "No volumes found for this storage system"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="6" width="20" height="4" rx="1"/>
                      <rect x="2" y="14" width="20" height="4" rx="1"/>
                    </svg>
                    <p>Select a storage system from the dropdown to view scripts</p>
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
                <p>No {scriptType === "mkhost" ? "mkhost" : "volume"} scripts available</p>
                <small>
                  {scriptType === "mkhost"
                    ? "Make sure you have hosts assigned to storage systems"
                    : "Make sure you have uncommitted DS8000 volumes in this project"}
                </small>
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
            <p>No storage scripts available</p>
            <small>
              {storageName
                ? `Make sure you have hosts or volumes assigned to ${storageName} in this project`
                : "Make sure you have hosts or volumes assigned to storage systems in this project"
              }
            </small>
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
          <Modal.Title>Download {scriptType === "mkhost" ? "MkHost" : "MkVol"} Scripts</Modal.Title>
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
                id="select-all-storage"
                label="Select All"
                checked={Object.keys(scripts).length > 0 && Object.keys(scripts).every(key => selectedStorage[key])}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.entries(selectedStorage).filter(([key, val]) => val && scripts[key]).length} of {Object.keys(scripts).length} selected
              </span>
            </div>

            <div className="fabric-list">
              {Object.entries(scripts).map(([storageNameKey, storageData]) => {
                const storageTypeVal = storageData.storage_type || "Unknown";
                const hostCountVal = storageData.host_count || 0;
                const volumeCountVal = storageData.volume_count || 0;
                const commandsArr = storageData.commands || [];

                return (
                  <div key={storageNameKey} className="fabric-item">
                    <Form.Check
                      type="checkbox"
                      id={`storage-${storageNameKey}`}
                      checked={selectedStorage[storageNameKey] || false}
                      onChange={() => handleToggleStorage(storageNameKey)}
                      className="fabric-checkbox"
                    />
                    <label htmlFor={`storage-${storageNameKey}`} className="fabric-label">
                      <span className={`vendor-badge-sm vendor-badge-${storageTypeVal === "FlashSystem" ? "flashsystem" : storageTypeVal === "DS8000" ? "ds8000" : "generic"}`}>
                        {storageTypeVal}
                      </span>
                      <span className="fabric-name">{storageNameKey}</span>
                      <span className="fabric-command-count">
                        {scriptType === "mkhost" ? `${hostCountVal} hosts` : `${volumeCountVal} volumes`} - {commandsArr.length} commands
                      </span>
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
            disabled={isDownloading || Object.entries(selectedStorage).filter(([key, val]) => val && scripts[key]).length === 0}
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
                Download ({Object.entries(selectedStorage).filter(([key, val]) => val && scripts[key]).length})
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StorageScriptsContent;
