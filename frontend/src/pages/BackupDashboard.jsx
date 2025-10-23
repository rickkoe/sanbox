import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Alert, Spinner, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  FaDatabase, FaCheckCircle, FaChartBar, FaClock, FaExclamationTriangle,
  FaUndo, FaInfoCircle, FaChartLine
} from 'react-icons/fa';
import backupService from '../services/backupService';

/**
 * Dashboard overview for backup system
 * Shows statistics, recent activity, storage usage, and health score
 */
const BackupDashboard = () => {
  const [backups, setBackups] = useState([]);
  const [restores, setRestores] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [backupsData, restoresData, configData] = await Promise.all([
        backupService.listBackups({ limit: 100 }),
        backupService.listRestores({ limit: 50 }),
        backupService.getConfig()
      ]);
      setBackups(backupsData);
      setRestores(restoresData);
      setConfig(configData);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = backupService.calculateStats(backups);

  const recentBackups = backups.slice(0, 5);
  const recentRestores = restores.slice(0, 5);

  // Calculate success rates
  const totalCompleted = backups.filter(b => b.status === 'completed' || b.status === 'verified').length;
  const totalFailed = backups.filter(b => b.status === 'failed').length;
  const totalAttempts = totalCompleted + totalFailed;
  const successRate = totalAttempts > 0 ? ((totalCompleted / totalAttempts) * 100).toFixed(1) : 0;

  const restoreCompleted = restores.filter(r => r.status === 'completed').length;
  const restoreFailed = restores.filter(r => r.status === 'failed').length;
  const restoreAttempts = restoreCompleted + restoreFailed;
  const restoreSuccessRate = restoreAttempts > 0 ? ((restoreCompleted / restoreAttempts) * 100).toFixed(1) : 0;

  // Calculate health score (0-100)
  const calculateHealthScore = () => {
    let score = 100;

    // Deduct points for failed backups
    const failureRate = totalAttempts > 0 ? (totalFailed / totalAttempts) * 100 : 0;
    score -= failureRate * 0.5;

    // Deduct points if no recent backups
    const daysSinceLastBackup = backups.length > 0
      ? (new Date() - new Date(backups[0].created_at)) / (1000 * 60 * 60 * 24)
      : 999;
    if (daysSinceLastBackup > 7) score -= 20;
    else if (daysSinceLastBackup > 3) score -= 10;

    // Deduct points if auto-backup not enabled
    if (config && !config.auto_backup_enabled) score -= 15;

    // Deduct points if too few backups
    if (stats.completed < 3) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const healthScore = calculateHealthScore();

  const getHealthStatus = () => {
    if (healthScore >= 90) return { label: 'Excellent', variant: 'success', icon: <FaCheckCircle className="text-success" /> };
    if (healthScore >= 75) return { label: 'Good', variant: 'primary', icon: <FaCheckCircle className="text-primary" /> };
    if (healthScore >= 50) return { label: 'Fair', variant: 'warning', icon: <FaExclamationTriangle className="text-warning" /> };
    return { label: 'Poor', variant: 'danger', icon: <FaExclamationTriangle className="text-danger" /> };
  };

  const healthStatus = getHealthStatus();

  if (loading && backups.length === 0) {
    return (
      <Container fluid className="p-4">
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading dashboard...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4">
      <Row className="mb-4">
        <Col>
          <h2>Backup & Restore Dashboard</h2>
          <p className="text-muted">Overview of your backup system health and activity</p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Health Score */}
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted mb-2">System Health Score</h6>
                  <h2 className="mb-0">
                    {healthStatus.icon} {healthScore}/100
                    <Badge bg={healthStatus.variant} className="ms-3">{healthStatus.label}</Badge>
                  </h2>
                </div>
                <div style={{ width: '200px' }}>
                  <ProgressBar
                    now={healthScore}
                    variant={healthStatus.variant}
                    label={`${healthScore}%`}
                    style={{ height: '30px', fontSize: '1rem' }}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Total Backups</p>
                  <h3 className="mb-0">{stats.total}</h3>
                </div>
                <div className="fs-1"><FaDatabase className="text-primary" /></div>
              </div>
              <div className="mt-2">
                <small className="text-success"><FaCheckCircle className="me-1" />{stats.completed} completed</small>
                {stats.failed > 0 && (
                  <small className="text-danger ms-2"><FaExclamationTriangle className="me-1" />{stats.failed} failed</small>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Total Storage</p>
                  <h3 className="mb-0">{backupService.formatSize(stats.totalSize)}</h3>
                </div>
                <div className="fs-1"><FaChartBar className="text-info" /></div>
              </div>
              <div className="mt-2">
                <small className="text-muted">{stats.withMedia} with media files</small>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Success Rate</p>
                  <h3 className="mb-0">{successRate}%</h3>
                </div>
                <div className="fs-1"><FaChartLine className="text-success" /></div>
              </div>
              <div className="mt-2">
                <small className="text-muted">{totalAttempts} total attempts</small>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">Auto Backup</p>
                  <h3 className="mb-0">
                    {config?.auto_backup_enabled ? (
                      <Badge bg="success">Enabled</Badge>
                    ) : (
                      <Badge bg="secondary">Disabled</Badge>
                    )}
                  </h3>
                </div>
                <div className="fs-1"><FaClock className="text-warning" /></div>
              </div>
              <div className="mt-2">
                {config?.auto_backup_enabled ? (
                  <small className="text-muted">Daily at {config.auto_backup_hour}:00</small>
                ) : (
                  <small className="text-warning">Not scheduled</small>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Restore Statistics */}
      {restores.length > 0 && (
        <Row className="mb-4">
          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1">Total Restores</p>
                    <h3 className="mb-0">{restores.length}</h3>
                  </div>
                  <div className="fs-1"><FaUndo className="text-primary" /></div>
                </div>
                <div className="mt-2">
                  <small className="text-success"><FaCheckCircle className="me-1" />{restoreCompleted} completed</small>
                  {restoreFailed > 0 && (
                    <small className="text-danger ms-2"><FaExclamationTriangle className="me-1" />{restoreFailed} failed</small>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1">Restore Success Rate</p>
                    <h3 className="mb-0">{restoreSuccessRate}%</h3>
                  </div>
                  <div className="fs-1"><FaCheckCircle className="text-success" /></div>
                </div>
                <div className="mt-2">
                  <small className="text-muted">{restoreAttempts} total attempts</small>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1">Last Restore</p>
                    <h5 className="mb-0">
                      {restores.length > 0 ? (
                        <small>{backupService.formatDate(restores[0].started_at)}</small>
                      ) : (
                        <small className="text-muted">Never</small>
                      )}
                    </h5>
                  </div>
                  <div className="fs-1"><FaClock className="text-info" /></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Recent Activity */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="mb-0"><FaDatabase className="me-2" />Recent Backups</h6>
                <Link to="/settings/backups" className="btn btn-sm btn-outline-primary">
                  View All
                </Link>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {recentBackups.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">No backups yet</p>
                  <small>Create your first backup to get started</small>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {recentBackups.map(backup => (
                    <div key={backup.id} className="list-group-item">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <div className="fw-bold">{backup.name}</div>
                          <small className="text-muted">
                            {backupService.formatDate(backup.created_at)}
                            {' • '}
                            {backupService.formatSize(backup.file_size)}
                          </small>
                        </div>
                        <Badge bg={backupService.getStatusVariant(backup.status)}>
                          {backupService.getStatusLabel(backup.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="mb-0"><FaUndo className="me-2" />Recent Restores</h6>
                <Link to="/settings/backups/restore-history" className="btn btn-sm btn-outline-primary">
                  View All
                </Link>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {recentRestores.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">No restores yet</p>
                  <small>Restore operations will appear here</small>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {recentRestores.map(restore => (
                    <div key={restore.id} className="list-group-item">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <div className="fw-bold">{restore.backup_name}</div>
                          <small className="text-muted">
                            {backupService.formatDate(restore.started_at)}
                            {restore.duration && ` • ${backupService.formatDuration(restore.duration)}`}
                          </small>
                        </div>
                        <Badge bg={backupService.getStatusVariant(restore.status)}>
                          {backupService.getStatusLabel(restore.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions & Warnings */}
      <Row>
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h6 className="mb-0"><FaInfoCircle className="me-2" />Recommendations</h6>
            </Card.Header>
            <Card.Body>
              {healthScore < 75 && (
                <>
                  {!config?.auto_backup_enabled && (
                    <Alert variant="warning" className="mb-2">
                      <FaExclamationTriangle className="me-2" />
                      <strong>Enable Automatic Backups:</strong> Schedule daily backups to protect your data.
                      <Link to="/settings/backups" className="alert-link ms-2">Configure now</Link>
                    </Alert>
                  )}

                  {stats.completed < 3 && (
                    <Alert variant="info" className="mb-2">
                      <FaInfoCircle className="me-2" />
                      <strong>Create More Backups:</strong> Having multiple backups improves disaster recovery options.
                      <Link to="/settings/backups" className="alert-link ms-2">Create backup</Link>
                    </Alert>
                  )}

                  {stats.failed > 0 && (
                    <Alert variant="danger" className="mb-2">
                      <FaExclamationTriangle className="me-2" />
                      <strong>Failed Backups Detected:</strong> Review failed backup logs to identify issues.
                      <Link to="/settings/backups" className="alert-link ms-2">View details</Link>
                    </Alert>
                  )}
                </>
              )}

              {healthScore >= 75 && (
                <Alert variant="success" className="mb-0">
                  <FaCheckCircle className="me-2" />
                  <strong>Backup System Healthy:</strong> Your backup system is operating well. Continue monitoring for optimal protection.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default BackupDashboard;
