import React from "react";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Customer management
const CustomerTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';

    // All possible customer columns
    const columns = [
        { data: "name", title: "Customer Name" },
        { data: "insights_tenant", title: "Storage Insights Tenant" },
        { data: "insights_api_key", title: "Storage Insights API Key" },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

    const NEW_CUSTOMER_TEMPLATE = {
        id: null,
        name: "",
        insights_tenant: "",
        insights_api_key: "",
        notes: ""
    };

    // Custom renderers for customer-specific display logic
    const customRenderers = {
        name: (rowData, td, row, col, prop, value) => {
            // TanStack passes rowData as the first parameter
            const customer = rowData || {};
            if (customer.insights_tenant && value) {
                return `<a href="https://insights.ibm.com/cui/${customer.insights_tenant}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            }
            return value || "";
        },
        insights_api_key: (rowData, td, row, col, prop, value) => {
            const customer = rowData || {};
            // Show asterisks for existing customers with actual keys, allow editing for new or empty keys
            if (customer.id && value) {
                return "••••••••••••••••••••"; // Show asterisks as password-like display
            }
            return value || "";
        }
    };

    // No transform needed for customers - simple model
    const saveTransform = (rows) => rows.map(row => ({
        ...row,
        // No special transformations needed for customers
    }));

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/customers/`}
                saveUrl={`${API_URL}/api/customers/`}
                deleteUrl={`${API_URL}/api/customers/delete/`}
                customerId={1} // Global customer list doesn't filter by customer
                tableName="customers"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={{}} // No dropdowns in customer table
                newRowTemplate={NEW_CUSTOMER_TEMPLATE}

                // Data Processing
                preprocessData={null} // No preprocessing needed
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey="customer-table-tanstack"

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Save successful:', result.message);
                    } else {
                        console.error('❌ Save failed:', result.message);
                        alert('Error saving changes: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default CustomerTableTanStackClean;