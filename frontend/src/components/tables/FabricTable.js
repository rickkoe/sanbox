import React, { useRef, useContext, useState } from "react";
import axios from "axios";
import GenericTable from "./GenericTable";
import { ConfigContext } from "../../context/ConfigContext";

const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
];

// All possible fabric columns
const ALL_COLUMNS = [
  { data: "name", title: "Name" },
  { data: "san_vendor", title: "Vendor" },
  { data: "zoneset_name", title: "Zoneset Name" },
  { data: "vsan", title: "VSAN" },
  { data: "exists", title: "Exists" },
  { data: "notes", title: "Notes" }
];

// Default visible columns (show all by default for compatibility)
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5];

const FabricTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const tableRef = useRef(null);
    
    // Get customer ID early so it can be used in URLs
    const customerId = config?.customer?.id;

    // Column visibility state
    const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
        const saved = localStorage.getItem("fabricTableColumns");
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

    const NEW_FABRIC_TEMPLATE = { 
        id: null, 
        name: "", 
        san_vendor: "", 
        zoneset_name: "", 
        vsan: "", 
        exists: false, 
        notes: "" 
    };

    // API URL with customer filter for server pagination
    const fabricsApiUrl = customerId ? `${API_URL}/api/san/fabrics/?customer_id=${customerId}` : `${API_URL}/api/san/fabrics/`;
    const fabricDeleteApiUrl = `${API_URL}/api/san/fabrics/delete/`;

    // No need for useMemo - we pass all columns to GenericTable and let it handle filtering

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name)
    };

    const customRenderers = {
        san_vendor: (instance, td, row, col, prop, value) => {
            const displayName = vendorOptions.find(v => v.code === value || v.name === value)?.name || value;
            td.innerText = displayName;
            return td;
        }
    };

    const saveTransform = (rows) =>
        rows
            .filter(row => {
                const requiredFields = ["name", "zoneset_name", "san_vendor"];
                return requiredFields.some(key => {
                    const value = row[key];
                    return typeof value === "string" && value.trim() !== "";
                });
            })
            .map(row => {
                console.log("Transforming row:", row);
                return {
                    ...row,
                    customer: config?.customer?.id,
                    san_vendor: vendorOptions.find(v => v.name === row.san_vendor || v.code === row.san_vendor)?.code || row.san_vendor,
                    vsan: row.vsan === "" ? null : row.vsan
                };
            });

    // Process data for display - convert vendor codes to names
    const preprocessData = (data) => {
        return data.map(fabric => ({
            ...fabric,
            san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
        }));
    };

    // Custom save handler
    const handleSave = async (unsavedData) => {
        try {
            const errors = [];
            const successes = [];
            
            for (const fabric of unsavedData) {
                try {
                    const payload = { ...fabric };
                    delete payload.saved;
                    delete payload._isNew;
                    
                    // Apply the same transformations as saveTransform
                    payload.customer = config?.customer?.id;
                    payload.san_vendor = vendorOptions.find(v => v.name === payload.san_vendor || v.code === payload.san_vendor)?.code || payload.san_vendor;
                    payload.vsan = payload.vsan === "" ? null : payload.vsan;
                    
                    if (fabric.id) {
                        // Update existing fabric
                        const response = await axios.put(`${API_URL}/api/san/fabrics/${fabric.id}/`, payload);
                        successes.push(response.data.message || `Updated ${fabric.name} successfully`);
                    } else {
                        // Create new fabric
                        delete payload.id;
                        const response = await axios.post(`${API_URL}/api/san/fabrics/`, payload);
                        successes.push(response.data.message || `Created ${fabric.name} successfully`);
                    }
                } catch (error) {
                    console.error('Error saving fabric:', error.response?.data);
                    errors.push({
                        fabric: fabric.name || 'New Fabric',
                        error: error.response?.data || error.message
                    });
                }
            }
            
            if (errors.length > 0) {
                const errorMessages = errors.map(e => `${e.fabric}: ${JSON.stringify(e.error)}`).join('\n');
                return { 
                    success: false, 
                    message: `Errors saving fabrics:\n${errorMessages}` 
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
                apiUrl={fabricsApiUrl}
                saveUrl={fabricsApiUrl}
                deleteUrl={fabricDeleteApiUrl}
                serverPagination={true}
                defaultPageSize={50}
                storageKey={`fabric-table-${customerId || 'default'}`}
                tableName="fabrics"
                newRowTemplate={NEW_FABRIC_TEMPLATE}
                colHeaders={ALL_COLUMNS.map(col => col.title)}
                columns={ALL_COLUMNS.map(col => {
                    const column = { data: col.data };
                    
                    // Add specific column configurations
                    if (col.data === "san_vendor") {
                        column.type = "dropdown";
                        column.className = "htCenter";
                    } else if (col.data === "vsan") {
                        column.type = "numeric";
                        column.className = "htCenter";
                    } else if (col.data === "exists") {
                        column.type = "checkbox";
                        column.className = "htCenter";
                    }
                    
                    return column;
                })}
                customRenderers={customRenderers}
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                onSave={handleSave}
                dropdownSources={dropdownSources}
                filters={false}
                dropdownMenu={false}
                columnSorting={true}
                defaultVisibleColumns={visibleColumnIndices}
                getExportFilename={() => `${config?.customer?.name || 'Customer'}_Fabric_Table.csv`}
                additionalButtons={
                    <>
                        {/* Add any additional buttons here if needed */}
                    </>
                }
            />
        </div>
    );
};

export default FabricTable;