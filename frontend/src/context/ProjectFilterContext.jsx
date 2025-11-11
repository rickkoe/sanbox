import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import { ConfigContext } from './ConfigContext';
import { useAuth } from './AuthContext';

const ProjectFilterContext = createContext();

/**
 * ProjectFilterProvider
 *
 * Manages the global project filter (Customer View vs Project View) state
 * across all 8 tables. Persists the selection in TableConfiguration.
 *
 * Features:
 * - Loads projectFilter from TableConfiguration on mount/customer change
 * - Saves projectFilter to TableConfiguration when changed
 * - Automatically resets to 'all' (Customer View) when customer changes
 * - Synchronizes view mode across all tables via React Context
 */
export const ProjectFilterProvider = ({ children }) => {
    const { config } = useContext(ConfigContext);
    const { user } = useAuth();
    const [projectFilter, setProjectFilterState] = useState('all');
    const [loading, setLoading] = useState(true);
    const customerId = config?.customer?.id;

    // Load projectFilter from TableConfiguration on mount or customer change
    useEffect(() => {
        if (customerId && user) {
            loadProjectFilter();
        } else {
            // No customer selected, default to 'all'
            setProjectFilterState('all');
            setLoading(false);
        }
    }, [customerId, user?.id]);

    /**
     * Load projectFilter from TableConfiguration
     * Uses a special table_name '_global_view_settings' for cross-table settings
     */
    const loadProjectFilter = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/core/table-config/', {
                params: {
                    customer: customerId,
                    table_name: '_global_view_settings',
                    user: user.id
                }
            });

            const savedFilter = response.data.additional_settings?.projectFilter;
            if (savedFilter) {
                setProjectFilterState(savedFilter);
            } else {
                // No saved filter, default to 'all' (Customer View)
                setProjectFilterState('all');
            }
        } catch (error) {
            // Config doesn't exist yet, default to 'all'
            if (error.response?.status === 404) {
                setProjectFilterState('all');
            } else {
                console.error('Error loading project filter:', error);
                setProjectFilterState('all');
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * Update projectFilter and save to TableConfiguration
     * This will trigger a re-render in all components using this context
     */
    const setProjectFilter = useCallback(async (newFilter) => {
        // Immediately update state for instant UI response
        setProjectFilterState(newFilter);

        if (customerId && user) {
            try {
                // Try to get existing config
                let configId = null;
                try {
                    const response = await api.get('/api/core/table-config/', {
                        params: {
                            customer: customerId,
                            table_name: '_global_view_settings',
                            user: user.id
                        }
                    });
                    configId = response.data.id;
                } catch (error) {
                    // Config doesn't exist, we'll create it
                }

                const configData = {
                    customer: customerId,
                    table_name: '_global_view_settings',
                    user: user.id,
                    additional_settings: {
                        projectFilter: newFilter
                    }
                };

                if (configId) {
                    // Update existing config
                    await api.put(`/api/core/table-config/${configId}/`, configData);
                } else {
                    // Create new config
                    await api.post('/api/core/table-config/', configData);
                }
            } catch (error) {
                console.error('Error saving project filter:', error);
            }
        }
    }, [customerId, user?.id]);

    return (
        <ProjectFilterContext.Provider value={{
            projectFilter,
            setProjectFilter,
            loading
        }}>
            {children}
        </ProjectFilterContext.Provider>
    );
};

/**
 * useProjectFilter Hook
 *
 * Use this hook in any component to get/set the global project filter
 *
 * @returns {Object} { projectFilter: string, setProjectFilter: function, loading: boolean }
 *
 * Example:
 * const { projectFilter, setProjectFilter } = useProjectFilter();
 *
 * // Change view mode
 * setProjectFilter('current'); // Switch to Project View
 * setProjectFilter('all');     // Switch to Customer View
 */
export const useProjectFilter = () => {
    const context = useContext(ProjectFilterContext);
    if (!context) {
        throw new Error('useProjectFilter must be used within ProjectFilterProvider');
    }
    return context;
};
