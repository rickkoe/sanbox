import React, { useState } from "react";
import GenericTable from "./GenericTable";
import { DropdownButton, Dropdown, Form } from "react-bootstrap";

// All possible columns in the Volume model
const ALL_COLUMNS = [
  { data: "name", title: "Name" },
  { data: "unique_id", title: "Unique ID" },
  { data: "capacity_bytes", title: "Capacity (Bytes)" },
  { data: "used_capacity_bytes", title: "Used Capacity (Bytes)" },
  { data: "available_capacity_bytes", title: "Available Capacity (Bytes)" },
  { data: "thin_provisioned", title: "Thin Provisioned" },
  { data: "pool_name", title: "Pool Name" },
  { data: "raid_level", title: "RAID Level" },
  { data: "status_label", title: "Status" },
  { data: "node", title: "Node" },
  { data: "encryption", title: "Encryption" },
  { data: "compressed", title: "Compressed" },
  { data: "storage_system", title: "Storage System" },
  { data: "format", title: "Format" },
  { data: "volume_id", title: "Volume ID" },
  { data: "copy_id", title: "Copy ID" },
  { data: "auto_expand", title: "Auto Expand" },
  { data: "warning_level_percent", title: "Warning Level (%)" },
  { data: "last_data_collection", title: "Last Data Collection" },
  { data: "storage_system_id", title: "Storage System ID" },
];

// Default column selection
const DEFAULT_VISIBLE = [
  "name", "unique_id", "capacity_bytes", "used_capacity_bytes", "pool_name", "thin_provisioned"
];

const VolumeTable = () => {
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = localStorage.getItem("volumeTableColumns");
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
  });

  const toggleCol = (col) => {
    const updated = visibleCols.includes(col)
      ? visibleCols.filter(c => c !== col)
      : [...visibleCols, col];
    setVisibleCols(updated);
    localStorage.setItem("volumeTableColumns", JSON.stringify(updated));
  };

  const columns = ALL_COLUMNS.filter(col => visibleCols.includes(col.data));
  const colHeaders = columns.map(col => col.title);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4>Volumes</h4>
        <DropdownButton title="Columns" variant="outline-secondary">
          {ALL_COLUMNS.map(col => (
            <Dropdown.Item key={col.data} as="div">
              <Form.Check
                type="checkbox"
                label={col.title}
                id={`col-${col.data}`}
                checked={visibleCols.includes(col.data)}
                onChange={() => toggleCol(col.data)}
              />
            </Dropdown.Item>
          ))}
        </DropdownButton>
      </div>

      <GenericTable
        apiUrl="/api/volumes/"
        saveUrl="/api/volumes/"
        deleteUrl="/api/volumes/"
        columns={columns}
        colHeaders={colHeaders}
        newRowTemplate={{}}
        getExportFilename={() => "volumes_export.csv"}
        fixedColumnsLeft={1}
        columnSorting={true}
        filters={true}
        storageKey="volumeTableWidths"
      />
    </>
  );
};

export default VolumeTable;