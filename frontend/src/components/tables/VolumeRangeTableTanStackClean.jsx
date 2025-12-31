import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";
import { Plus, AlertTriangle } from "lucide-react";
import CreateVolumeRangeModal from "../modals/CreateVolumeRangeModal";
import { Modal, Button } from "react-bootstrap";
import "../../styles/storagepage.css";

/**
 * VolumeRangeTableTanStackClean - TanStack table for DS8000 Volume Ranges
 *
 * This component displays volume ranges in a table format with inline editing support.
 * Volume ranges are calculated/aggregated from individual Volume records, so save/delete
 * operations work differently than standard CRUD tables.
 *
 * Props:
 * - storageId: Required - ID of the DS8000 storage system
 * - storageName: Name of the storage system (for display)
 * - onRangeCreated: Callback when a range is created
 */
const VolumeRangeTableTanStackClean = ({
    storageId,
    storageName = "",
    onRangeCreated
}) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { projectFilter, loading: projectFilterLoading } = useProjectFilter();

    const tableRef = useRef(null);

    // State
    const [loading, setLoading] = useState(true);
    const [poolOptions, setPoolOptions] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Confirmation modal state for range updates that will delete volumes
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState(null);
    const [deletePreview, setDeletePreview] = useState(null);

    // Existing volumes for conflict detection and LSS locking
    const [existingVolumes, setExistingVolumes] = useState([]);
    const [loadingVolumes, setLoadingVolumes] = useState(false);

    // Validation state - tracks errors per row
    const [rowValidationErrors, setRowValidationErrors] = useState({});

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Use centralized permissions hook
    const { canEdit } = useProjectViewPermissions({
        role: config?.active_project?.user_role,
        projectFilter,
        entityName: 'volume ranges'
    });

    // Check if in Draft mode (projectFilter === 'current' means Draft/Project View)
    const isInDraftMode = projectFilter === 'current' && activeProjectId;
    const isReadOnly = !isInDraftMode || !canEdit;

    // API endpoints
    const apiUrl = useMemo(() => {
        if (projectFilterLoading || !storageId) {
            return null;
        }
        const params = new URLSearchParams();
        if (activeProjectId) {
            params.append('active_project_id', activeProjectId);
        }
        params.append('project_filter', projectFilter || 'all');
        params.append('table_format', 'true'); // Request table-compatible format
        return `${API_URL}/api/storage/${storageId}/volume-ranges/?${params.toString()}`;
    }, [API_URL, storageId, activeProjectId, projectFilter, projectFilterLoading]);

    // Load pools for dropdown
    useEffect(() => {
        const loadPools = async () => {
            if (!storageId) return;
            try {
                setLoading(true);
                // Include project context to get committed pools + pools in active project
                const params = new URLSearchParams();
                params.append('project_filter', projectFilter || 'all');
                if (activeProjectId) {
                    params.append('project_id', activeProjectId);
                }
                const response = await axios.get(`${API_URL}/api/storage/${storageId}/pools/?${params.toString()}`);
                const pools = response.data.results || response.data || [];
                setPoolOptions(pools.map(p => p.name));
                setLoading(false);
            } catch (err) {
                console.error('Error loading pools:', err);
                setPoolOptions([]);
                setLoading(false);
            }
        };
        loadPools();
    }, [API_URL, storageId, projectFilter, activeProjectId]);

    // Fetch existing volumes for conflict detection
    useEffect(() => {
        const fetchExistingVolumes = async () => {
            if (!storageId) return;
            setLoadingVolumes(true);
            try {
                const allVolumes = [];
                let page = 1;
                let hasMore = true;

                // Paginate through all volumes
                while (hasMore) {
                    let url;
                    if (activeProjectId) {
                        url = `${API_URL}/api/storage/project/${activeProjectId}/view/volumes/?project_filter=all&page_size=500&page=${page}`;
                    } else {
                        url = `${API_URL}/api/storage/volumes/?storage_id=${storageId}&page_size=500&page=${page}`;
                    }

                    const response = await axios.get(url);
                    const volumeList = response.data.results || response.data || [];
                    allVolumes.push(...volumeList);

                    hasMore = response.data.has_next || response.data.next;
                    page++;
                    if (page > 100) break; // Safety limit
                }

                // Filter to only volumes for this storage system
                const storageVolumes = allVolumes.filter(v => {
                    const volStorageId = v.storage_id || v.storage;
                    return volStorageId === storageId || volStorageId === parseInt(storageId);
                });

                // Extract volume data for validation
                // Note: API returns 'pool' (the name), not 'pool_name'
                const volumeData = storageVolumes
                    .filter(v => v.volume_id)
                    .map(v => ({
                        volume_id: v.volume_id.toUpperCase(),
                        pool_name: v.pool_name || v.pool || null,  // API returns 'pool' as the name
                        format: v.format || null,
                        capacity_bytes: v.capacity_bytes || 0,
                    }));

                setExistingVolumes(volumeData);
            } catch (err) {
                console.error('Failed to load existing volumes:', err);
                setExistingVolumes([]);
            } finally {
                setLoadingVolumes(false);
            }
        };

        fetchExistingVolumes();
    }, [API_URL, storageId, activeProjectId]);

    // Helper: Validate hex input (2 hex digits)
    const isValidHex2 = useCallback((value) => /^[0-9A-Fa-f]{2}$/.test(value), []);

    // Get LSS info (pool and format used by existing volumes in an LSS)
    const getLssInfo = useCallback((lss) => {
        if (!isValidHex2(lss)) return null;
        const lssUpper = lss.toUpperCase();
        const lssVolumes = existingVolumes.filter(
            v => v.volume_id && v.volume_id.length === 4 && v.volume_id.slice(0, 2) === lssUpper
        );
        if (lssVolumes.length === 0) return null;
        return {
            poolName: lssVolumes[0].pool_name,
            format: lssVolumes[0].format,
            volumeCount: lssVolumes.length
        };
    }, [existingVolumes, isValidHex2]);

    // Check for conflicts with existing volumes in a proposed range
    const getConflictingVolumes = useCallback((lss, startVol, endVol, excludeVolumeIds = []) => {
        if (!isValidHex2(lss) || !isValidHex2(startVol)) return null;
        const effectiveEnd = endVol === "" ? startVol : endVol;
        if (!isValidHex2(effectiveEnd)) return null;

        const startInt = parseInt(startVol, 16);
        const endInt = parseInt(effectiveEnd, 16);
        if (endInt < startInt) return null;

        const lssUpper = lss.toUpperCase();
        // Build set of existing volume IDs (excluding ones we're editing)
        const excludeSet = new Set(excludeVolumeIds.map(id => id.toUpperCase()));
        const existingIds = new Set(
            existingVolumes
                .map(v => v.volume_id)
                .filter(id => !excludeSet.has(id))
        );

        // Check each volume in the proposed range
        const conflicts = [];
        for (let i = startInt; i <= endInt; i++) {
            const volId = lssUpper + i.toString(16).toUpperCase().padStart(2, '0');
            if (existingIds.has(volId)) {
                conflicts.push(volId);
            }
        }

        return conflicts.length > 0 ? conflicts : null;
    }, [existingVolumes, isValidHex2]);

    // Validate a row and return errors
    const validateRow = useCallback((row) => {
        const errors = {};
        const { lss, start_volume, end_volume } = row;

        // Skip validation if row doesn't have required fields yet
        if (!lss && !start_volume && !end_volume) return errors;

        // For existing rows, generate the volume IDs to exclude from conflict check
        // We need hex volume IDs like "1000", "1001", not database PKs
        let excludeVolumeIds = [];
        if (!row._isNew && row._original_start && row._original_end && row.lss) {
            // Generate volume IDs from the original range
            const origStartInt = parseInt(row._original_start.slice(2), 16);
            const origEndInt = parseInt(row._original_end.slice(2), 16);
            const lssUpper = row.lss.toUpperCase();
            for (let i = origStartInt; i <= origEndInt; i++) {
                excludeVolumeIds.push(lssUpper + i.toString(16).toUpperCase().padStart(2, '0'));
            }
        }

        // Check for LSS constraints (pool/format must match existing volumes in LSS)
        if (isValidHex2(lss)) {
            const lssInfo = getLssInfo(lss);
            if (lssInfo) {
                // Check if format conflicts with LSS
                if (row.format && lssInfo.format && row.format !== lssInfo.format) {
                    errors.format = `LSS ${lss.toUpperCase()} uses ${lssInfo.format} format`;
                }
                // Check if pool conflicts with LSS
                if (row.pool_name && lssInfo.poolName && row.pool_name !== lssInfo.poolName) {
                    errors.pool_name = `LSS ${lss.toUpperCase()} uses pool ${lssInfo.poolName}`;
                }
            }
        }

        // Check for overlapping volumes
        if (isValidHex2(lss) && isValidHex2(start_volume)) {
            const conflicts = getConflictingVolumes(lss, start_volume, end_volume || start_volume, excludeVolumeIds);
            if (conflicts && conflicts.length > 0) {
                errors.start_volume = `Conflicts with existing volumes: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? '...' : ''}`;
                errors.end_volume = errors.start_volume;
                errors.conflicts = conflicts;
            }
        }

        return errors;
    }, [isValidHex2, getLssInfo, getConflictingVolumes]);

    // Column configuration
    const columns = useMemo(() => {
        return getTableColumns('volumeRange', false);
    }, []);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('volumeRange', false);
    }, []);

    const defaultSort = getDefaultSort('volumeRange');

    // Dropdown sources
    const dropdownSources = useMemo(() => ({
        format: ['FB', 'CKD'],
        pool_name: poolOptions
    }), [poolOptions]);

    // New row template
    const NEW_RANGE_TEMPLATE = useMemo(() => ({
        id: null,
        range_id: null,
        lss: "",           // 2-digit hex (00-FF)
        start_volume: "",  // 2-digit hex (00-FF)
        end_volume: "",    // 2-digit hex (00-FF)
        format: "",        // Empty - will be auto-set when LSS is entered if LSS has volumes, or user must select
        volume_count: 0,
        capacity_bytes: null,
        pool_name: "",
        name_prefix: "",   // Used to derive volume names: {name_prefix}_{volume_id}
        committed: false,
        deployed: false,
        volume_ids: [],
        _isNew: true
    }), []);

    // Format capacity for display (bytes to GiB)
    const formatCapacity = useCallback((bytes) => {
        if (!bytes && bytes !== 0) return "";
        const gib = bytes / (1024 ** 3);
        return gib.toFixed(1);
    }, []);

    // Parse capacity from display (GiB to bytes)
    const parseCapacity = useCallback((gib) => {
        if (!gib && gib !== 0) return null;
        const value = parseFloat(gib);
        if (isNaN(value)) return null;
        return Math.round(value * (1024 ** 3));
    }, []);

    // Handle cell changes for validation
    const handleCellChange = useCallback((rowIndex, columnId, value, rowData) => {
        // Build updated row data for validation
        const updatedRow = { ...rowData, [columnId]: value };

        // Get LSS info for auto-setting format and pool
        if (columnId === 'lss' && isValidHex2(value)) {
            const lssInfo = getLssInfo(value);
            if (lssInfo) {
                // Auto-set format and pool if LSS has existing volumes
                if (lssInfo.format && updatedRow.format !== lssInfo.format) {
                    updatedRow.format = lssInfo.format;
                }
                if (lssInfo.poolName && updatedRow.pool_name !== lssInfo.poolName) {
                    updatedRow.pool_name = lssInfo.poolName;
                }
            }
        }

        // Validate the row
        const errors = validateRow(updatedRow);
        const rowKey = rowData.id || rowData.range_id || `new-${rowIndex}`;

        setRowValidationErrors(prev => {
            if (Object.keys(errors).length === 0) {
                // Remove errors for this row
                const { [rowKey]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [rowKey]: errors };
        });

        // Return updated row data with auto-set values
        return updatedRow;
    }, [isValidHex2, getLssInfo, validateRow]);

    // Get cell style based on validation errors
    const getCellStyle = useCallback((rowData, columnId) => {
        const rowKey = rowData.id || rowData.range_id || `new-${rowData._rowIndex}`;
        const errors = rowValidationErrors[rowKey];

        if (errors && errors[columnId]) {
            return {
                backgroundColor: 'var(--color-danger-subtle, rgba(248, 81, 73, 0.15))',
                borderColor: 'var(--color-danger-emphasis, #da3633)',
            };
        }

        // Check if this cell should be locked (LSS constraint)
        if ((columnId === 'format' || columnId === 'pool_name') && rowData.lss && isValidHex2(rowData.lss)) {
            const lssInfo = getLssInfo(rowData.lss);
            if (lssInfo && ((columnId === 'format' && lssInfo.format) || (columnId === 'pool_name' && lssInfo.poolName))) {
                return {
                    backgroundColor: 'var(--color-attention-subtle, rgba(187, 128, 9, 0.15))',
                    fontStyle: 'italic',
                };
            }
        }

        return null;
    }, [rowValidationErrors, isValidHex2, getLssInfo]);

    // Check if a cell is locked due to LSS constraints
    const isCellLocked = useCallback((rowData, columnId) => {
        if (!rowData._isNew) return false; // Only lock for new rows
        if (columnId !== 'format' && columnId !== 'pool_name') return false;

        if (rowData.lss && isValidHex2(rowData.lss)) {
            const lssInfo = getLssInfo(rowData.lss);
            if (lssInfo) {
                if (columnId === 'format' && lssInfo.format) return true;
                if (columnId === 'pool_name' && lssInfo.poolName) return true;
            }
        }
        return false;
    }, [isValidHex2, getLssInfo]);

    // afterChange handler for real-time validation and LSS locking
    const handleAfterChange = useCallback((changes, source, hotInstance) => {
        if (!changes || changes.length === 0) return;

        // Get current table data to validate
        const currentData = tableRef.current?.getTableData?.() || [];

        // Validate each changed row
        const newErrors = { ...rowValidationErrors };

        for (const [rowIndex, columnKey, oldValue, newValue] of changes) {
            if (rowIndex < 0 || rowIndex >= currentData.length) continue;

            const rowData = currentData[rowIndex];
            if (!rowData) continue;

            // Get LSS info for this row (use newValue if LSS just changed, otherwise use rowData.lss)
            const currentLss = columnKey === 'lss' ? newValue : rowData.lss;
            const lssInfo = isValidHex2(currentLss) ? getLssInfo(currentLss) : null;

            // Handle LSS change - auto-populate format and pool
            if (columnKey === 'lss' && hotInstance) {
                if (lssInfo) {
                    // Always set format and pool to match LSS constraints
                    if (lssInfo.format) {
                        hotInstance.setDataAtRowProp(rowIndex, 'format', lssInfo.format);
                    }
                    if (lssInfo.poolName) {
                        hotInstance.setDataAtRowProp(rowIndex, 'pool_name', lssInfo.poolName);
                    }
                }
            }

            // Handle format/pool changes - revert if LSS has constraints (lock behavior)
            if ((columnKey === 'format' || columnKey === 'pool_name') && hotInstance && lssInfo) {
                if (columnKey === 'format' && lssInfo.format && newValue !== lssInfo.format) {
                    // Revert format change - LSS is locked to this format
                    hotInstance.setDataAtRowProp(rowIndex, 'format', lssInfo.format);
                }
                if (columnKey === 'pool_name' && lssInfo.poolName && newValue !== lssInfo.poolName) {
                    // Revert pool change - LSS is locked to this pool
                    hotInstance.setDataAtRowProp(rowIndex, 'pool_name', lssInfo.poolName);
                }
            }

            // Validate the row (use updated values for validation)
            const updatedRowData = { ...rowData };
            if (columnKey === 'lss' && lssInfo) {
                if (lssInfo.format) updatedRowData.format = lssInfo.format;
                if (lssInfo.poolName) updatedRowData.pool_name = lssInfo.poolName;
            }
            updatedRowData[columnKey] = newValue;

            const errors = validateRow(updatedRowData);
            const rowKey = rowData.id || rowData.range_id || `new-${rowIndex}`;

            if (Object.keys(errors).length === 0) {
                delete newErrors[rowKey];
            } else {
                newErrors[rowKey] = errors;
            }
        }

        setRowValidationErrors(newErrors);
    }, [validateRow, rowValidationErrors, isValidHex2, getLssInfo]);

    // Custom renderers
    const customRenderers = useMemo(() => ({
        capacity_bytes: (rowData, td, row, col, prop, value) => {
            // Handle both bytes (from API) and GiB (user input)
            if (!value && value !== 0) return "";
            // If value is small (< 1000000), assume it's already in GiB (user input)
            // If value is large, assume it's in bytes (from API)
            if (typeof value === 'string') {
                // User just typed a value - display as-is
                return value;
            } else if (value > 1000000) {
                // Large number = bytes from API, convert to GiB
                return formatCapacity(value);
            } else {
                // Small number = GiB input, display as-is
                return value.toString();
            }
        },
        volume_count: (rowData, td, row, col, prop, value) => {
            // For new rows, calculate count from start/end (2-digit hex)
            if (rowData._isNew && rowData.start_volume && rowData.end_volume) {
                try {
                    const start = parseInt(rowData.start_volume, 16);
                    const end = parseInt(rowData.end_volume, 16);
                    if (!isNaN(start) && !isNaN(end) && end >= start) {
                        return end - start + 1;
                    }
                } catch (e) {
                    return "";
                }
            }
            return value || "";
        }
    }), [formatCapacity]);

    // Track all data for delete operations (need full row data to get volume_ids)
    const allDataRef = useRef([]);
    // Track original data for detecting modifications
    const originalDataRef = useRef({});

    // Preprocess data from API
    const preprocessData = useCallback((data) => {
        // With table_format=true, API returns array directly in 'results'
        // TanStackCRUDTable extracts data.results, so 'data' here is already the array
        if (!Array.isArray(data)) {
            allDataRef.current = [];
            originalDataRef.current = {};
            return [];
        }
        const processed = data.map(range => {
            // API returns 4-digit volume IDs (e.g., "1000", "100F")
            // Extract the last 2 digits for display (00-FF range)
            const startVol = range.start_volume || "";
            const endVol = range.end_volume || "";
            return {
                ...range,
                // Keep original 4-digit values for reference
                _original_start: startVol,
                _original_end: endVol,
                // Display only the last 2 digits (volume address within LSS)
                start_volume: startVol.length === 4 ? startVol.substring(2, 4) : startVol,
                end_volume: endVol.length === 4 ? endVol.substring(2, 4) : endVol,
                _isNew: false
            };
        });
        // Store all data for delete operations (need volume_ids)
        allDataRef.current = processed;
        // Store original values by ID for modification detection
        originalDataRef.current = {};
        processed.forEach(range => {
            if (range.id || range.range_id) {
                const key = range.id || range.range_id;
                originalDataRef.current[key] = {
                    start_volume: range.start_volume,
                    end_volume: range.end_volume,
                    format: range.format,
                    capacity_bytes: range.capacity_bytes,
                    pool_name: range.pool_name,
                    name_prefix: range.name_prefix,
                    lss: range.lss,
                    volume_ids: range.volume_ids || [],
                    _original_start: range._original_start,
                    _original_end: range._original_end,
                };
            }
        });
        return processed;
    }, []);

    // Helper to parse capacity consistently
    const normalizeCapacity = useCallback((value) => {
        if (value === null || value === undefined || value === '') {
            return parseCapacity(50); // Default 50 GiB
        }
        if (typeof value === 'string') {
            return parseCapacity(parseFloat(value));
        } else if (value > 1000000) {
            // Already in bytes
            return value;
        } else {
            // Assume GiB
            return parseCapacity(value);
        }
    }, [parseCapacity]);

    // Execute the actual update operations (called after confirmation or directly if no confirmation needed)
    const executeUpdates = useCallback(async (updatesToExecute, newRows, deletedRowIds) => {
        const results = [];
        const errors = [];
        let needsReload = false;

        // 1. Handle deletes - find full row data for deleted IDs
        if (deletedRowIds && deletedRowIds.length > 0) {
            for (const deletedId of deletedRowIds) {
                const rowData = allDataRef.current.find(r => r.id === deletedId || r.range_id === deletedId);
                if (!rowData) {
                    errors.push(`Cannot find range data for ID: ${deletedId}`);
                    continue;
                }
                if (!rowData.volume_ids || rowData.volume_ids.length === 0) {
                    errors.push(`Cannot delete range ${rowData.start_volume}-${rowData.end_volume}: no volume IDs`);
                    continue;
                }
                try {
                    const response = await axios.post(
                        `${API_URL}/api/storage/${storageId}/volume-ranges/delete/`,
                        { volume_ids: rowData.volume_ids }
                    );
                    results.push({ type: 'delete', ...response.data });
                    needsReload = true;
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message;
                    errors.push(`Error deleting range ${rowData.start_volume}-${rowData.end_volume}: ${errorMsg}`);
                }
            }
        }

        // 2. Handle updates to existing rows
        if (updatesToExecute && updatesToExecute.length > 0) {
            for (const update of updatesToExecute) {
                try {
                    const response = await axios.post(
                        `${API_URL}/api/storage/${storageId}/volume-ranges/update/`,
                        {
                            volume_ids: update.volume_ids,
                            lss: update.lss,
                            new_start_volume: update.new_start_volume,
                            new_end_volume: update.new_end_volume,
                            format: update.format,
                            capacity_bytes: update.capacity_bytes,
                            pool_name: update.pool_name,
                            name_prefix: update.name_prefix,
                            preview: false,
                            active_project_id: activeProjectId
                        }
                    );
                    results.push({ type: 'update', ...response.data });
                    needsReload = true;
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message;
                    errors.push(`Error updating range ${update.lss}${update.new_start_volume}-${update.new_end_volume}: ${errorMsg}`);
                }
            }
        }

        // 3. Handle new rows (creates)
        if (newRows && newRows.length > 0) {
            for (const row of newRows) {
                if (!row.lss || !row.start_volume || !row.end_volume) {
                    errors.push(`Range missing LSS, start, or end volume`);
                    continue;
                }
                const lssPattern = /^[0-9A-Fa-f]{2}$/;
                const volPattern = /^[0-9A-Fa-f]{2}$/;
                if (!lssPattern.test(row.lss)) {
                    errors.push(`Invalid LSS format (must be 2 hex digits): ${row.lss}`);
                    continue;
                }
                if (!volPattern.test(row.start_volume) || !volPattern.test(row.end_volume)) {
                    errors.push(`Invalid volume format (must be 2 hex digits 00-FF): ${row.start_volume}-${row.end_volume}`);
                    continue;
                }

                const fullStartVolume = (row.lss + row.start_volume).toUpperCase();
                const fullEndVolume = (row.lss + row.end_volume).toUpperCase();
                const capacityBytes = normalizeCapacity(row.capacity_bytes);

                try {
                    const response = await axios.post(
                        `${API_URL}/api/storage/${storageId}/volume-ranges/create/`,
                        {
                            start_volume: fullStartVolume,
                            end_volume: fullEndVolume,
                            format: row.format || 'FB',
                            capacity_bytes: capacityBytes,
                            pool_name: row.pool_name || '',
                            name_prefix: row.name_prefix || '',
                            active_project_id: activeProjectId
                        }
                    );
                    results.push({ type: 'create', ...response.data });
                    needsReload = true;
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message;
                    errors.push(`Error creating range ${fullStartVolume}-${fullEndVolume}: ${errorMsg}`);
                }
            }
        }

        // Reload data after successful operations
        if (needsReload && tableRef.current) {
            tableRef.current.reloadData();
            if (onRangeCreated) {
                onRangeCreated();
            }
        }

        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            alert(`Some operations failed:\n${errorMessage}`);
            return { success: results.length > 0, message: errorMessage };
        }

        return { success: true, message: `${results.length} operations completed successfully` };
    }, [API_URL, storageId, activeProjectId, normalizeCapacity, onRangeCreated]);

    // Custom save handler - handles create, update, and delete operations
    // This handler receives: (dirtyRows, hasChanges, deletedRowIds)
    const handleSave = useCallback(async (dirtyRows, hasChanges, deletedRowIds) => {
        const errors = [];

        // Filter out blank rows - rows with no data entered in any field
        const nonBlankRows = dirtyRows.filter(row => {
            // Check if any meaningful field has data
            const hasLss = row.lss && row.lss.trim() !== '';
            const hasStart = row.start_volume && row.start_volume.trim() !== '';
            const hasEnd = row.end_volume && row.end_volume.trim() !== '';
            const hasFormat = row.format && row.format.trim() !== '';
            const hasCapacity = row.capacity_bytes !== null && row.capacity_bytes !== undefined && row.capacity_bytes !== '';
            const hasPool = row.pool_name && row.pool_name.trim() !== '';
            const hasNamePrefix = row.name_prefix && row.name_prefix.trim() !== '';

            return hasLss || hasStart || hasEnd || hasFormat || hasCapacity || hasPool || hasNamePrefix;
        });

        // If no non-blank rows and no deletes, nothing to do
        if (nonBlankRows.length === 0 && (!deletedRowIds || deletedRowIds.length === 0)) {
            return { success: true, message: 'No changes to save' };
        }

        // First, validate all non-blank rows for conflicts
        const validationIssues = [];
        for (const row of nonBlankRows) {
            const rowErrors = validateRow(row);
            if (rowErrors.conflicts && rowErrors.conflicts.length > 0) {
                const rangeDisplay = row.lss ? `${row.lss}${row.start_volume || '??'}-${row.end_volume || '??'}` : 'new range';
                validationIssues.push(`Range ${rangeDisplay}: conflicts with ${rowErrors.conflicts.length} existing volume(s)`);
            }
        }

        if (validationIssues.length > 0) {
            alert(`Cannot save: volume conflicts detected.\n\n${validationIssues.join('\n')}`);
            return { success: false, message: 'Volume conflicts detected' };
        }

        // Separate new rows from modified existing rows
        const newRows = nonBlankRows.filter(row => row._isNew || !row.id);
        const modifiedRows = nonBlankRows.filter(row => !row._isNew && row.id);

        // Check for modifications that would delete volumes (range shrinkage)
        const updatesNeedingConfirmation = [];
        const updatesNoConfirmation = [];

        for (const row of modifiedRows) {
            const key = row.id || row.range_id;
            const original = originalDataRef.current[key];

            if (!original) {
                errors.push(`Cannot find original data for range ID: ${key}`);
                continue;
            }

            // Validate hex format
            const volPattern = /^[0-9A-Fa-f]{2}$/;
            if (!volPattern.test(row.start_volume) || !volPattern.test(row.end_volume)) {
                errors.push(`Invalid volume format for range ${row.lss}: ${row.start_volume}-${row.end_volume}`);
                continue;
            }

            const capacityBytes = normalizeCapacity(row.capacity_bytes);

            // Check if range boundaries changed
            const startChanged = row.start_volume.toUpperCase() !== original.start_volume.toUpperCase();
            const endChanged = row.end_volume.toUpperCase() !== original.end_volume.toUpperCase();
            const formatChanged = row.format !== original.format;
            const capacityChanged = capacityBytes !== original.capacity_bytes;
            const poolChanged = (row.pool_name || '') !== (original.pool_name || '');
            const namePrefixChanged = (row.name_prefix || '') !== (original.name_prefix || '');

            // If nothing changed, skip
            if (!startChanged && !endChanged && !formatChanged && !capacityChanged && !poolChanged && !namePrefixChanged) {
                continue;
            }

            const updatePayload = {
                volume_ids: original.volume_ids,
                lss: row.lss,
                new_start_volume: row.start_volume.toUpperCase(),
                new_end_volume: row.end_volume.toUpperCase(),
                format: row.format,
                capacity_bytes: capacityBytes,
                pool_name: row.pool_name || '',
                name_prefix: row.name_prefix || '',
                original_start: original.start_volume,
                original_end: original.end_volume,
            };

            // If range boundaries changed, we need to check if this will delete volumes
            if (startChanged || endChanged) {
                try {
                    // Call preview API to check what would happen
                    const previewResponse = await axios.post(
                        `${API_URL}/api/storage/${storageId}/volume-ranges/update/`,
                        {
                            ...updatePayload,
                            preview: true,
                            active_project_id: activeProjectId
                        }
                    );

                    if (previewResponse.data.will_delete_volumes) {
                        // This update will delete volumes - needs confirmation
                        updatesNeedingConfirmation.push({
                            ...updatePayload,
                            preview: previewResponse.data
                        });
                    } else {
                        // No deletion, can proceed
                        updatesNoConfirmation.push(updatePayload);
                    }
                } catch (err) {
                    const errorMsg = err.response?.data?.error || err.message;
                    errors.push(`Error checking range update ${row.lss}${row.start_volume}-${row.end_volume}: ${errorMsg}`);
                }
            } else {
                // Only property changes (format, capacity, pool), no boundary changes
                updatesNoConfirmation.push(updatePayload);
            }
        }

        // Show validation errors
        if (errors.length > 0) {
            alert(`Validation errors:\n${errors.join('\n')}`);
            return { success: false, message: errors.join('\n') };
        }

        // If there are updates that would delete volumes, show confirmation dialog
        if (updatesNeedingConfirmation.length > 0) {
            // Store pending operations for after confirmation
            setPendingUpdates({
                updatesWithConfirmation: updatesNeedingConfirmation,
                updatesNoConfirmation: updatesNoConfirmation,
                newRows: newRows,
                deletedRowIds: deletedRowIds
            });

            // Calculate total volumes to be deleted
            const totalToDelete = updatesNeedingConfirmation.reduce(
                (sum, u) => sum + (u.preview?.changes?.volumes_to_delete || 0), 0
            );
            const deleteDetails = updatesNeedingConfirmation.map(u => ({
                range: `${u.lss}${u.original_start}-${u.original_end}`,
                newRange: `${u.lss}${u.new_start_volume}-${u.new_end_volume}`,
                volumesToDelete: u.preview?.changes?.delete_volume_ids || [],
                count: u.preview?.changes?.volumes_to_delete || 0
            }));

            setDeletePreview({
                totalToDelete,
                details: deleteDetails
            });
            setShowDeleteConfirmModal(true);

            // Return pending - actual save will happen after confirmation
            return { success: true, message: 'Awaiting confirmation', pending: true };
        }

        // No confirmation needed, execute directly
        return await executeUpdates(updatesNoConfirmation, newRows, deletedRowIds);
    }, [API_URL, storageId, activeProjectId, normalizeCapacity, executeUpdates, validateRow]);

    // Handle confirmation of volume deletions
    const handleConfirmDelete = useCallback(async () => {
        if (!pendingUpdates) return;

        setShowDeleteConfirmModal(false);

        // Combine all updates and execute
        const allUpdates = [
            ...pendingUpdates.updatesWithConfirmation,
            ...pendingUpdates.updatesNoConfirmation
        ];

        await executeUpdates(allUpdates, pendingUpdates.newRows, pendingUpdates.deletedRowIds);

        // Clear pending state
        setPendingUpdates(null);
        setDeletePreview(null);
    }, [pendingUpdates, executeUpdates]);

    // Handle cancellation of volume deletions
    const handleCancelDelete = useCallback(() => {
        setShowDeleteConfirmModal(false);
        setPendingUpdates(null);
        setDeletePreview(null);
        // Reload to restore original data
        if (tableRef.current) {
            tableRef.current.reloadData();
        }
    }, []);

    // Handle successful range creation from modal
    const handleRangeCreated = useCallback(() => {
        if (tableRef.current) {
            tableRef.current.reloadData();
        }
        if (onRangeCreated) {
            onRangeCreated();
        }
    }, [onRangeCreated]);

    // Custom toolbar content with Create Range button
    const customToolbarContent = (
        <ProjectViewToolbar
            ActionsDropdown={null}
            extraContent={
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowCreateModal(true)}
                    disabled={isReadOnly}
                    title={isReadOnly ? "Switch to Project View with an active project to create volume ranges" : "Create a new volume range using the wizard"}
                >
                    <Plus size={16} className="me-1" />
                    Create Range
                </button>
            }
        />
    );

    // Compute summary of validation errors for banner (must be before early returns)
    const validationErrorSummary = useMemo(() => {
        const errorKeys = Object.keys(rowValidationErrors);
        if (errorKeys.length === 0) return null;

        const conflictCount = errorKeys.filter(k => rowValidationErrors[k].conflicts).length;
        const formatErrors = errorKeys.filter(k => rowValidationErrors[k].format).length;
        const poolErrors = errorKeys.filter(k => rowValidationErrors[k].pool_name).length;

        const messages = [];
        if (conflictCount > 0) {
            messages.push(`${conflictCount} row${conflictCount > 1 ? 's' : ''} with volume conflicts`);
        }
        if (formatErrors > 0) {
            messages.push(`${formatErrors} row${formatErrors > 1 ? 's' : ''} with format mismatch`);
        }
        if (poolErrors > 0) {
            messages.push(`${poolErrors} row${poolErrors > 1 ? 's' : ''} with pool mismatch`);
        }

        return messages.length > 0 ? messages.join(', ') : null;
    }, [rowValidationErrors]);

    // Show empty config message if no active customer
    if (!config || !activeCustomerId) {
        return <EmptyConfigMessage entityName="volume ranges" />;
    }

    if (!storageId) {
        return (
            <div className="modern-table-container">
                <div className="alert alert-warning m-3">
                    No storage system specified for volume ranges.
                </div>
            </div>
        );
    }

    // Show loading while data loads or projectFilter is loading
    if (loading || projectFilterLoading || !apiUrl) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading volume ranges...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {/* Validation Error Banner */}
            {validationErrorSummary && (
                <div className="volume-range-validation-banner">
                    <AlertTriangle size={18} className="me-2" />
                    <strong>Validation errors:</strong> {validationErrorSummary}. Fix these issues before saving.
                </div>
            )}

            {/* Loading indicator for existing volumes */}
            {loadingVolumes && (
                <div className="volume-range-loading-hint">
                    Loading existing volumes for validation...
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}

                // API Configuration - we'll use custom handlers for save/delete
                apiUrl={apiUrl}
                customerId={activeCustomerId}
                tableName="volumeRanges"
                readOnly={isReadOnly}

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                newRowTemplate={NEW_RANGE_TEMPLATE}
                defaultSort={defaultSort}

                // Dropdown Configuration
                dropdownSources={dropdownSources}

                // Data Processing
                preprocessData={preprocessData}

                // Custom Renderers
                customRenderers={customRenderers}

                // Custom save handler for range operations (handles both create and delete)
                customSaveHandler={handleSave}

                // Real-time validation on cell changes
                afterChange={handleAfterChange}

                // Custom toolbar content
                customToolbarContent={customToolbarContent}

                // Table Settings
                height="calc(100vh - 350px)"
                stretchH="all"
                autoColumnSize={true}
                manualColumnResize={true}
                storageKey={`volumeRanges-${storageId}-${projectFilter}`}

                // Feature Flags
                enableFilters={true}
                enableExport={true}
                enablePagination={false}
            />

            {/* Create Range Modal for complex range creation */}
            <CreateVolumeRangeModal
                show={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                storageId={storageId}
                storageName={storageName}
                storageType="DS8000"
                activeProjectId={activeProjectId}
                onSuccess={handleRangeCreated}
            />

            {/* Confirmation Modal for volume deletions */}
            <Modal
                show={showDeleteConfirmModal}
                onHide={handleCancelDelete}
                centered
                backdrop="static"
                className="volume-range-confirm-modal"
            >
                <Modal.Header closeButton className="bg-warning">
                    <Modal.Title className="d-flex align-items-center">
                        <AlertTriangle size={24} className="me-2" />
                        Confirm Volume Deletion
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {deletePreview && (
                        <>
                            <p className="mb-3">
                                <strong>Warning:</strong> The following range changes will delete{' '}
                                <strong>{deletePreview.totalToDelete} volume{deletePreview.totalToDelete !== 1 ? 's' : ''}</strong>{' '}
                                from the database. This action cannot be undone.
                            </p>
                            <div className="border rounded p-3 bg-light mb-3">
                                {deletePreview.details.map((detail, idx) => (
                                    <div key={idx} className={idx > 0 ? 'mt-3 pt-3 border-top' : ''}>
                                        <div className="mb-2">
                                            <strong>Range:</strong>{' '}
                                            <span className="text-danger text-decoration-line-through">{detail.range}</span>
                                            {' '}&rarr;{' '}
                                            <span className="text-success">{detail.newRange}</span>
                                        </div>
                                        <div className="mb-1">
                                            <strong>Volumes to be deleted ({detail.count}):</strong>
                                        </div>
                                        <div className="font-monospace small text-danger">
                                            {detail.volumesToDelete.length > 10
                                                ? `${detail.volumesToDelete.slice(0, 10).join(', ')}... and ${detail.volumesToDelete.length - 10} more`
                                                : detail.volumesToDelete.join(', ') || 'None'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-muted small mb-0">
                                Click "Delete Volumes" to proceed with the changes, or "Cancel" to revert your edits.
                            </p>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCancelDelete}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>
                        Delete Volumes
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default VolumeRangeTableTanStackClean;
