import React, { useRef } from "react";
import GenericTable from "./GenericTable";

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
                fixedColumnsLeft={2}
                columnSorting={true}
                filters={true}
                dropdownMenu={true}
                storageKey="customerTableColumnWidths"
                getExportFilename={() => "Customer_Table.csv"}
            />
        </div>
    );
};

export default CustomerTable;