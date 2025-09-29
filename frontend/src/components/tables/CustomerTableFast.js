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

  // Save handler - individual REST API calls
  const handleSave = async (unsavedData) => {
    console.log('🔍 CustomerTableFast handleSave called with:', unsavedData);
    
    try {
      const errors = [];
      const successes = [];
      
      for (const customer of unsavedData) {
        try {
          const payload = buildPayload(customer);
          console.log(`🔍 Saving customer ${customer.name}:`, payload);
          
          if (customer.id) {
            // Update existing customer
            console.log(`🔄 Updating customer ${customer.id}`);
            const response = await axios.put(`${API_URL}/api/customers/${customer.id}/`, payload);
            successes.push(`Updated ${customer.name} successfully`);
          } else {
            // Create new customer
            delete payload.id;
            console.log(`🆕 Creating new customer:`, payload);
            const response = await axios.post(`${API_URL}/api/customers/`, payload);
            successes.push(`Created ${customer.name} successfully`);
          }
        } catch (error) {
          console.error('❌ Error saving customer:', error.response?.data);
          errors.push(`${customer.name}: ${error.response?.data?.message || error.message}`);
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          message: `Errors: ${errors.join(', ')}`
        };
      }
      
      return { success: true, message: `Customers saved successfully! ${successes.join(', ')}` };
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

  // Delete handler
  const handleDelete = useCallback(async (customerId) => {
    try {
      await axios.delete(`${API_URL}/api/customers/${customerId}/`);
      return { success: true, message: 'Customer deleted successfully!' };
    } catch (error) {
      console.error('Error deleting customer:', error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  }, [API_URL]);

  // Define columns to match Customer model
  const columns = [
    { data: "name", title: "Name", width: 200 },
    { data: "insights_tenant", title: "Insights Tenant", width: 200 },
    { data: "insights_api_key", title: "Insights API Key", width: 250 },
    { data: "notes", title: "Notes", width: 300 }
  ];

  return (
    <div className="table-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_URL}/api/customers/`}
        tableName="customers"
        columns={columns}
        newRowTemplate={NEW_CUSTOMER_TEMPLATE}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        onDelete={handleDelete}
        beforeSave={beforeSaveValidation}
        getExportFilename={() => "Customer_Table.csv"}
      />
    </div>
  );
};

export default CustomerTableFast;