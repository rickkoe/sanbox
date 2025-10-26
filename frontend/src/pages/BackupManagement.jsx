import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert, Spinner, Table, InputGroup, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  FaDatabase, FaCheckCircle, FaChartBar, FaFolder, FaPlus, FaSyncAlt,
  FaCalendarAlt, FaSearch, FaDownload, FaHistory, FaChartLine,
  FaUndo, FaInfoCircle, FaFileAlt, FaShieldAlt, FaTrash, FaExclamationTriangle
} from 'react-icons/fa';
import backupService from '../services/backupService';
import ProgressTracker from '../components/backup/ProgressTracker';
import BackupLogsViewer from '../components/backup/BackupLogsViewer';
import BackupCompare from '../components/backup/BackupCompare';
import BackupScheduler from '../components/backup/BackupScheduler';
import '../styles/backup.css';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [filteredBackups, setFilteredBackups] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // Forms
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [includeMedia, setIncludeMedia] = useState(false);
  const [restoreMedia, setRestoreMedia] = useState(true);
  const [runMigrations, setRunMigrations] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await backupService.listBackups();
      setBackups(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching backups:', err);
      setError('Failed to load backups: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await backupService.getConfig();
      setConfig(response);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchConfig();
  }, [fetchBackups, fetchConfig]);

  // Auto-refresh for in-progress backups
  useEffect(() => {
    const hasInProgress = backups.some(b =>
      ['pending', 'in_progress', 'verifying'].includes(b.status)
    );

    if (hasInProgress) {
      const interval = setInterval(fetchBackups, 3000);
      return () => clearInterval(interval);
    }
  }, [backups, fetchBackups]);

  // Filter and sort backups
  useEffect(() => {
    let filtered = [...backups];

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term)) ||
        (b.app_version && b.app_version.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'size':
          aVal = a.file_size || 0;
          bVal = b.file_size || 0;
          break;
        case 'created_at':
        default:
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredBackups(filtered);
  }, [backups, statusFilter, searchTerm, sortBy, sortOrder]);

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      await backupService.createBackup({
        name: backupName || `Backup ${new Date().toLocaleString()}`,
        description: backupDescription,
        include_media: includeMedia,
        backup_type: 'full'
      });
      setShowCreateModal(false);
      setBackupName('');
      setBackupDescription('');
      setIncludeMedia(false);
      await fetchBackups();
      alert('Backup started successfully!');
    } catch (err) {
      console.error('Error creating backup:', err);
      alert('Failed to create backup: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    if (!window.confirm(
      `Are you sure you want to restore from backup "${selectedBackup.name}"?\n\nThis will replace your current database. A safety backup will be created first.`
    )) return;

    try {
      setLoading(true);
      await backupService.restoreBackup(selectedBackup.id, {
        restore_media: restoreMedia,
        run_migrations: runMigrations
      });
      setShowRestoreModal(false);
      alert('Restore started successfully! Monitor progress in Restore History.');
      await fetchBackups();
    } catch (err) {
      console.error('Error restoring backup:', err);
      alert('Failed to restore backup: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) return;
    try {
      await backupService.deleteBackup(backup.id);
      alert('Backup deleted successfully!');
      await fetchBackups();
    } catch (err) {
      console.error('Error deleting backup:', err);
      alert('Failed to delete backup: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleVerifyBackup = async (backup) => {
    try {
      await backupService.verifyBackup(backup.id);
      alert('Backup verification started!');
      await fetchBackups();
    } catch (err) {
      console.error('Error verifying backup:', err);
      alert('Failed to verify backup: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleViewDetails = async (backup) => {
    try {
      const response = await backupService.getBackup(backup.id);
      setSelectedBackup(response);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Error fetching backup details:', err);
      alert('Failed to load backup details');
    }
  };

  const handleViewLogs = async (backup) => {
    setSelectedBackup(backup);
    setShowLogsModal(true);
  };

  const handleExportCSV = () => {
    backupService.exportToCSV(filteredBackups);
  };

  // Calculate next scheduled backup time
  const getNextScheduledBackup = () => {
    if (!config || !config.auto_backup_enabled) {
      return null;
    }

    const now = new Date();
    const next = new Date();

    if (config.auto_backup_frequency === 'hourly') {
      // Next hour
      next.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      // Daily at configured hour
      next.setHours(config.auto_backup_hour, 0, 0, 0);
      // If the time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  };

  const nextBackup = getNextScheduledBackup();

  // Calculate statistics
  const stats = backupService.calculateStats(backups);

  return (
    <Container fluid className="p-4" id="backup-management-page">
      <style>
        {`
          #backup-management-page .backup-table-wrapper {
            overflow-x: auto;
            overflow-y: visible;
          }
          #backup-management-page .dropdown-menu {
            position: fixed !important;
            z-index: 9999 !important;
          }
          #backup-management-page .card-body {
            overflow: visible !important;
          }
        `}
      </style>
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h2>Backup & Restore Management</h2>
              <p className="text-muted">
                Create, manage, and restore database backups with schema version tracking
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link to="/settings/backups/dashboard" className="btn btn-outline-primary">
                <FaChartLine className="me-1" /> Dashboard
              </Link>
              <Link to="/settings/backups/restore-history" className="btn btn-outline-secondary">
                <FaHistory className="me-1" /> Restore History
              </Link>
            </div>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Next Scheduled Backup */}
      {config && (
        <Alert variant={config.auto_backup_enabled ? 'info' : 'warning'} className="mb-4">
          <div className="d-flex align-items-center">
            <FaCalendarAlt className="me-2" />
            <strong>Next Scheduled Backup {config.auto_backup_enabled && config.auto_backup_frequency && `(${config.auto_backup_frequency === 'hourly' ? 'Hourly' : 'Daily'})`}:</strong>
            <span className="ms-2">
              {config.auto_backup_enabled ? (
                nextBackup ? (
                  <>
                    {nextBackup.toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    <span className="text-muted ms-2">
                      ({config.auto_backup_frequency === 'hourly'
                        ? `${Math.ceil((nextBackup - new Date()) / (1000 * 60))} minutes from now`
                        : `${Math.ceil((nextBackup - new Date()) / (1000 * 60 * 60))} hours from now`
                      })
                    </span>
                  </>
                ) : (
                  'Calculating...'
                )
              ) : (
                <>
                  No schedule configured
                  <Button
                    variant="link"
                    size="sm"
                    className="ms-2 p-0"
                    onClick={() => setShowSchedulerModal(true)}
                  >
                    Configure now
                  </Button>
                </>
              )}
            </span>
          </div>
        </Alert>
      )}

      {/* Quick Stats */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <small className="text-muted">Total Backups</small>
                  <h4 className="mb-0">{stats.total}</h4>
                </div>
                <div className="fs-3"><FaDatabase className="text-primary" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <small className="text-muted">Completed</small>
                  <h4 className="mb-0 text-success">{stats.completed}</h4>
                </div>
                <div className="fs-3"><FaCheckCircle className="text-success" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <small className="text-muted">Total Storage</small>
                  <h4 className="mb-0">{backupService.formatSize(stats.totalSize)}</h4>
                </div>
                <div className="fs-3"><FaChartBar className="text-info" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <small className="text-muted">With Media</small>
                  <h4 className="mb-0">{stats.withMedia}</h4>
                </div>
                <div className="fs-3"><FaFolder className="text-warning" /></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Action Buttons */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <FaPlus className="me-1" /> Create Backup
            </Button>
            <Button variant="secondary" onClick={fetchBackups}>
              <FaSyncAlt className="me-1" /> Refresh
            </Button>
            <Button variant="outline-secondary" onClick={() => setShowSchedulerModal(true)}>
              <FaCalendarAlt className="me-1" /> Schedule
            </Button>
            <Button variant="outline-secondary" onClick={() => setShowCompareModal(true)} disabled={backups.length < 2}>
              <FaSearch className="me-1" /> Compare Backups
            </Button>
            <Button variant="outline-secondary" onClick={handleExportCSV} disabled={filteredBackups.length === 0}>
              <FaDownload className="me-1" /> Export to CSV
            </Button>
          </div>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Row className="mb-4">
        <Col md={4}>
          <InputGroup>
            <InputGroup.Text><FaSearch /></InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search backups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={3}>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="verified">Verified</option>
            <option value="failed">Failed</option>
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button
            variant="outline-secondary"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="w-100"
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </Button>
        </Col>
      </Row>

      <Row className="mb-2">
        <Col>
          <small className="text-muted">
            Showing {filteredBackups.length} of {backups.length} backups
            {(statusFilter !== 'ALL' || searchTerm) && ' (filtered)'}
          </small>
        </Col>
      </Row>

      {/* Backups Table */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm" style={{ overflow: 'visible' }}>
            <Card.Header className="bg-white">
              <h5 className="mb-0">Available Backups</h5>
            </Card.Header>
            <Card.Body className="p-0">
              {loading && backups.length === 0 ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2">Loading backups...</p>
                </div>
              ) : filteredBackups.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="fs-1 mb-3"><FaDatabase /></div>
                  <p className="mb-0">
                    {backups.length === 0
                      ? 'No backups found. Create your first backup to get started.'
                      : 'No backups match your filters.'}
                  </p>
                </div>
              ) : (
                <div className="backup-table-wrapper">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Size</th>
                        <th>Version</th>
                        <th>Media</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBackups.map(backup => (
                        <tr key={backup.id}>
                          <td>
                            <div>
                              <strong>{backup.name}</strong>
                              {backup.description && (
                                <div className="text-muted small">{backup.description}</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge bg={backupService.getStatusVariant(backup.status)}>
                              {backupService.getStatusLabel(backup.status)}
                            </Badge>
                          </td>
                          <td><small>{backupService.formatDate(backup.created_at)}</small></td>
                          <td>{backupService.formatSize(backup.file_size)}</td>
                          <td>
                            <div className="small">
                              <div>Django: {backup.django_version}</div>
                              <div>App: {backup.app_version || 'N/A'}</div>
                            </div>
                          </td>
                          <td className="text-center">
                            {backup.includes_media ? '✓' : '✗'}
                          </td>
                          <td>
                            <Dropdown align="end">
                              <Dropdown.Toggle variant="outline-secondary" size="sm">
                                Actions
                              </Dropdown.Toggle>
                              <Dropdown.Menu renderOnMount style={{ zIndex: 9999 }}>
                                <Dropdown.Item
                                  onClick={() => {
                                    setSelectedBackup(backup);
                                    setShowRestoreModal(true);
                                  }}
                                  disabled={backup.status !== 'completed' && backup.status !== 'verified'}
                                >
                                  <FaUndo className="me-2" /> Restore
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleViewDetails(backup)}>
                                  <FaInfoCircle className="me-2" /> Details
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleViewLogs(backup)}>
                                  <FaFileAlt className="me-2" /> View Logs
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => handleVerifyBackup(backup)}
                                  disabled={backup.status !== 'completed'}
                                >
                                  <FaShieldAlt className="me-2" /> Verify
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => backupService.downloadBackup(backup.id)}
                                  disabled={backup.status !== 'completed' && backup.status !== 'verified'}
                                >
                                  <FaDownload className="me-2" /> Download
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  onClick={() => handleDeleteBackup(backup)}
                                  disabled={backup.status === 'in_progress'}
                                  className="text-danger"
                                >
                                  <FaTrash className="me-2" /> Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
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

      {/* Create Backup Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Backup</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Backup Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Leave empty for auto-generated name"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Optional description"
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Include media files (increases backup size)"
                checked={includeMedia}
                onChange={(e) => setIncludeMedia(e.target.checked)}
              />
            </Form.Group>

            <Alert variant="info">
              <strong>What will be backed up:</strong>
              <ul className="mb-0 mt-2">
                <li>Complete PostgreSQL database</li>
                <li>Migration state for schema tracking</li>
                <li>Version information (Django, Python, PostgreSQL)</li>
                <li>Database statistics and table counts</li>
                {includeMedia && <li>Media files (uploaded content)</li>}
              </ul>
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateBackup}>
            Create Backup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Restore Modal */}
      <Modal show={showRestoreModal} onHide={() => setShowRestoreModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Restore from Backup</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBackup && (
            <>
              <Alert variant="warning">
                <FaExclamationTriangle className="me-2" />
                <strong>Warning:</strong> Restoring will replace your current database.
                A safety backup will be created automatically first.
              </Alert>

              <h6>Backup Information:</h6>
              <Table bordered size="sm" className="mb-3">
                <tbody>
                  <tr>
                    <td width="30%"><strong>Name:</strong></td>
                    <td>{selectedBackup.name}</td>
                  </tr>
                  <tr>
                    <td><strong>Created:</strong></td>
                    <td>{backupService.formatDate(selectedBackup.created_at)}</td>
                  </tr>
                  <tr>
                    <td><strong>Size:</strong></td>
                    <td>{backupService.formatSize(selectedBackup.file_size)}</td>
                  </tr>
                  <tr>
                    <td><strong>Django Version:</strong></td>
                    <td>{selectedBackup.django_version}</td>
                  </tr>
                </tbody>
              </Table>

              <h6>Restore Options:</h6>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Restore media files"
                    checked={restoreMedia}
                    onChange={(e) => setRestoreMedia(e.target.checked)}
                    disabled={!selectedBackup.includes_media}
                  />
                  {!selectedBackup.includes_media && (
                    <Form.Text className="text-muted">
                      This backup does not include media files
                    </Form.Text>
                  )}
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Run database migrations after restore (recommended)"
                    checked={runMigrations}
                    onChange={(e) => setRunMigrations(e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Automatically applies any pending migrations to ensure schema compatibility
                  </Form.Text>
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRestoreBackup}>
            Restore Backup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Backup Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBackup && (
            <>
              {/* Progress if in progress */}
              {['pending', 'in_progress', 'verifying'].includes(selectedBackup.status) && (
                <ProgressTracker operation={selectedBackup} showDetails={true} />
              )}

              {/* Basic Information */}
              <h6>Basic Information</h6>
              <Table bordered size="sm" className="mb-4">
                <tbody>
                  <tr>
                    <td width="30%"><strong>Name:</strong></td>
                    <td>{selectedBackup.name}</td>
                  </tr>
                  <tr>
                    <td><strong>Description:</strong></td>
                    <td>{selectedBackup.description || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Status:</strong></td>
                    <td>
                      <Badge bg={backupService.getStatusVariant(selectedBackup.status)}>
                        {backupService.getStatusLabel(selectedBackup.status)}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Created:</strong></td>
                    <td>{backupService.formatDate(selectedBackup.created_at)}</td>
                  </tr>
                  {selectedBackup.duration && (
                    <tr>
                      <td><strong>Duration:</strong></td>
                      <td>{backupService.formatDuration(selectedBackup.duration)}</td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* File Information */}
              <h6>File Information</h6>
              <Table bordered size="sm" className="mb-4">
                <tbody>
                  <tr>
                    <td width="30%"><strong>File Size:</strong></td>
                    <td>{backupService.formatSize(selectedBackup.file_size)}</td>
                  </tr>
                  <tr>
                    <td><strong>Checksum (SHA256):</strong></td>
                    <td><code className="small">{selectedBackup.checksum}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Includes Media:</strong></td>
                    <td>{selectedBackup.includes_media ? 'Yes' : 'No'}</td>
                  </tr>
                  {selectedBackup.includes_media && selectedBackup.media_file_size && (
                    <tr>
                      <td><strong>Media File Size:</strong></td>
                      <td>{backupService.formatSize(selectedBackup.media_file_size)}</td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Version Information */}
              <h6>Version Information</h6>
              <Table bordered size="sm" className="mb-4">
                <tbody>
                  <tr>
                    <td width="30%"><strong>Django Version:</strong></td>
                    <td>{selectedBackup.django_version}</td>
                  </tr>
                  <tr>
                    <td><strong>Python Version:</strong></td>
                    <td>{selectedBackup.python_version}</td>
                  </tr>
                  <tr>
                    <td><strong>PostgreSQL Version:</strong></td>
                    <td>{selectedBackup.postgres_version}</td>
                  </tr>
                  <tr>
                    <td><strong>App Version:</strong></td>
                    <td>{selectedBackup.app_version || 'N/A'}</td>
                  </tr>
                </tbody>
              </Table>

              {/* Migration State */}
              {selectedBackup.migration_state && Object.keys(selectedBackup.migration_state).length > 0 && (
                <>
                  <h6>Migration State</h6>
                  <div className="mb-4">
                    <small className="text-muted">
                      Total apps: {Object.keys(selectedBackup.migration_state).length}
                      {' • '}
                      Total migrations: {Object.values(selectedBackup.migration_state).reduce((sum, migs) => sum + migs.length, 0)}
                    </small>
                  </div>
                </>
              )}

              {/* Database Statistics */}
              {selectedBackup.table_counts && Object.keys(selectedBackup.table_counts).length > 0 && (
                <>
                  <h6>Database Statistics</h6>
                  <Table bordered size="sm" className="mb-4">
                    <tbody>
                      <tr>
                        <td width="30%"><strong>Database Size:</strong></td>
                        <td>{backupService.formatSize(selectedBackup.database_size)}</td>
                      </tr>
                      <tr>
                        <td><strong>Total Tables:</strong></td>
                        <td>{Object.keys(selectedBackup.table_counts).length}</td>
                      </tr>
                      <tr>
                        <td><strong>Total Rows:</strong></td>
                        <td>{Object.values(selectedBackup.table_counts).reduce((sum, count) => sum + count, 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </Table>
                </>
              )}

              {/* Error Message */}
              {selectedBackup.error_message && (
                <Alert variant="danger">
                  <strong>Error:</strong> {selectedBackup.error_message}
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

      {/* Logs Modal */}
      <Modal show={showLogsModal} onHide={() => setShowLogsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Backup Logs - {selectedBackup?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBackup && (
            <BackupLogsViewer
              backupId={selectedBackup.id}
              autoRefresh={['pending', 'in_progress', 'verifying'].includes(selectedBackup.status)}
              maxHeight="600px"
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLogsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Compare Modal */}
      <BackupCompare
        show={showCompareModal}
        onHide={() => setShowCompareModal(false)}
        backups={backups}
      />

      {/* Scheduler Modal */}
      <Modal show={showSchedulerModal} onHide={() => setShowSchedulerModal(false)} size="lg" dialogClassName="backup-scheduler-modal">
        <Modal.Header closeButton style={{ backgroundColor: 'var(--table-header-bg)', borderBottomColor: 'var(--table-border)', color: 'var(--table-header-text)' }}>
          <Modal.Title style={{ color: 'var(--primary-text)' }}>Backup Scheduler</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: 'var(--modal-bg)', color: 'var(--primary-text)', padding: 0 }}>
          <BackupScheduler
            onSave={() => {
              setShowSchedulerModal(false);
              fetchConfig(); // Refresh config to update "Next Scheduled Backup" banner
            }}
          />
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default BackupManagement;
