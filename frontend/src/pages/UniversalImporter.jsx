import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle } from 'lucide-react';
import { ConfigContext } from '../context/ConfigContext';
import { useTheme } from '../context/ThemeContext';

// Import new modern components
import StepIndicator from '../components/UniversalImporter/StepIndicator';
import ScrollButtons from '../components/UniversalImporter/ScrollButtons';
import ImportTypeSelector from '../components/UniversalImporter/ImportTypeSelector';
import DataUploader from '../components/UniversalImporter/DataUploader';
import DataPreview from '../components/UniversalImporter/DataPreview';
import ConfigurationPanel from '../components/UniversalImporter/ConfigurationPanel';
import ImportProgress from '../components/UniversalImporter/ImportProgress';
import ImportLogger from '../components/ImportLogger';
import StorageInsightsCredentials from '../components/UniversalImporter/StorageInsightsCredentials';
import StoragePreview from '../components/UniversalImporter/StoragePreview';

import './UniversalImporter.css';

const UniversalImporter = () => {
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();

  // Multi-step wizard state
  const [step, setStep] = useState(1);

  // Import type selection
  const [importType, setImportType] = useState('san'); // 'san' or 'storage'

  // Data source
  const [sourceType, setSourceType] = useState('file');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pastedText, setPastedText] = useState('');

  // Storage Insights specific state
  const [tenantId, setTenantId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [availableSystems, setAvailableSystems] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState([]);
  const [storageImportOptions, setStorageImportOptions] = useState({
    storage_systems: true,
    volumes: true,
    hosts: true,
    ports: false
  });

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configuration
  const [fabricName, setFabricName] = useState('');
  const [zonesetName, setZonesetName] = useState('');
  const [vsan, setVsan] = useState('');
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

  // NEW: Fabric mapping state for multi-fabric imports
  const [fabricMapping, setFabricMapping] = useState({});

  // Import execution
  const [importName, setImportName] = useState('');
  const [importRunning, setImportRunning] = useState(false);
  const [importId, setImportId] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importStatus, setImportStatus] = useState('PENDING');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStats, setCompletionStats] = useState(null);
  const [concurrentWarning, setConcurrentWarning] = useState(null);

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

  // Pre-populate Storage Insights credentials from customer when entering step 2 for storage
  useEffect(() => {
    if (step === 2 && importType === 'storage' && config?.customer) {
      // Only pre-populate if not already set
      if (!tenantId && config.customer.insights_tenant) {
        setTenantId(config.customer.insights_tenant);
      }
      if (!apiKey && config.customer.insights_api_key) {
        setApiKey(config.customer.insights_api_key);
      }
    }
  }, [step, importType, config]);

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

      console.log('=== PREVIEW DATA DEBUG ===');
      console.log('Full response:', response.data);
      console.log('Switches array:', response.data.switches);
      console.log('Counts:', response.data.counts);
      console.log('==========================');

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

      // Auto-populate VSAN and zoneset from first fabric in preview data
      if (response.data.fabrics && response.data.fabrics.length > 0) {
        const firstFabric = response.data.fabrics[0];
        if (firstFabric.vsan) {
          setVsan(String(firstFabric.vsan));
        }
        if (firstFabric.zoneset_name) {
          setZonesetName(firstFabric.zoneset_name);
        }
      }

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

        // Initialize fabric mapping for multi-fabric imports
        if (response.data.fabrics.length > 1) {
          const initialMapping = {};
          response.data.fabrics.forEach(fabric => {
            // Initialize with create_new as default
            initialMapping[fabric.name] = {
              create_new: true,
              name: fabric.name,
              zoneset_name: fabric.zoneset_name || '',
              vsan: fabric.vsan ? String(fabric.vsan) : ''
            };
          });
          setFabricMapping(initialMapping);
        }
      }

      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to parse data');
    } finally {
      setLoading(false);
    }
  };

  // Handle storage insights preview
  const handleStoragePreview = async () => {
    if (!tenantId || !apiKey) {
      setError('Please provide both Tenant ID and API Key');
      return;
    }

    if (selectedSystems.length === 0) {
      setError('Please select at least one storage system');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build JSON credentials for the backend
      const credentialsData = JSON.stringify({
        tenant_id: tenantId,
        api_key: apiKey,
        selected_systems: selectedSystems,
        import_options: storageImportOptions
      });

      // Call preview endpoint (backend will auto-detect this as storage type)
      const response = await axios.post('/api/importer/parse-preview/', {
        customer_id: config.customer.id,
        data: credentialsData,
        check_conflicts: false // No conflicts for storage imports
      });

      console.log('=== STORAGE PREVIEW DATA ===');
      console.log('Full response:', response.data);
      console.log('============================');

      setPreviewData(response.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to preview storage import');
    } finally {
      setLoading(false);
    }
  };

  // Handle conflict resolution
  const handleConflictResolve = useCallback((conflictName, resolution, suffix = '_copy') => {
    setConflictResolutions(prev => ({
      ...prev,
      [conflictName]: resolution === 'rename' ? { action: 'rename', suffix } : resolution
    }));
  }, []);

  // Handle fabric mapping changes
  const handleFabricMappingChange = useCallback((sourceFabricName, mappingConfig) => {
    setFabricMapping(prev => ({
      ...prev,
      [sourceFabricName]: mappingConfig
    }));
  }, []);

  // Execute import
  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setImportStatus('RUNNING');

    try {
      let dataToImport = '';

      // For storage imports, build JSON credentials
      if (importType === 'storage') {
        dataToImport = JSON.stringify({
          tenant_id: tenantId,
          api_key: apiKey,
          selected_systems: selectedSystems,
          import_options: storageImportOptions
        });
      } else {
        // For SAN imports, get text data
        if (sourceType === 'file' && uploadedFiles.length > 0) {
          const file = uploadedFiles[0];
          dataToImport = await file.text();
        } else if (sourceType === 'paste') {
          dataToImport = pastedText;
        }
      }

      // Prepare selected items data
      const selectedItems = {
        aliases: Array.from(selectedAliases),
        zones: Array.from(selectedZones),
        fabrics: Array.from(selectedFabrics)
      };

      // Determine if we're using fabric mapping (multi-fabric mode)
      const hasMultipleFabrics = previewData?.fabrics && previewData.fabrics.length > 1;
      const useFabricMapping = hasMultipleFabrics && Object.keys(fabricMapping).length > 0;

      // Auto-generate import name if not provided
      let finalImportName = importName;
      if (!finalImportName || finalImportName.trim() === '') {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        finalImportName = `${config.customer.name} Import - ${dateStr} ${timeStr}`;
      }

      // Start import
      const response = await axios.post('/api/importer/import-san-config/', {
        customer_id: config.customer.id,
        data: dataToImport,
        import_name: finalImportName,
        // Legacy single-fabric parameters
        fabric_id: !useFabricMapping && selectedFabricId === 'new' ? null : selectedFabricId,
        fabric_name: !useFabricMapping && selectedFabricId === 'new' ? fabricName : null,
        zoneset_name: !useFabricMapping && selectedFabricId === 'new' ? zonesetName : null,
        vsan: !useFabricMapping && selectedFabricId === 'new' ? vsan : null,
        create_new_fabric: !useFabricMapping && selectedFabricId === 'new',
        // NEW: Fabric mapping for multi-fabric imports
        fabric_mapping: useFabricMapping ? fabricMapping : null,
        selected_items: selectedItems,
        conflict_resolutions: conflictResolutions,
        project_id: config.active_project?.id
      });

      // Check for concurrent import warning
      if (response.data.warning) {
        setConcurrentWarning(response.data.warning);
      }

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
            // Log the ENTIRE response to debug
            console.log('=== FULL IMPORT RESPONSE DATA ===');
            console.log('Full data object:', JSON.stringify(data, null, 2));
            console.log('Keys in data:', Object.keys(data));

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
              summary: data.summary,
              metadata: data.metadata
            });

            const extractedStats = {
              // SAN stats - check ALL possible locations
              aliases: data.aliases_imported || data.aliases_count ||
                      data.stats?.aliases || data.stats?.aliases_imported ||
                      data.stats?.aliases_created || data.result?.aliases_imported ||
                      data.summary?.aliases || data.metadata?.aliases_imported ||
                      data.metadata?.aliases_created || 0,
              zones: data.zones_imported || data.zones_count ||
                    data.stats?.zones || data.stats?.zones_imported ||
                    data.stats?.zones_created || data.result?.zones_imported ||
                    data.summary?.zones || data.metadata?.zones_imported ||
                    data.metadata?.zones_created || 0,
              fabrics: data.fabrics_created || data.fabrics_count ||
                      data.stats?.fabrics || data.stats?.fabrics_created ||
                      data.stats?.fabrics_updated || data.result?.fabrics_created ||
                      data.summary?.fabrics || data.metadata?.fabrics_created || 0,
              switches: data.switches_imported || data.switches_count ||
                       data.stats?.switches || data.stats?.switches_imported ||
                       data.stats?.switches_created || data.result?.switches_imported ||
                       data.summary?.switches || data.metadata?.switches_imported ||
                       data.metadata?.switches_created || 0,
              // Storage stats
              storage_systems_created: data.storage_systems_imported ||
                                       data.stats?.storage_systems_created ||
                                       data.metadata?.storage_systems_created || 0,
              storage_systems_updated: data.stats?.storage_systems_updated ||
                                       data.metadata?.storage_systems_updated || 0,
              volumes_created: data.volumes_imported ||
                              data.stats?.volumes_created ||
                              data.metadata?.volumes_created || 0,
              volumes_updated: data.stats?.volumes_updated ||
                              data.metadata?.volumes_updated || 0,
              hosts_created: data.hosts_imported ||
                            data.stats?.hosts_created ||
                            data.metadata?.hosts_created || 0,
              hosts_updated: data.stats?.hosts_updated ||
                            data.metadata?.hosts_updated || 0,
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

            console.log('=== EXTRACTED STATS ===', extractedStats);
            return extractedStats;
          };

          const stats = extractStats(response.data);
          console.log('Final stats to be used:', stats);

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
    setZonesetName('');
    setVsan('');
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

  // Get tooltip message for disabled Next button
  const getNextButtonTooltip = () => {
    if (canProceed() || loading) return '';

    switch (step) {
      case 2:
        if (importType === 'storage') {
          if (availableSystems.length === 0) {
            return 'Fetch available systems to continue';
          }
          if (selectedSystems.length === 0) {
            return 'Select at least one system to continue';
          }
        }
        if (sourceType === 'file') {
          return 'Upload a file to continue';
        }
        return 'Paste configuration data to continue';
      case 3:
        return 'Complete configuration to continue';
      default:
        return '';
    }
  };

  // Check if can proceed to next step
  const canProceed = () => {
    switch (step) {
      case 1:
        // Both SAN and Storage are available
        return importType === 'san' || importType === 'storage';
      case 2:
        // For storage: must have fetched systems and selected at least one
        if (importType === 'storage') {
          return availableSystems.length > 0 && selectedSystems.length > 0;
        }
        // For SAN: need file or pasted text
        return (sourceType === 'file' && uploadedFiles.length > 0) ||
               (sourceType === 'paste' && pastedText.trim());
      case 3:
        // For storage imports, just check that we have preview data
        if (importType === 'storage') {
          return previewData && (
            (previewData.counts?.storage_systems > 0) ||
            (previewData.counts?.volumes > 0) ||
            (previewData.counts?.hosts > 0)
          );
        }

        // For SAN imports, check fabric/zone requirements
        // Check if this is a switches-only import
        const isSwitchesOnly = (previewData?.counts?.switches > 0) &&
                               (previewData?.counts?.aliases === 0) &&
                               (previewData?.counts?.zones === 0);

        // For switches-only imports, we don't need fabric selection
        if (isSwitchesOnly) {
          // Just check conflicts are resolved
          const totalConflicts = (conflicts?.zones?.length || 0) + (conflicts?.aliases?.length || 0);
          const resolvedConflicts = Object.keys(conflictResolutions).length;
          const allConflictsResolved = totalConflicts === 0 || resolvedConflicts >= totalConflicts;
          return allConflictsResolved;
        }

        // Check fabric selection/mapping for alias/zone imports
        const hasMultipleFabrics = previewData?.fabrics && previewData.fabrics.length > 1;
        const useFabricMapping = hasMultipleFabrics && Object.keys(fabricMapping).length > 0;

        let hasFabric = false;
        if (useFabricMapping) {
          // Fabric mapping mode: check that all fabrics are mapped
          const allFabricsMapped = previewData.fabrics.every(fabric => {
            const mapping = fabricMapping[fabric.name];
            if (!mapping) return false;

            // Check if mapped to existing fabric OR creating new with valid name
            if (mapping.fabric_id) return true;
            if (mapping.create_new && mapping.name && mapping.name.trim()) return true;

            return false;
          });
          hasFabric = allFabricsMapped;
        } else {
          // Legacy single fabric mode
          hasFabric = selectedFabricId && (
            selectedFabricId !== 'new' ||
            (fabricName.trim() && zonesetName.trim())
          );
        }

        // Check that at least something is selected to import
        const hasSelections = selectedAliases.size > 0 || selectedZones.size > 0 || selectedFabrics.size > 0;

        // Check that all conflicts are resolved
        const totalConflicts = (conflicts?.zones?.length || 0) + (conflicts?.aliases?.length || 0);
        const resolvedConflicts = Object.keys(conflictResolutions).length;
        const allConflictsResolved = totalConflicts === 0 || resolvedConflicts >= totalConflicts;

        return hasFabric && hasSelections && allConflictsResolved;
      default:
        return false;
    }
  };

  return (
    <div className={`universal-importer theme-${theme}`}>
      <div className="importer-container">
        {/* Step Indicator */}
        <StepIndicator
          currentStep={step}
          importType={importType}
          loading={loading || importRunning}
          importStatus={importStatus}
        />

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
              <div className="mt-4">
                <label htmlFor="importName" className="form-label">Import Name (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  id="importName"
                  placeholder="e.g., Monthly SAN Update, Storage Migration Phase 1"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
                <small className="text-muted">Give this import a descriptive name to help identify it later</small>
              </div>
            </>
          )}

          {/* Step 2: Upload/Paste Data OR Enter Credentials */}
          {step === 2 && (
            <>
              {importType === 'storage' ? (
                <>
                  <h2>IBM Storage Insights Credentials</h2>
                  <StorageInsightsCredentials
                    tenantId={tenantId}
                    setTenantId={setTenantId}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    availableSystems={availableSystems}
                    setAvailableSystems={setAvailableSystems}
                    selectedSystems={selectedSystems}
                    setSelectedSystems={setSelectedSystems}
                    importOptions={storageImportOptions}
                    setImportOptions={setStorageImportOptions}
                    customerId={config?.customer?.id}
                    theme={theme}
                  />
                </>
              ) : (
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
            </>
          )}

          {/* Step 3: Configure & Review */}
          {step === 3 && previewData && (
            <>
              <h2>{importType === 'storage' ? 'Review Import' : 'Configure & Review'}</h2>

              {importType === 'storage' ? (
                // Storage preview
                <StoragePreview
                  previewData={previewData}
                  theme={theme}
                />
              ) : (
                // SAN preview and configuration
                <>
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
                    zonesetName={zonesetName}
                    onZonesetNameChange={setZonesetName}
                    vsan={vsan}
                    onVsanChange={setVsan}
                    conflicts={conflicts}
                    conflictResolutions={conflictResolutions}
                onConflictResolve={handleConflictResolve}
                detectedVendor={detectedVendor}
                theme={theme}
                onStartImport={handleImport}
                canStartImport={canProceed() && !loading}
                previewData={previewData}
                fabricMapping={fabricMapping}
                onFabricMappingChange={handleFabricMappingChange}
              />
                </>
              )}
            </>
          )}

          {/* Step 4: Import Progress */}
          {step === 4 && (
            <>
              <h2>Import Status</h2>
              {concurrentWarning && (
                <div className="alert alert-warning mt-3">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {concurrentWarning}
                </div>
              )}
              <div className="alert alert-info mt-3">
                <i className="bi bi-info-circle me-2"></i>
                You can navigate away from this page. Your import will continue in the background.
                <a href="/import/monitor" className="alert-link ms-2" onClick={(e) => {
                  e.preventDefault();
                  navigate('/import/monitor');
                }}>
                  View Import Monitor →
                </a>
              </div>
              <ImportProgress
                key={`${importStatus}-${importProgress?.status}`} // Force re-render on status change
                importStatus={importStatus}
                importProgress={importProgress}
                onViewLogs={handleViewLogs}
                onViewFabrics={handleViewFabrics}
                onNavigate={navigate}
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

        {/* Step 2 Storage Insights Navigation Buttons */}
        {step === 2 && importType === 'storage' && availableSystems.length > 0 && selectedSystems.length > 0 && (
          <div className="navigation-buttons">
            <div></div> {/* Empty div for spacing */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="nav-button secondary" onClick={() => setStep(1)} disabled={loading}>
                Back
              </button>
              <button
                className="nav-button secondary"
                onClick={handleImport}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                title="Skip preview and import immediately"
              >
                Import Without Preview
              </button>
              <button
                className="nav-button primary"
                onClick={handleStoragePreview}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Loading Preview...
                  </>
                ) : (
                  'Preview Import'
                )}
              </button>
            </div>
          </div>
        )}

        {/* General Navigation Buttons */}
        {step < 4 && !(step === 2 && importType === 'storage' && availableSystems.length > 0 && selectedSystems.length > 0) && (
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
                title={getNextButtonTooltip()}
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
      {showCompletionModal && (
        <div className="completion-modal-overlay" onClick={() => setShowCompletionModal(false)}>
          <div className="completion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="completion-modal-header">
              <div className="completion-modal-title">
                <CheckCircle size={28} />
                Import Complete
              </div>
              <button
                className="completion-modal-close"
                onClick={() => setShowCompletionModal(false)}
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="completion-modal-body">
              <div className="completion-modal-message">
                <p>Your data has been successfully imported into the database.</p>
              </div>

              {completionStats && (
                <div className="completion-stats-grid">
                  {completionStats.fabrics !== undefined && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {completionStats.fabrics || 0}
                      </div>
                      <div className="completion-stat-label">
                        Fabric{completionStats.fabrics === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}
                  {completionStats.switches !== undefined && completionStats.switches > 0 && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {completionStats.switches}
                      </div>
                      <div className="completion-stat-label">
                        Switch{completionStats.switches === 1 ? '' : 'es'}
                      </div>
                    </div>
                  )}
                  {completionStats.aliases !== undefined && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {completionStats.aliases || 0}
                      </div>
                      <div className="completion-stat-label">
                        Alias{completionStats.aliases === 1 ? '' : 'es'}
                      </div>
                    </div>
                  )}
                  {completionStats.zones !== undefined && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {completionStats.zones || 0}
                      </div>
                      <div className="completion-stat-label">
                        Zone{completionStats.zones === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}
                  {(completionStats.storage_systems_created !== undefined ||
                    completionStats.storage_systems_updated !== undefined) && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {(completionStats.storage_systems_created || 0) +
                         (completionStats.storage_systems_updated || 0)}
                      </div>
                      <div className="completion-stat-label">
                        System{((completionStats.storage_systems_created || 0) +
                               (completionStats.storage_systems_updated || 0)) === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}
                  {(completionStats.volumes_created !== undefined ||
                    completionStats.volumes_updated !== undefined) && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {(completionStats.volumes_created || 0) +
                         (completionStats.volumes_updated || 0)}
                      </div>
                      <div className="completion-stat-label">
                        Volume{((completionStats.volumes_created || 0) +
                               (completionStats.volumes_updated || 0)) === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}
                  {(completionStats.hosts_created !== undefined ||
                    completionStats.hosts_updated !== undefined) && (
                    <div className="completion-stat-card">
                      <div className="completion-stat-value">
                        {(completionStats.hosts_created || 0) +
                         (completionStats.hosts_updated || 0)}
                      </div>
                      <div className="completion-stat-label">
                        Host{((completionStats.hosts_created || 0) +
                             (completionStats.hosts_updated || 0)) === 1 ? '' : 's'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="completion-modal-footer">
              <button
                className="nav-button secondary"
                onClick={() => setShowCompletionModal(false)}
              >
                Close
              </button>
              <button
                className="nav-button secondary"
                onClick={() => {
                  setShowCompletionModal(false);
                  handleReset();
                }}
              >
                Import More
              </button>

              {/* Dynamic buttons based on what was imported */}
              {completionStats && (
                <>
                  {/* SAN entity buttons */}
                  {completionStats.fabrics > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/san/fabrics');
                      }}
                    >
                      View Fabrics
                    </button>
                  )}
                  {completionStats.switches > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/san/switches');
                      }}
                    >
                      View Switches
                    </button>
                  )}
                  {completionStats.aliases > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/san/aliases');
                      }}
                    >
                      View Aliases
                    </button>
                  )}
                  {completionStats.zones > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/san/zones');
                      }}
                    >
                      View Zones
                    </button>
                  )}

                  {/* Storage entity buttons */}
                  {((completionStats.storage_systems_created || 0) + (completionStats.storage_systems_updated || 0)) > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/storage/systems');
                      }}
                    >
                      View Storage Systems
                    </button>
                  )}
                  {((completionStats.volumes_created || 0) + (completionStats.volumes_updated || 0)) > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/storage/volumes');
                      }}
                    >
                      View Volumes
                    </button>
                  )}
                  {((completionStats.hosts_created || 0) + (completionStats.hosts_updated || 0)) > 0 && (
                    <button
                      className="nav-button primary"
                      onClick={() => {
                        setShowCompletionModal(false);
                        navigate('/storage/hosts');
                      }}
                    >
                      View Hosts
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scroll Navigation Buttons */}
      <ScrollButtons />
    </div>
  );
};

export default UniversalImporter;