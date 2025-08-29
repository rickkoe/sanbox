import React, { useContext, useState, useRef, useEffect, useMemo } from "react";
import axios from "axios";
import { Modal, Button } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";
import GenericTable from "./GenericTable";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || '';

const API_ENDPOINTS = {
  hosts: `${API_URL}/api/san/hosts/project/`,
  hostSave: `${API_URL}/api/san/hosts/save/`,
  hostDelete: `${API_URL}/api/san/hosts/delete/`,
  storage: `${API_URL}/api/storage/`
};

// All possible host columns for project hosts (simpler than storage hosts)
const ALL_COLUMNS = [
  { data: "name", title: "Host Name" },
  { data: "storage_system", title: "Storage System" },
  { data: "wwpns", title: "WWPNs" },
  { data: "status", title: "Status" },
  { data: "host_type", title: "Host Type" },
  { data: "aliases_count", title: "Aliases Count" },
  { data: "vols_count", title: "Volumes Count" },
  { data: "fc_ports_count", title: "FC Ports Count" },
  { data: "associated_resource", title: "Associated Resource" },
  { data: "volume_group", title: "Volume Group" },
  { data: "acknowledged", title: "Acknowledged" },
  { data: "last_data_collection", title: "Last Data Collection" },
  { data: "natural_key", title: "Natural Key" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" }
];

// Default visible columns - showing most relevant host information
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14]; // name, storage_system, wwpns, status, host_type, aliases_count, vols_count, fc_ports_count, imported, updated

// Template for new rows
const NEW_HOST_TEMPLATE = {
  id: null,
  name: "",
  storage_system: "",
  wwpns: "",
  status: "",
  host_type: "",
  aliases_count: 0,
  vols_count: 0,
  fc_ports_count: 0,
  associated_resource: "",
  volume_group: "",
  acknowledged: "",
  last_data_collection: null,
  natural_key: "",
  imported: null,
  updated: null,
  saved: false,
  _isNew: true
};

