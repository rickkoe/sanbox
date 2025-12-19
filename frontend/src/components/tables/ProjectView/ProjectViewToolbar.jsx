/**
 * ProjectViewToolbar Component
 *
 * Simplified toolbar for table-specific project actions.
 * Only contains the Actions dropdown for row-level operations in Draft mode.
 *
 * The Committed/Draft toggle, Commit Project, and Bulk Add/Remove
 * are now in the navbar Options dropdown.
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {React.Component} props.ActionsDropdown - Actions dropdown component from useProjectViewSelection
 * @param {React.ReactNode} props.extraContent - Additional content to render in the toolbar
 */
const ProjectViewToolbar = ({ ActionsDropdown, extraContent }) => {
    // If no ActionsDropdown and no extraContent, render nothing
    if (!ActionsDropdown && !extraContent) return null;

    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Extra content (e.g., custom buttons) */}
            {extraContent}
            {/* Actions Dropdown - Only show in Draft mode */}
            {ActionsDropdown && <ActionsDropdown />}
        </div>
    );
};

export default ProjectViewToolbar;
