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
  host: "",
  storage: "",
  cisco_alias: "",
  create: false,
  delete: false,
  include_in_zoning: false,
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
        setFabricOptions(fabricsArray); // Keep full objects

        // Load hosts
        const hostsResponse = await axios.get(
          `${API_ENDPOINTS.hosts}${activeProjectId}/?page_size=10000`
        );
        const hostsArray = hostsResponse.data.results || hostsResponse.data;
        setHostOptions(hostsArray); // Keep full objects

        // Load storage systems
        const storageResponse = await axios.get(
          `${API_ENDPOINTS.storages}?customer_id=${activeCustomerId}&page_size=10000`
        );
        const storageArray = storageResponse.data.results || storageResponse.data;
        setStorageOptions(storageArray); // Keep full objects
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
    
    // Clean up internal fields
    delete payload.saved;
    delete payload.fabric_details;
    delete payload.host_details; 
    delete payload.storage_details;
    delete payload.zoned_count;
    delete payload._id;
    delete payload._isNew;
    
    // Handle required fields - ensure we don't send null/undefined values
    payload.name = payload.name || "";
    payload.wwpn = payload.wwpn || "";
    payload.use = payload.use || "";
    payload.notes = payload.notes || "";
    
    // Handle boolean fields - convert "unknown" values to default False
    const booleanFields = ['create', 'delete', 'include_in_zoning', 'logged_in'];
    booleanFields.forEach(field => {
      if (payload[field] === 'unknown' || payload[field] === undefined || payload[field] === null || payload[field] === '') {
        payload[field] = false;
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].toLowerCase() === 'true';
      }
    });
    
    // Handle cisco_alias - it's a choice field, not boolean
    if (payload.cisco_alias === undefined || payload.cisco_alias === null) {
      payload.cisco_alias = "";
    }

    // Only include fabric/host/storage if they have valid values
    const result = {
      ...payload,
      projects: [activeProjectId],
      fabric: fabricId || null,
      host: hostId || null,
      storage: storageId || null,
    };
    
    // Remove null foreign key references to avoid validation errors
    if (!result.fabric) delete result.fabric;
    if (!result.host) delete result.host;  
    if (!result.storage) delete result.storage;
    
    return result;
  }, [fabricOptions, hostOptions, storageOptions, activeProjectId]);

  // Save handler
  const handleSave = async (processedData) => {
    try {
      // Filter out truly empty rows - must have name at minimum
      const payload = processedData.filter((alias) => {
        // Keep existing aliases with IDs
        if (alias.id) return true;
        
        // For new aliases, require at least a name
        return alias.name && alias.name.trim() !== "";
      });


      await axios.post(API_ENDPOINTS.aliasSave, {
        project_id: activeProjectId,
        aliases: payload,
      });

      return { success: true, message: "Aliases saved successfully! ✅" };
    } catch (error) {
      console.error("Error saving aliases:", error);
      return {
        success: false,
        message: `Error: ${error.response?.data?.error || error.response?.data?.message || error.message}`,
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
    fabric: fabricOptions.map(f => f.name),
    host: hostOptions.map(h => h.name),
    storage: storageOptions.map(s => s.name),
    use: ["init", "target", "both"],
    cisco_alias: ["device-alias", "fcalias", "wwpn"],
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