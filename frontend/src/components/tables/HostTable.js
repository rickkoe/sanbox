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
  { data: "wwpn_status", title: "WWPN Status" },
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
const DEFAULT_VISIBLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 16]; // name, storage_system, wwpns, wwpn_status, status, host_type, aliases_count, vols_count, fc_ports_count, create, imported, updated

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
  acknowledged: "",
  last_data_collection: null,
  natural_key: "",
  create: false,
  imported: null,
  updated: null,
  saved: false,
  _isNew: true
};

const HostTable = ({ storage }) => {
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
  
  // WWPN management modal state
  const [showWwpnModal, setShowWwpnModal] = useState(false);
  const [wwpnModalData, setWwpnModalData] = useState(null);
  const [newWwpn, setNewWwpn] = useState("");
  const [wwpnConflicts, setWwpnConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  
  // WWPN reconciliation modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileData, setReconcileData] = useState(null);

  // WWPN Status modal state
  const [showWwpnStatusModal, setShowWwpnStatusModal] = useState(false);
  const [wwpnStatusData, setWwpnStatusData] = useState(null);

  // Force refresh key for table re-render
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  // Bulk reconciliation modal state
  const [showBulkReconcileModal, setShowBulkReconcileModal] = useState(false);

  // WWPN deletion confirmation modal state
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionData, setDeletionData] = useState(null);
  const [bulkReconcileData, setBulkReconcileData] = useState([]);
  const [selectedHosts, setSelectedHosts] = useState(new Set());

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

  // Build API URL with optional storage filtering
  const getApiUrl = () => {
    let url = `${API_ENDPOINTS.hosts}${activeProjectId}/?format=table`;
    if (storage) {
      url += `&storage=${storage.id}`;
      console.log(`🔥 HostTable filtering by storage system: ${storage.name} (ID: ${storage.id})`);
    } else {
      console.log(`🔥 HostTable showing all hosts (no storage filter)`);
    }
    console.log(`🔥 HostTable API URL: ${url}`);
    return url;
  };

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

  // WWPN management functions
  const handleManageWwpns = (hostId, hostName) => {
    setWwpnModalData({ hostId, hostName, wwpns: [] });
    setNewWwpn("");
    setWwpnConflicts([]);
    setShowWwpnModal(true);
    
    // Load current WWPNs for this host
    loadHostWwpns(hostId);
  };
  
  // Make the function globally available for the click handlers
  React.useEffect(() => {
    window.openWwpnManagement = handleManageWwpns;
    return () => {
      window.openWwpnManagement = null;
    };
  }, []);
  
  // WWPN reconciliation function
  const handleWwpnReconciliation = async (hostId, hostName) => {
    try {
      const response = await axios.get(`${API_URL}/api/san/hosts/${hostId}/wwpn-reconciliation/`);
      setReconcileData({
        hostId,
        hostName,
        matches: response.data.matches || []
      });
      setShowReconcileModal(true);
    } catch (error) {
      console.error("Error loading WWPN reconciliation data:", error);
      alert("Failed to load reconciliation data. Please try again.");
    }
  };
  
  // Make the reconciliation function globally available
  React.useEffect(() => {
    window.openWwpnReconciliation = handleWwpnReconciliation;
    return () => {
      window.openWwpnReconciliation = null;
    };
  }, []);
  
  // WWPN Status modal function - handles all status types
  const handleWwpnStatusModal = async (hostId, hostName, statusLevel) => {
    try {
      // Get detailed WWPN information for all statuses
      const wwpnResponse = await axios.get(`${API_URL}/api/storage/hosts/${hostId}/wwpns/`);
      const wwpnDetails = wwpnResponse.data.wwpns || [];
      
      // For statuses that might have matches, also get reconciliation data
      let reconciliationData = null;
      if (statusLevel === 'matches_available' || statusLevel === 'mixed_no_matches' || statusLevel === 'no_matches') {
        try {
          const reconcileResponse = await axios.get(`${API_URL}/api/san/hosts/${hostId}/wwpn-reconciliation/`);
          reconciliationData = reconcileResponse.data;
        } catch (error) {
          console.log("No reconciliation data available:", error);
        }
      }
      
      setWwpnStatusData({
        hostId,
        hostName,
        statusLevel,
        wwpnDetails,
        reconciliationData
      });
      setShowWwpnStatusModal(true);
    } catch (error) {
      console.error("Error loading WWPN status data:", error);
      alert("Failed to load WWPN details. Please try again.");
    }
  };
  
  // Aggressive table refresh function
  const forceTableRefresh = async (delayMs = 500) => {
    console.log(`🔄 Force refreshing table in ${delayMs}ms...`);
    
    setTimeout(async () => {
      try {
        // Method 1: Refresh data
        if (tableRef.current?.refreshData) {
          console.log('🔄 Calling table refreshData...');
          await tableRef.current.refreshData();
          console.log('✅ Table refresh completed');
        }
        
        // Method 2: Force Handsontable re-render
        if (tableRef.current?.hotInstance) {
          console.log('🔄 Forcing Handsontable re-render...');
          tableRef.current.hotInstance.render();
          console.log('✅ Handsontable re-render completed');
        }
        
        // Method 3: Force React component re-render by changing key
        console.log('🔄 Forcing React table component re-render...');
        setTableRefreshKey(prev => prev + 1);
        console.log('✅ React component re-render triggered');
        
      } catch (error) {
        console.error('❌ Error in force table refresh:', error);
      }
    }, delayMs);
  };

  // Handle WWPN Status modal close with table refresh
  const handleWwpnStatusModalClose = async () => {
    console.log('🔄 Closing WWPN Status modal and refreshing table...');
    setShowWwpnStatusModal(false);
    
    // Force refresh with longer delay to let backend signals complete
    await forceTableRefresh(1000);
  };

  // Make the WWPN status modal function globally available
  React.useEffect(() => {
    window.openWwpnStatusModal = handleWwpnStatusModal;
    return () => {
      window.openWwpnStatusModal = null;
    };
  }, []);
  
  const loadHostWwpns = async (hostId) => {
    try {
      console.log(`🔄 Loading WWPNs for host ${hostId}`);
      const response = await axios.get(`${API_URL}/api/storage/hosts/${hostId}/wwpns/`);
      console.log(`📋 WWPN response:`, response.data);
      
      const wwpns = response.data.wwpns || [];
      console.log(`📋 WWPNs found:`, wwpns);
      
      setWwpnModalData(prev => ({
        ...prev,
        wwpns: wwpns
      }));
    } catch (error) {
      console.error("❌ Error loading WWPNs:", error);
      console.error("❌ Error details:", error.response?.status, error.response?.data);
    }
  };
  
  const checkWwpnConflicts = async (wwpn, hostId) => {
    if (!wwpn || wwpn.trim() === "") {
      setWwpnConflicts([]);
      return;
    }
    
    setCheckingConflicts(true);
    try {
      const response = await axios.post(`${API_URL}/api/storage/check-wwpn-conflicts/`, {
        wwpn: wwpn.trim(),
        host_id: hostId
      });
      setWwpnConflicts(response.data.conflicts || []);
    } catch (error) {
      console.error("Error checking WWPN conflicts:", error);
      setWwpnConflicts([]);
    } finally {
      setCheckingConflicts(false);
    }
  };
  
  const addWwpn = async () => {
    if (!newWwpn.trim()) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/storage/hosts/${wwpnModalData.hostId}/wwpns/`, {
        action: 'add',
        wwpn: newWwpn.trim()
      });
      
      if (response.data.success) {
        // Reload WWPNs for the modal
        loadHostWwpns(wwpnModalData.hostId);
        setNewWwpn("");
        setWwpnConflicts([]);
        
        // Force aggressive table refresh like in handleAcceptMatch
        await forceTableRefresh(1000);
        
        // Clear dirty state since we've processed the changes
        if (tableRef.current?.setIsDirty) {
          tableRef.current.setIsDirty(false);
          console.log('✅ Cleared dirty state after modal WWPN addition');
        }
      }
    } catch (error) {
      console.error("Error adding WWPN:", error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
      
      // Refresh table even on error to show current state
      await forceTableRefresh(1000);
      
      // Clear dirty state even on error to prevent confusion
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after modal addition error to prevent confusion');
      }
    }
  };
  
  const removeWwpn = async (wwpnToRemove) => {
    try {
      console.log(`🗑️ Attempting to remove WWPN ${wwpnToRemove} from host ${wwpnModalData.hostId}`);
      
      // First, get the WWPN details to see if it's from an alias or manual
      const wwpnData = wwpnModalData.wwpns.find(w => w.wwpn === wwpnToRemove);
      console.log(`🔍 WWPN data:`, wwpnData);
      
      if (!wwpnData) {
        throw new Error('WWPN not found in current data');
      }
      
      if (wwpnData.source_type === 'alias' && wwpnData.source_alias_id) {
        // For alias WWPNs, explain the limitation and offer alternatives
        console.log(`🔗 WWPN ${wwpnToRemove} comes from alias ${wwpnData.source_alias_id}`);
        
        const aliasName = wwpnData.source_alias || `Alias ${wwpnData.source_alias_id}`;
        const confirmUnassign = window.confirm(
          `This WWPN comes from alias "${aliasName}".\n\n` +
          `To remove this WWPN, you need to unassign the host from the alias.\n\n` +
          `Options:\n` +
          `1. Go to the Alias Table and clear the Host field for "${aliasName}"\n` +
          `2. Continue here to attempt automatic unassignment\n\n` +
          `Would you like to try automatic unassignment?`
        );
        
        if (!confirmUnassign) {
          return;
        }
        
        // Try to unassign the host from the alias
        try {
          console.log(`🔗 Attempting to unassign host from alias ${wwpnData.source_alias_id}`);
          const response = await axios.post(`${API_URL}/api/san/unassign-host-from-alias/`, {
            host_id: wwpnModalData.hostId,
            alias_id: wwpnData.source_alias_id
          });
          console.log(`✅ Successfully unassigned host from alias:`, response.data);
        } catch (unassignError) {
          console.error(`❌ Failed to unassign host from alias:`, unassignError.response?.status, unassignError.response?.data);
          throw new Error(
            `Cannot unassign host from alias "${aliasName}".\n\n` +
            `Please use the Alias Table to manually clear the Host field for this alias.\n\n` +
            `Error: ${unassignError.response?.data?.error || unassignError.message}`
          );
        }
      } else {
        // For manual WWPNs, use the backend API directly
        console.log(`🔧 Removing manual WWPN ${wwpnToRemove} using backend API`);
        
        const response = await axios.post(`${API_URL}/api/storage/hosts/${wwpnModalData.hostId}/wwpns/`, {
          action: 'remove',
          wwpn: wwpnToRemove
        });
        
        console.log(`✅ Remove WWPN response:`, response.data);
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Remove operation failed');
        }
      }
      
      // If we get here, the operation was successful
      console.log(`✅ Successfully processed WWPN ${wwpnToRemove}`);
      
      // Reload WWPNs for the modal
      loadHostWwpns(wwpnModalData.hostId);
      
      // Force aggressive table refresh like in handleAcceptMatch
      await forceTableRefresh(1000);
      
      // Clear dirty state since we've processed the changes
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after modal WWPN removal');
      }
      
    } catch (error) {
      console.error("❌ Error removing WWPN:", error);
      alert(`Error removing WWPN: ${error.message}`);
      
      // Refresh table even on error to show current state
      await forceTableRefresh(1000);
      
      // Clear dirty state even on error to prevent confusion
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after modal error to prevent confusion');
      }
    }
  };
  
  const assignHostToAlias = async (aliasId, hostId) => {
    try {
      const response = await axios.post(`${API_URL}/api/san/assign-host-to-alias/`, {
        alias_id: aliasId,
        host_id: hostId
      });
      
      if (response.data.success) {
        // Show success message
        alert(`Success: ${response.data.message}`);
        
        // Clear the new WWPN input and conflicts
        setNewWwpn("");
        setWwpnConflicts([]);
        
        // Reload WWPNs for this host
        loadHostWwpns(hostId);
        
        // Force aggressive table refresh like in handleAcceptMatch
        await forceTableRefresh(1000);
        
        // Clear dirty state since we've processed the changes
        if (tableRef.current?.setIsDirty) {
          tableRef.current.setIsDirty(false);
          console.log('✅ Cleared dirty state after modal alias assignment');
        }
      }
    } catch (error) {
      console.error("Error assigning host to alias:", error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
      
      // Refresh table even on error to show current state
      await forceTableRefresh(1000);
      
      // Clear dirty state even on error to prevent confusion
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after modal assignment error to prevent confusion');
      }
    }
  };

  // WWPN formatting utility function
  const formatWWPN = (value) => {
    if (!value) return "";
    
    const cleanValue = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    
    if (cleanValue.length !== 16) {
      return value;
    }
    
    return cleanValue.match(/.{2}/g).join(':');
  };

  // Accept WWPN match - assign host to the matching alias
  const handleAcceptMatch = async (match, hostId = null, hostName = null) => {
    try {
      // Use provided hostId or fall back to reconcileData
      const targetHostId = hostId || reconcileData?.hostId;
      const targetHostName = hostName || reconcileData?.hostName;
      
      if (!targetHostId) {
        alert("Error: Host ID not available for match acceptance.");
        return;
      }
      
      console.log(`🔄 Accepting match: Host ${targetHostId} -> Alias ${match.alias_id} (${match.alias_name})`);
      
      const response = await axios.post(`${API_URL}/api/san/assign-host-to-alias/`, {
        host_id: targetHostId,
        alias_id: match.alias_id
      });
      
      if (response.data.success) {
        console.log(`✅ Successfully assigned host to alias: ${match.alias_name}`);
        
        // Force aggressive table refresh
        await forceTableRefresh(1000);
        
        // If we're in reconciliation modal context, refresh that data
        if (reconcileData && reconcileData.hostId === targetHostId) {
          await handleWwpnReconciliation(targetHostId, targetHostName);
        }
        
        // If we're in status modal context, refresh that data
        if (wwpnStatusData && wwpnStatusData.hostId === targetHostId) {
          await handleWwpnStatusModal(targetHostId, targetHostName, wwpnStatusData.statusLevel);
        }
      } else {
        alert(`Failed to assign host to alias: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error accepting WWPN match:", error);
      alert("Failed to accept match. Please try again.");
    }
  };

  // Reject WWPN match - keep as manual assignment
  const handleRejectMatch = async (match) => {
    // Remove this specific WWPN match from the reconciliation data
    setReconcileData(prev => ({
      ...prev,
      matches: prev.matches.filter(m => m.wwpn !== match.wwpn)
    }));
    
    console.log(`⏭️ Rejected match for WWPN ${match.wwpn}, keeping as manual`);
  };

  // Handle bulk accept alias matches action
  const handleBulkAcceptAliasMatches = async () => {
    console.log('🔄 Loading hosts with available matches for bulk reconciliation...');
    
    try {
      const response = await axios.get(`${getApiUrl()}`);
      const hosts = response.data.results || response.data;
      
      // Filter hosts that have matches available
      const hostsWithMatches = hosts.filter(host => 
        host.wwpn_status_level === 'matches_available'
      );
      
      if (hostsWithMatches.length === 0) {
        alert('No hosts with available alias matches found.');
        return;
      }
      
      console.log(`✅ Found ${hostsWithMatches.length} hosts with available matches`);
      
      // Load detailed reconciliation data for each host
      const hostsWithMatchDetails = [];
      for (const host of hostsWithMatches) {
        try {
          const reconcileResponse = await axios.get(`${API_URL}/api/san/hosts/${host.id}/wwpn-reconciliation/`);
          if (reconcileResponse.data.matches && reconcileResponse.data.matches.length > 0) {
            hostsWithMatchDetails.push({
              ...host,
              reconciliationData: reconcileResponse.data
            });
          }
        } catch (error) {
          console.warn(`Failed to load reconciliation data for host ${host.name}:`, error);
        }
      }
      
      setBulkReconcileData(hostsWithMatchDetails);
      setSelectedHosts(new Set()); // Start with no hosts selected
      setShowBulkReconcileModal(true);
      
    } catch (error) {
      console.error('Error loading hosts for bulk reconciliation:', error);
      alert('Failed to load hosts with matches. Please try again.');
    }
  };

  // Handle bulk accept for selected hosts
  const handleBulkAcceptSelected = async () => {
    if (selectedHosts.size === 0) {
      alert('Please select at least one host to process.');
      return;
    }

    const selectedHostData = bulkReconcileData.filter(host => selectedHosts.has(host.id));
    await processBulkAccept(selectedHostData, 'selected');
  };

  // Handle bulk accept for all hosts
  const handleBulkAcceptAll = async () => {
    if (bulkReconcileData.length === 0) {
      alert('No hosts available to process.');
      return;
    }

    await processBulkAccept(bulkReconcileData, 'all');
  };

  // Handle deletion confirmation
  const handleDeletionConfirm = async () => {
    if (!deletionData) return;
    
    setShowDeletionModal(false);
    
    try {
      if (deletionData.isMultiHost) {
        // Handle multiple hosts
        console.log(`🗑️ Processing multi-host deletion for ${deletionData.hosts.length} hosts`);
        
        let totalSuccessful = 0;
        let totalFailed = 0;
        const allErrors = [];
        
        // Process each host sequentially to avoid overwhelming the server
        for (const hostData of deletionData.hosts) {
          console.log(`🗑️ Processing host ${hostData.hostName} with ${hostData.wwpnsToDelete.length} WWPNs`);
          
          try {
            const result = await handleWwpnDeletion(hostData.hostId, hostData.wwpnsToDelete);
            totalSuccessful += result.successful;
            totalFailed += result.failed;
            
            if (result.failed > 0) {
              const hostErrors = result.errors.map(e => `${hostData.hostName}: ${e.message || 'Unknown error'}`);
              allErrors.push(...hostErrors);
            }
          } catch (hostError) {
            console.error(`❌ Failed to process host ${hostData.hostName}:`, hostError);
            totalFailed += hostData.wwpnsToDelete.length;
            allErrors.push(`${hostData.hostName}: ${hostError.message || 'Unknown error'}`);
          }
        }
        
        // Show combined results
        if (totalFailed > 0) {
          alert(`⚠️ Multi-host deletion completed:\n\n✅ Successfully removed: ${totalSuccessful} WWPNs\n❌ Failed to remove: ${totalFailed} WWPNs\n\nErrors:\n${allErrors.join('\n')}`);
        } else if (totalSuccessful > 0) {
          alert(`✅ Successfully removed ${totalSuccessful} WWPN${totalSuccessful > 1 ? 's' : ''} from ${deletionData.hosts.length} host${deletionData.hosts.length > 1 ? 's' : ''}`);
        }
      } else {
        // Handle single host (existing logic)
        const result = await handleWwpnDeletion(deletionData.hostId, deletionData.wwpnsToDelete);
        
        // Show result message
        if (result.failed > 0) {
          const errors = result.errors.map(e => e.message || 'Unknown error');
          alert(`⚠️ Some WWPNs could not be removed:\n\n${errors.join('\n')}\n\nSuccessfully removed: ${result.successful}/${deletionData.wwpnsToDelete.length}`);
        } else if (result.successful > 0) {
          alert(`✅ Successfully removed ${result.successful} WWPN${result.successful > 1 ? 's' : ''}`);
        }
      }
      
      // Force aggressive table refresh like in handleAcceptMatch
      await forceTableRefresh(1000);
      
      // Clear dirty state since we've processed the changes
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after WWPN deletion');
      }
    } catch (error) {
      console.error('Error during WWPN deletion:', error);
      alert(`❌ Error during deletion: ${error.message}`);
      
      // Refresh anyway to show current state
      await forceTableRefresh(1000);
      
      // Clear dirty state even on error to prevent confusion
      if (tableRef.current?.setIsDirty) {
        tableRef.current.setIsDirty(false);
        console.log('✅ Cleared dirty state after error to prevent confusion');
      }
    }
    
    setDeletionData(null);
  };

  const handleDeletionCancel = async () => {
    setShowDeletionModal(false);
    setDeletionData(null);
    
    // Force table refresh to revert any changes and clear dirty state
    await forceTableRefresh(100);
    
    // Clear dirty state since user cancelled (no actual changes should persist)
    if (tableRef.current?.setIsDirty) {
      tableRef.current.setIsDirty(false);
      console.log('✅ Cleared dirty state after cancelling deletion');
    }
  };

  // Handle WWPN deletion from table cells
  const handleWwpnDeletion = async (hostId, wwpnsToDelete) => {
    if (!hostId || !wwpnsToDelete || wwpnsToDelete.length === 0) {
      return;
    }

    console.log(`🗑️ Deleting WWPNs for host ${hostId}:`, wwpnsToDelete);

    try {
      // First, get the host's WWPN details to determine source types
      let hostWwpns = [];
      try {
        console.log(`🔍 Getting WWPN details for host ${hostId}`);
        const hostResponse = await axios.get(`${API_URL}/api/storage/hosts/${hostId}/wwpns/`);
        console.log(`📋 WWPN details response:`, hostResponse.data);
        hostWwpns = hostResponse.data.wwpns || [];
      } catch (detailsError) {
        console.error(`❌ Could not get WWPN details for host ${hostId}:`, detailsError.response?.status, detailsError.response?.data);
        // Continue anyway - we'll try to remove as manual WWPNs
      }

      const results = await Promise.allSettled(
        wwpnsToDelete.map(async (wwpn) => {
          try {
            // Find WWPN info to determine source type
            const wwpnInfo = hostWwpns.find(w => w.wwpn === wwpn);
            console.log(`🔍 Found WWPN info for ${wwpn}:`, wwpnInfo);
            
            if (wwpnInfo && wwpnInfo.source_type === 'alias' && wwpnInfo.source_alias_id) {
              // This WWPN came from an alias - need to unassign the host from the alias
              const aliasId = wwpnInfo.source_alias_id;
              const aliasName = wwpnInfo.source_alias || `Alias ${aliasId}`;
              console.log(`🔗 WWPN ${wwpn} comes from alias ${aliasName} (${aliasId}), unassigning host`);
              
              try {
                const unassignResponse = await axios.post(`${API_URL}/api/san/unassign-host-from-alias/`, {
                  host_id: hostId,
                  alias_id: aliasId
                });
                console.log(`✅ Successfully unassigned host from alias:`, unassignResponse.data);
              } catch (unassignError) {
                console.error(`❌ Failed to unassign host from alias:`, unassignError.response?.status, unassignError.response?.data);
                throw new Error(`Cannot remove alias WWPN ${wwpn}. Please unassign the host from alias "${aliasName}" in the Alias Table.`);
              }
            } else {
              // This is a manual WWPN or unknown - use the storage API to remove it
              console.log(`✏️ Removing WWPN ${wwpn} as manual WWPN for host ${hostId}`);
              
              const response = await axios.post(`${API_URL}/api/storage/hosts/${hostId}/wwpns/`, {
                action: 'remove',
                wwpn: wwpn
              });
              
              console.log(`✅ Successfully removed manual WWPN:`, response.data);
              
              if (!response.data.success) {
                throw new Error(response.data.message || 'Remove operation failed');
              }
            }
          } catch (wwpnError) {
            console.error(`❌ Failed to delete WWPN ${wwpn}:`, wwpnError);
            throw wwpnError;
          }
        })
      );

      // Check results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ WWPN deletion complete: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason?.message || 'Unknown error');
        console.warn('⚠️ Some WWPN deletions failed:', errors);
      }
      
      // Return results for the caller to handle
      
      return { successful, failed, errors: results.filter(r => r.status === 'rejected').map(r => r.reason) };
    } catch (error) {
      console.error('❌ Error during WWPN deletion:', error);
      throw error;
    }
  };

  // Core bulk processing function
  const processBulkAccept = async (hostsToProcess, type) => {
    console.log(`🔄 Starting bulk ${type} accept for ${hostsToProcess.length} hosts`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each host
    for (const host of hostsToProcess) {
      console.log(`🔄 Processing host: ${host.name}`);
      
      try {
        // Process all matches for this host
        for (const match of host.reconciliationData.matches) {
          for (const alias of match.matching_aliases) {
            try {
              console.log(`🔗 Accepting match: ${match.wwpn} → ${alias.name} for host ${host.name}`);
              console.log(`🔗 API URL: ${API_URL}/api/san/assign-host-to-alias/`);
              console.log(`🔗 Payload:`, { host_id: host.id, alias_id: alias.id });
              
              const response = await axios.post(`${API_URL}/api/san/assign-host-to-alias/`, {
                host_id: host.id,
                alias_id: alias.id
              });
              
              console.log(`✅ Successfully accepted match for host ${host.name}:`, response.data);
              successCount++;
            } catch (matchError) {
              console.error(`❌ Failed to accept match ${match.wwpn} → ${alias.name} for host ${host.name}:`, matchError);
              console.error(`❌ Error details:`, {
                status: matchError.response?.status,
                statusText: matchError.response?.statusText,
                data: matchError.response?.data,
                message: matchError.message
              });
              
              const errorDetail = matchError.response?.data?.error || matchError.response?.data?.detail || matchError.message || 'Unknown error';
              errors.push(`${host.name}: ${match.wwpn} → ${alias.name} (${errorDetail})`);
              errorCount++;
            }
          }
        }
      } catch (hostError) {
        console.error(`❌ Failed to process host ${host.name}:`, hostError);
        errors.push(`${host.name}: ${hostError.response?.data?.error || hostError.message}`);
        errorCount++;
      }
    }

    // Show results
    let message = '';
    if (successCount > 0 && errorCount === 0) {
      message = `✅ Successfully processed ${successCount} match${successCount !== 1 ? 'es' : ''} for ${type === 'all' ? 'all' : 'selected'} hosts!`;
    } else if (successCount > 0 && errorCount > 0) {
      message = `⚠️ Processed ${successCount} match${successCount !== 1 ? 'es' : ''} successfully, but ${errorCount} failed:\n${errors.join('\n')}`;
    } else {
      message = `❌ Failed to process any matches:\n${errors.join('\n')}`;
    }

    alert(message);

    // Close the modal and refresh the table
    setShowBulkReconcileModal(false);
    setBulkReconcileData([]);
    setSelectedHosts(new Set());

    // Refresh the table to show updated statuses
    console.log('🔄 Refreshing table after bulk accept...');
    if (tableRef.current?.refreshData) {
      await tableRef.current.refreshData();
    }
    
    // Aggressive refresh strategy - check if instance exists and is not destroyed
    setTimeout(() => {
      const hotInstance = tableRef.current?.hotInstance;
      if (hotInstance && !hotInstance.isDestroyed) {
        hotInstance.render();
      }
      setTableRefreshKey(prev => prev + 1);
    }, 1000);
  };

  // Accept all available matches
  const handleAcceptAllMatches = async () => {
    const reconciliationData = wwpnStatusData?.reconciliationData;
    if (!reconciliationData?.matches || reconciliationData.matches.length === 0) {
      alert("No matches available to accept.");
      return;
    }

    const hostId = wwpnStatusData.hostId;
    const hostName = wwpnStatusData.hostName;
    
    // Store for debugging
    window.lastUpdatedHostId = hostId;
    window.lastUpdatedHostName = hostName;
    
    console.log(`🔄 Accepting all ${reconciliationData.matches.length} available matches for host ${hostName}`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each match
      for (const match of reconciliationData.matches) {
        for (const alias of match.matching_aliases) {
          try {
            const response = await axios.post(`${API_URL}/api/san/assign-host-to-alias/`, {
              host_id: hostId,
              alias_id: alias.id
            });
            
            if (response.data.success) {
              console.log(`✅ Successfully assigned host to alias: ${alias.name} (WWPN: ${match.wwpn})`);
              successCount++;
            } else {
              console.error(`❌ Failed to assign ${alias.name}: ${response.data.error}`);
              errors.push(`${alias.name}: ${response.data.error}`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Error assigning ${alias.name}:`, error);
            errors.push(`${alias.name}: ${error.response?.data?.error || error.message}`);
            errorCount++;
          }
        }
      }

      // Show results
      if (successCount > 0) {
        console.log(`🎉 Successfully accepted ${successCount} matches`);
        
        // Force aggressive table refresh
        await forceTableRefresh(1500); // Longer delay for bulk operations
        
        // Refresh the status modal to show updated data
        console.log('🔄 Refreshing modal data...');
        await handleWwpnStatusModal(hostId, hostName, wwpnStatusData.statusLevel);
        console.log('✅ Modal data refreshed');
        
        if (errorCount > 0) {
          // Only show alerts for errors, not success
          alert(`Accepted ${successCount} matches successfully. ${errorCount} failed:\n${errors.join('\n')}`);
        }
      } else {
        // All failed
        alert(`Failed to accept any matches:\n${errors.join('\n')}`);
      }
    } catch (error) {
      console.error("Error in bulk accept:", error);
      alert("Failed to process matches. Please try again.");
    }
  };

  // Process pasted WWPNs (comma-separated) into individual manual assignments
  const processPastedWwpns = async (hostId, wwpnString) => {
    if (!wwpnString || !hostId) return { successCount: 0, errorCount: 0 };
    
    // Split by comma and clean up each WWPN
    const wwpns = wwpnString.split(',')
      .map(wwpn => wwpn.trim())
      .filter(wwpn => wwpn.length > 0);
    
    console.log(`🔄 Processing ${wwpns.length} pasted WWPNs for host ${hostId}:`, wwpns);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const wwpn of wwpns) {
      try {
        const response = await axios.post(`${API_URL}/api/storage/hosts/${hostId}/wwpns/`, {
          action: 'add',
          wwpn: wwpn
        });
        
        if (response.data.success) {
          successCount++;
          console.log(`✅ Added WWPN: ${wwpn}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error.response?.data?.error || error.message;
        errors.push(`${wwpn}: ${errorMsg}`);
        console.error(`❌ Failed to add WWPN ${wwpn}:`, errorMsg);
      }
    }
    
    // Show summary
    if (successCount > 0 && errorCount === 0) {
      console.log(`🎉 Successfully added ${successCount} WWPNs`);
    } else if (successCount > 0 && errorCount > 0) {
      alert(`✅ Added ${successCount} WWPNs successfully.\n❌ Failed to add ${errorCount} WWPNs:\n${errors.join('\n')}`);
    } else if (errorCount > 0) {
      alert(`❌ Failed to add all ${errorCount} WWPNs:\n${errors.join('\n')}`);
    }
    
    return { successCount, errorCount };
  };

  // Custom change handler for WWPN bulk editing
  const handleWwpnCellChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    
    console.log('🔍 Cell change detected:', { changes, source });
    
    // Collect all deletion operations first
    const deletionsByHost = new Map();
    
    // Process each change
    changes.forEach(([row, prop, oldVal, newVal]) => {
      console.log(`🔍 Change details: row=${row}, prop=${prop}, oldVal="${oldVal}", newVal="${newVal}", source=${source}`);
      
      if (prop === 'wwpns' && newVal !== oldVal && (source === 'edit' || source === 'CopyPaste.paste')) {
        const rowData = hot.getSourceDataAtRow(row);
        if (!rowData || !rowData.id) {
          console.log('❌ No row data or host ID found:', rowData);
          return;
        }
        
        console.log(`🔄 WWPNs changed for host ${rowData.name} (ID: ${rowData.id}): "${oldVal}" -> "${newVal}"`);
        
        if (newVal && newVal.trim() !== '') {
          // Adding/updating WWPNs - process the pasted WWPNs
          processPastedWwpns(rowData.id, newVal).then((result) => {
            if (result && result.successCount > 0) {
              console.log(`✅ Successfully processed ${result.successCount} WWPNs, refreshing table`);
              // Refresh the table to show the new WWPNs
              setTimeout(() => {
                if (tableRef.current?.refreshData) {
                  tableRef.current.refreshData();
                }
              }, 500);
            } else {
              console.log('❌ No WWPNs were successfully processed');
            }
          });
        } else if (oldVal && oldVal.trim() !== '' && (!newVal || newVal.trim() === '')) {
          // Deleting WWPNs - oldVal had content, newVal is empty
          console.log(`🗑️ Detected WWPN deletion for host ${rowData.name}: removing "${oldVal}"`);
          
          // Parse the old WWPNs that need to be deleted
          const wwpnsToDelete = oldVal
            .split(/[,\n\r\s]+/)
            .map(wwpn => wwpn.trim())
            .filter(wwpn => wwpn.length > 0)
            .map(wwpn => {
              // Ensure proper WWPN format
              const cleaned = wwpn.replace(/[^0-9a-fA-F]/g, '');
              if (cleaned.length === 16) {
                return cleaned.match(/.{2}/g).join(':');
              }
              return wwpn;
            });
          
          if (wwpnsToDelete.length > 0) {
            // Collect deletions by host
            const hostKey = `${rowData.id}-${rowData.name}`;
            if (!deletionsByHost.has(hostKey)) {
              deletionsByHost.set(hostKey, {
                hostId: rowData.id,
                hostName: rowData.name,
                wwpnsToDelete: []
              });
            }
            deletionsByHost.get(hostKey).wwpnsToDelete.push(...wwpnsToDelete);
          }
        }
      }
    });
    
    // If we have any deletions, process them
    if (deletionsByHost.size > 0) {
      if (deletionsByHost.size === 1) {
        // Single host - show modal
        const [deletionData] = deletionsByHost.values();
        // Remove duplicates
        deletionData.wwpnsToDelete = [...new Set(deletionData.wwpnsToDelete)];
        
        console.log(`🗑️ Table cell deletion detected for host ${deletionData.hostName}:`, deletionData.wwpnsToDelete);
        
        setDeletionData(deletionData);
        setShowDeletionModal(true);
      } else {
        // Multiple hosts - show multi-host modal
        const hostsData = Array.from(deletionsByHost.values()).map(hostData => ({
          ...hostData,
          wwpnsToDelete: [...new Set(hostData.wwpnsToDelete)] // Remove duplicates per host
        }));
        
        const totalWwpns = hostsData.reduce((total, host) => total + host.wwpnsToDelete.length, 0);
        
        console.log(`🗑️ Table cell deletion detected across ${deletionsByHost.size} hosts:`, hostsData);
        
        // Set up multi-host deletion data
        setDeletionData({
          isMultiHost: true,
          hosts: hostsData,
          totalWwpns: totalWwpns
        });
        setShowDeletionModal(true);
      }
    }
  };

  // Wait for config to load before showing any content
  if (!config) {
    return (
      <div className="table-container">
        <div className="alert alert-info">Loading configuration...</div>
      </div>
    );
  }

  // Helper function to get status description
  const getStatusDescription = (statusLevel, wwpnDetails) => {
    const aliasCount = wwpnDetails.filter(w => w.source_type === 'alias').length;
    const manualCount = wwpnDetails.filter(w => w.source_type === 'manual').length;
    
    switch(statusLevel) {
      case 'all_matched':
        return `All ${aliasCount} WWPN${aliasCount !== 1 ? 's' : ''} matched to aliases`;
      case 'matches_available':
        return `${aliasCount} matched, ${manualCount} manual with available matches`;
      case 'no_matches':
        return `${manualCount} manual WWPN${manualCount !== 1 ? 's' : ''}, no matches found`;
      case 'mixed_no_matches':
        return `${aliasCount} matched, ${manualCount} manual with no matches`;
      case 'no_wwpns':
        return 'No WWPNs assigned to this host';
      default:
        return `${aliasCount} from aliases, ${manualCount} manual`;
    }
  };

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
      const rowData = instance.getSourceDataAtRow(row);
      const wwpnDetails = rowData.wwpn_details || [];
      
      if (wwpnDetails.length > 0) {
        // Create HTML with visual indicators for each WWPN
        const wwpnElements = wwpnDetails.map(w => {
          let indicator, title;
          if (w.source_type === 'alias') {
            indicator = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" style="display: inline-block; vertical-align: middle;" title="From alias"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
            title = `From alias: ${w.source_alias || 'Unknown'}`;
          } else {
            indicator = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="display: inline-block; vertical-align: middle;" title="Manual"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
            title = 'Manually assigned';
          }
          return `<span style="margin-right: 8px;" title="${title}">${indicator} ${w.wwpn}</span>`;
        }).join('');
        
        td.innerHTML = wwpnElements;
        td.style.fontFamily = "monospace";
        td.style.fontSize = "12px";
        
        // Summary tooltip
        const aliasCount = wwpnDetails.filter(w => w.source_type === 'alias').length;
        const manualCount = wwpnDetails.filter(w => w.source_type === 'manual').length;
        let summary = '';
        if (aliasCount > 0) summary += `${aliasCount} from aliases`;
        if (manualCount > 0) summary += `${summary ? ', ' : ''}${manualCount} manual`;
        
        // Enhanced tooltip with editing instructions
        td.title = `${wwpnDetails.length} WWPNs total: ${summary}\n\nClick to open management modal, or double-click to paste comma-separated WWPNs directly`;
        
        // Add click handler for WWPN management (with delay to allow double-click)
        td.style.cursor = 'pointer';
        let clickTimeout;
        td.onclick = (e) => {
          // Only handle single clicks, not double clicks
          clearTimeout(clickTimeout);
          clickTimeout = setTimeout(() => {
            const hostId = rowData.id;
            const hostName = rowData.name;
            if (window.openWwpnManagement) {
              window.openWwpnManagement(hostId, hostName);
            }
          }, 300); // 300ms delay to differentiate from double-click
        };
        
        td.ondblclick = (e) => {
          // Clear the single click timeout on double-click
          clearTimeout(clickTimeout);
          e.stopPropagation();
          // Double-click should trigger edit mode - Handsontable handles this
        };
      } else {
        td.innerHTML = '<span style="color: #6b7280; font-style: italic;">No WWPNs - paste here or click to manage</span>';
        td.title = "No WWPNs assigned\n\nClick to open management modal, or double-click to paste comma-separated WWPNs directly";
        td.style.cursor = 'pointer';
        let clickTimeout;
        td.onclick = (e) => {
          // Only handle single clicks, not double clicks
          clearTimeout(clickTimeout);
          clickTimeout = setTimeout(() => {
            const hostId = rowData.id;
            const hostName = rowData.name;
            if (window.openWwpnManagement) {
              window.openWwpnManagement(hostId, hostName);
            }
          }, 300);
        };
        
        td.ondblclick = (e) => {
          clearTimeout(clickTimeout);
          e.stopPropagation();
        };
      }
      
      // Add visual indicator that this cell is editable
      td.style.border = "1px solid #e5e7eb";
      td.style.backgroundColor = "#f9fafb";
      
      return td;
    },
    wwpn_status: (instance, td, row, col, prop, value) => {
      const rowData = instance.getSourceDataAtRow(row);
      const statusLevel = rowData.wwpn_status_level;
      const statusComponents = rowData.wwpn_status_components || [];
      
      const getBootstrapClass = (color) => {
        switch(color) {
          case 'success': return 'bg-success';
          case 'warning': return 'bg-warning text-dark';
          case 'secondary': return 'bg-secondary';
          case 'info': return 'bg-info text-dark';
          case 'light': return 'bg-light text-muted';
          default: return 'bg-light text-muted';
        }
      };
      
      const getTooltip = () => {
        switch(statusLevel) {
          case 'matches_available': return 'Click to view WWPN status and reconcile matches';
          case 'no_matches': return 'Click to view manual WWPNs with no matches';
          case 'mixed_no_matches': return 'Click to view mixed WWPN status';
          case 'all_matched': return 'Click to view all matched WWPNs';
          case 'no_wwpns': return 'Click to view WWPN details';
          default: return 'Click to view WWPN details';
        }
      };
      
      // Build multi-line status display
      if (statusComponents.length > 1) {
        // Multi-line display for mixed statuses
        const badgeHTML = statusComponents.map(component => 
          `<div style="margin-bottom: 2px;"><span class="badge ${getBootstrapClass(component.color)}" style="cursor: pointer; user-select: none; font-size: 10px; padding: 2px 6px;">${component.text}</span></div>`
        ).join('');
        
        td.innerHTML = `<div style="text-align: center;">${badgeHTML}</div>`;
      } else if (statusComponents.length === 1) {
        // Single badge display
        const component = statusComponents[0];
        td.innerHTML = `<span class="badge ${getBootstrapClass(component.color)}" style="cursor: pointer; user-select: none;">${component.text}</span>`;
      } else {
        // Fallback to original display if no components
        td.innerHTML = `<span class="badge bg-light text-muted" style="cursor: pointer; user-select: none;">${value}</span>`;
      }
      
      td.style.textAlign = 'center';
      td.style.verticalAlign = 'middle';
      td.title = getTooltip();
      
      // Add click handler for WWPN status modal
      td.onclick = (e) => {
        e.stopPropagation();
        const hostId = rowData.id;
        const hostName = rowData.name;
        if (window.openWwpnStatusModal) {
          window.openWwpnStatusModal(hostId, hostName, statusLevel);
        }
      };
      
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
    
    // Debug the updated host if we just made changes
    if (window.lastUpdatedHostId) {
      const updatedHost = data.find(h => h.id === window.lastUpdatedHostId);
      if (updatedHost) {
        console.log(`🔍 Updated host ${window.lastUpdatedHostName} status:`, {
          wwpn_status: updatedHost.wwpn_status,
          wwpn_status_level: updatedHost.wwpn_status_level,
          wwpn_status_components: updatedHost.wwpn_status_components
        });
      }
      // Clear the debug info
      delete window.lastUpdatedHostId;
      delete window.lastUpdatedHostName;
    }
    
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
        key={`all-hosts-table-${storageOptions.length}-${storage?.id || 'all'}-${tableRefreshKey}`} // Force re-render when storage options, storage filter, or refresh key changes
        ref={tableRef}
        apiUrl={getApiUrl()}
        saveUrl={API_ENDPOINTS.hostSave}
        // deleteUrl={`${API_URL}/api/san/hosts/delete/`}  // Remove to force custom handler
        newRowTemplate={NEW_HOST_TEMPLATE}
        tableName="allHosts"
        serverPagination={true}
        defaultPageSize={'All'}
        storageKey={`all-hosts-table-${activeProjectId}-${storage?.id || 'all'}`}
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
          } else if (col.data === "wwpns") {
            // Make WWPNs column editable for bulk paste functionality
            column.readOnly = false;
            column.type = "text";
            column.className = "htLeft";
            column.wordWrap = true;
            // Provide a custom editor that starts with empty value for pasting
            column.editor = 'text';
            column.allowEmpty = true;
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
        afterChange={handleWwpnCellChange}
        beforeEdit={(row, col, prop) => {
          // When starting to edit the wwpns cell, clear it for clean pasting
          if (prop === 'wwpns') {
            console.log('🔍 beforeEdit for wwpns cell:', { row, col, prop });
            const hot = tableRef.current?.hotInstance;
            if (hot) {
              // Clear the cell value when starting to edit
              hot.setDataAtCell(row, col, '', 'edit');
            }
          }
        }}
        columnSorting={true}
        filters={true}
        defaultVisibleColumns={visibleColumnIndices}
        headerButtons={null}
        getExportFilename={() => {
          const base = `${config?.customer?.name}_${config?.active_project?.name}`;
          const suffix = storage ? `_${storage.name}_Hosts.csv` : '_All_Hosts.csv';
          return base + suffix;
        }}
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
            text: "Accept Alias Matches",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c0 1.66-.41 3.22-1.14 4.58-.73 1.36-1.85 2.42-3.29 3.1C14.93 20.36 13.5 20.5 12 20.5s-2.93-.14-4.57-.82c-1.44-.68-2.56-1.74-3.29-3.1C3.41 15.22 3 13.66 3 12s.41-3.22 1.14-4.58c.73-1.36 1.85-2.42 3.29-3.10C9.07 3.64 10.5 3.5 12 3.5s2.93.14 4.57.82c1.44.68 2.56 1.74 3.29 3.10C20.59 8.78 21 10.34 21 12z"/>
              </svg>
            ),
            onClick: handleBulkAcceptAliasMatches
          },
          {
            text: "Manage WWPNs",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
              </svg>
            ),
            onClick: () => {
              const selected = tableRef.current?.hotInstance?.getSelected();
              if (selected && selected.length > 0) {
                const row = selected[0][0];
                const rowData = tableRef.current.hotInstance.getSourceDataAtRow(row);
                if (rowData && rowData.id) {
                  handleManageWwpns(rowData.id, rowData.name);
                } else {
                  alert("Please select a valid host to manage WWPNs.");
                }
              } else {
                alert("Please select a host first.");
              }
            }
          },
          {
            text: "Storage Scripts",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c0 1.66-.41 3.22-1.14 4.58-.73 1.36-1.85 2.42-3.29 3.1C14.93 20.36 13.5 20.5 12 20.5s-2.93-.14-4.57-.82c-1.44-.68-2.56-1.74-3.29-3.10C3.41 15.22 3 13.66 3 12s.41-3.22 1.14-4.58c.73-1.36 1.85-2.42 3.29-3.10C9.07 3.64 10.5 3.5 12 3.5s2.93.14 4.57.82c1.44.68 2.56 1.74 3.29 3.10C20.59 8.78 21 10.34 21 12z"/>
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

      {/* WWPN Management Modal */}
      <Modal show={showWwpnModal} onHide={() => setShowWwpnModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Manage WWPNs for {wwpnModalData?.hostName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {wwpnModalData && (
            <div>
              <div className="mb-4">
                <h6>Current WWPNs:</h6>
                {wwpnModalData.wwpns.length > 0 ? (
                  <div className="list-group">
                    {wwpnModalData.wwpns.map((wwpn, index) => {
                      console.log(`🔍 Rendering WWPN ${index}:`, wwpn);
                      return (
                        <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <span className="font-monospace">{wwpn.wwpn}</span>
                          {wwpn.source_type === 'alias' ? (
                            <span className="badge bg-success ms-2" title="From alias" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                              </svg>
                              {wwpn.source_alias || 'Alias'}
                            </span>
                          ) : (
                            <span className="badge bg-primary ms-2" title="Manual" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              Manual
                            </span>
                          )}
                        </div>
                        <button 
                          className={`btn btn-sm ${wwpn.source_type === 'manual' ? 'btn-outline-danger' : 'btn-outline-warning'}`}
                          onClick={() => removeWwpn(wwpn.wwpn)}
                          title={wwpn.source_type === 'manual' ? 'Remove manual WWPN' : `Guide to unassign from alias ${wwpn.source_alias || 'alias'} (use Alias Table)`}
                        >
                          {wwpn.source_type === 'manual' ? 'Remove' : 'Unassign'}
                        </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="alert alert-info">No WWPNs assigned to this host.</div>
                )}
                
                <div className="alert alert-info" style={{ fontSize: '12px', padding: '8px', marginTop: '1rem' }}>
                  <strong>💡 WWPN Management:</strong>
                  <ul style={{ marginBottom: 0, marginTop: '4px', paddingLeft: '16px' }}>
                    <li><strong>Manual WWPNs:</strong> Can be removed directly using the Remove button</li>
                    <li><strong>Alias WWPNs:</strong> Must be unassigned via the Alias Table or using the Unassign button</li>
                  </ul>
                </div>
              </div>

              <div className="border-top pt-4">
                <h6>Add Manual WWPN:</h6>
                <div className="row g-2 align-items-end">
                  <div className="col">
                    <label className="form-label">WWPN:</label>
                    <input 
                      type="text" 
                      className="form-control font-monospace"
                      value={newWwpn}
                      onChange={(e) => {
                        setNewWwpn(e.target.value);
                        checkWwpnConflicts(e.target.value, wwpnModalData.hostId);
                      }}
                      placeholder="50:01:23:45:67:89:AB:CD"
                      maxLength="23"
                    />
                  </div>
                  <div className="col-auto">
                    <button 
                      className="btn btn-primary"
                      onClick={addWwpn}
                      disabled={!newWwpn.trim() || checkingConflicts}
                    >
                      Add WWPN
                    </button>
                  </div>
                </div>

                {checkingConflicts && (
                  <div className="mt-2">
                    <small className="text-muted">Checking for conflicts...</small>
                  </div>
                )}

                {wwpnConflicts.length > 0 && (
                  <div className="mt-3">
                    <h6 className="text-warning">⚠️ Conflicts Detected:</h6>
                    <div className="list-group list-group-flush">
                      {wwpnConflicts.map((conflict, index) => (
                        <div key={index} className={`list-group-item ${
                          conflict.alignment === 'matched' ? 'list-group-item-success' :
                          conflict.alignment === 'available' ? 'list-group-item-info' :
                          'list-group-item-warning'
                        }`}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <strong>
                                {conflict.type === 'alias' ? `Alias: ${conflict.alias_name}` : 
                                 `Host: ${conflict.host_name}`}
                              </strong>
                              <br />
                              <small>{conflict.message}</small>
                              {conflict.type === 'alias' && conflict.fabric_name && (
                                <><br /><small className="text-muted">Fabric: {conflict.fabric_name}</small></>
                              )}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              {conflict.alignment === 'available' && conflict.type === 'alias' && (
                                <button 
                                  className="btn btn-sm btn-primary"
                                  onClick={() => assignHostToAlias(conflict.alias_id, wwpnModalData.hostId)}
                                  title="Assign this host to the alias"
                                >
                                  Assign to Host
                                </button>
                              )}
                              <span className={`badge ${
                                conflict.alignment === 'matched' ? 'bg-success' :
                                conflict.alignment === 'available' ? 'bg-info' :
                                'bg-warning text-dark'
                              }`}>
                                {conflict.alignment}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowWwpnModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* WWPN Reconciliation Modal */}
      <Modal show={showReconcileModal} onHide={() => setShowReconcileModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>WWPN Reconciliation for {reconcileData?.hostName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reconcileData?.matches && reconcileData.matches.length > 0 ? (
            <div>
              <p className="mb-3">
                The following manual WWPNs on this host match available aliases in the active project:
              </p>
              {reconcileData.matches.map((match, matchIndex) => (
                <div key={matchIndex}>
                  {match.matching_aliases.map((alias, aliasIndex) => (
                    <div key={`${matchIndex}-${aliasIndex}`} className="border rounded p-3 mb-3">
                      <div className="row">
                        <div className="col-md-6">
                          <strong>WWPN:</strong> <code>{match.wwpn}</code>
                          <br />
                          <small className="text-muted">Currently: Manual assignment</small>
                        </div>
                        <div className="col-md-6">
                          <strong>Matching Alias:</strong> {alias.name}
                          <br />
                          <small className="text-muted">Fabric: {alias.fabric_name}</small>
                          {alias.use && (
                            <div>
                              <small className="text-muted">Use: {alias.use}</small>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button
                          variant="success"
                          size="sm"
                          className="me-2"
                          onClick={() => handleAcceptMatch({
                            wwpn: match.wwpn,
                            alias_id: alias.id,
                            alias_name: alias.name,
                            fabric_name: alias.fabric_name,
                            host_wwpn_id: match.host_wwpn_id
                          })}
                        >
                          Accept Match
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleRejectMatch({
                            wwpn: match.wwpn,
                            host_wwpn_id: match.host_wwpn_id
                          })}
                        >
                          Keep Manual
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p>No WWPN matches found for reconciliation.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReconcileModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* WWPN Status Details Modal */}
      <Modal show={showWwpnStatusModal} onHide={handleWwpnStatusModalClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>WWPN Details for {wwpnStatusData?.hostName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {wwpnStatusData?.wwpnDetails && wwpnStatusData.wwpnDetails.length > 0 ? (
            <div>
              <div className="mb-3">
                <strong>Status:</strong> {getStatusDescription(wwpnStatusData.statusLevel, wwpnStatusData.wwpnDetails)}
              </div>
              
              {/* Existing Alias Relationships */}
              {wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'alias').length > 0 && (
                <div className="mb-4">
                  <h6 className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Matched Aliases ({wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'alias').length})
                  </h6>
                  {wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'alias').map((wwpn, index) => (
                    <div key={`alias-${index}`} className="border border-success rounded p-3 mb-2 bg-light">
                      <div className="row">
                        <div className="col-md-6">
                          <strong>WWPN:</strong> <code>{wwpn.wwpn}</code>
                          <br />
                          <span className="badge bg-success mt-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            From Alias
                          </span>
                        </div>
                        <div className="col-md-6">
                          <strong>Alias:</strong> {wwpn.source_alias}
                          <br />
                          {wwpn.source_fabric_name && (
                            <div>
                              <small className="text-muted">Fabric: {wwpn.source_fabric_name}</small>
                              <br />
                            </div>
                          )}
                          <small className="text-muted">Automatically synchronized</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Manual WWPNs (only show if no matches available) */}
              {wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'manual').length > 0 && 
               (!wwpnStatusData.reconciliationData?.matches || wwpnStatusData.reconciliationData.matches.length === 0) && (
                <div className="mb-4">
                  <h6 className="text-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Manual WWPNs ({wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'manual').length})
                  </h6>
                  {wwpnStatusData.wwpnDetails.filter(w => w.source_type === 'manual').map((wwpn, index) => (
                    <div key={`manual-${index}`} className="border border-warning rounded p-3 mb-2">
                      <div className="row">
                        <div className="col-md-6">
                          <strong>WWPN:</strong> <code>{wwpn.wwpn}</code>
                          <br />
                          <span className="badge bg-warning text-dark mt-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Manual
                          </span>
                        </div>
                        <div className="col-md-6">
                          <strong>Source:</strong> Manual assignment
                          <br />
                          <small className="text-muted">Manually entered WWPN</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Proposed Matches (for mixed states) */}
              {wwpnStatusData.reconciliationData?.matches && wwpnStatusData.reconciliationData.matches.length > 0 && (
                <div className="mb-4">
                  <h6 className="text-primary">🎯 Available Matches</h6>
                  <p className="text-muted small">These manual WWPNs match available aliases in the active project:</p>
                  {wwpnStatusData.reconciliationData.matches.map((match, matchIndex) => (
                    <div key={matchIndex}>
                      {match.matching_aliases.map((alias, aliasIndex) => (
                        <div key={`${matchIndex}-${aliasIndex}`} className="border border-primary rounded p-3 mb-2 bg-light">
                          <div className="row">
                            <div className="col-md-6">
                              <strong>WWPN:</strong> <code>{match.wwpn}</code>
                              <br />
                              <span className="badge bg-primary mt-1">🎯 Match Available</span>
                            </div>
                            <div className="col-md-6">
                              <strong>Matching Alias:</strong> {alias.name}
                              <br />
                              <small className="text-muted">Fabric: {alias.fabric_name}</small>
                              {alias.use && (
                                <div>
                                  <small className="text-muted">Use: {alias.use}</small>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <Button
                              variant="success"
                              size="sm"
                              className="me-2"
                              onClick={() => {
                                handleAcceptMatch({
                                  wwpn: match.wwpn,
                                  alias_id: alias.id,
                                  alias_name: alias.name,
                                  fabric_name: alias.fabric_name,
                                  host_wwpn_id: match.host_wwpn_id
                                }, wwpnStatusData.hostId, wwpnStatusData.hostName);
                              }}
                            >
                              Accept Match
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Status Messages */}
              {wwpnStatusData.statusLevel === 'all_matched' && (
                <div className="alert alert-success mt-3">
                  <strong>✅ All Good!</strong> All WWPNs are properly matched to aliases. No manual intervention needed.
                </div>
              )}
              
              {wwpnStatusData.statusLevel === 'matches_available' && (
                <div className="alert alert-warning mt-3">
                  <strong>🎯 Matches Available!</strong> Some manual WWPNs can be matched to available aliases. Review and accept matches above.
                </div>
              )}
              
              {wwpnStatusData.statusLevel === 'no_matches' && (
                <div className="alert alert-warning mt-3">
                  <strong>⚠️ Manual WWPNs Found!</strong> These WWPNs were manually assigned and don't match any available aliases in the active project.
                </div>
              )}
              
              {wwpnStatusData.statusLevel === 'mixed_no_matches' && (
                <div className="alert alert-info mt-3">
                  <strong>🔄 Mixed WWPN Status!</strong> This host has both matched aliases and manual WWPNs with no available matches.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p>No WWPNs assigned to this host.</p>
              <small className="text-muted">You can add WWPNs by clicking the WWPN cell in the table.</small>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleWwpnStatusModalClose}>
            Close
          </Button>
          
          {/* Accept All Matches button - only show when matches are available */}
          {wwpnStatusData?.reconciliationData?.matches && wwpnStatusData.reconciliationData.matches.length > 0 && (
            <Button 
              variant="success" 
              onClick={handleAcceptAllMatches}
            >
              Accept All Matches ({wwpnStatusData.reconciliationData.matches.reduce((total, match) => total + match.matching_aliases.length, 0)})
            </Button>
          )}
          
          {(wwpnStatusData?.statusLevel === 'no_matches' || wwpnStatusData?.statusLevel === 'mixed_no_matches' || wwpnStatusData?.statusLevel === 'matches_available') && (
            <Button 
              variant="primary" 
              onClick={() => {
                setShowWwpnStatusModal(false);
                handleWwpnReconciliation(wwpnStatusData.hostId, wwpnStatusData.hostName);
              }}
            >
              {wwpnStatusData?.statusLevel === 'matches_available' ? 'Open Reconciliation' : 'Check for Matches'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Bulk Reconciliation Modal */}
      <Modal show={showBulkReconcileModal} onHide={() => setShowBulkReconcileModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c0 1.66-.41 3.22-1.14 4.58-.73 1.36-1.85 2.42-3.29 3.1C14.93 20.36 13.5 20.5 12 20.5s-2.93-.14-4.57-.82c-1.44-.68-2.56-1.74-3.29-3.10C3.41 15.22 3 13.66 3 12s.41-3.22 1.14-4.58c.73-1.36 1.85-2.42 3.29-3.10C9.07 3.64 10.5 3.5 12 3.5s2.93.14 4.57.82c1.44.68 2.56 1.74 3.29 3.10C20.59 8.78 21 10.34 21 12z"/>
              </svg>
              Bulk Accept Alias Matches
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {bulkReconcileData.length > 0 ? (
            <div>
              <div style={{ 
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  Bulk Reconciliation
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#6b7280',
                  lineHeight: '1.5'
                }}>
                  Found {bulkReconcileData.length} host{bulkReconcileData.length !== 1 ? 's' : ''} with available alias matches. 
                  Select which hosts to process and click "Accept Selected" or "Accept All" to assign hosts to their matching aliases.
                </div>
              </div>

              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                {bulkReconcileData.map((host, index) => (
                  <div key={host.id} style={{
                    padding: '1rem',
                    borderBottom: index < bulkReconcileData.length - 1 ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: selectedHosts.has(host.id) ? '#f0f9ff' : '#fff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedHosts.has(host.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedHosts);
                          if (e.target.checked) {
                            newSelected.add(host.id);
                          } else {
                            newSelected.delete(host.id);
                          }
                          setSelectedHosts(newSelected);
                        }}
                        style={{ 
                          margin: '4px 0',
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          color: '#374151',
                          marginBottom: '8px'
                        }}>
                          {host.name}
                        </div>
                        
                        {host.reconciliationData?.matches && host.reconciliationData.matches.length > 0 && (
                          <div>
                            <div style={{ 
                              fontSize: '14px', 
                              color: '#6b7280',
                              marginBottom: '8px'
                            }}>
                              Available matches ({host.reconciliationData.matches.reduce((total, match) => total + match.matching_aliases.length, 0)} total):
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {host.reconciliationData.matches.map((match, matchIndex) => 
                                match.matching_aliases.map((alias, aliasIndex) => (
                                  <div key={`${matchIndex}-${aliasIndex}`} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    backgroundColor: '#e0f2fe',
                                    border: '1px solid #0284c7',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#0c4a6e'
                                  }}>
                                    <code style={{ backgroundColor: 'transparent' }}>{match.wwpn}</code>
                                    <span>→</span>
                                    <span>{alias.name}</span>
                                    {alias.fabric_name && (
                                      <span style={{ color: '#6b7280' }}>({alias.fabric_name})</span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 1rem' }}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12l2 2 4-4"/>
              </svg>
              <p>No hosts with available alias matches found.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280',
            lineHeight: '1.4',
            flex: 1,
            textAlign: 'left'
          }}>
            {selectedHosts.size > 0 ? (
              <span><strong>{selectedHosts.size}</strong> host{selectedHosts.size !== 1 ? 's' : ''} selected</span>
            ) : (
              <span>Select hosts to process</span>
            )}
          </div>
          <Button variant="secondary" onClick={() => setShowBulkReconcileModal(false)}>
            Cancel
          </Button>
          {bulkReconcileData.length > 0 && (
            <>
              <Button 
                variant="success" 
                onClick={() => handleBulkAcceptSelected()}
                disabled={selectedHosts.size === 0}
                style={{ marginLeft: '8px' }}
              >
                Accept Selected ({selectedHosts.size})
              </Button>
              <Button 
                variant="warning" 
                onClick={() => handleBulkAcceptAll()}
                style={{ marginLeft: '8px' }}
              >
                Accept All ({bulkReconcileData.length})
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* WWPN Deletion Confirmation Modal */}
      <Modal show={showDeletionModal} onHide={handleDeletionCancel} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Confirm WWPN Deletion
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deletionData && (
            <div>
              <div style={{ 
                padding: '1rem',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #f59e0b'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#92400e',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Warning: This action cannot be undone
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#92400e',
                  lineHeight: '1.5'
                }}>
                  {deletionData.isMultiHost ? (
                    <>You are about to delete WWPNs from <strong>{deletionData.hosts.length} hosts</strong>. 
                    Manual WWPNs will be removed permanently, and alias WWPNs will be unassigned from their hosts.</>
                  ) : (
                    <>You are about to delete WWPNs from host <strong>{deletionData.hostName}</strong>. 
                    Manual WWPNs will be removed permanently, and alias WWPNs will be unassigned from this host.</>
                  )}
                </div>
              </div>

              {deletionData.isMultiHost ? (
                // Multi-host view
                <div style={{ marginBottom: '1rem' }}>
                  <h6 style={{ color: '#374151', marginBottom: '0.5rem' }}>
                    WWPNs to delete from {deletionData.hosts.length} hosts ({deletionData.totalWwpns} total):
                  </h6>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#f9fafb'
                  }}>
                    {deletionData.hosts.map((hostData, hostIndex) => (
                      <div key={hostData.hostId} style={{
                        borderBottom: hostIndex < deletionData.hosts.length - 1 ? '1px solid #e5e7eb' : 'none'
                      }}>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f3f4f6',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                          {hostData.hostName} ({hostData.wwpnsToDelete.length} WWPNs)
                        </div>
                        {hostData.wwpnsToDelete.map((wwpn, wwpnIndex) => (
                          <div key={wwpnIndex} style={{
                            padding: '8px 12px 8px 40px',
                            borderBottom: wwpnIndex < hostData.wwpnsToDelete.length - 1 ? '1px solid #f3f4f6' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <code style={{ 
                              backgroundColor: 'transparent',
                              color: '#374151',
                              fontFamily: 'monospace',
                              fontSize: '13px'
                            }}>
                              {wwpn}
                            </code>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Single host view
                <div style={{ marginBottom: '1rem' }}>
                  <h6 style={{ color: '#374151', marginBottom: '0.5rem' }}>
                    WWPNs to delete ({deletionData.wwpnsToDelete.length}):
                  </h6>
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#f9fafb'
                  }}>
                    {deletionData.wwpnsToDelete.map((wwpn, index) => (
                      <div key={index} style={{
                        padding: '8px 12px',
                        borderBottom: index < deletionData.wwpnsToDelete.length - 1 ? '1px solid #e5e7eb' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <code style={{ 
                          backgroundColor: 'transparent',
                          color: '#374151',
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }}>
                          {wwpn}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db'
              }}>
                <strong>What will happen:</strong>
                <ul style={{ marginBottom: 0, marginTop: '4px', paddingLeft: '16px' }}>
                  <li><strong>Manual WWPNs:</strong> Will be permanently removed from {deletionData.isMultiHost ? 'their hosts' : 'the host'}</li>
                  <li><strong>Alias WWPNs:</strong> Will be unassigned from {deletionData.isMultiHost ? 'their hosts' : 'the host'} (aliases remain available)</li>
                </ul>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <Button variant="secondary" onClick={handleDeletionCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeletionConfirm}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            Delete WWPNs ({deletionData?.isMultiHost ? deletionData?.totalWwpns || 0 : deletionData?.wwpnsToDelete?.length || 0})
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HostTable;