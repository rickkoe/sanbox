import React, { useState, useRef, useContext, useMemo } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTable from "./GenericTable";
import { useNavigate } from "react-router-dom";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  storage: `${API_URL}/api/storage/`,
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
  { data: "db_volumes_count", title: "DB Volumes" },
  { data: "db_hosts_count", title: "DB Hosts" },
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

// Default visible columns indices - includes ID, Name, Type, Location, Storage System ID, Machine Type, Model, Serial Number, DB Volumes, DB Hosts, System ID, WWNN, Firmware Level, Primary IP
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // includes the new db_hosts_count column

const StorageTable = () => {
  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);
  const navigate = useNavigate();
  const [debug, setDebug] = useState(null);
  const [resetingConfig, setResetingConfig] = useState(false);
  
  // Get the customer ID from the config context
  const customerId = config?.customer?.id;

  // Use the default visible columns defined in the constant
  const visibleColumnIndices = DEFAULT_VISIBLE_INDICES;

  const dropdownSources = {
    "storage_type": ["FlashSystem", "DS8000", "Switch", "Data Domain"]
  };

  // Process data for display
  const preprocessData = (data) => {
    return data.map(storage => ({
      ...storage,
      saved: true
    }));
  };

  // Custom renderers
  const customRenderers = {
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
  };

  // Build payload function
  const buildPayload = (row) => {
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
    payload.customer = customerId;
    
    // Convert empty strings to null for optional fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === "" && key !== "name" && key !== "storage_type") {
        payload[key] = null;
      }
    });
    
    return payload;
  };

  // Custom save handler
  const handleSave = async (unsavedData) => {
    try {
      if (!customerId) {
        return { 
          success: false, 
          message: "No active customer selected. Please select a customer in configuration." 
        };
      }
      
      const payload = unsavedData
        .filter(storage => {
          if (storage.id) return true;
          const hasData = Object.entries(storage).some(([key, value]) => {
            return key !== 'id' && key !== 'saved' && value && value.toString().trim() !== '';
          });
          return hasData;
        })
        .map(buildPayload);
      
      setDebug({ sending: payload });
      
      if (payload.length === 0) {
        return { success: true, message: "No changes to save" };
      }
      
      const errors = [];
      
      for (const storage of payload) {
        try {
          if (storage.id) {
            await axios.put(`${API_ENDPOINTS.storage}${storage.id}/`, storage);
          } else {
            const newStorage = { ...storage };
            delete newStorage.id;
            await axios.post(API_ENDPOINTS.storage, newStorage);
          }
        } catch (error) {
          const errorDetails = {
            id: storage.id || 'new',
            name: storage.name,
            error: error.response?.data || error.message
          };
          
          console.error(`Error saving storage ${storage.name}:`, errorDetails);
          errors.push(errorDetails);
        }
      }
      
      if (errors.length > 0) {
        setDebug(prev => ({ ...prev, errors }));
        
        let errorMessage = `Error saving ${errors.length} storage items:`;
        
        errors.forEach(err => {
          errorMessage += `\n- ${err.name || 'New item'}: `;
          
          if (typeof err.error === 'object') {
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
  };

  // Reset table configuration
  const handleResetConfiguration = async () => {
    if (!customerId) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to reset the table configuration? This will restore default column visibility and clear all filters.'
    );
    
    if (!confirmed) return;
    
    setResetingConfig(true);
    try {
      await axios.post('/api/core/table-config/reset/', {
        customer: customerId,
        table_name: 'storage'
      });
      
      // Refresh the page to reload with default settings
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset table configuration:', error);
      alert('Failed to reset table configuration. Please try again.');
    } finally {
      setResetingConfig(false);
    }
  };

  // Pre-save validation
  const beforeSaveValidation = (data) => {
    if (!customerId) {
      return "No active customer selected. Please select a customer in configuration.";
    }
    
    const invalidStorage = data.find(storage => 
      storage.name && storage.name.trim() !== "" && 
      (!storage.storage_type || storage.storage_type.trim() === "")
    );
    
    if (invalidStorage) {
      return `Storage "${invalidStorage.name}" must have a storage type selected`;
    }
    
    return true;
  };

  // Don't add query params here - let useServerPagination handle them
  const apiUrl = API_ENDPOINTS.storage;

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
        ref={tableRef}
        apiUrl={apiUrl}
        apiParams={{ customer: customerId }}
        saveUrl={API_ENDPOINTS.storage}
        deleteUrl={API_ENDPOINTS.storage}
        newRowTemplate={NEW_STORAGE_TEMPLATE}
        colHeaders={ALL_STORAGE_COLUMNS.map(col => col.title)}
        columns={ALL_STORAGE_COLUMNS.map(col => ({
          data: col.data,
          type: col.data === "storage_type" ? "dropdown" : undefined,
          className: col.data === "id" ? "htCenter" : undefined,
          readOnly: col.data === "imported" || col.data === "updated" || col.data === "db_volumes_count" || col.data === "db_hosts_count"
        }))}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        fixedColumnsLeft={1}
        columnSorting={true}
        filters={false}       
        dropdownMenu={false}
        storageKey="storageTableColumnWidths"
        defaultVisibleColumns={visibleColumnIndices}
        tableName="storage"
        getExportFilename={() => `${config?.customer?.name}_Storage_Table.csv`}
        additionalButtons={
          <>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleResetConfiguration}
              disabled={resetingConfig}
              title="Reset table configuration to default settings"
            >
              {resetingConfig ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Resetting...
                </>
              ) : (
                <>
                  <i className="fa fa-refresh me-1"></i>
                  Reset Config
                </>
              )}
            </button>
            {debug && (
              <div style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                Debug: {JSON.stringify(debug, null, 2)}
              </div>
            )}
          </>
        }
      />
    </div>
  );
};

export default StorageTable;