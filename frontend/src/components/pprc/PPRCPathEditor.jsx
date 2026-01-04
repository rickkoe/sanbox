import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import StorageSelector from './StorageSelector';
import PortColumn from './PortColumn';
import ConnectionLines from './ConnectionLines';
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

  // Fetch existing PPRC paths
  const fetchPaths = useCallback(async () => {
    if (!leftStorageId) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/storage/${leftStorageId}/pprc-paths/`
      );
      setPaths(response.data.results || []);
    } catch (err) {
      console.error('Failed to fetch PPRC paths:', err);
      setError('Failed to load PPRC paths');
    } finally {
      setLoading(false);
    }
  }, [leftStorageId, API_URL]);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  // Handle creating a new path
  const handleCreatePath = async (sourcePortId, targetPortId) => {
    if (sourcePortId === targetPortId) return;

    // Check if path already exists
    const exists = paths.some(p =>
      (p.port1 === sourcePortId && p.port2 === targetPortId) ||
      (p.port1 === targetPortId && p.port2 === sourcePortId)
    );

    if (exists) {
      return; // Path already exists
    }

    try {
      setSaving(true);
      await axios.post(
        `${API_URL}/api/storage/${leftStorageId}/pprc-paths/`,
        {
          port1: sourcePortId,
          port2: targetPortId,
        }
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
        </div>
      </div>
    </DndProvider>
  );
};

export default PPRCPathEditor;
