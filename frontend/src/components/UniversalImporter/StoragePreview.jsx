import React from 'react';
import { Card, Badge, Table } from 'react-bootstrap';
import { HardDrive, Database, Server, CheckCircle, AlertCircle } from 'lucide-react';
import './styles/StoragePreview.css';

const StoragePreview = ({ previewData, theme }) => {
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
    <div className={`storage-preview theme-${theme}`}>
      <Card className="preview-summary-card mb-4">
        <Card.Header>
          <Database size={20} />
          <span>Import Summary</span>
        </Card.Header>
        <Card.Body>
          <div className="summary-stats">
            <div className="stat-item">
              <HardDrive size={24} />
              <div className="stat-content">
                <div className="stat-value">{counts.storage_systems || 0}</div>
                <div className="stat-label">Storage Systems</div>
              </div>
            </div>
            <div className="stat-item">
              <Database size={24} />
              <div className="stat-content">
                <div className="stat-value">{counts.volumes || 0}</div>
                <div className="stat-label">Volumes</div>
              </div>
            </div>
            <div className="stat-item">
              <Server size={24} />
              <div className="stat-content">
                <div className="stat-value">{counts.hosts || 0}</div>
                <div className="stat-label">Hosts</div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Storage Systems */}
      {storage_systems.length > 0 && (
        <Card className="preview-section-card mb-4">
          <Card.Header>
            <HardDrive size={20} />
            <span>Storage Systems ({storage_systems.length})</span>
          </Card.Header>
          <Card.Body>
            <Table striped hover responsive>
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
                      <span className={sys.used_capacity_percent > 80 ? 'text-danger' : ''}>
                        {formatPercent(sys.used_capacity_percent)}
                      </span>
                    </td>
                    <td>
                      <Badge bg={sys.status === 'Online' || sys.status === 'ok' ? 'success' : 'warning'}>
                        {sys.status || 'Unknown'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Volumes */}
      {volumes.length > 0 && (
        <Card className="preview-section-card mb-4">
          <Card.Header>
            <Database size={20} />
            <span>Volumes ({volumes.length > 10 ? `${volumes.length} - showing first 10` : volumes.length})</span>
          </Card.Header>
          <Card.Body>
            <Table striped hover responsive>
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
                      <Badge bg="info">
                        {vol.thin_provisioned === 'Yes' ? 'Thin' : 'Thick'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {volumes.length > 10 && (
              <div className="text-muted text-center mt-2">
                ... and {volumes.length - 10} more volumes
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Hosts */}
      {hosts.length > 0 && (
        <Card className="preview-section-card mb-4">
          <Card.Header>
            <Server size={20} />
            <span>Hosts ({hosts.length > 10 ? `${hosts.length} - showing first 10` : hosts.length})</span>
          </Card.Header>
          <Card.Body>
            <Table striped hover responsive>
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
                      <div className="wwpn-list">
                        {host.wwpns && host.wwpns.length > 0 ? (
                          <>
                            {host.wwpns.slice(0, 3).map((wwpn, i) => (
                              <code key={i} className="wwpn-code">{wwpn}</code>
                            ))}
                            {host.wwpn_count > 3 && (
                              <Badge bg="secondary" className="ms-1">
                                +{host.wwpn_count - 3} more
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted">No WWPNs</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge bg={host.status === 'Online' ? 'success' : 'secondary'}>
                        {host.status || 'Unknown'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {hosts.length > 10 && (
              <div className="text-muted text-center mt-2">
                ... and {hosts.length - 10} more hosts
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Warnings/Errors */}
      {(previewData.warnings?.length > 0 || previewData.errors?.length > 0) && (
        <Card className="preview-messages-card">
          <Card.Body>
            {previewData.errors?.length > 0 && (
              <div className="mb-3">
                {previewData.errors.map((error, idx) => (
                  <div key={idx} className="alert alert-danger d-flex align-items-center">
                    <AlertCircle size={16} className="me-2" />
                    {error}
                  </div>
                ))}
              </div>
            )}
            {previewData.warnings?.length > 0 && (
              <div>
                {previewData.warnings.map((warning, idx) => (
                  <div key={idx} className="alert alert-warning d-flex align-items-center">
                    <AlertCircle size={16} className="me-2" />
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Ready to Import Message */}
      <Card className="ready-message-card mt-4">
        <Card.Body className="text-center">
          <CheckCircle size={48} className="text-success mb-3" />
          <h4>Preview Complete</h4>
          <p className="text-muted">
            Ready to import {counts.storage_systems} storage system{counts.storage_systems !== 1 ? 's' : ''},
            {' '}{counts.volumes} volume{counts.volumes !== 1 ? 's' : ''}, and
            {' '}{counts.hosts} host{counts.hosts !== 1 ? 's' : ''}.
          </p>
          <p className="text-muted">
            Click <strong>"Start Import"</strong> below to begin the import process.
          </p>
        </Card.Body>
      </Card>
    </div>
  );
};

export default StoragePreview;
