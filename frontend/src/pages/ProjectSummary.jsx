import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ConfigContext } from '../context/ConfigContext';
import api from '../api';
import '../styles/project-summary.css';

const ProjectSummary = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { theme } = useTheme();
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [projectData, setProjectData] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [error, setError] = useState(null);
    const [commitModalOpen, setCommitModalOpen] = useState(false);
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [commitInProgress, setCommitInProgress] = useState(false);

    const activeProject = config?.active_project;

    useEffect(() => {
        if (activeProject) {
            loadProjectSummary();
        }
    }, [activeProject]);

    const loadProjectSummary = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch project summary data
            const response = await api.get(`${API_URL}/api/core/projects/${activeProject.id}/summary/`);
            setProjectData(response.data.project);
            setSummaryData(response.data.summary);
        } catch (err) {
            console.error('Error loading project summary:', err);
            setError(err.response?.data?.error || 'Failed to load project summary');
        } finally {
            setLoading(false);
        }
    };

    const handleCommitProject = async () => {
        try {
            setCommitInProgress(true);
            await api.post(`${API_URL}/api/core/projects/${activeProject.id}/commit/`);
            alert('Project committed successfully!');
            setCommitModalOpen(false);
            loadProjectSummary(); // Reload to see updated status
        } catch (err) {
            console.error('Error committing project:', err);
            alert(err.response?.data?.error || 'Failed to commit project');
        } finally {
            setCommitInProgress(false);
        }
    };

    const handleCloseProject = async () => {
        try {
            setCommitInProgress(true);
            await api.post(`${API_URL}/api/core/projects/${activeProject.id}/close/`);
            alert('Project deleted successfully!');
            setCloseModalOpen(false);
            window.location.href = '/'; // Redirect to home
        } catch (err) {
            console.error('Error deleting project:', err);
            alert(err.response?.data?.error || 'Failed to delete project');
        } finally {
            setCommitInProgress(false);
        }
    };

    if (!activeProject) {
        return (
            <div className={`project-summary-container theme-${theme}`}>
                <div className="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h2>No Active Project</h2>
                    <p>Please select a project from the navbar to view its summary.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`project-summary-container theme-${theme}`}>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading project summary...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`project-summary-container theme-${theme}`}>
                <div className="error-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h2>Error Loading Project</h2>
                    <p>{error}</p>
                    <button className="btn-primary" onClick={loadProjectSummary}>Try Again</button>
                </div>
            </div>
        );
    }

    const getActionIcon = (action) => {
        switch (action) {
            case 'create':
                return '🆕';
            case 'modify':
                return '✏️';
            case 'delete':
                return '🗑️';
            case 'reference':
                return '📄';
            default:
                return '📌';
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'create':
                return 'var(--color-success-fg)';
            case 'modify':
                return 'var(--color-accent-fg)';
            case 'delete':
                return 'var(--color-danger-fg)';
            case 'reference':
                return 'var(--badge-text)';
            default:
                return 'var(--primary-text)';
        }
    };

    const totalEntities = summaryData ?
        summaryData.aliases.total +
        summaryData.zones.total +
        summaryData.fabrics.total : 0;

    return (
        <div className={`project-summary-container theme-${theme}`}>
            {/* Page Header */}
            <div className="summary-header">
                <div className="summary-header-content">
                    <div className="summary-title-section">
                        <button
                            className="btn-back"
                            onClick={() => navigate(-1)}
                            title="Go back to previous page"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                            Back
                        </button>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <div>
                            <h1>Project Summary</h1>
                            <p className="project-name">{projectData?.name}</p>
                        </div>
                    </div>
                    <div className="summary-actions">
                        <button
                            className="btn-secondary"
                            onClick={() => setCloseModalOpen(true)}
                        >
                            Delete Project
                        </button>
                        <button
                            className="btn-commit"
                            onClick={() => setCommitModalOpen(true)}
                            disabled={totalEntities === 0}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Commit Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="summary-content">
                {/* Project Info Card */}
                <div className="summary-card">
                    <div className="card-header">
                        <h2>Project Information</h2>
                    </div>
                    <div className="card-body">
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Owner</span>
                                <span className="info-value">{projectData?.owner_username || 'Unknown'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Created</span>
                                <span className="info-value">
                                    {projectData?.created_at ? new Date(projectData.created_at).toLocaleDateString() : 'Unknown'}
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Status</span>
                                <span className={`info-value status-badge ${projectData?.is_committed ? 'committed' : 'active'}`}>
                                    {projectData?.is_committed ? 'Committed' : 'Active'}
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Total Entities</span>
                                <span className="info-value">{totalEntities}</span>
                            </div>
                        </div>
                        {projectData?.description && (
                            <div className="info-description">
                                <span className="info-label">Description</span>
                                <p>{projectData.description}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Entity Summary Cards */}
                <div className="summary-grid">
                    {/* Aliases Summary */}
                    <div className="summary-card">
                        <div className="card-header">
                            <h2>Aliases</h2>
                            <span className="entity-count">{summaryData?.aliases.total || 0}</span>
                        </div>
                        <div className="card-body">
                            {summaryData?.aliases.total > 0 ? (
                                <div className="action-breakdown">
                                    {summaryData.aliases.by_action.map(item => (
                                        <div key={item.action} className="action-item">
                                            <span className="action-icon">{getActionIcon(item.action)}</span>
                                            <span className="action-label">{item.action_display}</span>
                                            <span className="action-count" style={{ color: getActionColor(item.action) }}>
                                                {item.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No aliases in this project</p>
                            )}
                        </div>
                    </div>

                    {/* Zones Summary */}
                    <div className="summary-card">
                        <div className="card-header">
                            <h2>Zones</h2>
                            <span className="entity-count">{summaryData?.zones.total || 0}</span>
                        </div>
                        <div className="card-body">
                            {summaryData?.zones.total > 0 ? (
                                <div className="action-breakdown">
                                    {summaryData.zones.by_action.map(item => (
                                        <div key={item.action} className="action-item">
                                            <span className="action-icon">{getActionIcon(item.action)}</span>
                                            <span className="action-label">{item.action_display}</span>
                                            <span className="action-count" style={{ color: getActionColor(item.action) }}>
                                                {item.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No zones in this project</p>
                            )}
                        </div>
                    </div>

                    {/* Fabrics Summary */}
                    <div className="summary-card">
                        <div className="card-header">
                            <h2>Fabrics</h2>
                            <span className="entity-count">{summaryData?.fabrics.total || 0}</span>
                        </div>
                        <div className="card-body">
                            {summaryData?.fabrics.total > 0 ? (
                                <div className="action-breakdown">
                                    {summaryData.fabrics.by_action.map(item => (
                                        <div key={item.action} className="action-item">
                                            <span className="action-icon">{getActionIcon(item.action)}</span>
                                            <span className="action-label">{item.action_display}</span>
                                            <span className="action-count" style={{ color: getActionColor(item.action) }}>
                                                {item.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No fabrics in this project</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Commit Warning */}
                {totalEntities > 0 && !projectData?.is_committed && (
                    <div className="summary-card warning-card">
                        <div className="card-header">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <h2>Before You Commit</h2>
                        </div>
                        <div className="card-body">
                            <p>Committing this project will:</p>
                            <ul>
                                <li><strong>Create:</strong> Add {summaryData.aliases.by_action.find(a => a.action === 'create')?.count || 0} new aliases, {summaryData.zones.by_action.find(a => a.action === 'create')?.count || 0} new zones to the customer's data</li>
                                <li><strong>Modify:</strong> Update {summaryData.aliases.by_action.find(a => a.action === 'modify')?.count || 0} aliases, {summaryData.zones.by_action.find(a => a.action === 'modify')?.count || 0} zones in the customer's data</li>
                                <li><strong>Delete:</strong> Remove {summaryData.aliases.by_action.find(a => a.action === 'delete')?.count || 0} aliases, {summaryData.zones.by_action.find(a => a.action === 'delete')?.count || 0} zones from the customer's data</li>
                                <li><strong>Lock the project:</strong> No further changes can be made after commit</li>
                            </ul>
                            <p className="warning-note">
                                <strong>Note:</strong> This action cannot be undone. Please review all changes before proceeding.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Commit Confirmation Modal */}
            {commitModalOpen && (
                <div className="modal-overlay" onClick={() => !commitInProgress && setCommitModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header commit-header">
                            <h3>Confirm Commit</h3>
                            <button
                                className="modal-close"
                                onClick={() => setCommitModalOpen(false)}
                                disabled={commitInProgress}
                            >×</button>
                        </div>
                        <div className="modal-body">
                            <p><strong>Are you sure you want to commit this project?</strong></p>
                            <p>This will apply all changes to the customer's data:</p>
                            <ul>
                                <li>{summaryData?.aliases.total || 0} aliases</li>
                                <li>{summaryData?.zones.total || 0} zones</li>
                                <li>{summaryData?.fabrics.total || 0} fabrics</li>
                            </ul>
                            <p className="warning-text">This action cannot be undone and the project will be locked.</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setCommitModalOpen(false)}
                                disabled={commitInProgress}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-commit"
                                onClick={handleCommitProject}
                                disabled={commitInProgress}
                            >
                                {commitInProgress ? 'Committing...' : 'Commit Project'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {closeModalOpen && (
                <div className="modal-overlay" onClick={() => !commitInProgress && setCloseModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header close-header">
                            <h3>Delete Project</h3>
                            <button
                                className="modal-close"
                                onClick={() => setCloseModalOpen(false)}
                                disabled={commitInProgress}
                            >×</button>
                        </div>
                        <div className="modal-body">
                            <p><strong>Are you sure you want to delete this project?</strong></p>
                            {!projectData?.is_committed && (
                                <p className="warning-text">
                                    <strong>Warning:</strong> This project has not been committed.
                                    All uncommitted changes will be lost.
                                </p>
                            )}
                            <p>This action will permanently delete the project and all its associations. This cannot be undone.</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setCloseModalOpen(false)}
                                disabled={commitInProgress}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-danger"
                                onClick={handleCloseProject}
                                disabled={commitInProgress}
                            >
                                {commitInProgress ? 'Deleting...' : 'Delete Project'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSummary;
