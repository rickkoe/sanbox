import React, { useRef, useContext } from "react";
import axios from "axios";
import GenericTable from "./GenericTable";
import { ConfigContext } from "../../context/ConfigContext";

const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
];

const FabricTable = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const tableRef = useRef(null);

    const NEW_FABRIC_TEMPLATE = { 
        id: null, 
        name: "", 
        san_vendor: "", 
        zoneset_name: "", 
        vsan: "", 
        exists: false, 
        notes: "" 
    };

    const fabricsApiUrl = `${API_URL}/api/san/fabrics/`;
    const fabricDeleteApiUrl = `${API_URL}/api/san/fabrics/delete/`;

    const colHeaders = [
        "Name", 
        "Vendor", 
        "Zoneset Name", 
        "VSAN", 
        "Exists", 
        "Notes"
    ];

    const columns = [
        { data: "name" },
        { data: "san_vendor", type: "dropdown", className: "htCenter" },
        { data: "zoneset_name" },
        { data: "vsan", type: "numeric", className: "htCenter" },
        { data: "exists", type: "checkbox", className: "htCenter" },
        { data: "notes" }
    ];

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
                        await axios.put(`${API_URL}/api/san/fabrics/${fabric.id}/`, payload);
                        successes.push(`Updated ${fabric.name}`);
                    } else {
                        // Create new fabric
                        delete payload.id;
                        await axios.post(`${API_URL}/api/san/fabrics/`, payload);
                        successes.push(`Created ${fabric.name}`);
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

    const customerId = config?.customer?.id;

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={fabricsApiUrl}
                apiParams={customerId ? { customer_id: customerId } : {}}
                saveUrl={fabricsApiUrl}
                deleteUrl={fabricDeleteApiUrl}
                newRowTemplate={NEW_FABRIC_TEMPLATE}
                colHeaders={colHeaders}
                columns={columns}
                customRenderers={customRenderers}
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                onSave={handleSave}
                dropdownSources={dropdownSources}
                filters={true}
                dropdownMenu={true}
                columnSorting={true}
                storageKey="fabricTableColumnWidths"
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