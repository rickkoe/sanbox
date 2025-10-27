import React from 'react';
import { HardDrive, Database, Server, CheckCircle, AlertCircle } from 'lucide-react';

const StoragePreview = ({ previewData }) => {
  const { storage_systems = [], volumes = [], hosts = [], counts = {} } = previewData;

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const tb = bytes / (1024 ** 4);
    if (tb >= 1) return `${tb.toFixed(2)} TB`;
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const formatPercent = (percent) => {
    if (percent === null || percent === undefined) return 'N/A';
    return `${parseFloat(percent).toFixed(1)}%`;
  };

  return (
    <div className="data-preview">
      {/* Import Summary Stats */}
      <div className="preview-stats">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon primary">
              <HardDrive size={20} />
            </div>
            <div className="stat-label">Storage Systems</div>
          </div>
          <div className="stat-value">{counts.storage_systems || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon info">
              <Database size={20} />
            </div>
            <div className="stat-label">Volumes</div>
          </div>
          <div className="stat-value">{counts.volumes || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon success">
              <Server size={20} />
            </div>
            <div className="stat-label">Hosts</div>
          </div>
          <div className="stat-value">{counts.hosts || 0}</div>
        </div>
      </div>

      {/* Storage Systems */}
      {storage_systems.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header">
            <div className="preview-section-title">
              <HardDrive size={18} />
              <span>Storage Systems ({storage_systems.length})</span>
            </div>
          </div>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Serial</th>
                  <th>Capacity</th>
                  <th>Used</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {storage_systems.map((sys, idx) => (
                  <tr key={idx}>
                    <td><strong>{sys.name}</strong></td>
                    <td>{sys.type || 'N/A'}</td>
                    <td>{sys.model || 'N/A'}</td>
                    <td><code>{sys.serial_number || 'N/A'}</code></td>
                    <td>{formatBytes(sys.capacity_bytes)}</td>
                    <td>
                      <span style={{ color: sys.used_capacity_percent > 80 ? 'var(--color-danger-fg)' : 'inherit' }}>
                        {formatPercent(sys.used_capacity_percent)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '500',
                        background: (sys.status === 'Online' || sys.status === 'ok') ? 'var(--color-success-subtle)' : 'var(--color-attention-subtle)',
                        color: (sys.status === 'Online' || sys.status === 'ok') ? 'var(--color-success-fg)' : 'var(--color-attention-fg)'
                      }}>
                        {sys.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Volumes */}
      {volumes.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header">
            <div className="preview-section-title">
              <Database size={18} />
              <span>Volumes ({volumes.length > 10 ? `${volumes.length} - showing first 10` : volumes.length})</span>
            </div>
          </div>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Volume ID</th>
                  <th>Pool</th>
                  <th>Capacity</th>
                  <th>Used</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {volumes.slice(0, 10).map((vol, idx) => (
                  <tr key={idx}>
                    <td><strong>{vol.name}</strong></td>
                    <td><code>{vol.volume_id}</code></td>
                    <td>{vol.pool_name || 'N/A'}</td>
                    <td>{formatBytes(vol.capacity_bytes)}</td>
                    <td>{formatBytes(vol.used_capacity_bytes)}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '500',
                        background: 'var(--color-info-subtle)',
                        color: 'var(--color-info-fg)'
                      }}>
                        {vol.thin_provisioned === 'Yes' ? 'Thin' : 'Thick'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {volumes.length > 10 && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-2)', color: 'var(--muted-text)' }}>
                ... and {volumes.length - 10} more volumes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hosts */}
      {hosts.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header">
            <div className="preview-section-title">
              <Server size={18} />
              <span>Hosts ({hosts.length > 10 ? `${hosts.length} - showing first 10` : hosts.length})</span>
            </div>
          </div>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>WWPNs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hosts.slice(0, 10).map((host, idx) => (
                  <tr key={idx}>
                    <td><strong>{host.name}</strong></td>
                    <td>{host.host_type || 'N/A'}</td>
                    <td>
                      {host.wwpns && host.wwpns.length > 0 ? (
                        <>
                          {host.wwpns.slice(0, 3).map((wwpn, i) => (
                            <code key={i} style={{ marginRight: 'var(--space-1)', display: 'inline-block' }}>
                              {wwpn}
                            </code>
                          ))}
                          {host.wwpn_count > 3 && (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)',
                              background: 'var(--secondary-bg)',
                              color: 'var(--secondary-text)'
                            }}>
                              +{host.wwpn_count - 3} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--muted-text)' }}>No WWPNs</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '500',
                        background: host.status === 'Online' ? 'var(--color-success-subtle)' : 'var(--secondary-bg)',
                        color: host.status === 'Online' ? 'var(--color-success-fg)' : 'var(--secondary-text)'
                      }}>
                        {host.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hosts.length > 10 && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-2)', color: 'var(--muted-text)' }}>
                ... and {hosts.length - 10} more hosts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings/Errors */}
      {(previewData.warnings?.length > 0 || previewData.errors?.length > 0) && (
        <div>
          {previewData.errors?.map((error, idx) => (
            <div key={idx} className="alert alert-danger">
              <AlertCircle className="alert-icon" size={18} />
              <div className="alert-content">
                <div className="alert-message">{error}</div>
              </div>
            </div>
          ))}
          {previewData.warnings?.map((warning, idx) => (
            <div key={idx} className="alert alert-warning">
              <AlertCircle className="alert-icon" size={18} />
              <div className="alert-content">
                <div className="alert-message">{warning}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ready to Import Message */}
      <div className="step-content" style={{ textAlign: 'center' }}>
        <CheckCircle size={48} style={{ color: 'var(--color-success-fg)', marginBottom: 'var(--space-3)' }} />
        <h3 style={{ color: 'var(--primary-text)' }}>Preview Complete</h3>
        <p style={{ color: 'var(--secondary-text)', marginBottom: 'var(--space-2)' }}>
          Ready to import {counts.storage_systems} storage system{counts.storage_systems !== 1 ? 's' : ''},
          {' '}{counts.volumes} volume{counts.volumes !== 1 ? 's' : ''}, and
          {' '}{counts.hosts} host{counts.hosts !== 1 ? 's' : ''}.
        </p>
        <p style={{ color: 'var(--secondary-text)' }}>
          Click <strong style={{ color: 'var(--primary-text)' }}>"Start Import"</strong> below to begin the import process.
        </p>
      </div>
    </div>
  );
};

export default StoragePreview;
