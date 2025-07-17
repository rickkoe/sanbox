import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { useImportStatus } from "../context/ImportStatusContext";
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
} from "react-bootstrap";

const StorageInsightsImporter = () => {
  const { config } = useContext(ConfigContext);
  const { isImportRunning, currentImport, importProgress, startImport: startGlobalImport } = useImportStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [pollingActive, setPollingActive] = useState(false);
  const [taskProgress, setTaskProgress] = useState(null);
  const [historyModal, setHistoryModal] = useState({ show: false, imports: [] });

  // Check if customer has API credentials configured
  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && config?.customer?.insights_api_key
  );


  // Start new import
  const startImport = async () => {
    if (!hasInsightsCredentials) {
      setError('No Storage Insights credentials configured for this customer.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First save/update credentials in the new importer system
      await axios.post('/api/importer/credentials/', {
        customer_id: config.customer.id,
        insights_tenant: config.customer.insights_tenant,
        insights_api_key: config.customer.insights_api_key
      });

      // Then start the import
      const response = await axios.post('/api/importer/start/', {
        customer_id: config.customer.id
      });

      // Update global import status
      startGlobalImport(response.data);
      
      // Also update local state for immediate feedback
      setPollingActive(true);
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start import');
      setLoading(false);
    }
  };

  // Poll task progress (new async method)
  const pollTaskProgress = async (taskId, importId) => {
    let pollInterval;
    
    const pollProgress = async () => {
      try {
        const progressResponse = await axios.get(`/api/importer/progress/${taskId}/`);
        const progress = progressResponse.data;
        
        setTaskProgress(progress);
        
        // If task is complete, get final import status
        if (progress.state === 'SUCCESS' || progress.state === 'FAILURE') {
          clearInterval(pollInterval);
          setPollingActive(false);
          setLoading(false);
          
          // Get final import details (handled by global context)
          console.log('Import task completed');
          
          // Refresh import history
          fetchImportHistory();
        }
      } catch (err) {
        console.error('Error polling task progress:', err);
        // Fallback to regular status polling
        clearInterval(pollInterval);
        pollImportStatus(importId);
      }
    };

    // Start polling immediately and then every 2 seconds
    pollProgress();
    pollInterval = setInterval(pollProgress, 2000);

    // Stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setPollingActive(false);
      setLoading(false);
    }, 900000);
  };

  // Poll import status (fallback method)
  const pollImportStatus = async (importId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/importer/status/${importId}/`);
        const importData = response.data;
        
        // Import data is now handled by global context
        
        if (importData.status === 'completed' || importData.status === 'failed') {
          clearInterval(pollInterval);
          setPollingActive(false);
          setLoading(false);
          
          // Refresh import history
          fetchImportHistory();
        }
      } catch (err) {
        console.error('Error polling import status:', err);
        clearInterval(pollInterval);
        setPollingActive(false);
        setLoading(false);
      }
    }, 2000);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setPollingActive(false);
      setLoading(false);
    }, 600000);
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

  // Show import history modal
  const showImportHistory = () => {
    setHistoryModal({ show: true, imports: importHistory });
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
    const statusMap = {
      pending: "warning",
      running: "primary",
      completed: "success",
      failed: "danger",
    };
    return statusMap[status] || "secondary";
  };

  // Check if import is currently running (use global status)
  const isCurrentlyImporting = isImportRunning || currentImport?.status === 'running' || pollingActive;

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
              <div className="mb-4">
                <p className="mb-1">
                  Import storage data from IBM Storage Insights for:
                  <strong> {config?.customer?.name}</strong>
                </p>
                <small className="text-muted">
                  Tenant: {config?.customer?.insights_tenant}
                </small>
              </div>

              <Alert variant="info">
                <strong>Background Import System</strong> - This streamlined importer runs in the background and automatically imports all available storage systems, volumes, and hosts from IBM Storage Insights. You can navigate to other pages while the import is running.
              </Alert>

              {error && <Alert variant="danger">{error}</Alert>}

              {/* Current Import Status */}
              {currentImport && (
                <Card className="mb-3">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>Current Import Status</span>
                    <Badge bg={getStatusBadge(currentImport.status)}>
                      {currentImport.status.toUpperCase()}
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
                    
                    {(currentImport?.status === 'running' || isImportRunning) && (
                      <div className="mt-3">
                        {importProgress ? (
                          <>
                            <div className="mb-2">
                              <small className="text-muted">{importProgress.status}</small>
                            </div>
                            <ProgressBar 
                              animated 
                              now={(importProgress.current / importProgress.total) * 100} 
                              label={`${Math.round((importProgress.current / importProgress.total) * 100)}%`}
                            />
                          </>
                        ) : (
                          <ProgressBar animated now={100} label="Importing..." />
                        )}
                      </div>
                    )}
                    
                    {currentImport.status === 'completed' && (
                      <div className="mt-3">
                        <div className="row text-center">
                          <div className="col">
                            <strong>{currentImport.storage_systems_imported}</strong><br />
                            <small className="text-muted">Storage Systems</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.volumes_imported}</strong><br />
                            <small className="text-muted">Volumes</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.hosts_imported}</strong><br />
                            <small className="text-muted">Hosts</small>
                          </div>
                          <div className="col">
                            <strong>{currentImport.total_items_imported}</strong><br />
                            <small className="text-muted">Total Items</small>
                          </div>
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

              {/* Import Actions */}
              <div className="text-center py-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startImport}
                  disabled={isCurrentlyImporting}
                >
                  {isCurrentlyImporting ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Import Running...
                    </>
                  ) : (
                    'Start New Import'
                  )}
                </Button>
                
                {!isCurrentlyImporting && importHistory.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">
                      Last import: {formatDate(importHistory[0]?.started_at)}
                    </small>
                  </div>
                )}
              </div>

              {/* Recent Imports Summary */}
              {importHistory.length > 0 && (
                <Card>
                  <Card.Header>Recent Imports</Card.Header>
                  <Card.Body>
                    <Table striped bordered hover responsive size="sm">
                      <thead>
                        <tr>
                          <th>Started</th>
                          <th>Status</th>
                          <th>Duration</th>
                          <th>Systems</th>
                          <th>Volumes</th>
                          <th>Hosts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importHistory.slice(0, 5).map((importRecord) => (
                          <tr key={importRecord.id}>
                            <td>{formatDate(importRecord.started_at)}</td>
                            <td>
                              <Badge bg={getStatusBadge(importRecord.status)}>
                                {importRecord.status}
                              </Badge>
                            </td>
                            <td>{importRecord.duration || '-'}</td>
                            <td>{importRecord.storage_systems_imported}</td>
                            <td>{importRecord.volumes_imported}</td>
                            <td>{importRecord.hosts_imported}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    {importHistory.length > 5 && (
                      <div className="text-center mt-2">
                        <Button variant="outline-primary" size="sm" onClick={showImportHistory}>
                          View All ({importHistory.length} total)
                        </Button>
                      </div>
                    )}
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
                      <td>{importRecord.storage_systems_imported}</td>
                      <td>{importRecord.volumes_imported}</td>
                      <td>{importRecord.hosts_imported}</td>
                      <td><strong>{importRecord.total_items_imported}</strong></td>
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
    </div>
  );
};

export default StorageInsightsImporter;
