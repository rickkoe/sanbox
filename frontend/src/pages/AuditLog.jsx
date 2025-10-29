import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import AuditLogEntry from '../components/audit/AuditLogEntry';
import AuditLogFilters from '../components/audit/AuditLogFilters';
import './AuditLog.css';

const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize, setPageSize] = useState(50);

    // Filter state
    const [filters, setFilters] = useState({
        user_id: '',
        customer_id: '',
        action_type: '',
        status: '',
        start_date: '',
        end_date: ''
    });

    // Fetch audit logs
    const fetchLogs = async (page = 1) => {
        setLoading(true);
        setError(null);

        try {
            // Build query params
            const params = {
                page: page,
                page_size: pageSize
            };

            // Add filters if set
            if (filters.user_id) params.user_id = filters.user_id;
            if (filters.customer_id) params.customer_id = filters.customer_id;
            if (filters.action_type) params.action_type = filters.action_type;
            if (filters.status) params.status = filters.status;
            if (filters.start_date) params.start_date = filters.start_date;
            if (filters.end_date) params.end_date = filters.end_date;

            const response = await axios.get('/api/core/audit-log/', { params });

            setLogs(response.data.results);
            setTotalCount(response.data.count);
            setCurrentPage(response.data.page);
            setTotalPages(Math.ceil(response.data.count / pageSize));
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setError(err.response?.data?.error || 'Failed to fetch audit logs');
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchLogs();
    }, []);

    // Handle filter change
    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
    };

    // Handle filter apply
    const handleApplyFilters = () => {
        setCurrentPage(1);
        fetchLogs(1);
    };

    // Handle filter reset
    const handleResetFilters = () => {
        setFilters({
            user_id: '',
            customer_id: '',
            action_type: '',
            status: '',
            start_date: '',
            end_date: ''
        });
        setCurrentPage(1);
        // Will fetch after filters are reset
        setTimeout(() => fetchLogs(1), 0);
    };

    // Handle page change
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        fetchLogs(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Format last updated time
    const formatLastUpdated = () => {
        if (!lastUpdated) return '';
        const now = new Date();
        const diff = Math.floor((now - lastUpdated) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return lastUpdated.toLocaleString();
    };

    return (
        <Container fluid className="audit-log-page mt-4">
            <Row className="mb-4">
                <Col>
                    <h1 className="audit-log-title">Audit Log</h1>
                    <p className="audit-log-subtitle">
                        View all user actions and system activities
                    </p>
                </Col>
                <Col xs="auto">
                    <Button
                        variant="primary"
                        onClick={() => fetchLogs(currentPage)}
                        disabled={loading}
                        className="audit-log-refresh-button"
                    >
                        {loading ? (
                            <>
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                    className="me-2"
                                />
                                Loading...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-arrow-clockwise me-2"></i>
                                Refresh
                            </>
                        )}
                    </Button>
                </Col>
            </Row>

            {lastUpdated && (
                <Row className="mb-3">
                    <Col>
                        <small className="audit-log-last-updated">
                            Last updated: {formatLastUpdated()}
                        </small>
                    </Col>
                </Row>
            )}

            {error && (
                <Row className="mb-3">
                    <Col>
                        <Alert variant="danger" onClose={() => setError(null)} dismissible>
                            {error}
                        </Alert>
                    </Col>
                </Row>
            )}

            <Row>
                <Col lg={3} className="mb-4">
                    <AuditLogFilters
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onApply={handleApplyFilters}
                        onReset={handleResetFilters}
                    />
                </Col>

                <Col lg={9}>
                    {/* Results summary */}
                    <div className="audit-log-results-summary mb-3">
                        <span className="audit-log-count">
                            {totalCount} {totalCount === 1 ? 'activity' : 'activities'} found
                        </span>
                        {(currentPage > 1 || totalPages > 1) && (
                            <span className="audit-log-page-info">
                                {' '} (Page {currentPage} of {totalPages})
                            </span>
                        )}
                    </div>

                    {/* Log entries */}
                    {loading && logs.length === 0 ? (
                        <div className="audit-log-loading text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-3">Loading audit logs...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="audit-log-empty text-center py-5">
                            <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                            <p className="mt-3">No audit logs found</p>
                            <p className="text-muted">
                                {Object.values(filters).some(v => v)
                                    ? 'Try adjusting your filters'
                                    : 'Activities will appear here as they occur'}
                            </p>
                        </div>
                    ) : (
                        <div className="audit-log-timeline">
                            {logs.map((log) => (
                                <AuditLogEntry key={log.id} log={log} />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="audit-log-pagination mt-4">
                            <Button
                                variant="outline-secondary"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1 || loading}
                                className="me-2"
                            >
                                <i className="bi bi-chevron-left"></i> Previous
                            </Button>

                            <span className="audit-log-pagination-info">
                                Page {currentPage} of {totalPages}
                            </span>

                            <Button
                                variant="outline-secondary"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || loading}
                                className="ms-2"
                            >
                                Next <i className="bi bi-chevron-right"></i>
                            </Button>
                        </div>
                    )}
                </Col>
            </Row>
        </Container>
    );
};

export default AuditLog;
