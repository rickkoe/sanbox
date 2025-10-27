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


    const handleInputChange = async (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        
        // Auto-save the change using context
        await autoSave({ [name]: newValue });
    };

    const handleThemeChange = async (newTheme) => {
        setSaving(true);
        setSaveStatus("");
        
        try {
            await updateTheme(newTheme);
            setSaveStatus("Theme updated successfully");
            // Clear success message after 2 seconds
            setTimeout(() => setSaveStatus(""), 2000);
        } catch (error) {
            console.error("Error updating theme:", error);
            setSaveStatus("Error updating theme");
            // Clear error message after 4 seconds
            setTimeout(() => setSaveStatus(""), 4000);
        } finally {
            setSaving(false);
        }
    };
    
    const autoSave = async (changedField) => {
        setSaving(true);
        setSaveStatus("");
        
        try {
            // Create updated settings object with the changed field
            const updatedSettings = { ...settings, ...changedField };
            const result = await updateSettings(updatedSettings);
            
            if (result.success) {
                setSaveStatus("Saved successfully");
                // Clear success message after 2 seconds
                setTimeout(() => setSaveStatus(""), 2000);
            } else {
                setSaveStatus("Error saving settings");
                // Clear error message after 4 seconds
                setTimeout(() => setSaveStatus(""), 4000);
            }
        } catch (error) {
            console.error("Error auto-saving settings:", error);
            setSaveStatus("Error saving settings");
            // Clear error message after 4 seconds
            setTimeout(() => setSaveStatus(""), 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        const defaultSettings = {
            items_per_page: 'All',
            notifications: true,
            show_advanced_features: false,
            zone_ratio: 'one-to-one',
            alias_max_zones: 1
        };
        
        // Auto-save the reset using context
        await autoSave(defaultSettings);
    };


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
                    {saving && <div className="auto-save-indicator saving">Saving...</div>}
                    {saveStatus && (
                        <div className={`auto-save-indicator ${saveStatus.includes('successfully') || saveStatus.includes('Saved') ? 'success' : 'error'}`}>
                            {saveStatus}
                        </div>
                    )}
                </div>
            </div>

            <div className="settings-form-card">
                <form className="settings-form">
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
                                    value={settings.items_per_page} 
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
                                    value={settings.zone_ratio} 
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
                                    value={settings.alias_max_zones}
                                    onChange={handleInputChange}
                                    min="1"
                                    max="100"
                                />
                                <small className="form-help">Maximum number of zones per alias</small>
                            </div>
                        </div>
                    </div>

                    {/* Notifications & Features */}
                    <div className="settings-section">
                        <h3>Notifications & Features</h3>
                        <div className="settings-grid">
                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="notifications"
                                        checked={settings.notifications}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkbox-text">Enable notifications</span>
                                </label>
                                <small className="form-help">Show browser notifications for important events</small>
                            </div>

                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="show_advanced_features"
                                        checked={settings.show_advanced_features}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkbox-text">Show advanced features</span>
                                </label>
                                <small className="form-help">Display advanced options and debugging tools</small>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="settings-actions">
                        <button 
                            type="button" 
                            className="reset-btn"
                            onClick={handleReset}
                            disabled={saving}
                        >
                            Reset to Defaults
                        </button>
                        
                        <div className="auto-save-notice">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Changes are saved automatically
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;