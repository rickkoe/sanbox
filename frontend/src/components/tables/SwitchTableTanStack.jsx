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
        { data: "domain_ids", title: "Domain IDs" },  // Custom editable cell component
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
        domain_ids: "",
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

    // Process data for display - convert vendor codes to names, format fabrics, and domain IDs
    const preprocessData = (data) => {
        return data.map(switchItem => ({
            ...switchItem,
            san_vendor: vendorOptions.find(v => v.code === switchItem.san_vendor)?.name || switchItem.san_vendor,
            fabrics: switchItem.fabric_domain_details?.map(f => f.name) || [],
            domain_ids: switchItem.fabric_domain_details?.map(f => {
                const domainStr = f.domain_id !== null && f.domain_id !== undefined ? f.domain_id : '';
                return `${f.name}: ${domainStr}`;
            }).join('\n') || ""
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
                // Build fabric_domains from fabric_domain_details (which has names and domain_ids)
                // We need to look up fabric IDs from the fabrics list
                let fabric_domains = [];

                if (Array.isArray(row.fabric_domain_details) && row.fabric_domain_details.length > 0) {
                    // Use the fabric_domain_details updated by DomainIDsCell
                    fabric_domains = row.fabric_domain_details
                        .map(fd => {
                            // Look up fabric ID by name
                            const fabric = fabrics.find(f => f.name === fd.name);
                            if (fabric) {
                                return {
                                    fabric_id: fabric.id,
                                    domain_id: fd.domain_id
                                };
                            }
                            return null;
                        })
                        .filter(fd => fd !== null);
                } else if (Array.isArray(row.fabrics)) {
                    // Fall back to fabrics array (when domain IDs haven't been set yet)
                    fabric_domains = row.fabrics
                        .map(fabricName => {
                            const fabric = fabrics.find(f => f.name === fabricName);
                            return fabric ? { fabric_id: fabric.id, domain_id: null } : null;
                        })
                        .filter(fd => fd !== null);
                }

                // Exclude read-only/computed fields
                const { domain_ids, fabric_domain_details, fabrics_details, ...switchData } = row;

                return {
                    ...switchData,
                    customer: customerId,
                    san_vendor: vendorOptions.find(v => v.name === switchData.san_vendor || v.code === switchData.san_vendor)?.code || switchData.san_vendor,
                    fabric_domains: fabric_domains,  // Send as fabric_domains array
                    wwnn: switchData.wwnn ? formatWWNN(switchData.wwnn) : null,
                    ip_address: switchData.ip_address === "" ? null : switchData.ip_address,
                    subnet_mask: switchData.subnet_mask === "" ? null : switchData.subnet_mask,
                    gateway: switchData.gateway === "" ? null : switchData.gateway,
                    model: switchData.model === "" ? null : switchData.model,
                    serial_number: switchData.serial_number === "" ? null : switchData.serial_number,
                    firmware_version: switchData.firmware_version === "" ? null : switchData.firmware_version,
                    location: switchData.location === "" ? null : switchData.location
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
