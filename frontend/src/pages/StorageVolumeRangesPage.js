import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Spinner, Modal, Form } from "react-bootstrap";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";
import { useProjectFilter } from "../context/ProjectFilterContext";
import { useTheme } from "../context/ThemeContext";
import { ArrowLeft, Plus, Terminal, Trash2, Copy, Download, Check, Info } from "lucide-react";
import CreateVolumeRangeModal from "../components/modals/CreateVolumeRangeModal";
import "../styles/scriptspages.css";
import "../styles/volume-ranges.css";

const StorageVolumeRangesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);
  const { config } = useContext(ConfigContext);
  const { projectFilter } = useProjectFilter();

  // Get active project from config
  const activeProject = config?.active_project;
  const activeProjectId = activeProject?.id;

  // Check if in Draft mode (projectFilter === 'current' means Draft/Project View)
  const isInDraftMode = projectFilter === 'current' && activeProjectId;
  const canCreate = isInDraftMode;

  // Data state
  const [storage, setStorage] = useState(null);
  const [ranges, setRanges] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedRanges, setSelectedRanges] = useState({});

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDscliModal, setShowDscliModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // DSCLI state
  const [dscliCommands, setDscliCommands] = useState([]);
  const [dscliLoading, setDscliLoading] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy to Clipboard");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch storage and ranges
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch storage details
      const storageRes = await axios.get(`/api/storage/${id}/`);
      setStorage(storageRes.data);
      setBreadcrumbMap((prev) => ({ ...prev, [id]: storageRes.data.name }));

      // Verify it's DS8000
      if (storageRes.data.storage_type !== "DS8000") {
        setError(
          `Volume ranges are only available for DS8000 storage systems. This storage is type: ${storageRes.data.storage_type}`
        );
        setLoading(false);
        return;
      }

      // Fetch volume ranges with project context
      const params = new URLSearchParams();
      if (activeProjectId) {
        params.append('active_project_id', activeProjectId);
      }
      params.append('project_filter', projectFilter || 'all');

      const rangesRes = await axios.get(`/api/storage/${id}/volume-ranges/?${params.toString()}`);
      setRanges(rangesRes.data.ranges || []);
      setDeviceId(rangesRes.data.device_id || "");

      // Initialize selection state
      const initialSelection = {};
      (rangesRes.data.ranges || []).forEach((r) => {
        initialSelection[r.range_id] = false;
      });
      setSelectedRanges(initialSelection);
    } catch (err) {
      console.error("Failed to load volume ranges:", err);
      setError(err.response?.data?.error || "Failed to load volume ranges");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, projectFilter, activeProjectId]);

  // Toggle range selection
  const handleToggleRange = (rangeId) => {
    setSelectedRanges((prev) => ({
      ...prev,
      [rangeId]: !prev[rangeId],
    }));
  };

  // Select/deselect all
  const handleSelectAll = (checked) => {
    const newSelection = {};
    ranges.forEach((r) => {
      newSelection[r.range_id] = checked;
    });
    setSelectedRanges(newSelection);
  };

  // Get selected count
  const selectedCount = Object.values(selectedRanges).filter(Boolean).length;

  // Generate DSCLI commands
  const handleGenerateDscli = async () => {
    const selectedIds = Object.entries(selectedRanges)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);

    if (selectedIds.length === 0) {
      alert("Please select at least one range to generate DSCLI commands.");
      return;
    }

    try {
      setDscliLoading(true);
      const response = await axios.post(`/api/storage/${id}/volume-ranges/dscli/`, {
        range_ids: selectedIds,
        command_type: "create",
        active_project_id: activeProjectId,
        project_filter: projectFilter || 'all',
      });
      setDscliCommands(response.data.commands || []);
      setShowDscliModal(true);
    } catch (err) {
      console.error("Failed to generate DSCLI commands:", err);
      alert(err.response?.data?.error || "Failed to generate DSCLI commands");
    } finally {
      setDscliLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = () => {
    const header = `# DS8000 Volume Creation Commands\n# Device: ${deviceId}\n# Storage: ${storage?.name}\n`;
    const commandsText = dscliCommands.join("\n");
    const textToCopy = `${header}\n${commandsText}`;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopyButtonText("Copied!");
        setTimeout(() => setCopyButtonText("Copy to Clipboard"), 3000);
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        alert("Failed to copy to clipboard.");
      });
  };

  // Download as file
  const handleDownload = () => {
    const header = `# DS8000 Volume Creation Commands\n# Device: ${deviceId}\n# Storage: ${storage?.name}\n# Generated: ${new Date().toISOString()}\n`;
    const commandsText = dscliCommands.join("\n");
    const content = `${header}\n${commandsText}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${storage?.name || "ds8000"}_volume_commands.sh`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Open delete confirmation
  const handleDeleteClick = (range) => {
    setDeleteTarget(range);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await axios.post(`/api/storage/${id}/volume-ranges/delete/`, {
        volume_ids: deleteTarget.volume_ids,
      });
      setShowDeleteModal(false);
      setDeleteTarget(null);
      // Refresh data
      fetchData();
    } catch (err) {
      console.error("Failed to delete volumes:", err);
      alert(err.response?.data?.error || "Failed to delete volumes");
    } finally {
      setDeleting(false);
    }
  };

  // Handle successful range creation
  const handleRangeCreated = () => {
    fetchData();
  };

  // Format capacity for display
  const formatCapacity = (bytes) => {
    if (!bytes) return "Unknown";
    const tb = bytes / (1024 ** 4);
    const gb = bytes / (1024 ** 3);
    if (tb >= 1) return `${tb.toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`scripts-page-container theme-${theme}`}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
          <Spinner animation="border" variant="primary" />
          <span className="ms-2">Loading volume ranges...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`scripts-page-container theme-${theme}`}>
        <div className="scripts-page-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate(`/storage/${id}`)}>
              <ArrowLeft size={20} />
            </button>
            <div className="header-titles">
              <h1 className="page-title">Volume Ranges</h1>
            </div>
          </div>
        </div>
        <div className="volume-range-warning-alert mx-4 mt-4">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`scripts-page-container theme-${theme}`}>
      {/* Header */}
      <div className="scripts-page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(`/storage/${id}`)}>
            <ArrowLeft size={20} />
          </button>
          <div className="header-titles">
            <h1 className="page-title">Volume Ranges</h1>
            <span className="page-subtitle">{storage?.name}</span>
          </div>
        </div>
        <div className="header-right">
          <span className="device-id-badge">
            <Terminal size={14} />
            {deviceId}
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="volume-ranges-action-bar">
        <div className="action-bar-left">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!canCreate}
            title={!canCreate ? "Switch to Draft mode with an active project to create volume ranges" : "Create a new volume range"}
          >
            <Plus size={16} />
            Create Range
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleGenerateDscli}
            disabled={selectedCount === 0 || dscliLoading}
          >
            <Terminal size={16} />
            {dscliLoading ? "Generating..." : `Generate DSCLI (${selectedCount})`}
          </button>
        </div>
        <div className="action-bar-right">
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={ranges.length > 0 && selectedCount === ranges.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            Select All
          </label>
          <span className="range-count">{ranges.length} ranges, {ranges.reduce((sum, r) => sum + r.volume_count, 0)} volumes</span>
        </div>
      </div>

      {/* Read-only mode banner */}
      {!canCreate && (
        <div className="volume-range-info-alert mx-4 mt-3" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Info size={20} style={{ flexShrink: 0 }} />
          <span>
            {!activeProjectId ? (
              <><strong>No active project selected.</strong> Select a project and switch to Draft mode to create new volume ranges.</>
            ) : (
              <><strong>Committed mode is read-only.</strong> Switch to Draft mode to create new volume ranges.</>
            )}
            {" "}Existing ranges are shown below for reference.
          </span>
        </div>
      )}

      {/* Ranges List */}
      <div className="volume-ranges-content">
        {ranges.length === 0 ? (
          <div className="no-ranges-message">
            <p>No volume ranges found for this storage system.</p>
            <p>Create volumes to see them grouped into ranges, or click "Create Range" to add new volumes.</p>
          </div>
        ) : (
          <div className="ranges-list">
            {ranges.map((range) => (
              <div
                key={range.range_id}
                className={`range-card ${selectedRanges[range.range_id] ? "selected" : ""}`}
              >
                <div className="range-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedRanges[range.range_id] || false}
                    onChange={() => handleToggleRange(range.range_id)}
                  />
                </div>
                <div className="range-card-main">
                  <div className="range-card-header">
                    <span className="range-volume-display">
                      {range.start_volume === range.end_volume
                        ? range.start_volume
                        : `${range.start_volume} - ${range.end_volume}`}
                    </span>
                    <span className={`format-badge format-badge-${range.format?.toLowerCase()}`}>
                      {range.format}
                    </span>
                  </div>
                  <div className="range-card-details">
                    <span className="detail-item">
                      <strong>LSS:</strong> {range.lss}
                    </span>
                    <span className="detail-item">
                      <strong>Count:</strong> {range.volume_count}
                    </span>
                    <span className="detail-item">
                      <strong>Size:</strong> {range.capacity_display || formatCapacity(range.capacity_bytes)}
                    </span>
                    {range.pool_name && (
                      <span className="detail-item">
                        <strong>Pool:</strong> {range.pool_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="range-card-actions">
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDeleteClick(range)}
                    title="Delete this range"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Range Modal */}
      <CreateVolumeRangeModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        storageId={parseInt(id)}
        storageName={storage?.name}
        deviceId={deviceId}
        activeProjectId={activeProjectId}
        onSuccess={handleRangeCreated}
      />

      {/* DSCLI Preview Modal */}
      <Modal
        show={showDscliModal}
        onHide={() => setShowDscliModal(false)}
        size="lg"
        centered
        className={`theme-${theme}`}
      >
        <Modal.Header closeButton>
          <Modal.Title>DSCLI Commands</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="dscli-info mb-3">
            <strong>Device:</strong> {deviceId}
            <br />
            <strong>Commands:</strong> {dscliCommands.length}
          </div>
          <div className="dscli-commands-container">
            <pre className="dscli-commands">
              {dscliCommands.map((cmd, idx) => (
                <code key={idx}>{cmd}</code>
              ))}
            </pre>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={handleDownload}>
            <Download size={16} />
            Download .sh
          </button>
          <button className="btn btn-primary" onClick={handleCopyToClipboard}>
            {copyButtonText === "Copied!" ? <Check size={16} /> : <Copy size={16} />}
            {copyButtonText}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
        className={`theme-${theme}`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteTarget && (
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.volume_count} volumes</strong> in range{" "}
              <strong>
                {deleteTarget.start_volume}-{deleteTarget.end_volume}
              </strong>
              ?
            </p>
          )}
          <div className="volume-range-warning-alert">
            This action cannot be undone. All volume records will be permanently deleted.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-secondary"
            onClick={() => setShowDeleteModal(false)}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Volumes"}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StorageVolumeRangesPage;
