import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { FaPalette, FaCheck } from 'react-icons/fa';
import "../styles/settings.css";

const SettingsPage = () => {
    const { settings, loading, updateSettings } = useSettings();
    const { theme, updateTheme } = useTheme();
    const [saveStatus, setSaveStatus] = useState("");
    const [saving, setSaving] = useState(false);

    // Local form state
    const [localSettings, setLocalSettings] = useState({
        items_per_page: 'All',
        notifications: true,
        show_advanced_features: false,
        zone_ratio: 'one-to-one',
        alias_max_zones: 1,
        audit_log_retention_days: 90,
        hide_mode_banners: false
    });
    const [hasChanges, setHasChanges] = useState(false);

    // Audit log state
    const [auditLogCount, setAuditLogCount] = useState(0);
    const [purging, setPurging] = useState(false);
    const [purgeStatus, setPurgeStatus] = useState("");

    // Sync local settings with context when loaded (only on initial load)
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!loading && settings && !initialized) {
            setLocalSettings({
                items_per_page: settings.items_per_page ?? 'All',
                notifications: settings.notifications ?? true,
                show_advanced_features: settings.show_advanced_features ?? false,
                zone_ratio: settings.zone_ratio ?? 'one-to-one',
                alias_max_zones: settings.alias_max_zones ?? 1,
                audit_log_retention_days: settings.audit_log_retention_days ?? 90,
                hide_mode_banners: settings.hide_mode_banners ?? false
            });
            setInitialized(true);
        }
    }, [loading, settings, initialized]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue;

        if (type === 'checkbox') {
            newValue = checked;
        } else if (type === 'number') {
            // Keep as string while typing, will convert on save
            newValue = value;
        } else {
            newValue = value;
        }

        setLocalSettings(prev => ({
            ...prev,
            [name]: newValue
        }));
        setHasChanges(true);
    };

    const handleThemeChange = async (newTheme) => {
        setSaving(true);
        setSaveStatus("");

        try {
            await updateTheme(newTheme);
            setSaveStatus("Theme updated");
            setTimeout(() => setSaveStatus(""), 2000);
        } catch (error) {
            console.error("Error updating theme:", error);
            setSaveStatus("Error updating theme");
            setTimeout(() => setSaveStatus(""), 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus("");

        try {
            // Convert number fields to integers before saving
            const settingsToSave = {
                ...localSettings,
                alias_max_zones: parseInt(localSettings.alias_max_zones, 10) || 1,
                audit_log_retention_days: parseInt(localSettings.audit_log_retention_days, 10) || 90
            };

            const result = await updateSettings(settingsToSave);

            if (result.success) {
                setSaveStatus("Settings saved");
                setHasChanges(false);
                setTimeout(() => setSaveStatus(""), 2000);
            } else {
                setSaveStatus("Error saving settings");
                setTimeout(() => setSaveStatus(""), 4000);
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            setSaveStatus("Error saving settings");
            setTimeout(() => setSaveStatus(""), 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        const defaultSettings = {
            items_per_page: 'All',
            notifications: true,
            show_advanced_features: false,
            zone_ratio: 'one-to-one',
            alias_max_zones: 1,
            audit_log_retention_days: 90,
            hide_mode_banners: false
        };
        setLocalSettings(defaultSettings);
        setHasChanges(true);
    };

    const handleCancel = () => {
        // Revert to saved settings
        setLocalSettings({
            items_per_page: settings.items_per_page ?? 'All',
            notifications: settings.notifications ?? true,
            show_advanced_features: settings.show_advanced_features ?? false,
            zone_ratio: settings.zone_ratio ?? 'one-to-one',
            alias_max_zones: settings.alias_max_zones ?? 1,
            audit_log_retention_days: settings.audit_log_retention_days ?? 90,
            hide_mode_banners: settings.hide_mode_banners ?? false
        });
        setHasChanges(false);
    };

    // Fetch audit log count
    const fetchAuditLogCount = async () => {
        try {
            const response = await axios.get('/api/core/audit-log/', { params: { page_size: 1 } });
            setAuditLogCount(response.data.count || 0);
        } catch (error) {
            console.error('Error fetching audit log count:', error);
        }
    };

    // Purge old audit logs
    const handlePurgeAuditLogs = async () => {
        const confirmed = window.confirm(
            `This will delete all audit logs older than ${localSettings.audit_log_retention_days || 90} days. ` +
            'This action cannot be undone. Continue?'
        );

        if (!confirmed) return;

        setPurging(true);
        setPurgeStatus('');

        try {
            const response = await axios.post('/api/core/audit-log/purge/');
            setPurgeStatus(`Successfully deleted ${response.data.deleted_count} old audit logs`);
            await fetchAuditLogCount();
            setTimeout(() => setPurgeStatus(''), 5000);
        } catch (error) {
            console.error('Error purging audit logs:', error);
            setPurgeStatus(error.response?.data?.error || 'Error purging audit logs');
            setTimeout(() => setPurgeStatus(''), 5000);
        } finally {
            setPurging(false);
        }
    };

    // Initial fetch of audit log count
    useEffect(() => {
        fetchAuditLogCount();
    }, []);


    if (loading) {
        return (
            <div className="settings-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <span>Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`settings-container theme-${theme}`}>
            {/* Compact Page Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <div className="page-title-wrapper">
                        <svg className="page-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M12 1v6m0 6v6m8.66-9l-5.2 3M8.54 14l-5.2 3m12.72 0l-5.2-3M8.54 10l-5.2-3"></path>
                        </svg>
                        <h1 className="page-title">Application Settings</h1>
                    </div>
                    <p className="page-subtitle">Configure your application preferences and behavior</p>
                    {hasChanges && (
                        <div className="auto-save-indicator saving">Unsaved changes</div>
                    )}
                    {saveStatus && (
                        <div className={`auto-save-indicator ${saveStatus.includes('saved') || saveStatus.includes('updated') ? 'success' : 'error'}`}>
                            {saveStatus}
                        </div>
                    )}
                </div>
            </div>

            <div className="settings-form-card">
                <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
                    {/* Theme Settings */}
                    <div className="settings-section">
                        <h3><FaPalette className="settings-icon" /> Application Theme</h3>
                        <p className="settings-description">Choose a theme that affects the entire application appearance</p>

                        <div className="theme-selection-grid">
                            {[
                                { name: 'light', display: 'Light', description: 'Clean and bright interface with excellent readability', color: '#ffffff', textColor: '#2563eb' },
                                { name: 'dark', display: 'Dark', description: 'Dark theme with teal accents for low-light environments', color: '#1a1a2e', textColor: '#64ffda' }
                            ].map((themeOption) => (
                                <div
                                    key={themeOption.name}
                                    className={`theme-option-card ${theme === themeOption.name ? 'active' : ''}`}
                                    onClick={() => handleThemeChange(themeOption.name)}
                                >
                                    <div className="theme-preview-area">
                                        <div
                                            className={`theme-preview-color theme-preview-${themeOption.name}`}
                                            style={{
                                                backgroundColor: themeOption.color,
                                                border: themeOption.name === 'light' ? '2px solid #e5e7eb' : 'none'
                                            }}
                                        ></div>
                                        {theme === themeOption.name && (
                                            <div className="theme-active-indicator">
                                                <FaCheck />
                                            </div>
                                        )}
                                    </div>
                                    <div className="theme-option-info">
                                        <h4 className="theme-option-name">{themeOption.display}</h4>
                                        <p className="theme-option-description">{themeOption.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="settings-section">
                        <h3>Display Settings</h3>
                        <div className="settings-grid">

                            <div className="form-group">
                                <label className="form-label">Items per page</label>
                                <select
                                    className="form-select"
                                    name="items_per_page"
                                    value={localSettings.items_per_page}
                                    onChange={handleInputChange}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                    <option value="All">All</option>
                                </select>
                            </div>

                        </div>
                    </div>


                    {/* SAN Configuration */}
                    <div className="settings-section">
                        <h3>SAN Configuration</h3>
                        <div className="settings-grid">
                            <div className="form-group">
                                <label className="form-label">Zone ratio</label>
                                <select
                                    className="form-select"
                                    name="zone_ratio"
                                    value={localSettings.zone_ratio}
                                    onChange={handleInputChange}
                                >
                                    <option value="one-to-one">One-to-one</option>
                                    <option value="one-to-many">One-to-many</option>
                                    <option value="all-to-all">All-to-all</option>
                                </select>
                                <small className="form-help">Default zone ratio for SAN operations</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Max zones per alias</label>
                                <input
                                    type="number"
                                    className="form-select"
                                    name="alias_max_zones"
                                    value={localSettings.alias_max_zones}
                                    onChange={handleInputChange}
                                    min="1"
                                    max="100"
                                />
                                <small className="form-help">Maximum number of zones per alias</small>
                            </div>
                        </div>
                    </div>

                    {/* Audit Log Settings */}
                    <div className="settings-section">
                        <h3>Audit Log Settings</h3>
                        <p className="settings-description">Configure audit log retention and manage stored audit logs</p>

                        <div className="settings-grid">
                            <div className="form-group">
                                <label className="form-label">Retention Period (Days)</label>
                                <input
                                    type="number"
                                    className="form-select"
                                    name="audit_log_retention_days"
                                    value={localSettings.audit_log_retention_days}
                                    onChange={handleInputChange}
                                    min="1"
                                    max="365"
                                />
                                <small className="form-help">
                                    Logs older than this will be automatically deleted daily at 2 AM
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Current Log Count</label>
                                <div className="audit-log-stats">
                                    <div className="stat-value">{auditLogCount.toLocaleString()}</div>
                                    <small className="form-help">Total audit log entries stored</small>
                                </div>
                            </div>
                        </div>

                        <div className="audit-log-actions" style={{ marginTop: '1rem' }}>
                            <button
                                type="button"
                                className="purge-btn"
                                onClick={handlePurgeAuditLogs}
                                disabled={purging || auditLogCount === 0}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'var(--color-danger-emphasis)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: purging || auditLogCount === 0 ? 'not-allowed' : 'pointer',
                                    opacity: purging || auditLogCount === 0 ? 0.6 : 1,
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {purging ? 'Purging...' : 'Purge Old Logs Now'}
                            </button>

                            {purgeStatus && (
                                <div
                                    className={`purge-status ${purgeStatus.includes('Successfully') ? 'success' : 'error'}`}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: purgeStatus.includes('Successfully')
                                            ? 'var(--color-success-emphasis)'
                                            : 'var(--color-danger-emphasis)',
                                        color: 'white',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {purgeStatus}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notifications & Features */}
                    <div className="settings-section">
                        <h3>Notifications & Features</h3>
                        <div className="toggle-cards-grid">
                            <div
                                className={`toggle-card ${localSettings.notifications ? 'active' : ''}`}
                                onClick={() => {
                                    setLocalSettings(prev => ({ ...prev, notifications: !prev.notifications }));
                                    setHasChanges(true);
                                }}
                            >
                                <div className="toggle-card-checkbox">
                                    <input
                                        type="checkbox"
                                        name="notifications"
                                        checked={localSettings.notifications}
                                        onChange={handleInputChange}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="toggle-card-info">
                                    <h4 className="toggle-card-title">Enable notifications</h4>
                                    <p className="toggle-card-description">Show browser notifications for important events</p>
                                </div>
                            </div>

                            <div
                                className={`toggle-card ${localSettings.show_advanced_features ? 'active' : ''}`}
                                onClick={() => {
                                    setLocalSettings(prev => ({ ...prev, show_advanced_features: !prev.show_advanced_features }));
                                    setHasChanges(true);
                                }}
                            >
                                <div className="toggle-card-checkbox">
                                    <input
                                        type="checkbox"
                                        name="show_advanced_features"
                                        checked={localSettings.show_advanced_features}
                                        onChange={handleInputChange}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="toggle-card-info">
                                    <h4 className="toggle-card-title">Show advanced features</h4>
                                    <p className="toggle-card-description">Display advanced options and debugging tools</p>
                                </div>
                            </div>

                            <div
                                className={`toggle-card ${!localSettings.hide_mode_banners ? 'active' : ''}`}
                                onClick={() => {
                                    setLocalSettings(prev => ({ ...prev, hide_mode_banners: !prev.hide_mode_banners }));
                                    setHasChanges(true);
                                }}
                            >
                                <div className="toggle-card-checkbox">
                                    <input
                                        type="checkbox"
                                        name="hide_mode_banners"
                                        checked={!localSettings.hide_mode_banners}
                                        onChange={(e) => {
                                            setLocalSettings(prev => ({ ...prev, hide_mode_banners: !e.target.checked }));
                                            setHasChanges(true);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="toggle-card-info">
                                    <h4 className="toggle-card-title">Show mode banners</h4>
                                    <p className="toggle-card-description">Display Committed/Draft mode notification banners in table views</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="settings-actions">
                        <div className="settings-actions-left">
                            <button
                                type="button"
                                className="reset-btn"
                                onClick={handleReset}
                                disabled={saving}
                            >
                                Reset to Defaults
                            </button>
                            {hasChanges && (
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={handleCancel}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            className="save-btn"
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;
