import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import GenericTableFast from "./GenericTable/GenericTableFast";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  aliases: `${API_URL}/api/san/aliases/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  hosts: `${API_URL}/api/san/hosts/project/`,
  storages: `${API_URL}/api/storage/`,
  aliasSave: `${API_URL}/api/san/aliases/save/`,
  aliasDelete: `${API_URL}/api/san/aliases/delete/`
};

// Template for new rows
const NEW_ALIAS_TEMPLATE = {
  id: null,
  name: "",
  wwpn: "",
  use: "",
  fabric: "",
  fabric_details: { name: "" },
  host: "",
  host_details: { name: "" },
  storage: "",
  storage_details: { name: "" },
  cisco_alias: false,
  create: false,
  delete: false,
  include_in_zoning: true,
  logged_in: false,
  zoned_count: 0,
  imported: null,
  updated: null,
  notes: "",
  saved: false
};

const AliasTableFast = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const tableRef = useRef(null);
  
  // State for dropdown sources
  const [fabricOptions, setFabricOptions] = useState([]);
  const [hostOptions, setHostOptions] = useState([]);
  const [storageOptions, setStorageOptions] = useState([]);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load dropdown options
  useEffect(() => {
    const loadData = async () => {
      if (!activeCustomerId || !activeProjectId) return;

      try {
        // Load fabrics
        const fabricsResponse = await axios.get(
          `${API_ENDPOINTS.fabrics}?customer_id=${activeCustomerId}&page_size=10000`
        );
        const fabricsArray = fabricsResponse.data.results || fabricsResponse.data;
        setFabricOptions(fabricsArray.map((f) => f.name));

        // Load hosts
        const hostsResponse = await axios.get(
          `${API_ENDPOINTS.hosts}${activeProjectId}/?page_size=10000`
        );
        const hostsArray = hostsResponse.data.results || hostsResponse.data;
        setHostOptions(hostsArray.map((h) => h.name));

        // Load storage systems
        const storageResponse = await axios.get(
          `${API_ENDPOINTS.storages}?customer_id=${activeCustomerId}&page_size=10000`
        );
        const storageArray = storageResponse.data.results || storageResponse.data;
        setStorageOptions(storageArray.map((s) => s.name));
      } catch (error) {
        console.error("Error loading dropdown data:", error);
      }
    };

    loadData();
  }, [activeCustomerId, activeProjectId]);

  // Process data for display
  const preprocessData = useCallback((data) => {
    return data.map((alias) => ({
      ...alias,
      fabric: alias.fabric_details?.name || alias.fabric || "",
      host: alias.host_details?.name || alias.host || "",
      storage: alias.storage_details?.name || alias.storage || "",
      saved: true,
    }));
  }, []);

  // Build payload for saving
  const buildPayload = useCallback((row) => {
    // Find IDs from the dropdown data
    const fabricId = fabricOptions.find((f) => f.name === row.fabric)?.id;
    const hostId = hostOptions.find((h) => h.name === row.host)?.id;
    const storageId = storageOptions.find((s) => s.name === row.storage)?.id;

    const payload = { ...row };
    delete payload.saved;
    
    // Handle boolean fields
    const booleanFields = ['cisco_alias', 'create', 'delete', 'include_in_zoning', 'logged_in'];
    booleanFields.forEach(field => {
      if (payload[field] === 'unknown' || payload[field] === undefined || payload[field] === null || payload[field] === '') {
        payload[field] = false;
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].toLowerCase() === 'true';
      }
    });

    return {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId,
      host: hostId,
      storage: storageId,
    };
  }, [fabricOptions, hostOptions, storageOptions, activeProjectId]);

  // Save handler
  const handleSave = async (unsavedData) => {
    try {
      const payload = unsavedData
        .filter((alias) => alias.id || (alias.name && alias.name.trim() !== ""))
        .map(buildPayload);

      await axios.post(API_ENDPOINTS.aliasSave, {
        project_id: activeProjectId,
        aliases: payload,
      });

      return { success: true, message: "Aliases saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving aliases:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.message || error.message}`,
      };
    }
  };

  // Pre-save validation
  const beforeSaveValidation = useCallback((data) => {
    // Check for aliases without name
    const invalidAlias = data.find(
      (alias) => (!alias.name || alias.name.trim() === "")
    );

    if (invalidAlias) {
      return "Each alias must have a name";
    }

    // Check for duplicate names
    const names = data.map(alias => alias.name?.trim()).filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      return `Duplicate alias names found: ${duplicates.join(', ')}`;
    }

    return true;
  }, []);

  // Create dropdown sources
  const dropdownSources = useMemo(() => ({
    fabric: fabricOptions,
    host: hostOptions,
    storage: storageOptions,
    use: ["host", "storage", "target", "initiator", "other"],
    cisco_alias: ["true", "false"],
    create: ["true", "false"],
    delete: ["true", "false"],
    include_in_zoning: ["true", "false"],
    logged_in: ["true", "false"]
  }), [fabricOptions, hostOptions, storageOptions]);

  if (!activeProjectId) {
    return (
      <div className="alert alert-warning">No active project selected.</div>
    );
  }

  return (
    <div className="table-container">
      <GenericTableFast
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.aliases}${activeProjectId}/`}
        saveUrl={API_ENDPOINTS.aliasSave}
        deleteUrl={API_ENDPOINTS.aliasDelete}
        tableName="aliases"
        newRowTemplate={NEW_ALIAS_TEMPLATE}
        dropdownSources={dropdownSources}
        preprocessData={preprocessData}
        onBuildPayload={buildPayload}
        onSave={handleSave}
        beforeSave={beforeSaveValidation}
        getExportFilename={() =>
          `${config?.customer?.name}_${config?.active_project?.name}_Alias_Table.csv`
        }
        height="600px"
      />
    </div>
  );
};

export default AliasTableFast;