import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { Button } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";
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
  saved: false
};

const StorageTable = () => {
  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);
  const [debug, setDebug] = useState(null);
  
  // Get the customer ID from the config context
  const customerId = config?.customer?.id;

  // Table configuration
  const tableConfig = {
    colHeaders: [
      "ID", "Name", "Type", "Location", "Machine Type", "Model", 
      "Serial Number", "System ID", "WWNN", "Firmware", "Primary IP"
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
      { data: "primary_ip" }    ],
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
        saveUrl={API_ENDPOINTS.storage}
        deleteUrl={API_ENDPOINTS.storage}
        newRowTemplate={NEW_STORAGE_TEMPLATE}
        fixedColumnsLeft={2}
        columnSorting={true}
        filters={true}
        storageKey="storageTableColumnWidths"
        {...tableConfig}
      />
      
      {/* Debug information (only visible during development) */}
      {debug && process.env.NODE_ENV === 'development' && (
        <div className="debug-info mt-3 p-3 border rounded bg-light">
          <h5>Debug Information</h5>
          <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default StorageTable;