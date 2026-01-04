import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import StorageSelector from './StorageSelector';
import PortColumn from './PortColumn';
import ConnectionLines from './ConnectionLines';
import PPRCConfigPanel from './PPRCConfigPanel';
import '../../styles/pprc-paths.css';

/**
 * PPRCPathEditor - Visual interface for managing PPRC paths between DS8000 storage systems
 *
 * Features:
 * - Two storage system selectors (left and right)
 * - Displays FC ports with use='replication' or 'both'
 * - Drag and drop to create connections
 * - SVG lines show existing paths
 * - Click to delete paths
 * - Replication groups with LSS configuration
 * - Fabric validation toggle
 */
const PPRCPathEditor = ({ storageId, storageName, customerId }) => {
  const API_URL = process.env.REACT_APP_API_URL || '';
  const editorRef = useRef(null);

  // State for storage systems
  const [ds8000Systems, setDs8000Systems] = useState([]);
  const [leftStorageId, setLeftStorageId] = useState(storageId);
  const [rightStorageId, setRightStorageId] = useState(null);

  // State for ports
  const [leftPorts, setLeftPorts] = useState([]);
  const [rightPorts, setRightPorts] = useState([]);

  // State for PPRC paths
  const [paths, setPaths] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Port element refs for SVG line positioning (use ref to avoid re-renders during drag)
  const portRefsMap = useRef({});
  const [portRefsVersion, setPortRefsVersion] = useState(0);

  // Config panel state
  const [showFabrics, setShowFabrics] = useState(false);
  const [replicationGroups, setReplicationGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [availableLss, setAvailableLss] = useState([]);

  // Predefined palette of 8 distinct, visually different colors for fabrics
  // Avoiding red as it looks like an error state
  const FABRIC_COLOR_PALETTE = [
    '#0d6efd', // Blue
    '#198754', // Green
    '#fd7e14', // Orange
    '#6f42c1', // Purple
    '#20c997', // Teal
    '#0dcaf0', // Cyan
    '#e83e8c', // Pink
    '#6c757d', // Gray
  ];

  // Generate consistent fabric colors from all ports
  const fabricColors = useMemo(() => {
    const allPorts = [...leftPorts, ...rightPorts];
    const colors = {};
    const uniqueFabrics = [...new Set(allPorts.map(p => p.fabric_name).filter(Boolean))].sort();

    uniqueFabrics.forEach((fabricName, index) => {
      if (index < FABRIC_COLOR_PALETTE.length) {
        // Use predefined palette for first 8 fabrics
        colors[fabricName] = FABRIC_COLOR_PALETTE[index];
      } else {
        // Fallback to hash-based color for additional fabrics
        let hash = 0;
        for (let i = 0; i < fabricName.length; i++) {
          hash = fabricName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        colors[fabricName] = `hsl(${hue}, 65%, 45%)`;
      }
    });

    return colors;
  }, [leftPorts, rightPorts]);

  // Get LSS mode from active group
  const lssMode = activeGroup?.lss_mode || 'all';

  // Get selected LSS mappings from active group
  const selectedLssMappings = activeGroup?.lss_mappings || [];

  // Get disabled LSSs (assigned to other groups)
  const disabledLss = useMemo(() => {
    if (!activeGroup) return [];
    return availableLss
      .filter(lss => lss.assigned_to_group && lss.assigned_to_group !== activeGroup.id)
      .map(lss => lss.lss);
  }, [availableLss, activeGroup]);

  // Can add group only if Group 1 is in custom mode (not all, even, or odd)
  const canAddGroup = useMemo(() => {
    const group1 = replicationGroups.find(g => g.group_number === 1);
    // Can only add groups when Group 1 is in custom mode
    // Even/odd mode automatically manages Groups 1 and 2
    return group1?.lss_mode === 'custom';
  }, [replicationGroups]);

  // Fetch DS8000 storage systems for this customer
  useEffect(() => {
    const fetchStorageSystems = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/storage/pprc-paths/ds8000-storages/?customer=${customerId}`
        );
        setDs8000Systems(response.data.results || []);

        // Set right storage to a different system if available
        const otherSystems = (response.data.results || []).filter(s => s.id !== storageId);
        if (otherSystems.length > 0 && !rightStorageId) {
          setRightStorageId(otherSystems[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch DS8000 systems:', err);
        setError('Failed to load DS8000 storage systems');
      }
    };

    if (customerId) {
      fetchStorageSystems();
    }
  }, [customerId, storageId, API_URL, rightStorageId]);

  // Fetch ports for left storage
  useEffect(() => {
    const fetchLeftPorts = async () => {
      if (!leftStorageId) {
        setLeftPorts([]);
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/api/storage/${leftStorageId}/pprc-paths/available-ports/`
        );
        const systems = response.data.storage_systems || [];
        const system = systems.find(s => s.storage_id === leftStorageId);
        setLeftPorts(system?.ports || []);
      } catch (err) {
        console.error('Failed to fetch left ports:', err);
      }
    };

    fetchLeftPorts();
  }, [leftStorageId, API_URL]);

  // Fetch ports for right storage
  useEffect(() => {
    const fetchRightPorts = async () => {
      if (!rightStorageId) {
        setRightPorts([]);
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/api/storage/${rightStorageId}/pprc-paths/available-ports/`
        );
        const systems = response.data.storage_systems || [];
        const system = systems.find(s => s.storage_id === rightStorageId);
        setRightPorts(system?.ports || []);
      } catch (err) {
        console.error('Failed to fetch right ports:', err);
      }
    };

    fetchRightPorts();
  }, [rightStorageId, API_URL]);

  // Fetch replication groups for storage pair, auto-create Group 1 if none exist
  const fetchGroups = useCallback(async () => {
    if (!leftStorageId || !rightStorageId) {
      setReplicationGroups([]);
      setActiveGroup(null);
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/storage/${leftStorageId}/pprc-groups/?target_storage=${rightStorageId}`
      );
      let groups = response.data.results || [];

      // Auto-create Group 1 with "All LSSs" if no groups exist
      if (groups.length === 0) {
        try {
          const createResponse = await axios.post(
            `${API_URL}/api/storage/${leftStorageId}/pprc-groups/`,
            {
              target_storage: rightStorageId,
              lss_mode: 'all',
              group_number: 1,
            }
          );
          groups = [createResponse.data];
        } catch (createErr) {
          console.error('Failed to auto-create Group 1:', createErr);
        }
      }

      setReplicationGroups(groups);

      // Preserve currently active group if it still exists, otherwise default to Group 1
      setActiveGroup(prevActive => {
        if (groups.length === 0) return null;

        // If there's a currently active group, find it in the updated list
        if (prevActive) {
          const stillExists = groups.find(g => g.id === prevActive.id);
          if (stillExists) return stillExists; // Return updated version of same group
        }

        // Fall back to Group 1 or first group
        const group1 = groups.find(g => g.group_number === 1);
        return group1 || groups[0];
      });
    } catch (err) {
      console.error('Failed to fetch replication groups:', err);
    }
  }, [leftStorageId, rightStorageId, API_URL]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch available LSSs for source storage
  const fetchAvailableLss = useCallback(async () => {
    if (!leftStorageId || !rightStorageId) {
      setAvailableLss([]);
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/storage/${leftStorageId}/pprc-groups/available-lss/?target_storage=${rightStorageId}`
      );
      setAvailableLss(response.data.results || []);
    } catch (err) {
      console.error('Failed to fetch available LSSs:', err);
    }
  }, [leftStorageId, rightStorageId, API_URL]);

  useEffect(() => {
    fetchAvailableLss();
  }, [fetchAvailableLss]);

  // Fetch existing PPRC paths
  const fetchPaths = useCallback(async () => {
    if (!leftStorageId) return;

    try {
      setLoading(true);
      // Build query params - filter by target storage and active group
      const params = new URLSearchParams();
      if (rightStorageId) {
        params.append('target_storage', rightStorageId);
      }
      if (activeGroup?.id) {
        params.append('replication_group', activeGroup.id);
      }
      const queryString = params.toString();
      const url = `${API_URL}/api/storage/${leftStorageId}/pprc-paths/${queryString ? `?${queryString}` : ''}`;

      const response = await axios.get(url);
      setPaths(response.data.results || []);
    } catch (err) {
      console.error('Failed to fetch PPRC paths:', err);
      setError('Failed to load PPRC paths');
    } finally {
      setLoading(false);
    }
  }, [leftStorageId, rightStorageId, activeGroup, API_URL]);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  // Handle creating a new path
  const handleCreatePath = async (sourcePortId, targetPortId) => {
    if (sourcePortId === targetPortId) return;

    // Require an active replication group
    if (!activeGroup) {
      setError('Cannot create path without a replication group');
      return;
    }

    // Check if path already exists
    const exists = paths.some(p =>
      (p.port1 === sourcePortId && p.port2 === targetPortId) ||
      (p.port1 === targetPortId && p.port2 === sourcePortId)
    );

    if (exists) {
      return; // Path already exists
    }

    // Fabric validation if enabled
    if (showFabrics) {
      const sourcePort = [...leftPorts, ...rightPorts].find(p => p.id === sourcePortId);
      const targetPort = [...leftPorts, ...rightPorts].find(p => p.id === targetPortId);

      if (sourcePort?.fabric_id && targetPort?.fabric_id &&
          sourcePort.fabric_id !== targetPort.fabric_id) {
        setError('Cannot create path between ports in different fabrics');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        port1: sourcePortId,
        port2: targetPortId,
        replication_group: activeGroup.id,
      };

      await axios.post(
        `${API_URL}/api/storage/${leftStorageId}/pprc-paths/`,
        payload
      );
      await fetchPaths(); // Refresh paths
    } catch (err) {
      console.error('Failed to create PPRC path:', err);
      setError(err.response?.data?.error || 'Failed to create path');
    } finally {
      setSaving(false);
    }
  };

  // Handle deleting a path
  const handleDeletePath = async (pathId) => {
    if (!window.confirm('Delete this PPRC path?')) return;

    try {
      setSaving(true);
      await axios.delete(`${API_URL}/api/storage/pprc-paths/${pathId}/`);
      await fetchPaths(); // Refresh paths
    } catch (err) {
      console.error('Failed to delete PPRC path:', err);
      setError(err.response?.data?.error || 'Failed to delete path');
    } finally {
      setSaving(false);
    }
  };

  // Handle creating a new replication group
  const handleCreateGroup = async () => {
    if (!rightStorageId) return;

    try {
      setSaving(true);
      await axios.post(
        `${API_URL}/api/storage/${leftStorageId}/pprc-groups/`,
        {
          target_storage: rightStorageId,
          lss_mode: 'custom',
        }
      );
      await fetchGroups();
    } catch (err) {
      console.error('Failed to create replication group:', err);
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  // Handle deleting a replication group
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this replication group? All paths in this group will be unassigned.')) return;

    try {
      setSaving(true);
      await axios.delete(`${API_URL}/api/storage/pprc-groups/${groupId}/`);
      await fetchGroups();
      await fetchPaths();
    } catch (err) {
      console.error('Failed to delete replication group:', err);
      setError(err.response?.data?.error || 'Failed to delete group');
    } finally {
      setSaving(false);
    }
  };

  // Handle changing LSS mode for active group
  const handleChangeLssMode = async (newMode) => {
    if (!activeGroup) return;

    try {
      setSaving(true);

      // Update the active group's mode
      await axios.put(
        `${API_URL}/api/storage/pprc-groups/${activeGroup.id}/`,
        { lss_mode: newMode }
      );

      // If resetting from even/odd to all, also reset Group 2 if it's in 'odd' mode
      if (newMode === 'all' && activeGroup.group_number === 1) {
        const group2 = replicationGroups.find(g => g.group_number === 2 && g.lss_mode === 'odd');
        if (group2) {
          // Delete Group 2 since we're going back to "All LSSs" mode
          await axios.delete(`${API_URL}/api/storage/pprc-groups/${group2.id}/`);
        }
      }

      await fetchGroups();
    } catch (err) {
      console.error('Failed to update LSS mode:', err);
      setError(err.response?.data?.error || 'Failed to update LSS mode');
    } finally {
      setSaving(false);
    }
  };

  // Handle setting up Even/Odd LSS split
  // Group 1 gets even LSSs (00, 02, 04...), Group 2 gets odd LSSs (01, 03, 05...)
  const handleSetupEvenOdd = async () => {
    if (!rightStorageId || !activeGroup) return;

    // Find Group 1
    const group1 = replicationGroups.find(g => g.group_number === 1);
    if (!group1) return;

    try {
      setSaving(true);

      // Step 1: Update Group 1 to 'even' mode
      await axios.put(
        `${API_URL}/api/storage/pprc-groups/${group1.id}/`,
        { lss_mode: 'even' }
      );

      // Step 2: Check if Group 2 already exists
      const group2 = replicationGroups.find(g => g.group_number === 2);

      if (group2) {
        // Update existing Group 2 to 'odd' mode
        await axios.put(
          `${API_URL}/api/storage/pprc-groups/${group2.id}/`,
          { lss_mode: 'odd' }
        );
      } else {
        // Create Group 2 with 'odd' mode
        await axios.post(
          `${API_URL}/api/storage/${leftStorageId}/pprc-groups/`,
          {
            target_storage: rightStorageId,
            lss_mode: 'odd',
            group_number: 2,
          }
        );
      }

      await fetchGroups();
    } catch (err) {
      console.error('Failed to setup Even/Odd split:', err);
      setError(err.response?.data?.error || 'Failed to setup Even/Odd split');
    } finally {
      setSaving(false);
    }
  };

  // Handle adding LSS mapping
  const handleAddLssMapping = async (sourceLss, targetLss) => {
    if (!activeGroup) return;

    try {
      setSaving(true);
      await axios.post(
        `${API_URL}/api/storage/pprc-groups/${activeGroup.id}/lss-mappings/`,
        {
          source_lss: sourceLss,
          target_lss: targetLss,
        }
      );
      await fetchGroups();
      await fetchAvailableLss();
    } catch (err) {
      console.error('Failed to add LSS mapping:', err);
      setError(err.response?.data?.error || 'Failed to add LSS mapping');
    } finally {
      setSaving(false);
    }
  };

  // Handle removing LSS mapping
  const handleRemoveLssMapping = async (mappingId) => {
    try {
      setSaving(true);
      await axios.delete(`${API_URL}/api/storage/pprc-groups/lss-mappings/${mappingId}/`);
      await fetchGroups();
      await fetchAvailableLss();
    } catch (err) {
      console.error('Failed to remove LSS mapping:', err);
      setError(err.response?.data?.error || 'Failed to remove LSS mapping');
    } finally {
      setSaving(false);
    }
  };

  // Register port element ref (doesn't trigger re-render during drag)
  const registerPortRef = useCallback((portId, element) => {
    if (element) {
      portRefsMap.current[portId] = element;
    } else {
      delete portRefsMap.current[portId];
    }
    // Trigger line recalculation after refs settle
    setPortRefsVersion(v => v + 1);
  }, []);

  // Get paths that involve the currently selected storages
  const visiblePaths = paths.filter(path => {
    const port1StorageId = path.port1_details?.storage_id;
    const port2StorageId = path.port2_details?.storage_id;

    // Show path if both ports are from selected storages
    return (
      (port1StorageId === leftStorageId && port2StorageId === rightStorageId) ||
      (port1StorageId === rightStorageId && port2StorageId === leftStorageId) ||
      // Also show intra-storage paths if same storage selected on both sides
      (leftStorageId === rightStorageId && port1StorageId === leftStorageId && port2StorageId === leftStorageId)
    );
  });

  if (loading && paths.length === 0) {
    return <div className="pprc-paths-container">Loading PPRC paths...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="pprc-paths-container">
        <div className="pprc-paths-header">
          <h4>PPRC Paths</h4>
          <p className="text-muted">
            Drag from a port on one storage system to a port on another to create a PPRC path.
            Click on a connection line to delete it.
          </p>
          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {typeof error === 'object' ? JSON.stringify(error) : error}
              <button
                type="button"
                className="btn-close"
                onClick={() => setError(null)}
                aria-label="Close"
              ></button>
            </div>
          )}
        </div>

        {/* Configuration Panel */}
        <PPRCConfigPanel
          showFabrics={showFabrics}
          onToggleFabrics={setShowFabrics}
          fabricColors={fabricColors}
          replicationGroups={replicationGroups}
          activeGroup={activeGroup}
          onSelectGroup={setActiveGroup}
          onCreateGroup={handleCreateGroup}
          onDeleteGroup={handleDeleteGroup}
          lssMode={lssMode}
          onChangeLssMode={handleChangeLssMode}
          onSetupEvenOdd={handleSetupEvenOdd}
          availableLss={availableLss}
          selectedLssMappings={selectedLssMappings}
          onAddLssMapping={handleAddLssMapping}
          onRemoveLssMapping={handleRemoveLssMapping}
          disabledLss={disabledLss}
          canAddGroup={canAddGroup}
          loading={saving}
        />

        <div className="pprc-paths-editor" ref={editorRef}>
          {/* Left Storage Column - Fixed to current storage */}
          <div className="pprc-column pprc-column-left">
            <div className="pprc-storage-selector">
              <label className="pprc-selector-label">Source Storage</label>
              <div className="pprc-storage-fixed">
                {storageName}
              </div>
            </div>
            <PortColumn
              ports={leftPorts}
              side="left"
              onCreatePath={handleCreatePath}
              registerPortRef={registerPortRef}
              connectedPortIds={visiblePaths.flatMap(p => [p.port1, p.port2])}
              showFabric={showFabrics}
              fabricColors={fabricColors}
            />
          </div>

          {/* Connection Lines SVG Overlay */}
          <ConnectionLines
            paths={visiblePaths}
            portRefs={portRefsMap.current}
            portRefsVersion={portRefsVersion}
            containerRef={editorRef}
            onDeletePath={handleDeletePath}
            leftStorageId={leftStorageId}
            rightStorageId={rightStorageId}
            showFabrics={showFabrics}
          />

          {/* Right Storage Column */}
          <div className="pprc-column pprc-column-right">
            <StorageSelector
              label="Target Storage"
              value={rightStorageId}
              onChange={setRightStorageId}
              options={ds8000Systems}
              excludeId={null}
            />
            <PortColumn
              ports={rightPorts}
              side="right"
              onCreatePath={handleCreatePath}
              registerPortRef={registerPortRef}
              connectedPortIds={visiblePaths.flatMap(p => [p.port1, p.port2])}
              showFabric={showFabrics}
              fabricColors={fabricColors}
            />
          </div>
        </div>

        {saving && (
          <div className="pprc-saving-indicator">
            Saving...
          </div>
        )}

        {/* Path Statistics */}
        <div className="pprc-stats">
          <span className="badge bg-secondary me-2">
            {visiblePaths.length} path{visiblePaths.length !== 1 ? 's' : ''} shown
          </span>
          <span className="badge bg-info">
            {paths.length} total path{paths.length !== 1 ? 's' : ''} for this storage
          </span>
          {activeGroup && (
            <span className="badge bg-primary ms-2">
              Group {activeGroup.group_number}
              {activeGroup.lss_mode === 'all' ? ' (All LSSs)' : ` (${selectedLssMappings.length} LSSs)`}
            </span>
          )}
        </div>
      </div>
    </DndProvider>
  );
};

export default PPRCPathEditor;
