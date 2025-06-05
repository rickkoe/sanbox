import React, { useState, useContext } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { Form, Button, Card, Alert, Spinner, Table, Modal, Badge } from "react-bootstrap";

const StorageInsightsImporter = () => {
  const { config } = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageSystemsData, setStorageSystemsData] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [credentialsId, setCredentialsId] = useState(null);
  const [summaryModal, setSummaryModal] = useState({ show: false, results: [] });
  const [jobsModal, setJobsModal] = useState({ show: false, jobs: [] });

  // Check if customer has Insights credentials
  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && 
    config?.customer?.insights_api_key
  );

  // Fetch storage systems from Enhanced Insights API
  const fetchStorageSystems = async () => {
    if (!hasInsightsCredentials) {
      setError("No Storage Insights credentials configured for this customer.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use enhanced API endpoints
      const authResponse = await axios.post(
        "http://127.0.0.1:8000/api/insights/enhanced/auth/", 
        {
          tenant: config.customer.insights_tenant,
          api_key: config.customer.insights_api_key
        }
      );
      
      setCredentialsId(authResponse.data.credentials_id);
      
      // Fetch storage systems using credentials ID
      const storageResponse = await axios.post(
        "http://127.0.0.1:8000/api/insights/enhanced/storage-systems/",
        { 
          credentials_id: authResponse.data.credentials_id
        }
      );
      
      const systems = storageResponse.data.resources || [];
      setStorageSystemsData(systems);
      
      // Initialize selection state
      const initialSelections = {};
      systems.forEach(system => {
        initialSelections[system.storage_system_id] = false;
      });
      setSelectedSystems(initialSelections);
      
    } catch (err) {
      console.error("Error fetching from Storage Insights:", err);
      setError(
        err.response?.data?.message || 
        "Failed to connect to IBM Storage Insights. Please check credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle checkbox changes
  const handleCheckboxChange = (systemId) => {
    setSelectedSystems(prev => ({
      ...prev,
      [systemId]: !prev[systemId]
    }));
  };

  // Select/deselect all systems (only those with storage_type === "block")
  const handleSelectAll = (selectAll) => {
    const newSelections = {};
    storageSystemsData.forEach(system => {
      if (system.storage_type === "block") {
        newSelections[system.storage_system_id] = selectAll;
      }
    });
    setSelectedSystems(newSelections);
  };

  // Import selected storage systems only
  const handleImportStorageOnly = async () => {
    const selectedSystemIds = Object.entries(selectedSystems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);

    if (selectedSystemIds.length === 0) {
      setSummaryModal({
        show: true,
        results: [
          {
            name: "No storage system selected",
            error: "Please select at least one storage system to import."
          }
        ]
      });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/insights/enhanced/import/start/", {
        tenant: config.customer.insights_tenant,
        api_key: config.customer.insights_api_key,
        customer_id: config.customer.id,
        import_type: 'storage_only',
        selected_systems: selectedSystemIds,
        async: true
      });

      if (response.data.async) {
        // Async response - show job started message
        setSummaryModal({
          show: true,
          results: [
            {
              name: `Storage Import Job Started`,
              error: false,
              jobId: response.data.job_id,
              taskId: response.data.task_id,
              asyncJob: true,
              message: response.data.message
            }
          ]
        });
        
        // Start polling for job status
        pollJobStatus(response.data.job_id, response.data.task_id);
      } else {
        // Sync response (fallback)
        setSummaryModal({
          show: true,
          results: [
            {
              name: `Storage Import Job ${response.data.job_id}`,
              error: false,
              jobId: response.data.job_id,
              processed: response.data.results.processed,
              successful: response.data.results.successful,
              errors: response.data.results.errors
            }
          ]
        });
      }
      
      handleSelectAll(false);
    } catch (err) {
      console.error("Import failed:", err);
      setSummaryModal({
        show: true,
        results: [
          {
            name: "Storage import failed",
            error: err.response?.data?.message || "Failed to import storage systems."
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  // Import selected storage systems with volumes and hosts
  const handleImportWithVolumesAndHosts = async () => {
    const selectedSystemIds = Object.entries(selectedSystems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);

    if (selectedSystemIds.length === 0) {
      setImportStatus({
        type: "warning",
        message: "Please select at least one storage system to import."
      });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/insights/enhanced/import/start/", {
        tenant: config.customer.insights_tenant,
        api_key: config.customer.insights_api_key,
        customer_id: config.customer.id,
        import_type: 'full',
        selected_systems: selectedSystemIds,
        async: true
      });

      if (response.data.async) {
        setSummaryModal({
          show: true,
          results: [
            {
              name: `Full Import Job Started`,
              error: false,
              jobId: response.data.job_id,
              taskId: response.data.task_id,
              asyncJob: true,
              message: response.data.message
            }
          ]
        });
        
        // Start polling for job status
        pollJobStatus(response.data.job_id, response.data.task_id);
      } else {
        setSummaryModal({
          show: true,
          results: [
            {
              name: `Full Import Job ${response.data.job_id}`,
              error: false,
              jobId: response.data.job_id,
              processed: response.data.results.processed,
              successful: response.data.results.successful,
              errors: response.data.results.errors
            }
          ]
        });
      }
      
      handleSelectAll(false);
    } catch (err) {
      console.error("Import failed:", err);
      setImportStatus({
        type: "danger",
        message: err.response?.data?.message || "Failed to import storage systems."
      });
    } finally {
      setLoading(false);
    }
  };

  // Poll job status for async imports
  const pollJobStatus = async (jobId, taskId) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await axios.get(`http://127.0.0.1:8000/api/insights/tasks/${taskId}/status/`);
        const taskStatus = statusResponse.data;
        
        if (taskStatus.state === 'SUCCESS') {
          clearInterval(pollInterval);
          
          // Get final job details
          const jobResponse = await axios.get(`http://127.0.0.1:8000/api/insights/jobs/${jobId}/`);
          const jobData = jobResponse.data;
          
          // Update summary modal with final results
          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job Completed`,
                error: false,
                jobId: jobData.job_id,
                processed: jobData.processed_items,
                successful: jobData.success_count,
                errors: jobData.error_count,
                asyncCompleted: true
              }
            ]
          });
        } else if (taskStatus.state === 'FAILURE') {
          clearInterval(pollInterval);
          
          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job Failed`,
                error: taskStatus.error || 'Unknown error',
                jobId: jobId,
                asyncFailed: true
              }
            ]
          });
        }
        // For PENDING or PROGRESS, keep polling
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
    
    // Stop polling after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  };

  // Fetch import jobs
  const fetchImportJobs = async () => {
    try {
      const response = await axios.get("http://127.0.0.1:8000/api/insights/jobs/");
      setJobsModal({ show: true, jobs: response.data });
    } catch (error) {
      console.error("Failed to fetch import jobs:", error);
    }
  };

  // Create a formatted display of storage type
  const formatStorageType = (type) => {
    const typeMap = {
      "2145": "FlashSystem",
      "2107": "DS8000",
      "2076": "Storwize",
    };
    
    return typeMap[type] || type;
  };

  // Format job status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': 'warning',
      'running': 'primary',
      'completed': 'success',
      'failed': 'danger',
      'cancelled': 'secondary'
    };
    return statusMap[status] || 'secondary';
  };
  
  return (
    <div className="container mt-4">
      <Card className="shadow-sm">
        <Card.Header as="h5" className="bg-primary text-white d-flex justify-content-between align-items-center">
          <span>IBM Storage Insights Importer (Enhanced)</span>
          <Button variant="outline-light" size="sm" onClick={fetchImportJobs}>
            View Import Jobs
          </Button>
        </Card.Header>
        <Card.Body>
          {!hasInsightsCredentials ? (
            <Alert variant="warning">
              <Alert.Heading>Storage Insights not configured</Alert.Heading>
              <p>
                This customer does not have IBM Storage Insights credentials configured.
                Please add the tenant ID and API key in the customer settings.
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
              <p className="mb-4">
                This tool connects to IBM Storage Insights to import storage systems for the current customer: 
                <strong> {config?.customer?.name}</strong>
              </p>
              <p>
                <a href="https://insights.ibm.com/restapi/docs/" target="_blank" rel="noopener noreferrer">
                  View IBM Storage Insights REST API Swagger Docs
                </a>
              </p>
              
              <Alert variant="info">
                <strong>Enhanced Import System</strong> - This version uses the new enhanced import system with 
                job tracking, better error handling, and automatic retry capabilities.
              </Alert>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {importStatus && <Alert variant={importStatus.type}>{importStatus.message}</Alert>}
              
              <div className="d-flex justify-content-between mb-3">
                <Button 
                  variant="primary" 
                  onClick={fetchStorageSystems} 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" /> Loading...
                    </>
                  ) : (
                    "Fetch Storage Systems"
                  )}
                </Button>
                
                <div>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => handleSelectAll(true)} 
                    className="me-2"
                    disabled={loading || storageSystemsData.length === 0}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => handleSelectAll(false)}
                    disabled={loading || storageSystemsData.length === 0}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              {storageSystemsData.filter(system => system.storage_type === "block").length > 0 ? (
                <>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>Select</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Model</th>
                        <th>Serial Number</th>
                        <th>Storage System ID</th>
                        <th>SI Probe Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageSystemsData
                        .filter(system => system.storage_type === "block")
                        .map(system => {
                        return (
                          <tr key={system.storage_system_id}>
                            <td className="text-center">
                              <Form.Check
                                type="checkbox"
                                checked={selectedSystems[system.storage_system_id] || false}
                                onChange={() => handleCheckboxChange(system.storage_system_id)}
                                id={`system-${system.storage_system_id}`}
                              />
                            </td>
                            <td>{system.name}</td>
                            <td>{formatStorageType(system.type)}</td>
                            <td>{system.model}</td>
                            <td>{system.serial_number}</td>
                            <td>{system.storage_system_id}</td>
                            <td>
                              <span className={`badge bg-${system.probe_status === "successful" ? "success" : "warning"}`}>
                                {system.probe_status || "Unknown"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  
                  <div className="d-flex justify-content-end mt-3">
                    <Button 
                      variant="success" 
                      onClick={handleImportStorageOnly}
                      disabled={loading || Object.values(selectedSystems).every(v => !v)}
                      className="me-2"
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" /> Importing...
                        </>
                      ) : (
                        "Import Storage Systems Only"
                      )}
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleImportWithVolumesAndHosts}
                      disabled={loading || Object.values(selectedSystems).every(v => !v)}
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" /> Importing...
                        </>
                      ) : (
                        "Import with Volumes & Hosts"
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                !loading && (
                  <div className="text-center py-5 text-muted">
                    <p>No storage systems found. Click "Fetch Storage Systems" to retrieve data from IBM Storage Insights.</p>
                  </div>
                )
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Summary Modal */}
      {summaryModal.show && (
        <Modal show onHide={() => setSummaryModal({ show: false, results: [] })}>
          <Modal.Header closeButton>
            <Modal.Title>Import Summary</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ul>
              {summaryModal.results.map((result, idx) => (
                <li key={idx}>
                  <strong>{result.name}</strong>
                  {result.jobId && (
                    <div>
                      <Badge bg="info">Job ID: {result.jobId}</Badge>
                      {result.processed && (
                        <div className="mt-1">
                          <small className="text-muted">
                            Processed: {result.processed}, Successful: {result.successful}, Errors: {result.errors}
                          </small>
                        </div>
                      )}
                      {result.asyncJob && (
                        <div className="mt-1">
                          <small className="text-info">Job started successfully. Results will update automatically.</small>
                        </div>
                      )}
                      {result.asyncCompleted && (
                        <div className="mt-1">
                          <small className="text-success">Job completed successfully!</small>
                        </div>
                      )}
                      {result.asyncFailed && (
                        <div className="mt-1">
                          <small className="text-danger">Job failed. Check logs for details.</small>
                        </div>
                      )}
                    </div>
                  )}
                  {result.error && typeof result.error === 'string' ? (
                    <div className="mt-1">
                      <Badge bg="danger">Error: {result.error}</Badge>
                    </div>
                  ) : result.error ? (
                    <div className="mt-1">
                      <Badge bg="danger">Error occurred</Badge>
                    </div>
                  ) : result.jobId ? null : (
                    <div className="mt-1">
                      <Badge bg="success">Success</Badge>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setSummaryModal({ show: false, results: [] })}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Jobs Modal */}
      {jobsModal.show && (
        <Modal show onHide={() => setJobsModal({ show: false, jobs: [] })} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Import Jobs History</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {jobsModal.jobs.length > 0 ? (
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Started</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsModal.jobs.map((job, idx) => (
                    <tr key={idx}>
                      <td>
                        <code>{job.job_id.split('-')[0]}...</code>
                      </td>
                      <td>
                        <Badge bg="secondary">{job.job_type}</Badge>
                      </td>
                      <td>
                        <Badge bg={getStatusBadge(job.status)}>{job.status}</Badge>
                      </td>
                      <td>
                        {job.total_items > 0 ? (
                          <div>
                            <div className="progress" style={{ height: '10px' }}>
                              <div 
                                className="progress-bar" 
                                role="progressbar" 
                                style={{ width: `${job.progress_percentage || 0}%` }}
                              />
                            </div>
                            <small>{job.success_count}/{job.total_items}</small>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <small>{new Date(job.created_at).toLocaleString()}</small>
                      </td>
                      <td>
                        <small>{job.duration || '-'}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-3 text-muted">
                <p>No import jobs found.</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setJobsModal({ show: false, jobs: [] })}>
              Close
            </Button>
            <Button variant="primary" onClick={fetchImportJobs}>
              Refresh
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default StorageInsightsImporter;