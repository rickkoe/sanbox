import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";

// Clean TanStack Table implementation for Storage management
const StorageTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const navigate = useNavigate();

    const activeCustomerId = config?.customer?.id;

    // API endpoints
    const API_ENDPOINTS = {
        storage: `${API_URL}/api/storage/`
    };

    // Core storage columns (most commonly used)
    const columns = [
        { data: "id", title: "Details", type: "custom", readOnly: true },
        { data: "name", title: "Name", required: true },
        { data: "storage_type", title: "Type", type: "dropdown" },
        { data: "location", title: "Location" },
        { data: "storage_system_id", title: "Storage System ID" },
        { data: "machine_type", title: "Machine Type" },
        { data: "model", title: "Model" },
        { data: "serial_number", title: "Serial Number" },
        { data: "db_volumes_count", title: "DB Volumes", type: "numeric", readOnly: true },
        { data: "db_hosts_count", title: "DB Hosts", type: "numeric", readOnly: true },
        { data: "db_aliases_count", title: "DB Aliases", type: "numeric", readOnly: true },
        { data: "system_id", title: "System ID" },
        { data: "wwnn", title: "WWNN" },
        { data: "firmware_level", title: "Firmware Level" },
        { data: "primary_ip", title: "Primary IP" },
        { data: "secondary_ip", title: "Secondary IP" },
        { data: "vendor", title: "Vendor" },
        { data: "condition", title: "Condition" },
        { data: "probe_status", title: "Probe Status" },
        { data: "capacity_bytes", title: "Capacity (Bytes)", type: "numeric" },
        { data: "used_capacity_bytes", title: "Used Capacity (Bytes)", type: "numeric" },
        { data: "available_capacity_bytes", title: "Available Capacity (Bytes)", type: "numeric" },
        { data: "volumes_count", title: "SI Volumes Count", type: "numeric" },
        { data: "pools_count", title: "Pools Count", type: "numeric" },
        { data: "disks_count", title: "Disks Count", type: "numeric" },
        { data: "fc_ports_count", title: "FC Ports Count", type: "numeric" },
        { data: "notes", title: "Notes" },
        { data: "imported", title: "Imported", readOnly: true },
        { data: "updated", title: "Updated", readOnly: true }
    ];

    const colHeaders = columns.map(col => col.title);

    const NEW_STORAGE_TEMPLATE = {
        id: null,
        name: "",
        storage_type: "",
        location: "",
        storage_system_id: "",
        machine_type: "",
        model: "",
        serial_number: "",
        db_volumes_count: 0,
        db_hosts_count: 0,
        db_aliases_count: 0,
        system_id: "",
        wwnn: "",
        firmware_level: "",
        primary_ip: "",
        secondary_ip: "",
        vendor: "",
        condition: "",
        probe_status: "",
        capacity_bytes: null,
        used_capacity_bytes: null,
        available_capacity_bytes: null,
        volumes_count: 0,
        pools_count: 0,
        disks_count: 0,
        fc_ports_count: 0,
        notes: "",
        imported: null,
        updated: null
    };

    // Dropdown sources
    const dropdownSources = useMemo(() => ({
        storage_type: ["FlashSystem", "DS8000", "Switch", "Data Domain"]
    }), []);

    // Custom renderers for special columns
    const customRenderers = useMemo(() => ({
        id: (rowData, td, row, col, prop, value) => {
            console.log('📋 Details renderer called with:', { rowData, value, hasId: !!rowData?.id });

            // Check both rowData.id and the actual value parameter
            const storageId = rowData?.id || value;

            if (!storageId) {
                console.log('📋 No storage ID found, rendering empty cell');
                return { __isReactComponent: true, component: null };
            }

            console.log('📋 Rendering Details button for storage ID:', storageId);
            return {
                __isReactComponent: true,
                component: (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔗 Button clicked! Navigating to:', `/storage/${storageId}`);
                            navigate(`/storage/${storageId}`);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        Details
                    </button>
                )
            };
        },
        imported: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        updated: (rowData, td, row, col, prop, value) => {
            return value ? new Date(value).toLocaleString() : "";
        },
        name: (rowData, td, row, col, prop, value) => {
            // Just return the value - styling will be handled by CSS
            return value || "";
        }
    }), [navigate]);

    // Process data for display
    const preprocessData = useCallback((data) => {
        return data.map(storage => ({
            ...storage,
            saved: !!storage.id
        }));
    }, []);

    // Transform data for saving
    const saveTransform = useCallback((rows) => {
        return rows.map(row => {
            const payload = { ...row };
            delete payload.saved;

            // Ensure required fields are present and non-empty
            if (!payload.name || payload.name.trim() === "") {
                payload.name = "Unnamed Storage";
            }

            if (!payload.storage_type || payload.storage_type.trim() === "") {
                payload.storage_type = "DS8000";
            }

            // Add the customer ID from the context
            payload.customer = activeCustomerId;

            // Convert empty strings to null for optional fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === "" && key !== "name" && key !== "storage_type") {
                    payload[key] = null;
                }
            });

            return payload;
        });
    }, [activeCustomerId]);

    // Show loading while customer loads
    if (!activeCustomerId) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Please select a customer to view storage systems</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_ENDPOINTS.storage}?customer=${activeCustomerId}`}
                saveUrl={API_ENDPOINTS.storage}
                deleteUrl={API_ENDPOINTS.storage}
                customerId={activeCustomerId}
                tableName="storage"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={dropdownSources}
                newRowTemplate={NEW_STORAGE_TEMPLATE}

                // Data Processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey={`storage-table-${activeCustomerId || 'default'}`}

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Storage save successful:', result.message);
                    } else {
                        console.error('❌ Storage save failed:', result.message);
                        alert('Error saving storage systems: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default StorageTableTanStackClean;