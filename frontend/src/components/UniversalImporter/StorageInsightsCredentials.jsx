import React, { useState, useEffect } from 'react';
import {
  Key,
  Database,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Info,
  Loader
} from 'lucide-react';
import axios from 'axios';

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
  customerId
}) => {
  const [fetchingLoading, setFetchingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);

  // Show info message when credentials are pre-populated
  useEffect(() => {
    if (tenantId && apiKey) {
      setCredentialsLoaded(true);
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
      const response = await axios.post('/api/importer/fetch-systems/', {
        customer_id: customerId,
        insights_tenant: tenantId,
        insights_api_key: apiKey
      });

      const systems = response.data.storage_systems || [];
      setAvailableSystems(systems);
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
    <div className="configuration-panel">
      {/* Credentials Section */}
      <div className="step-content">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Key size={20} />
          IBM Storage Insights API Credentials
        </h2>

        {credentialsLoaded && (
          <div className="alert alert-info">
            <Info className="alert-icon" size={18} />
            <div className="alert-content">
              <div className="alert-message">Credentials loaded from customer settings</div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Tenant ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter your IBM Storage Insights Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            disabled={fetchingLoading}
          />
          <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
            Found in your IBM Storage Insights account settings
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">API Key</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type={showApiKey ? "text" : "password"}
              className="form-input"
              placeholder="Enter your IBM Storage Insights API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={fetchingLoading}
              style={{ flex: 1 }}
            />
            <button
              className="nav-button secondary"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{ padding: 'var(--space-3)' }}
            >
              {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
            Generated from IBM Storage Insights API settings
          </div>
        </div>

        <button
          className="nav-button primary"
          onClick={fetchStorageSystems}
          disabled={fetchingLoading || !tenantId || !apiKey}
        >
          {fetchingLoading ? (
            <>
              <Loader size={18} className="loading-spinner" style={{ width: '18px', height: '18px' }} />
              Fetching Systems...
            </>
          ) : (
            <>
              <Database size={18} />
              Fetch Available Systems
            </>
          )}
        </button>

        {error && (
          <div className="alert alert-danger">
            <XCircle className="alert-icon" size={18} />
            <div className="alert-content">
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* System Selection */}
      {availableSystems.length > 0 && (
        <div className="step-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <Database size={20} />
              Select Storage Systems ({selectedSystems.length}/{availableSystems.length})
            </h2>
            <button className="select-all-btn" onClick={handleSelectAll}>
              {selectedSystems.length === availableSystems.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {availableSystems.map((system) => {
              const systemId = system.storage_system_id || system.serial;
              const isSelected = selectedSystems.includes(systemId);

              return (
                <div
                  key={systemId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: isSelected ? 'var(--table-row-selected)' : 'var(--secondary-bg)',
                    border: `1px solid ${isSelected ? 'var(--color-accent-emphasis)' : 'var(--color-border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleSystemToggle(systemId)}
                >
                  <input
                    type="checkbox"
                    className="preview-checkbox"
                    checked={isSelected}
                    onChange={() => handleSystemToggle(systemId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: 'var(--space-1)' }}>
                      {system.name || systemId}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)', display: 'flex', gap: 'var(--space-3)' }}>
                      <span>{system.type || 'Unknown Type'}</span>
                      <span>Serial: {systemId}</span>
                      {system.status && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-success-subtle)',
                          color: 'var(--color-success-fg)',
                          fontSize: 'var(--font-size-xs)'
                        }}>
                          {system.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle size={20} style={{ color: 'var(--color-success-fg)' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Import Options */}
      {availableSystems.length > 0 && (
        <div className="step-content">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle size={20} />
            Import Options
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'not-allowed', opacity: 0.6 }}>
                <input
                  type="checkbox"
                  className="preview-checkbox"
                  checked={importOptions.storage_systems}
                  disabled
                />
                <span style={{ fontWeight: '500' }}>Storage Systems</span>
              </label>
              <div style={{ marginLeft: 'var(--space-5)', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                Import storage system information and capacity data (required)
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="preview-checkbox"
                  checked={importOptions.volumes}
                  onChange={() => handleOptionToggle('volumes')}
                />
                <span style={{ fontWeight: '500' }}>Volumes</span>
              </label>
              <div style={{ marginLeft: 'var(--space-5)', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                Import volume configurations and capacity details
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="preview-checkbox"
                  checked={importOptions.hosts}
                  onChange={() => handleOptionToggle('hosts')}
                />
                <span style={{ fontWeight: '500' }}>Hosts</span>
              </label>
              <div style={{ marginLeft: 'var(--space-5)', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                Import host connections and WWPNs
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'not-allowed', opacity: 0.6 }}>
                <input
                  type="checkbox"
                  className="preview-checkbox"
                  checked={importOptions.ports}
                  disabled
                />
                <span style={{ fontWeight: '500' }}>Ports (Experimental)</span>
              </label>
              <div style={{ marginLeft: 'var(--space-5)', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                Import storage port information (coming soon)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageInsightsCredentials;
