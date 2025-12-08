/**
 * ProjectViewToolbar Component
 *
 * Simplified toolbar for table-specific project actions.
 * Only contains:
 * - Actions dropdown (for row-level operations in Draft mode)
 * - Bulk Add/Remove button (for adding/removing entities from project)
 *
 * The Live/Draft toggle and Commit Project are now in the navbar.
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {number|null} props.activeProjectId - Active project ID
 * @param {Function} props.onBulkClick - Handler for bulk add/remove button
 * @param {React.Component} props.ActionsDropdown - Actions dropdown component from useProjectViewSelection
 * @param {string} props.entityName - Entity name for tooltips (e.g., "aliases", "zones")
 */
const ProjectViewToolbar = ({
    activeProjectId,
    onBulkClick,
    ActionsDropdown,
    entityName = 'items'
}) => {
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Actions Dropdown - Only show in Draft mode */}
            {ActionsDropdown && <ActionsDropdown />}

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
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    opacity: activeProjectId ? 1 : 0.5,
                    cursor: activeProjectId ? 'pointer' : 'not-allowed',
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
                Bulk Add/Remove
            </button>
        </div>
    );
};

export default ProjectViewToolbar;
