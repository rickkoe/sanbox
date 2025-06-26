import React, { useState, useMemo, useRef } from "react";
import GenericTable from "./GenericTable";

// All possible columns in the Volume model
const API_URL = process.env.REACT_APP_API_URL || '';

const ALL_COLUMNS = [
  { data: "storage", title: "Storage" },
  { data: "name", title: "Name" },
  { data: "volume_id", title: "Volume ID" },
  { data: "volume_number", title: "Volume Number" },
  { data: "volser", title: "Volser" },
  { data: "format", title: "Format" },
  { data: "natural_key", title: "Natural Key" },
  { data: "capacity_bytes", title: "Capacity (Bytes)" },
  { data: "used_capacity_bytes", title: "Used Capacity (Bytes)" },
  { data: "used_capacity_percent", title: "Used Capacity (%)" },
  { data: "available_capacity_bytes", title: "Available Capacity (Bytes)" },
  { data: "written_capacity_bytes", title: "Written Capacity (Bytes)" },
  { data: "written_capacity_percent", title: "Written Capacity (%)" },
  { data: "reserved_volume_capacity_bytes", title: "Reserved Volume Capacity (Bytes)" },
  { data: "tier0_flash_capacity_percent", title: "Tier0 Flash Capacity (%)" },
  { data: "tier1_flash_capacity_percent", title: "Tier1 Flash Capacity (%)" },
  { data: "scm_capacity_percent", title: "SCM Capacity (%)" },
  { data: "enterprise_hdd_capacity_percent", title: "Enterprise HDD Capacity (%)" },
  { data: "nearline_hdd_capacity_percent", title: "Nearline HDD Capacity (%)" },
  { data: "tier_distribution_percent", title: "Tier Distribution (%)" },
  { data: "tier0_flash_capacity_bytes", title: "Tier0 Flash Capacity (Bytes)" },
  { data: "tier1_flash_capacity_bytes", title: "Tier1 Flash Capacity (Bytes)" },
  { data: "scm_capacity_bytes", title: "SCM Capacity (Bytes)" },
  { data: "enterprise_hdd_capacity_bytes", title: "Enterprise HDD Capacity (Bytes)" },
  { data: "nearline_hdd_capacity_bytes", title: "Nearline HDD Capacity (Bytes)" },
  { data: "safeguarded_virtual_capacity_bytes", title: "Safeguarded Virtual Capacity (Bytes)" },
  { data: "safeguarded_used_capacity_percentage", title: "Safeguarded Used Capacity (%)" },
  { data: "safeguarded_allocation_capacity_bytes", title: "Safeguarded Allocation Capacity (Bytes)" },
  { data: "shortfall_percent", title: "Shortfall (%)" },
  { data: "warning_level_percent", title: "Warning Level (%)" },
  { data: "compression_saving_percent", title: "Compression Saving (%)" },
  { data: "grain_size_bytes", title: "Grain Size (Bytes)" },
  { data: "compressed", title: "Compressed" },
  { data: "thin_provisioned", title: "Thin Provisioned" },
  { data: "encryption", title: "Encryption" },
  { data: "flashcopy", title: "FlashCopy" },
  { data: "auto_expand", title: "Auto Expand" },
  { data: "easy_tier", title: "Easy Tier" },
  { data: "easy_tier_status", title: "Easy Tier Status" },
  { data: "pool_name", title: "Pool Name" },
  { data: "pool_id", title: "Pool ID" },
  { data: "lss_lcu", title: "LSS LCU" },
  { data: "node", title: "Node" },
  { data: "block_size", title: "Block Size" },
  { data: "unique_id", title: "Unique ID" },
  { data: "acknowledged", title: "Acknowledged" },
  { data: "status_label", title: "Status" },
  { data: "raid_level", title: "RAID Level" },
  { data: "copy_id", title: "Copy ID" },
  { data: "safeguarded", title: "Safeguarded" },
  { data: "last_data_collection", title: "Last Data Collection" },
  { data: "scm_available_capacity_bytes", title: "SCM Available Capacity (Bytes)" },
  { data: "io_group", title: "IO Group" },
  { data: "formatted", title: "Formatted" },
  { data: "virtual_disk_type", title: "Virtual Disk Type" },
  { data: "fast_write_state", title: "Fast Write State" },
  { data: "vdisk_mirror_copies", title: "VDisk Mirror Copies" },
  { data: "vdisk_mirror_role", title: "VDisk Mirror Role" },
  { data: "deduplicated", title: "Deduplicated" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
];

// Default column indices - matching the original DEFAULT_VISIBLE selection
const DEFAULT_VISIBLE_INDICES = [1, 44, 7, 8, 39, 33, 56, 57]; // name, unique_id, capacity_bytes, used_capacity_bytes, pool_name, thin_provisioned, imported, updated

const VolumeTable = ({ storage }) => {
  const tableRef = useRef(null);
  
  // Column visibility state - using indices for GenericTable compatibility
  const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
    const saved = localStorage.getItem("volumeTableColumns");
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

  // Save column selection when it changes
  const updateColumnSelection = (newIndices) => {
    setVisibleColumnIndices(newIndices);
    // Convert indices back to column names for localStorage compatibility
    const columnNames = newIndices.map(index => ALL_COLUMNS[index]?.data).filter(Boolean);
    localStorage.setItem("volumeTableColumns", JSON.stringify(columnNames));
  };

  // Compute displayed columns and headers
  const { displayedColumns, displayedHeaders } = useMemo(() => {
    const columns = visibleColumnIndices.map(index => {
      const colConfig = ALL_COLUMNS[index];
      return {
        data: colConfig.data,
        readOnly: colConfig.data === "imported" || colConfig.data === "updated"
      };
    });
    
    const headers = visibleColumnIndices.map(index => ALL_COLUMNS[index].title);
    
    return { displayedColumns: columns, displayedHeaders: headers };
  }, [visibleColumnIndices]);

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
  };

  // Process data for display
  const preprocessData = (data) => {
    return data.map(volume => ({
      ...volume,
      saved: true
    }));
  };

  if (!storage) {
    return (
      <div className="alert alert-warning">
        No storage system selected.
      </div>
    );
  }

  // Fixed API URL construction
  const apiUrl = storage.storage_system_id
    ? `${API_URL}/api/storage/volumes/?storage_system_id=${storage.storage_system_id}`
    : `${API_URL}/api/storage/volumes/?storage_system_id=0`;

  return (
    <div className="table-container">
      <GenericTable
        ref={tableRef}
        apiUrl={apiUrl}
        saveUrl={`${API_URL}/api/storage/volumes/`}
        deleteUrl={`${API_URL}/api/storage/volumes/`}
        colHeaders={displayedHeaders}
        columns={displayedColumns}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        newRowTemplate={{}}
        columnSorting={true}
        filters={true}
        storageKey="volumeTableWidths"
        defaultVisibleColumns={visibleColumnIndices}
        getExportFilename={() => `${storage.name || 'Storage'}_Volumes.csv`}
        additionalButtons={
          <>
            {storage && (
              <div style={{ 
                fontSize: '14px', 
                color: '#666', 
                padding: '8px 12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginLeft: '10px'
              }}>
                Storage: <strong>{storage.name || storage.storage_system_id}</strong>
              </div>
            )}
          </>
        }
      />
    </div>
  );
};

export default VolumeTable;