import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
import ImportLogger from "../components/ImportLogger";
import {
  Form,
  Button,
  Card,
  Alert,
  Spinner,
  Table,
  Modal,
  Badge,
  ProgressBar,
  Row,
  Col,
} from "react-bootstrap";

const StorageInsightsImporter = () => {
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
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
    <div className="container mt-4">
      <Card className="shadow-sm">
        <Card.Header
          as="h5"
          className="bg-primary text-white d-flex justify-content-between align-items-center"
        >
          <span>IBM Storage Insights Importer</span>
          <Button variant="outline-light" size="sm" onClick={showImportHistory}>
            View Import History
          </Button>
        </Card.Header>
        <Card.Body>
          {!hasInsightsCredentials ? (
            <Alert variant="warning">
              <Alert.Heading>Storage Insights not configured</Alert.Heading>
              <p>
                This customer does not have IBM Storage Insights credentials
                configured. Please add the tenant ID and API key in the customer
                settings.
              </p>
              <hr />
              <div className="d-flex justify-content-end">
                <Button variant="outline-primary" href="/customers">
                  Go to Customer Settings
                </Button>
              </div>
            </Alert>
          ) : (
            <>
              <div className="mb-4 d-flex justify-content-between align-items-center">
                <div>
                  <p className="mb-1">
                    Import storage data from IBM Storage Insights for:
                    <strong> {config?.customer?.name}</strong>
                  </p>
                  <small className="text-muted">
                    Tenant: {config?.customer?.insights_tenant}
                  </small>
                </div>
                {config?.customer?.insights_tenant && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    href={`https://insights.ibm.com/cui/${config.customer.insights_tenant}/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Go To Storage Insights
                  </Button>
                )}
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              {/* Current Import Status */}
              {currentImport && (
                <Card className="mb-3">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Current Import Status</span>
                    <Badge bg={getStatusBadge(currentImport.status)}>
                      {currentImport.status ? currentImport.status.toUpperCase() : 'UNKNOWN'}
                    </Badge>
                  </Card.Header>
                  <Card.Body>
                    <div className="row">
                      <div className="col-md-6">
                        <small className="text-muted">Started:</small><br />
                        <span>{formatDate(currentImport.started_at)}</span>
                      </div>
                      {currentImport.completed_at && (
                        <div className="col-md-6">
                          <small className="text-muted">Completed:</small><br />
                          <span>{formatDate(currentImport.completed_at)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Show progress bar only when import is running */}
                    {(currentImport?.status === 'running' || isImportRunning) && (
                      <div className="mt-3">
                        {importProgress ? (
                          <>
                            <div className="mb-2">
                              <small className="text-muted">{importProgress.status}</small>
                            </div>
                            {importProgress.state === 'PENDING' ? (
                              <ProgressBar 
                                animated 
                                striped
                                variant="info"
                                now={100} 
                                label="Waiting to start..."
                              />
                            ) : (
                              <ProgressBar 
                                animated 
                                now={(importProgress.current / importProgress.total) * 100} 
                                label={`${Math.round((importProgress.current / importProgress.total) * 100)}%`}
                              />
                            )}
                          </>
                        ) : (
                          <ProgressBar animated now={100} label="Initializing..." />
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 d-flex justify-content-between">
                      <Button 
                        variant="outline-info" 
                        size="sm"
                        onClick={() => {
                          setSelectedImport(null);
                          setShowLogsModal(true);
                        }}
                      >
                        View Logs
                      </Button>
                      {(currentImport?.status === 'running' || isImportRunning) && (
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={handleCancelImport}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Spinner as="span" animation="border" size="sm" role="status" />
                              <span className="ms-1">Cancelling...</span>
                            </>
                          ) : (
                            'Cancel Import'
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {currentImport.status === 'completed' && (
                      <div className="mt-3">
                        <div className="row text-center">
                          <div className="col">
                            <strong>{currentImport.storage_systems_imported || 0}</strong><br />
                            <small className="text-muted">Storage Systems</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.volumes_imported || 0}</strong><br />
                            <small className="text-muted">Volumes</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.hosts_imported || 0}</strong><br />
                            <small className="text-muted">Hosts</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.total_items_imported || 0}</strong><br />
                            <small className="text-muted">Total Items</small>
                          </div>
                        </div>
                        <div className="text-center mt-3">
                          <Button
                            variant="success"
                            onClick={() => navigate('/storage')}
                          >
                            View Storage Systems
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {currentImport.status === 'failed' && currentImport.error_message && (
                      <Alert variant="danger" className="mt-3">
                        <strong>Error:</strong> {currentImport.error_message}
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              )}

              {/* Main Import Interface */}
              {!isCurrentlyImporting && (
                <>
                  {availableStorageSystems.length === 0 ? (
                    // Step 1: Fetch Storage Systems
                    <Card className="mb-4">
                      <Card.Header>
                        <h6 className="mb-0">Step 1: Discover Storage Systems</h6>
                      </Card.Header>
                      <Card.Body>
                        <p className="mb-3">
                          First, we'll connect to IBM Storage Insights to discover available storage systems.
                        </p>
                        <Button
                          variant="primary"
                          onClick={fetchStorageSystems}
                          disabled={fetchingStorageSystems}
                        >
                          {fetchingStorageSystems ? (
                            <>
                              <Spinner as="span" animation="border" size="sm" className="me-2" />
                              Fetching Storage Systems...
                            </>
                          ) : (
                            'Fetch Storage Systems'
                          )}
                        </Button>
                      </Card.Body>
                    </Card>
                  ) : (
                    // Step 2: Select Systems and Options
                    <>
                      <Card className="mb-4">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Step 2: Select Storage Systems ({selectedSystemCount} of {availableStorageSystems.length} selected)</h6>
                          <Button variant="outline-secondary" size="sm" onClick={resetToFetch}>
                            Fetch Different Systems
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <div className="mb-3">
                            <Button 
                              variant="outline-primary" 
                              size="sm" 
                              onClick={toggleAllSystems}
                            >
                              {Object.values(selectedSystems).every(selected => selected) ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                          
                          <Table striped hover responsive>
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
                                    <Form.Check
                                      type="checkbox"
                                      checked={selectedSystems[system.serial] || false}
                                      onChange={() => toggleSystemSelection(system.serial)}
                                    />
                                  </td>
                                  <td><strong>{system.name}</strong></td>
                                  <td><code>{system.serial}</code></td>
                                  <td>{system.model}</td>
                                  <td>
                                    <Badge bg={system.status === 'online' ? 'success' : 'warning'}>
                                      {system.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>

                      <Card className="mb-4">
                        <Card.Header>
                          <h6 className="mb-0">Step 3: Choose What to Import ({selectedOptionsCount} options selected)</h6>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={4}>
                              <Form.Check
                                type="checkbox"
                                label="Storage Systems"
                                checked={importOptions.storage_systems}
                                onChange={() => toggleImportOption('storage_systems')}
                              />
                              <small className="text-muted">Import basic storage system information</small>
                            </Col>
                            <Col md={4}>
                              <Form.Check
                                type="checkbox"
                                label="Volumes"
                                checked={importOptions.volumes}
                                onChange={() => toggleImportOption('volumes')}
                              />
                              <small className="text-muted">Import volume and LUN data</small>
                            </Col>
                            <Col md={4}>
                              <Form.Check
                                type="checkbox"
                                label="Hosts"
                                checked={importOptions.hosts}
                                onChange={() => toggleImportOption('hosts')}
                              />
                              <small className="text-muted">Import host connection information</small>
                            </Col>
                          </Row>
                          
                          {/* Future expansion area */}
                          <Alert variant="info" className="mt-3 mb-0">
                            <small>
                              <strong>Coming Soon:</strong> Performance data, alerts, capacity forecasting, and more import options will be available in future updates.
                            </small>
                          </Alert>
                        </Card.Body>
                      </Card>

                      <div className="text-center py-3">
                        <Button
                          variant="success"
                          size="lg"
                          onClick={startSelectiveImport}
                          disabled={selectedSystemCount === 0 || selectedOptionsCount === 0 || loading}
                        >
                          {loading ? (
                            <>
                              <Spinner as="span" animation="border" size="sm" className="me-2" />
                              Starting Import...
                            </>
                          ) : (
                            `Import ${selectedSystemCount} Storage System${selectedSystemCount !== 1 ? 's' : ''}`
                          )}
                        </Button>
                        
                        {selectedSystemCount === 0 && (
                          <div className="mt-2">
                            <small className="text-danger">Please select at least one storage system</small>
                          </div>
                        )}
                        
                        {selectedOptionsCount === 0 && (
                          <div className="mt-2">
                            <small className="text-danger">Please select at least one import option</small>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Recent Imports Summary */}
              {importHistory.length > 0 && (
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Recent Imports</span>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={clearImportHistory}
                    >
                      Clear History
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    <Table striped bordered hover responsive size="sm">
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
                              <Badge bg={getStatusBadge(importRecord.status)}>
                                {importRecord.status}
                              </Badge>
                            </td>
                            <td>{importRecord.storage_systems_imported || 0}</td>
                            <td>{importRecord.volumes_imported || 0}</td>
                            <td>{importRecord.hosts_imported || 0}</td>
                            <td>
                              <Button 
                                variant="outline-info" 
                                size="sm"
                                onClick={() => {
                                  setSelectedImport(importRecord);
                                  setShowLogsModal(true);
                                }}
                              >
                                Logs
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Import History Modal */}
      {historyModal.show && (
        <Modal
          show
          onHide={() => setHistoryModal({ show: false, imports: [] })}
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Import History</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {historyModal.imports.length > 0 ? (
              <Table striped bordered hover responsive size="sm">
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
                        <Badge bg={getStatusBadge(importRecord.status)}>
                          {importRecord.status}
                        </Badge>
                      </td>
                      <td>{importRecord.duration || '-'}</td>
                      <td>{importRecord.storage_systems_imported || 0}</td>
                      <td>{importRecord.volumes_imported || 0}</td>
                      <td>{importRecord.hosts_imported || 0}</td>
                      <td><strong>{importRecord.total_items_imported || 0}</strong></td>
                      <td>
                        <Button 
                          variant="outline-info" 
                          size="sm"
                          onClick={() => {
                            setSelectedImport(importRecord);
                            setShowLogsModal(true);
                            setHistoryModal({ show: false, imports: [] });
                          }}
                        >
                          Logs
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-3 text-muted">
                <p>No import history found.</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-danger"
              onClick={async () => {
                await clearImportHistory();
                setHistoryModal({ show: false, imports: [] });
              }}
            >
              Clear History
            </Button>
            <Button
              variant="secondary"
              onClick={() => setHistoryModal({ show: false, imports: [] })}
            >
              Close
            </Button>
            <Button variant="primary" onClick={fetchImportHistory}>
              Refresh
            </Button>
          </Modal.Footer>
        </Modal>
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