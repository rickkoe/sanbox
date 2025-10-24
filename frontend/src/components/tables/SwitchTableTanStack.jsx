import React, { useContext, useState, useEffect } from "react";
import { ConfigContext } from "../../context/ConfigContext";
import { useAuth } from "../../context/AuthContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import api from "../../api";

// TanStack Table implementation for Switch management
const SwitchTableTanStack = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const { getUserRole } = useAuth();
    const customerId = config?.customer?.id;

    // Check if user can edit infrastructure (members and admins only)
    const userRole = getUserRole(customerId);
    const canEditInfrastructure = userRole === 'member' || userRole === 'admin';
    const isReadOnly = !canEditInfrastructure;

    // State for fabrics dropdown
    const [fabrics, setFabrics] = useState([]);
    const [fabricsLoading, setFabricsLoading] = useState(false);

    // Fetch fabrics for the active customer
    useEffect(() => {
        const fetchFabrics = async () => {
            if (!customerId) return;

            setFabricsLoading(true);
            try {
                const response = await api.get(`/api/san/fabrics/?customer_id=${customerId}`);
                console.log('📡 Fetched fabrics:', response.data);
                // Handle paginated response
                const fabricsData = response.data.results || response.data;
                setFabrics(fabricsData);
            } catch (error) {
                console.error('Error fetching fabrics:', error);
            } finally {
                setFabricsLoading(false);
            }
        };

        fetchFabrics();
    }, [customerId]);

    // Vendor mapping (same as FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // WWNN formatting utilities (same as WWPN formatting in AliasTable)
    const formatWWNN = (value) => {
        if (!value) return "";
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleanValue.length !== 16) return value;
        return cleanValue.match(/.{2}/g).join(':');
    };

    const isValidWWNNFormat = (value) => {
        if (!value) return true;
        const cleanValue = value.replace(/[^0-9a-fA-F]/g, '');
        return cleanValue.length <= 16 && /^[0-9a-fA-F]*$/.test(cleanValue);
    };

    // All possible switch columns
    const columns = [
        { data: "name", title: "Name", required: true },
        { data: "san_vendor", title: "Vendor", type: "dropdown", required: true },
        { data: "fabrics", title: "Fabrics", type: "dropdown", allowMultiple: true },
        { data: "wwnn", title: "WWNN" },
        { data: "ip_address", title: "IP Address" },
        { data: "subnet_mask", title: "Subnet Mask", defaultVisible: false },
        { data: "gateway", title: "Gateway", defaultVisible: false },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number", defaultVisible: false },
        { data: "firmware_version", title: "Firmware Version", defaultVisible: false },
        { data: "is_active", title: "Active", type: "checkbox" },
        { data: "location", title: "Location" },
        { data: "notes", title: "Notes" }
    ];

    const colHeaders = columns.map(col => col.title);

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name),
        fabrics: fabrics.map(f => f.name)
    };

    const NEW_SWITCH_TEMPLATE = {
        id: null,
        name: "",
        san_vendor: "",
        fabrics: [],
        wwnn: "",
        ip_address: "",
        subnet_mask: "",
        gateway: "",
        model: "",
        serial_number: "",
        firmware_version: "",
        is_active: true,
        location: "",
        notes: ""
    };

    // Custom renderers for WWNN formatting
    const customRenderers = {
        wwnn: (rowData, td, row, col, prop, value) => {
            if (value && isValidWWNNFormat(value)) {
                return formatWWNN(value);
            }
            return value || "";
        }
    };

    // Process data for display - convert vendor codes to names and format fabrics
    const preprocessData = (data) => {
        return data.map(switchItem => ({
            ...switchItem,
            san_vendor: vendorOptions.find(v => v.code === switchItem.san_vendor)?.name || switchItem.san_vendor,
            fabrics: switchItem.fabrics_details?.map(f => f.name) || []
        }));
    };

    // Transform data for saving - convert vendor names to codes, format WWNN, and convert fabric names to IDs
    const saveTransform = (rows) =>
        rows
            .filter(row => {
                const requiredFields = ["name", "san_vendor"];
                return requiredFields.some(key => {
                    const value = row[key];
                    return typeof value === "string" && value.trim() !== "";
                });
            })
            .map(row => {
                // Convert fabric names to IDs
                const fabricIds = Array.isArray(row.fabrics)
                    ? row.fabrics
                        .map(fabricName => fabrics.find(f => f.name === fabricName)?.id)
                        .filter(id => id !== undefined)
                    : [];

                return {
                    ...row,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === row.san_vendor || v.code === row.san_vendor)?.code || row.san_vendor,
                    fabrics: fabricIds,
                    wwnn: row.wwnn ? formatWWNN(row.wwnn) : null,
                    ip_address: row.ip_address === "" ? null : row.ip_address,
                    subnet_mask: row.subnet_mask === "" ? null : row.subnet_mask,
                    gateway: row.gateway === "" ? null : row.gateway,
                    model: row.model === "" ? null : row.model,
                    serial_number: row.serial_number === "" ? null : row.serial_number,
                    firmware_version: row.firmware_version === "" ? null : row.firmware_version,
                    location: row.location === "" ? null : row.location
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
        return <EmptyConfigMessage entityName="switches" />;
    }

    return (
        <div className="modern-table-container">
            {isReadOnly && (
                <div className="alert alert-info mb-3" role="alert">
                    <strong>Read-only access:</strong> You have viewer permissions for this customer. Only members and admins can modify infrastructure (Switches and Fabrics).
                </div>
            )}
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/san/switches/`}
                saveUrl={`${API_URL}/api/san/switches/`}
                deleteUrl={`${API_URL}/api/san/switches/delete/`}
                customerId={customerId}
                tableName="switches"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                customRenderers={customRenderers}
                newRowTemplate={NEW_SWITCH_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                vendorOptions={vendorOptions}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`switch-table-${customerId || 'default'}`}
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

export default SwitchTableTanStack;
