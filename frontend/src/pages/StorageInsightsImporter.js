import React, { useState, useContext } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import {
  Form,
  Button,
  Card,
  Alert,
  Spinner,
  Table,
  Modal,
  Badge,
} from "react-bootstrap";

const StorageInsightsImporter = () => {
  const API_URL = process.env.REACT_APP_API_URL || '';
  const { config } = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageSystemsData, setStorageSystemsData] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [summaryModal, setSummaryModal] = useState({
    show: false,
    results: [],
  });
  const [jobsModal, setJobsModal] = useState({ show: false, jobs: [] });

  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && config?.customer?.insights_api_key
  );

  const fetchStorageSystems = async () => {
    if (!hasInsightsCredentials) {
      setError("No Storage Insights credentials configured for this customer.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authResponse = await axios.post(`${API_URL}/api/insights/enhanced/auth/`, {
        tenant: config.customer.insights_tenant,
        api_key: config.customer.insights_api_key,
      });

      const storageResponse = await axios.post(
        `${API_URL}/api/insights/enhanced/storage-systems/`,
        {
          credentials_id: authResponse.data.credentials_id,
        }
      );

      const systems = storageResponse.data.resources || [];
      setStorageSystemsData(systems);

      const initialSelections = {};
      systems.forEach((system) => {
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

  const handleCheckboxChange = (systemId) => {
    setSelectedSystems((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  };

  const handleSelectAll = (selectAll) => {
    const newSelections = {};
    storageSystemsData.forEach((system) => {
      if (system.storage_type === "block") {
        newSelections[system.storage_system_id] = selectAll;
      }
    });
    setSelectedSystems(newSelections);
  };

  const handleImport = async (importType, jobName) => {
    const selectedSystemIds = Object.entries(selectedSystems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);

    if (selectedSystemIds.length === 0) {
      setSummaryModal({
        show: true,
        results: [
          {
            name: "No storage system selected",
            error: "Please select at least one storage system to import.",
          },
        ],
      });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/insights/enhanced/import/start/`,
        {
          tenant: config.customer.insights_tenant,
          api_key: config.customer.insights_api_key,
          customer_id: config.customer.id,
          import_type: importType,
          selected_systems: selectedSystemIds, // Pass the selected systems
          async: true,
        }
      );

      const result = {
        name: jobName,
        error: false,
        jobId: response.data.job_id,
        taskId: response.data.task_id,
        asyncJob: response.data.async,
        message: response.data.message,
        selectedSystems: selectedSystemIds,
        importType: importType,
      };

      if (!response.data.async) {
        result.processed = response.data.results.processed;
        result.successful = response.data.results.successful;
        result.errors = response.data.results.errors;
      }

      setSummaryModal({ show: true, results: [result] });

      if (response.data.async) {
        pollJobStatus(response.data.job_id, response.data.task_id, importType);
      }

      handleSelectAll(false);
    } catch (err) {
      console.error("Import failed:", err);
      setSummaryModal({
        show: true,
        results: [
          {
            name: `${jobName} failed`,
            error:
              err.response?.data?.message ||
              "Failed to import storage systems.",
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  // Enhanced polling function with better status tracking
  const pollJobStatus = async (jobId, taskId, importType) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await axios.get(
          `${API_URL}/api/insights/tasks/${taskId}/status/`
        );
        const taskStatus = statusResponse.data;

        // Update the summary modal with progress if available
        if (
          taskStatus.state === "PROGRESS" &&
          taskStatus.current !== undefined
        ) {
          setSummaryModal((prev) => ({
            ...prev,
            results: prev.results.map((result) =>
              result.taskId === taskId
                ? {
                    ...result,
                    progress: {
                      current: taskStatus.current,
                      total: taskStatus.total,
                      status: taskStatus.status,
                      stage: taskStatus.meta?.stage,
                    },
                  }
                : result
            ),
          }));
        }

        if (taskStatus.state === "SUCCESS") {
          clearInterval(pollInterval);
          const jobResponse = await axios.get(`${API_URL}/api/insights/jobs/${jobId}/`);
          const jobData = jobResponse.data;

          setSummaryModal((prev) => ({
            ...prev,
            results: prev.results.map((result) =>
              result.jobId === jobId
                ? {
                    ...result,
                    name: `${getImportTypeDisplay(importType)} Completed`,
                    error: false,
                    processed: jobData.processed_items,
                    successful: jobData.success_count,
                    errors: jobData.error_count,
                    asyncCompleted: true,
                    progress: undefined,
                  }
                : result
            ),
          }));
        } else if (taskStatus.state === "FAILURE") {
          clearInterval(pollInterval);
          setSummaryModal((prev) => ({
            ...prev,
            results: prev.results.map((result) =>
              result.taskId === taskId
                ? {
                    ...result,
                    name: `${getImportTypeDisplay(importType)} Failed`,
                    error: taskStatus.error || "Unknown error",
                    asyncFailed: true,
                    progress: undefined,
                  }
                : result
            ),
          }));
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        clearInterval(pollInterval);
      }
    }, 2000);

    // 5 minute timeout
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Helper function to display import type
  const getImportTypeDisplay = (importType) => {
    switch (importType) {
      case "storage_only":
        return "Storage Systems Import";
      case "full":
        return "Full Import (Storage + Volumes + Hosts)";
      case "volumes_only":
        return "Volumes Import";
      case "hosts_only":
        return "Hosts Import";
      default:
        return "Import";
    }
  };

  const fetchImportJobs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/insights/jobs/`);
      setJobsModal({ show: true, jobs: response.data });
    } catch (error) {
      console.error("Failed to fetch import jobs:", error);
    }
  };

  const formatStorageType = (type) => {
    const typeMap = { 2145: "FlashSystem", 2107: "DS8000", 2076: "Storwize" };
    return typeMap[type] || type;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: "warning",
      running: "primary",
      completed: "success",
      failed: "danger",
      cancelled: "secondary",
    };
    return statusMap[status] || "secondary";
  };

  const blockSystems = storageSystemsData.filter(
    (system) => system.storage_type === "block"
  );
  const hasSelectedSystems = Object.values(selectedSystems).some((v) => v);

  return (
    <div className="container mt-4">
      <Card className="shadow-sm">
        <Card.Header
          as="h5"
          className="bg-primary text-white d-flex justify-content-between align-items-center"
        >
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
              <p className="mb-4">
                This tool connects to IBM Storage Insights to import storage
                systems for the current customer:
                <strong> {config?.customer?.name}</strong>
              </p>
              <p>
                <a
                  href="https://insights.ibm.com/restapi/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View IBM Storage Insights REST API Swagger Docs
                </a>
              </p>

              <Alert variant="info">
                <strong>Enhanced Import System</strong> - This version uses the
                new enhanced import system with job tracking, better error
                handling, and automatic retry capabilities.
              </Alert>

              {error && <Alert variant="danger">{error}</Alert>}
              {importStatus && (
                <Alert variant={importStatus.type}>
                  {importStatus.message}
                </Alert>
              )}

              <div className="d-flex justify-content-between mb-3">
                <Button
                  variant="primary"
                  onClick={fetchStorageSystems}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" />{" "}
                      Loading...
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
                    disabled={loading || blockSystems.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => handleSelectAll(false)}
                    disabled={loading || blockSystems.length === 0}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {blockSystems.length > 0 ? (
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
                      {blockSystems.map((system) => (
                        <tr key={system.storage_system_id}>
                          <td className="text-center">
                            <Form.Check
                              type="checkbox"
                              checked={
                                selectedSystems[system.storage_system_id] ||
                                false
                              }
                              onChange={() =>
                                handleCheckboxChange(system.storage_system_id)
                              }
                              id={`system-${system.storage_system_id}`}
                            />
                          </td>
                          <td>{system.name}</td>
                          <td>{formatStorageType(system.type)}</td>
                          <td>{system.model}</td>
                          <td>{system.serial_number}</td>
                          <td>{system.storage_system_id}</td>
                          <td>
                            <span
                              className={`badge bg-${
                                system.probe_status === "successful"
                                  ? "success"
                                  : "warning"
                              }`}
                            >
                              {system.probe_status || "Unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  <div className="d-flex justify-content-end mt-3">
                    <Button
                      variant="success"
                      onClick={() =>
                        handleImport(
                          "storage_only",
                          "Storage Import Job Started"
                        )
                      }
                      disabled={loading || !hasSelectedSystems}
                      className="me-2"
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" />{" "}
                          Importing...
                        </>
                      ) : (
                        "Import Storage Systems Only"
                      )}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() =>
                        handleImport("full", "Full Import Job Started")
                      }
                      disabled={loading || !hasSelectedSystems}
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" />{" "}
                          Importing...
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
                    <p>
                      No storage systems found. Click "Fetch Storage Systems" to
                      retrieve data from IBM Storage Insights.
                    </p>
                  </div>
                )
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Summary Modal */}
      {summaryModal.show && (
        <Modal
          show
          onHide={() => setSummaryModal({ show: false, results: [] })}
        >
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

                      {/* Progress display */}
                      {result.asyncFailed && (
                        <div className="mt-1">
                          <small className="text-danger">
                            Job failed. Check logs for details.
                          </small>
                        </div>
                      )}

                      {/* Selected systems info */}
                      {result.selectedSystems &&
                        result.selectedSystems.length > 0 && (
                          <div className="mt-1">
                            <small className="text-muted">
                              Selected Systems: {result.selectedSystems.length}{" "}
                              system(s)
                            </small>
                          </div>
                        )}
                    </div>
                  )}
                  {result.error ? (
                    <div className="mt-1">
                      <Badge bg="danger">
                        {typeof result.error === "string"
                          ? `Error: ${result.error}`
                          : "Error occurred"}
                      </Badge>
                    </div>
                  ) : (
                    !result.jobId && (
                      <div className="mt-1">
                        <Badge bg="success">Success</Badge>
                      </div>
                    )
                  )}
                </li>
              ))}
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setSummaryModal({ show: false, results: [] })}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Jobs Modal */}
      {jobsModal.show && (
        <Modal
          show
          onHide={() => setJobsModal({ show: false, jobs: [] })}
          size="lg"
        >
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
                        <code>{job.job_id.split("-")[0]}...</code>
                      </td>
                      <td>
                        <Badge bg="secondary">{job.job_type}</Badge>
                      </td>
                      <td>
                        <Badge bg={getStatusBadge(job.status)}>
                          {job.status}
                        </Badge>
                      </td>
                      <td>
                        {job.total_items > 0 ? (
                          <div>
                            <div
                              className="progress"
                              style={{ height: "10px" }}
                            >
                              <div
                                className="progress-bar"
                                role="progressbar"
                                style={{
                                  width: `${job.progress_percentage || 0}%`,
                                }}
                              />
                            </div>
                            <small>
                              {job.success_count}/{job.total_items}
                            </small>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <small>
                          {new Date(job.created_at).toLocaleString()}
                        </small>
                      </td>
                      <td>
                        <small>{job.duration || "-"}</small>
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
            <Button
              variant="secondary"
              onClick={() => setJobsModal({ show: false, jobs: [] })}
            >
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
