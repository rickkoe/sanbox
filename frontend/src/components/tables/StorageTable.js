import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { Button, DropdownButton, Dropdown, Form } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTable from "./GenericTable";
import { useNavigate } from "react-router-dom";
import Handsontable from 'handsontable'; // <- Make sure this is here
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

registerAllModules();
window.Handsontable = Handsontable; // helpful for debugging

// API endpoints
const API_ENDPOINTS = {
  storage: "http://127.0.0.1:8000/api/storage/",
};

// Template for new rows
const NEW_STORAGE_TEMPLATE = {
  id: null,
  name: "",
  storage_type: "",
  location: "",
  machine_type: "",
  model: "",
  serial_number: "",
  system_id: "",
  wwnn: "",
  firmware_level: "",
  primary_ip: "",
  saved: false
};

// All possible Storage fields for column picker
const ALL_STORAGE_COLUMNS = [
  { data: "id", title: "ID" },
  { data: "name", title: "Name" },
  { data: "storage_type", title: "Type" },
  { data: "location", title: "Location" },
  { data: "storage_system_id", title: "Storage System ID" },
  { data: "machine_type", title: "Machine Type" },
  { data: "model", title: "Model" },
  { data: "serial_number", title: "Serial Number" },
  { data: "db_volumes_count", title: "DB Volumes Count" },
  { data: "system_id", title: "System ID" },
  { data: "wwnn", title: "WWNN" },
  { data: "firmware_level", title: "Firmware Level" },
  { data: "primary_ip", title: "Primary IP" },
  { data: "secondary_ip", title: "Secondary IP" },
  { data: "uuid", title: "UUID" },
  { data: "written_capacity_limit_bytes", title: "Written Capacity Limit (Bytes)" },
  { data: "unmapped_capacity_percent", title: "Unmapped Capacity (%)" },
  { data: "last_successful_probe", title: "Last Successful Probe" },
  { data: "provisioned_written_capacity_percent", title: "Provisioned Written Capacity (%)" },
  { data: "capacity_savings_bytes", title: "Capacity Savings (Bytes)" },
  { data: "raw_capacity_bytes", title: "Raw Capacity (Bytes)" },
  { data: "provisioned_capacity_percent", title: "Provisioned Capacity (%)" },
  { data: "mapped_capacity_percent", title: "Mapped Capacity (%)" },
  { data: "available_written_capacity_bytes", title: "Available Written Capacity (Bytes)" },
  { data: "mapped_capacity_bytes", title: "Mapped Capacity (Bytes)" },
  { data: "probe_status", title: "Probe Status" },
  { data: "available_volume_capacity_bytes", title: "Available Volume Capacity (Bytes)" },
  { data: "capacity_savings_percent", title: "Capacity Savings (%)" },
  { data: "overhead_capacity_bytes", title: "Overhead Capacity (Bytes)" },
  { data: "customer_country_code", title: "Customer Country Code" },
  { data: "events_status", title: "Events Status" },
  { data: "unmapped_capacity_bytes", title: "Unmapped Capacity (Bytes)" },
  { data: "last_successful_monitor", title: "Last Successful Monitor" },
  { data: "remote_relationships_count", title: "Remote Relationships Count" },
  { data: "condition", title: "Condition" },
  { data: "customer_number", title: "Customer Number" },
  { data: "capacity_bytes", title: "Capacity (Bytes)" },
  { data: "used_written_capacity_percent", title: "Used Written Capacity (%)" },
  { data: "pools_count", title: "Pools Count" },
  { data: "pm_status", title: "PM Status" },
  { data: "shortfall_percent", title: "Shortfall (%)" },
  { data: "used_written_capacity_bytes", title: "Used Written Capacity (Bytes)" },
  { data: "available_system_capacity_bytes", title: "Available System Capacity (Bytes)" },
  { data: "used_capacity_bytes", title: "Used Capacity (Bytes)" },
  { data: "volumes_count", title: "SI Volumes Count" },
  { data: "deduplication_savings_percent", title: "Deduplication Savings (%)" },
  { data: "data_collection", title: "Data Collection" },
  { data: "available_capacity_bytes", title: "Available Capacity (Bytes)" },
  { data: "used_capacity_percent", title: "Used Capacity (%)" },
  { data: "disks_count", title: "Disks Count" },
  { data: "unprotected_volumes_count", title: "Unprotected Volumes Count" },
  { data: "provisioned_capacity_bytes", title: "Provisioned Capacity (Bytes)" },
  { data: "available_system_capacity_percent", title: "Available System Capacity (%)" },
  { data: "deduplication_savings_bytes", title: "Deduplication Savings (Bytes)" },
  { data: "vendor", title: "Vendor" },
  { data: "recent_fill_rate", title: "Recent Fill Rate" },
  { data: "recent_growth", title: "Recent Growth" },
  { data: "time_zone", title: "Time Zone" },
  { data: "fc_ports_count", title: "FC Ports Count" },
  { data: "staas_environment", title: "STAAS Environment" },
  { data: "element_manager_url", title: "Element Manager URL" },
  { data: "probe_schedule", title: "Probe Schedule" },
  { data: "acknowledged", title: "Acknowledged" },
  { data: "safe_guarded_capacity_bytes", title: "Safe Guarded Capacity (Bytes)" },
  { data: "read_cache_bytes", title: "Read Cache (Bytes)" },
  { data: "write_cache_bytes", title: "Write Cache (Bytes)" },
  { data: "compressed", title: "Compressed" },
  { data: "callhome_system", title: "Callhome System" },
  { data: "ransomware_threat_detection", title: "Ransomware Threat Detection" },
  { data: "threat_notification_recipients", title: "Threat Notification Recipients" },
  { data: "current_power_usage_watts", title: "Current Power Usage (Watts)" },
  { data: "system_temperature_celsius", title: "System Temperature (°C)" },
  { data: "system_temperature_Fahrenheit", title: "System Temperature (°F)" },
  { data: "power_efficiency", title: "Power Efficiency" },
  { data: "co2_emission", title: "CO₂ Emission" },
  { data: "safeguarded_virtual_capacity_bytes", title: "Safeguarded Virtual Capacity (Bytes)" },
  { data: "safeguarded_used_capacity_percentage", title: "Safeguarded Used Capacity (%)" },
  { data: "data_collection_type", title: "Data Collection Type" },
  { data: "data_reduction_savings_percent", title: "Data Reduction Savings (%)" },
  { data: "data_reduction_savings_bytes", title: "Data Reduction Savings (Bytes)" },
  { data: "data_reduction_ratio", title: "Data Reduction Ratio" },
  { data: "total_compression_ratio", title: "Total Compression Ratio" },
  { data: "host_connections_count", title: "Host Connections Count" },
  { data: "drive_compression_savings_percent", title: "Drive Compression Savings (%)" },
  { data: "remaining_unallocated_capacity_bytes", title: "Remaining Unallocated Capacity (Bytes)" },
  { data: "pool_compression_savings_bytes", title: "Pool Compression Savings (Bytes)" },
  { data: "compression_savings_bytes", title: "Compression Savings (Bytes)" },
  { data: "compression_savings_percent", title: "Compression Savings (%)" },
  { data: "ip_ports_count", title: "IP Ports Count" },
  { data: "overprovisioned_capacity_bytes", title: "Overprovisioned Capacity (Bytes)" },
  { data: "unallocated_volume_capacity_bytes", title: "Unallocated Volume Capacity (Bytes)" },
  { data: "managed_disks_count", title: "Managed Disks Count" },
  { data: "drive_compression_savings_bytes", title: "Drive Compression Savings (Bytes)" },
  { data: "pool_compression_savings_percent", title: "Pool Compression Savings (%)" },
  { data: "drive_compression_ratio", title: "Drive Compression Ratio" },
  { data: "pool_compression_ratio", title: "Pool Compression Ratio" },
  { data: "topology", title: "Topology" },
  { data: "cluster_id_alias", title: "Cluster ID Alias" },
  { data: "snapshot_written_capacity_bytes", title: "Snapshot Written Capacity (Bytes)" },
  { data: "snapshot_provisioned_capacity_bytes", title: "Snapshot Provisioned Capacity (Bytes)" },
  { data: "total_savings_ratio", title: "Total Savings Ratio" },
  { data: "volume_groups_count", title: "Volume Groups Count" },
  { data: "notes", title: "Notes" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
];
const DEFAULT_STORAGE_VISIBLE = ALL_STORAGE_COLUMNS.map(col => col.data);

const StorageTable = () => {
  const { config, setActiveStorageSystem } = useContext(ConfigContext);
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [debug, setDebug] = useState(null);
  
  // Get the customer ID from the config context
  const customerId = config?.customer?.id;

  // Column picker state and handlers
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = JSON.parse(localStorage.getItem("storageTableColumns"));
    return saved || DEFAULT_STORAGE_VISIBLE;
  });
  const toggleCol = (col) => {
    const updated = visibleCols.includes(col)
      ? visibleCols.filter(c => c !== col)
      : [...visibleCols, col];
    setVisibleCols(updated);
    localStorage.setItem("storageTableColumns", JSON.stringify(updated));
  };
  const selectAll = () => {
    setVisibleCols(DEFAULT_STORAGE_VISIBLE);
    localStorage.setItem("storageTableColumns", JSON.stringify(DEFAULT_STORAGE_VISIBLE));
  };
  const selectDefault = () => {
    // choose your default subset, here using first 8
    const defs = DEFAULT_STORAGE_VISIBLE.slice(0, 8);
    setVisibleCols(defs);
    localStorage.setItem("storageTableColumns", JSON.stringify(defs));
  };

  // Table configuration
  const tableConfig = {
    colHeaders: [
      '<i class="fa fa-link"></i>',
      "Name", "Type", "Location", "Machine Type", "Model", 
      "Serial Number", "Storage System ID", "WWNN", "Firmware", "Primary IP",
      "Imported",
      "Updated"
    ],
    columns: [
      { data: "id", className: "htCenter" },
      { data: "name" },
      { data: "storage_type", type: "dropdown" },
      { data: "location" },
      { data: "machine_type" },
      { data: "model" },
      { data: "serial_number" },
      { data: "storage_system_id" },
      { data: "wwnn" },
      { data: "firmware_level" },
      { data: "primary_ip" },
      { data: "imported" },
      { data: "updated" }
    ],
    dropdownSources: {
      "storage_type": ["FlashSystem", "DS8000", "Switch", "Data Domain"]
    },
    // Process data for display
    preprocessData: (data) => {
      return data.map(storage => ({
        ...storage,
        saved: true
      }));
    },
    // Custom renderers
    customRenderers: {
      name: (instance, td, row, col, prop, value) => {
        const rowData = instance.getSourceDataAtRow(row);
        td.innerText = value || "";
        td.style.fontWeight = rowData?.saved ? "bold" : "normal";
        return td;
      },
      imported: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      },
      updated: (instance, td, row, col, prop, value) => {
        td.innerText = value ? new Date(value).toLocaleString() : "";
        return td;
      },
      id: (instance, td, row, col, prop, value) => {
        const rowData = instance.getSourceDataAtRow(row);
        td.innerHTML = "";
        td.style.textAlign = "center";
        if (!rowData?.id) {
          return td;
        }
        const link = document.createElement("a");
        link.innerHTML = '<i class="fa fa-link"></i>';
        link.href = "#";
        link.title = "Properties";
        link.style.cursor = "pointer";
        link.onclick = (e) => {
          e.preventDefault();
          navigate(`/storage/${rowData.id}`);
        };
        td.appendChild(link);
        return td;
      }
    },
    // Prepare payload for saving - inject customer ID
    onBuildPayload: (row) => {
      // Clean up payload
      const payload = { ...row };
      delete payload.saved;
      
      // Ensure required fields are present and non-empty
      if (!payload.name || payload.name.trim() === "") {
        payload.name = "Unnamed Storage"; // Default name to prevent validation error
      }
      
      if (!payload.storage_type || payload.storage_type.trim() === "") {
        payload.storage_type = "DS8000"; // Default type to prevent validation error
      }
      
      // Add the customer ID from the context
      payload.customer = customerId;
      
      // Convert empty strings to null for optional fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === "" && key !== "name" && key !== "storage_type") {
          payload[key] = null;
        }
      });
      
      console.log("Sending storage payload:", payload);
      
      return payload;
    },
    // Custom save handler with improved error handling
    onSave: async (unsavedData) => {
      try {
        // Check if customer ID is available
        if (!customerId) {
          return { 
            success: false, 
            message: "No active customer selected. Please select a customer in configuration." 
          };
        }
        
        // Only include rows with data - skip completely empty rows
        const payload = unsavedData
          .filter(storage => {
            // If it has an ID, include it
            if (storage.id) return true;
            
            // For new rows, check if ANY field has data
            const hasData = Object.entries(storage).some(([key, value]) => {
              return key !== 'id' && key !== 'saved' && value && value.toString().trim() !== '';
            });
            
            return hasData;
          })
          .map(tableConfig.onBuildPayload);
        
        // For debugging, store the payload we're sending
        setDebug({ sending: payload });
        
        if (payload.length === 0) {
          return { success: true, message: "No changes to save" };
        }
        
        // Create an array to collect all errors
        const errors = [];
        
        // For each storage item, send appropriate request
        for (const storage of payload) {
          try {
            if (storage.id) {
              // Update existing storage
              await axios.put(`${API_ENDPOINTS.storage}${storage.id}/`, storage);
            } else {
              // Create new storage
              const newStorage = { ...storage };
              delete newStorage.id;
              await axios.post(API_ENDPOINTS.storage, newStorage);
            }
          } catch (error) {
            // Capture detailed error information
            const errorDetails = {
              id: storage.id || 'new',
              name: storage.name,
              error: error.response?.data || error.message
            };
            
            console.error(`Error saving storage ${storage.name}:`, errorDetails);
            errors.push(errorDetails);
          }
        }
        
        // If we encountered any errors
        if (errors.length > 0) {
          setDebug(prev => ({ ...prev, errors }));
          
          // Format a user-friendly error message
          let errorMessage = `Error saving ${errors.length} storage items:`;
          
          errors.forEach(err => {
            errorMessage += `\n- ${err.name || 'New item'}: `;
            
            if (typeof err.error === 'object') {
              // Format field errors nicely
              const fieldErrors = Object.entries(err.error)
                .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                .join('; ');
                
              errorMessage += fieldErrors;
            } else {
              errorMessage += err.error;
            }
          });
          
          return { 
            success: false, 
            message: errorMessage
          };
        }
        
        return { success: true, message: "Storage saved successfully! ✅" };
      } catch (error) {
        console.error("General save error:", error);
        return { 
          success: false, 
          message: `⚠️ Error: ${error.message}` 
        };
      }
    },
    // Pre-save validation
    beforeSave: (data) => {
      // Check if we have an active customer
      if (!customerId) {
        return "No active customer selected. Please select a customer in configuration.";
      }
      
      // Validate storage type is selected for items with a name
      const invalidStorage = data.find(storage => 
        storage.name && storage.name.trim() !== "" && 
        (!storage.storage_type || storage.storage_type.trim() === "")
      );
      
      if (invalidStorage) {
        return `Storage "${invalidStorage.name}" must have a storage type selected`;
      }
      
      return true;
    }
  };

  // We need to also modify the API URL to filter by customer when loading
  const apiUrl = customerId ? `${API_ENDPOINTS.storage}?customer=${customerId}` : API_ENDPOINTS.storage;

  // Compute dynamic columns and headers
  const displayedColumns = ALL_STORAGE_COLUMNS.filter(col => visibleCols.includes(col.data));
  const displayedHeaders = displayedColumns.map(col => col.title);

  if (!customerId) {
    return (
      <div className="alert alert-warning">
        No active customer selected. Please select a customer in configuration.
      </div>
    );
  }

  return (
    <div className="table-container">
      <GenericTable
        {...tableConfig}
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_Storage Table.csv`}
        ref={tableRef}
        licenseKey="non-commercial-and-evaluation"

        apiUrl={apiUrl}
        saveUrl={API_ENDPOINTS.storage}
        deleteUrl={API_ENDPOINTS.storage}
        newRowTemplate={NEW_STORAGE_TEMPLATE}
        fixedColumnsLeft={1}
        columnSorting={true}
        filters={true}       
        dropdownMenu={true}
        storageKey="zoneTableColumnWidths"
        colHeaders={displayedHeaders}
        columns={displayedColumns}
        additionalButtons={
        <>
        {/* Your existing buttons */}
        </>
        }
      />
    </div>
  );
};

export default StorageTable;