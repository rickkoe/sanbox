import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { ConfigContext } from '../../context/ConfigContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';
import BulkProjectMembershipModal from './BulkProjectMembershipModal';
import './BulkEntitySelectorModal.css';

/**
 * BulkEntitySelectorModal Component
 *
 * Modal that lets users select an entity type, then opens
 * the BulkProjectMembershipModal to manage that entity type.
 *
 * Props:
 * - show: boolean - whether modal is visible
 * - onClose: function - callback when modal is closed
 */
const BulkEntitySelectorModal = ({ show, onClose }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { theme } = useTheme();

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;
    const activeProjectName = config?.active_project?.name;

    // Selected entity type
    const [selectedEntityType, setSelectedEntityType] = useState(null);

    // Data for the bulk modal
    const [entityItems, setEntityItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Show bulk modal
    const [showBulkModal, setShowBulkModal] = useState(false);

    // Entity counts for displaying on cards
    const [entityCounts, setEntityCounts] = useState({});
    const [loadingCounts, setLoadingCounts] = useState(false);

    // Entity type definitions
    const entityTypes = [
        { key: 'alias', label: 'Aliases', endpoint: '/api/san/aliases/', projectEndpoint: '/api/san/aliases/project/', listEndpoint: '/api/san/aliases/', icon: 'tag' },
        { key: 'zone', label: 'Zones', endpoint: '/api/san/zones/', projectEndpoint: '/api/san/zones/project/', listEndpoint: '/api/san/zones/', icon: 'layers' },
        { key: 'fabric', label: 'Fabrics', endpoint: '/api/san/fabrics/', projectEndpoint: '/api/san/fabrics/project/', listEndpoint: '/api/san/fabrics/', icon: 'grid' },
        { key: 'switch', label: 'Switches', endpoint: '/api/san/switches/', projectEndpoint: '/api/san/switches/project/', listEndpoint: '/api/san/switches/', icon: 'cpu' },
        { key: 'storage', label: 'Storage Systems', endpoint: '/api/storage/', projectEndpoint: '/api/storage/project/', listEndpoint: '/api/storage/', icon: 'database' },
        { key: 'pool', label: 'Pools', endpoint: '/api/storage/pools/', projectEndpoint: '/api/storage/project/', listEndpoint: '/api/storage/pools/', icon: 'cylinder' },
        { key: 'volume', label: 'Volumes', endpoint: '/api/storage/volumes/', projectEndpoint: '/api/storage/project/', listEndpoint: '/api/storage/volumes/', icon: 'hard-drive' },
        { key: 'host', label: 'Hosts', endpoint: '/api/storage/hosts/', projectEndpoint: '/api/storage/project/', listEndpoint: '/api/storage/hosts/', icon: 'server' },
        { key: 'port', label: 'Ports', endpoint: '/api/storage/ports/', projectEndpoint: '/api/storage/project/', listEndpoint: '/api/storage/ports/', icon: 'link' }
    ];

    // Fetch entity counts - extracted as separate function so we can call it after saving
    const fetchCounts = async () => {
        if (!activeCustomerId || !activeProjectId) return;

        setLoadingCounts(true);
        const counts = {};

        try {
            // Fetch counts for all entity types in parallel
            await Promise.all(
                entityTypes.map(async (entityType) => {
                    try {
                        // Fetch committed count (customer view - all committed or orphaned entities)
                        const committedUrl = `${API_URL}${entityType.listEndpoint}?customer=${activeCustomerId}&page_size=1`;
                        const committedResponse = await api.get(committedUrl);
                        const committedCount = committedResponse.data.count || (Array.isArray(committedResponse.data) ? committedResponse.data.length : 0);

                        // Fetch project count
                        let projectCount = 0;
                        if (entityType.projectEndpoint) {
                            try {
                                // Build project URL - storage entities use different pattern
                                let projectUrl;
                                if (entityType.key === 'storage') {
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/storages/?page_size=1`;
                                } else if (entityType.key === 'pool') {
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/pools/?page_size=1`;
                                } else if (entityType.key === 'volume') {
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/volumes/?page_size=1`;
                                } else if (entityType.key === 'host') {
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/hosts/?page_size=1`;
                                } else if (entityType.key === 'port') {
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/ports/?page_size=1`;
                                } else {
                                    // SAN entities (alias, zone, fabric, switch)
                                    projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/?page_size=1`;
                                }

                                const projectResponse = await api.get(projectUrl);
                                projectCount = projectResponse.data.count || (Array.isArray(projectResponse.data) ? projectResponse.data.length : 0);
                            } catch (projError) {
                                console.warn(`Project endpoint failed for ${entityType.label}, using fallback:`, projError);
                                projectCount = 0;
                            }
                        }

                        counts[entityType.key] = {
                            committed: committedCount,
                            inProject: projectCount
                        };
                    } catch (error) {
                        console.error(`Error fetching counts for ${entityType.label}:`, error);
                        counts[entityType.key] = { committed: 0, inProject: 0 };
                    }
                })
            );

            setEntityCounts(counts);
        } catch (error) {
            console.error('Error fetching entity counts:', error);
        } finally {
            setLoadingCounts(false);
        }
    };

    // Fetch entity counts when modal opens
    useEffect(() => {
        if (show && activeCustomerId && activeProjectId) {
            fetchCounts();
        }
    }, [show, activeCustomerId, activeProjectId, API_URL]);

    // Reset when modal closes
    useEffect(() => {
        if (!show) {
            setSelectedEntityType(null);
            setEntityItems([]);
            setShowBulkModal(false);
            setEntityCounts({});
        }
    }, [show]);

    // Load items when entity type is selected
    const handleEntitySelect = async (entityType) => {
        setSelectedEntityType(entityType);
        setLoadingItems(true);

        try {
            // Fetch ALL customer entities with pagination support
            let allItems = [];
            let currentPage = 1;
            let hasMorePages = true;

            console.log(`Fetching all ${entityType.label} for customer ${activeCustomerId}...`);

            // For storage entities (pool, volume, host, port, storage), use project view with project_filter=all
            // This returns all customer items with in_active_project flag already set
            const useProjectViewForAll = ['pool', 'volume', 'host', 'port', 'storage'].includes(entityType.key);

            // Keep fetching pages until we have all items
            while (hasMorePages) {
                let url;
                if (useProjectViewForAll && activeProjectId) {
                    // Use project view with project_filter=all to get in_active_project flag
                    if (entityType.key === 'storage') {
                        url = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/storages/?project_filter=all&page=${currentPage}&page_size=500`;
                    } else if (entityType.key === 'pool') {
                        url = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/pools/?project_filter=all&page=${currentPage}&page_size=500`;
                    } else if (entityType.key === 'volume') {
                        url = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/volumes/?project_filter=all&page=${currentPage}&page_size=500`;
                    } else if (entityType.key === 'host') {
                        url = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/hosts/?project_filter=all&page=${currentPage}&page_size=500`;
                    } else if (entityType.key === 'port') {
                        url = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/ports/?project_filter=all&page=${currentPage}&page_size=500`;
                    }
                } else {
                    url = `${API_URL}${entityType.listEndpoint}?customer=${activeCustomerId}&page=${currentPage}&page_size=500`;
                }
                const response = await api.get(url);

                // Handle paginated responses
                if (response.data.results) {
                    // Paginated response
                    allItems = allItems.concat(response.data.results);
                    const totalCount = response.data.count || 0;
                    hasMorePages = allItems.length < totalCount;
                    currentPage++;
                    console.log(`Fetched page ${currentPage - 1}: ${allItems.length}/${totalCount} items`);
                } else {
                    // Non-paginated response (array)
                    allItems = response.data;
                    hasMorePages = false;
                }
            }

            console.log(`Total ${entityType.label} fetched: ${allItems.length}`);

            // For storage entities, we already have in_active_project from the project view
            // For SAN entities, we need to fetch project items separately to mark them
            if (useProjectViewForAll && activeProjectId) {
                // Storage entities already have in_active_project set from project view with project_filter=all
                // Just ensure the flag exists (it should already be set by the backend)
                allItems = allItems.map(item => ({
                    ...item,
                    in_active_project: item.in_active_project || false
                }));
                console.log(`Storage entity ${entityType.label}: in_active_project already set from backend`);
            } else if (entityType.projectEndpoint) {
                // SAN entities: fetch project items separately to mark which ones are in the project
                try {
                    let allProjectItems = [];
                    let projectPage = 1;
                    let hasMoreProjectPages = true;

                    console.log(`Fetching all project ${entityType.label}...`);

                    while (hasMoreProjectPages) {
                        // Build project URL - storage entities use different pattern
                        let projectUrl;
                        if (entityType.key === 'storage') {
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/storages/?page=${projectPage}&page_size=500`;
                        } else if (entityType.key === 'pool') {
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/pools/?page=${projectPage}&page_size=500`;
                        } else if (entityType.key === 'volume') {
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/volumes/?page=${projectPage}&page_size=500`;
                        } else if (entityType.key === 'host') {
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/hosts/?page=${projectPage}&page_size=500`;
                        } else if (entityType.key === 'port') {
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/ports/?page=${projectPage}&page_size=500`;
                        } else {
                            // SAN entities (alias, zone, fabric, switch)
                            projectUrl = `${API_URL}${entityType.projectEndpoint}${activeProjectId}/view/?page=${projectPage}&page_size=500`;
                        }

                        const projectResponse = await api.get(projectUrl);

                        if (projectResponse.data.results) {
                            allProjectItems = allProjectItems.concat(projectResponse.data.results);
                            const totalProjectCount = projectResponse.data.count || 0;
                            hasMoreProjectPages = allProjectItems.length < totalProjectCount;
                            projectPage++;
                        } else {
                            allProjectItems = projectResponse.data;
                            hasMoreProjectPages = false;
                        }
                    }

                    console.log(`Total project ${entityType.label}: ${allProjectItems.length}`);

                    // Create a map of project items with their metadata (action, field_overrides)
                    const projectItemsMap = new Map(
                        allProjectItems.map(item => [
                            item.id,
                            {
                                action: item.action,
                                field_overrides: item.field_overrides,
                                has_changes: item.action === 'modified' || (item.field_overrides && Object.keys(item.field_overrides).length > 0)
                            }
                        ])
                    );

                    // Mark items that are in the project with their metadata
                    allItems = allItems.map(item => {
                        const projectMeta = projectItemsMap.get(item.id);
                        return {
                            ...item,
                            in_active_project: projectItemsMap.has(item.id),
                            project_action: projectMeta?.action,
                            project_field_overrides: projectMeta?.field_overrides,
                            project_has_changes: projectMeta?.has_changes || false
                        };
                    });
                } catch (projError) {
                    console.warn('Could not fetch project items, all will show as not in project:', projError);
                    // Continue with items unmarked
                    allItems = allItems.map(item => ({ ...item, in_active_project: false }));
                }
            }

            setEntityItems(allItems);
            setShowBulkModal(true);
        } catch (error) {
            console.error(`Error loading ${entityType.label}:`, error);
            alert(`Failed to load ${entityType.label}. Please try again.`);
        } finally {
            setLoadingItems(false);
        }
    };

    // Handle save from bulk modal
    const handleBulkSave = async (selectedIds) => {
        if (!selectedEntityType || !activeProjectId) {
            console.error('Missing required data:', { selectedEntityType, activeProjectId });
            alert('Missing project or entity type information.');
            return;
        }

        try {
            // Determine which items to add and which to remove
            const currentlyInProject = new Set(
                entityItems.filter(item => item.in_active_project).map(item => item.id)
            );

            // Convert selectedIds to Set if it's an array
            const selectedIdsSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

            const toAdd = [...selectedIdsSet].filter(id => !currentlyInProject.has(id));
            const toRemove = [...currentlyInProject].filter(id => !selectedIdsSet.has(id));

            const entityKey = selectedEntityType.key;

            console.log('Bulk operation:', { entityKey, toAdd, toRemove, activeProjectId });

            // Check if any items being removed have changes
            if (toRemove.length > 0) {
                const itemsWithChanges = entityItems.filter(
                    item => toRemove.includes(item.id) && item.project_has_changes
                );

                if (itemsWithChanges.length > 0) {
                    const itemNames = itemsWithChanges.map(item => item.name).join(', ');
                    const confirmMessage = itemsWithChanges.length === 1
                        ? `"${itemNames}" has unsaved changes in this project. Removing it will discard these changes.\n\nThis action cannot be undone. Continue?`
                        : `${itemsWithChanges.length} ${entityKey === 'alias' ? 'aliases' : entityKey + 's'} have unsaved changes:\n${itemNames}\n\nRemoving them will discard all changes.\n\nThis action cannot be undone. Continue?`;

                    if (!window.confirm(confirmMessage)) {
                        console.log('Remove operation cancelled by user');
                        return; // User cancelled
                    }
                }
            }

            // Add items
            for (const id of toAdd) {
                const payload = {
                    [`${entityKey}_id`]: id,
                    action: 'unmodified',
                    notes: `Added via Bulk Add/Remove modal`
                };

                // Alias-specific field
                if (entityKey === 'alias') {
                    payload.include_in_zoning = false;
                }

                console.log(`Adding ${entityKey} ${id} to project ${activeProjectId}`);
                const url = `${API_URL}/api/core/projects/${activeProjectId}/add-${entityKey}/`;
                console.log('POST URL:', url, 'Payload:', payload);

                await api.post(url, payload);
            }

            // Remove items
            for (const id of toRemove) {
                console.log(`Removing ${entityKey} ${id} from project ${activeProjectId}`);
                const url = `${API_URL}/api/core/projects/${activeProjectId}/remove-${entityKey}/${id}/`;
                console.log('DELETE URL:', url);

                await api.delete(url);
            }

            // Reload the table if it's open
            const tableRefName = `${entityKey}TableRef`;
            if (window[tableRefName]?.current?.reloadData) {
                window[tableRefName].current.reloadData();
            }

            // Close the bulk modal and return to entity selector
            setShowBulkModal(false);
            setSelectedEntityType(null);
            setEntityItems([]);

            // Refresh entity counts to reflect the changes
            await fetchCounts();

            // Success message
            const addedCount = toAdd.length;
            const removedCount = toRemove.length;
            let message = '';
            if (addedCount > 0 && removedCount > 0) {
                message = `Added ${addedCount} and removed ${removedCount} ${entityKey === 'alias' ? 'aliases' : entityKey + 's'}`;
            } else if (addedCount > 0) {
                message = `Added ${addedCount} ${entityKey === 'alias' ? 'aliases' : entityKey + 's'}`;
            } else if (removedCount > 0) {
                message = `Removed ${removedCount} ${entityKey === 'alias' ? 'aliases' : entityKey + 's'}`;
            } else {
                message = 'No changes made';
            }
            console.log(`✅ ${message}`);
        } catch (error) {
            console.error('Error updating project membership:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response,
                status: error.response?.status,
                data: error.response?.data
            });
            const errorMsg = error.response?.data?.error || error.message || 'Please try again.';
            alert(`Failed to update project membership. ${errorMsg}`);
        }
    };

    // Handle closing bulk modal (go back to entity selector)
    const handleBulkClose = () => {
        setShowBulkModal(false);
        setSelectedEntityType(null);
        setEntityItems([]);
    };

    if (!show) return null;

    // Show bulk modal if entity type is selected
    if (showBulkModal && selectedEntityType) {
        return (
            <BulkProjectMembershipModal
                show={true}
                onClose={handleBulkClose}
                onSave={handleBulkSave}
                items={entityItems}
                itemType={selectedEntityType.key}
                projectName={activeProjectName}
            />
        );
    }

    // Show entity type selector
    return createPortal(
        <div className={`bulk-entity-modal-overlay theme-${theme}`} onClick={onClose}>
            <div className="bulk-entity-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="bulk-entity-modal-header">
                    <h3>Bulk Add/Remove</h3>
                    <button className="bulk-entity-modal-close" onClick={onClose}>×</button>
                </div>
                <div className="bulk-entity-modal-body">
                    <p className="bulk-entity-modal-description">
                        Select an entity type to add or remove from the project:
                    </p>
                    <div className="bulk-entity-grid">
                        {entityTypes.map(entityType => {
                            const counts = entityCounts[entityType.key];
                            return (
                                <button
                                    key={entityType.key}
                                    className="bulk-entity-button"
                                    onClick={() => handleEntitySelect(entityType)}
                                    disabled={loadingItems || loadingCounts}
                                >
                                    <span className="bulk-entity-icon">
                                        {getEntityIcon(entityType.icon)}
                                    </span>
                                    <span className="bulk-entity-label">{entityType.label}</span>
                                    {loadingCounts ? (
                                        <span className="bulk-entity-counts">Loading...</span>
                                    ) : counts ? (
                                        <span className="bulk-entity-counts">
                                            <span className="count-item">
                                                <span className="count-label">Committed:</span>
                                                <span className="count-value">{counts.committed}</span>
                                            </span>
                                            <span className="count-item">
                                                <span className="count-label">In Project:</span>
                                                <span className="count-value">{counts.inProject}</span>
                                            </span>
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                    {loadingItems && (
                        <div className="bulk-entity-loading">
                            <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <span>Loading {selectedEntityType?.label}...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Simple icon renderer using SVG
const getEntityIcon = (iconType) => {
    const icons = {
        tag: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
        ),
        layers: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
            </svg>
        ),
        grid: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
            </svg>
        ),
        cpu: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <line x1="9" y1="1" x2="9" y2="4"/>
                <line x1="15" y1="1" x2="15" y2="4"/>
                <line x1="9" y1="20" x2="9" y2="23"/>
                <line x1="15" y1="20" x2="15" y2="23"/>
                <line x1="20" y1="9" x2="23" y2="9"/>
                <line x1="20" y1="14" x2="23" y2="14"/>
                <line x1="1" y1="9" x2="4" y2="9"/>
                <line x1="1" y1="14" x2="4" y2="14"/>
            </svg>
        ),
        database: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
        ),
        cylinder: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
        ),
        'hard-drive': (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="12" x2="2" y2="12"/>
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                <line x1="6" y1="16" x2="6.01" y2="16"/>
                <line x1="10" y1="16" x2="10.01" y2="16"/>
            </svg>
        ),
        server: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
        ),
        link: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
        )
    };
    return icons[iconType] || icons.tag;
};

export default BulkEntitySelectorModal;