const AllHostsTable = () => {
  const { config } = useContext(ConfigContext);
  const tableRef = useRef(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);

  // Storage systems state
  const [storageOptions, setStorageOptions] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Column visibility state
  const [visibleColumnIndices, setVisibleColumnIndices] = useState(() => {
    const saved = localStorage.getItem("allHostsTableColumns");
    if (saved) {
      try {
        const savedColumnNames = JSON.parse(saved);
        // Convert saved column names to indices
        const indices = savedColumnNames
          .map(name => ALL_COLUMNS.findIndex(col => col.data === name))
          .filter(index => index !== -1);
        return indices.length > 0 ? indices : DEFAULT_VISIBLE_INDICES;
      } catch (e) {
        return DEFAULT_VISIBLE_INDICES;
      }
    }
    return DEFAULT_VISIBLE_INDICES;
  });

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Dynamic dropdown sources using the same pattern as AliasTable
  const dropdownSources = useMemo(() => ({
    storage_system: storageOptions.map(s => s.name),
  }), [storageOptions]);

  // Load storage options for the customer
  useEffect(() => {
    const loadStorageOptions = async () => {
      console.log('🔥 useEffect triggered - Config:', config);
      console.log('🔥 Customer ID:', activeCustomerId);
      
      if (!config) {
        console.log('❌ Config is null, waiting for config to load');
        return;
      }
      
      // Try both config.customer.id and config.id for customer ID
      const customerId = activeCustomerId || config?.id;
      
      if (!customerId) {
        console.log('❌ No customer ID found in config, setting loaded anyway');
        console.log('❌ Config customer object:', config?.customer);
        console.log('❌ Config id:', config?.id);
        setStorageLoaded(true);
        return;
      }
      
      try {
        const url = `${API_ENDPOINTS.storage}?customer=${customerId}`;
        console.log('🔥 Loading storage options from URL:', url);
        console.log('🔥 Using customer ID:', customerId);
        const response = await axios.get(url);
        
        console.log('🔥 Storage API Response:', response.data);
        
        if (response.data?.results) {
          const options = response.data.results.map(storage => ({
            id: storage.id,
            name: storage.name,
            display: storage.name
          }));
          
          console.log('✅ Mapped storage options:', options);
          setStorageOptions(options);
        } else {
          console.log('❌ No results in storage response');
        }
      } catch (error) {
        console.error('❌ Error loading storage options:', error);
        console.error('❌ Error details:', error.response?.data);
      } finally {
        setStorageLoaded(true);
      }
    };

    loadStorageOptions();
  }, [config, activeCustomerId]);

  // Wait for config to load before showing any content
  if (!config) {
    return (
      <div className="table-container">
        <div className="alert alert-info">Loading configuration...</div>
      </div>
    );
  }

  if (!activeProjectId) {
    return <div className="alert alert-warning">No active project selected.</div>;
  }

  // Custom renderers
  const customRenderers = {
    name: (instance, td, row, col, prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      
      // Make bold if row is saved and has an ID (not a new row)
      if (rowData?.saved && rowData?.id) {
        td.innerHTML = `<strong>${value || ""}</strong>`;
      } else {
        td.innerHTML = value || "";
      }
      return td;
    },
    wwpns: (instance, td, row, col, prop, value) => {
      // Display comma-separated WWPNs from aliases
      if (value) {
        td.innerText = value; // Already formatted as comma-separated from backend
        td.style.fontFamily = "monospace";
        td.style.fontSize = "12px"; // Smaller font for better readability with multiple WWPNs
        
        // Add tooltip showing count if multiple WWPNs
        const wwpnList = value.split(',').map(w => w.trim()).filter(w => w.length > 0);
        if (wwpnList.length > 1) {
          td.title = `${wwpnList.length} WWPNs from aliases referencing this host`;
        } else if (wwpnList.length === 1) {
          td.title = `1 WWPN from alias referencing this host`;
        }
      } else {
        td.innerText = "";
        td.title = "No aliases reference this host";
      }
      return td;
    },
    last_data_collection: (instance, td, row, col, prop, value) => {
      if (value) {
        // Convert timestamp to readable date
        const date = new Date(parseInt(value) * 1000);
        td.innerText = date.toLocaleString();
      } else {
        td.innerText = "";
      }
      return td;
    },
    aliases_count: (instance, td, row, col, prop, value) => {
      const count = value || 0;
      td.innerText = count;
      td.style.textAlign = "center";
      td.style.fontWeight = "600";
      
      if (count === 0) {
        td.style.color = "#6b7280";
        td.style.backgroundColor = "#f9fafb";
      } else {
        td.style.color = "#059669";
        td.style.backgroundColor = "#ecfdf5";
      }
      
      td.title = count === 0 ? "Not used by any aliases" : 
                 count === 1 ? "Used by 1 alias" : 
                 `Used by ${count} aliases`;
      
      return td;
    },
    vols_count: (instance, td, row, col, prop, value) => {
      const count = value || 0;
      td.innerText = count;
      td.style.textAlign = "center";
      td.style.fontWeight = "600";
      
      if (count === 0) {
        td.style.color = "#6b7280";
        td.style.backgroundColor = "#f9fafb";
      } else if (count < 10) {
        td.style.color = "#059669";
        td.style.backgroundColor = "#ecfdf5";
      } else {
        td.style.color = "#dc2626";
        td.style.backgroundColor = "#fef2f2";
      }
      
      td.title = count === 0 ? "No volumes" : 
                 count === 1 ? "1 volume" : 
                 `${count} volumes`;
      
      return td;
    },
    fc_ports_count: (instance, td, row, col, prop, value) => {
      const count = value || 0;
      td.innerText = count;
      td.style.textAlign = "center";
      td.style.fontWeight = "600";
      
      if (count === 0) {
        td.style.color = "#6b7280";
        td.style.backgroundColor = "#f9fafb";
      } else {
        td.style.color = "#059669";
        td.style.backgroundColor = "#ecfdf5";
      }
      
      td.title = count === 0 ? "No FC ports" : 
                 count === 1 ? "1 FC port" : 
                 `${count} FC ports`;
      
      return td;
    },
    imported: (instance, td, row, col, prop, value) => {
      td.innerText = value ? new Date(value).toLocaleString() : "";
      return td;
    },
    updated: (instance, td, row, col, prop, value) => {
      td.innerText = value ? new Date(value).toLocaleString() : "";
      return td;
    }
  };

  // Process data for display
  const preprocessData = (data) => {
    if (!data || !Array.isArray(data)) {
      console.log('❌ preprocessData called with invalid data:', data);
      return [];
    }
    
    console.log('✅ preprocessData processing', data.length, 'hosts');
    
    return data.map((host) => {
      // The backend now returns storage_system as the name, which is what we want for display
      // No conversion needed since backend returns the proper display name
      
      return {
        ...host,
        saved: true
      };
    });
  };

  // Custom save handler
  const handleSave = async (unsavedData) => {
    console.log('🔥 AllHostsTable handleSave called with:', unsavedData);
    
    try {
      // Filter out hosts without names
      const payload = unsavedData
        .filter(host => {
          const shouldInclude = host.id || (host.name && host.name.trim() !== "");
          console.log(`🔍 Filtering host:`, host, `Should include: ${shouldInclude}`);
          return shouldInclude;
        })
        .map(host => {
          // Map storage system name back to ID for saving to the storage ForeignKey field
          let storageId = null;
          
          if (host.storage_system && storageOptions.length > 0) {
            const storageOption = storageOptions.find(opt => opt.name === host.storage_system);
            if (storageOption) {
              storageId = storageOption.id;
              console.log('🔥 Mapped storage system name to ID:', host.storage_system, '->', storageId);
            } else {
              console.log('❌ Could not find storage option for:', host.storage_system);
              console.log('❌ Available options:', storageOptions.map(opt => opt.name));
            }
          }
          
          // Clean up the data
          return {
            id: host.id || null,
            name: (host.name || "").trim(),
            storage: storageId, // Use the storage ForeignKey field
            wwpns: host.wwpns || "",
            status: host.status || "",
            host_type: host.host_type || "",
            associated_resource: host.associated_resource || "",
            volume_group: host.volume_group || "",
            acknowledged: host.acknowledged || "",
            natural_key: host.natural_key || ""
          };
        });

      console.log('🚀 Final payload being sent:', payload);

      const response = await axios.post(API_ENDPOINTS.hostSave, {
        project_id: activeProjectId,
        hosts: payload,
      });

      return { success: true, message: "Hosts saved successfully! ✅" };
    } catch (error) {
      console.error("❌ Error saving hosts:", error);
      
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e) => {
          return `Can't save host "${e.host}": ${e.error}`;
        });
        return { success: false, message: `⚠️ ${errorMessages.join(" | ")}` };
      }

      return {
        success: false,
        message: `⚠️ Error: ${error.response?.data?.error || error.message}`,
      };
    }
  };

  // Custom delete handler
  const handleDelete = async (id) => {
    console.log('🔥 AllHostsTable handleDelete called with id:', id);
    console.log('🔍 Delete URL:', `${API_ENDPOINTS.hostDelete}${id}/`);
    
    try {
      const response = await axios.delete(`${API_ENDPOINTS.hostDelete}${id}/`);
      console.log('✅ Delete response:', response.data);
      
      return { success: true, message: response.data.message || "Host deleted successfully! ✅" };
    } catch (error) {
      console.error("❌ Error deleting host:", error);
      console.log('❌ Error response data:', error.response?.data);
      console.log('❌ Error status:', error.response?.status);
      
      // Check for confirmation required (409 Conflict)
      if (error.response?.status === 409 && error.response?.data?.requires_confirmation) {
        const data = error.response.data;
        console.log('⚠️ Confirmation required for host deletion:', data);
        
        // Show confirmation modal
        setConfirmationData({
          hostId: id,
          hostName: data.host_name,
          aliases: data.aliases,
          message: data.message
        });
        setShowConfirmModal(true);
        
        // Return success to prevent GenericTable from showing an error
        return { success: true, message: "Confirmation required..." };
      }
      
      const errorMessage = error.response?.data?.error || error.message;
      console.log('❌ Delete error message:', errorMessage);
      
      return {
        success: false,
        message: `⚠️ Error (${error.response?.status || 'Unknown'}): ${errorMessage}`,
      };
    }
  };

  // Handle confirmed deletion with force
  const handleConfirmedDelete = async () => {
    if (!confirmationData) return;
    
    console.log('🔥 Confirmed delete with force for host:', confirmationData.hostId);
    
    try {
      const response = await axios.delete(`${API_ENDPOINTS.hostDelete}${confirmationData.hostId}/?force=true`);
      console.log('✅ Forced delete response:', response.data);
      
      setShowConfirmModal(false);
      setConfirmationData(null);
      
      // Refresh the table
      if (tableRef.current?.refreshData) {
        tableRef.current.refreshData();
      }
      
      // Show success message
      alert(response.data.message || "Host deleted successfully!");
      
    } catch (error) {
      console.error("❌ Error in confirmed delete:", error);
      setShowConfirmModal(false);
      setConfirmationData(null);
      
      const errorMessage = error.response?.data?.error || error.message;
      alert(`Error deleting host: ${errorMessage}`);
    }
  };

  // Only render the table after storage options are loaded
  if (!storageLoaded) {
    return (
      <div className="table-container">
        <div className="alert alert-info">Loading storage systems...</div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <GenericTable
        key={`all-hosts-table-${storageOptions.length}`} // Force re-render when storage options change
        ref={tableRef}
        apiUrl={`${API_ENDPOINTS.hosts}${activeProjectId}/?format=table`}
        saveUrl={API_ENDPOINTS.hostSave}
        // deleteUrl={`${API_URL}/api/san/hosts/delete/`}  // Remove to force custom handler
        newRowTemplate={NEW_HOST_TEMPLATE}
        tableName="allHosts"
        serverPagination={true}
        defaultPageSize={50}
        storageKey={`all-hosts-table-${activeProjectId}`}
        colHeaders={ALL_COLUMNS.map(col => col.title)}
        columns={ALL_COLUMNS.map(col => {
          const column = { data: col.data };
          
          // Add specific column configurations
          if (col.data === "aliases_count" || col.data === "vols_count" || col.data === "fc_ports_count" || 
              col.data === "last_data_collection" || col.data === "imported" || 
              col.data === "updated" || col.data === "natural_key") {
            column.readOnly = true;
          }
          
          // Configure storage_system as dropdown (using dropdownSources)
          if (col.data === "storage_system") {
            console.log('🔥 Configuring storage_system as dropdown column');
            console.log('🔥 Current dropdownSources:', dropdownSources);
            column.type = "dropdown";
            column.allowInvalid = false;
            column.strict = true;
          }
          
          return column;
        })}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onSave={handleSave}
        onDelete={handleDelete}
        columnSorting={true}
        filters={true}
        defaultVisibleColumns={visibleColumnIndices}
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_All_Hosts.csv`}
      />

      {/* Confirmation Modal for Host Deletion */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Confirm Host Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmationData && (
            <div>
              <div className="alert alert-warning">
                <h5>⚠️ Host References Will Be Removed</h5>
                <p>{confirmationData.message}</p>
              </div>
              
              <h6>Affected Aliases:</h6>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <ul className="list-group">
                  {confirmationData.aliases.map((alias) => (
                    <li key={alias.id} className="list-group-item">
                      <strong>{alias.name}</strong>
                      <small className="text-muted"> (ID: {alias.id})</small>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mt-3">
                <p><strong>What will happen:</strong></p>
                <ul>
                  <li>Host <strong>"{confirmationData.hostName}"</strong> will be deleted</li>
                  <li>Host references will be <strong>removed</strong> from {confirmationData.aliases.length} aliases</li>
                  <li>The aliases themselves will <strong>remain</strong> in the system</li>
                </ul>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmedDelete}>
            Delete Host & Remove References
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AllHostsTable;