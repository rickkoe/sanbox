import React, { useState, useEffect, useContext, useLocation } from "react";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { Form, Button, Card, Alert, Spinner, Table } from "react-bootstrap";

const StorageInsightsImporter = () => {
  const { config } = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageSystemsData, setStorageSystemsData] = useState([]);
  const [selectedSystems, setSelectedSystems] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [token, setToken] = useState(null);

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

  // Select/deselect all systems
  const handleSelectAll = (selectAll) => {
    const newSelections = {};
    storageSystemsData.forEach(system => {
      newSelections[system.storage_system_id] = selectAll;
    });
    setSelectedSystems(newSelections);
  };

  // Import selected storage systems
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
      const response = await axios.post(
        "http://127.0.0.1:8000/api/storage/import-from-insights/",
        {
          customer_id: config.customer.id,
          system_ids: selectedSystemIds,
          token: token
        }
      );
      
      setImportStatus({
        type: "success",
        message: `Successfully imported ${response.data.imported_count} storage systems.`
      });
      
      // Reset selections
      handleSelectAll(false);
      
    } catch (err) {
      console.error("Error importing storage systems:", err);
      setImportStatus({
        type: "danger",
        message: err.response?.data?.message || "Failed to import storage systems."
      });
    } finally {
      setLoading(false);
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
                        <th>Machine Type</th>
                        <th>Model</th>
                        <th>Serial Number</th>
                        <th>Status</th>
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
                            <td>{system.machine_type}</td>
                            <td>{system.model}</td>
                            <td>{system.serial_number}</td>
                            <td>
                              <span className={`badge bg-${system.status === "ONLINE" ? "success" : "warning"}`}>
                                {system.status || "Unknown"}
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