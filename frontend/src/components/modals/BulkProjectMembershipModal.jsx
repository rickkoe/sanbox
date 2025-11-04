import React, { useState, useEffect, useMemo } from 'react';
import './BulkProjectMembershipModal.css';

/**
 * Modal for bulk adding/removing items to/from a project
 *
 * Props:
 * - show: boolean - whether modal is visible
 * - onClose OR onHide: function - callback when modal is closed
 * - onSave: function(selectedIds) - callback when OK is clicked with array of selected item IDs
 * - items: array - list of all items to display
 * - itemType: string - "alias", "zone", "switch", "fabric", "storage", "volume", "host", "port"
 * - projectName: string - name of the active project (optional)
 * - entityDisplayField: string - field name to display (optional, defaults to "name")
 */
const BulkProjectMembershipModal = ({ show, onClose, onHide, onSave, items, itemType, projectName, entityDisplayField = "name" }) => {
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Support both onClose and onHide for compatibility
    const handleModalClose = onHide || onClose;

    // Initialize selected IDs from items already in project
    useEffect(() => {
        if (show) {
            if (items && items.length > 0) {
                const initialSelected = new Set(
                    items
                        .filter(item => item.in_active_project)
                        .map(item => item.id)
                );
                setSelectedIds(initialSelected);
                setLoading(false);
            } else {
                setLoading(true);
            }
        } else {
            // Reset when modal closes
            setLoading(true);
            setSearchFilter('');
        }
    }, [show, items]);

    // Filter items based on search text
    const filteredItems = useMemo(() => {
        if (!items) return [];

        if (!searchFilter.trim()) {
            return items;
        }

        const searchLower = searchFilter.toLowerCase();
        return items.filter(item =>
            item.name?.toLowerCase().includes(searchLower)
        );
    }, [items, searchFilter]);

    // Handle checkbox toggle
    const handleToggle = (itemId) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // Handle select all / deselect all
    const handleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            // Deselect all filtered items
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                filteredItems.forEach(item => newSet.delete(item.id));
                return newSet;
            });
        } else {
            // Select all filtered items
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                filteredItems.forEach(item => newSet.add(item.id));
                return newSet;
            });
        }
    };

    // Handle save
    const handleSave = async () => {
        setProcessing(true);
        try {
            await onSave(Array.from(selectedIds));
            handleModalClose();
        } catch (error) {
            console.error('Error saving project membership:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // Handle close/cancel
    const handleClose = () => {
        if (!processing) {
            setSearchFilter('');
            handleModalClose();
        }
    };

    if (!show) return null;

    // Pluralize entity types properly
    const pluralizeType = (type) => {
        const plurals = {
            'alias': 'aliases',
            'zone': 'zones',
            'switch': 'switches',
            'fabric': 'fabrics',
            'storage': 'storage systems',
            'volume': 'volumes',
            'host': 'hosts',
            'port': 'ports'
        };
        return plurals[type] || type + 's';
    };

    const itemTypePlural = pluralizeType(itemType);
    const selectedCount = selectedIds.size;
    const totalCount = items?.length || 0;
    const filteredCount = filteredItems.length;

    return (
        <div
            className="modal show d-block bulk-membership-modal"
            tabIndex="-1"
            style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                zIndex: 9999,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleClose();
                }
            }}
        >
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content shadow-lg">
                    {/* Header */}
                    <div className="modal-header">
                        <h5 className="modal-title">
                            Add/Remove {itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)}
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={handleClose}
                            disabled={processing}
                        ></button>
                    </div>

                    {/* Body */}
                    <div className="modal-body" style={{
                        maxHeight: '70vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Project info */}
                        {projectName && (
                            <div className="alert alert-info mb-3" style={{ fontSize: '14px' }}>
                                <strong>Project:</strong> {projectName}
                                <br />
                                Check {itemTypePlural} to add them to the project. Uncheck to remove them.
                            </div>
                        )}
                        {!projectName && (
                            <div className="alert alert-info mb-3" style={{ fontSize: '14px' }}>
                                Check {itemTypePlural} to add them to the active project. Uncheck to remove them.
                            </div>
                        )}

                        {/* Search filter */}
                        <div className="mb-3">
                            <div className="input-group">
                                <span className="input-group-text">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="m21 21-4.35-4.35"/>
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder={`Search ${itemTypePlural}...`}
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    disabled={processing}
                                />
                                {searchFilter && (
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => setSearchFilter('')}
                                        disabled={processing}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            {searchFilter && (
                                <small className="text-muted">
                                    Showing {filteredCount} of {totalCount} {itemTypePlural}
                                </small>
                            )}
                        </div>

                        {/* Select All / Deselect All button */}
                        {filteredItems.length > 0 && (
                            <div className="mb-2">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={handleSelectAll}
                                    disabled={processing}
                                >
                                    {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                                    {searchFilter && ' (filtered)'}
                                </button>
                            </div>
                        )}

                        {/* Item list */}
                        <div className="item-list-container" style={{
                            flex: 1,
                            overflowY: 'auto',
                            borderRadius: '4px',
                            padding: '8px',
                            maxHeight: '40vh'
                        }}>
                            {loading ? (
                                <div className="d-flex flex-column align-items-center justify-content-center py-5">
                                    <div className="spinner-border mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="text-muted">Loading {itemTypePlural}...</p>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="text-center text-muted py-4">
                                    {searchFilter ? 'No items match your search' : `No ${itemTypePlural} available`}
                                </div>
                            ) : (
                                filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`form-check py-2 px-2 ${selectedIds.has(item.id) ? 'selected' : ''}`}
                                        style={{
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onClick={() => !processing && handleToggle(item.id)}
                                    >
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => {}} // Handled by parent div onClick
                                            disabled={processing}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label
                                            className="form-check-label ms-2"
                                            style={{
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                width: '100%',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ fontWeight: selectedIds.has(item.id) ? '500' : '400' }}>
                                                {item.name}
                                            </span>
                                            {item.fabric_details?.name && (
                                                <span className="badge bg-secondary" style={{ fontSize: '11px' }}>
                                                    {item.fabric_details.name}
                                                </span>
                                            )}
                                            {item.fabric && !item.fabric_details && (
                                                <span className="badge bg-secondary" style={{ fontSize: '11px' }}>
                                                    {item.fabric}
                                                </span>
                                            )}
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <div className="text-muted" style={{ fontSize: '14px' }}>
                            {loading ? (
                                'Loading...'
                            ) : (
                                <>
                                    <strong>{selectedCount}</strong> of <strong>{totalCount}</strong> {itemTypePlural} selected
                                </>
                            )}
                        </div>
                        <div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleClose}
                                disabled={processing || loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={processing || loading}
                            >
                                {processing ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                                            <polyline points="20,6 9,17 4,12"/>
                                        </svg>
                                        OK
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkProjectMembershipModal;
