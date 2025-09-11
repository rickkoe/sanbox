import React, { useRef, useState, useEffect, useContext, useMemo } from "react";
import GenericTable from "./GenericTable";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import CustomNamingApplier from "../naming/CustomNamingApplier";
import { getTextColumns, createNamingHandler, createSelectionHandler } from "../../utils/tableNamingUtils";

// All possible project columns
const ALL_COLUMNS = [
  { data: "name", title: "Project Name", required: true },
  { data: "customer", title: "Customer", required: true },
  { data: "fabric_count", title: "Fabrics", type: "numeric", readOnly: true },
  { data: "alias_count", title: "Aliases", type: "numeric", readOnly: true },
  { data: "zone_count", title: "Zones", type: "numeric", readOnly: true },
  { data: "storage_system_count", title: "Storage Systems", type: "numeric", readOnly: true },
  { data: "host_count", title: "Hosts", type: "numeric", readOnly: true },
  { data: "notes", title: "Notes" }  // Moved to far right and hidden by default
];

// Default visible columns (show quantity columns by default, hide notes)
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6];

const ProjectTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, refreshConfig } = useContext(ConfigContext);
    
    const tableRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [customersById, setCustomersById] = useState({});

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

    // Get available text columns for naming
    const availableTextColumns = useMemo(() => getTextColumns(ALL_COLUMNS), []);
    
    // Create naming and selection handlers
    const handleApplyNaming = useMemo(() => 
        createNamingHandler(tableRef, ALL_COLUMNS, setSelectedRows), 
        [tableRef]
    );
    
    const handleSelectionChange = useMemo(() => 
        createSelectionHandler(tableRef, ALL_COLUMNS, setSelectedRows), 
        [tableRef]
    );

    const NEW_PROJECT_TEMPLATE = { 
        id: null, 
        name: "", 
        customer: "", 
        notes: "",
        fabric_count: 0,
        alias_count: 0,
        zone_count: 0,
        storage_system_count: 0,
        host_count: 0
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
                        // Update existing project
                        console.log('🔄 Updating existing project:', project.id);
                        
                        // Find customer ID from name
                        const customerResponse = await axios.get(`${API_URL}/api/customers/`);
                        const customers = customerResponse.data.results || customerResponse.data || [];
                        const customer = customers.find(c => c.name === project.customer);
                        
                        if (!customer) {
                            throw new Error(`Customer '${project.customer}' not found`);
                        }
                        
                        // Update project
                        const updatePayload = {
                            name: project.name.trim(),
                            notes: project.notes || '',
                            customer: customer.id
                        };
                        
                        console.log('📤 Updating project with payload:', updatePayload);
                        await axios.put(`${API_URL}/api/core/projects/update/${project.id}/`, updatePayload);
                        successes.push(`Updated ${project.name}`);
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

    // Custom delete handler to refresh config after project deletion
    const handleDelete = async (projectId) => {
        try {
            // Delete the project
            await axios.delete(`${API_URL}/api/core/projects/delete/${projectId}/`);
            
            // Check if the deleted project was the active project
            const activeProjectId = config?.active_project?.id;
            
            if (projectId === activeProjectId) {
                console.log('🔄 Active project was deleted, refreshing config...');
                // Refresh the config context to clear the deleted project reference
                await refreshConfig();
            }
            
            return { success: true, message: `Deleted project successfully` };
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            throw error;
        }
    };

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={`${API_URL}/api/core/projects/`}
                deleteUrl={`${API_URL}/api/core/projects/delete/`}
                onDelete={handleDelete}
                newRowTemplate={NEW_PROJECT_TEMPLATE}
                tableName="projects"
                requiredColumns={[0, 1]}  // Project Name and Customer are required
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
                onSave={handleSave}
                columnSorting={true}
                filters={true}
                dropdownMenu={false}
                getExportFilename={() => "Projects_Table.csv"}
                afterSelection={handleSelectionChange}
                headerButtons={
                    <div className="d-flex gap-2 align-items-center">
                        <CustomNamingApplier
                            tableName="projects"
                            selectedRows={selectedRows}
                            onApplyNaming={handleApplyNaming}
                            customerId={config?.customer?.id || 1}
                            disabled={false}
                            targetColumn={availableTextColumns.length === 1 ? availableTextColumns[0].key : null}
                            availableColumns={availableTextColumns}
                        />
                    </div>
                }
            />
        </div>
    );
};

export default ProjectTable;