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
        'new': { label: 'Created', color: 'success' },
        'delete': { label: 'Delete', color: 'danger' },
        'modified': { label: 'Modified', color: 'warning' },
        'unmodified': { label: 'Unmodified', color: 'secondary' }
    };

    const status = statusMap[action] || { label: action, color: 'secondary' };
    return `<span class="badge bg-${status.color}">${status.label}</span>`;
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
    defaultVisible: true,
    accessorKey: "project_action",
    renderer: (rowData) => getProjectStatusBadge(rowData.project_action)
};
