/**
 * useProjectViewAPI Hook
 *
 * Centralizes API URL generation logic for Customer View vs Project View.
 * Handles automatic switching from Project View to Customer View when project is deselected.
 */

import { useMemo, useEffect } from 'react';

/**
 * @param {Object} options
 * @param {string} options.projectFilter - Current filter: 'all' | 'current' | 'not_in_project'
 * @param {Function} options.setProjectFilter - Function to update projectFilter state (from ProjectFilterContext)
 * @param {number|null} options.activeProjectId - Active project ID
 * @param {number|null} options.activeCustomerId - Active customer ID
 * @param {string} options.entityType - Entity type (e.g., 'aliases', 'zones', 'fabrics')
 * @param {string} options.baseUrl - Base API URL (e.g., '${API_URL}/api/san')
 * @returns {Object} { apiUrl: string }
 */
export const useProjectViewAPI = ({
    projectFilter,
    setProjectFilter,
    activeProjectId,
    activeCustomerId,
    entityType,
    baseUrl
}) => {
    // Auto-switch from Project View to Customer View when project is deselected
    useEffect(() => {
        if (!activeProjectId && projectFilter === 'current') {
            setProjectFilter('all');
            // ProjectFilterContext handles persistence automatically
        }
    }, [activeProjectId, projectFilter, setProjectFilter]);

    // Generate API URL based on context
    const apiUrl = useMemo(() => {
        let url;

        if (projectFilter === 'current' && activeProjectId) {
            // Project View: Returns merged data with field_overrides and project_action
            url = `${baseUrl}/${entityType}/project/${activeProjectId}/view/`;
        } else if (activeProjectId) {
            // Customer View with project context: Adds in_active_project flag
            url = `${baseUrl}/${entityType}/project/${activeProjectId}/?project_filter=${projectFilter}`;
        } else if (activeCustomerId) {
            // Customer View without project: Basic customer data
            url = `${baseUrl}/${entityType}/?customer=${activeCustomerId}`;
        } else {
            // Fallback: No customer or project selected
            url = `${baseUrl}/${entityType}/`;
        }

        return url;
    }, [baseUrl, entityType, projectFilter, activeProjectId, activeCustomerId]);

    return { apiUrl };
};
