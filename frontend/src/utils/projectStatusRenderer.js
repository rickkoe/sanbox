/**
 * Project Status Renderer Utility
 *
 * Provides consistent rendering for project action status across all tables.
 * Used in Project View to show the action status of entities.
 */

/**
 * Returns a formatted badge HTML string for the given action
 * @param {string} action - The action value ('new', 'delete', 'modified', 'unmodified')
 * @returns {string} HTML string for the badge
 */
export const getProjectStatusBadge = (action) => {
    const statusMap = {
        'new': { label: 'New', color: 'success' },
        'create': { label: 'New', color: 'success' },  // Legacy storage entity value
        'delete': { label: 'Delete', color: 'danger' },
        'modified': { label: 'Modified', color: 'warning' },
        'unmodified': { label: 'Unmodified', color: 'secondary' },
        'reference': { label: 'Unmodified', color: 'secondary' }  // Legacy storage entity value
    };

    const status = statusMap[action] || { label: action, color: 'secondary' };
    return `<span class="badge bg-${status.color}">${status.label}</span>`;
};

/**
 * React component version for TanStack tables
 * @param {string} action - The action value ('new', 'delete', 'modified', 'unmodified')
 * @returns {JSX.Element} Badge component
 */
export const ProjectStatusBadge = ({ action }) => {
    const statusMap = {
        'new': { label: 'New', color: 'success' },
        'create': { label: 'New', color: 'success' },  // Legacy storage entity value
        'delete': { label: 'Delete', color: 'danger' },
        'modified': { label: 'Modified', color: 'warning' },
        'unmodified': { label: 'Unmodified', color: 'secondary' },
        'reference': { label: 'Unmodified', color: 'secondary' }  // Legacy storage entity value
    };

    const status = statusMap[action] || { label: action, color: 'secondary' };
    return <span className={`badge bg-${status.color}`}>{status.label}</span>;
};

/**
 * Custom renderer function for TanStack tables
 * Use this in the customRenderers prop
 */
export const projectStatusRenderer = (rowData) => {
    const action = rowData?.project_action;
    if (!action) return '';
    return <ProjectStatusBadge action={action} />;
};

/**
 * Column definition for Project Status column
 * This can be spread into table column definitions
 */
export const projectStatusColumn = {
    data: "project_action",
    title: "Project Status",
    type: "text",
    readOnly: true,
    width: 120,
    required: true,  // Always visible, can't be hidden
    defaultVisible: true,
    accessorKey: "project_action",
    renderer: (rowData) => getProjectStatusBadge(rowData.project_action)
};
