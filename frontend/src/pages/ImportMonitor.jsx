import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Alert, Form, Collapse, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ImportMonitor.css';

const ImportMonitor = () => {
    const navigate = useNavigate();
    const [imports, setImports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [logs, setLogs] = useState({});
    const [cancelModalShow, setCancelModalShow] = useState(false);
    const [importToCancel, setImportToCancel] = useState(null);

    // Filter state
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // Fetch imports
    const fetchImports = useCallback(async () => {
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (typeFilter !== 'all') params.import_type = typeFilter;

            const response = await axios.get('/api/importer/my-imports/', { params });
            setImports(response.data.imports || []);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch imports:', err);
            setError('Failed to load import history');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter]);

    // Fetch logs for an import
    const fetchLogs = async (importId) => {
        try {
            const response = await axios.get(`/api/importer/logs/${importId}/`);
            setLogs(prev => ({
                ...prev,
                [importId]: response.data.logs || []
            }));
        } catch (err) {
            console.error(`Failed to fetch logs for import ${importId}:`, err);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchImports();
    }, [fetchImports]);

    // Auto-refresh for running imports
    useEffect(() => {
        const interval = setInterval(() => {
            const hasRunningImports = imports.some(imp => imp.status === 'running');
            if (hasRunningImports) {
                fetchImports();

                // Refresh logs for expanded running imports
                imports.forEach(imp => {
                    if (imp.status === 'running' && expandedRows.has(imp.id)) {
                        fetchLogs(imp.id);
                    }
                });
            }
        }, 5000); // 5 seconds

        return () => clearInterval(interval);
    }, [imports, expandedRows, fetchImports]);

    // Toggle row expansion
    const toggleRow = (importId) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(importId)) {
            newExpanded.delete(importId);
        } else {
            newExpanded.add(importId);
            // Fetch logs if not already loaded
            if (!logs[importId]) {
                fetchLogs(importId);
            }
        }
        setExpandedRows(newExpanded);
    };

    // Cancel import
    const handleCancelClick = (importRecord) => {
        setImportToCancel(importRecord);
        setCancelModalShow(true);
    };

    const confirmCancel = async () => {
        try {
            await axios.post(`/api/importer/cancel/${importToCancel.id}/`);
            setCancelModalShow(false);
            setImportToCancel(null);
            fetchImports(); // Refresh list
        } catch (err) {
            console.error('Failed to cancel import:', err);
            alert('Failed to cancel import: ' + (err.response?.data?.error || err.message));
        }
    };

    // Format duration
    const formatDuration = (duration) => {
        if (!duration) return '--';

        // Parse duration string like "0:05:23.456789"
        const parts = duration.split(':');
        if (parts.length === 3) {
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = Math.floor(parseFloat(parts[2]));

            if (hours > 0) {
                return `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            } else {
                return `${seconds}s`;
            }
        }
        return duration;
    };

    // Format relative time
    const formatRelativeTime = (timestamp) => {
        if (!timestamp) return '--';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        return `${seconds} sec ago`;
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const badges = {
            running: <Badge bg="primary"><Spinner animation="border" size="sm" className="me-1" />Running</Badge>,
            completed: <Badge bg="success">✓ Completed</Badge>,
            failed: <Badge bg="danger">✗ Failed</Badge>,
            cancelled: <Badge bg="warning">⊘ Cancelled</Badge>,
            pending: <Badge bg="secondary">Pending</Badge>
        };
        return badges[status] || <Badge bg="secondary">{status}</Badge>;
    };

    // Get import type badge
    const getTypeBadge = (importType) => {
        if (importType === 'san_config') {
            return <Badge bg="info">SAN Config</Badge>;
        } else if (importType === 'storage_insights') {
            return <Badge bg="info">Storage Insights</Badge>;
        }
        return <Badge bg="secondary">Unknown</Badge>;
    };

    // Format stats
    const formatStats = (importRecord) => {
        if (!importRecord.stats) return '--';

        const stats = importRecord.stats;
        if (importRecord.import_type === 'san_config') {
            const parts = [];
            if (stats.aliases_created) parts.push(`${stats.aliases_created} aliases`);
            if (stats.zones_created) parts.push(`${stats.zones_created} zones`);
            if (stats.fabrics_created) parts.push(`${stats.fabrics_created} fabrics`);
            return parts.join(', ') || '--';
        } else {
            const parts = [];
            if (stats.storage_systems) parts.push(`${stats.storage_systems} systems`);
            if (stats.volumes) parts.push(`${stats.volumes} volumes`);
            if (stats.hosts) parts.push(`${stats.hosts} hosts`);
            return parts.join(', ') || '--';
        }
    };

    // Calculate summary stats
    const summaryStats = {
        total: imports.length,
        running: imports.filter(i => i.status === 'running').length,
        completed: imports.filter(i => i.status === 'completed').length,
        failed: imports.filter(i => i.status === 'failed').length,
        cancelled: imports.filter(i => i.status === 'cancelled').length
    };

    if (loading) {
        return (
            <Container className="mt-4">
                <div className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            </Container>
        );
    }

    return (
        <Container fluid className="import-monitor-page mt-4">
            <Row className="mb-4">
                <Col>
                    <h2>Import History</h2>
                    <p className="text-muted">Monitor and manage all import jobs across the system</p>
                </Col>
            </Row>

            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Summary Stats */}
            <Row className="mb-4">
                <Col md={2}>
                    <Card className="stats-card text-center">
                        <Card.Body>
                            <h3>{summaryStats.total}</h3>
                            <small>Total</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={2}>
                    <Card className="stats-card text-center border-primary">
                        <Card.Body>
                            <h3>{summaryStats.running}</h3>
                            <small>Running</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={2}>
                    <Card className="stats-card text-center border-success">
                        <Card.Body>
                            <h3>{summaryStats.completed}</h3>
                            <small>Completed</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={2}>
                    <Card className="stats-card text-center border-danger">
                        <Card.Body>
                            <h3>{summaryStats.failed}</h3>
                            <small>Failed</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={2}>
                    <Card className="stats-card text-center border-warning">
                        <Card.Body>
                            <h3>{summaryStats.cancelled}</h3>
                            <small>Cancelled</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filters */}
            <Card className="filter-card mb-4">
                <Card.Body>
                    <Row>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Status</Form.Label>
                                <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="all">All Status</option>
                                    <option value="running">Running</option>
                                    <option value="completed">Completed</option>
                                    <option value="failed">Failed</option>
                                    <option value="cancelled">Cancelled</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Import Type</Form.Label>
                                <Form.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                                    <option value="all">All Types</option>
                                    <option value="san_config">SAN Configuration</option>
                                    <option value="storage_insights">Storage Insights</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4} className="d-flex align-items-end">
                            <Button variant="outline-secondary" onClick={() => {
                                setStatusFilter('all');
                                setTypeFilter('all');
                            }}>
                                Clear Filters
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Imports Table */}
            <Card className="imports-table-card">
                <Card.Body>
                    {imports.length === 0 ? (
                        <div className="empty-state">
                            <p>No imports found</p>
                            <Button variant="primary" onClick={() => navigate('/import/universal')}>
                                Start New Import
                            </Button>
                        </div>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th style={{width: '50px'}}></th>
                                    <th>Status</th>
                                    <th>Type</th>
                                    <th>Name</th>
                                    <th>User</th>
                                    <th>Customer</th>
                                    <th>Started</th>
                                    <th>Duration</th>
                                    <th>Stats</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {imports.map(importRecord => (
                                    <React.Fragment key={importRecord.id}>
                                        <tr
                                            className={expandedRows.has(importRecord.id) ? 'table-active' : ''}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td onClick={() => toggleRow(importRecord.id)}>
                                                <i className={`bi ${expandedRows.has(importRecord.id) ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                                            </td>
                                            <td>{getStatusBadge(importRecord.status)}</td>
                                            <td>{getTypeBadge(importRecord.import_type)}</td>
                                            <td>
                                                {importRecord.import_name || <span className="text-muted">Unnamed</span>}
                                                {importRecord.progress && (
                                                    <div className="progress mt-1">
                                                        <div
                                                            className="progress-bar progress-bar-striped progress-bar-animated"
                                                            style={{width: `${(importRecord.progress.current / importRecord.progress.total * 100)}%`}}
                                                        ></div>
                                                    </div>
                                                )}
                                            </td>
                                            <td>{importRecord.initiated_by || <span className="text-muted">—</span>}</td>
                                            <td>{importRecord.customer}</td>
                                            <td>
                                                <small>{formatRelativeTime(importRecord.started_at)}</small>
                                            </td>
                                            <td>{formatDuration(importRecord.duration)}</td>
                                            <td><small>{formatStats(importRecord)}</small></td>
                                            <td>
                                                {importRecord.status === 'running' && (
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleCancelClick(importRecord)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                                {importRecord.status === 'failed' && importRecord.error_message && (
                                                    <Button
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        onClick={() => toggleRow(importRecord.id)}
                                                    >
                                                        View Error
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan="10" className="p-0">
                                                <Collapse in={expandedRows.has(importRecord.id)}>
                                                    <div className="import-details-panel">
                                                        <Row>
                                                            <Col md={6}>
                                                                <h6>Import Details</h6>
                                                                <dl className="row">
                                                                    <dt className="col-sm-4">Import ID:</dt>
                                                                    <dd className="col-sm-8">{importRecord.id}</dd>

                                                                    <dt className="col-sm-4">Initiated By:</dt>
                                                                    <dd className="col-sm-8">{importRecord.initiated_by || <span className="text-muted">Unknown</span>}</dd>

                                                                    <dt className="col-sm-4">Started:</dt>
                                                                    <dd className="col-sm-8">{new Date(importRecord.started_at).toLocaleString()}</dd>

                                                                    {importRecord.completed_at && (
                                                                        <>
                                                                            <dt className="col-sm-4">Completed:</dt>
                                                                            <dd className="col-sm-8">{new Date(importRecord.completed_at).toLocaleString()}</dd>
                                                                        </>
                                                                    )}

                                                                    {importRecord.error_message && (
                                                                        <>
                                                                            <dt className="col-sm-4">Error:</dt>
                                                                            <dd className="col-sm-8">
                                                                                <Alert variant="danger" className="mb-0 py-1">
                                                                                    {importRecord.error_message}
                                                                                </Alert>
                                                                            </dd>
                                                                        </>
                                                                    )}
                                                                </dl>
                                                            </Col>
                                                            <Col md={6}>
                                                                <h6>Logs</h6>
                                                                <div className="logs-container">
                                                                    {logs[importRecord.id] ? (
                                                                        logs[importRecord.id].length > 0 ? (
                                                                            logs[importRecord.id].map((log, idx) => (
                                                                                <div key={idx} className={`log-entry log-${log.level.toLowerCase()}`}>
                                                                                    <span className="text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                                                    <span className={`ms-2 badge bg-${
                                                                                        log.level === 'ERROR' ? 'danger' :
                                                                                        log.level === 'WARNING' ? 'warning' :
                                                                                        log.level === 'INFO' ? 'info' : 'secondary'
                                                                                    }`}>{log.level}</span>
                                                                                    <span className="ms-2">{log.message}</span>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="text-muted">No logs available</div>
                                                                        )
                                                                    ) : (
                                                                        <div className="text-muted">Loading logs...</div>
                                                                    )}
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                </Collapse>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Cancel Confirmation Modal */}
            <Modal show={cancelModalShow} onHide={() => setCancelModalShow(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Cancel Import</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="warning">
                        <strong>Are you sure you want to cancel this import?</strong>
                    </Alert>
                    <p>The import will stop processing new items. Any data already imported will remain in the database.</p>
                    {importToCancel && (
                        <div className="mt-3">
                            <strong>Import Details:</strong>
                            <ul>
                                <li>Type: {importToCancel.import_type}</li>
                                <li>Started: {formatRelativeTime(importToCancel.started_at)}</li>
                                {importToCancel.import_name && <li>Name: {importToCancel.import_name}</li>}
                            </ul>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setCancelModalShow(false)}>
                        No, Keep Running
                    </Button>
                    <Button variant="danger" onClick={confirmCancel}>
                        Yes, Cancel Import
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ImportMonitor;
