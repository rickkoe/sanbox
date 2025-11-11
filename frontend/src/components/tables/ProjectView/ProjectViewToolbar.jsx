/**
 * ProjectViewToolbar Component
 *
 * Reusable toolbar for all Project View tables.
 * Provides filter toggles (Customer View / Project View), Commit Project button,
 * Bulk Add/Remove button, and Actions dropdown.
 */

import React, { useState } from 'react';
import CommitProjectModal from '../../modals/CommitProjectModal';

/**
 * @param {Object} props
 * @param {string} props.projectFilter - Current filter: 'all' | 'current' | 'not_in_project'
 * @param {Function} props.onFilterChange - Handler for filter changes
 * @param {number|null} props.activeProjectId - Active project ID
 * @param {string|null} props.activeProjectName - Active project name
 * @param {Function} props.onBulkClick - Handler for bulk add/remove button
 * @param {Function} props.onCommitSuccess - Handler called after successful commit
 * @param {React.Component} props.ActionsDropdown - Actions dropdown component from useProjectViewSelection
 * @param {string} props.entityName - Entity name for tooltips (e.g., "aliases", "zones")
 */
const ProjectViewToolbar = ({
    projectFilter,
    onFilterChange,
    activeProjectId,
    activeProjectName,
    onBulkClick,
    onCommitSuccess,
    ActionsDropdown,
    entityName = 'items'
}) => {
    const [showCommitModal, setShowCommitModal] = useState(false);

    const handleCommitSuccess = () => {
        setShowCommitModal(false);
        if (onCommitSuccess) {
            onCommitSuccess();
        }
    };

    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Actions Dropdown - Only show in Project View */}
            {ActionsDropdown && <ActionsDropdown />}

            <div className="btn-group" role="group" aria-label="Project filter" style={{ height: '100%' }}>
                {/* Customer View Button */}
                <button
                    type="button"
                    className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => onFilterChange('all')}
                    style={{
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '6px 0 0 6px',
                        transition: 'all 0.2s ease',
                        marginRight: '0',
                        minWidth: '140px'
                    }}
                >
                    Customer View
                </button>

                {/* Project View Button - Disabled if no active project */}
                <button
                    type="button"
                    className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => onFilterChange('current')}
                    disabled={!activeProjectId}
                    style={{
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '0',
                        transition: 'all 0.2s ease',
                        opacity: activeProjectId ? 1 : 0.5,
                        cursor: activeProjectId ? 'pointer' : 'not-allowed',
                        minWidth: '140px'
                    }}
                    title={!activeProjectId ? 'Select a project to enable Project View' : `Show only ${entityName} in this project`}
                >
                    Project View
                </button>

                {/* Commit Project Button - Disabled if no active project */}
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCommitModal(true)}
                    disabled={!activeProjectId}
                    style={{
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '0',
                        transition: 'all 0.2s ease',
                        opacity: activeProjectId ? 1 : 0.5,
                        cursor: activeProjectId ? 'pointer' : 'not-allowed',
                        minWidth: '140px'
                    }}
                    title={!activeProjectId ? 'Select a project to commit' : 'Commit project changes to Customer View'}
                >
                    Commit Project
                </button>

                {/* Bulk Add/Remove Button - Disabled if no active project */}
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={onBulkClick}
                    disabled={!activeProjectId}
                    style={{
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '0 6px 6px 0',
                        transition: 'all 0.2s ease',
                        opacity: activeProjectId ? 1 : 0.5,
                        cursor: activeProjectId ? 'pointer' : 'not-allowed',
                        minWidth: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                    title={!activeProjectId ? `Select a project to add/remove ${entityName}` : `Bulk add or remove ${entityName} from this project`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {/* Checklist icon */}
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                </button>
            </div>

            {/* Commit Project Modal */}
            <CommitProjectModal
                show={showCommitModal}
                onClose={() => setShowCommitModal(false)}
                onSuccess={handleCommitSuccess}
                projectId={activeProjectId}
                projectName={activeProjectName || 'Unknown Project'}
            />
        </div>
    );
};

export default ProjectViewToolbar;
