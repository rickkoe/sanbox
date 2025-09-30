import React, { useContext } from "react";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Fabric management
const FabricTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const customerId = config?.customer?.id;

    // Vendor mapping (same as original FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // All possible fabric columns
    const columns = [
        { data: "name", title: "Name" },
        { data: "san_vendor", title: "Vendor", type: "dropdown" },
        { data: "zoneset_name", title: "Zoneset Name" },
        { data: "vsan", title: "VSAN", type: "numeric" },
        { data: "exists", title: "Exists", type: "checkbox" },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name)
    };

    const NEW_FABRIC_TEMPLATE = {
        id: null,
        name: "",
        san_vendor: "",
        zoneset_name: "",
        vsan: "",
        exists: false,
        notes: ""
    };

    // Process data for display - convert vendor codes to names
    const preprocessData = (data) => {
        return data.map(fabric => ({
            ...fabric,
            san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
        }));
    };

    // Transform data for saving - convert vendor names to codes
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
                return {
                    ...row,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === row.san_vendor || v.code === row.san_vendor)?.code || row.san_vendor,
                    vsan: row.vsan === "" ? null : row.vsan
                };
            });

    // Show loading while config is being fetched
    if (configLoading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading configuration...</span>
                    </div>
                    <span className="ms-2">Loading customer configuration...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/san/fabrics/`}
                saveUrl={`${API_URL}/api/san/fabrics/`}
                deleteUrl={`${API_URL}/api/san/fabrics/delete/`}
                customerId={customerId}
                tableName="fabrics"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_FABRIC_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                vendorOptions={vendorOptions}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`fabric-table-${customerId || 'default'}`}

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

export default FabricTableTanStackClean;