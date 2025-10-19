import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ConfigContext } from '../context/ConfigContext';
import { useTheme } from '../context/ThemeContext';
import ImportLogger from '../components/ImportLogger';
import './UniversalImporter.css';

const UniversalImporter = () => {
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();

  // Multi-step wizard state
  const [step, setStep] = useState(1); // 1: Select Type, 2: Upload/Paste, 3: Configure, 4: Execute

  // Import type selection
  const [importType, setImportType] = useState('san'); // san, storage, or hosts

  // Data source
  const [sourceType, setSourceType] = useState('file'); // file or paste
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pastedText, setPastedText] = useState('');

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configuration
  const [fabricName, setFabricName] = useState('');
  const [createNewFabric, setCreateNewFabric] = useState(false);
  const [selectedFabricId, setSelectedFabricId] = useState('new'); // 'new' or fabric ID
  const [existingFabrics, setExistingFabrics] = useState([]);

  // Selection state for checkboxes
  const [selectedAliases, setSelectedAliases] = useState(new Set());
  const [selectedZones, setSelectedZones] = useState(new Set());
  const [selectedFabrics, setSelectedFabrics] = useState(new Set());

  // Conflict resolution
  const [conflicts, setConflicts] = useState(null);
  const [conflictResolutions, setConflictResolutions] = useState({});

  // Import execution
  const [importRunning, setImportRunning] = useState(false);
  const [importId, setImportId] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Handle file upload
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setUploadedFiles(files);
    setError(null);
  };

  // Handle drag and drop
  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    setUploadedFiles(files);
    setError(null);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Fetch existing fabrics for dropdown
  const fetchExistingFabrics = async () => {
    try {
      const response = await axios.get(`/api/san/fabrics/?customer=${config.customer.id}`);
      setExistingFabrics(response.data || []);
    } catch (err) {
      console.error('Failed to fetch fabrics:', err);
    }
  };

  // Load fabrics when component mounts
  useEffect(() => {
    if (config && config.customer) {
      fetchExistingFabrics();
    }
  }, [config]);

  // Handle checkbox selection
  const toggleAliasSelection = (aliasKey) => {
    const newSet = new Set(selectedAliases);
    if (newSet.has(aliasKey)) {
      newSet.delete(aliasKey);
    } else {
      newSet.add(aliasKey);
    }
    setSelectedAliases(newSet);
  };

  const toggleZoneSelection = (zoneKey) => {
    const newSet = new Set(selectedZones);
    if (newSet.has(zoneKey)) {
      newSet.delete(zoneKey);
    } else {
      newSet.add(zoneKey);
    }
    setSelectedZones(newSet);
  };

  const toggleFabricSelection = (fabricKey) => {
    const newSet = new Set(selectedFabrics);
    if (newSet.has(fabricKey)) {
      newSet.delete(fabricKey);
    } else {
      newSet.add(fabricKey);
    }
    setSelectedFabrics(newSet);
  };

  // Select/deselect all functions
  const selectAllAliases = () => {
    if (previewData && previewData.aliases) {
      const allKeys = previewData.aliases.map((_, idx) => `alias_${idx}`);
      setSelectedAliases(new Set(allKeys));
    }
  };

  const deselectAllAliases = () => {
    setSelectedAliases(new Set());
  };

  const selectAllZones = () => {
    if (previewData && previewData.zones) {
      const allKeys = previewData.zones.map((_, idx) => `zone_${idx}`);
      setSelectedZones(new Set(allKeys));
    }
  };

  const deselectAllZones = () => {
    setSelectedZones(new Set());
  };

  const selectAllFabrics = () => {
    if (previewData && previewData.fabrics) {
      const allKeys = previewData.fabrics.map((_, idx) => `fabric_${idx}`);
      setSelectedFabrics(new Set(allKeys));
    }
  };

  const deselectAllFabrics = () => {
    setSelectedFabrics(new Set());
  };

  // Parse and preview
  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      let dataToPreview = '';

      if (sourceType === 'file' && uploadedFiles.length > 0) {
        // Read file content
        const file = uploadedFiles[0];
        dataToPreview = await file.text();
      } else if (sourceType === 'paste') {
        dataToPreview = pastedText;
      } else {
        setError('Please provide data to preview');
        setLoading(false);
        return;
      }

      // Call preview API (enhanced to return full data and conflicts)
      const response = await axios.post('/api/importer/parse-preview/', {
        customer_id: config.customer.id,
        data: dataToPreview,
        check_conflicts: true
      });

      setPreviewData(response.data);
      setConflicts(response.data.conflicts || null);

      // Auto-select all items by default
      if (response.data.aliases) {
        const allAliasKeys = response.data.aliases.map((_, idx) => `alias_${idx}`);
        setSelectedAliases(new Set(allAliasKeys));
      }
      if (response.data.zones) {
        const allZoneKeys = response.data.zones.map((_, idx) => `zone_${idx}`);
        setSelectedZones(new Set(allZoneKeys));
      }
      if (response.data.fabrics) {
        const allFabricKeys = response.data.fabrics.map((_, idx) => `fabric_${idx}`);
        setSelectedFabrics(new Set(allFabricKeys));
      }

      setStep(3); // Move to configuration step
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to parse data');
    } finally {
      setLoading(false);
    }
  };

  // Execute import
  const handleImport = async () => {
    setLoading(true);
    setError(null);

    try {
      let dataToImport = '';

      if (sourceType === 'file' && uploadedFiles.length > 0) {
        const file = uploadedFiles[0];
        dataToImport = await file.text();
      } else if (sourceType === 'paste') {
        dataToImport = pastedText;
      }

      // Prepare selected items data
      const selectedItems = {
        aliases: Array.from(selectedAliases),
        zones: Array.from(selectedZones),
        fabrics: Array.from(selectedFabrics)
      };

      // Start import
      const response = await axios.post('/api/importer/import-san-config/', {
        customer_id: config.customer.id,
        data: dataToImport,
        fabric_id: selectedFabricId === 'new' ? null : selectedFabricId,
        fabric_name: selectedFabricId === 'new' ? fabricName : null,
        create_new_fabric: selectedFabricId === 'new',
        selected_items: selectedItems,
        conflict_resolutions: conflictResolutions,
        project_id: config.active_project?.id  // Add project assignment
      });

      setImportId(response.data.import_id);
      setImportRunning(true);
      setStep(4); // Move to execution step

      // Start polling for progress
      startProgressPolling(response.data.import_id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start import');
    } finally {
      setLoading(false);
    }
  };

  // Poll for import progress
  const startProgressPolling = (importId) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/importer/import-progress/${importId}/`);
        setImportProgress(response.data);

        if (response.data.status === 'completed' || response.data.status === 'failed') {
          clearInterval(interval);
          setImportRunning(false);
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      }
    }, 2000); // Poll every 2 seconds

    // Store interval ID for cleanup
    return interval;
  };

  // Reset to start
  const handleReset = () => {
    setStep(1);
    setImportType('san');
    setSourceType('file');
    setUploadedFiles([]);
    setPastedText('');
    setPreviewData(null);
    setFabricName('');
    setCreateNewFabric(false);
    setImportId(null);
    setImportProgress(null);
    setError(null);
  };

  return (
    <div className={`universal-importer theme-${theme}`}>
      <div className="importer-container">
        <div className="importer-header">
          <h1>Universal Data Importer</h1>
          <p>Import SAN configurations, storage systems, and host data</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Select Type</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Upload Data</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Configure</div>
          </div>
          <div className={`step ${step >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">Import</div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Step 1: Select Import Type */}
        {step === 1 && (
          <div className="step-content">
            <h2>Select Import Type</h2>
            <div className="import-type-selection">
              <div
                className={`import-type-card ${importType === 'san' ? 'selected' : ''}`}
                onClick={() => setImportType('san')}
              >
                <h3>SAN Zoning Configuration</h3>
                <p>Import aliases, zones, and fabrics from Cisco MDS or Brocade switches</p>
                <ul>
                  <li>Cisco MDS (show tech-support, running-config)</li>
                  <li>Brocade (SAN Health CSV, cfgshow output)</li>
                </ul>
              </div>

              <div
                className={`import-type-card ${importType === 'storage' ? 'selected' : ''}`}
                onClick={() => setImportType('storage')}
              >
                <h3>Storage Systems</h3>
                <p>Import storage arrays, volumes, and LUNs</p>
                <ul>
                  <li>IBM Storage Insights API</li>
                  <li>IBM DS8000 CLI output</li>
                  <li>IBM FlashSystem CLI output</li>
                </ul>
                <div className="coming-soon">Coming Soon</div>
              </div>

              <div
                className={`import-type-card ${importType === 'hosts' ? 'selected' : ''}`}
                onClick={() => setImportType('hosts')}
              >
                <h3>Hosts & Servers</h3>
                <p>Import host information and HBA details</p>
                <ul>
                  <li>IBM Power servers (physical & virtual)</li>
                  <li>VMware ESXi hosts</li>
                  <li>CSV bulk import</li>
                </ul>
                <div className="coming-soon">Coming Soon</div>
              </div>
            </div>

            <div className="step-actions">
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={importType !== 'san'}
              >
                Next: Upload Data
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload/Paste Data */}
        {step === 2 && (
          <div className="step-content">
            <h2>Upload or Paste Configuration Data</h2>

            <div className="source-type-tabs">
              <button
                className={`tab ${sourceType === 'file' ? 'active' : ''}`}
                onClick={() => setSourceType('file')}
              >
                Upload File
              </button>
              <button
                className={`tab ${sourceType === 'paste' ? 'active' : ''}`}
                onClick={() => setSourceType('paste')}
              >
                Paste Text
              </button>
            </div>

            {sourceType === 'file' && (
              <div
                className="file-upload-area"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  id="file-input"
                  accept=".txt,.csv,.log"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-input" className="upload-label">
                  {uploadedFiles.length === 0 ? (
                    <>
                      <div className="upload-icon">📁</div>
                      <p>Drag and drop files here, or click to browse</p>
                      <small>Supported formats: .txt, .csv, .log</small>
                    </>
                  ) : (
                    <>
                      <div className="upload-icon">✓</div>
                      <p>{uploadedFiles[0].name}</p>
                      <small>{(uploadedFiles[0].size / 1024).toFixed(2)} KB</small>
                    </>
                  )}
                </label>
              </div>
            )}

            {sourceType === 'paste' && (
              <div className="text-paste-area">
                <textarea
                  className="paste-textarea"
                  placeholder="Paste your switch configuration output here...&#10;&#10;For Cisco: Output from 'show tech-support' or 'show running-config'&#10;For Brocade: Output from 'cfgshow' or SAN Health CSV data"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={20}
                />
              </div>
            )}

            <div className="step-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePreview}
                disabled={loading || (sourceType === 'file' && uploadedFiles.length === 0) || (sourceType === 'paste' && !pastedText)}
              >
                {loading ? 'Parsing...' : 'Preview Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure Import */}
        {step === 3 && previewData && (
          <div className="step-content">
            <h2>Review & Configure Import</h2>

            {previewData.success && (
              <>
                <div className="preview-summary">
                  <h3>Detected Format: {previewData.parser}</h3>

                  <div className="preview-stats">
                    <div className="stat-card">
                      <div className="stat-number">{previewData.counts.fabrics}</div>
                      <div className="stat-label">Fabrics</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{previewData.counts.aliases}</div>
                      <div className="stat-label">Aliases</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{previewData.counts.zones}</div>
                      <div className="stat-label">Zones</div>
                    </div>
                  </div>

                  {/* Aliases Preview with Checkboxes */}
                  {previewData.aliases && previewData.aliases.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-header">
                        <h4>Aliases ({selectedAliases.size} of {previewData.aliases.length} selected)</h4>
                        <div className="preview-actions">
                          <button className="btn btn-sm btn-secondary" onClick={selectAllAliases}>Select All</button>
                          <button className="btn btn-sm btn-secondary" onClick={deselectAllAliases}>Deselect All</button>
                        </div>
                      </div>
                      <div className="preview-table-container">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th style={{width: '40px'}}>
                                <input
                                  type="checkbox"
                                  checked={selectedAliases.size === previewData.aliases.length}
                                  onChange={(e) => e.target.checked ? selectAllAliases() : deselectAllAliases()}
                                />
                              </th>
                              <th>Name</th>
                              <th>WWPN</th>
                              <th>Type</th>
                              <th>Use</th>
                              <th>Fabric</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.aliases.map((alias, idx) => {
                              const key = `alias_${idx}`;
                              return (
                                <tr key={idx} className={selectedAliases.has(key) ? 'selected-row' : ''}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedAliases.has(key)}
                                      onChange={() => toggleAliasSelection(key)}
                                    />
                                  </td>
                                  <td>{alias.name}</td>
                                  <td><code className="wwpn">{alias.wwpn}</code></td>
                                  <td>{alias.type}</td>
                                  <td>{alias.use || '-'}</td>
                                  <td>{alias.fabric || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Zones Preview with Checkboxes */}
                  {previewData.zones && previewData.zones.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-header">
                        <h4>Zones ({selectedZones.size} of {previewData.zones.length} selected)</h4>
                        <div className="preview-actions">
                          <button className="btn btn-sm btn-secondary" onClick={selectAllZones}>Select All</button>
                          <button className="btn btn-sm btn-secondary" onClick={deselectAllZones}>Deselect All</button>
                        </div>
                      </div>
                      <div className="preview-table-container">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th style={{width: '40px'}}>
                                <input
                                  type="checkbox"
                                  checked={selectedZones.size === previewData.zones.length}
                                  onChange={(e) => e.target.checked ? selectAllZones() : deselectAllZones()}
                                />
                              </th>
                              <th>Name</th>
                              <th>Members</th>
                              <th>Type</th>
                              <th>Fabric</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.zones.map((zone, idx) => {
                              const key = `zone_${idx}`;
                              return (
                                <tr key={idx} className={selectedZones.has(key) ? 'selected-row' : ''}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedZones.has(key)}
                                      onChange={() => toggleZoneSelection(key)}
                                    />
                                  </td>
                                  <td>{zone.name}</td>
                                  <td>{zone.member_count}</td>
                                  <td>{zone.type}</td>
                                  <td>{zone.fabric || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fabrics Preview with Checkboxes */}
                  {previewData.fabrics && previewData.fabrics.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-header">
                        <h4>Fabrics ({selectedFabrics.size} of {previewData.fabrics.length} selected)</h4>
                        <div className="preview-actions">
                          <button className="btn btn-sm btn-secondary" onClick={selectAllFabrics}>Select All</button>
                          <button className="btn btn-sm btn-secondary" onClick={deselectAllFabrics}>Deselect All</button>
                        </div>
                      </div>
                      <div className="preview-table-container">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th style={{width: '40px'}}>
                                <input
                                  type="checkbox"
                                  checked={selectedFabrics.size === previewData.fabrics.length}
                                  onChange={(e) => e.target.checked ? selectAllFabrics() : deselectAllFabrics()}
                                />
                              </th>
                              <th>Name</th>
                              <th>VSAN</th>
                              <th>Zoneset</th>
                              <th>Vendor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.fabrics.map((fabric, idx) => {
                              const key = `fabric_${idx}`;
                              return (
                                <tr key={idx} className={selectedFabrics.has(key) ? 'selected-row' : ''}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedFabrics.has(key)}
                                      onChange={() => toggleFabricSelection(key)}
                                    />
                                  </td>
                                  <td>{fabric.name}</td>
                                  <td>{fabric.vsan || '-'}</td>
                                  <td>{fabric.zoneset_name || '-'}</td>
                                  <td>{fabric.san_vendor === 'CI' ? 'Cisco' : 'Brocade'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {previewData.warnings && previewData.warnings.length > 0 && (
                    <div className="alert alert-warning">
                      <strong>Warnings:</strong>
                      <ul>
                        {previewData.warnings.slice(0, 5).map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                      {previewData.warnings.length > 5 && (
                        <small>... and {previewData.warnings.length - 5} more warnings</small>
                      )}
                    </div>
                  )}
                </div>

                {/* Configuration Options */}
                <div className="config-section">
                  <h3>Import Configuration</h3>

                  <div className="form-group">
                    <label>Select Fabric:</label>
                    <select
                      className="form-control"
                      value={selectedFabricId}
                      onChange={(e) => setSelectedFabricId(e.target.value)}
                    >
                      <option value="new">Create New Fabric</option>
                      {existingFabrics.length > 0 && <option disabled>─────────────</option>}
                      {previewData.fabrics && previewData.fabrics.length > 0 && (
                        <>
                          <optgroup label="Cisco Fabrics">
                            {existingFabrics
                              .filter(f => f.san_vendor === 'CI')
                              .map(fabric => (
                                <option key={fabric.id} value={fabric.id}>
                                  {fabric.name} (VSAN: {fabric.vsan || 'N/A'})
                                </option>
                              ))
                            }
                          </optgroup>
                          <optgroup label="Brocade Fabrics">
                            {existingFabrics
                              .filter(f => f.san_vendor === 'BR')
                              .map(fabric => (
                                <option key={fabric.id} value={fabric.id}>
                                  {fabric.name}
                                </option>
                              ))
                            }
                          </optgroup>
                        </>
                      )}
                      {(!previewData.fabrics || previewData.fabrics.length === 0) && existingFabrics.map(fabric => (
                        <option key={fabric.id} value={fabric.id}>
                          {fabric.name} ({fabric.san_vendor === 'CI' ? 'Cisco' : 'Brocade'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedFabricId === 'new' && (
                    <div className="form-group">
                      <label>New Fabric Name:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={previewData.fabrics && previewData.fabrics[0] ? previewData.fabrics[0].name : "Enter fabric name"}
                        value={fabricName}
                        onChange={(e) => setFabricName(e.target.value)}
                      />
                      <small className="form-text">Leave blank to use name from configuration</small>
                    </div>
                  )}

                  {conflicts && conflicts.zones && conflicts.zones.length > 0 && (
                    <div className="alert alert-warning">
                      <strong>⚠️ Duplicate Zones Detected!</strong>
                      <p>{conflicts.zones.length} zone(s) already exist with the same name.</p>
                      <p>You'll be able to resolve these conflicts in the next step.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="step-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                className="btn btn-success"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? 'Starting Import...' : 'Start Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Import Execution */}
        {step === 4 && (
          <div className="step-content">
            <h2>Import Status</h2>

            {importProgress && (
              <div className="import-progress">
                {/* Status Badge */}
                <div className={`status-badge status-${importProgress.status}`}>
                  {importProgress.status.toUpperCase()}
                </div>

                {/* Progress Bar - Only show while running */}
                {importProgress.status === 'running' && importProgress.progress && (
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{ width: `${(importProgress.progress.current / importProgress.progress.total) * 100}%` }}
                    >
                      {Math.round((importProgress.progress.current / importProgress.progress.total) * 100)}%
                    </div>
                    <p className="progress-message">{importProgress.progress.message}</p>
                  </div>
                )}

                {/* Completion Message */}
                {importProgress.status === 'completed' && (
                  <div className="completion-box">
                    <div className="completion-icon">✓</div>
                    <h3>Import Completed Successfully!</h3>
                    <p>All data has been imported into the database.</p>
                    <div className="completion-actions">
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={() => navigate('/san/fabrics')}
                      >
                        View Fabrics
                      </button>
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={handleReset}
                      >
                        Import More Data
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {importProgress.status === 'failed' && (
                  <div className="error-box">
                    <div className="error-icon">✗</div>
                    <h3>Import Failed</h3>
                    <p className="error-message">{importProgress.error_message || 'An unknown error occurred'}</p>
                    <div className="error-actions">
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={handleReset}
                      >
                        Try Again
                      </button>
                      <button
                        className="btn btn-info btn-lg"
                        onClick={() => setShowLogsModal(true)}
                      >
                        View Error Logs
                      </button>
                    </div>
                  </div>
                )}

                {/* View Logs Button - Only show while running or if completed/failed */}
                {(importProgress.status === 'running' || importProgress.status === 'completed' || importProgress.status === 'failed') && (
                  <div className="logs-button-container">
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowLogsModal(true)}
                    >
                      📋 View Import Logs
                    </button>
                  </div>
                )}
              </div>
            )}

            {!importProgress && (
              <div className="import-progress">
                <p>Initializing import...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Logs Modal */}
      {showLogsModal && importId && (
        <ImportLogger
          importId={importId}
          isRunning={importRunning}
          show={showLogsModal}
          onHide={() => setShowLogsModal(false)}
        />
      )}
    </div>
  );
};

export default UniversalImporter;
