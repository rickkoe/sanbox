import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  FaUndo, FaCheckCircle, FaTimesCircle, FaCog, FaShieldAlt
} from 'react-icons/fa';
import backupService from '../services/backupService';
import ProgressTracker from '../components/backup/ProgressTracker';
import '../styles/backup.css';

/**
 * Restore history page
 * Shows all restore operations with details, status, and migration plans
 */
const RestoreHistory = () => {
  const [restores, setRestores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRestore, setSelectedRestore] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadRestores();
    // Auto-refresh every 5 seconds if there are active restores
    const interval = setInterval(() => {
      const hasActive = restores.some(r =>
        ['pending', 'validating', 'pre_backup', 'restoring', 'migrating'].includes(r.status)
      );
      if (hasActive) {
        loadRestores();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [restores]);

  const loadRestores = async () => {
    try {
      setLoading(true);
      const data = await backupService.listRestores({ limit: 100 });
      setRestores(data);
      setError(null);
    } catch (err) {
      console.error('Error loading restores:', err);
      setError('Failed to load restore history: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (restore) => {
    try {
      const details = await backupService.getRestore(restore.id);
      setSelectedRestore(details);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Error loading restore details:', err);
      alert('Failed to load restore details');
    }
  };

  // Calculate statistics
  const stats = {
    total: restores.length,
    completed: restores.filter(r => r.status === 'completed').length,
    failed: restores.filter(r => r.status === 'failed').length,
    inProgress: restores.filter(r =>
      ['pending', 'validating', 'pre_backup', 'restoring', 'migrating'].includes(r.status)
    ).length
  };

  if (loading && restores.length === 0) {
    return (
      <Container fluid className="p-4" id="restore-history-page">
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading restore history...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4" id="restore-history-page">
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h2>Restore History</h2>
              <p className="text-muted">
                Track all database restore operations and their outcomes
              </p>
            </div>
            <Link to="/settings/backups" className="btn btn-outline-primary">
              Back to Backups
            </Link>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Total Restores</p>
                  <h3 className="mb-0">{stats.total}</h3>
                </div>
                <div className="fs-1"><FaUndo className="text-primary" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Completed</p>
                  <h3 className="mb-0 text-success">{stats.completed}</h3>
                </div>
                <div className="fs-1"><FaCheckCircle className="text-success" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Failed</p>
                  <h3 className="mb-0 text-danger">{stats.failed}</h3>
                </div>
                <div className="fs-1"><FaTimesCircle className="text-danger" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">In Progress</p>
                  <h3 className="mb-0 text-primary">{stats.inProgress}</h3>
                </div>
                <div className="fs-1"><FaCog className="text-primary fa-spin" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Active Restores */}
      {stats.inProgress > 0 && (
        <Row className="mb-4">
          <Col>
            <Alert variant="info">
              <FaCog className="me-2 fa-spin" />
              <strong>Active Restores:</strong> {stats.inProgress} restore operation(s) currently in progress.
              This page will auto-refresh every 5 seconds.
            </Alert>
          </Col>
        </Row>
      )}

      {/* Restore List */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="mb-0">All Restore Operations</h6>
                <Button variant="outline-secondary" size="sm" onClick={loadRestores}>
                  Refresh
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {restores.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="fs-1 mb-3"><FaUndo /></div>
                  <p className="mb-0">No restore operations yet</p>
                  <small>Restore operations will appear here</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Restore ID</th>
                        <th>Backup Name</th>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Started By</th>
                        <th>Schema Compatible</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restores.map(restore => (
                        <tr key={restore.id}>
                          <td><code>#{restore.id}</code></td>
                          <td>
                            <strong>{restore.backup_name}</strong>
                            <div>
                              <small className="text-muted">
                                Backup ID: {restore.backup_id}
                              </small>
                            </div>
                          </td>
                          <td>
                            <Badge bg={backupService.getStatusVariant(restore.status)}>
                              {backupService.getStatusLabel(restore.status)}
                            </Badge>
                          </td>
                          <td>
                            <small>{backupService.formatDate(restore.started_at)}</small>
                          </td>
                          <td>
                            {restore.duration ? (
                              <small>{backupService.formatDuration(restore.duration)}</small>
                            ) : (
                              <small className="text-muted">In progress...</small>
                            )}
                          </td>
                          <td>
                            <small>{restore.started_by || 'System'}</small>
                          </td>
                          <td>
                            {restore.schema_compatible ? (
                              <Badge bg="success"><FaCheckCircle /></Badge>
                            ) : (
                              <Badge bg="warning"><FaShieldAlt /></Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() => handleViewDetails(restore)}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Restore Operation Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRestore && (
            <>
              {/* Progress Tracker */}
              <ProgressTracker operation={selectedRestore} showDetails={true} />

              {/* Basic Information */}
              <Card className="mb-3">
                <Card.Header>
                  <h6 className="mb-0">📋 Basic Information</h6>
                </Card.Header>
                <Card.Body>
                  <Table bordered size="sm">
                    <tbody>
                      <tr>
                        <td width="30%"><strong>Restore ID:</strong></td>
                        <td><code>#{selectedRestore.id}</code></td>
                      </tr>
                      <tr>
                        <td><strong>Backup:</strong></td>
                        <td>
                          {selectedRestore.backup_name}
                          <small className="text-muted ms-2">(ID: {selectedRestore.backup_id})</small>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Status:</strong></td>
                        <td>
                          <Badge bg={backupService.getStatusVariant(selectedRestore.status)}>
                            {backupService.getStatusLabel(selectedRestore.status)}
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Started:</strong></td>
                        <td>{backupService.formatDate(selectedRestore.started_at)}</td>
                      </tr>
                      {selectedRestore.completed_at && (
                        <>
                          <tr>
                            <td><strong>Completed:</strong></td>
                            <td>{backupService.formatDate(selectedRestore.completed_at)}</td>
                          </tr>
                          <tr>
                            <td><strong>Duration:</strong></td>
                            <td>{backupService.formatDuration(selectedRestore.duration)}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td><strong>Started By:</strong></td>
                        <td>{selectedRestore.started_by || 'System'}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              {/* Restore Options */}
              <Card className="mb-3">
                <Card.Header>
                  <h6 className="mb-0">⚙️ Restore Options</h6>
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="d-flex align-items-center">
                        {selectedRestore.restore_media ? '✅' : '❌'}
                        <span className="ms-2">Restore Media Files</span>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-center">
                        {selectedRestore.run_migrations ? '✅' : '❌'}
                        <span className="ms-2">Run Migrations</span>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-center">
                        {selectedRestore.schema_compatible ? '✅' : '⚠️'}
                        <span className="ms-2">Schema Compatible</span>
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Pre-Restore Safety Backup */}
              {selectedRestore.pre_restore_backup_id && (
                <Alert variant="info" className="mb-3">
                  <FaShieldAlt className="me-2" />
                  <strong>Safety Backup Created:</strong> A pre-restore safety backup was created
                  (ID: {selectedRestore.pre_restore_backup_id}) before starting the restore operation.
                </Alert>
              )}

              {/* Migration Information */}
              {selectedRestore.migrations_run && Object.keys(selectedRestore.migrations_run).length > 0 && (
                <Card className="mb-3">
                  <Card.Header>
                    <h6 className="mb-0">🔄 Migrations Applied</h6>
                  </Card.Header>
                  <Card.Body>
                    {Object.entries(selectedRestore.migrations_run).map(([app, migrations]) => (
                      <div key={app} className="mb-2">
                        <strong>{app}:</strong>
                        <ul className="mb-0">
                          {migrations.map((mig, idx) => (
                            <li key={idx}><code>{mig}</code></li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              )}

              {/* Error Message */}
              {selectedRestore.error_message && (
                <Alert variant="danger">
                  <strong>❌ Error:</strong>
                  <div className="mt-2">{selectedRestore.error_message}</div>
                </Alert>
              )}

              {/* Compatibility Warnings */}
              {selectedRestore.compatibility_warnings && selectedRestore.compatibility_warnings.length > 0 && (
                <Alert variant="warning">
                  <strong>⚠️ Compatibility Warnings:</strong>
                  <ul className="mb-0 mt-2">
                    {selectedRestore.compatibility_warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default RestoreHistory;
