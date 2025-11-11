import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown } from 'react-bootstrap';
import { Building2, FolderOpen, Plus } from 'lucide-react';
import { ConfigContext } from '../../context/ConfigContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';
import '../../styles/configform.css';

const DualContextDropdown = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, updateUserConfig, refreshConfig, registerRefreshProjectsList } = useContext(ConfigContext);
    const { theme } = useTheme();

    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Modal state
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newProjectName, setNewProjectName] = useState('');

    // Load all customers on mount
    useEffect(() => {
        loadCustomers();
    }, []);

    // Initialize selected values from config
    useEffect(() => {
        if (config?.customer) {
            setSelectedCustomer(config.customer);
        }
        if (config?.active_project) {
            setSelectedProject(config.active_project);
        } else {
            setSelectedProject(null);
        }
    }, [config]);

    // Load projects when customer changes
    useEffect(() => {
        if (selectedCustomer) {
            loadProjectsForCustomer(selectedCustomer.id);
        } else {
            setProjects([]);
            setSelectedProject(null);
        }
    }, [selectedCustomer?.id]);

    // Register refresh callback with ConfigContext so other components can trigger reload
    useEffect(() => {
        if (registerRefreshProjectsList && selectedCustomer) {
            registerRefreshProjectsList(() => loadProjectsForCustomer(selectedCustomer.id));
        }
    }, [registerRefreshProjectsList, selectedCustomer?.id]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const response = await api.get(`${API_URL}/api/core/customers/`);
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const loadProjectsForCustomer = async (customerId) => {
        setLoadingProjects(true);
        try{
            const url = `${API_URL}/api/core/projects/${customerId}/`;
            const response = await api.get(url);
            setProjects(response.data);
        } catch (error) {
            console.error('Error loading projects:', error);
            console.error('Error response:', error.response);
            setProjects([]);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleAddCustomer = async () => {
        try {
            const response = await api.post(`${API_URL}/api/customers/`, {
                name: newCustomerName
            });
            const newCustomer = response.data;

            // Add to customers list
            setCustomers(prev => [...prev, newCustomer]);

            // Select the new customer and clear project
            setSelectedCustomer(newCustomer);
            setSelectedProject(null);

            // Update backend config
            await updateUserConfig(newCustomer.id, null);
            await refreshConfig();

            // Close modal and reset
            setShowCustomerModal(false);
            setNewCustomerName("");
        } catch (error) {
            console.error("❌ Error adding customer:", error);
            alert(error.response?.data?.error || "Failed to create customer. Please try again.");
        }
    };

    const handleAddProject = async () => {
        try {
            const response = await api.post(`${API_URL}/api/core/projects/`, {
                name: newProjectName,
                customer: selectedCustomer.id
            });
            const newProject = response.data;

            // Add to projects list
            setProjects(prev => [...prev, newProject]);

            // Select the new project
            setSelectedProject(newProject);

            // Update backend config
            await updateUserConfig(selectedCustomer.id, newProject.id);
            await refreshConfig();

            // Close modal and reset
            setShowProjectModal(false);
            setNewProjectName("");
        } catch (error) {
            console.error("❌ Error adding project:", error);
            alert(error.response?.data?.error || "Failed to create project. Please try again.");
        }
    };

    const handleCustomerChange = async (customerId) => {
        if (customerId === 'create_new') {
            setShowCustomerModal(true);
            return;
        }

        const customer = customers.find(c => c.id === parseInt(customerId));
        setSelectedCustomer(customer);

        // Auto-clear project when switching customers (Requirement 7A)
        setSelectedProject(null);

        // Update backend: set customer, clear project
        await updateUserConfig(customer.id, null);
        await refreshConfig();
    };

    const handleProjectChange = async (projectId) => {
        if (projectId === 'create_new') {
            setShowProjectModal(true);
            return;
        }

        if (projectId === 'none') {
            // User explicitly selected "-- None --"
            setSelectedProject(null);
            await updateUserConfig(selectedCustomer.id, null);
        } else {
            const project = projects.find(p => p.id === parseInt(projectId));
            setSelectedProject(project);
            await updateUserConfig(selectedCustomer.id, project.id);
        }

        await refreshConfig();
    };

    return (
        <div className="dual-context-dropdown">
            {/* Customer Dropdown */}
            <Dropdown>
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '180px',
                        backgroundColor: 'var(--dropdown-bg)',
                        color: 'var(--dropdown-text)',
                        border: '1px solid var(--border-color)'
                    }}
                >
                    <Building2 size={16} />
                    {loadingCustomers ? (
                        'Loading...'
                    ) : selectedCustomer ? (
                        selectedCustomer.name
                    ) : (
                        'Select Customer'
                    )}
                </Dropdown.Toggle>

                <Dropdown.Menu style={{
                    backgroundColor: 'var(--dropdown-bg)',
                    border: '1px solid var(--border-color)'
                }}>
                    {customers.map(c => (
                        <Dropdown.Item
                            key={c.id}
                            onClick={() => handleCustomerChange(c.id)}
                            active={selectedCustomer?.id === c.id}
                            style={{
                                color: 'var(--dropdown-text)',
                                backgroundColor: selectedCustomer?.id === c.id ? 'var(--color-accent-subtle)' : 'transparent'
                            }}
                        >
                            {c.name}
                        </Dropdown.Item>
                    ))}
                    <Dropdown.Divider />
                    <Dropdown.Item
                        onClick={() => handleCustomerChange('create_new')}
                        style={{ color: 'var(--color-success-fg)' }}
                    >
                        <Plus size={14} style={{ marginRight: '6px' }} />
                        Create New Customer
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>

            {/* Project Dropdown (only show if customer selected) */}
            {selectedCustomer && (
                <Dropdown>
                    <Dropdown.Toggle
                        variant="outline-secondary"
                        size="sm"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            minWidth: '180px',
                            backgroundColor: 'var(--dropdown-bg)',
                            color: 'var(--dropdown-text)',
                            border: '1px solid var(--border-color)'
                        }}
                    >
                        <FolderOpen size={16} />
                        {loadingProjects ? (
                            'Loading...'
                        ) : selectedProject ? (
                            selectedProject.name
                        ) : (
                            'No Project'
                        )}
                    </Dropdown.Toggle>

                    <Dropdown.Menu style={{
                        backgroundColor: 'var(--dropdown-bg)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <Dropdown.Item
                            onClick={() => handleProjectChange('none')}
                            active={!selectedProject}
                            style={{
                                color: 'var(--dropdown-text)',
                                fontStyle: 'italic',
                                backgroundColor: !selectedProject ? 'var(--color-accent-subtle)' : 'transparent'
                            }}
                        >
                            -- None --
                        </Dropdown.Item>

                        {projects.length > 0 && <Dropdown.Divider />}

                        {projects.map(p => (
                            <Dropdown.Item
                                key={p.id}
                                onClick={() => handleProjectChange(p.id)}
                                active={selectedProject?.id === p.id}
                                style={{
                                    color: 'var(--dropdown-text)',
                                    backgroundColor: selectedProject?.id === p.id ? 'var(--color-accent-subtle)' : 'transparent'
                                }}
                            >
                                {p.name}
                            </Dropdown.Item>
                        ))}

                        <Dropdown.Divider />
                        <Dropdown.Item
                            onClick={() => handleProjectChange('create_new')}
                            style={{ color: 'var(--color-success-fg)' }}
                        >
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            Create New Project
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            )}

            {/* Customer Modal */}
            {showCustomerModal && createPortal(
                <div className={`config-modal-overlay theme-${theme}`} onClick={() => setShowCustomerModal(false)}>
                    <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="config-modal-header">
                            <h3>Add New Customer</h3>
                            <button className="config-modal-close" onClick={() => setShowCustomerModal(false)}>×</button>
                        </div>
                        <div className="config-modal-body">
                            <div className="config-form-group">
                                <label className="config-form-label">Customer Name</label>
                                <input
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    placeholder="Enter customer name"
                                    className="config-form-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newCustomerName.trim()) {
                                            e.preventDefault();
                                            handleAddCustomer();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div className="config-modal-footer">
                            <button className="config-modal-btn config-modal-btn-secondary" onClick={() => setShowCustomerModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="config-modal-btn config-modal-btn-primary"
                                onClick={handleAddCustomer}
                                disabled={!newCustomerName.trim()}
                            >
                                Add Customer
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Project Modal */}
            {showProjectModal && createPortal(
                <div className={`config-modal-overlay theme-${theme}`} onClick={() => setShowProjectModal(false)}>
                    <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="config-modal-header">
                            <h3>Add New Project</h3>
                            <button className="config-modal-close" onClick={() => setShowProjectModal(false)}>×</button>
                        </div>
                        <div className="config-modal-body">
                            <div className="config-form-group">
                                <label className="config-form-label">Project Name</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Enter project name"
                                    className="config-form-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newProjectName.trim()) {
                                            e.preventDefault();
                                            handleAddProject();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div className="config-modal-footer">
                            <button className="config-modal-btn config-modal-btn-secondary" onClick={() => setShowProjectModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="config-modal-btn config-modal-btn-primary"
                                onClick={handleAddProject}
                                disabled={!newProjectName.trim()}
                            >
                                Add Project
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DualContextDropdown;
