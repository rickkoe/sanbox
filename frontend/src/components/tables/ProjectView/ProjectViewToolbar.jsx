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
 */
const ProjectViewToolbar = ({ ActionsDropdown }) => {
    // If no ActionsDropdown provided, render nothing
    if (!ActionsDropdown) return null;

    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Actions Dropdown - Only show in Draft mode */}
            <ActionsDropdown />
        </div>
    );
};

export default ProjectViewToolbar;
