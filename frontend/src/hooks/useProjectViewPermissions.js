/**
 * useProjectViewPermissions Hook
 *
 * Simplified permission model - all authenticated users have full access.
 */

import { useMemo } from 'react';

/**
 * @param {Object} options
 * @param {string|null} options.role - User role in active project (no longer used, kept for compatibility)
 * @param {string} options.projectFilter - Current filter: 'all' | 'current' | 'not_in_project'
 * @param {string} options.entityName - Human-readable entity name (e.g., "aliases", "zones")
 * @returns {Object} { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage }
 */
export const useProjectViewPermissions = ({
    role,
    projectFilter,
    entityName = 'items'
}) => {
    const permissions = useMemo(() => {
        // Simplified permission model: All authenticated users have full access
        return {
            canEdit: true,
            canDelete: true,
            isViewer: false,
            isProjectOwner: true,  // Treat all users as owners
            isAdmin: true,         // Treat all users as admins
            isMember: true,        // Treat all users as members
            readOnlyMessage: null
        };
    }, [role, projectFilter, entityName]);

    return permissions;
};
