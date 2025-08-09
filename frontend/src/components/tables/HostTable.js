import React, { useState, useMemo, useRef } from "react";
import GenericTable from "./GenericTable";

// All possible columns in the Host model
const API_URL = process.env.REACT_APP_API_URL || '';

const ALL_COLUMNS = [
  { data: "name", title: "Name" },
  { data: "storage_system", title: "Storage System" },
  { data: "wwpns", title: "WWPNs" },
  { data: "status", title: "Status" },
  { data: "acknowledged", title: "Acknowledged" },
  { data: "associated_resource", title: "Associated Resource" },
  { data: "host_type", title: "Host Type" },
  { data: "vols_count", title: "Volumes Count" },
  { data: "fc_ports_count", title: "FC Ports Count" },
  { data: "last_data_collection", title: "Last Data Collection" },
  { data: "volume_group", title: "Volume Group" },
  { data: "natural_key", title: "Natural Key" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" },
];

// Default column indices - showing most relevant host information
const DEFAULT_VISIBLE_INDICES = [0, 2, 3, 6, 7, 8, 12, 13]; // name, wwpns, status, host_type, vols_count, fc_ports_count, imported, updated

const HostTable = ({ storage }) => {
  const tableRef = useRef(null);
  
  // Column visibility state - using indices for GenericTable compatibility
  const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
    const saved = localStorage.getItem("hostTableColumns");
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
    localStorage.setItem("hostTableColumns", JSON.stringify(columnNames));
  };

  // No need for useMemo - we pass all columns to GenericTable and let it handle filtering

  const customRenderers = {
    name: (instance, td, row, col, prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      td.innerText = value || "";
      td.style.fontWeight = rowData?.saved ? "bold" : "normal";
      return td;
    },
    wwpns: (instance, td, row, col, prop, value) => {
      // Format WWPNs nicely if they're comma-separated
      if (value) {
        const wwpns = value.split(',').map(wwpn => wwpn.trim()).join(', ');
        td.innerText = wwpns;
      } else {
        td.innerText = "";
      }
      return td;
    },
    last_data_collection: (instance, td, row, col, prop, value) => {
      if (value) {
        // Convert timestamp to readable date
        const date = new Date(parseInt(value) * 1000);
        td.innerText = date.toLocaleString();
      } else {
        td.innerText = "";
      }
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
    return data.map(host => ({
      ...host,
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
    ? `${API_URL}/api/storage/hosts/?storage_system_id=${storage.storage_system_id}`
    : `${API_URL}/api/storage/hosts/?storage_system_id=0`;

  return (
    <div className="table-container" style={{ height: "100%", overflow: "hidden" }}>
      <GenericTable
        ref={tableRef}
        apiUrl={apiUrl}
        saveUrl={`${API_URL}/api/storage/hosts/`}
        deleteUrl={`${API_URL}/api/storage/hosts/`}
        serverPagination={true}
        defaultPageSize={50}
        storageKey={`host-table-${storage?.storage_system_id || 'default'}`}
        tableName="hosts"
        height="calc(100vh - 180px)"
        colHeaders={ALL_COLUMNS.map(col => col.title)}
        columns={ALL_COLUMNS.map(col => ({
          data: col.data,
          readOnly: col.data === "imported" || col.data === "updated"
        }))}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        newRowTemplate={{}}
        columnSorting={true}
        filters={false}
        defaultVisibleColumns={visibleColumnIndices}
        getExportFilename={() => `${storage.name || 'Storage'}_Hosts.csv`}
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

export default HostTable;