import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Badge, Button, Spinner, Alert, InputGroup } from 'react-bootstrap';
import {
  FaFileAlt, FaSearch, FaDownload, FaBug, FaInfoCircle,
  FaExclamationTriangle, FaTimesCircle
} from 'react-icons/fa';
import backupService from '../../services/backupService';

/**
 * Live log viewer for backup and restore operations
 * Features: real-time streaming, filtering, search, auto-scroll, download
 */
const BackupLogsViewer = ({ backupId, autoRefresh = true, maxHeight = '400px' }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await backupService.getBackupLogs(backupId, 1000);
        setLogs(response.logs || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching logs:', err);
        setError('Failed to load logs: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    // Auto-refresh logs if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [backupId, autoRefresh]);

  const handleUserScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const getLevelBadge = (level) => {
    const variants = {
      'DEBUG': 'secondary',
      'INFO': 'primary',
      'WARNING': 'warning',
      'ERROR': 'danger'
    };
    return <Badge bg={variants[level] || 'secondary'} className="me-2">{level}</Badge>;
  };

  const getLevelIcon = (level) => {
    const icons = {
      'DEBUG': <FaBug />,
      'INFO': <FaInfoCircle />,
      'WARNING': <FaExclamationTriangle />,
      'ERROR': <FaTimesCircle />
    };
    return icons[level] || <FaFileAlt />;
  };

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
    const matchesSearch = !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const downloadLogs = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      return `[${timestamp}] [${log.level}] ${log.message}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backup_${backupId}_logs_${new Date().toISOString()}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0"><FaFileAlt className="me-2" />Operation Logs</h6>
          <div className="d-flex gap-2">
            <Form.Check
              type="switch"
              id="auto-scroll-switch"
              label={<small>Auto-scroll</small>}
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={downloadLogs}
              disabled={filteredLogs.length === 0}
            >
              <FaDownload className="me-1" /> Download
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {/* Filters */}
        <div className="p-3 border-bottom bg-light">
          <div className="row g-2">
            <div className="col-md-6">
              <InputGroup size="sm">
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </div>
            <div className="col-md-6">
              <Form.Select
                size="sm"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
              >
                <option value="ALL">All Levels</option>
                <option value="DEBUG">Debug</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Error</option>
              </Form.Select>
            </div>
          </div>
          <div className="mt-2">
            <small className="text-muted">
              Showing {filteredLogs.length} of {logs.length} logs
              {autoRefresh && <span className="ms-2">• Auto-refreshing every 3s</span>}
            </small>
          </div>
        </div>

        {/* Logs Display */}
        <div
          ref={logsContainerRef}
          onScroll={handleUserScroll}
          style={{
            maxHeight,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4'
          }}
        >
          {loading && logs.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="light" size="sm" />
              <p className="mt-2 mb-0">Loading logs...</p>
            </div>
          ) : error ? (
            <Alert variant="danger" className="m-3">
              {error}
            </Alert>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-0">No logs found</p>
              {(filterLevel !== 'ALL' || searchTerm) && (
                <small>Try adjusting your filters</small>
              )}
            </div>
          ) : (
            <div className="p-3">
              {filteredLogs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="log-entry mb-2"
                  style={{
                    borderLeft: `3px solid ${
                      log.level === 'ERROR' ? '#dc3545' :
                      log.level === 'WARNING' ? '#ffc107' :
                      log.level === 'INFO' ? '#0dcaf0' :
                      '#6c757d'
                    }`,
                    paddingLeft: '10px'
                  }}
                >
                  <div className="d-flex align-items-start">
                    <span className="me-2">{getLevelIcon(log.level)}</span>
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-1">
                        {getLevelBadge(log.level)}
                        <small style={{ color: '#858585' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </small>
                      </div>
                      <div style={{ color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>
                        {log.message}
                      </div>
                      {log.details && (
                        <details className="mt-1">
                          <summary style={{ color: '#858585', cursor: 'pointer' }}>
                            <small>View details</small>
                          </summary>
                          <pre
                            className="mt-1 mb-0"
                            style={{
                              color: '#858585',
                              fontSize: '0.75rem',
                              backgroundColor: '#2d2d2d',
                              padding: '5px',
                              borderRadius: '3px'
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default BackupLogsViewer;
