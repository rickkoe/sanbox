import React, { useRef, useContext, useCallback } from "react";
import axios from "axios";
import GenericTableFast from "./GenericTable/GenericTableFast";
import { ConfigContext } from "../../context/ConfigContext";

const vendorOptions = [
  'Cisco',
  'Brocade'
];

const FabricTableFast = () => {
  const API_URL = process.env.REACT_APP_API_URL || '';
  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);
  
  // Get customer ID
  const customerId = config?.customer?.id;

  // Template for new rows
  const NEW_FABRIC_TEMPLATE = {
    id: null,
    name: "",
    san_vendor: "",
    zoneset_name: "",
    vsan: "",
    exists: false,
    notes: "",
    saved: false
  };

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((fabric) => ({
      ...fabric,
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    
    // Handle boolean fields
    if (payload.exists === 'unknown' || payload.exists === undefined || payload.exists === null || payload.exists === '') {
      payload.exists = false;
    } else if (typeof payload.exists === 'string') {
      payload.exists = payload.exists.toLowerCase() === 'true';
    }

    return {
      ...payload,
      customer: customerId,
    };
  }, [customerId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((fabric) => fabric.id || (fabric.name && fabric.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(`${API_URL}/api/san/fabrics/save/`, {
        customer_id: customerId,
        fabrics: payload,
      });

      return { success: true, message: "Fabrics saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving fabrics:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for fabrics without name
    const invalidFabric = data.find(
      (fabric) => (!fabric.name || fabric.name.trim() === "")
    );

    if (invalidFabric) {
      return "Each fabric must have a name";
    }

    // Check for duplicate names
    const names = data.map(fabric => fabric.name?.trim()).filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      return `Duplicate fabric names found: ${duplicates.join(', ')}`;
    }

    return true;
  }, []);

  // Create dropdown sources
  const dropdownSources = {
    san_vendor: vendorOptions,
    exists: ["true", "false"]
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
        apiUrl={`${API_URL}/api/san/fabrics/?customer_id=${customerId}`}
        saveUrl={`${API_URL}/api/san/fabrics/save/`}
        deleteUrl={`${API_URL}/api/san/fabrics/delete/`}
        tableName="fabrics"
        newRowTemplate={NEW_FABRIC_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_Fabric_Table.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default FabricTableFast;