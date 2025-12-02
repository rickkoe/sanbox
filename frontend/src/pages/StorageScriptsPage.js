import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Alert, Spinner, Modal, Form } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import JSZip from "jszip";
import "../styles/scriptspages.css";

const StorageScriptsPage = () => {
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [activeTab, setActiveTab] = useState(null);
  const navigate = useNavigate();

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState({});
  const [downloadFilename, setDownloadFilename] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

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
        const response = await axios.get(
          `/api/storage/mkhost-scripts/project/${projectId}/`
        );

        console.log('Storage scripts response:', response.data);
        const storageScripts = response.data.storage_scripts || {};
        setScripts(storageScripts);

        // Set first tab as active if no tab is selected
        const scriptKeys = Object.keys(storageScripts);
        if (!activeTab && scriptKeys.length > 0) {
          setActiveTab(scriptKeys[0]);
        }

        // Initialize all storage systems as selected
        const initialSelection = {};
        scriptKeys.forEach(key => {
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
  }, [config, activeTab]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const header = `### ${activeTab.toUpperCase()} MKHOST COMMANDS`;
      const commands = scripts[activeTab].commands || [];
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
    return `${cleanCustomerName}_${cleanProjectName}_Storage_MkHost_Scripts_${timestamp}.zip`;
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
    setSelectedStorage(newSelection);
  };

  const handleToggleStorage = (storageName) => {
    setSelectedStorage(prev => ({
      ...prev,
      [storageName]: !prev[storageName]
    }));
  };

  const handleDownloadSelected = async () => {
    const selectedCount = Object.values(selectedStorage).filter(Boolean).length;

    if (selectedCount === 0) {
      alert("Please select at least one storage system to download.");
      return;
    }

    try {
      setIsDownloading(true);

      const zip = new JSZip();

      // Add each selected storage system's commands as a separate text file
      Object.entries(scripts).forEach(([storageName, storageData]) => {
        if (!selectedStorage[storageName]) return;

        const commands = storageData.commands || [];
        const storageType = storageData.storage_type || "Unknown";

        // Create file content
        const header = `### ${storageName.toUpperCase()} MKHOST COMMANDS (${storageType})`;
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
        const cleanStorageName = storageName.replace(/[^a-zA-Z0-9-_]/g, "_");
        const cleanProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
        const fileName = `${storageType}_${cleanStorageName}_${cleanProjectName}_mkhost_scripts_${timestamp}.txt`;

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

  return (
    <div className="scripts-page-container">
      {/* Page Header */}
      <div className="scripts-header">
        <div className="scripts-header-content">
          <div className="header-title-section">
            <button
              className="back-btn"
              onClick={() => navigate("/storage/systems")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <div>
              <h1 className="scripts-title">Storage MkHost Scripts</h1>
              <p className="scripts-description">Generate host configuration scripts for storage systems</p>
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
        {scripts && Object.keys(scripts).length > 0 ? (
          <>
            {/* Storage Selector */}
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
                {Object.entries(scripts).map(([storageName, storageData]) => {
                  const type = storageData.storage_type || "Unknown";
                  const hosts = storageData.host_count || 0;

                  return (
                    <option key={storageName} value={storageName}>
                      [{type}] {storageName} ({hosts} hosts)
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
                    <span className={`vendor-badge vendor-badge-${storageType === "FlashSystem" ? "flashsystem" : storageType === "DS8000" ? "ds8000" : "generic"}`}>
                      {storageType}
                    </span>
                    <h3 className="script-title">{activeTab}</h3>
                  </div>
                  <div className="script-meta">
                    <span className="command-count">{hostCount} hosts • {commands.length} commands</span>
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
                      <p>No hosts found for this storage system</p>
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
            <p>No storage scripts available</p>
            <small>Make sure you have hosts assigned to storage systems</small>
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
          <Modal.Title>Download Storage Scripts</Modal.Title>
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
                checked={Object.keys(scripts).length > 0 && Object.values(selectedStorage).every(Boolean)}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.values(selectedStorage).filter(Boolean).length} of {Object.keys(scripts).length} selected
              </span>
            </div>

            <div className="fabric-list">
              {Object.entries(scripts).map(([storageName, storageData]) => {
                const storageType = storageData.storage_type || "Unknown";
                const hostCount = storageData.host_count || 0;
                const commands = storageData.commands || [];

                return (
                  <div key={storageName} className="fabric-item">
                    <Form.Check
                      type="checkbox"
                      id={`storage-${storageName}`}
                      checked={selectedStorage[storageName] || false}
                      onChange={() => handleToggleStorage(storageName)}
                      className="fabric-checkbox"
                    />
                    <label htmlFor={`storage-${storageName}`} className="fabric-label">
                      <span className={`vendor-badge-sm vendor-badge-${storageType === "FlashSystem" ? "flashsystem" : storageType === "DS8000" ? "ds8000" : "generic"}`}>
                        {storageType}
                      </span>
                      <span className="fabric-name">{storageName}</span>
                      <span className="fabric-command-count">{hostCount} hosts • {commands.length} commands</span>
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
            disabled={isDownloading || Object.values(selectedStorage).filter(Boolean).length === 0}
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
                Download ({Object.values(selectedStorage).filter(Boolean).length})
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StorageScriptsPage;