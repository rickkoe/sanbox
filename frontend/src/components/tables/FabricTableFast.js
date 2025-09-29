import React, { useRef, useContext, useCallback } from "react";
import axios from "axios";
import GenericTableFast from "./GenericTable/GenericTableFast";
import { ConfigContext } from "../../context/ConfigContext";

const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
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

  // Process data for display - convert vendor codes to names for display
  const preprocessData = useCallback((data) => {
    return data.map((fabric) => ({
      ...fabric,
      san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor,
      saved: true,
    }));
  }, []);

  // Build payload for saving - convert names back to codes and handle fields properly
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    
    // Convert vendor name back to code for backend
    payload.san_vendor = vendorOptions.find(v => v.name === payload.san_vendor || v.code === payload.san_vendor)?.code || payload.san_vendor;
    
    // Handle vsan field - empty string becomes null
    payload.vsan = payload.vsan === "" || payload.vsan === undefined ? null : payload.vsan;
    
    // Handle boolean fields - keep as boolean for this model (not strings like aliases)
    const booleanFields = ['exists'];
    booleanFields.forEach(field => {
      if (payload[field] === undefined || payload[field] === null) {
        payload[field] = false;
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].toLowerCase() === 'true';
      }
      // If already boolean, leave as-is
    });

    console.log('🔍 Fabric buildPayload result:', payload);

    return {
      ...payload,
      customer: customerId,
    };
  }, [customerId]);

  // Save handler - simplified to work with GenericTableFast
  const handleSave = async (unsavedData) => {
    console.log('🔍 FabricTableFast handleSave called with:', unsavedData);
    
    try {
      const errors = [];
      const successes = [];
      
      for (const fabric of unsavedData) {
        try {
          const payload = buildPayload(fabric);
          console.log(`🔍 Saving fabric ${fabric.name}:`, payload);
          
          if (fabric.id) {
            // Update existing fabric
            console.log(`🔄 Updating fabric ${fabric.id}`);
            const response = await axios.put(`${API_URL}/api/san/fabrics/${fabric.id}/`, payload);
            successes.push(`Updated ${fabric.name} successfully`);
          } else {
            // Create new fabric
            delete payload.id;
            console.log(`🆕 Creating new fabric:`, payload);
            const response = await axios.post(`${API_URL}/api/san/fabrics/`, payload);
            successes.push(`Created ${fabric.name} successfully`);
          }
        } catch (error) {
          console.error('❌ Error saving fabric:', error.response?.data);
          errors.push(`${fabric.name}: ${error.response?.data?.message || error.message}`);
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          message: `Errors: ${errors.join(', ')}`
        };
      }
      
      return { success: true, message: `Fabrics saved successfully! ${successes.join(', ')}` };
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

  // Delete handler
  const handleDelete = useCallback(async (fabricId) => {
    try {
      await axios.delete(`${API_URL}/api/san/fabrics/${fabricId}/`);
      return { success: true, message: 'Fabric deleted successfully!' };
    } catch (error) {
      console.error('Error deleting fabric:', error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  }, [API_URL]);

  // Define columns to match Fabric model
  const columns = [
    { data: "name", title: "Name", width: 150 },
    { data: "san_vendor", title: "Vendor", width: 100 },
    { data: "zoneset_name", title: "Zoneset Name", width: 200 },
    { data: "vsan", title: "VSAN", width: 80 },
    { data: "exists", title: "Exists", width: 80 },
    { data: "notes", title: "Notes", width: 200 }
  ];

  // Create dropdown sources - use vendor names for display
  // Note: 'exists' field will automatically be handled as checkbox since it's boolean
  const dropdownSources = {
    san_vendor: vendorOptions.map(v => v.name)
  };

  if (!customerId) {
    return (
      <div className="alert alert-warning">No customer selected.</div>
    );
  }

  return (
    <div className="table-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_URL}/api/san/fabrics/?customer_id=${customerId}`}
        tableName="fabrics"
        columns={columns}
        newRowTemplate={NEW_FABRIC_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        onDelete={handleDelete}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_Fabric_Table.csv`
        }
      />
    </div>
  );
};

export default FabricTableFast;