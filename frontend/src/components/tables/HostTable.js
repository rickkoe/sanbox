import React, { useContext, useState, useRef, useEffect, useMemo } from "react";
import axios from "axios";
import { Modal, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
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
  { data: "create", title: "Create" },
  { data: "imported", title: "Imported" },
  { data: "updated", title: "Updated" }
];

// Default visible columns - showing most relevant host information
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15]; // name, storage_system, wwpns, status, host_type, aliases_count, vols_count, fc_ports_count, create, imported, updated

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
  create: false,
  imported: null,
  updated: null,
  saved: false,
  _isNew: true
};

const HostTable = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const tableRef = useRef(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  
  // Host type modal state
  const [showHostTypeModal, setShowHostTypeModal] = useState(false);
  const [hostTypeModalData, setHostTypeModalData] = useState(null);
  const [customHostTypes, setCustomHostTypes] = useState({});

  // Storage systems state
  const [storageOptions, setStorageOptions] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  
  // Host type options based on storage type
  const getHostTypeOptions = (storageType) => {
    if (storageType === 'FlashSystem') {
      return ['hpux', 'tpgs', 'generic', 'openvms', 'adminlun', 'hide_secondary'];
    } else if (storageType === 'DS8000') {
      return ['AIX', 'AIX with PowerSwap', 'HP OpenVMS', 'HP-UX', 'IBM i AS/400', 'iLinux', 'Linux RHEL', 'Linux SUSE', 'N series Gateway', 'Novell', 'pLinux', 'SAN Volume Controller', 'Solaris', 'VMware', 'Windows 2003', 'Windows 2008', 'Windows 2012', 'zLinux'];
    }
    return [];
  };
  
  // Get default host type based on storage type
  const getDefaultHostType = (storageType) => {
    if (storageType === 'FlashSystem') {
      return 'generic';
    } else if (storageType === 'DS8000') {
      return 'IBM i AS/400';
    }
    return '';
  };

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
  
  // Cells configuration for dynamic dropdown sources
  const getCellsConfig = useMemo(() => {
    return (hot, row, col, prop) => {
      if (prop === 'host_type') {
        // Get the current row's data to determine storage system
        const rowData = hot.getSourceDataAtRow(row);
        const storageSystemValue = rowData?.storage_system;
        
        // Find the storage type based on the storage system name
        const storageOption = storageOptions.find(opt => opt.name === storageSystemValue);
        const storageType = storageOption?.storage_type;
        
        // Return column configuration with dynamic source
        return {
          source: getHostTypeOptions(storageType)
        };
      }
      return {};
    };
  }, [storageOptions]);

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
            display: storage.name,
            storage_type: storage.storage_type
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
        saved: true,
        create: host.create || false // Ensure create field has a boolean value
      };
    });
  };

  // Custom save handler
  const handleSave = async (unsavedData) => {
    console.log('🔥 HostTable handleSave called with:', unsavedData);
    
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
          const cleanHost = {
            id: host.id || null,
            name: (host.name || "").trim(),
            storage: storageId, // Use the storage ForeignKey field
            wwpns: host.wwpns || "",
            status: host.status || "",
            host_type: host.host_type || "",
            associated_resource: host.associated_resource || "",
            volume_group: host.volume_group || "",
            acknowledged: host.acknowledged || "",
            natural_key: host.natural_key || "",
            create: Boolean(host.create) // Include the create field
          };
          return cleanHost;
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
    console.log('🔥 HostTable handleDelete called with id:', id);
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
      
      // Success - no popup needed, table refresh shows the change
      
    } catch (error) {
      console.error("❌ Error in confirmed delete:", error);
      setShowConfirmModal(false);
      setConfirmationData(null);
      
      const errorMessage = error.response?.data?.error || error.message;
      alert(`Error deleting host: ${errorMessage}`);
    }
  };

  // Handle setting host types
  const handleSetHostTypes = () => {
    if (!tableRef.current?.hotInstance) {
      console.error('❌ No table instance available');
      return;
    }

    const hot = tableRef.current.hotInstance;
    const sourceData = hot.getSourceData();

    // Find the host_type column index
    const hostTypeColIndex = ALL_COLUMNS.findIndex(col => col.data === 'host_type');
    if (hostTypeColIndex === -1) {
      console.error('❌ host_type column not found');
      return;
    }

    // Check if host_type column is visible
    const visibleHostTypeIndex = visibleColumnIndices.indexOf(hostTypeColIndex);

    // Count potential updates for both scenarios and collect unique storage types
    let emptyHostTypeCount = 0;
    let allHostTypeCount = 0;
    const storageTypesInUse = new Set();

    sourceData.forEach((row) => {
      if (row && row.storage_system) {
        const storageOption = storageOptions.find(opt => opt.name === row.storage_system);
        if (storageOption?.storage_type) {
          storageTypesInUse.add(storageOption.storage_type);
          const defaultHostType = getDefaultHostType(storageOption.storage_type);
          if (defaultHostType) {
            // Count hosts with empty host_type that would be updated
            if (!row.host_type || row.host_type.trim() === '') {
              emptyHostTypeCount++;
            }
            // Count all hosts with this storage type (for override all)
            allHostTypeCount++;
          }
        }
      }
    });

    if (allHostTypeCount === 0) {
      alert('⚠️ No hosts found with storage systems that support host type settings.');
      return;
    }

    // Initialize custom host types with the standard defaults
    const initialCustomHostTypes = {};
    Array.from(storageTypesInUse).forEach(storageType => {
      initialCustomHostTypes[storageType] = getDefaultHostType(storageType);
    });

    // Show modal with options
    setHostTypeModalData({
      emptyHostTypeCount,
      allHostTypeCount,
      sourceData,
      visibleHostTypeIndex,
      hostTypeColIndex,
      storageTypesInUse: Array.from(storageTypesInUse)
    });
    setCustomHostTypes(initialCustomHostTypes);
    setShowHostTypeModal(true);
  };

  // Handle the actual host type update after modal choice
  const applyHostTypes = (updateOnlyEmpty) => {
    const { sourceData, visibleHostTypeIndex, storageTypesInUse } = hostTypeModalData;
    const hot = tableRef.current?.hotInstance;
    
    if (!hot) {
      console.error('❌ No table instance available');
      return;
    }

    // Validate that all storage types have host types selected
    const missingHostTypes = storageTypesInUse.filter(storageType => 
      !customHostTypes[storageType] || customHostTypes[storageType].trim() === ''
    );
    
    if (missingHostTypes.length > 0) {
      alert(`⚠️ Please select host types for: ${missingHostTypes.join(', ')}`);
      return;
    }

    // Collect changes based on user choice
    const changes = [];
    let updatedCount = 0;

    sourceData.forEach((row, rowIndex) => {
      if (row && row.storage_system) {
        const storageOption = storageOptions.find(opt => opt.name === row.storage_system);
        if (storageOption?.storage_type) {
          const selectedHostType = customHostTypes[storageOption.storage_type];
          if (selectedHostType) {
            let shouldUpdate = false;
            
            if (updateOnlyEmpty) {
              // Only update if host_type is empty or null
              shouldUpdate = !row.host_type || row.host_type.trim() === '';
            } else {
              // Override all - update every host with matching storage type
              shouldUpdate = true;
            }
            
            if (shouldUpdate) {
              changes.push({
                row: rowIndex,
                oldValue: row.host_type,
                newValue: selectedHostType
              });
              updatedCount++;
            }
          }
        }
      }
    });

    if (changes.length > 0) {
      console.log(`🔄 Processing ${changes.length} changes for bulk host type update (${updateOnlyEmpty ? 'empty only' : 'override all'})`);
      
      // Apply all changes to source data first
      changes.forEach(({ row, newValue }) => {
        const rowData = hot.getSourceDataAtRow(row);
        if (rowData) {
          rowData.host_type = newValue;
        }
      });

      if (visibleHostTypeIndex !== -1) {
        // Column is visible - update the visible cells as well
        changes.forEach(({ row, newValue }) => {
          hot.setDataAtCell(row, visibleHostTypeIndex, newValue, 'loadData');
        });
      }

      // Create a single comprehensive afterChange event to trigger all change tracking at once
      const afterChangeData = changes.map(({ row, oldValue, newValue }) => 
        [row, 'host_type', oldValue, newValue]
      );
      
      console.log(`🔄 Triggering afterChange for ${afterChangeData.length} changes`);
      
      // Trigger the afterChange hook manually with 'edit' source to ensure proper change tracking
      if (hot.runHooks) {
        hot.runHooks('afterChange', afterChangeData, 'edit');
      }
      
      // Manually mark as dirty
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(true);
      }

      // Force a render to show all changes
      hot.render();
    }

    // Close the modal
    setShowHostTypeModal(false);
    setHostTypeModalData(null);
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
          } else if (col.data === "host_type") {
            console.log('🔥 Configuring host_type as dropdown column');
            column.type = "dropdown";
            column.allowInvalid = false;
            column.strict = true;
          } else if (col.data === "create") {
            column.type = "checkbox";
            column.className = "htCenter";
          }
          
          return column;
        })}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        preprocessData={preprocessData}
        onSave={handleSave}
        onDelete={handleDelete}
        getCellsConfig={getCellsConfig}
        columnSorting={true}
        filters={true}
        defaultVisibleColumns={visibleColumnIndices}
        getExportFilename={() => `${config?.customer?.name}_${config?.active_project?.name}_All_Hosts.csv`}
        additionalButtons={[
          {
            text: "Set Host Types",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            ),
            onClick: handleSetHostTypes
          },
          {
            text: "Storage Scripts",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c0 1.66-.41 3.22-1.14 4.58-.73 1.36-1.85 2.42-3.29 3.1C14.93 20.36 13.5 20.5 12 20.5s-2.93-.14-4.57-.82c-1.44-.68-2.56-1.74-3.29-3.1C3.41 15.22 3 13.66 3 12s.41-3.22 1.14-4.58c.73-1.36 1.85-2.42 3.29-3.1C9.07 3.64 10.5 3.5 12 3.5s2.93.14 4.57.82c1.44.68 2.56 1.74 3.29 3.10C20.59 8.78 21 10.34 21 12z"/>
              </svg>
            ),
            onClick: () => navigate('/scripts/storage')
          }
        ]}
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

      {/* Host Type Default Modal */}
      <Modal show={showHostTypeModal} onHide={() => setShowHostTypeModal(false)} size="md">
        <Modal.Header closeButton>
          <Modal.Title>Set Host Types</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hostTypeModalData && (
            <div>
              <div className="alert alert-info">
                <h5>📝 How would you like to set host types?</h5>
                <p className="mb-0">Choose how to update host types based on their storage systems.</p>
              </div>
              
              <div className="mb-4">
                {hostTypeModalData.emptyHostTypeCount > 0 && (
                  <div className="mb-3 p-3 border rounded">
                    <h6 className="mb-2">
                      <span className="badge bg-success me-2">{hostTypeModalData.emptyHostTypeCount}</span>
                      Update Only Empty Host Types
                    </h6>
                    <p className="mb-0 text-muted">
                      This will only set host types for hosts that currently have no host type assigned. 
                      Existing host type selections will be preserved.
                    </p>
                  </div>
                )}
                
                {hostTypeModalData.allHostTypeCount > hostTypeModalData.emptyHostTypeCount && (
                  <div className="mb-3 p-3 border rounded">
                    <h6 className="mb-2">
                      <span className="badge bg-warning me-2">{hostTypeModalData.allHostTypeCount}</span>
                      Override All Host Types
                    </h6>
                    <p className="mb-0 text-muted">
                      This will set ALL host types to the selected values, 
                      overwriting any existing selections.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="alert alert-light">
                <h6>Choose Host Types to Apply:</h6>
                {hostTypeModalData.storageTypesInUse.map(storageType => (
                  <div key={storageType} className="mb-3">
                    <label className="form-label">
                      <strong>{storageType}:</strong>
                    </label>
                    <select 
                      className="form-select form-select-sm"
                      value={customHostTypes[storageType] || ''}
                      onChange={(e) => setCustomHostTypes(prev => ({
                        ...prev,
                        [storageType]: e.target.value
                      }))}
                    >
                      <option value="">-- Select Host Type --</option>
                      {getHostTypeOptions(storageType).map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHostTypeModal(false)}>
            Cancel
          </Button>
          {hostTypeModalData?.emptyHostTypeCount > 0 && (
            <Button variant="success" onClick={() => applyHostTypes(true)}>
              Update Empty Only ({hostTypeModalData.emptyHostTypeCount})
            </Button>
          )}
          {hostTypeModalData?.allHostTypeCount > hostTypeModalData?.emptyHostTypeCount && (
            <Button variant="warning" onClick={() => applyHostTypes(false)}>
              Override All ({hostTypeModalData.allHostTypeCount})
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HostTable;