import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Modal, Button } from 'react-bootstrap';
import { ConfigContext } from '../context/ConfigContext';
import { useTheme } from '../context/ThemeContext';

// Import new modern components
import StepIndicator from '../components/UniversalImporter/StepIndicator';
import ImportTypeSelector from '../components/UniversalImporter/ImportTypeSelector';
import DataUploader from '../components/UniversalImporter/DataUploader';
import DataPreview from '../components/UniversalImporter/DataPreview';
import ConfigurationPanel from '../components/UniversalImporter/ConfigurationPanel';
import ImportProgress from '../components/UniversalImporter/ImportProgress';
import ImportLogger from '../components/ImportLogger';

import './UniversalImporter.css';

const UniversalImporter = () => {
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();

  // Multi-step wizard state
  const [step, setStep] = useState(1);

  // Import type selection
  const [importType, setImportType] = useState('san');

  // Data source
  const [sourceType, setSourceType] = useState('file');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pastedText, setPastedText] = useState('');

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configuration
  const [fabricName, setFabricName] = useState('');
  const [createNewFabric, setCreateNewFabric] = useState(false);
  const [selectedFabricId, setSelectedFabricId] = useState('new');
  const [existingFabrics, setExistingFabrics] = useState([]);
  const [detectedVendor, setDetectedVendor] = useState(null); // 'CI' for Cisco, 'BR' for Brocade

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
  const [importStatus, setImportStatus] = useState('PENDING');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStats, setCompletionStats] = useState(null);

  // Fetch existing fabrics for dropdown
  const fetchExistingFabrics = async (vendorFilter = null) => {
    try {
      let url = '/api/san/fabrics/';

      // If we have a customer in config, filter by it
      if (config && config.customer && config.customer.id) {
        url += `?customer_id=${config.customer.id}`;
      } else {
        console.warn('[UniversalImporter] Config or customer not available');
        return;
      }

      const response = await axios.get(url);

      // Handle both array response and paginated response
      let fabrics = Array.isArray(response.data) ? response.data : (response.data.results || []);

      // If vendor filter provided, filter on frontend as well
      if (vendorFilter) {
        fabrics = fabrics.filter(f => f.san_vendor === vendorFilter);
      }

      setExistingFabrics(fabrics);
    } catch (err) {
      console.error('[UniversalImporter] Failed to fetch fabrics:', err);
    }
  };

  // Load fabrics when component mounts
  useEffect(() => {
    if (config && config.customer) {
      fetchExistingFabrics();
    }
  }, [config]);

  // Handle selection toggles
  const handleAliasToggle = useCallback((aliasKey) => {
    setSelectedAliases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(aliasKey)) {
        newSet.delete(aliasKey);
      } else {
        newSet.add(aliasKey);
      }
      return newSet;
    });
  }, []);

  const handleZoneToggle = useCallback((zoneKey) => {
    setSelectedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zoneKey)) {
        newSet.delete(zoneKey);
      } else {
        newSet.add(zoneKey);
      }
      return newSet;
    });
  }, []);

  const handleFabricToggle = useCallback((fabricKey) => {
    setSelectedFabrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fabricKey)) {
        newSet.delete(fabricKey);
      } else {
        newSet.add(fabricKey);
      }
      return newSet;
    });
  }, []);

  // Handle select/deselect all
  const handleSelectAll = useCallback((type) => {
    const data = previewData?.[type] || [];
    const isAllSelected = data.every(item => {
      const key = `${item.name}_${item.fabric || 'default'}`;
      const selectedSet = type === 'aliases' ? selectedAliases :
                         type === 'zones' ? selectedZones : selectedFabrics;
      return selectedSet.has(key);
    });

    if (isAllSelected) {
      // Deselect all
      if (type === 'aliases') setSelectedAliases(new Set());
      else if (type === 'zones') setSelectedZones(new Set());
      else if (type === 'fabrics') setSelectedFabrics(new Set());
    } else {
      // Select all
      const allKeys = data.map(item => `${item.name}_${item.fabric || 'default'}`);
      if (type === 'aliases') setSelectedAliases(new Set(allKeys));
      else if (type === 'zones') setSelectedZones(new Set(allKeys));
      else if (type === 'fabrics') setSelectedFabrics(new Set(allKeys));
    }
  }, [previewData, selectedAliases, selectedZones, selectedFabrics]);

  // Parse and preview
  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      let dataToPreview = '';

      if (sourceType === 'file' && uploadedFiles.length > 0) {
        const file = uploadedFiles[0];
        dataToPreview = await file.text();
      } else if (sourceType === 'paste') {
        dataToPreview = pastedText;
      } else {
        setError('Please provide data to preview');
        setLoading(false);
        return;
      }

      const response = await axios.post('/api/importer/parse-preview/', {
        customer_id: config.customer.id,
        data: dataToPreview,
        check_conflicts: true
      });

      setPreviewData(response.data);
      setConflicts(response.data.conflicts || null);

      // Detect vendor from parsed data and re-fetch fabrics with filter
      let vendorCode = null;
      if (response.data.detected_type) {
        // If explicitly provided in response
        vendorCode = response.data.detected_type === 'cisco' ? 'CI' :
                     response.data.detected_type === 'brocade' ? 'BR' : null;
      } else if (response.data.fabrics && response.data.fabrics.length > 0) {
        // Infer from fabric vendor in parsed data
        vendorCode = response.data.fabrics[0].san_vendor;
      }

      // Set the detected vendor in state
      setDetectedVendor(vendorCode);

      // Re-fetch fabrics filtered by detected vendor
      if (vendorCode) {
        await fetchExistingFabrics(vendorCode);
      }

      // Auto-select all items by default
      if (response.data.aliases) {
        const allAliasKeys = response.data.aliases.map(alias =>
          `${alias.name}_${alias.fabric || 'default'}`
        );
        setSelectedAliases(new Set(allAliasKeys));
      }
      if (response.data.zones) {
        const allZoneKeys = response.data.zones.map(zone =>
          `${zone.name}_${zone.fabric || 'default'}`
        );
        setSelectedZones(new Set(allZoneKeys));
      }
      if (response.data.fabrics) {
        const allFabricKeys = response.data.fabrics.map(fabric =>
          `${fabric.name}_${fabric.vsan || 'default'}`
        );
        setSelectedFabrics(new Set(allFabricKeys));
      }

      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to parse data');
    } finally {
      setLoading(false);
    }
  };

  // Handle conflict resolution
  const handleConflictResolve = useCallback((conflictName, resolution) => {
    setConflictResolutions(prev => ({
      ...prev,
      [conflictName]: resolution
    }));
  }, []);

  // Execute import
  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setImportStatus('RUNNING');

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
        project_id: config.active_project?.id
      });

      setImportId(response.data.import_id);
      setImportRunning(true);
      setStep(4);

      // Start polling for progress
      startProgressPolling(response.data.import_id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start import');
      setImportStatus('FAILED');
      setImportProgress({
        status: 'error',
        error: err.response?.data?.error || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Poll for import progress
  const startProgressPolling = (importId) => {
    let intervalCleared = false;

    const interval = setInterval(async () => {
      if (intervalCleared) return;

      try {
        const response = await axios.get(`/api/importer/import-progress/${importId}/`);

        // Check for various completion status strings
        const status = response.data.status?.toLowerCase();
        const hasCompletedAt = response.data.completed_at !== null;
        const progressIs100 = response.data.progress === 100 ||
                             (response.data.progress?.current === response.data.progress?.total);

        console.log('Poll response:', {
          status,
          hasCompletedAt,
          progressIs100,
          fullResponse: response.data
        });

        // Check multiple conditions for completion
        if (status === 'completed' || status === 'complete' || status === 'success' ||
            (hasCompletedAt && progressIs100)) {
          console.log('IMPORT COMPLETED DETECTED!');
          console.log('Full response data:', response.data);
          intervalCleared = true;
          clearInterval(interval);

          // Check multiple possible locations for stats
          const extractStats = (data) => {
            // Log what we're working with
            console.log('Extracting stats from:', {
              direct: {
                aliases_imported: data.aliases_imported,
                zones_imported: data.zones_imported,
                fabrics_created: data.fabrics_created,
                aliases_count: data.aliases_count,
                zones_count: data.zones_count,
                fabrics_count: data.fabrics_count
              },
              stats: data.stats,
              result: data.result,
              summary: data.summary
            });

            return {
              aliases: data.aliases_imported || data.aliases_count ||
                      data.stats?.aliases || data.stats?.aliases_imported ||
                      data.stats?.aliases_created || data.result?.aliases_imported ||
                      data.summary?.aliases || 0,
              zones: data.zones_imported || data.zones_count ||
                    data.stats?.zones || data.stats?.zones_imported ||
                    data.stats?.zones_created || data.result?.zones_imported ||
                    data.summary?.zones || 0,
              fabrics: data.fabrics_created || data.fabrics_count ||
                      data.stats?.fabrics || data.stats?.fabrics_created ||
                      data.stats?.fabrics_updated || data.result?.fabrics_created ||
                      data.summary?.fabrics || 0,
              duration: (() => {
                if (!data.duration) return 0;
                if (typeof data.duration === 'number') return Math.round(data.duration);
                if (typeof data.duration === 'string') {
                  // Handle format like "0:00:03.123456" or just "3.123456"
                  const parts = data.duration.split(':');
                  if (parts.length === 3) {
                    // HH:MM:SS.ms format
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    const seconds = parseFloat(parts[2]) || 0;
                    return Math.round(hours * 3600 + minutes * 60 + seconds);
                  } else if (parts.length === 2) {
                    // MM:SS.ms format
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseFloat(parts[1]) || 0;
                    return Math.round(minutes * 60 + seconds);
                  } else {
                    // Just seconds
                    return Math.round(parseFloat(data.duration) || 0);
                  }
                }
                return 0;
              })()
            };
          };

          const stats = extractStats(response.data);
          console.log('Extracted stats:', stats);

          // Create a proper success progress object
          const successProgress = {
            ...response.data,
            status: 'success',  // This is critical for the UI
            progress: 100,
            stats: stats
          };

          // Set both states together to ensure they're in sync
          console.log('Setting COMPLETED state with success progress:', successProgress);
          setImportProgress(successProgress);
          setImportStatus('COMPLETED');
          setImportRunning(false);

          // Show completion modal with stats
          setCompletionStats(successProgress.stats);
          setShowCompletionModal(true);
          console.log('States set to COMPLETED - showing completion modal');
        } else if (status === 'failed' || status === 'error') {
          intervalCleared = true;
          clearInterval(interval);

          // Set error status in progress for the UI
          setImportProgress({
            ...response.data,
            status: 'error',
            error: response.data.error_message || response.data.error || 'Import failed'
          });
          setImportStatus('FAILED');
          setImportRunning(false);
        } else {
          // Still running - update progress but don't overwrite if we already set success
          setImportProgress(prev => {
            // Don't overwrite success status
            if (prev?.status === 'success') {
              return prev;
            }
            return response.data;
          });
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      }
    }, 2000);

    return interval;
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 2 && (
      (sourceType === 'file' && uploadedFiles.length > 0) ||
      (sourceType === 'paste' && pastedText.trim())
    )) {
      handlePreview();
    } else if (step === 3 && (selectedFabricId || createNewFabric)) {
      handleImport();
    } else if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleReset = () => {
    setStep(1);
    setImportType('san');
    setSourceType('file');
    setUploadedFiles([]);
    setPastedText('');
    setPreviewData(null);
    setFabricName('');
    setCreateNewFabric(false);
    setSelectedFabricId('new');
    setImportId(null);
    setImportProgress(null);
    setImportStatus('PENDING');
    setError(null);
    setSelectedAliases(new Set());
    setSelectedZones(new Set());
    setSelectedFabrics(new Set());
    setConflicts(null);
    setConflictResolutions({});
    setShowCompletionModal(false);
    setCompletionStats(null);
    setDetectedVendor(null);
    // Reset fabrics to show all for customer
    if (config && config.customer) {
      fetchExistingFabrics();
    }
  };

  const handleViewFabrics = () => {
    navigate('/san/fabrics');
  };

  const handleViewLogs = () => {
    setShowLogsModal(true);
  };

  // Check if can proceed to next step
  const canProceed = () => {
    switch (step) {
      case 1:
        return importType === 'san'; // Only SAN is available for now
      case 2:
        return (sourceType === 'file' && uploadedFiles.length > 0) ||
               (sourceType === 'paste' && pastedText.trim());
      case 3:
        return (selectedFabricId && (selectedFabricId !== 'new' || fabricName.trim())) &&
               (selectedAliases.size > 0 || selectedZones.size > 0 || selectedFabrics.size > 0);
      default:
        return false;
    }
  };

  return (
    <div className={`universal-importer theme-${theme}`}>
      <div className="importer-container">
        {/* Header */}
        <div className="importer-header">
          <h1>Universal Data Importer</h1>
          <p>Import and manage your infrastructure data with ease</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} theme={theme} />

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Select Import Type */}
          {step === 1 && (
            <>
              <h2>Select Import Type</h2>
              <ImportTypeSelector
                selectedType={importType}
                onTypeSelect={setImportType}
                theme={theme}
              />
            </>
          )}

          {/* Step 2: Upload/Paste Data */}
          {step === 2 && (
            <>
              <h2>Upload Your Data</h2>
              <DataUploader
                sourceType={sourceType}
                onSourceTypeChange={setSourceType}
                uploadedFiles={uploadedFiles}
                onFilesChange={setUploadedFiles}
                pastedText={pastedText}
                onTextChange={setPastedText}
                onPreview={handlePreview}
                loading={loading}
                error={error}
                theme={theme}
              />
            </>
          )}

          {/* Step 3: Configure & Review */}
          {step === 3 && previewData && (
            <>
              <h2>Configure & Review</h2>
              <DataPreview
                previewData={previewData}
                selectedAliases={selectedAliases}
                selectedZones={selectedZones}
                selectedFabrics={selectedFabrics}
                onAliasToggle={handleAliasToggle}
                onZoneToggle={handleZoneToggle}
                onFabricToggle={handleFabricToggle}
                onSelectAll={handleSelectAll}
                onDeselectAll={() => {}}
                conflicts={conflicts}
                theme={theme}
              />
              <div className="configuration-divider" />
              <ConfigurationPanel
                existingFabrics={existingFabrics}
                selectedFabricId={selectedFabricId}
                onFabricSelect={setSelectedFabricId}
                createNewFabric={createNewFabric}
                onCreateNewToggle={setCreateNewFabric}
                fabricName={fabricName}
                onFabricNameChange={setFabricName}
                conflicts={conflicts}
                conflictResolutions={conflictResolutions}
                onConflictResolve={handleConflictResolve}
                detectedVendor={detectedVendor}
                theme={theme}
              />
            </>
          )}

          {/* Step 4: Import Progress */}
          {step === 4 && (
            <>
              <h2>Import Status</h2>
              <ImportProgress
                key={`${importStatus}-${importProgress?.status}`} // Force re-render on status change
                importStatus={importStatus}
                importProgress={importProgress}
                onViewLogs={handleViewLogs}
                onViewFabrics={handleViewFabrics}
                onImportMore={handleReset}
                onTryAgain={() => {
                  setStep(3);
                  setImportStatus('PENDING');
                  setImportProgress(null);
                }}
                theme={theme}
              />
            </>
          )}
        </div>

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="navigation-buttons">
            <div></div> {/* Empty div for spacing */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="nav-button secondary"
                onClick={handleBack}
                disabled={step === 1}
              >
                Back
              </button>
              <button
                className="nav-button primary"
                onClick={handleNext}
                disabled={!canProceed() || loading}
              >
                {loading ? 'Processing...' : step === 3 ? 'Start Import' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Logger Modal */}
      {showLogsModal && importId && (
        <ImportLogger
          importId={importId}
          isRunning={importRunning}
          show={showLogsModal}
          onHide={() => setShowLogsModal(false)}
        />
      )}

      {/* Import Completion Modal */}
      <Modal
        show={showCompletionModal}
        onHide={() => setShowCompletionModal(false)}
        size="lg"
        centered
        className={`theme-${theme}`}
      >
        <Modal.Header
          closeButton
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            borderBottom: 'none'
          }}
        >
          <Modal.Title>
            <h4 style={{ margin: 0 }}>🎉 Import Completed Successfully!</h4>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            color: theme === 'dark' ? '#e2e8f0' : '#1e3a52'
          }}
        >
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h3 style={{
              color: theme === 'dark' ? '#68d391' : '#10b981',
              marginBottom: '30px'
            }}>
              ✅ Your data has been imported successfully!
            </h3>

            {completionStats && (
              <div style={{
                backgroundColor: theme === 'dark' ? 'rgba(30, 30, 60, 0.5)' : '#f8fafc',
                borderRadius: '12px',
                padding: '25px',
                marginBottom: '20px',
                border: theme === 'dark' ? '1px solid rgba(100, 255, 218, 0.2)' : '1px solid #e2e8f0'
              }}>
                <h5 style={{
                  marginBottom: '25px',
                  color: theme === 'dark' ? '#64ffda' : '#1e3a52',
                  fontSize: '1.3rem',
                  fontWeight: '600'
                }}>
                  📊 Import Summary
                </h5>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '20px',
                  textAlign: 'center'
                }}>
                  {completionStats.fabrics !== undefined && (
                    <div style={{
                      padding: '15px',
                      backgroundColor: theme === 'dark' ? 'rgba(100, 255, 218, 0.1)' : '#f0fdf4',
                      borderRadius: '8px',
                      border: theme === 'dark' ? '1px solid rgba(100, 255, 218, 0.3)' : '1px solid #86efac'
                    }}>
                      <div style={{
                        fontSize: '2.5em',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#64ffda' : '#10b981'
                      }}>
                        {completionStats.fabrics || 0}
                      </div>
                      <div style={{
                        marginTop: '5px',
                        fontSize: '0.9rem',
                        color: theme === 'dark' ? '#cbd5e0' : '#475569'
                      }}>
                        Fabric{completionStats.fabrics === 1 ? '' : 's'} {createNewFabric ? 'Created' : 'Updated'}
                      </div>
                    </div>
                  )}
                  {completionStats.aliases !== undefined && (
                    <div style={{
                      padding: '15px',
                      backgroundColor: theme === 'dark' ? 'rgba(99, 179, 237, 0.1)' : '#e8f0f7',
                      borderRadius: '8px',
                      border: theme === 'dark' ? '1px solid rgba(99, 179, 237, 0.3)' : '1px solid #b0c7d9'
                    }}>
                      <div style={{
                        fontSize: '2.5em',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#63b3ed' : '#1e3a52'
                      }}>
                        {completionStats.aliases || 0}
                      </div>
                      <div style={{
                        marginTop: '5px',
                        fontSize: '0.9rem',
                        color: theme === 'dark' ? '#cbd5e0' : '#475569'
                      }}>
                        Alias{completionStats.aliases === 1 ? '' : 'es'} Imported
                      </div>
                    </div>
                  )}
                  {completionStats.zones !== undefined && (
                    <div style={{
                      padding: '15px',
                      backgroundColor: theme === 'dark' ? 'rgba(246, 173, 85, 0.1)' : '#fffbeb',
                      borderRadius: '8px',
                      border: theme === 'dark' ? '1px solid rgba(246, 173, 85, 0.3)' : '1px solid #fcd34d'
                    }}>
                      <div style={{
                        fontSize: '2.5em',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#f6ad55' : '#f59e0b'
                      }}>
                        {completionStats.zones || 0}
                      </div>
                      <div style={{
                        marginTop: '5px',
                        fontSize: '0.9rem',
                        color: theme === 'dark' ? '#cbd5e0' : '#475569'
                      }}>
                        Zone{completionStats.zones === 1 ? '' : 's'} Created
                      </div>
                    </div>
                  )}
                  {completionStats.duration !== undefined && (
                    <div style={{
                      padding: '15px',
                      backgroundColor: theme === 'dark' ? 'rgba(160, 174, 192, 0.1)' : '#f1f5f9',
                      borderRadius: '8px',
                      border: theme === 'dark' ? '1px solid rgba(160, 174, 192, 0.3)' : '1px solid #cbd5e0'
                    }}>
                      <div style={{
                        fontSize: '2.5em',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#a0aec0' : '#64748b'
                      }}>
                        {completionStats.duration || 0}s
                      </div>
                      <div style={{
                        marginTop: '5px',
                        fontSize: '0.9rem',
                        color: theme === 'dark' ? '#cbd5e0' : '#475569'
                      }}>
                        Time Taken
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer
          style={{
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderTop: theme === 'dark' ? '1px solid rgba(100, 255, 218, 0.2)' : '1px solid #e2e8f0'
          }}
        >
          <Button
            variant="success"
            onClick={() => {
              setShowCompletionModal(false);
              navigate('/san/fabrics');
            }}
            style={{
              backgroundColor: theme === 'dark' ? '#064e3b' : '#10b981',
              borderColor: theme === 'dark' ? '#064e3b' : '#10b981'
            }}
          >
            View Fabrics
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowCompletionModal(false);
              handleReset();
            }}
            style={{
              backgroundColor: theme === 'dark' ? '#1e3a52' : '#3b82f6',
              borderColor: theme === 'dark' ? '#1e3a52' : '#3b82f6'
            }}
          >
            Import More Data
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowCompletionModal(false)}
            style={{
              backgroundColor: theme === 'dark' ? '#374151' : '#6b7280',
              borderColor: theme === 'dark' ? '#374151' : '#6b7280'
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UniversalImporter;