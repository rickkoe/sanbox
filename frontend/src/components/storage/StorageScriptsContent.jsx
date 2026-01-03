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
  const [volumeMappingScripts, setVolumeMappingScripts] = useState({});
  const [mklcuScripts, setMklcuScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [activeTab, setActiveTab] = useState(null);
  const [scriptType, setScriptType] = useState("mkhost"); // "mkhost", "volume", "mapping", "mklcu", or "all"
  const navigate = useNavigate();

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedScriptTypes, setSelectedScriptTypes] = useState({});
  const [includeComments, setIncludeComments] = useState(true);

  // Helper function to filter out comments from commands
  const filterComments = (commandsList) => {
    if (includeComments || !commandsList) return commandsList;
    return commandsList.filter(cmd => {
      const trimmed = cmd.trim();
      // Keep non-comment lines and non-empty lines
      return trimmed && !trimmed.startsWith('#');
    });
  };

  // Build combined "all" scripts that merge all command types per storage system
  const allScripts = React.useMemo(() => {
    const combined = {};
    const allStorageNames = new Set([
      ...Object.keys(mkHostScripts),
      ...Object.keys(volumeScripts),
      ...Object.keys(volumeMappingScripts),
      ...Object.keys(mklcuScripts)
    ]);

    allStorageNames.forEach(storageName => {
      const mkHost = mkHostScripts[storageName];
      const volume = volumeScripts[storageName];
      const mapping = volumeMappingScripts[storageName];
      const mklcu = mklcuScripts[storageName];

      // Combine all commands (backend already includes section headers)
      const allCommands = [];

      // MkLCU commands should come first (create LCUs before volumes)
      if (mklcu && mklcu.commands && mklcu.commands.length > 0) {
        allCommands.push(...mklcu.commands);
        allCommands.push('');
      }

      if (mkHost && mkHost.commands && mkHost.commands.length > 0) {
        allCommands.push(...mkHost.commands);
        allCommands.push('');
      }

      if (volume && volume.commands && volume.commands.length > 0) {
        allCommands.push(...volume.commands);
        allCommands.push('');
      }

      if (mapping && mapping.commands && mapping.commands.length > 0) {
        allCommands.push(...mapping.commands);
      }

      // Only include if there are any commands
      if (allCommands.length > 0) {
        combined[storageName] = {
          storage_type: mkHost?.storage_type || volume?.storage_type || mapping?.storage_type || mklcu?.storage_type || "Unknown",
          host_count: mkHost?.host_count || 0,
          volume_count: volume?.volume_count || mapping?.volume_count || 0,
          range_count: volume?.range_count || 0,
          mapping_count: mapping?.mapping_count || 0,
          lcu_count: mklcu?.lcu_count || 0,
          mkhost_command_count: mkHost?.host_count || 0,
          volume_command_count: volume?.command_count || 0,
          mapping_command_count: mapping?.mapping_count || 0,
          mklcu_command_count: mklcu?.lcu_count || 0,
          commands: allCommands
        };
      }
    });

    return combined;
  }, [mkHostScripts, volumeScripts, volumeMappingScripts, mklcuScripts]);

  // Get all unique storage system names across all script types
  const allStorageSystems = React.useMemo(() => {
    const storageMap = new Map();

    // Gather storage info from all script types
    [mkHostScripts, volumeScripts, volumeMappingScripts, mklcuScripts].forEach(scriptObj => {
      Object.entries(scriptObj).forEach(([name, data]) => {
        if (!storageMap.has(name)) {
          storageMap.set(name, {
            storage_type: data.storage_type || "Unknown",
            host_count: data.host_count || 0,
            volume_count: data.volume_count || 0,
            range_count: data.range_count || 0,
            lcu_count: data.lcu_count || 0
          });
        } else {
          // Merge counts from different script types
          const existing = storageMap.get(name);
          storageMap.set(name, {
            ...existing,
            host_count: existing.host_count || data.host_count || 0,
            volume_count: existing.volume_count || data.volume_count || 0,
            range_count: existing.range_count || data.range_count || 0,
            lcu_count: existing.lcu_count || data.lcu_count || 0
          });
        }
      });
    });

    return storageMap;
  }, [mkHostScripts, volumeScripts, volumeMappingScripts, mklcuScripts]);

  // Get the current scripts based on scriptType
  const scripts = scriptType === "mkhost" ? mkHostScripts : scriptType === "volume" ? volumeScripts : scriptType === "mapping" ? volumeMappingScripts : scriptType === "mklcu" ? mklcuScripts : allScripts;

  // Dynamic script types configuration - add new script types here
  // Each entry automatically appears in dropdown and download modal
  const scriptTypesConfig = React.useMemo(() => [
    {
      id: 'mklcu',
      label: 'MkLCU Commands',
      filenameSuffix: 'mklcu',
      scripts: mklcuScripts,
      icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/></>,
      getCount: (data) => `${data?.lcu_count || 0} LCUs - ${data?.commands?.length || 0} commands`
    },
    {
      id: 'mkhost',
      label: 'MkHost Commands',
      filenameSuffix: 'mkhost',
      scripts: mkHostScripts,
      icon: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
      getCount: (data) => `${data?.host_count || 0} hosts - ${data?.commands?.length || 0} commands`
    },
    {
      id: 'volume',
      label: 'MkVol Commands',
      filenameSuffix: 'mkvol',
      scripts: volumeScripts,
      icon: <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>,
      getCount: (data) => `${data?.volume_count || 0} volumes - ${data?.commands?.length || 0} commands`
    },
    {
      id: 'mapping',
      label: 'MapVol Commands',
      filenameSuffix: 'mapvol',
      scripts: volumeMappingScripts,
      icon: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
      getCount: (data) => `${data?.volume_count || 0} volumes - ${data?.commands?.length || 0} commands`
    },
    {
      id: 'all',
      label: 'All Commands (combined)',
      filenameSuffix: 'all',
      scripts: allScripts,
      icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
      getCount: (data) => `${data?.commands?.length || 0} total commands`,
      isCombined: true
    }
  ], [mkHostScripts, volumeScripts, volumeMappingScripts, mklcuScripts, allScripts]);

  // Get individual script types (excluding 'all' for dropdown)
  const individualScriptTypes = React.useMemo(() =>
    scriptTypesConfig.filter(st => !st.isCombined),
    [scriptTypesConfig]
  );

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
        let mkHostUrl, volumeUrl, mappingUrl, mklcuUrl;
        if (storageId) {
          mkHostUrl = `/api/storage/mkhost-scripts/project/${projectId}/storage/${storageId}/`;
          volumeUrl = `/api/storage/volume-scripts/project/${projectId}/storage/${storageId}/`;
          mappingUrl = `/api/storage/volume-mapping-scripts/project/${projectId}/storage/${storageId}/`;
          mklcuUrl = `/api/storage/mklcu-scripts/project/${projectId}/storage/${storageId}/`;
        } else {
          mkHostUrl = `/api/storage/mkhost-scripts/project/${projectId}/`;
          volumeUrl = `/api/storage/volume-scripts/project/${projectId}/`;
          mappingUrl = `/api/storage/volume-mapping-scripts/project/${projectId}/`;
          mklcuUrl = `/api/storage/mklcu-scripts/project/${projectId}/`;
        }

        // Fetch mkhost scripts, volume DSCLI scripts, volume mapping scripts, and mklcu scripts in parallel
        const [mkHostResponse, volumeResponse, mappingResponse, mklcuResponse] = await Promise.all([
          axios.get(mkHostUrl),
          axios.get(volumeUrl),
          axios.get(mappingUrl),
          axios.get(mklcuUrl)
        ]);

        console.log('MkHost scripts response:', mkHostResponse.data);
        console.log('Volume scripts response:', volumeResponse.data);
        console.log('Volume mapping scripts response:', mappingResponse.data);
        console.log('MkLCU scripts response:', mklcuResponse.data);

        const mkHostData = mkHostResponse.data.storage_scripts || {};
        const volumeData = volumeResponse.data.storage_scripts || {};
        const mappingData = mappingResponse.data.storage_scripts || {};
        const mklcuData = mklcuResponse.data.storage_scripts || {};

        setMkHostScripts(mkHostData);
        setVolumeScripts(volumeData);
        setVolumeMappingScripts(mappingData);
        setMklcuScripts(mklcuData);

        // Set first tab as active based on current script type
        const currentScripts = scriptType === "mkhost" ? mkHostData : scriptType === "volume" ? volumeData : scriptType === "mklcu" ? mklcuData : mappingData;
        const scriptKeys = Object.keys(currentScripts);
        if (!activeTab && scriptKeys.length > 0) {
          setActiveTab(scriptKeys[0]);
        }
      } catch (err) {
        console.error("Error fetching storage scripts:", err);
        setError("Error fetching storage scripts");
      } finally {
        setLoading(false);
      }
    };

    fetchScripts();
  }, [config, storageId]);

  // Update activeTab when scriptType changes - keep current selection if storage exists
  useEffect(() => {
    // Get all storage system names
    const allStorageNames = new Set([
      ...Object.keys(mkHostScripts),
      ...Object.keys(volumeScripts),
      ...Object.keys(volumeMappingScripts),
      ...Object.keys(mklcuScripts)
    ]);

    // If current activeTab is valid (exists in any script type), keep it
    if (activeTab && allStorageNames.has(activeTab)) {
      return; // Keep current selection
    }

    // Otherwise, select the first available storage
    if (allStorageNames.size > 0) {
      setActiveTab(Array.from(allStorageNames)[0]);
    } else {
      setActiveTab(null);
    }
  }, [scriptType, mkHostScripts, volumeScripts, volumeMappingScripts, mklcuScripts]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const scriptData = scripts[activeTab];
      const commands = filterComments(scriptData.commands || []);
      // Backend already includes section headers with storage name, so just join the commands
      const textToCopy = Array.isArray(commands) ? commands.join("\n") : "";

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

  const getDefaultFilename = (storageNameForFile) => {
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
    const cleanStorageName = (storageNameForFile || "Storage").replace(/[^a-zA-Z0-9-_]/g, "_");

    return `${cleanCustomerName}_${cleanProjectName}_${cleanStorageName}_Scripts_${timestamp}.zip`;
  };

  const handleOpenDownloadModal = () => {
    if (!activeTab) return;

    // Reset script type selections - check all types that have commands for this storage
    const newSelections = {};
    scriptTypesConfig.forEach(st => {
      const hasCommands = st.scripts[activeTab]?.commands?.length > 0;
      newSelections[st.id] = hasCommands;
    });

    setSelectedScriptTypes(newSelections);
    setDownloadFilename(getDefaultFilename(activeTab));
    setShowDownloadModal(true);
  };

  const handleToggleScriptType = (type) => {
    setSelectedScriptTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSelectAllScriptTypes = (checked) => {
    const newSelections = {};
    scriptTypesConfig.forEach(st => {
      const hasCommands = st.scripts[activeTab]?.commands?.length > 0;
      newSelections[st.id] = checked && hasCommands;
    });
    setSelectedScriptTypes(newSelections);
  };

  const handleDownloadSelected = async () => {
    if (!activeTab) {
      alert("No storage system selected.");
      return;
    }

    const selectedCount = Object.values(selectedScriptTypes).filter(Boolean).length;
    if (selectedCount === 0) {
      alert("Please select at least one script type to download.");
      return;
    }

    try {
      setIsDownloading(true);

      const zip = new JSZip();
      const storageNameKey = activeTab;
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

      // Add selected script types as separate files (dynamically from config)
      scriptTypesConfig.forEach(st => {
        if (selectedScriptTypes[st.id] && st.scripts[storageNameKey]?.commands?.length > 0) {
          const data = st.scripts[storageNameKey];
          const storageType = data.storage_type || "Unknown";
          const filteredCommands = filterComments(data.commands);
          const commandsText = filteredCommands.join("\n");
          const fileName = `${storageType}_${cleanStorageName}_${cleanProjectName}_${st.filenameSuffix}_${timestamp}.txt`;
          zip.file(fileName, commandsText);
        }
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

  // Check if there are any scripts available
  const hasMkHostScripts = Object.keys(mkHostScripts).length > 0;
  const hasVolumeScripts = Object.keys(volumeScripts).length > 0;
  const hasVolumeMappingScripts = Object.keys(volumeMappingScripts).length > 0;
  const hasMklcuScripts = Object.keys(mklcuScripts).length > 0;
  const hasAnyScripts = hasMkHostScripts || hasVolumeScripts || hasVolumeMappingScripts || hasMklcuScripts;

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
            <div className="comments-toggle">
              <Form.Check
                type="switch"
                id="include-comments-switch"
                label="Include comments"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="comments-switch"
              />
            </div>

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
              disabled={!activeTab}
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
              <div className="script-type-dropdown-wrapper">
                <select
                  className={`script-type-dropdown ${scriptType !== "all" ? "active" : ""}`}
                  value={scriptType === "all" ? individualScriptTypes[0]?.id : scriptType}
                  onChange={(e) => setScriptType(e.target.value)}
                >
                  {individualScriptTypes.map(st => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
                <svg className="dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>
              <button
                className={`script-type-btn ${scriptType === "all" ? "active" : ""}`}
                onClick={() => setScriptType("all")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                All Commands
              </button>
            </div>

            {allStorageSystems.size > 0 ? (
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
                      {Array.from(allStorageSystems.entries()).map(([storageNameKey, storageData]) => {
                        const type = storageData.storage_type || "Unknown";
                        const hosts = storageData.host_count || 0;
                        const vols = storageData.volume_count || 0;
                        const lcus = storageData.lcu_count || 0;

                        let countLabel;
                        if (scriptType === "mkhost") {
                          countLabel = `(${hosts} hosts)`;
                        } else if (scriptType === "mklcu") {
                          countLabel = `(${lcus} LCUs)`;
                        } else if (scriptType === "all") {
                          countLabel = "";
                        } else {
                          countLabel = `(${vols} volumes)`;
                        }

                        return (
                          <option key={storageNameKey} value={storageNameKey}>
                            [{type}] {storageNameKey} {countLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Script Display */}
                {activeTab && allStorageSystems.has(activeTab) ? (
                  <div className="script-display-card">
                    <div className="script-card-header">
                      <div className="script-info">
                        {(() => {
                          const displayStorageType = currentScript?.storage_type || allStorageSystems.get(activeTab)?.storage_type || "Unknown";
                          return (
                            <span className={`vendor-badge vendor-badge-${displayStorageType === "FlashSystem" ? "flashsystem" : displayStorageType === "DS8000" ? "ds8000" : "generic"}`}>
                              {displayStorageType}
                            </span>
                          );
                        })()}
                        <h3 className="script-title">{activeTab}</h3>
                      </div>
                      <div className="script-meta">
                        {(() => {
                          const storageInfo = allStorageSystems.get(activeTab) || {};
                          const displayHostCount = currentScript?.host_count ?? storageInfo.host_count ?? 0;
                          const displayVolumeCount = currentScript?.volume_count ?? storageInfo.volume_count ?? 0;
                          const displayRangeCount = currentScript?.range_count ?? storageInfo.range_count ?? 0;
                          const displayLcuCount = currentScript?.lcu_count ?? storageInfo.lcu_count ?? 0;

                          if (scriptType === "mkhost") {
                            return <span className="command-count">{displayHostCount} hosts - {commands.length} commands</span>;
                          } else if (scriptType === "volume") {
                            return <span className="command-count">{displayVolumeCount} volumes in {displayRangeCount} ranges - {commands.length} commands</span>;
                          } else if (scriptType === "mapping") {
                            return <span className="command-count">{displayVolumeCount} volumes - {commands.length} commands</span>;
                          } else if (scriptType === "mklcu") {
                            return <span className="command-count">{displayLcuCount} LCUs - {commands.length} commands</span>;
                          } else {
                            return (
                              <span className="command-count">
                                {currentScript?.mklcu_command_count || 0} mklcu, {currentScript?.mkhost_command_count || 0} mkhost, {currentScript?.volume_command_count || 0} mkvol, {currentScript?.mapping_command_count || 0} mapvol
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {/* Warning for CKD LSSs without SSID defined */}
                    {scriptType === "mklcu" && currentScript?.lss_without_ssid?.length > 0 && (
                      <div className="script-warning-banner">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div className="warning-content">
                          <strong>Warning:</strong> {currentScript.lss_without_ssid.length} CKD LSS{currentScript.lss_without_ssid.length > 1 ? 's' : ''} without SSID defined: {currentScript.lss_without_ssid.join(', ')}
                          <div className="warning-hint">Go to LSS Summary to define SSIDs for these LSSs.</div>
                        </div>
                      </div>
                    )}

                    <div className="script-code-container">
                      {filterComments(commands).length > 0 ? (
                        <div className="code-block">
                          {filterComments(commands).map((command, index) => (
                            <pre key={index} className={`code-line${command === '' ? ' blank-line' : ''}`}>{command || '\u00A0'}</pre>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state-inline">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          <p>{scriptType === "mkhost" ? "No hosts found for this storage system" : scriptType === "volume" ? "No volumes found for this storage system" : scriptType === "mapping" ? "No volume mappings found for this storage system" : scriptType === "mklcu" ? "No CKD volumes found for this DS8000 storage system" : "No commands found for this storage system"}</p>
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
                <p>No {scriptType === "mkhost" ? "mkhost" : scriptType === "volume" ? "volume" : scriptType === "mapping" ? "volume mapping" : scriptType === "mklcu" ? "mklcu" : ""} scripts available</p>
                <small>
                  {scriptType === "mkhost"
                    ? "Make sure you have hosts assigned to storage systems"
                    : scriptType === "volume"
                    ? "Make sure you have uncommitted DS8000 volumes in this project"
                    : scriptType === "mapping"
                    ? "Make sure you have volume mappings defined in this project"
                    : scriptType === "mklcu"
                    ? "Make sure you have DS8000 storage systems with CKD volumes in this project"
                    : "Make sure you have hosts, volumes, or mappings defined in this project"}
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
          <Modal.Title>Download Scripts for {activeTab}</Modal.Title>
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
            <label className="download-modal-label">Select Script Types</label>
            <div className="select-all-header">
              <Form.Check
                type="checkbox"
                id="select-all-types"
                label="Select All"
                checked={scriptTypesConfig.every(st =>
                  st.scripts[activeTab]?.commands?.length > 0 ? selectedScriptTypes[st.id] : true
                )}
                onChange={(e) => handleSelectAllScriptTypes(e.target.checked)}
                className="select-all-checkbox"
              />
              <span className="selection-count">
                {Object.values(selectedScriptTypes).filter(Boolean).length} selected
              </span>
            </div>

            <div className="fabric-list">
              {/* Dynamically render script type options */}
              {scriptTypesConfig.map(st => {
                const data = st.scripts[activeTab];
                const hasCommands = data?.commands?.length > 0;
                if (!hasCommands) return null;

                return (
                  <div key={st.id} className="fabric-item">
                    <Form.Check
                      type="checkbox"
                      id={`type-${st.id}`}
                      checked={selectedScriptTypes[st.id] || false}
                      onChange={() => handleToggleScriptType(st.id)}
                      className="fabric-checkbox"
                    />
                    <label htmlFor={`type-${st.id}`} className="fabric-label">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                        {st.icon}
                      </svg>
                      <span className="fabric-name">{st.label}</span>
                      <span className="fabric-command-count">
                        {st.getCount(data)}
                      </span>
                    </label>
                  </div>
                );
              })}

              {/* Show message if no scripts available */}
              {!scriptTypesConfig.some(st => st.scripts[activeTab]?.commands?.length > 0) && (
                <div className="empty-state-inline">
                  <p>No scripts available for this storage system</p>
                </div>
              )}
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
            disabled={isDownloading || Object.values(selectedScriptTypes).filter(Boolean).length === 0}
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
                Download ({Object.values(selectedScriptTypes).filter(Boolean).length})
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StorageScriptsContent;
