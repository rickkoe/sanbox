import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
import ImportLogger from "../components/ImportLogger";
import { useTheme } from "../context/ThemeContext";
import "../styles/storage-insights-importer.css";

const StorageInsightsImporter = () => {
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();
  const { isImportRunning, currentImport, importProgress, startImport: startGlobalImport, cancelImport } = useImportStatus();
  
  // State for the new selective import interface
  const [fetchingStorageSystems, setFetchingStorageSystems] = useState(false);
  const [availableStorageSystems, setAvailableStorageSystems] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importOptions, setImportOptions] = useState({
    storage_systems: true,
    volumes: true,
    hosts: true,
    // Future expansion: performance_data, alerts, etc.
  });
  
  // Legacy state
  const [selectedImport, setSelectedImport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [historyModal, setHistoryModal] = useState({ show: false, imports: [] });
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Check if customer has API credentials configured
  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && config?.customer?.insights_api_key
  );

  // Fetch available storage systems from Storage Insights
  const fetchStorageSystems = async () => {
    if (!hasInsightsCredentials) {
      setError('No Storage Insights credentials configured for this customer.');
      return;
    }

    setFetchingStorageSystems(true);
    setError(null);
    setAvailableStorageSystems([]);

    try {
      // First save/update credentials
      await axios.post('/api/importer/credentials/', {
        customer_id: config.customer.id,
        insights_tenant: config.customer.insights_tenant,
        insights_api_key: config.customer.insights_api_key
      });

      // Fetch available storage systems
      const response = await axios.post('/api/importer/fetch-systems/', {
        customer_id: config.customer.id
      });

      setAvailableStorageSystems(response.data.storage_systems || []);
      
      // Initialize all systems as selected by default
      const initialSelection = {};
      response.data.storage_systems.forEach(system => {
        initialSelection[system.serial] = true;
      });
      setSelectedSystems(initialSelection);
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch storage systems');
      setAvailableStorageSystems([]);
    } finally {
      setFetchingStorageSystems(false);
    }
  };

  // Start selective import
  const startSelectiveImport = async () => {
    const selectedSystemSerials = Object.keys(selectedSystems).filter(serial => selectedSystems[serial]);
    
    if (selectedSystemSerials.length === 0) {
      setError('Please select at least one storage system to import.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/importer/start-selective/', {
        customer_id: config.customer.id,
        selected_systems: selectedSystemSerials,
        import_options: importOptions
      });

      // Update global import status
      startGlobalImport(response.data);
      setLoading(false);
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start selective import');
      setLoading(false);
    }
  };

  // Toggle system selection
  const toggleSystemSelection = (serial) => {
    setSelectedSystems(prev => ({
      ...prev,
      [serial]: !prev[serial]
    }));
  };

  // Toggle all systems
  const toggleAllSystems = () => {
    const allSelected = Object.values(selectedSystems).every(selected => selected);
    const newSelection = {};
    availableStorageSystems.forEach(system => {
      newSelection[system.serial] = !allSelected;
    });
    setSelectedSystems(newSelection);
  };

  // Toggle import option
  const toggleImportOption = (option) => {
    setImportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  // Reset to fetch new systems
  const resetToFetch = () => {
    setAvailableStorageSystems([]);
    setSelectedSystems({});
    setError(null);
  };

  // Fetch import history
  const fetchImportHistory = async () => {
    if (!config?.customer?.id) return;
    
    try {
      const response = await axios.get('/api/importer/history/', {
        params: { customer_id: config.customer.id }
      });
      setImportHistory(response.data);
    } catch (err) {
      console.error('Error fetching import history:', err);
    }
  };

  // Load data on component mount and customer change
  useEffect(() => {
    if (config?.customer?.id) {
      fetchImportHistory();
    }
  }, [config?.customer?.id]);

  // Refresh import history when import status changes
  useEffect(() => {
    if (currentImport && currentImport.status !== 'running') {
      fetchImportHistory();
    }
  }, [currentImport?.status]);

  // Show import history modal
  const showImportHistory = () => {
    setHistoryModal({ show: true, imports: importHistory });
  };

  // Clear import history
  const clearImportHistory = async () => {
    if (!config?.customer?.id) {
      setError('No customer selected');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to clear all import history? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      const response = await axios.post('/api/importer/clear-history/', {
        customer_id: config.customer.id
      });

      if (response.data.deleted_count > 0) {
        await fetchImportHistory(); // Refresh the list
        setError(null);
        // Show success message briefly
        const originalError = error;
        setError(`Successfully cleared ${response.data.deleted_count} import records`);
        setTimeout(() => setError(originalError), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear import history');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString();
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    if (!status) return "secondary";
    
    const statusMap = {
      pending: "warning",
      running: "primary", 
      completed: "success",
      failed: "danger",
    };
    return statusMap[status.toLowerCase()] || "secondary";
  };

  // Cancel import handler
  const handleCancelImport = async () => {
    if (!currentImport?.id) {
      setError('No import to cancel');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to cancel the current import?');
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const result = await cancelImport(currentImport.id);
      
      if (result.success) {
        setError(null);
        await fetchImportHistory();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to cancel import: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isCurrentlyImporting = isImportRunning;
  const selectedSystemCount = Object.values(selectedSystems).filter(Boolean).length;
  const selectedOptionsCount = Object.values(importOptions).filter(Boolean).length;

  return (
    <div className={`storage-importer-container theme-${theme}`}>
      <div className="storage-importer-content">
        <div className="storage-importer-header">
          <div>
            <h1 className="storage-importer-title">IBM Storage Insights Importer</h1>
            <p className="storage-importer-description">Import and sync storage data from IBM Storage Insights</p>
          </div>
          <button className="importer-btn importer-btn-outline-light importer-btn-sm" onClick={showImportHistory}>
            View Import History
          </button>
        </div>

        <div className="importer-card">
          <div className="importer-card-body">
          {!hasInsightsCredentials ? (
            <div className="importer-alert importer-alert-warning">
              <h5 className="importer-alert-heading">Storage Insights not configured</h5>
              <p>
                This customer does not have IBM Storage Insights credentials
                configured. Please add the tenant ID and API key in the customer
                settings.
              </p>
              <hr />
              <div className="importer-flex-end">
                <a className="importer-btn importer-btn-outline-primary" href="/customers">
                  Go to Customer Settings
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="importer-info-section">
                <div>
                  <p className="importer-info-text">
                    Import storage data from IBM Storage Insights for:
                    <strong> {config?.customer?.name}</strong>
                  </p>
                  <small className="importer-info-muted">
                    Tenant: {config?.customer?.insights_tenant}
                  </small>
                </div>
                {config?.customer?.insights_tenant && (
                  <a
                    className="importer-btn importer-btn-outline-primary importer-btn-sm"
                    href={`https://insights.ibm.com/cui/${config.customer.insights_tenant}/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Go To Storage Insights
                  </a>
                )}
              </div>

              {error && <div className="importer-alert importer-alert-danger">{error}</div>}

              {/* Current Import Status */}
              {currentImport && (
                <div className="importer-card importer-mb-3">
                  <div className="importer-card-header">
                    <span>Current Import Status</span>
                    <span className={`importer-badge importer-badge-${getStatusBadge(currentImport.status)}`}>
                      {currentImport.status ? currentImport.status.toUpperCase() : 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="importer-card-body">
                    <div className="importer-grid-2">
                      <div>
                        <small className="importer-text-muted">Started:</small><br />
                        <span>{formatDate(currentImport.started_at)}</span>
                      </div>
                      {currentImport.completed_at && (
                        <div>
                          <small className="importer-text-muted">Completed:</small><br />
                          <span>{formatDate(currentImport.completed_at)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Show progress bar only when import is running */}
                    {(currentImport?.status === 'running' || isImportRunning) && (
                      <div className="importer-mt-3">
                        {importProgress ? (
                          <>
                            <div className="importer-mb-2">
                              <small className="importer-text-muted">{importProgress.status}</small>
                            </div>
                            {importProgress.state === 'PENDING' ? (
                              <div className="importer-progress">
                                <div className="importer-progress-bar animated striped variant-info" style={{ width: '100%' }}>
                                  Waiting to start...
                                </div>
                              </div>
                            ) : (
                              <div className="importer-progress">
                                <div className="importer-progress-bar animated" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}>
                                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="importer-progress">
                            <div className="importer-progress-bar animated" style={{ width: '100%' }}>
                              Initializing...
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="importer-mt-3 importer-flex-between">
                      <button
                        className="importer-btn importer-btn-outline-info importer-btn-sm"
                        onClick={() => {
                          setSelectedImport(null);
                          setShowLogsModal(true);
                        }}
                      >
                        View Logs
                      </button>
                      {(currentImport?.status === 'running' || isImportRunning) && (
                        <button
                          className="importer-btn importer-btn-outline-danger importer-btn-sm"
                          onClick={handleCancelImport}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <span className="importer-spinner importer-spinner-sm"></span>
                              <span>Cancelling...</span>
                            </>
                          ) : (
                            'Cancel Import'
                          )}
                        </button>
                      )}
                    </div>
                    
                    {currentImport.status === 'completed' && (
                      <div className="importer-mt-3">
                        <div className="importer-stats">
                          <div className="importer-stat">
                            <strong className="importer-stat-value">{currentImport.storage_systems_imported || 0}</strong>
                            <small className="importer-stat-label">Storage Systems</small>
                          </div>
                          <div className="importer-stat">
                            <strong className="importer-stat-value">{currentImport.volumes_imported || 0}</strong>
                            <small className="importer-stat-label">Volumes</small>
                          </div>
                          <div className="importer-stat">
                            <strong className="importer-stat-value">{currentImport.hosts_imported || 0}</strong>
                            <small className="importer-stat-label">Hosts</small>
                          </div>
                          <div className="importer-stat">
                            <strong className="importer-stat-value">{currentImport.total_items_imported || 0}</strong>
                            <small className="importer-stat-label">Total Items</small>
                          </div>
                        </div>
                        <div className="importer-text-center importer-mt-3">
                          <button
                            className="importer-btn importer-btn-success"
                            onClick={() => navigate('/storage/systems')}
                          >
                            View Storage Systems
                          </button>
                        </div>
                      </div>
                    )}

                    {currentImport.status === 'failed' && currentImport.error_message && (
                      <div className="importer-alert importer-alert-danger importer-mt-3">
                        <strong>Error:</strong> {currentImport.error_message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Import Interface */}
              {!isCurrentlyImporting && (
                <>
                  {availableStorageSystems.length === 0 ? (
                    // Step 1: Fetch Storage Systems
                    <div className="importer-card importer-mb-4">
                      <div className="importer-card-header">
                        <h6 className="importer-mb-0">Step 1: Discover Storage Systems</h6>
                      </div>
                      <div className="importer-card-body">
                        <p className="importer-mb-3">
                          First, we'll connect to IBM Storage Insights to discover available storage systems.
                        </p>
                        <button
                          className="importer-btn importer-btn-primary"
                          onClick={fetchStorageSystems}
                          disabled={fetchingStorageSystems}
                        >
                          {fetchingStorageSystems ? (
                            <>
                              <span className="importer-spinner importer-spinner-sm"></span>
                              Fetching Storage Systems...
                            </>
                          ) : (
                            'Fetch Storage Systems'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Step 2: Select Systems and Options
                    <>
                      <div className="importer-card importer-mb-4">
                        <div className="importer-card-header">
                          <h6 className="importer-mb-0">Step 2: Select Storage Systems ({selectedSystemCount} of {availableStorageSystems.length} selected)</h6>
                          <button className="importer-btn importer-btn-outline-secondary importer-btn-sm" onClick={resetToFetch}>
                            Fetch Different Systems
                          </button>
                        </div>
                        <div className="importer-card-body">
                          <div className="importer-mb-3">
                            <button
                              className="importer-btn importer-btn-outline-primary importer-btn-sm"
                              onClick={toggleAllSystems}
                            >
                              {Object.values(selectedSystems).every(selected => selected) ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          
                          <table className="importer-table">
                            <thead>
                              <tr>
                                <th width="50">Select</th>
                                <th>Storage System</th>
                                <th>Serial Number</th>
                                <th>Model</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableStorageSystems.map((system) => (
                                <tr key={system.serial}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      className="importer-checkbox-input"
                                      checked={selectedSystems[system.serial] || false}
                                      onChange={() => toggleSystemSelection(system.serial)}
                                    />
                                  </td>
                                  <td><strong>{system.name}</strong></td>
                                  <td><code>{system.serial}</code></td>
                                  <td>{system.model}</td>
                                  <td>
                                    <span className={`importer-badge importer-badge-${system.status === 'online' ? 'success' : 'warning'}`}>
                                      {system.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="importer-card importer-mb-4">
                        <div className="importer-card-header">
                          <h6 className="importer-mb-0">Step 3: Choose What to Import ({selectedOptionsCount} options selected)</h6>
                        </div>
                        <div className="importer-card-body">
                          <div className="importer-grid-3">
                            <div>
                              <div className="importer-checkbox">
                                <input
                                  type="checkbox"
                                  className="importer-checkbox-input"
                                  id="import-storage-systems"
                                  checked={importOptions.storage_systems}
                                  onChange={() => toggleImportOption('storage_systems')}
                                />
                                <label className="importer-checkbox-label" htmlFor="import-storage-systems">
                                  Storage Systems
                                </label>
                              </div>
                              <small className="importer-checkbox-help">Import basic storage system information</small>
                            </div>
                            <div>
                              <div className="importer-checkbox">
                                <input
                                  type="checkbox"
                                  className="importer-checkbox-input"
                                  id="import-volumes"
                                  checked={importOptions.volumes}
                                  onChange={() => toggleImportOption('volumes')}
                                />
                                <label className="importer-checkbox-label" htmlFor="import-volumes">
                                  Volumes
                                </label>
                              </div>
                              <small className="importer-checkbox-help">Import volume and LUN data</small>
                            </div>
                            <div>
                              <div className="importer-checkbox">
                                <input
                                  type="checkbox"
                                  className="importer-checkbox-input"
                                  id="import-hosts"
                                  checked={importOptions.hosts}
                                  onChange={() => toggleImportOption('hosts')}
                                />
                                <label className="importer-checkbox-label" htmlFor="import-hosts">
                                  Hosts
                                </label>
                              </div>
                              <small className="importer-checkbox-help">Import host connection information</small>
                            </div>
                          </div>

                          {/* Future expansion area */}
                          <div className="importer-alert importer-alert-info importer-mt-3 importer-mb-0">
                            <small>
                              <strong>Coming Soon:</strong> Performance data, alerts, capacity forecasting, and more import options will be available in future updates.
                            </small>
                          </div>
                        </div>
                      </div>

                      <div className="importer-center">
                        <button
                          className="importer-btn importer-btn-success importer-btn-lg"
                          onClick={startSelectiveImport}
                          disabled={selectedSystemCount === 0 || selectedOptionsCount === 0 || loading}
                        >
                          {loading ? (
                            <>
                              <span className="importer-spinner importer-spinner-sm"></span>
                              Starting Import...
                            </>
                          ) : (
                            `Import ${selectedSystemCount} Storage System${selectedSystemCount !== 1 ? 's' : ''}`
                          )}
                        </button>

                        {selectedSystemCount === 0 && (
                          <div className="importer-mt-2">
                            <small style={{ color: 'var(--error-text)' }}>Please select at least one storage system</small>
                          </div>
                        )}

                        {selectedOptionsCount === 0 && (
                          <div className="importer-mt-2">
                            <small style={{ color: 'var(--error-text)' }}>Please select at least one import option</small>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Recent Imports Summary */}
              {importHistory.length > 0 && (
                <div className="importer-card">
                  <div className="importer-card-header">
                    <span>Recent Imports</span>
                    <button
                      className="importer-btn importer-btn-outline-danger importer-btn-sm"
                      onClick={clearImportHistory}
                    >
                      Clear History
                    </button>
                  </div>
                  <div className="importer-card-body">
                    <table className="importer-table">
                      <thead>
                        <tr>
                          <th>Started</th>
                          <th>Status</th>
                          <th>Systems</th>
                          <th>Volumes</th>
                          <th>Hosts</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importHistory.slice(0, 3).map((importRecord) => (
                          <tr key={importRecord.id}>
                            <td>{formatDate(importRecord.started_at)}</td>
                            <td>
                              <span className={`importer-badge importer-badge-${getStatusBadge(importRecord.status)}`}>
                                {importRecord.status}
                              </span>
                            </td>
                            <td>{importRecord.storage_systems_imported || 0}</td>
                            <td>{importRecord.volumes_imported || 0}</td>
                            <td>{importRecord.hosts_imported || 0}</td>
                            <td>
                              <button
                                className="importer-btn importer-btn-outline-info importer-btn-sm"
                                onClick={() => {
                                  setSelectedImport(importRecord);
                                  setShowLogsModal(true);
                                }}
                              >
                                Logs
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* Import History Modal */}
      {historyModal.show && (
        <div className="importer-modal-overlay" onClick={() => setHistoryModal({ show: false, imports: [] })}>
          <div className="importer-modal importer-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="importer-modal-header">
              <h5 className="importer-modal-title">Import History</h5>
              <button
                className="importer-modal-close"
                onClick={() => setHistoryModal({ show: false, imports: [] })}
              >
                &times;
              </button>
            </div>
            <div className="importer-modal-body">
            {historyModal.imports.length > 0 ? (
              <table className="importer-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Storage Systems</th>
                    <th>Volumes</th>
                    <th>Hosts</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal.imports.map((importRecord) => (
                    <tr key={importRecord.id}>
                      <td>{formatDate(importRecord.started_at)}</td>
                      <td>
                        <span className={`importer-badge importer-badge-${getStatusBadge(importRecord.status)}`}>
                          {importRecord.status}
                        </span>
                      </td>
                      <td>{importRecord.duration || '-'}</td>
                      <td>{importRecord.storage_systems_imported || 0}</td>
                      <td>{importRecord.volumes_imported || 0}</td>
                      <td>{importRecord.hosts_imported || 0}</td>
                      <td><strong>{importRecord.total_items_imported || 0}</strong></td>
                      <td>
                        <button
                          className="importer-btn importer-btn-outline-info importer-btn-sm"
                          onClick={() => {
                            setSelectedImport(importRecord);
                            setShowLogsModal(true);
                            setHistoryModal({ show: false, imports: [] });
                          }}
                        >
                          Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="importer-empty-state">
                <p>No import history found.</p>
              </div>
            )}
            </div>
            <div className="importer-modal-footer">
              <button
                className="importer-btn importer-btn-outline-danger"
                onClick={async () => {
                  await clearImportHistory();
                  setHistoryModal({ show: false, imports: [] });
                }}
              >
                Clear History
              </button>
              <button
                className="importer-btn importer-btn-outline-secondary"
                onClick={() => setHistoryModal({ show: false, imports: [] })}
              >
                Close
              </button>
              <button className="importer-btn importer-btn-primary" onClick={fetchImportHistory}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Logs Modal */}
      <ImportLogger 
        importId={selectedImport?.id || currentImport?.id}
        isRunning={isImportRunning || currentImport?.status === 'running'}
        show={showLogsModal}
        onHide={() => {
          setShowLogsModal(false);
          setSelectedImport(null);
        }}
      />
    </div>
  );
};

export default StorageInsightsImporter;