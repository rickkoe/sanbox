import React, { useRef, useState, useEffect } from "react";
import GenericTable from "./GenericTable";
import axios from "axios";

// All possible project columns
const ALL_COLUMNS = [
  { data: "name", title: "Project Name" },
  { data: "customer", title: "Customer" },
  { data: "notes", title: "Notes" }
];

// Default visible columns (show all by default)
const DEFAULT_VISIBLE_INDICES = [0, 1, 2];

const ProjectTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    
    const tableRef = useRef(null);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [customersById, setCustomersById] = useState({});
    const [projectData, setProjectData] = useState([]);

    // Column visibility state
    const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
        const saved = localStorage.getItem("projectTableColumns");
        if (saved) {
            try {
                const savedColumnNames = JSON.parse(saved);
                // Convert saved column names to indices
                const indices = savedColumnNames
                    .map(name => ALL_COLUMNS.findIndex(col => col.data === name))
                    .filter(index => index !== -1);
                return indices.length > 0 ? indices : DEFAULT_VISIBLE_INDICES;
            } catch (e) {
                return DEFAULT_VISIBLE_INDICES;
            }
        }
        return DEFAULT_VISIBLE_INDICES;
    });

    const NEW_PROJECT_TEMPLATE = { 
        id: null, 
        name: "", 
        customer: "", 
        notes: "" 
    };

    // Load customer options for dropdown
    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/customers/`);
                const customers = response.data.results || response.data || [];
                setCustomerOptions(customers.map(customer => customer.name));
                
                // Create a map of customer ID to customer name for reverse lookup
                const customerMap = {};
                customers.forEach(customer => {
                    customerMap[customer.id] = customer.name;
                });
                setCustomersById(customerMap);
            } catch (error) {
                console.error('Error loading customers:', error);
            }
        };
        loadCustomers();
    }, [API_URL]);

    // Load project data
    useEffect(() => {
        const loadProjects = async () => {
            const projects = await loadProjectsWithCustomers();
            setProjectData(projects);
        };
        
        if (customerOptions.length > 0) {
            loadProjects();
        }
    }, [customerOptions]); // Load projects after customers are loaded

    // Dynamic dropdown sources
    const dropdownSources = {
        customer: customerOptions
    };

    const customRenderers = {
        name: (instance, td, row, col, prop, value) => {
            td.innerText = value || "";
            return td;
        }
    };

    const handleSave = async (unsavedData) => {
        console.log('🔄 handleSave called with:', unsavedData);
        
        if (!unsavedData || unsavedData.length === 0) {
            return { success: true, message: 'No changes to save' };
        }

        try {
            const successes = [];
            const errors = [];
            
            for (const project of unsavedData) {
                console.log('💾 Processing project:', project);
                
                // Skip empty projects
                if (!project.name || project.name.trim() === '') {
                    console.log('⏭️ Skipping empty project');
                    continue;
                }

                try {
                    if (project.id) {
                        // Update existing project - this endpoint may not exist yet
                        console.log('🔄 Updating existing project:', project.id);
                        // For now, skip updates since the backend endpoint doesn't exist
                        errors.push(`${project.name}: Update endpoint not implemented yet`);
                    } else {
                        // Create new project
                        console.log('➕ Creating new project:', project.name);
                        
                        // Find customer ID from name
                        const customerResponse = await axios.get(`${API_URL}/api/customers/`);
                        const customers = customerResponse.data.results || customerResponse.data || [];
                        const customer = customers.find(c => c.name === project.customer);
                        
                        if (!customer) {
                            throw new Error(`Customer '${project.customer}' not found`);
                        }
                        
                        // Create project
                        const createPayload = {
                            name: project.name.trim(),
                            notes: project.notes || '',
                            customer: customer.id
                        };
                        
                        console.log('📤 Creating project with payload:', createPayload);
                        await axios.post(`${API_URL}/api/core/projects/`, createPayload);
                        successes.push(`Created ${project.name}`);
                    }
                } catch (error) {
                    console.error('❌ Error processing project:', error);
                    errors.push(`${project.name}: ${error.message}`);
                }
            }
            
            // Refresh data if we had any operations
            if (successes.length > 0) {
                console.log('🔄 Refreshing project data...');
                setTimeout(async () => {
                    const refreshedProjects = await loadProjectsWithCustomers();
                    setProjectData(refreshedProjects);
                }, 500); // Small delay to ensure backend is updated
            }
            
            const message = [
                ...successes,
                ...errors.map(e => `Error: ${e}`)
            ].join(', ');
            
            const isSuccess = errors.length === 0 && successes.length > 0;
            
            return {
                success: isSuccess,
                message: isSuccess ? successes.join(', ') : 
                        errors.length > 0 ? errors.map(e => `Error: ${e}`).join(', ') : 'No changes processed'
            };
            
        } catch (error) {
            console.error('❌ Save operation failed:', error);
            return {
                success: false,
                message: `Save failed: ${error.message}`
            };
        }
    };

    // Custom function to load all projects with customer names
    const loadProjectsWithCustomers = async () => {
        try {
            console.log('🔄 Loading projects...');
            // First get all customers
            const customerResponse = await axios.get(`${API_URL}/api/customers/`);
            const customers = customerResponse.data.results || customerResponse.data || [];
            console.log('👥 Found customers:', customers.length);
            
            let allProjects = [];
            
            // Get projects for each customer
            for (const customer of customers) {
                try {
                    console.log(`🔍 Loading projects for customer: ${customer.name} (ID: ${customer.id})`);
                    const projectResponse = await axios.get(`${API_URL}/api/core/projects/${customer.id}/`);
                    const customerProjects = projectResponse.data || [];
                    console.log(`📦 Found ${customerProjects.length} projects for ${customer.name}:`, customerProjects);
                    
                    // Add customer name to each project
                    const projectsWithCustomer = customerProjects.map(project => ({
                        ...project,
                        customer: customer.name
                    }));
                    
                    allProjects = allProjects.concat(projectsWithCustomer);
                } catch (error) {
                    console.error(`❌ Error loading projects for customer ${customer.name}:`, error);
                }
            }
            
            console.log('✅ Total projects loaded:', allProjects.length, allProjects);
            return allProjects;
        } catch (error) {
            console.error('❌ Error loading projects:', error);
            return [];
        }
    };

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={`${API_URL}/api/core/projects/`}
                newRowTemplate={NEW_PROJECT_TEMPLATE}
                tableName="projects"
                colHeaders={ALL_COLUMNS.map(col => col.title)}
                columns={ALL_COLUMNS.map(col => {
                    const column = { data: col.data };
                    // Configure customer column as dropdown
                    if (col.data === "customer") {
                        column.type = "dropdown";
                        column.allowInvalid = false;
                        column.strict = true;
                    }
                    return column;
                })}
                dropdownSources={dropdownSources}
                preprocessData={() => projectData}
                onSave={handleSave}
                columnSorting={true}
                filters={true}
                dropdownMenu={false}
                getExportFilename={() => "Projects_Table.csv"}
            />
        </div>
    );
};

export default ProjectTable;