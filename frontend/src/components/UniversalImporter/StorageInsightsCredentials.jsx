import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { Key, Database, CheckCircle, XCircle, Eye, EyeOff, Info } from 'lucide-react';
import axios from 'axios';
import './styles/StorageInsightsCredentials.css';

const StorageInsightsCredentials = ({
  tenantId,
  setTenantId,
  apiKey,
  setApiKey,
  availableSystems,
  setAvailableSystems,
  selectedSystems,
  setSelectedSystems,
  importOptions,
  setImportOptions,
  customerId,
  theme
}) => {
  const [fetchingSystemsloading, setFetchingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);

  // Show info message when credentials are pre-populated
  useEffect(() => {
    if (tenantId && apiKey) {
      setCredentialsLoaded(true);
      // Hide the message after 5 seconds
      const timer = setTimeout(() => setCredentialsLoaded(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchStorageSystems = async () => {
    if (!tenantId || !apiKey) {
      setError('Please provide both Tenant ID and API Key');
      return;
    }

    setFetchingLoading(true);
    setError(null);
    setAvailableSystems([]);

    try {
      // Fetch available storage systems from the backend
      const response = await axios.post('/api/importer/fetch-systems/', {
        customer_id: customerId,
        insights_tenant: tenantId,
        insights_api_key: apiKey
      });

      const systems = response.data.storage_systems || [];
      setAvailableSystems(systems);

      // Auto-select all systems by default (use storage_system_id, not serial)
      setSelectedSystems(systems.map(s => s.storage_system_id || s.serial));

      setError(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch storage systems';
      setError(errorMsg);
      setAvailableSystems([]);
    } finally {
      setFetchingLoading(false);
    }
  };

  const handleSystemToggle = (systemId) => {
    setSelectedSystems(prev => {
      if (prev.includes(systemId)) {
        return prev.filter(id => id !== systemId);
      } else {
        return [...prev, systemId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSystems.length === availableSystems.length) {
      setSelectedSystems([]);
    } else {
      setSelectedSystems(availableSystems.map(s => s.storage_system_id || s.serial));
    }
  };

  const handleOptionToggle = (option) => {
    setImportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className={`storage-insights-credentials theme-${theme}`}>
      <Card className="credentials-card">
        <Card.Header>
          <Key size={20} />
          <span>IBM Storage Insights API Credentials</span>
        </Card.Header>
        <Card.Body>
          {credentialsLoaded && (
            <Alert variant="info" className="mb-3 d-flex align-items-center">
              <Info size={16} className="me-2" />
              Credentials loaded from customer settings
            </Alert>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tenant ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your IBM Storage Insights Tenant ID"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={fetchingSystemsloading}
              />
              <Form.Text className="text-muted">
                Found in your IBM Storage Insights account settings
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>API Key</Form.Label>
              <div className="api-key-input-group">
                <Form.Control
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your IBM Storage Insights API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={fetchingSystemsloading}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="toggle-visibility-btn"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              <Form.Text className="text-muted">
                Generated from IBM Storage Insights API settings
              </Form.Text>
            </Form.Group>

            <Button
              variant="primary"
              onClick={fetchStorageSystems}
              disabled={fetchingSystemsloading || !tenantId || !apiKey}
              className="fetch-systems-btn"
            >
              {fetchingSystemsloading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Fetching Systems...
                </>
              ) : (
                <>
                  <Database size={16} className="me-2" />
                  Fetch Available Systems
                </>
              )}
            </Button>
          </Form>

          {error && (
            <Alert variant="danger" className="mt-3">
              <XCircle size={16} className="me-2" />
              {error}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {availableSystems.length > 0 && (
        <>
          <Card className="systems-selection-card mt-4">
            <Card.Header>
              <Database size={20} />
              <span>Select Storage Systems ({selectedSystems.length}/{availableSystems.length})</span>
              <Button
                variant="link"
                size="sm"
                onClick={handleSelectAll}
                className="select-all-btn"
              >
                {selectedSystems.length === availableSystems.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Card.Header>
            <Card.Body>
              <div className="systems-list">
                {availableSystems.map((system) => {
                  const systemId = system.storage_system_id || system.serial;
                  const isSelected = selectedSystems.includes(systemId);

                  return (
                    <div
                      key={systemId}
                      className={`system-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSystemToggle(systemId)}
                    >
                      <div className="system-checkbox">
                        <Form.Check
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSystemToggle(systemId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="system-info">
                        <div className="system-name">{system.name || systemId}</div>
                        <div className="system-details">
                          <span className="system-type">{system.type || 'Unknown Type'}</span>
                          <span className="system-serial">Serial: {systemId}</span>
                          {system.status && (
                            <span className={`system-status status-${system.status.toLowerCase()}`}>
                              {system.status}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="system-selected-indicator">
                          <CheckCircle size={20} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>

          <Card className="import-options-card mt-4">
            <Card.Header>
              <CheckCircle size={20} />
              <span>Import Options</span>
            </Card.Header>
            <Card.Body>
              <div className="import-options-list">
                <Form.Check
                  type="checkbox"
                  label="Storage Systems"
                  checked={importOptions.storage_systems}
                  onChange={() => handleOptionToggle('storage_systems')}
                  disabled
                />
                <Form.Text className="text-muted ms-4 d-block mb-2">
                  Import storage system information and capacity data
                </Form.Text>

                <Form.Check
                  type="checkbox"
                  label="Volumes"
                  checked={importOptions.volumes}
                  onChange={() => handleOptionToggle('volumes')}
                />
                <Form.Text className="text-muted ms-4 d-block mb-2">
                  Import volume configurations and capacity details
                </Form.Text>

                <Form.Check
                  type="checkbox"
                  label="Hosts"
                  checked={importOptions.hosts}
                  onChange={() => handleOptionToggle('hosts')}
                />
                <Form.Text className="text-muted ms-4 d-block mb-2">
                  Import host connections and WWPNs
                </Form.Text>

                <Form.Check
                  type="checkbox"
                  label="Ports (Experimental)"
                  checked={importOptions.ports}
                  onChange={() => handleOptionToggle('ports')}
                  disabled
                />
                <Form.Text className="text-muted ms-4 d-block mb-2">
                  Import storage port information (coming soon)
                </Form.Text>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
};

export default StorageInsightsCredentials;
