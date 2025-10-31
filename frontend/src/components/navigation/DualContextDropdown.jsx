import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { Building2, FolderOpen, Plus } from 'lucide-react';
import { ConfigContext } from '../../context/ConfigContext';
import api from '../../api';

const DualContextDropdown = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, updateUserConfig, refreshConfig } = useContext(ConfigContext);
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(false);

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
        console.log('🔍 Loading projects for customer ID:', customerId);
        setLoadingProjects(true);
        try {
            const url = `${API_URL}/api/core/projects/${customerId}/`;
            console.log('🔍 Fetching from URL:', url);
            const response = await api.get(url);
            console.log('✅ Projects response:', response.data);
            setProjects(response.data);
        } catch (error) {
            console.error('❌ Error loading projects:', error);
            console.error('❌ Error response:', error.response);
            setProjects([]);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleCustomerChange = async (customerId) => {
        console.log('🔍 handleCustomerChange called with ID:', customerId);
        if (customerId === 'create_new') {
            navigate('/customers');
            return;
        }

        const customer = customers.find(c => c.id === parseInt(customerId));
        console.log('🔍 Found customer:', customer);
        setSelectedCustomer(customer);

        // Auto-clear project when switching customers (Requirement 7A)
        setSelectedProject(null);

        // Update backend: set customer, clear project
        await updateUserConfig(customer.id, null);
        await refreshConfig();
    };

    const handleProjectChange = async (projectId) => {
        if (projectId === 'create_new') {
            navigate('/projects');
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
        </div>
    );
};

export default DualContextDropdown;
