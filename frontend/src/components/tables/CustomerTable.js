import React, { useRef, useState, useMemo } from "react";
import GenericTable from "./GenericTable";
import axios from "axios";

// All possible customer columns
const ALL_COLUMNS = [
  { data: "name", title: "Customer Name" },
  { data: "insights_tenant", title: "Storage Insights Tenant" },
  { data: "insights_api_key", title: "Storage Insights API Key" },
  { data: "notes", title: "Notes" }
];

// Default visible columns (show all by default for compatibility)
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3];

const CustomerTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';

    const tableRef = useRef(null);

    // Column visibility state
    const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
        const saved = localStorage.getItem("customerTableColumns");
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

    const NEW_CUSTOMER_TEMPLATE = { 
        id: null, 
        name: "", 
        insights_tenant: "", 
        insights_api_key: "", 
        notes: "" 
    };

    // No need for useMemo - we pass all columns to GenericTable and let it handle filtering

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
                tableName="customers"
                colHeaders={ALL_COLUMNS.map(col => col.title)}
                columns={ALL_COLUMNS.map(col => ({ data: col.data }))}
                customRenderers={customRenderers}
                onSave={handleSave}
                fixedColumnsLeft={2}
                columnSorting={true}
                filters={false}
                dropdownMenu={false}
                storageKey="customerTableColumnWidths"
                defaultVisibleColumns={visibleColumnIndices}
                getExportFilename={() => "Customer_Table.csv"}
            />
        </div>
    );
};

export default CustomerTable;