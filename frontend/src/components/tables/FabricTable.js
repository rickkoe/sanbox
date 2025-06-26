import React, { useRef, useContext } from "react";
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

    const customerId = config?.customer?.id;
    const apiUrl = customerId
        ? `${fabricsApiUrl}?customer_id=${customerId}`
        : fabricsApiUrl;

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={apiUrl}
                saveUrl={fabricsApiUrl}
                deleteUrl={fabricDeleteApiUrl}
                newRowTemplate={NEW_FABRIC_TEMPLATE}
                colHeaders={colHeaders}
                columns={columns}
                customRenderers={customRenderers}
                preprocessData={preprocessData}
                saveTransform={saveTransform}
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