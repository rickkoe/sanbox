import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Button } from "react-bootstrap";
import GenericTable from "./GenericTable";

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
  secondary_ip: "",
  saved: false
};

const StorageTable = () => {
  const tableRef = useRef(null);

  // Table configuration
  const tableConfig = {
    colHeaders: [
      "ID", "Name", "Type", "Location", "Machine Type", "Model", 
      "Serial Number", "System ID", "WWNN", "Firmware", "Primary IP", "Secondary IP"
    ],
    columns: [
      { data: "id", readOnly: true },
      { data: "name" },
      { data: "storage_type", type: "dropdown" },
      { data: "location" },
      { data: "machine_type" },
      { data: "model" },
      { data: "serial_number" },
      { data: "system_id" },
      { data: "wwnn" },
      { data: "firmware_level" },
      { data: "primary_ip" },
      { data: "secondary_ip" }
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
        if (rowData && rowData.id !== null && value) {
          td.style.fontWeight = "bold";
        } else {
          td.style.fontWeight = "normal";
        }
        td.innerText = value || "";
        return td;
      },
      // Mask some fields for security display
      primary_ip: (instance, td, row, col, prop, value) => {
        // Only mask if it's an actual value
        if (value && value.length > 4) {
          const firstPart = value.substring(0, 4);
          td.innerText = `${firstPart}...`;
        } else {
          td.innerText = value || "";
        }
        return td;
      },
      secondary_ip: (instance, td, row, col, prop, value) => {
        // Only mask if it's an actual value
        if (value && value.length > 4) {
          const firstPart = value.substring(0, 4);
          td.innerText = `${firstPart}...`;
        } else {
          td.innerText = value || "";
        }
        return td;
      }
    },
    // Prepare payload for saving
    onBuildPayload: (row) => {
      // Clean up payload
      const payload = { ...row };
      delete payload.saved;
      
      return payload;
    },
    // Custom save handler
    onSave: async (unsavedData) => {
      try {
        const payload = unsavedData
          .filter(storage => storage.id || (storage.name && storage.name.trim() !== ""))
          .map(tableConfig.onBuildPayload);
        
        // For each storage item, send appropriate request
        const savePromises = payload.map(storage => {
          if (storage.id) {
            // Update existing storage
            return axios.put(`${API_ENDPOINTS.storage}${storage.id}/`, storage);
          } else {
            // Create new storage
            const newStorage = { ...storage };
            delete newStorage.id;
            return axios.post(API_ENDPOINTS.storage, newStorage);
          }
        });
        
        await Promise.all(savePromises);
        
        return { success: true, message: "Storage saved successfully! ✅" };
      } catch (error) {
        console.error("Error saving storage:", error);
        return { 
          success: false, 
          message: `⚠️ Error: ${error.response?.data?.message || error.message}` 
        };
      }
    },
    // Pre-save validation
    beforeSave: (data) => {
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

  return (
    <div className="storage-table-container">
      <GenericTable
        ref={tableRef}
        apiUrl={API_ENDPOINTS.storage}
        saveUrl={API_ENDPOINTS.storage}
        deleteUrl={API_ENDPOINTS.storage}
        newRowTemplate={NEW_STORAGE_TEMPLATE}
        fixedColumnsLeft={2}
        columnSorting={true}
        filters={true}
        storageKey="storageTableColumnWidths"
        {...tableConfig}
      />
    </div>
  );
};

export default StorageTable;