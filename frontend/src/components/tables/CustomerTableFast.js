import React, { useRef, useCallback } from "react";
import GenericTableFast from "./GenericTable/GenericTableFast";
import axios from "axios";

const CustomerTableFast = () => {
  const API_URL = process.env.REACT_APP_API_URL || '';
  const tableRef = useRef(null);

  // Template for new rows
  const NEW_CUSTOMER_TEMPLATE = {
    id: null,
    name: "",
    insights_tenant: "",
    insights_api_key: "",
    notes: "",
    saved: false
  };

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((customer) => ({
      ...customer,
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    return payload;
  }, []);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((customer) => customer.id || (customer.name && customer.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(`${API_URL}/api/customers/save/`, {
        customers: payload,
      });

      return { success: true, message: "Customers saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving customers:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for customers without name
    const invalidCustomer = data.find(
      (customer) => (!customer.name || customer.name.trim() === "")
    );

    if (invalidCustomer) {
      return "Each customer must have a name";
    }

    // Check for duplicate names
    const names = data.map(customer => customer.name?.trim()).filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      return `Duplicate customer names found: ${duplicates.join(', ')}`;
    }

    return true;
  }, []);

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_URL}/api/customers/`}
        saveUrl={`${API_URL}/api/customers/save/`}
        deleteUrl={`${API_URL}/api/customers/delete/`}
        tableName="customers"
        newRowTemplate={NEW_CUSTOMER_TEMPLATE}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() => "Customer_Table.csv"}
        height="600px"
      />
    </div>
  );
};

export default CustomerTableFast;