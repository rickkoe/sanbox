import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/importer/import-progress/${importId}/`);
        setImportProgress(response.data);

        if (response.data.status === 'completed') {
          clearInterval(interval);
          setImportRunning(false);
          setImportStatus('COMPLETED');
        } else if (response.data.status === 'failed') {
          clearInterval(interval);
          setImportRunning(false);
          setImportStatus('FAILED');
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
                theme={theme}
              />
            </>
          )}

          {/* Step 4: Import Progress */}
          {step === 4 && (
            <>
              <h2>Import Status</h2>
              <ImportProgress
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
    </div>
  );
};

export default UniversalImporter;