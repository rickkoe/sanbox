import React, { useState, useEffect } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import axios from 'axios';
import './AuditLogFilters.css';

const AuditLogFilters = ({ filters, onFilterChange, onApply, onReset }) => {
    const [users, setUsers] = useState([]);
    const [customers, setCustomers] = useState([]);

    // Action types
    const actionTypes = [
        { value: '', label: 'All Actions' },
        { value: 'LOGIN', label: 'Login' },
        { value: 'LOGOUT', label: 'Logout' },
        { value: 'IMPORT', label: 'Import' },
        { value: 'BACKUP', label: 'Backup' },
        { value: 'RESTORE', label: 'Restore' },
        { value: 'CREATE', label: 'Create' },
        { value: 'UPDATE', label: 'Update' },
        { value: 'DELETE', label: 'Delete' },
        { value: 'EXPORT', label: 'Export' },
        { value: 'CONFIG_CHANGE', label: 'Config Change' }
    ];

    // Statuses
    const statuses = [
        { value: '', label: 'All Statuses' },
        { value: 'SUCCESS', label: 'Success' },
        { value: 'FAILED', label: 'Failed' },
        { value: 'CANCELLED', label: 'Cancelled' },
        { value: 'IN_PROGRESS', label: 'In Progress' }
    ];

    // Fetch users and customers for filters
    useEffect(() => {
        fetchUsers();
        fetchCustomers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/auth/user/');
            // This endpoint returns the current user, but we need all users
            // Let's try to get all users from a list endpoint if available
            // For now, we'll just skip the user filter or implement it later
            // setUsers(response.data);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await axios.get('/api/core/customers/');
            setCustomers(response.data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    };

    const handleChange = (field, value) => {
        onFilterChange({ ...filters, [field]: value });
    };

    // Count active filters
    const activeFilterCount = Object.values(filters).filter(v => v).length;

    return (
        <Card className="audit-log-filters">
            <Card.Body>
                <div className="audit-log-filters-header">
                    <h5 className="audit-log-filters-title">Filters</h5>
                    {activeFilterCount > 0 && (
                        <span className="audit-log-filters-badge">
                            {activeFilterCount}
                        </span>
                    )}
                </div>

                <Form className="audit-log-filters-form">
                    {/* Action Type Filter */}
                    <Form.Group className="mb-3">
                        <Form.Label className="audit-log-filter-label">
                            Action Type
                        </Form.Label>
                        <Form.Select
                            value={filters.action_type}
                            onChange={(e) => handleChange('action_type', e.target.value)}
                            className="audit-log-filter-select"
                        >
                            {actionTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {/* Status Filter */}
                    <Form.Group className="mb-3">
                        <Form.Label className="audit-log-filter-label">
                            Status
                        </Form.Label>
                        <Form.Select
                            value={filters.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="audit-log-filter-select"
                        >
                            {statuses.map((status) => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {/* Customer Filter */}
                    {customers.length > 0 && (
                        <Form.Group className="mb-3">
                            <Form.Label className="audit-log-filter-label">
                                Customer
                            </Form.Label>
                            <Form.Select
                                value={filters.customer_id}
                                onChange={(e) => handleChange('customer_id', e.target.value)}
                                className="audit-log-filter-select"
                            >
                                <option value="">All Customers</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    )}

                    {/* Date Range */}
                    <Form.Group className="mb-3">
                        <Form.Label className="audit-log-filter-label">
                            Start Date
                        </Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={filters.start_date}
                            onChange={(e) => handleChange('start_date', e.target.value)}
                            className="audit-log-filter-input"
                        />
                    </Form.Group>

                    <Form.Group className="mb-4">
                        <Form.Label className="audit-log-filter-label">
                            End Date
                        </Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={filters.end_date}
                            onChange={(e) => handleChange('end_date', e.target.value)}
                            className="audit-log-filter-input"
                        />
                    </Form.Group>

                    {/* Action Buttons */}
                    <div className="audit-log-filters-actions">
                        <Button
                            variant="primary"
                            onClick={onApply}
                            className="audit-log-filter-apply w-100 mb-2"
                        >
                            <i className="bi bi-funnel me-2"></i>
                            Apply Filters
                        </Button>

                        {activeFilterCount > 0 && (
                            <Button
                                variant="outline-secondary"
                                onClick={onReset}
                                className="audit-log-filter-reset w-100"
                            >
                                <i className="bi bi-x-circle me-2"></i>
                                Reset
                            </Button>
                        )}
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default AuditLogFilters;
