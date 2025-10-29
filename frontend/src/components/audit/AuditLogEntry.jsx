import React, { useState } from 'react';
import { Card, Badge, Collapse } from 'react-bootstrap';
import './AuditLogEntry.css';

const AuditLogEntry = ({ log }) => {
    const [expanded, setExpanded] = useState(false);

    // Get icon based on action type
    const getActionIcon = (actionType) => {
        const icons = {
            'LOGIN': 'box-arrow-in-right',
            'LOGOUT': 'box-arrow-right',
            'IMPORT': 'cloud-upload',
            'BACKUP': 'server',
            'RESTORE': 'arrow-counterclockwise',
            'CREATE': 'plus-circle',
            'UPDATE': 'pencil',
            'DELETE': 'trash',
            'EXPORT': 'cloud-download',
            'CONFIG_CHANGE': 'gear'
        };
        return icons[actionType] || 'activity';
    };

    // Get badge variant based on status
    const getStatusBadge = (status) => {
        const variants = {
            'SUCCESS': { variant: 'success', icon: 'check-circle' },
            'FAILED': { variant: 'danger', icon: 'x-circle' },
            'CANCELLED': { variant: 'warning', icon: 'exclamation-triangle' },
            'IN_PROGRESS': { variant: 'info', icon: 'hourglass-split' }
        };
        return variants[status] || { variant: 'secondary', icon: 'question-circle' };
    };

    // Format timestamp as relative time
    const formatRelativeTime = (timestamp) => {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

        return date.toLocaleDateString();
    };

    // Format full timestamp
    const formatFullTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Format duration
    const formatDuration = (seconds) => {
        if (!seconds) return null;
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const statusBadge = getStatusBadge(log.status);

    return (
        <Card className="audit-log-entry">
            <Card.Body>
                <div
                    className="audit-log-entry-header"
                    onClick={() => setExpanded(!expanded)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="audit-log-entry-icon">
                        <i className={`bi bi-${getActionIcon(log.action_type)}`}></i>
                    </div>

                    <div className="audit-log-entry-content">
                        <div className="audit-log-entry-top">
                            <div className="audit-log-entry-user">
                                {log.user_full_name || 'System'}
                            </div>
                            <div className="audit-log-entry-badges">
                                {log.customer_name && (
                                    <Badge bg="secondary" className="audit-log-customer-badge">
                                        {log.customer_name}
                                    </Badge>
                                )}
                                <Badge
                                    bg={statusBadge.variant}
                                    className="audit-log-status-badge"
                                >
                                    <i className={`bi bi-${statusBadge.icon} me-1`}></i>
                                    {log.status}
                                </Badge>
                            </div>
                        </div>

                        <div className="audit-log-entry-summary">
                            {log.summary}
                        </div>

                        <div className="audit-log-entry-meta">
                            <span
                                className="audit-log-entry-timestamp"
                                title={formatFullTime(log.timestamp)}
                            >
                                <i className="bi bi-clock me-1"></i>
                                {formatRelativeTime(log.timestamp)}
                            </span>

                            {log.duration_seconds && (
                                <span className="audit-log-entry-duration">
                                    <i className="bi bi-stopwatch me-1"></i>
                                    {formatDuration(log.duration_seconds)}
                                </span>
                            )}

                            {log.ip_address && (
                                <span className="audit-log-entry-ip">
                                    <i className="bi bi-hdd-network me-1"></i>
                                    {log.ip_address}
                                </span>
                            )}

                            {log.entity_name && (
                                <span className="audit-log-entry-entity">
                                    <i className="bi bi-tag me-1"></i>
                                    {log.entity_name}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="audit-log-entry-toggle">
                        <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}`}></i>
                    </div>
                </div>

                <Collapse in={expanded}>
                    <div className="audit-log-entry-details">
                        <div className="audit-log-details-header">
                            Details
                        </div>

                        <div className="audit-log-details-grid">
                            <div className="audit-log-detail-item">
                                <div className="audit-log-detail-label">Action Type</div>
                                <div className="audit-log-detail-value">{log.action_type}</div>
                            </div>

                            {log.entity_type && (
                                <div className="audit-log-detail-item">
                                    <div className="audit-log-detail-label">Entity Type</div>
                                    <div className="audit-log-detail-value">{log.entity_type}</div>
                                </div>
                            )}

                            <div className="audit-log-detail-item">
                                <div className="audit-log-detail-label">Timestamp</div>
                                <div className="audit-log-detail-value">
                                    {formatFullTime(log.timestamp)}
                                </div>
                            </div>

                            {log.user_username && (
                                <div className="audit-log-detail-item">
                                    <div className="audit-log-detail-label">Username</div>
                                    <div className="audit-log-detail-value">{log.user_username}</div>
                                </div>
                            )}
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                            <div className="audit-log-details-json">
                                <div className="audit-log-detail-label mb-2">
                                    Additional Data
                                </div>
                                <pre className="audit-log-json-content">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </Collapse>
            </Card.Body>
        </Card>
    );
};

export default AuditLogEntry;
