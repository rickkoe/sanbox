import React, { useState, useEffect, useMemo } from "react";
import { Modal, Form, Spinner } from "react-bootstrap";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import "../../styles/volume-ranges.css";

const CreateVolumeRangeModal = ({
  show,
  onClose,
  storageId,
  storageName,
  storageType,
  deviceId,
  activeProjectId,
  onSuccess,
}) => {
  const { theme } = useTheme();

  // Form state
  const [formData, setFormData] = useState({
    lss: "",
    start_vol: "",
    end_vol: "",
    format: "FB",
    capacity_gb: "",
    pool_name: "",
  });

  // Pool selection state
  const [pools, setPools] = useState([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolType, setNewPoolType] = useState("FB");
  const [creatingPool, setCreatingPool] = useState(false);

  // UI state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dscliPreview, setDscliPreview] = useState("");

  // Existing volumes state for conflict detection
  // Stores objects with { volume_id, pool_name } for pool locking
  const [existingVolumes, setExistingVolumes] = useState([]);
  const [loadingVolumes, setLoadingVolumes] = useState(false);

  // Fetch pools and existing volumes when modal opens
  useEffect(() => {
    if (show && storageId) {
      fetchPools();
      fetchExistingVolumes();
    }
  }, [show, storageId, activeProjectId]);

  // Reset form when modal opens
  useEffect(() => {
    if (show) {
      setFormData({
        lss: "",
        start_vol: "",
        end_vol: "",
        format: "FB",
        capacity_gb: "",
        pool_name: "",
      });
      setError(null);
      setPreview(null);
      setDscliPreview("");
      setShowCreatePool(false);
      setNewPoolName("");
      setNewPoolType("FB");
    }
  }, [show]);

  // Fetch pools for this storage system
  // If there's an active project, use project view to include uncommitted project pools
  const fetchPools = async () => {
    setLoadingPools(true);
    try {
      let url;
      if (activeProjectId) {
        // Use project view with project_filter=all to get both committed and project pools
        url = `/api/storage/project/${activeProjectId}/view/pools/?project_filter=all&storage_id=${storageId}`;
      } else {
        // No active project - just get committed pools for this storage
        url = `/api/storage/${storageId}/pools/`;
      }
      const response = await axios.get(url);
      const poolList = response.data.results || response.data || [];
      // Backend already filters by storage_id, but include fallback filter just in case
      const filteredPools = poolList.filter(pool => {
        const poolStorageId = pool.storage_id || pool.storage;
        return poolStorageId === storageId || poolStorageId === parseInt(storageId);
      });
      setPools(filteredPools);
    } catch (err) {
      console.error("Failed to load pools:", err);
      setPools([]);
    } finally {
      setLoadingPools(false);
    }
  };

  // Validate hex input (2 hex digits)
  const isValidHex2 = (value) => /^[0-9A-Fa-f]{2}$/.test(value);

  // Fetch existing volumes for conflict detection (with pagination)
  const fetchExistingVolumes = async () => {
    setLoadingVolumes(true);
    try {
      const allVolumes = [];
      let page = 1;
      let hasMore = true;

      // Paginate through all volumes (max 500 per page)
      while (hasMore) {
        let url;
        if (activeProjectId) {
          url = `/api/storage/project/${activeProjectId}/view/volumes/?project_filter=all&page_size=500&page=${page}`;
        } else {
          url = `/api/storage/volumes/?storage_id=${storageId}&page_size=500&page=${page}`;
        }

        const response = await axios.get(url);
        const volumeList = response.data.results || response.data || [];
        allVolumes.push(...volumeList);

        // Check if there are more pages
        hasMore = response.data.has_next || response.data.next;
        page++;

        // Safety limit to prevent infinite loops
        if (page > 100) break;
      }

      // Filter to only volumes for this storage system
      const storageVolumes = allVolumes.filter(v => {
        const volStorageId = v.storage_id || v.storage;
        return volStorageId === storageId || volStorageId === parseInt(storageId);
      });

      // Extract volume IDs, pool names, formats, and capacity (for LSS locking and display)
      const volumeData = storageVolumes
        .filter(v => v.volume_id)
        .map(v => ({
          volume_id: v.volume_id.toUpperCase(),
          pool_name: v.pool_name || null,
          format: v.format || null,
          capacity_bytes: v.capacity_bytes || 0,
        }));
      console.log(`Loaded ${volumeData.length} existing volumes for storage ${storageId}:`, volumeData.slice(0, 10));
      setExistingVolumes(volumeData);
    } catch (err) {
      console.error("Failed to load existing volumes:", err);
      setExistingVolumes([]);
    } finally {
      setLoadingVolumes(false);
    }
  };

  // Get the pool and format used by existing volumes in the current LSS (for locking)
  const lssPoolInfo = useMemo(() => {
    const { lss } = formData;
    if (!isValidHex2(lss)) return null;

    const lssUpper = lss.toUpperCase();
    // Find volumes in this LSS
    const lssVolumes = existingVolumes.filter(
      v => v.volume_id && v.volume_id.length === 4 && v.volume_id.slice(0, 2) === lssUpper
    );

    if (lssVolumes.length === 0) return null;

    // Get the pool and format from the first volume (all should be the same)
    const poolName = lssVolumes[0].pool_name;
    const format = lssVolumes[0].format;
    return { poolName, format, volumeCount: lssVolumes.length };
  }, [formData.lss, existingVolumes]);

  // Get occupied ranges for the current LSS (memoized for real-time updates)
  const occupiedRanges = useMemo(() => {
    const { lss } = formData;
    if (!isValidHex2(lss)) return [];

    const lssUpper = lss.toUpperCase();
    // Filter volumes that belong to this LSS (first 2 characters match)
    const lssVolumes = existingVolumes
      .filter(v => v.volume_id && v.volume_id.length === 4 && v.volume_id.slice(0, 2) === lssUpper)
      .map(v => ({
        volNum: parseInt(v.volume_id.slice(2), 16),
        format: v.format,
        capacity_bytes: v.capacity_bytes || 0,
      }))
      .sort((a, b) => a.volNum - b.volNum);

    if (lssVolumes.length === 0) return [];

    // Group into contiguous ranges with format and per-volume capacity
    const ranges = [];
    let rangeStart = lssVolumes[0].volNum;
    let rangeEnd = lssVolumes[0].volNum;
    let rangeFormat = lssVolumes[0].format;
    let volumeCapacity = lssVolumes[0].capacity_bytes; // Per-volume capacity, not aggregate

    for (let i = 1; i < lssVolumes.length; i++) {
      if (lssVolumes[i].volNum === rangeEnd + 1) {
        rangeEnd = lssVolumes[i].volNum;
        // Don't sum - all volumes in a range should have same capacity
      } else {
        ranges.push({ start: rangeStart, end: rangeEnd, format: rangeFormat, capacity_bytes: volumeCapacity });
        rangeStart = lssVolumes[i].volNum;
        rangeEnd = lssVolumes[i].volNum;
        rangeFormat = lssVolumes[i].format;
        volumeCapacity = lssVolumes[i].capacity_bytes;
      }
    }
    ranges.push({ start: rangeStart, end: rangeEnd, format: rangeFormat, capacity_bytes: volumeCapacity });

    return ranges;
  }, [formData.lss, existingVolumes]);

  // Check for conflicts with existing volumes (memoized for real-time updates)
  const conflictingVolumes = useMemo(() => {
    const { lss, start_vol, end_vol } = formData;
    if (!isValidHex2(lss) || !isValidHex2(start_vol)) return null;

    const effectiveEnd = end_vol === "" ? start_vol : end_vol;
    if (!isValidHex2(effectiveEnd)) return null;

    const startInt = parseInt(start_vol, 16);
    const endInt = parseInt(effectiveEnd, 16);
    if (endInt < startInt) return null;

    const lssUpper = lss.toUpperCase();
    // Build set of existing volume IDs for fast lookup
    const existingIds = new Set(existingVolumes.map(v => v.volume_id));

    // Check each volume in the proposed range
    const conflicts = [];
    for (let i = startInt; i <= endInt; i++) {
      const volId = lssUpper + i.toString(16).toUpperCase().padStart(2, '0');
      if (existingIds.has(volId)) {
        conflicts.push(volId);
      }
    }

    return conflicts.length > 0 ? conflicts : null;
  }, [formData.lss, formData.start_vol, formData.end_vol, existingVolumes]);

  // Auto-set pool and format when LSS has existing volumes (LSS cannot span multiple pools/formats)
  useEffect(() => {
    if (lssPoolInfo) {
      setFormData((prev) => {
        const updates = {};
        // Set pool if different
        if (lssPoolInfo.poolName && prev.pool_name !== lssPoolInfo.poolName) {
          updates.pool_name = lssPoolInfo.poolName;
        }
        // Set format if different
        if (lssPoolInfo.format && prev.format !== lssPoolInfo.format) {
          updates.format = lssPoolInfo.format;
        }
        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
      // Close create pool form if open
      if (showCreatePool) {
        setShowCreatePool(false);
        setNewPoolName("");
      }
    }
  }, [lssPoolInfo]);

  // Calculate volume count in real-time
  const getVolumeCount = () => {
    const { start_vol, end_vol } = formData;
    if (!isValidHex2(start_vol)) return null;

    // If end_vol is empty, treat as single volume
    const effectiveEnd = end_vol === "" ? start_vol : end_vol;
    if (!isValidHex2(effectiveEnd)) return null;

    const startInt = parseInt(start_vol, 16);
    const endInt = parseInt(effectiveEnd, 16);

    if (endInt < startInt) return { error: true, message: "End must be >= Start" };

    return { count: endInt - startInt + 1 };
  };

  const volumeInfo = getVolumeCount();

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // For hex fields, only allow valid hex characters (2 digits max)
    if (name === "lss" || name === "start_vol" || name === "end_vol") {
      const cleanValue = value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 2);
      setFormData((prev) => ({ ...prev, [name]: cleanValue }));
    } else if (name === "format") {
      // When format changes, check if selected pool still matches
      setFormData((prev) => {
        const selectedPool = pools.find(p => p.name === prev.pool_name);
        const poolStillValid = selectedPool && selectedPool.storage_type === value;
        return {
          ...prev,
          format: value,
          // Clear pool selection if it doesn't match new format
          pool_name: poolStillValid ? prev.pool_name : "",
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear preview when form changes
    setPreview(null);
    setDscliPreview("");
  };

  // Handle pool selection
  const handlePoolSelect = (e) => {
    const value = e.target.value;
    if (value === "__CREATE_NEW__") {
      setShowCreatePool(true);
      // Default new pool type to match selected format
      setNewPoolType(formData.format);
      setFormData((prev) => ({ ...prev, pool_name: "" }));
    } else {
      setShowCreatePool(false);
      setFormData((prev) => ({ ...prev, pool_name: value }));
    }
    // Clear preview when pool changes
    setPreview(null);
    setDscliPreview("");
  };

  // Create new pool
  const handleCreatePool = async () => {
    if (!newPoolName.trim()) {
      setError("Pool name is required");
      return;
    }

    if (newPoolName.length > 16) {
      setError("Pool name must be 16 characters or less");
      return;
    }

    setCreatingPool(true);
    setError(null);

    try {
      const response = await axios.post(`/api/storage/${storageId}/pools/`, {
        name: newPoolName,
        storage: storageId,
        storage_type: storageType === 'FlashSystem' ? 'FB' : newPoolType,
        active_project_id: activeProjectId,
      });

      // Add new pool to list and select it
      const newPool = response.data;
      setPools((prev) => [...prev, newPool]);
      setFormData((prev) => ({ ...prev, pool_name: newPool.name }));
      setShowCreatePool(false);
      setNewPoolName("");
      setNewPoolType("FB");
    } catch (err) {
      console.error("Failed to create pool:", err);
      setError(err.response?.data?.error || "Failed to create pool");
    } finally {
      setCreatingPool(false);
    }
  };

  // Calculate preview
  const calculatePreview = () => {
    setError(null);

    const { lss, start_vol, end_vol, format, capacity_gb, pool_name } = formData;

    // Check if pool is being created but not yet saved
    if (showCreatePool) {
      setError("Please create the pool first or select an existing pool");
      return;
    }

    // Validate inputs
    if (!isValidHex2(lss)) {
      setError("LSS must be 2 hex digits (00-FF)");
      return;
    }
    if (!isValidHex2(start_vol)) {
      setError("Start volume must be 2 hex digits (00-FF)");
      return;
    }

    // End volume can be empty (defaults to start) or must be valid hex
    const effectiveEndVol = end_vol === "" ? start_vol : end_vol;
    if (!isValidHex2(effectiveEndVol)) {
      setError("End volume must be 2 hex digits (00-FF)");
      return;
    }

    const startInt = parseInt(start_vol, 16);
    const endInt = parseInt(effectiveEndVol, 16);

    if (endInt < startInt) {
      setError("End volume must be >= start volume");
      return;
    }

    const count = endInt - startInt + 1;

    if (count > 256) {
      setError(`Range too large (${count} volumes). Maximum 256 volumes per range.`);
      return;
    }

    // Check for conflicts with existing volumes
    if (conflictingVolumes && conflictingVolumes.length > 0) {
      setError(`Cannot create: ${conflictingVolumes.length} volume(s) already exist in this range`);
      return;
    }

    if (!capacity_gb || parseFloat(capacity_gb) <= 0) {
      setError("Please enter a valid capacity in GiB");
      return;
    }

    const capacityBytes = parseFloat(capacity_gb) * 1024 * 1024 * 1024;
    const totalCapacityTB = (capacityBytes * count) / (1024 ** 4);

    // Construct full 4-digit volume IDs
    const startVolume = lss + start_vol;
    const endVolume = lss + effectiveEndVol;

    setPreview({
      lss,
      startVolume,
      endVolume,
      count,
      totalCapacityTB: totalCapacityTB.toFixed(2),
      format,
      poolName: pool_name || "P0",
    });

    // Generate DSCLI preview
    fetchDscliPreview(startVolume, endVolume, format, capacityBytes);
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

      // Construct full 4-digit volume IDs
      const effectiveEndVol = formData.end_vol === "" ? formData.start_vol : formData.end_vol;
      const startVolume = formData.lss + formData.start_vol;
      const endVolume = formData.lss + effectiveEndVol;

      await axios.post(`/api/storage/${storageId}/volume-ranges/create/`, {
        start_volume: startVolume,
        end_volume: endVolume,
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
            <div className="col-md-3">
              <Form.Group className="mb-3">
                <Form.Label>LSS/LCU</Form.Label>
                <Form.Control
                  type="text"
                  name="lss"
                  value={formData.lss}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                  maxLength={2}
                  className="font-monospace"
                  style={{ textTransform: "uppercase" }}
                />
                <Form.Text className="volume-range-form-hint">
                  2-digit hex (00-FF)
                </Form.Text>
              </Form.Group>
            </div>
            <div className="col-md-3">
              <Form.Group className="mb-3">
                <Form.Label>Start Volume</Form.Label>
                <Form.Control
                  type="text"
                  name="start_vol"
                  value={formData.start_vol}
                  onChange={handleChange}
                  placeholder="e.g., 00"
                  maxLength={2}
                  className="font-monospace"
                  style={{ textTransform: "uppercase" }}
                />
                <Form.Text className="volume-range-form-hint">
                  2-digit hex (00-FF)
                </Form.Text>
              </Form.Group>
            </div>
            <div className="col-md-3">
              <Form.Group className="mb-3">
                <Form.Label>End Volume</Form.Label>
                <Form.Control
                  type="text"
                  name="end_vol"
                  value={formData.end_vol}
                  onChange={handleChange}
                  placeholder="e.g., 0F"
                  maxLength={2}
                  className="font-monospace"
                  style={{ textTransform: "uppercase" }}
                />
                <Form.Text className="volume-range-form-hint">
                  Optional (empty = 1 volume)
                </Form.Text>
              </Form.Group>
            </div>
            <div className="col-md-3 d-flex align-items-center">
              <div className="volume-count-display">
                {volumeInfo?.error ? (
                  <span className="text-danger">{volumeInfo.message}</span>
                ) : volumeInfo?.count ? (
                  <span>
                    <strong>{volumeInfo.count}</strong> volume{volumeInfo.count !== 1 ? "s" : ""}
                    {formData.lss && formData.start_vol && (
                      <div className="volume-range-form-hint mt-1">
                        {formData.lss}{formData.start_vol}
                        {volumeInfo.count > 1 && ` - ${formData.lss}${formData.end_vol || formData.start_vol}`}
                      </div>
                    )}
                  </span>
                ) : (
                  <span className="volume-range-form-hint">Enter start volume</span>
                )}
              </div>
            </div>
          </div>

          {/* Loading indicator for conflict detection */}
          {loadingVolumes && isValidHex2(formData.lss) && (
            <div className="volume-range-lss-hint">
              <Spinner animation="border" size="sm" className="me-2" />
              Loading existing volumes for conflict detection...
            </div>
          )}

          {/* Conflict Warning */}
          {!loadingVolumes && conflictingVolumes && (
            <div className="volume-range-error-alert">
              <strong>Conflict detected!</strong> {conflictingVolumes.length} volume{conflictingVolumes.length !== 1 ? "s" : ""} already exist{conflictingVolumes.length === 1 ? "s" : ""}:{" "}
              <span className="font-monospace">
                {conflictingVolumes.length <= 5
                  ? conflictingVolumes.join(", ")
                  : `${conflictingVolumes.slice(0, 5).join(", ")}... and ${conflictingVolumes.length - 5} more`}
              </span>
            </div>
          )}

          {/* Occupied ranges hint - show when LSS is entered and has existing volumes */}
          {!loadingVolumes && isValidHex2(formData.lss) && occupiedRanges.length > 0 && !conflictingVolumes && (
            <div className="volume-range-lss-hint">
              <strong>LSS {formData.lss.toUpperCase()} occupied ranges:</strong>{" "}
              <span className="font-monospace">
                {occupiedRanges.map((r, i) => {
                  const startHex = r.start.toString(16).toUpperCase().padStart(2, '0');
                  const endHex = r.end.toString(16).toUpperCase().padStart(2, '0');
                  // Format capacity with appropriate binary unit
                  const formatCapacity = (bytes) => {
                    if (!bytes || bytes === 0) return '0 GiB';
                    const gib = bytes / (1024 ** 3);
                    if (gib >= 1024) {
                      return `${(gib / 1024).toFixed(1)} TiB`;
                    }
                    return `${gib.toFixed(0)} GiB`;
                  };
                  return (
                    <span key={i}>
                      {i > 0 && ", "}
                      {r.start === r.end
                        ? `${formData.lss.toUpperCase()}${startHex}`
                        : `${formData.lss.toUpperCase()}${startHex}-${endHex}`}
                      {" "}({formatCapacity(r.capacity_bytes)})
                    </span>
                  );
                })}
              </span>
            </div>
          )}

          <div className="row">
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>Format {lssPoolInfo?.format && "(locked)"}</Form.Label>
                {lssPoolInfo?.format ? (
                  // Format is locked to match existing volumes in this LSS
                  <>
                    <Form.Control
                      type="text"
                      value={lssPoolInfo.format === 'FB' ? 'FB (Fixed Block)' : 'CKD (Count Key Data)'}
                      disabled
                      readOnly
                    />
                    <Form.Text className="volume-range-form-hint">
                      LSS {formData.lss.toUpperCase()} already uses this format
                    </Form.Text>
                  </>
                ) : (
                  <Form.Select name="format" value={formData.format} onChange={handleChange}>
                    <option value="FB">FB (Fixed Block)</option>
                    <option value="CKD">CKD (Count Key Data)</option>
                  </Form.Select>
                )}
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>Capacity (GiB)</Form.Label>
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
                <Form.Label>Pool {lssPoolInfo?.poolName && "(locked)"}</Form.Label>
                {loadingPools ? (
                  <div className="d-flex align-items-center" style={{ height: '38px' }}>
                    <Spinner animation="border" size="sm" className="me-2" />
                    <span>Loading pools...</span>
                  </div>
                ) : lssPoolInfo?.poolName ? (
                  // Pool is locked to match existing volumes in this LSS
                  <>
                    <Form.Control
                      type="text"
                      value={lssPoolInfo.poolName}
                      disabled
                      readOnly
                      className="font-monospace"
                    />
                    <Form.Text className="volume-range-form-hint">
                      LSS {formData.lss.toUpperCase()} already uses this pool
                    </Form.Text>
                  </>
                ) : (
                  <Form.Select
                    value={showCreatePool ? "__CREATE_NEW__" : formData.pool_name}
                    onChange={handlePoolSelect}
                  >
                    <option value="">-- Select Pool --</option>
                    {pools
                      .filter((pool) => pool.storage_type === formData.format)
                      .map((pool) => (
                        <option key={pool.id} value={pool.name}>
                          {pool.name} ({pool.storage_type})
                        </option>
                      ))}
                    <option value="__CREATE_NEW__">+ Create New Pool</option>
                  </Form.Select>
                )}
              </Form.Group>
            </div>
          </div>

          {/* Inline Pool Creation Form - hidden when pool is locked */}
          {showCreatePool && !lssPoolInfo?.poolName && (
            <div className="volume-range-info-alert mb-3">
              <strong>Create New Pool</strong>
              <div className="row mt-2">
                <div className="col-md-6">
                  <Form.Group className="mb-2">
                    <Form.Label>Pool Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={newPoolName}
                      onChange={(e) => setNewPoolName(e.target.value)}
                      placeholder="e.g., P0"
                      maxLength={16}
                    />
                    <Form.Text className="volume-range-form-hint">
                      Max 16 characters
                    </Form.Text>
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  {storageType === 'DS8000' ? (
                    <Form.Group className="mb-2">
                      <Form.Label>Pool Type</Form.Label>
                      <Form.Select
                        value={newPoolType}
                        onChange={(e) => setNewPoolType(e.target.value)}
                      >
                        <option value="FB">FB (Fixed Block)</option>
                        <option value="CKD">CKD (Count Key Data)</option>
                      </Form.Select>
                    </Form.Group>
                  ) : (
                    <Form.Group className="mb-2">
                      <Form.Label>Pool Type</Form.Label>
                      <Form.Control
                        type="text"
                        value="FB (Fixed Block)"
                        disabled
                        readOnly
                      />
                      <Form.Text className="volume-range-form-hint">
                        FlashSystem pools are always FB
                      </Form.Text>
                    </Form.Group>
                  )}
                </div>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={handleCreatePool}
                  disabled={creatingPool || !newPoolName.trim()}
                >
                  {creatingPool ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Creating...
                    </>
                  ) : (
                    "Create Pool"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowCreatePool(false);
                    setNewPoolName("");
                    setNewPoolType("FB");
                  }}
                  disabled={creatingPool}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {preview && (
            <div className="volume-range-info-alert mt-3">
              <strong>Preview:</strong>
              <br />
              Will create <strong>{preview.count}</strong> {preview.format} volume{preview.count !== 1 ? "s" : ""}: {" "}
              <strong className="font-monospace">{preview.startVolume}</strong>
              {preview.count > 1 && <> - <strong className="font-monospace">{preview.endVolume}</strong></>}
              <br />
              Pool: <strong>{preview.poolName}</strong>
              <br />
              Total capacity: <strong>{preview.totalCapacityTB} TiB</strong>
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
          <button className="btn btn-primary" onClick={calculatePreview} disabled={showCreatePool || conflictingVolumes || loadingVolumes}>
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
