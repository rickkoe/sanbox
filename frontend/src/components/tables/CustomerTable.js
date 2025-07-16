import React, { useRef } from "react";
import GenericTable from "./GenericTable";
import axios from "axios";

const CustomerTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';

    const tableRef = useRef(null);

    const NEW_CUSTOMER_TEMPLATE = { 
        id: null, 
        name: "", 
        insights_tenant: "", 
        insights_api_key: "", 
        notes: "" 
    };

    const colHeaders = [
        "Customer Name", 
        "Storage Insights Tenant", 
        "Storage Insights API Key", 
        "Notes"
    ];

    const columns = [
        { data: "name" },
        { data: "insights_tenant" },
        { data: "insights_api_key" },
        { data: "notes" }
    ];

    const customRenderers = {
        name: (instance, td, row, col, prop, value) => {
            const customer = instance.getSourceDataAtRow(row);
            if (customer.insights_tenant) {
                td.innerHTML = `<a href="https://insights.ibm.com/cui/${customer.insights_tenant}" target="_blank" rel="noopener noreferrer">${value}</a>`;
            } else {
                td.innerText = value || "";
            }
            return td;
        },
        insights_api_key: (instance, td, row, col, prop, value) => {
            const customer = instance.getSourceDataAtRow(row);
            const displayValue = customer.id && value ? "••••••••••" : "";
            td.innerText = displayValue;
            return td;
        }
    };

    const handleSave = async (unsavedData) => {
    try {
        const errors = [];
        const successes = [];
        
        for (const customer of unsavedData) {
            try {
                const payload = { ...customer };
                delete payload.saved;
                delete payload._isNew;
                
                if (customer.id) {
                    // Update existing customer
                    await axios.put(`${API_URL}/api/customers/${customer.id}/`, payload);
                    successes.push(`Updated ${customer.name}`);
                } else {
                    // Create new customer
                    delete payload.id;
                    await axios.post(`${API_URL}/api/customers/`, payload);
                    successes.push(`Created ${customer.name}`);
                }
            } catch (error) {
                console.error('Error saving customer:', error.response?.data);
                errors.push({
                    customer: customer.name || 'New Customer',
                    error: error.response?.data || error.message
                });
            }
        }
        
        if (errors.length > 0) {
            const errorMessages = errors.map(e => `${e.customer}: ${JSON.stringify(e.error)}`).join('\n');
            return { 
                success: false, 
                message: `Errors saving customers:\n${errorMessages}` 
            };
        }
        
        return { 
            success: true, 
            message: successes.length > 0 ? successes.join(', ') : 'No changes to save' 
        };
    } catch (error) {
        console.error('General save error:', error);
        return { 
            success: false, 
            message: `Error: ${error.message}` 
        };
    }
};

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={`${API_URL}/api/customers/`}
                saveUrl={`${API_URL}/api/customers/`}
                deleteUrl={`${API_URL}/api/customers/delete/`}
                newRowTemplate={NEW_CUSTOMER_TEMPLATE}
                colHeaders={colHeaders}
                columns={columns}
                customRenderers={customRenderers}
                onSave={handleSave}
                fixedColumnsLeft={2}
                columnSorting={true}
                filters={false}
                dropdownMenu={false}
                storageKey="customerTableColumnWidths"
                getExportFilename={() => "Customer_Table.csv"}
            />
        </div>
    );
};

export default CustomerTable;