import React, { useContext, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTableFast from "./GenericTable/GenericTableFast";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  hosts: `${API_URL}/api/san/hosts/project/`,
  hostSave: `${API_URL}/api/san/hosts/save/`,
  hostDelete: `${API_URL}/api/san/hosts/delete/`,
  storage: `${API_URL}/api/storage/`
};

const HostTableFast = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const tableRef = useRef(null);
  
  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Template for new rows
  const NEW_HOST_TEMPLATE = {
    id: null,
    name: "",
    storage_system: "",
    wwpns: "",
    wwpn_status: "",
    status: "",
    host_type: "",
    aliases_count: 0,
    vols_count: 0,
    fc_ports_count: 0,
    associated_resource: "",
    volume_group: "",
    notes: "",
    saved: false
  };

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((host) => ({
      ...host,
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    const payload = { ...row };
    delete payload.saved;
    
    return {
      ...payload,
      projects: [activeProjectId],
    };
  }, [activeProjectId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((host) => host.id || (host.name && host.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(API_ENDPOINTS.hostSave, {
        project_id: activeProjectId,
        hosts: payload,
      });

      return { success: true, message: "Hosts saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving hosts:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for hosts without name
    const invalidHost = data.find(
      (host) => (!host.name || host.name.trim() === "")
    );

    if (invalidHost) {
      return "Each host must have a name";
    }

    return true;
  }, []);

  // Create dropdown sources
  const dropdownSources = {
    host_type: ["Windows", "Linux", "AIX", "Solaris", "VMware", "Other"],
    status: ["active", "inactive", "pending"],
    wwpn_status: ["valid", "invalid", "pending"]
  };

  if (!activeProjectId) {
    return (
      <div className="alert alert-warning">No active project selected.</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.hosts}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.hostSave}
        deleteUrl={API_ENDPOINTS.hostDelete}
        tableName="hosts"
        newRowTemplate={NEW_HOST_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_${config?.active_project?.name}_Host_Table.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default HostTableFast;