import React, { useState, useEffect, useRef } from 'react';
import { Modal, Card, Badge, Button } from 'react-bootstrap';
import axios from 'axios';
import '../styles/importlogger.css';

const ImportLogger = ({ importId, isRunning, show, onHide }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const logContainerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive, but only if user is already at bottom
  useEffect(() => {
    if (logContainerRef.current && logs.length > 0) {
      const container = logContainerRef.current;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50; // 50px tolerance
      
      // Only auto-scroll if user was already at the bottom
      if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  // Handle scroll to show/hide scroll-to-bottom button
  const handleScroll = () => {
    if (logContainerRef.current) {
      const container = logContainerRef.current;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
      setShowScrollButton(!isAtBottom && logs.length > 0);
    }
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  // Fetch logs
  const fetchLogs = async (since = null) => {
    if (!importId) return;

    try {
      const params = { limit: 100 };
      if (since) params.since = since;

      const response = await axios.get(`/api/importer/logs/${importId}/`, { params });
      const newLogs = response.data.logs;

      if (since) {
        // Append new logs
        setLogs(prevLogs => [...prevLogs, ...newLogs]);
      } else {
        // Replace all logs
        setLogs(newLogs);
      }

      // Update last timestamp for next poll
      if (newLogs.length > 0) {
        setLastTimestamp(newLogs[newLogs.length - 1].timestamp);
      }
    } catch (error) {
      console.error('Error fetching import logs:', error);
    }
  };

  // Initial load
  useEffect(() => {
    if (importId) {
      setLoading(true);
      fetchLogs().finally(() => setLoading(false));
    }
  }, [importId]);

  // Real-time polling when import is running
  useEffect(() => {
    if (isRunning && importId) {
      pollIntervalRef.current = setInterval(() => {
        fetchLogs(lastTimestamp);
      }, 1000); // Poll every second for new logs

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isRunning, importId, lastTimestamp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const getLevelBadgeVariant = (level) => {
    switch (level) {
      case 'ERROR': return 'danger';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
      case 'DEBUG': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" dialogClassName="import-logger-modal">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <span className="me-3">Import Logs</span>
          {isRunning && (
            <Badge bg="success" className="me-2">Live</Badge>
          )}
          <Badge bg="secondary">{logs.length} entries</Badge>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 0, position: 'relative' }}>
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="import-logs-container"
          style={{
            height: '400px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}
        >
          {!importId ? (
            <div className="p-3 text-center text-muted">No import selected</div>
          ) : loading && logs.length === 0 ? (
            <div className="p-3 text-center text-muted">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-3 text-center text-muted">No logs available</div>
          ) : (
            <div>
              {logs.map((log, index) => (
                <div
                  key={`${log.id}-${index}`}
                  className={`p-2 border-bottom ${
                    log.level === 'ERROR' ? 'log-entry-error' :
                    log.level === 'WARNING' ? 'log-entry-warning' : ''
                  }`}
                >
                  <div className="d-flex align-items-center mb-1">
                    <Badge 
                      bg={getLevelBadgeVariant(log.level)} 
                      size="sm" 
                      className="me-2"
                      style={{ fontSize: '0.7rem', minWidth: '50px' }}
                    >
                      {log.level}
                    </Badge>
                    <small className="text-muted">
                      {formatTimestamp(log.timestamp)}
                    </small>
                  </div>
                  <div style={{ marginLeft: '60px' }} className="log-message">
                    {log.message}
                    {log.details && (
                      <details className="mt-1">
                        <summary style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                          Details
                        </summary>
                        <pre
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.5rem',
                            borderRadius: '0.25rem',
                            marginTop: '0.5rem',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            variant="primary"
            size="sm"
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '20px',
              zIndex: 1000,
              borderRadius: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            ↓ Scroll to Bottom
          </Button>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            {importId && (
              <>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await axios.post('/api/importer/test-logging/', { import_id: importId });
                      fetchLogs(); // Refresh logs
                    } catch (err) {
                      console.error('Test logging failed:', err);
                    }
                  }}
                >
                  Test Logs
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  className="ms-2"
                  onClick={async () => {
                    try {
                      const response = await axios.post('/api/importer/test-celery/');
                      console.log('Celery test response:', response.data);
                    } catch (err) {
                      console.error('Celery test failed:', err);
                    }
                  }}
                >
                  Test Celery
                </Button>
              </>
            )}
          </div>
          <div>
            <Button variant="secondary" onClick={onHide}>
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportLogger;