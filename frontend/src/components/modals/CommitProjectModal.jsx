import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { ConfigContext } from '../../context/ConfigContext';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import './CommitProjectModal.css';

/**
 * Modal for committing project changes to Customer View
 *
 * Shows categorized preview of changes:
 * - To Be Deleted (delete_me=true)
 * - To Be Modified (action='modified')
 * - Unmodified (action='unmodified')
 * - Newly Created (action='new')
 *
 * Props:
 * - show: boolean - whether modal is visible
 * - onClose: function - callback when modal is closed
 * - onSuccess: function - callback when commit succeeds
 * - projectId: number - ID of the project to commit
 * - projectName: string - name of the project
 */
const CommitProjectModal = ({ show, onClose, onSuccess, projectId, projectName }) => {
    const { refreshConfig, refreshProjectsList } = useContext(ConfigContext);
    const { setProjectFilter } = useProjectFilter();
    const [loading, setLoading] = useState(true);
    const [committing, setCommitting] = useState(false);
    const [error, setError] = useState(null);
    const [closeAfterCommit, setCloseAfterCommit] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    // Collapse state for each entity type within each category
    const [collapsed, setCollapsed] = useState({});

    // Selection state: { entityType: Set of selected entity IDs }
    const [selected, setSelected] = useState({});

    // Entity types in display order
    const entityTypes = [
        { key: 'fabrics', label: 'Fabrics' },
        { key: 'switches', label: 'Switches' },
        { key: 'aliases', label: 'Aliases' },
        { key: 'zones', label: 'Zones' },
        { key: 'storage', label: 'Storage Systems' },
        { key: 'volumes', label: 'Volumes' },
        { key: 'hosts', label: 'Hosts' },
        { key: 'ports', label: 'Ports' }
    ];

    // Fetch preview data when modal opens
    useEffect(() => {
        if (show && projectId) {
            fetchPreview();
        }
    }, [show, projectId]);

    // Initialize selection and collapse state when preview data loads
    useEffect(() => {
        if (previewData) {
            initializeStates();
        }
    }, [previewData]);

    const initializeStates = () => {
        const newCollapsed = {};
        const newSelected = {};
        const categories = ['to_delete', 'to_modify', 'newly_created', 'unmodified'];

        categories.forEach(category => {
            if (previewData[category]) {
                entityTypes.forEach(({ key }) => {
                    const entities = previewData[category][key] || [];
                    if (entities.length > 0) {
                        // Start collapsed by default
                        newCollapsed[`${category}_${key}`] = true;
                        // Select all by default
                        entities.forEach(entity => {
                            const selectionKey = `${category}_${key}_${entity.id}`;
                            newSelected[selectionKey] = true;
                        });
                    }
                });
            }
        });

        setCollapsed(newCollapsed);
        setSelected(newSelected);
    };

    const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/api/core/projects/${projectId}/commit-preview/`);
            setPreviewData(response.data);
        } catch (err) {
            console.error('Error fetching commit preview:', err);
            setError(err.response?.data?.error || 'Failed to load commit preview');
        } finally {
            setLoading(false);
        }
    };

    // Build the selected entities payload for the API
    const buildSelectedPayload = () => {
        const payload = {
            fabrics: [],
            switches: [],
            aliases: [],
            zones: [],
            storage: [],
            volumes: [],
            hosts: [],
            ports: []
        };

        const categories = ['to_delete', 'to_modify', 'newly_created', 'unmodified'];

        categories.forEach(category => {
            if (previewData && previewData[category]) {
                entityTypes.forEach(({ key }) => {
                    const entities = previewData[category][key] || [];
                    entities.forEach(entity => {
                        const selectionKey = `${category}_${key}_${entity.id}`;
                        if (selected[selectionKey]) {
                            // Add entity ID with its category for the backend
                            payload[key].push({
                                id: entity.id,
                                category: category
                            });
                        }
                    });
                });
            }
        });

        return payload;
    };

    // Count total selected entities
    const totalSelectedCount = useMemo(() => {
        return Object.values(selected).filter(Boolean).length;
    }, [selected]);

    // Count total available entities
    const totalAvailableCount = useMemo(() => {
        if (!previewData) return 0;
        let count = 0;
        const categories = ['to_delete', 'to_modify', 'newly_created', 'unmodified'];
        categories.forEach(category => {
            if (previewData[category]) {
                entityTypes.forEach(({ key }) => {
                    count += (previewData[category][key] || []).length;
                });
            }
        });
        return count;
    }, [previewData]);

    const handleCommit = async () => {
        setCommitting(true);
        setError(null);
        try {
            const selectedEntities = buildSelectedPayload();
            const response = await axios.post(`/api/core/projects/${projectId}/commit-execute/`, {
                close_project: closeAfterCommit,
                selected_entities: selectedEntities
            });

            if (response.data.success) {
                // If project was closed, refresh config to clear project from navbar
                if (response.data.project_closed) {
                    if (refreshConfig) {
                        await refreshConfig();
                    }
                    // Refresh projects list to remove deleted project from dropdown
                    if (refreshProjectsList) {
                        refreshProjectsList();
                    }
                    // Reset all tables to Customer View when project is deleted
                    setProjectFilter('all');
                }

                if (onSuccess) {
                    onSuccess();
                }
                onClose();
            }
        } catch (err) {
            console.error('Error committing project:', err);
            if (err.response?.status === 409) {
                setError('Cannot commit: conflicts detected. ' + (err.response.data.error || ''));
            } else {
                setError(err.response?.data?.error || 'Failed to commit project');
            }
        } finally {
            setCommitting(false);
        }
    };

    // Toggle collapse state for an entity type
    const toggleCollapse = (category, entityType) => {
        const key = `${category}_${entityType}`;
        setCollapsed(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Toggle selection for a single entity
    const toggleEntitySelection = (category, entityType, entityId) => {
        const key = `${category}_${entityType}_${entityId}`;
        setSelected(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Toggle selection for all entities of a type within a category
    const toggleTypeSelection = (category, entityType) => {
        const entities = previewData[category]?.[entityType] || [];
        if (entities.length === 0) return;

        // Check if all are currently selected
        const allSelected = entities.every(entity =>
            selected[`${category}_${entityType}_${entity.id}`]
        );

        const newSelected = { ...selected };
        entities.forEach(entity => {
            newSelected[`${category}_${entityType}_${entity.id}`] = !allSelected;
        });
        setSelected(newSelected);
    };

    // Check if all entities of a type are selected
    const isTypeFullySelected = (category, entityType) => {
        const entities = previewData[category]?.[entityType] || [];
        if (entities.length === 0) return false;
        return entities.every(entity =>
            selected[`${category}_${entityType}_${entity.id}`]
        );
    };

    // Check if some (but not all) entities of a type are selected
    const isTypePartiallySelected = (category, entityType) => {
        const entities = previewData[category]?.[entityType] || [];
        if (entities.length === 0) return false;
        const selectedCount = entities.filter(entity =>
            selected[`${category}_${entityType}_${entity.id}`]
        ).length;
        return selectedCount > 0 && selectedCount < entities.length;
    };

    // Get count of selected entities for a type
    const getTypeSelectedCount = (category, entityType) => {
        const entities = previewData[category]?.[entityType] || [];
        return entities.filter(entity =>
            selected[`${category}_${entityType}_${entity.id}`]
        ).length;
    };

    // Select all entities
    const selectAll = () => {
        const newSelected = {};
        const categories = ['to_delete', 'to_modify', 'newly_created', 'unmodified'];
        categories.forEach(category => {
            if (previewData[category]) {
                entityTypes.forEach(({ key }) => {
                    const entities = previewData[category][key] || [];
                    entities.forEach(entity => {
                        newSelected[`${category}_${key}_${entity.id}`] = true;
                    });
                });
            }
        });
        setSelected(newSelected);
    };

    // Deselect all entities
    const deselectAll = () => {
        setSelected({});
    };

    // Count entities in a category across all types
    const countEntities = (category) => {
        if (!previewData || !previewData[category]) return 0;
        return Object.values(previewData[category]).reduce((sum, arr) => sum + arr.length, 0);
    };

    // Render entity list for a specific type with collapsible header and checkboxes
    const renderEntityList = (category, entityType, typeLabel) => {
        const entities = previewData[category]?.[entityType] || [];
        if (entities.length === 0) return null;

        const collapseKey = `${category}_${entityType}`;
        const isCollapsed = collapsed[collapseKey];
        const selectedCount = getTypeSelectedCount(category, entityType);
        const isFullySelected = isTypeFullySelected(category, entityType);
        const isPartiallySelected = isTypePartiallySelected(category, entityType);

        return (
            <div className="commit-modal-entity-group">
                <div
                    className="commit-modal-entity-type-header"
                    onClick={() => toggleCollapse(category, entityType)}
                >
                    <div className="commit-modal-entity-type-left">
                        <svg
                            className={`commit-modal-chevron ${isCollapsed ? '' : 'expanded'}`}
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="currentColor"
                        >
                            <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="2" fill="none"/>
                        </svg>
                        <span className="commit-modal-entity-type">{typeLabel}</span>
                        <span className="commit-modal-entity-count">
                            ({selectedCount}/{entities.length})
                        </span>
                    </div>
                    <div
                        className="commit-modal-type-checkbox-wrapper"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTypeSelection(category, entityType);
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isFullySelected}
                            ref={(el) => {
                                if (el) el.indeterminate = isPartiallySelected;
                            }}
                            onChange={() => {}}
                            className="commit-modal-type-checkbox"
                        />
                    </div>
                </div>
                {!isCollapsed && (
                    <ul className="commit-modal-entity-list">
                        {entities.map(entity => {
                            const selectionKey = `${category}_${entityType}_${entity.id}`;
                            const isSelected = selected[selectionKey];
                            return (
                                <li key={entity.id} className={isSelected ? '' : 'deselected'}>
                                    <label className="commit-modal-entity-label">
                                        <input
                                            type="checkbox"
                                            checked={isSelected || false}
                                            onChange={() => toggleEntitySelection(category, entityType, entity.id)}
                                            className="commit-modal-entity-checkbox"
                                        />
                                        <span>{entity.name}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );
    };

    // Render a category section
    const renderCategory = (categoryKey, categoryTitle, categoryClass) => {
        if (!previewData || !previewData[categoryKey]) return null;

        const totalCount = countEntities(categoryKey);

        if (totalCount === 0) return null;

        return (
            <div className={`commit-modal-category ${categoryClass}`}>
                <div className="commit-modal-category-header">
                    <svg className="commit-modal-category-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        {getCategoryIcon(categoryKey)}
                    </svg>
                    <h4>{categoryTitle} ({totalCount})</h4>
                </div>
                <div className="commit-modal-category-content">
                    {entityTypes.map(({ key, label }) =>
                        renderEntityList(categoryKey, key, label)
                    )}
                </div>
            </div>
        );
    };

    // Get SVG icon path for category
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'to_delete':
                return <path d="M6 2l2-2h4l2 2h4v2H2V2h4zM3 6h14l-1 14H4L3 6zm5 2v10h1V8H8zm3 0v10h1V8h-1z"/>;
            case 'to_modify':
                return <path d="M2 13.5l8 5 8-5V5l-8-5-8 5v8.5zM10 1l6 3.5v7L10 15l-6-3.5v-7L10 1z"/>;
            case 'unmodified':
                return <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm0 16a7 7 0 110-14 7 7 0 010 14zm-1-4h2v2H9v-2zm0-8h2v6H9V5z"/>;
            case 'newly_created':
                return <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>;
            default:
                return null;
        }
    };

    if (!show) return null;

    return (
        <div className="commit-modal-overlay" onClick={onClose}>
            <div className="commit-modal-container" onClick={e => e.stopPropagation()}>
                <div className="commit-modal-header">
                    <h3>Commit Project Changes</h3>
                    <button className="commit-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="commit-modal-body">
                    {loading && (
                        <div className="commit-modal-loading">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p>Loading commit preview...</p>
                        </div>
                    )}

                    {error && (
                        <div className="commit-modal-error">
                            <svg className="commit-modal-error-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    {!loading && !error && previewData && (
                        <>
                            <div className="commit-modal-project-info">
                                <strong>Project:</strong> {projectName}
                            </div>

                            {previewData.has_conflicts && (
                                <div className="commit-modal-conflicts">
                                    <svg className="commit-modal-warning-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2L2 18h16L10 2zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                                    </svg>
                                    <div>
                                        <strong>Warning: Conflicts Detected</strong>
                                        <p>Other projects have conflicting changes. Review conflicts before committing.</p>
                                    </div>
                                </div>
                            )}

                            {previewData.total_changes === 0 && (
                                <div className="commit-modal-no-changes">
                                    <svg className="commit-modal-info-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                                    </svg>
                                    No changes to commit. Only unmodified references will be marked as committed.
                                </div>
                            )}

                            {totalAvailableCount > 0 && (
                                <div className="commit-modal-selection-controls">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={selectAll}
                                        disabled={committing}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={deselectAll}
                                        disabled={committing}
                                    >
                                        Deselect All
                                    </button>
                                    <span className="commit-modal-selection-count">
                                        {totalSelectedCount} of {totalAvailableCount} selected
                                    </span>
                                </div>
                            )}

                            <div className="commit-modal-categories">
                                {renderCategory('to_delete', 'To Be Deleted', 'category-delete')}
                                {renderCategory('to_modify', 'To Be Modified', 'category-modify')}
                                {renderCategory('newly_created', 'Newly Created', 'category-create')}
                                {renderCategory('unmodified', 'Unmodified References', 'category-unmodified')}
                            </div>
                        </>
                    )}
                </div>

                <div className="commit-modal-footer">
                    <div className="commit-modal-footer-left">
                        <label className="commit-modal-checkbox-label">
                            <input
                                type="checkbox"
                                checked={closeAfterCommit}
                                onChange={(e) => setCloseAfterCommit(e.target.checked)}
                                disabled={committing || loading}
                            />
                            <span>Close project after commit</span>
                        </label>
                    </div>
                    <div className="commit-modal-footer-right">
                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={committing}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCommit}
                            disabled={committing || loading || totalSelectedCount === 0 || (previewData && previewData.has_conflicts)}
                        >
                            {committing ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Committing...
                                </>
                            ) : (
                                `Commit ${totalSelectedCount} Item${totalSelectedCount !== 1 ? 's' : ''}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitProjectModal;
