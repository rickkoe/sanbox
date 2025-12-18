import React, { useState, useEffect } from "react";
import { Modal, Form, Spinner } from "react-bootstrap";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import "../../styles/volume-ranges.css";

const CreateVolumeRangeModal = ({
  show,
  onClose,
  storageId,
  storageName,
  deviceId,
  activeProjectId,
  onSuccess,
}) => {
  const { theme } = useTheme();

  // Form state
  const [formData, setFormData] = useState({
    start_volume: "",
    end_volume: "",
    format: "FB",
    capacity_gb: "",
    pool_name: "",
  });

  // UI state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dscliPreview, setDscliPreview] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (show) {
      setFormData({
        start_volume: "",
        end_volume: "",
        format: "FB",
        capacity_gb: "",
        pool_name: "",
      });
      setError(null);
      setPreview(null);
      setDscliPreview("");
    }
  }, [show]);

  // Validate hex input (4 hex digits)
  const isValidHex = (value) => /^[0-9A-Fa-f]{4}$/.test(value);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // For hex fields, only allow valid hex characters
    if (name === "start_volume" || name === "end_volume") {
      const cleanValue = value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 4);
      setFormData((prev) => ({ ...prev, [name]: cleanValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear preview when form changes
    setPreview(null);
    setDscliPreview("");
  };

  // Calculate preview
  const calculatePreview = () => {
    setError(null);

    const { start_volume, end_volume, format, capacity_gb } = formData;

    // Validate inputs
    if (!isValidHex(start_volume)) {
      setError("Start volume must be 4 hex digits (0000-FFFF)");
      return;
    }
    if (!isValidHex(end_volume)) {
      setError("End volume must be 4 hex digits (0000-FFFF)");
      return;
    }

    const startInt = parseInt(start_volume, 16);
    const endInt = parseInt(end_volume, 16);

    if (endInt < startInt) {
      setError("End volume must be >= start volume");
      return;
    }

    const startLss = start_volume.slice(0, 2);
    const endLss = end_volume.slice(0, 2);

    if (startLss !== endLss) {
      setError(`Start (${start_volume}) and end (${end_volume}) must be in the same LSS (first 2 digits must match)`);
      return;
    }

    const count = endInt - startInt + 1;

    if (count > 256) {
      setError(`Range too large (${count} volumes). Maximum 256 volumes per range.`);
      return;
    }

    if (!capacity_gb || parseFloat(capacity_gb) <= 0) {
      setError("Please enter a valid capacity in GB");
      return;
    }

    const capacityBytes = parseFloat(capacity_gb) * 1024 * 1024 * 1024;
    const totalCapacityTB = (capacityBytes * count) / (1024 ** 4);

    setPreview({
      lss: startLss,
      count,
      totalCapacityTB: totalCapacityTB.toFixed(2),
      format,
    });

    // Generate DSCLI preview
    fetchDscliPreview(start_volume, end_volume, format, capacityBytes);
  };

  // Fetch DSCLI command preview
  const fetchDscliPreview = async (start, end, fmt, capacityBytes) => {
    try {
      const response = await axios.post(`/api/storage/${storageId}/volume-ranges/dscli/`, {
        start_volume: start,
        end_volume: end,
        format: fmt,
        capacity_bytes: capacityBytes,
        pool_name: formData.pool_name || "P0",
        command_type: "create",
      });
      setDscliPreview(response.data.commands?.[0] || "");
    } catch (err) {
      console.error("Failed to generate DSCLI preview:", err);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!preview) {
      calculatePreview();
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const capacityBytes = parseFloat(formData.capacity_gb) * 1024 * 1024 * 1024;

      await axios.post(`/api/storage/${storageId}/volume-ranges/create/`, {
        start_volume: formData.start_volume,
        end_volume: formData.end_volume,
        format: formData.format,
        capacity_bytes: capacityBytes,
        pool_name: formData.pool_name || null,
        active_project_id: activeProjectId,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to create volume range:", err);
      setError(err.response?.data?.error || "Failed to create volume range");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered className={`theme-${theme}`} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create Volume Range</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="storage-info mb-3">
          <strong>Storage:</strong> {storageName}
          <br />
          <strong>Device ID:</strong> {deviceId}
        </div>

        {error && (
          <div className="volume-range-error-alert">
            {error}
          </div>
        )}

        <Form>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Start Volume (hex)</Form.Label>
                <Form.Control
                  type="text"
                  name="start_volume"
                  value={formData.start_volume}
                  onChange={handleChange}
                  placeholder="e.g., 1000"
                  maxLength={4}
                  className="font-monospace"
                  style={{ textTransform: "uppercase" }}
                />
                <Form.Text className="volume-range-form-hint">
                  4-digit hex (0000-FFFF)
                </Form.Text>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>End Volume (hex)</Form.Label>
                <Form.Control
                  type="text"
                  name="end_volume"
                  value={formData.end_volume}
                  onChange={handleChange}
                  placeholder="e.g., 100F"
                  maxLength={4}
                  className="font-monospace"
                  style={{ textTransform: "uppercase" }}
                />
                <Form.Text className="volume-range-form-hint">
                  Must be in same LSS (first 2 digits)
                </Form.Text>
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>Format</Form.Label>
                <Form.Select name="format" value={formData.format} onChange={handleChange}>
                  <option value="FB">FB (Fixed Block)</option>
                  <option value="CKD">CKD (Count Key Data)</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>Capacity (GB)</Form.Label>
                <Form.Control
                  type="number"
                  name="capacity_gb"
                  value={formData.capacity_gb}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                  min="1"
                />
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>Pool Name</Form.Label>
                <Form.Control
                  type="text"
                  name="pool_name"
                  value={formData.pool_name}
                  onChange={handleChange}
                  placeholder="e.g., P0"
                />
              </Form.Group>
            </div>
          </div>

          {preview && (
            <div className="volume-range-info-alert mt-3">
              <strong>Preview:</strong>
              <br />
              Will create <strong>{preview.count}</strong> {preview.format} volumes in LSS{" "}
              <strong>{preview.lss}</strong>
              <br />
              Total capacity: <strong>{preview.totalCapacityTB} TB</strong>
              {dscliPreview && (
                <>
                  <hr style={{ borderColor: 'var(--color-border-default)', opacity: 0.5 }} />
                  <strong>DSCLI Command:</strong>
                  <pre className="volume-range-code-preview mb-0 mt-1">
                    {dscliPreview}
                  </pre>
                </>
              )}
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose} disabled={creating}>
          Cancel
        </button>
        {!preview ? (
          <button className="btn btn-primary" onClick={calculatePreview}>
            Preview
          </button>
        ) : (
          <button className="btn btn-success" onClick={handleSubmit} disabled={creating}>
            {creating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Creating...
              </>
            ) : (
              `Create ${preview.count} Volumes`
            )}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default CreateVolumeRangeModal;
