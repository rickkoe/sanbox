import React, { useContext, useRef, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTableFast from "./GenericTable/GenericTableFast";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const VolumeTableFast = () => {
  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);
  
  const activeCustomerId = config?.customer?.id;

  // Template for new rows
  const NEW_VOLUME_TEMPLATE = {
    id: null,
    name: "",
    storage_system: "",
    capacity_gb: 0,
    volume_type: "",
    status: "",
    pool: "",
    host: "",
    notes: "",
    saved: false
  };

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((volume) => ({
      ...volume,
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    
    return {
      ...payload,
      customer: activeCustomerId,
    };
  }, [activeCustomerId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((volume) => volume.id || (volume.name && volume.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(`${API_URL}/api/storage/volumes/save/`, {
        customer_id: activeCustomerId,
        volumes: payload,
      });

      return { success: true, message: "Volumes saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving volumes:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for volumes without name
    const invalidVolume = data.find(
      (volume) => (!volume.name || volume.name.trim() === "")
    );

    if (invalidVolume) {
      return "Each volume must have a name";
    }

    return true;
  }, []);

  // Create dropdown sources
  const dropdownSources = {
    volume_type: ["Standard", "Thin", "Thick", "Snapshot", "Clone"],
    status: ["online", "offline", "pending", "error"]
  };

  if (!activeCustomerId) {
    return (
      <div className="alert alert-warning">No customer selected.</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_URL}/api/storage/volumes/?customer_id=${activeCustomerId}`}
        saveUrl={`${API_URL}/api/storage/volumes/save/`}
        deleteUrl={`${API_URL}/api/storage/volumes/delete/`}
        tableName="volumes"
        newRowTemplate={NEW_VOLUME_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_Volume_Table.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default VolumeTableFast;