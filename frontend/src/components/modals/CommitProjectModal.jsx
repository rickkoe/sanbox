import React, { useState, useEffect, useContext } from 'react';
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

    // Fetch preview data when modal opens
    useEffect(() => {
        if (show && projectId) {
            fetchPreview();
        }
    }, [show, projectId]);

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

    const handleCommit = async () => {
        setCommitting(true);
        setError(null);
        try {
            const response = await axios.post(`/api/core/projects/${projectId}/commit-execute/`, {
                close_project: closeAfterCommit
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

    // Count entities in a category across all types
    const countEntities = (category) => {
        if (!previewData || !previewData[category]) return 0;
        return Object.values(previewData[category]).reduce((sum, arr) => sum + arr.length, 0);
    };

    // Render entity list for a specific type
    const renderEntityList = (entities, typeLabel) => {
        if (!entities || entities.length === 0) return null;
        return (
            <div className="commit-modal-entity-group">
                <div className="commit-modal-entity-type">{typeLabel} ({entities.length})</div>
                <ul className="commit-modal-entity-list">
                    {entities.map(entity => (
                        <li key={entity.id}>{entity.name}</li>
                    ))}
                </ul>
            </div>
        );
    };

    // Render a category section
    const renderCategory = (categoryKey, categoryTitle, categoryClass) => {
        if (!previewData || !previewData[categoryKey]) return null;

        const data = previewData[categoryKey];
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
                    {renderEntityList(data.fabrics, 'Fabrics')}
                    {renderEntityList(data.switches, 'Switches')}
                    {renderEntityList(data.aliases, 'Aliases')}
                    {renderEntityList(data.zones, 'Zones')}
                    {renderEntityList(data.storage, 'Storage Systems')}
                    {renderEntityList(data.volumes, 'Volumes')}
                    {renderEntityList(data.hosts, 'Hosts')}
                    {renderEntityList(data.ports, 'Ports')}
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
                            disabled={committing || loading || (previewData && previewData.has_conflicts)}
                        >
                            {committing ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Committing...
                                </>
                            ) : (
                                'Commit Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitProjectModal;
