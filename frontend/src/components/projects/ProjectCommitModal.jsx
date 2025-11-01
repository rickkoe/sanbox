import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import axios from 'axios';
import '../../styles/modals.css';

/**
 * Project Commit Modal Component
 *
 * Multi-step workflow for committing project changes:
 * 1. Check for conflicts
 * 2. Commit changes (apply field_overrides)
 * 3. Confirm deletions (if any)
 * 4. Show success message
 *
 * Props:
 * - isOpen: boolean - Whether modal is visible
 * - onClose: function - Callback when modal closes
 * - projectId: number - ID of project to commit
 * - projectName: string - Name of project (for display)
 * - onSuccess: function - Callback after successful commit
 * - closeAfterCommit: boolean - If true, also closes the project
 */
const ProjectCommitModal = ({
    isOpen,
    onClose,
    projectId,
    projectName = 'Project',
    onSuccess,
    closeAfterCommit = false
}) => {
    const API_URL = process.env.REACT_APP_API_URL || '';

    const [step, setStep] = useState('check'); // check, conflicts, confirm-deletions, committing, success
    const [conflicts, setConflicts] = useState([]);
    const [deletions, setDeletions] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [commitResult, setCommitResult] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('check');
            setConflicts([]);
            setDeletions(null);
            setError(null);
            setCommitResult(null);
            checkConflicts();
        }
    }, [isOpen, projectId]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const checkConflicts = async () => {
        // Skip conflict check - conflicts are detected during commit attempt
        // Go straight to commit, which will return conflicts if any exist
        executeCommit();
    };

    const executeCommit = async () => {
        setIsLoading(true);
        setStep('committing');
        setError(null);
        try {
            const endpoint = closeAfterCommit
                ? `${API_URL}/api/core/projects/${projectId}/commit-and-close/`
                : `${API_URL}/api/core/projects/${projectId}/commit/`;

            const response = await axios.post(endpoint, closeAfterCommit ? { deletions_confirmed: false } : {});

            setCommitResult(response.data);

            // Check if deletions need confirmation
            if (response.data.deletion_confirmation_needed) {
                setDeletions(response.data.entities_to_delete);
                setStep('confirm-deletions');
            } else if (response.data.deletions_required) {
                // For commit-and-close, if deletions required but not confirmed
                setDeletions(response.data.entities_to_delete);
                setStep('confirm-deletions');
            } else {
                // No deletions needed, we're done
                setStep('success');
            }
        } catch (err) {
            console.error('Error committing project:', err);

            // Check if this is a conflict error (409 status)
            if (err.response?.status === 409 && err.response?.data?.conflicts) {
                setConflicts(err.response.data.conflicts);
                setStep('conflicts');
            } else {
                setError(err.response?.data?.error || 'Failed to commit project changes');
                setStep('error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const executeDeletions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (closeAfterCommit) {
                // For commit-and-close, re-call with deletions_confirmed=true
                await axios.post(`${API_URL}/api/core/projects/${projectId}/commit-and-close/`, {
                    deletions_confirmed: true
                });
            } else {
                // For regular commit, call the deletions endpoint
                await axios.post(`${API_URL}/api/core/projects/${projectId}/commit-deletions/`);
            }

            setStep('success');
        } catch (err) {
            console.error('Error executing deletions:', err);
            setError(err.response?.data?.error || 'Failed to delete entities');
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (step === 'success' && onSuccess) {
            onSuccess();
        }
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !isLoading) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    // Get current theme from document
    const currentTheme = document.querySelector('.app-layout')?.className.match(/theme-(dark|light)/)?.[0] || 'theme-dark';

    // Render modal content via portal to ensure it's on top
    const modalContent = (
        <div
            className={`modal-overlay ${currentTheme}`}
            onClick={handleBackdropClick}
            style={{ zIndex: 1050 }}
        >
            {/* CHECKING STEP */}
            {step === 'check' && (
                <div className="modal-container modal-sm">
                    <div className="modal-header">
                        <h3 className="modal-title">
                            <Info size={24} style={{ marginRight: '8px', color: 'var(--color-accent-fg)' }} />
                            Checking for Conflicts
                        </h3>
                    </div>
                    <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <div className="spinner-border" role="status" style={{ color: 'var(--color-accent-emphasis)' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p style={{ marginTop: 'var(--space-4)', color: 'var(--secondary-text)' }}>
                            Checking for conflicts with other projects...
                        </p>
                    </div>
                </div>
            )}

            {/* CONFLICTS DETECTED */}
            {step === 'conflicts' && (
                <div className="modal-container modal-lg">
                    <div className="modal-header">
                        <h3 className="modal-title" style={{ color: 'var(--color-attention-fg)' }}>
                            <AlertTriangle size={24} style={{ marginRight: '8px' }} />
                            Conflicts Detected
                        </h3>
                        <button
                            className="modal-close-button"
                            onClick={handleClose}
                            aria-label="Close"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ display: 'block' }}
                            >
                                <path
                                    d="M15 5L5 15M5 5L15 15"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="modal-alert-warning">
                            <strong>Warning:</strong> Cannot commit: field-level conflicts detected with other projects.
                            Please resolve these conflicts before committing.
                        </div>

                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {conflicts.map((conflict, idx) => (
                                <div key={idx} style={{
                                    padding: 'var(--space-4)',
                                    background: 'var(--color-canvas-subtle)',
                                    border: '1px solid var(--color-border-default)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--space-3)'
                                }}>
                                    <div style={{
                                        fontWeight: 600,
                                        marginBottom: 'var(--space-3)',
                                        color: 'var(--color-fg-default)',
                                        fontSize: 'var(--font-size-md)'
                                    }}>
                                        {conflict.entity_type}: {conflict.entity_name}
                                    </div>
                                    <div style={{
                                        color: 'var(--color-fg-muted)',
                                        fontSize: 'var(--font-size-sm)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-2)'
                                    }}>
                                        <div>
                                            <strong style={{ color: 'var(--color-fg-default)' }}>Field:</strong>{' '}
                                            <span style={{ color: 'var(--color-fg-default)' }}>{conflict.field}</span>
                                        </div>
                                        <div>
                                            <strong style={{ color: 'var(--color-fg-default)' }}>Your value:</strong>{' '}
                                            <code style={{
                                                padding: '2px 6px',
                                                background: 'var(--color-neutral-subtle)',
                                                border: '1px solid var(--color-border-default)',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-fg-default)'
                                            }}>
                                                {JSON.stringify(conflict.this_value)}
                                            </code>
                                        </div>
                                        <div>
                                            <strong style={{ color: 'var(--color-fg-default)' }}>Conflict with {conflict.other_project_name}:</strong>{' '}
                                            <code style={{
                                                padding: '2px 6px',
                                                background: 'var(--color-neutral-subtle)',
                                                border: '1px solid var(--color-border-default)',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-fg-default)'
                                            }}>
                                                {JSON.stringify(conflict.other_value)}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="modal-btn modal-btn-secondary"
                            onClick={handleClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* COMMITTING IN PROGRESS */}
            {step === 'committing' && (
                <div className="modal-container modal-sm">
                    <div className="modal-header">
                        <h3 className="modal-title">
                            <Info size={24} style={{ marginRight: '8px', color: 'var(--color-accent-fg)' }} />
                            {closeAfterCommit ? 'Committing and Deleting' : 'Committing Changes'}
                        </h3>
                    </div>
                    <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <div className="spinner-border" role="status" style={{ color: 'var(--color-accent-emphasis)' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p style={{ marginTop: 'var(--space-4)', color: 'var(--secondary-text)' }}>
                            {closeAfterCommit ? 'Applying changes and deleting project...' : 'Applying changes to base objects...'}
                        </p>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETIONS */}
            {step === 'confirm-deletions' && (
                <div className="modal-container modal-md">
                    <div className="modal-header">
                        <h3 className="modal-title" style={{ color: 'var(--color-danger-fg)' }}>
                            <AlertCircle size={24} style={{ marginRight: '8px' }} />
                            Confirm Deletions
                        </h3>
                        <button
                            className="modal-close-button"
                            onClick={handleClose}
                            aria-label="Close"
                            disabled={isLoading}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ display: 'block' }}
                            >
                                <path
                                    d="M15 5L5 15M5 5L15 15"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="modal-alert-danger">
                            <strong>Warning:</strong> The following entities will be permanently deleted. This action cannot be undone.
                        </div>

                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {deletions?.aliases && deletions.aliases.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)', color: 'var(--primary-text)' }}>
                                        Aliases ({deletions.aliases.length})
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--secondary-text)' }}>
                                        {deletions.aliases.map((alias, idx) => (
                                            <li key={idx}>{alias.alias__name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {deletions?.zones && deletions.zones.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)', color: 'var(--primary-text)' }}>
                                        Zones ({deletions.zones.length})
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--secondary-text)' }}>
                                        {deletions.zones.map((zone, idx) => (
                                            <li key={idx}>{zone.zone__name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {deletions?.fabrics && deletions.fabrics.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <h4 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)', color: 'var(--primary-text)' }}>
                                        Fabrics ({deletions.fabrics.length})
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--secondary-text)' }}>
                                        {deletions.fabrics.map((fabric, idx) => (
                                            <li key={idx}>{fabric.fabric__name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="modal-btn modal-btn-secondary"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            className="modal-btn modal-btn-danger"
                            onClick={executeDeletions}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Deleting...' : 'Delete Entities'}
                        </button>
                    </div>
                </div>
            )}

            {/* SUCCESS */}
            {step === 'success' && (
                <div className="modal-container modal-sm">
                    <div className="modal-header">
                        <h3 className="modal-title" style={{ color: 'var(--color-success-fg)' }}>
                            <CheckCircle size={24} style={{ marginRight: '8px' }} />
                            Success!
                        </h3>
                        <button
                            className="modal-close-button"
                            onClick={handleClose}
                            aria-label="Close"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ display: 'block' }}
                            >
                                <path
                                    d="M15 5L5 15M5 5L15 15"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <CheckCircle
                            size={64}
                            style={{
                                margin: '0 auto var(--space-4)',
                                color: 'var(--color-success-emphasis)'
                            }}
                        />
                        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--primary-text)', marginBottom: 'var(--space-2)' }}>
                            {closeAfterCommit ? 'Project Committed and Deleted' : 'Changes Committed Successfully'}
                        </p>
                        <p style={{ color: 'var(--secondary-text)', marginBottom: 0 }}>
                            {closeAfterCommit
                                ? `${projectName} has been committed and deleted.`
                                : 'All changes have been applied to base objects.'}
                        </p>
                        {commitResult && (
                            <div style={{
                                marginTop: 'var(--space-4)',
                                padding: 'var(--space-3)',
                                background: 'var(--card-bg)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'left'
                            }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--secondary-text)' }}>
                                    {commitResult.applied_overrides && (
                                        <div>
                                            <strong>Applied overrides:</strong>
                                            {' '}
                                            {Object.entries(commitResult.applied_overrides)
                                                .filter(([_, count]) => count > 0)
                                                .map(([type, count]) => `${count} ${type}`)
                                                .join(', ') || 'None'}
                                        </div>
                                    )}
                                    {commitResult.committed_entities && (
                                        <div style={{ marginTop: 'var(--space-1)' }}>
                                            <strong>Committed entities:</strong>
                                            {' '}
                                            {Object.entries(commitResult.committed_entities)
                                                .filter(([_, count]) => count > 0)
                                                .map(([type, count]) => `${count} ${type}`)
                                                .join(', ') || 'None'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button
                            className="modal-btn modal-btn-primary"
                            onClick={handleClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* ERROR */}
            {step === 'error' && (
                <div className="modal-container modal-sm">
                    <div className="modal-header">
                        <h3 className="modal-title" style={{ color: 'var(--color-danger-fg)' }}>
                            <AlertCircle size={24} style={{ marginRight: '8px' }} />
                            Error
                        </h3>
                        <button
                            className="modal-close-button"
                            onClick={handleClose}
                            aria-label="Close"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ display: 'block' }}
                            >
                                <path
                                    d="M15 5L5 15M5 5L15 15"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div style={{
                            padding: 'var(--space-3)',
                            background: 'var(--alert-danger-bg)',
                            border: '1px solid var(--alert-danger-border)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <p style={{ color: 'var(--alert-danger-text)', margin: 0 }}>
                                {error || 'An unexpected error occurred'}
                            </p>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="modal-btn modal-btn-secondary"
                            onClick={handleClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // Render via portal to ensure modal appears above all other content
    return ReactDOM.createPortal(modalContent, document.body);
};

export default ProjectCommitModal;
