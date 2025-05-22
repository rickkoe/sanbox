import React, { useState, useEffect, useContext, useLocation } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { Form, Button, Card, Alert, Spinner, Table } from "react-bootstrap";
import usePaginatedFetch from "../components/hooks/usePaginatedFetch";

const StorageInsightsImporter = () => {
  const { config } = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageSystemsData, setStorageSystemsData] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingVolumesId, setLoadingVolumesId] = useState(null);
  const { fetchAllPages } = usePaginatedFetch();

  // Check if customer has Insights credentials
  const hasInsightsCredentials = !!(
    config?.customer?.insights_tenant && 
    config?.customer?.insights_api_key
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
      // First get an auth token
      const tokenResponse = await axios.post(
        "http://127.0.0.1:8000/api/storage/insights/auth/", 
        {
          tenant: config.customer.insights_tenant,
          api_key: config.customer.insights_api_key
        }
      );
      
      setToken(tokenResponse.data.token);
      
      // Then fetch storage systems
      const storageResponse = await axios.post(
        "http://127.0.0.1:8000/api/storage/insights/storage-systems/",
        { 
          token: tokenResponse.data.token,
          tenant: config.customer.insights_tenant  // <-- Ensure you include this!
        }
      );
      
      // Process and set storage systems data
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
      provisioned_written_capacity_percent: system.provisioned_written_capacity_percent,
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
      available_system_capacity_percent: system.available_system_capacity_percent,
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
      safeguarded_virtual_capacity_bytes: system.safeguarded_virtual_capacity_bytes,
      safeguarded_used_capacity_percentage: system.safeguarded_used_capacity_percentage,
      data_collection_type: system.data_collection_type,
      data_reduction_savings_percent: system.data_reduction_savings_percent,
      data_reduction_savings_bytes: system.data_reduction_savings_bytes,
      data_reduction_ratio: system.data_reduction_ratio,
      total_compression_ratio: system.total_compression_ratio,
      host_connections_count: system.host_connections_count,
      drive_compression_savings_percent: system.drive_compression_savings_percent,
      remaining_unallocated_capacity_bytes: system.remaining_unallocated_capacity_bytes,
      pool_compression_savings_bytes: system.pool_compression_savings_bytes,
      compression_savings_bytes: system.compression_savings_bytes,
      compression_savings_percent: system.compression_savings_percent,
      ip_ports_count: system.ip_ports_count,
      overprovisioned_capacity_bytes: system.overprovisioned_capacity_bytes,
      unallocated_volume_capacity_bytes: system.unallocated_volume_capacity_bytes,
      managed_disks_count: system.managed_disks_count,
      drive_compression_savings_bytes: system.drive_compression_savings_bytes,
      pool_compression_savings_percent: system.pool_compression_savings_percent,
      drive_compression_ratio: system.drive_compression_ratio,
      pool_compression_ratio: system.pool_compression_ratio,
      topology: system.topology,
      cluster_id_alias: system.cluster_id_alias,
      snapshot_written_capacity_bytes: system.snapshot_written_capacity_bytes,
      snapshot_provisioned_capacity_bytes: system.snapshot_provisioned_capacity_bytes,
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
      setImportStatus({
        type: "warning",
        message: "Please select at least one storage system to import."
      });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      const payload = storageSystemsData
        .filter(system => selectedSystemIds.includes(system.storage_system_id))
        .map(buildStoragePayload);

      const errors = [];
      let importedCount = 0;

      for (const storage of payload) {
        try {
          await axios.post("http://127.0.0.1:8000/api/storage/", storage);
          importedCount++;
        } catch (error) {
          const detail = {
            name: storage.name,
            error: error.response?.data || error.message
          };
          console.error(`Error importing ${storage.name}`, detail);
          errors.push(detail);
        }
      }

      if (errors.length > 0) {
        setImportStatus({ type: "danger", errors });
      } else {
        setImportStatus({
          type: "success",
          message: `Successfully imported ${importedCount} storage systems.`
        });
        handleSelectAll(false);
      }
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

  // Fetch all volumes for a given systemId using internal Django backend, and save them to backend
  const fetchVolumesForSystem = async (systemId) => {
    setLoadingVolumesId(systemId);
    if (!token) {
      console.error("Token not available. Please fetch storage systems first.");
      setLoadingVolumesId(null);
      return;
    }

    const system = storageSystemsData.find(s => s.storage_system_id === systemId);
    const systemName = system?.name || systemId;

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/storage/insights/volumes/", {
        token,
        tenant: config.customer.insights_tenant,
        system_id: systemId
      });

      const importedCount = response.data.imported_count || 0;
      console.log(`Imported ${importedCount} volumes for system ${systemName}`);

      alert(`Successfully saved ${importedCount} volumes for system ${systemName}`);
    } catch (error) {
      console.error("Failed to fetch volumes:", error);
      alert("Failed to fetch volumes from backend.");
    } finally {
      setLoadingVolumesId(null);
    }
  };

  // Create a formatted display of storage type
  const formatStorageType = (type) => {
    const typeMap = {
      "2145": "FlashSystem",
      "2107": "DS8000",
      "2076": "Storwize",
      // Add more mappings as needed
    };
    
    return typeMap[type] || type;
  };
  
  return (
    <div className="container mt-4">
      <Card className="shadow-sm">
        <Card.Header as="h5" className="bg-primary text-white">
          IBM Storage Insights Importer
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
              
              {error && <Alert variant="danger">{error}</Alert>}
              {importStatus && importStatus.errors ? (
                <Alert variant={importStatus.type}>
                  <p>Error importing the following storage systems:</p>
                  <ul>
                    {importStatus.errors.map((err, idx) => (
                      <li key={idx}>
                        <strong>{err.name}</strong>: {JSON.stringify(err.error)}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                importStatus && <Alert variant={importStatus.type}>{importStatus.message}</Alert>
              )}
              
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageSystemsData
                        .filter(system => system.storage_type === "block")
                        .map(system => {
                        console.log(`System ID: ${system.storage_system_id}, Checkbox state: ${selectedSystems[system.storage_system_id] || false}`);
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
                            <td>
                              <Button
                                size="sm"
                                variant="outline-info"
                                onClick={() => fetchVolumesForSystem(system.storage_system_id)}
                                disabled={loadingVolumesId === system.storage_system_id}
                              >
                                {loadingVolumesId === system.storage_system_id ? (
                                  <>
                                    <Spinner as="span" animation="border" size="sm" className="me-1" />
                                    Fetching...
                                  </>
                                ) : (
                                  "Volumes"
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
                      disabled={loading || Object.values(selectedSystems).every(v => !v)}
                    >
                      {loading ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" /> Importing...
                        </>
                      ) : (
                        "Import Selected Systems"
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
    </div>
  );
};

export default StorageInsightsImporter;