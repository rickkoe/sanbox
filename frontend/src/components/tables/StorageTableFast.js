import React, { useRef, useContext, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTableFast from "./GenericTable/GenericTableFast";
import { useNavigate } from "react-router-dom";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  storage: `${API_URL}/api/storage/`,
};

const StorageTableFast = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const tableRef = useRef(null);
  
  const customerId = config?.customer?.id;

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

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((storage) => ({
      ...storage,
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    
    return {
      ...payload,
      customer: customerId,
    };
  }, [customerId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((storage) => storage.id || (storage.name && storage.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(`${API_ENDPOINTS.storage}save/`, {
        customer_id: customerId,
        storage_systems: payload,
      });

      return { success: true, message: "Storage systems saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving storage systems:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for storage systems without name
    const invalidStorage = data.find(
      (storage) => (!storage.name || storage.name.trim() === "")
    );

    if (invalidStorage) {
      return "Each storage system must have a name";
    }

    // Check for duplicate names
    const names = data.map(storage => storage.name?.trim()).filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      return `Duplicate storage system names found: ${duplicates.join(', ')}`;
    }

    return true;
  }, []);

  // Create dropdown sources
  const dropdownSources = {
    storage_type: ["SAN", "NAS", "Object", "Hybrid"],
    machine_type: ["DS8000", "SVC", "FlashSystem", "XIV", "Other"]
  };

  if (!customerId) {
    return (
      <div className="alert alert-warning">No customer selected.</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.storage}?customer_id=${customerId}`}
        saveUrl={`${API_ENDPOINTS.storage}save/`}
        deleteUrl={`${API_ENDPOINTS.storage}delete/`}
        tableName="storage"
        newRowTemplate={NEW_STORAGE_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_Storage_Systems.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default StorageTableFast;