import React, { useState, useEffect, useContext } from "react";
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
import usePaginatedFetch from "../components/hooks/usePaginatedFetch";

const StorageInsightsImporter = () => {
  const { config } = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageSystemsData, setStorageSystemsData] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [token, setToken] = useState(null);
  const [credentialsId, setCredentialsId] = useState(null);
  const [loadingVolumesId, setLoadingVolumesId] = useState(null);
  const [loadingHostsId, setLoadingHostsId] = useState(null);
  const { fetchAllPages } = usePaginatedFetch();
  const [summaryModal, setSummaryModal] = useState({
    show: false,
    results: [],
  });
  const [progressModal, setProgressModal] = useState({
    show: false,
    items: [],
  });
  const [importCancelled, setImportCancelled] = useState(false);
  const [useEnhancedAPI, setUseEnhancedAPI] = useState(false);
  const [jobsModal, setJobsModal] = useState({ show: false, jobs: [] });

  // Check if customer has Insights credentials
  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && config?.customer?.insights_api_key
  );

  // Fetch storage systems from Insights API
  const fetchStorageSystems = async () => {
    if (!hasInsightsCredentials) {
      setError("No Storage Insights credentials configured for this customer.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (useEnhancedAPI) {
        // Use enhanced API endpoints
        const authResponse = await axios.post("/api/insights/enhanced/auth/", {
          tenant: config.customer.insights_tenant,
          api_key: config.customer.insights_api_key,
        });

        setToken(authResponse.data.token);
        setCredentialsId(authResponse.data.credentials_id);

        // Fetch storage systems using credentials ID
        const storageResponse = await axios.post(
          "/api/insights/enhanced/storage-systems/",
          {
            credentials_id: authResponse.data.credentials_id,
          }
        );

        const systems = storageResponse.data.resources || [];
        setStorageSystemsData(systems);

        // Initialize selection state
        const initialSelections = {};
        systems.forEach((system) => {
          initialSelections[system.storage_system_id] = false;
        });
        setSelectedSystems(initialSelections);
      } else {
        // Use legacy API endpoints
        const tokenResponse = await axios.post("/api/storage/insights/auth/", {
          tenant: config.customer.insights_tenant,
          api_key: config.customer.insights_api_key,
        });

        setToken(tokenResponse.data.token);

        const storageResponse = await axios.post(
          "/api/storage/insights/storage-systems/",
          {
            token: tokenResponse.data.token,
            tenant: config.customer.insights_tenant,
          }
        );

        const systems = storageResponse.data.resources || [];
        setStorageSystemsData(systems);

        // Initialize selection state
        const initialSelections = {};
        systems.forEach((system) => {
          initialSelections[system.storage_system_id] = false;
        });
        setSelectedSystems(initialSelections);
      }
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
    setSelectedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  // Select/deselect all systems (only those with storage_type === "block")
  const handleSelectAll = (selectAll) => {
    const newSelections = {};
    storageSystemsData.forEach((system) => {
      if (system.storage_type === "block") {
        newSelections[system.storage_system_id] = selectAll;
      }
    });
    setSelectedSystems(newSelections);
  };

  // Build storage payload from system data (expanded for all Storage fields)
  const buildStoragePayload = (system) => {
    const storage_type =
      system.type?.startsWith("FlashSystem") ||
      system.type?.startsWith("flashsystem")
        ? "FlashSystem"
        : system.type?.startsWith("DS")
        ? "DS8000"
        : "Unknown";

    return {
      customer: config.customer.id,
      name: system.name || "Unnamed Storage",
      storage_type,
      storage_system_id: system.storage_system_id || null,
      location: system.location || null,
      machine_type: system.type?.match(/\d{4}$/)?.[0] || null,
      model: system.model || null,
      serial_number: system.serial_number || null,
      wwnn: null,
      firmware_level: system.firmware || null,
      primary_ip: system.ip_address?.split(",")[0]?.trim() || null,
      secondary_ip: system.ip_address?.split(",")[1]?.trim() || null,
      uuid: system.storage_system_id || null,
      written_capacity_limit_bytes: system.written_capacity_limit_bytes,
      unmapped_capacity_percent: system.unmapped_capacity_percent,
      last_successful_probe: system.last_successful_probe,
      provisioned_written_capacity_percent:
        system.provisioned_written_capacity_percent,
      capacity_savings_bytes: system.capacity_savings_bytes,
      raw_capacity_bytes: system.raw_capacity_bytes,
      provisioned_capacity_percent: system.provisioned_capacity_percent,
      mapped_capacity_percent: system.mapped_capacity_percent,
      available_written_capacity_bytes: system.available_written_capacity_bytes,
      mapped_capacity_bytes: system.mapped_capacity_bytes,
      probe_status: system.probe_status,
      available_volume_capacity_bytes: system.available_volume_capacity_bytes,
      capacity_savings_percent: system.capacity_savings_percent,
      overhead_capacity_bytes: system.overhead_capacity_bytes,
      customer_country_code: system.customer_country_code,
      events_status: system.events_status,
      unmapped_capacity_bytes: system.unmapped_capacity_bytes,
      last_successful_monitor: system.last_successful_monitor,
      remote_relationships_count: system.remote_relationships_count,
      condition: system.condition,
      customer_number: system.customer_number,
      capacity_bytes: system.capacity_bytes,
      used_written_capacity_percent: system.used_written_capacity_percent,
      pools_count: system.pools_count,
      pm_status: system.pm_status,
      shortfall_percent: system.shortfall_percent,
      used_written_capacity_bytes: system.used_written_capacity_bytes,
      available_system_capacity_bytes: system.available_system_capacity_bytes,
      used_capacity_bytes: system.used_capacity_bytes,
      volumes_count: system.volumes_count,
      deduplication_savings_percent: system.deduplication_savings_percent,
      data_collection: system.data_collection,
      available_capacity_bytes: system.available_capacity_bytes,
      used_capacity_percent: system.used_capacity_percent,
      disks_count: system.disks_count,
      unprotected_volumes_count: system.unprotected_volumes_count,
      provisioned_capacity_bytes: system.provisioned_capacity_bytes,
      available_system_capacity_percent:
        system.available_system_capacity_percent,
      deduplication_savings_bytes: system.deduplication_savings_bytes,
      vendor: system.vendor,
      recent_fill_rate: system.recent_fill_rate,
      recent_growth: system.recent_growth,
      time_zone: system.time_zone,
      fc_ports_count: system.fc_ports_count,
      staas_environment: system.staas_environment,
      element_manager_url: system.element_manager_url,
      probe_schedule: system.probe_schedule,
      acknowledged: system.acknowledged,
      safe_guarded_capacity_bytes: system.safe_guarded_capacity_bytes,
      read_cache_bytes: system.read_cache_bytes,
      write_cache_bytes: system.write_cache_bytes,
      compressed: system.compressed,
      callhome_system: system.callhome_system,
      ransomware_threat_detection: system.ransomware_threat_detection,
      threat_notification_recipients: system.threat_notification_recipients,
      current_power_usage_watts: system.current_power_usage_watts,
      system_temperature_celsius: system.system_temperature_celsius,
      system_temperature_Fahrenheit: system.system_temperature_Fahrenheit,
      power_efficiency: system.power_efficiency,
      co2_emission: system.co2_emission,
      safeguarded_virtual_capacity_bytes:
        system.safeguarded_virtual_capacity_bytes,
      safeguarded_used_capacity_percentage:
        system.safeguarded_used_capacity_percentage,
      data_collection_type: system.data_collection_type,
      data_reduction_savings_percent: system.data_reduction_savings_percent,
      data_reduction_savings_bytes: system.data_reduction_savings_bytes,
      data_reduction_ratio: system.data_reduction_ratio,
      total_compression_ratio: system.total_compression_ratio,
      host_connections_count: system.host_connections_count,
      drive_compression_savings_percent:
        system.drive_compression_savings_percent,
      remaining_unallocated_capacity_bytes:
        system.remaining_unallocated_capacity_bytes,
      pool_compression_savings_bytes: system.pool_compression_savings_bytes,
      compression_savings_bytes: system.compression_savings_bytes,
      compression_savings_percent: system.compression_savings_percent,
      ip_ports_count: system.ip_ports_count,
      overprovisioned_capacity_bytes: system.overprovisioned_capacity_bytes,
      unallocated_volume_capacity_bytes:
        system.unallocated_volume_capacity_bytes,
      managed_disks_count: system.managed_disks_count,
      drive_compression_savings_bytes: system.drive_compression_savings_bytes,
      pool_compression_savings_percent: system.pool_compression_savings_percent,
      drive_compression_ratio: system.drive_compression_ratio,
      pool_compression_ratio: system.pool_compression_ratio,
      topology: system.topology,
      cluster_id_alias: system.cluster_id_alias,
      snapshot_written_capacity_bytes: system.snapshot_written_capacity_bytes,
      snapshot_provisioned_capacity_bytes:
        system.snapshot_provisioned_capacity_bytes,
      total_savings_ratio: system.total_savings_ratio,
      volume_groups_count: system.volume_groups_count,
    };
  };

  // Import selected storage systems (one-by-one, like StorageTable)
  const handleImport = async () => {
    const selectedSystemIds = Object.entries(selectedSystems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);

    if (selectedSystemIds.length === 0) {
      setSummaryModal({
        show: true,
        results: [
          {
            name: "No storage system selected",
            volumeCount: null,
            error: "Please select at least one storage system to import.",
          },
        ],
      });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      if (useEnhancedAPI) {
        // Use orchestrated import
        const response = await axios.post(
          "/api/insights/enhanced/import/start/",
          {
            tenant: config.customer.insights_tenant,
            api_key: config.customer.insights_api_key,
            customer_id: config.customer.id,
            import_type: "storage_only",
            selected_systems: selectedSystemIds,
            async: true,
          }
        );

        if (response.data.async) {
          // Async response - show job started message
          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job Started`,
                volumeCount: null,
                error: false,
                jobId: response.data.job_id,
                taskId: response.data.task_id,
                asyncJob: true,
                message: response.data.message,
              },
            ],
          });

          // Start polling for job status
          pollJobStatus(response.data.job_id, response.data.task_id);
        } else {
          // Sync response (fallback)
          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job ${response.data.job_id}`,
                volumeCount: null,
                error: false,
                jobId: response.data.job_id,
                processed: response.data.results.processed,
                successful: response.data.results.successful,
                errors: response.data.results.errors,
              },
            ],
          });
        }
      } else {
        // Use legacy import (your existing code)
        const payload = storageSystemsData
          .filter((system) =>
            selectedSystemIds.includes(system.storage_system_id)
          )
          .map(buildStoragePayload);

        const summaryResults = [];

        for (const storage of payload) {
          try {
            await axios.post("/api/storage/", storage);
            summaryResults.push({
              name: storage.name,
              volumeCount: null,
              error: false,
            });
          } catch (error) {
            const detail = {
              name: storage.name,
              error: error.response?.data || error.message,
            };
            console.error(`Error importing ${storage.name}`, detail);
            summaryResults.push({
              name: storage.name,
              volumeCount: null,
              error: detail.error,
            });
          }
        }

        setSummaryModal({ show: true, results: summaryResults });
      }

      handleSelectAll(false);
    } catch (err) {
      console.error("Import failed:", err);
      setSummaryModal({
        show: true,
        results: [
          {
            name: "Import failed",
            volumeCount: null,
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

  // Import selected storage systems and immediately fetch and save their volumes, showing a summary modal after completion
  const handleImportWithVolumes = async () => {
    const selectedSystemIds = Object.entries(selectedSystems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);

    if (selectedSystemIds.length === 0) {
      setImportStatus({
        type: "warning",
        message: "Please select at least one storage system to import.",
      });
      return;
    }

    setImportCancelled(false);
    setLoading(true);
    setProgressModal({ show: true, items: [] });
    setImportStatus(null);

    try {
      if (useEnhancedAPI) {
        // Use orchestrated import with volumes
        const response = await axios.post(
          "/api/insights/enhanced/import/start/",
          {
            tenant: config.customer.insights_tenant,
            api_key: config.customer.insights_api_key,
            customer_id: config.customer.id,
            import_type: "full",
            selected_systems: selectedSystemIds,
          }
        );

        setSummaryModal({
          show: true,
          results: [
            {
              name: `Import Job ${response.data.job_id}`,
              volumeCount: `${response.data.results.processed} systems with volumes`,
              error: false,
              jobId: response.data.job_id,
            },
          ],
        });
      } else {
        // Use legacy import with volumes (your existing code)
        const payload = storageSystemsData
          .filter((system) =>
            selectedSystemIds.includes(system.storage_system_id)
          )
          .map(buildStoragePayload);

        const summaryResults = [];

        for (const storage of payload) {
          // Check for cancellation before proceeding
          if (importCancelled) {
            summaryResults.push({
              name: storage.name,
              volumeCount: null,
              error: "Import cancelled",
            });
            break;
          }

          // Add progress item
          setProgressModal((prev) => ({
            ...prev,
            items: [
              ...prev.items,
              {
                name: storage.name,
                step: "Importing storage...",
                status: "pending",
              },
            ],
          }));

          try {
            await axios.post("/api/storage/", storage);

            if (importCancelled) {
              summaryResults.push({
                name: storage.name,
                volumeCount: null,
                error: "Import cancelled",
              });
              break;
            }

            // Update progress to importing volumes
            setProgressModal((prev) => {
              const updated = [...prev.items];
              const idx = updated.findIndex((i) => i.name === storage.name);
              if (idx !== -1)
                updated[idx] = {
                  ...updated[idx],
                  step: "Importing volumes...",
                  status: "pending",
                };
              return { ...prev, items: updated };
            });

            const volumeResult = await fetchVolumesForSystem(storage.uuid);

            setProgressModal((prev) => {
              const updated = [...prev.items];
              const idx = updated.findIndex((i) => i.name === storage.name);
              if (idx !== -1)
                updated[idx] = {
                  ...updated[idx],
                  step: "Completed",
                  status: "success",
                };
              return { ...prev, items: updated };
            });

            summaryResults.push({
              name: storage.name,
              volumeCount: volumeResult.volumeCount,
              error: volumeResult.error || false,
            });
          } catch (error) {
            setProgressModal((prev) => {
              const updated = [...prev.items];
              const idx = updated.findIndex((i) => i.name === storage.name);
              if (idx !== -1)
                updated[idx] = {
                  ...updated[idx],
                  step: "Failed",
                  status: "error",
                };
              return { ...prev, items: updated };
            });

            summaryResults.push({
              name: storage.name,
              volumeCount: 0,
              error: true,
            });
          }
        }

        setSummaryModal({ show: true, results: summaryResults });
      }

      handleSelectAll(false);
    } catch (err) {
      console.error("Import failed:", err);
      setImportStatus({
        type: "danger",
        message:
          err.response?.data?.message || "Failed to import storage systems.",
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgressModal({ show: false, items: [] });
      }, 1000);
    }
  };

  // Fetch all volumes for a given systemId using internal Django backend, and save them to backend
  const fetchVolumesForSystem = async (systemId) => {
    setLoadingVolumesId(systemId);
    if (!token) {
      console.error("Token not available. Please fetch storage systems first.");
      setLoadingVolumesId(null);
      return { systemId, systemName: systemId, volumeCount: 0 };
    }

    const system = storageSystemsData.find(
      (s) => s.storage_system_id === systemId
    );
    const systemName = system?.name || systemId;

    try {
      const response = await axios.post("/api/storage/insights/volumes/", {
        token,
        tenant: config.customer.insights_tenant,
        system_id: systemId,
      });

      const importedCount = response.data.imported_count || 0;
      console.log(`Imported ${importedCount} volumes for system ${systemName}`);
      return { systemId, systemName, volumeCount: importedCount };
    } catch (error) {
      console.error("Failed to fetch volumes:", error);
      return { systemId, systemName, volumeCount: 0, error: true };
    } finally {
      setLoadingVolumesId(null);
    }
  };

  // Fetch all host connections for a given systemId using internal Django backend, and save them to backend
  const fetchHostConnectionsForSystem = async (systemId) => {
    setLoadingHostsId(systemId);
    if (!token) {
      console.error("Token not available. Please fetch storage systems first.");
      setLoadingHostsId(null);
      return { systemId, systemName: systemId, importedCount: 0 };
    }
    const system = storageSystemsData.find(
      (s) => s.storage_system_id === systemId
    );
    const systemName = system?.name || systemId;
    try {
      const response = await axios.post(
        "/api/storage/insights/host-connections/",
        {
          token,
          tenant: config.customer.insights_tenant,
          system_id: systemId,
        }
      );
      const importedCount = response.data.imported_count || 0;
      alert(
        `Imported ${importedCount} host connections for system ${systemName}`
      );
      return { systemId, systemName, importedCount };
    } catch (error) {
      console.error("Failed to fetch host connections:", error);
      alert(
        `Failed to import host connections for ${systemName}: ${error.message}`
      );
      return { systemId, systemName, importedCount: 0, error: true };
    } finally {
      setLoadingHostsId(null);
    }
  };

  // Poll job status for async imports
  const pollJobStatus = async (jobId, taskId) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await axios.get(
          `/api/insights/tasks/${taskId}/status/`
        );
        const taskStatus = statusResponse.data;

        if (taskStatus.state === "SUCCESS") {
          clearInterval(pollInterval);

          // Get final job details
          const jobResponse = await axios.get(`/api/insights/jobs/${jobId}/`);
          const jobData = jobResponse.data;

          // Update summary modal with final results
          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job Completed`,
                volumeCount: null,
                error: false,
                jobId: jobData.job_id,
                processed: jobData.processed_items,
                successful: jobData.success_count,
                errors: jobData.error_count,
                asyncCompleted: true,
              },
            ],
          });
        } else if (taskStatus.state === "FAILURE") {
          clearInterval(pollInterval);

          setSummaryModal({
            show: true,
            results: [
              {
                name: `Import Job Failed`,
                volumeCount: null,
                error: taskStatus.error || "Unknown error",
                jobId: jobId,
                asyncFailed: true,
              },
            ],
          });
        }
        // For PENDING or PROGRESS, keep polling
      } catch (error) {
        console.error("Error polling job status:", error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  };

  // Fetch import jobs (for enhanced API)
  const fetchImportJobs = async () => {
    try {
      const response = await axios.get("/api/insights/jobs/");
      setJobsModal({ show: true, jobs: response.data });
    } catch (error) {
      console.error("Failed to fetch import jobs:", error);
    }
  };

  // Create a formatted display of storage type
  const formatStorageType = (type) => {
    const typeMap = {
      2145: "FlashSystem",
      2107: "DS8000",
      2076: "Storwize",
    };

    return typeMap[type] || type;
  };

  // Format job status badge
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

  return (
    <div className="container mt-4">
      <Card className="shadow-sm">
        <Card.Header
          as="h5"
          className="bg-primary text-white d-flex justify-content-between align-items-center"
        >
          <span>IBM Storage Insights Importer</span>
          {useEnhancedAPI && (
            <Button variant="outline-light" size="sm" onClick={fetchImportJobs}>
              View Import Jobs
            </Button>
          )}
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

              {/* Enhanced API Toggle */}
              <div className="mb-3">
                <Form.Check
                  type="switch"
                  id="enhanced-api-switch"
                  label={`Use Enhanced Import System (with job tracking and better error handling) ${
                    useEnhancedAPI ? "✨" : ""
                  }`}
                  checked={useEnhancedAPI}
                  onChange={(e) => setUseEnhancedAPI(e.target.checked)}
                />
                {useEnhancedAPI && (
                  <small className="text-muted">
                    Enhanced mode provides better tracking, logging, and error
                    recovery.
                  </small>
                )}
              </div>

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

              {storageSystemsData.filter(
                (system) => system.storage_type === "block"
              ).length > 0 ? (
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageSystemsData
                        .filter((system) => system.storage_type === "block")
                        .map((system) => {
                          return (
                            <tr key={system.storage_system_id}>
                              <td className="text-center">
                                <Form.Check
                                  type="checkbox"
                                  checked={
                                    selectedSystems[system.storage_system_id] ||
                                    false
                                  }
                                  onChange={() =>
                                    handleCheckboxChange(
                                      system.storage_system_id
                                    )
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
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline-info"
                                  onClick={() =>
                                    fetchVolumesForSystem(
                                      system.storage_system_id
                                    )
                                  }
                                  disabled={
                                    loadingVolumesId ===
                                    system.storage_system_id
                                  }
                                >
                                  {loadingVolumesId ===
                                  system.storage_system_id ? (
                                    <>
                                      <Spinner
                                        as="span"
                                        animation="border"
                                        size="sm"
                                        className="me-1"
                                      />
                                      Fetching...
                                    </>
                                  ) : (
                                    "Volumes"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-info"
                                  className="ms-2"
                                  onClick={() =>
                                    fetchHostConnectionsForSystem(
                                      system.storage_system_id
                                    )
                                  }
                                  disabled={
                                    loadingHostsId === system.storage_system_id
                                  }
                                >
                                  {loadingHostsId ===
                                  system.storage_system_id ? (
                                    <>
                                      <Spinner
                                        as="span"
                                        animation="border"
                                        size="sm"
                                        className="me-1"
                                      />
                                      Fetching Hosts...
                                    </>
                                  ) : (
                                    "Host Connections"
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </Table>

                  <div className="d-flex justify-content-end mt-3">
                    <Button
                      variant="success"
                      onClick={handleImport}
                      disabled={
                        loading ||
                        Object.values(selectedSystems).every((v) => !v)
                      }
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" />{" "}
                          Importing...
                        </>
                      ) : (
                        `Import Selected Systems ${
                          useEnhancedAPI ? "(Enhanced)" : ""
                        }`
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleImportWithVolumes}
                      disabled={
                        loading ||
                        Object.values(selectedSystems).every((v) => !v)
                      }
                      className="ms-2"
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" />{" "}
                          Importing...
                        </>
                      ) : (
                        `Import Selected Systems + Volumes ${
                          useEnhancedAPI ? "(Enhanced)" : ""
                        }`
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
                  <strong>{result.name}</strong> –{" "}
                  {result.jobId ? (
                    <div>
                      <Badge bg="info">Job ID: {result.jobId}</Badge>
                      {result.processed && (
                        <div className="mt-1">
                          <small className="text-muted">
                            Processed: {result.processed}, Successful:{" "}
                            {result.successful}, Errors: {result.errors}
                          </small>
                        </div>
                      )}
                      {result.asyncJob && (
                        <div className="mt-1">
                          <small className="text-info">
                            Job started successfully. Results will update
                            automatically.
                          </small>
                        </div>
                      )}
                      {result.asyncCompleted && (
                        <div className="mt-1">
                          <small className="text-success">
                            Job completed successfully!
                          </small>
                        </div>
                      )}
                      {result.asyncFailed && (
                        <div className="mt-1">
                          <small className="text-danger">
                            Job failed. Check logs for details.
                          </small>
                        </div>
                      )}
                    </div>
                  ) : result.volumeCount === null ? (
                    "Storage imported (no volumes)"
                  ) : (
                    `${result.volumeCount} volumes imported`
                  )}{" "}
                  {result.error && typeof result.error === "string" ? (
                    <Badge bg="danger">Error: {result.error}</Badge>
                  ) : result.error ? (
                    <Badge bg="danger">Error occurred</Badge>
                  ) : (
                    <Badge bg="success">Success</Badge>
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

      {/* Progress Modal */}
      {progressModal.show && (
        <Modal show backdrop="static" keyboard={false}>
          <Modal.Header>
            <Modal.Title>Importing...</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ul>
              {progressModal.items.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.name}</strong>: {item.step}
                  {item.status === "success" && " ✅"}
                  {item.status === "error" && " ❌"}
                  {item.status === "pending" && " ⏳"}
                </li>
              ))}
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="danger"
              onClick={() => {
                setImportCancelled(true);
                setProgressModal({ show: false, items: [] });
                window.location.reload();
              }}
            >
              Cancel Import
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
