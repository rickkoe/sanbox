import React, { useContext, useState, useEffect } from "react";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import api from "../../api";

// Clean TanStack Table implementation for Fabric management
const FabricTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const customerId = config?.customer?.id;

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(customerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // Vendor mapping (same as original FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // State for switches dropdown
    const [switches, setSwitches] = useState([]);
    const [switchesLoading, setSwitchesLoading] = useState(false);

    // Fetch switches for the active customer
    useEffect(() => {
        const fetchSwitches = async () => {
            if (!customerId) return;

            setSwitchesLoading(true);
            try {
                const response = await api.get(`/api/san/switches/customer/${customerId}/`);
                console.log('📡 Fetched switches:', response.data);
                setSwitches(response.data);
            } catch (error) {
                console.error('Error fetching switches:', error);
            } finally {
                setSwitchesLoading(false);
            }
        };

        fetchSwitches();
    }, [customerId]);

    // All possible fabric columns
    const columns = [
        { data: "name", title: "Name" },
        { data: "san_vendor", title: "Vendor", type: "dropdown" },
        { data: "switch", title: "Switch", type: "dropdown" },
        { data: "zoneset_name", title: "Zoneset Name" },
        { data: "domain_id", title: "Domain ID", type: "numeric" },
        { data: "vsan", title: "VSAN", type: "numeric" },
        { data: "alias_count", title: "Aliases", type: "numeric", readOnly: true },
        { data: "zone_count", title: "Zones", type: "numeric", readOnly: true },
        { data: "exists", title: "Exists", type: "checkbox" },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name),
        switch: switches.map(s => s.name)
    };

    // Filter switch dropdown to only show switches matching the fabric's vendor
    // Using useMemo to capture the current switches state
    const dropdownFilters = React.useMemo(() => ({
        switch: (options, rowData, columnKey, allTableData) => {
            // Get the fabric's vendor (in display form, e.g., "Cisco" or "Brocade")
            const fabricVendor = rowData?.san_vendor;

            console.log('🔍 Filtering switches for fabric vendor:', fabricVendor);
            console.log('🔍 Row data:', rowData);
            console.log('🔍 Available switches:', switches);

            // Convert vendor name to code for comparison
            const vendorCode = vendorOptions.find(v => v.name === fabricVendor)?.code;

            console.log('🔍 Vendor code:', vendorCode);

            if (!vendorCode) {
                // If no vendor selected, show all switches
                console.log('🔍 No vendor code, showing all switches');
                return options; // Return all options
            }

            // Filter switches to only those matching the fabric's vendor
            const filteredSwitches = switches.filter(s => {
                console.log(`🔍 Checking switch ${s.name}: ${s.san_vendor} === ${vendorCode}?`, s.san_vendor === vendorCode);
                return s.san_vendor === vendorCode;
            });

            console.log('🔍 Filtered switches:', filteredSwitches);

            // Return the filtered switch names
            const filteredNames = filteredSwitches.map(s => s.name);
            console.log('🔍 Returning filtered names:', filteredNames);
            return filteredNames;
        }
    }), [switches]);

    const NEW_FABRIC_TEMPLATE = {
        id: null,
        name: "",
        san_vendor: "",
        switch: "",
        zoneset_name: "",
        domain_id: "",
        vsan: "",
        alias_count: 0,
        zone_count: 0,
        exists: false,
        notes: ""
    };

    // Process data for display - convert vendor codes to names and switch IDs to names
    const preprocessData = (data) => {
        return data.map(fabric => ({
            ...fabric,
            san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor,
            switch: fabric.switch_details?.name || ""
        }));
    };

    // Transform data for saving - convert vendor names to codes and switch names to IDs
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
                // Find switch ID by name
                const switchObj = switches.find(s => s.name === row.switch);

                // Exclude read-only fields from save
                const { alias_count, zone_count, ...fabricData } = row;

                return {
                    ...fabricData,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === fabricData.san_vendor || v.code === fabricData.san_vendor)?.code || fabricData.san_vendor,
                    switch: switchObj?.id || null,
                    domain_id: fabricData.domain_id === "" ? null : fabricData.domain_id,
                    vsan: fabricData.vsan === "" ? null : fabricData.vsan
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

    // Show message if no active customer/project is configured
    if (!config || !customerId) {
        return <EmptyConfigMessage entityName="fabrics" />;
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure (Fabrics and Storage).
                </div>
            )}
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
                dropdownFilters={dropdownFilters}
                newRowTemplate={NEW_FABRIC_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                vendorOptions={vendorOptions}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`fabric-table-${customerId || 'default'}`}
                readOnly={isReadOnly}

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