import React, { useContext, useMemo, useCallback, useRef, useEffect, useState } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";
import { useProjectFilter } from "../../context/ProjectFilterContext";
import { useSettings } from "../../context/SettingsContext";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import EmptyConfigMessage from "../common/EmptyConfigMessage";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";
import { X, Edit3 } from "lucide-react";
import { Modal, Button } from "react-bootstrap";
import "../../styles/lss-summary.css";

/**
 * LSSSummaryTableTanStackClean - Displays LSS Summary data for DS8000 storage systems
 *
 * LSS (Logical Subsystem) data is auto-populated from volumes.
 * Only the SSID column is editable (in Project View only).
 *
 * Props:
 * - storageId (required): The DS8000 storage system ID
 */
const LSSSummaryTableTanStackClean = ({ storageId }) => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { settings, updateSettings } = useSettings();

    const tableRef = useRef(null);

    const { projectFilter } = useProjectFilter();

    // Modal state for hiding banners confirmation
    const [showHideBannerModal, setShowHideBannerModal] = useState(false);
    // Validation error state
    const [validationError, setValidationError] = useState(null);

    const activeCustomerId = config?.customer?.id;
    const activeProjectId = config?.active_project?.id;

    // Determine read-only state
    // Customer View is always read-only; Project View allows SSID editing
    const isInProjectView = projectFilter === 'current' && activeProjectId;
    const canEdit = isInProjectView && config?.active_project?.user_role !== 'viewer';
    const isReadOnly = !canEdit;

    // Check if user has hidden mode banners
    const hideBanners = settings?.hide_mode_banners;

    // Handler to hide mode banners permanently
    const handleHideBanners = useCallback(async () => {
        try {
            await updateSettings({ hide_mode_banners: true });
            setShowHideBannerModal(false);
        } catch (error) {
            console.error('Error hiding banners:', error);
            alert('Failed to hide banners. Please try again.');
        }
    }, [updateSettings]);

    // Build the API URL for fetching LSS summary data
    const apiUrl = useMemo(() => {
        if (!storageId || !activeCustomerId) return null;

        const params = new URLSearchParams({
            table_format: 'true',
        });

        if (activeProjectId) {
            params.append('active_project_id', activeProjectId);
        }
        params.append('project_filter', projectFilter);

        return `${API_URL}/api/storage/${storageId}/lss-summary/?${params.toString()}`;
    }, [API_URL, storageId, activeCustomerId, activeProjectId, projectFilter]);

    // Load columns from centralized configuration (no select column for this table)
    const columns = useMemo(() => {
        return getTableColumns('lsssummary', false);
    }, []);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('lsssummary', false);
    }, []);

    const defaultSort = getDefaultSort('lsssummary');

    // Expose table ref for external access
    useEffect(() => {
        window.lssSummaryTableRef = tableRef;
        return () => {
            delete window.lssSummaryTableRef;
        };
    }, []);

    // SSID validation: must be empty or exactly 4 hex characters (0-9, A-F)
    const isValidSSID = useCallback((ssid) => {
        if (!ssid || ssid === '') return true; // Empty is allowed
        const hexPattern = /^[0-9A-Fa-f]{4}$/;
        return hexPattern.test(ssid);
    }, []);

    // Custom save handler for SSID updates
    const handleSave = useCallback(async (dirtyRows, hasChanges, deletedRowIds) => {
        // Clear any previous validation error
        setValidationError(null);

        if (!hasChanges || dirtyRows.length === 0) {
            return { success: true };
        }

        // Validate all SSID values before saving
        const invalidRows = dirtyRows.filter(row => row.ssid && !isValidSSID(row.ssid));
        if (invalidRows.length > 0) {
            const invalidLSSList = invalidRows.map(row => `LSS ${row.lss}: "${row.ssid}"`).join(', ');
            const errorMsg = `Invalid SSID format. SSID must be exactly 4 hex characters (0-9, A-F). Invalid entries: ${invalidLSSList}`;
            setValidationError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        }

        // Check for duplicate SSIDs within the dirty rows and existing table data
        // Get all current table data to check for duplicates
        const allTableData = tableRef.current?.getTableData() || [];

        // Build a map of all SSIDs (normalized to uppercase) and their LSS values
        // Start with existing data, then override with dirty rows
        const ssidToLSSMap = new Map();
        const duplicates = [];

        // First, add all existing SSIDs from the table (except the ones being modified)
        const dirtyRowIds = new Set(dirtyRows.map(r => r.id));
        allTableData.forEach(row => {
            if (!dirtyRowIds.has(row.id) && row.ssid && row.ssid.trim() !== '') {
                const normalizedSSID = row.ssid.toUpperCase();
                if (!ssidToLSSMap.has(normalizedSSID)) {
                    ssidToLSSMap.set(normalizedSSID, []);
                }
                ssidToLSSMap.get(normalizedSSID).push(row.lss);
            }
        });

        // Now add the dirty rows and check for duplicates
        dirtyRows.forEach(row => {
            if (row.ssid && row.ssid.trim() !== '') {
                const normalizedSSID = row.ssid.toUpperCase();
                if (!ssidToLSSMap.has(normalizedSSID)) {
                    ssidToLSSMap.set(normalizedSSID, []);
                }
                ssidToLSSMap.get(normalizedSSID).push(row.lss);
            }
        });

        // Find any SSIDs that appear more than once
        ssidToLSSMap.forEach((lssValues, ssid) => {
            if (lssValues.length > 1) {
                duplicates.push({ ssid, lssValues });
            }
        });

        if (duplicates.length > 0) {
            const duplicateList = duplicates.map(d =>
                `SSID "${d.ssid}" used by LSS: ${d.lssValues.join(', ')}`
            ).join('; ');
            const errorMsg = `Duplicate SSIDs are not allowed within a storage system. ${duplicateList}`;
            setValidationError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        }

        // Filter to only rows that have been modified
        const updates = dirtyRows
            .filter(row => row.id) // Only update existing rows
            .map(row => ({
                id: row.id,
                ssid: row.ssid ? row.ssid.toUpperCase() : null, // Normalize to uppercase
                version: row.version || 1,
            }));

        if (updates.length === 0) {
            return { success: true };
        }

        try {
            const response = await axios.post(
                `${API_URL}/api/storage/${storageId}/lss-summary/bulk-update/`,
                {
                    updates,
                    active_project_id: activeProjectId,
                }
            );

            if (response.data.success) {
                return { success: true };
            } else {
                const errorMessages = response.data.errors?.map(e => `LSS ${e.id}: ${e.error}`).join('\n');
                setValidationError(errorMessages || 'Some updates failed');
                return {
                    success: false,
                    error: errorMessages || 'Some updates failed'
                };
            }
        } catch (err) {
            console.error("Failed to save LSS summary:", err);
            const errorMsg = err.response?.data?.error || "Failed to save changes";
            setValidationError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        }
    }, [API_URL, storageId, activeProjectId, isValidSSID]);

    // Show empty message if no customer selected
    if (!activeCustomerId) {
        return (
            <EmptyConfigMessage
                message="Select a customer to view LSS summary data."
            />
        );
    }

    // Show empty message if no storage ID
    if (!storageId) {
        return (
            <EmptyConfigMessage
                message="No storage system selected."
            />
        );
    }

    // Show loading if apiUrl is not ready
    if (!apiUrl) {
        return <div className="container mt-4">Loading...</div>;
    }

    // Determine which banner to show (if any)
    const showCustomerViewBanner = !isInProjectView && !hideBanners;
    const showProjectWorkBanner = isInProjectView && !hideBanners;

    return (
        <div className="modern-table-container">
            {/* Banner Slot - shows Customer View or Project View banner without layout shift */}
            {(showCustomerViewBanner || showProjectWorkBanner) && (
                <div className="lss-summary-banner-slot">
                    {/* Customer View Banner (Read-only mode notification) */}
                    {showCustomerViewBanner && (
                        <div className="lss-summary-info-alert">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lss-summary-info-alert-icon"
                            >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span className="lss-summary-info-alert-text">
                                <strong>Committed mode is read-only.</strong>{' '}
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (window.openContextDropdown) {
                                            window.openContextDropdown();
                                        }
                                    }}
                                >
                                    Open or create a project
                                </a>{' '}
                                to edit SSID values.
                            </span>
                            <button
                                onClick={() => setShowHideBannerModal(true)}
                                className="lss-summary-info-alert-close"
                                title="Hide this banner"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {/* Project Work Banner (shown in Project View) */}
                    {showProjectWorkBanner && (
                        <div className="lss-summary-info-alert">
                            <Edit3
                                size={20}
                                strokeWidth={2}
                                className="lss-summary-info-alert-icon"
                            />
                            <span className="lss-summary-info-alert-text">
                                <strong>You are in Project View:</strong> Edit SSID values here. Commit changes when complete.
                            </span>
                            <button
                                onClick={() => setShowHideBannerModal(true)}
                                className="lss-summary-info-alert-close"
                                title="Hide this banner"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Validation Error Banner - Theme-aware styling via CSS */}
            {validationError && (
                <div className="lss-summary-error-alert">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lss-summary-error-alert-icon"
                    >
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span className="lss-summary-error-alert-text">
                        {validationError}
                    </span>
                    <button
                        onClick={() => setValidationError(null)}
                        className="lss-summary-alert-close"
                        title="Dismiss error"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            <TanStackCRUDTable
                ref={tableRef}
                apiUrl={apiUrl}
                columns={columns}
                colHeaders={colHeaders}
                readOnly={isReadOnly}
                hideAddButton={true}
                selectCheckboxDisabled={true}
                defaultSort={defaultSort}
                customSaveHandler={handleSave}
                customerId={activeCustomerId}
                tableName="lsssummary"
                height="calc(100vh - 200px)"
            />

            {/* Confirmation Modal for hiding banners */}
            <Modal
                show={showHideBannerModal}
                onHide={() => setShowHideBannerModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Hide Mode Banners</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    These banners will be hidden permanently. You can show them again in{' '}
                    <strong>App Settings</strong> under "Notifications & Features".
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowHideBannerModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleHideBanners}>
                        Hide Banners
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default LSSSummaryTableTanStackClean;
