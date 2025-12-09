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

    // Entity type definitions
    const entityTypes = [
        { key: 'alias', label: 'Aliases', endpoint: '/api/san/aliases/', icon: 'tag' },
        { key: 'zone', label: 'Zones', endpoint: '/api/san/zones/', icon: 'layers' },
        { key: 'fabric', label: 'Fabrics', endpoint: '/api/san/fabrics/', icon: 'grid' },
        { key: 'switch', label: 'Switches', endpoint: '/api/san/switches/', icon: 'cpu' },
        { key: 'storage', label: 'Storage Systems', endpoint: '/api/storage/storage/', icon: 'database' },
        { key: 'volume', label: 'Volumes', endpoint: '/api/storage/volumes/', icon: 'hard-drive' },
        { key: 'host', label: 'Hosts', endpoint: '/api/storage/hosts/', icon: 'server' },
        { key: 'port', label: 'Ports', endpoint: '/api/storage/ports/', icon: 'link' }
    ];

    // Reset when modal closes
    useEffect(() => {
        if (!show) {
            setSelectedEntityType(null);
            setEntityItems([]);
            setShowBulkModal(false);
        }
    }, [show]);

    // Load items when entity type is selected
    const handleEntitySelect = async (entityType) => {
        setSelectedEntityType(entityType);
        setLoadingItems(true);

        try {
            // Fetch all items for this entity type for the customer
            const url = `${API_URL}${entityType.endpoint}?customer=${activeCustomerId}&project=${activeProjectId}`;
            const response = await api.get(url);

            // Handle paginated or non-paginated responses
            const items = response.data.results || response.data;
            setEntityItems(items);
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
        if (!selectedEntityType || !activeProjectId) return;

        try {
            // Determine which items to add and which to remove
            const currentlyInProject = new Set(
                entityItems.filter(item => item.in_active_project).map(item => item.id)
            );

            const toAdd = [...selectedIds].filter(id => !currentlyInProject.has(id));
            const toRemove = [...currentlyInProject].filter(id => !selectedIds.has(id));

            // Get the appropriate API endpoint for bulk operations
            const entityEndpoints = {
                alias: '/api/san/project-aliases/',
                zone: '/api/san/project-zones/',
                fabric: '/api/san/project-fabrics/',
                switch: '/api/san/project-switches/',
                storage: '/api/storage/project-storage/',
                volume: '/api/storage/project-volumes/',
                host: '/api/storage/project-hosts/',
                port: '/api/storage/project-ports/'
            };

            const baseEndpoint = entityEndpoints[selectedEntityType.key];

            // Add items
            for (const id of toAdd) {
                await api.post(`${API_URL}${baseEndpoint}`, {
                    project: activeProjectId,
                    [selectedEntityType.key]: id,
                    action: 'unmodified'
                });
            }

            // Remove items
            for (const id of toRemove) {
                await api.delete(`${API_URL}${baseEndpoint}${activeProjectId}/${id}/`);
            }

            setShowBulkModal(false);
            onClose();
        } catch (error) {
            console.error('Error updating project membership:', error);
            alert('Failed to update project membership. Please try again.');
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
                        {entityTypes.map(entityType => (
                            <button
                                key={entityType.key}
                                className="bulk-entity-button"
                                onClick={() => handleEntitySelect(entityType)}
                                disabled={loadingItems}
                            >
                                <span className="bulk-entity-icon">
                                    {getEntityIcon(entityType.icon)}
                                </span>
                                <span className="bulk-entity-label">{entityType.label}</span>
                            </button>
                        ))}
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
