import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/settings.css";

const SettingsPage = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const settingsApiUrl = `${API_URL}/api/core/settings/`;

    const [settings, setSettings] = useState({
        theme: 'light',
        itemsPerPage: 25,
        autoRefresh: true,
        autoRefreshInterval: 30,
        notifications: true,
        compactMode: false,
        showAdvancedFeatures: false
    });
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState("");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await axios.get(settingsApiUrl);
            if (response.data && Object.keys(response.data).length > 0) {
                setSettings(prev => ({ ...prev, ...response.data }));
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        setSaveStatus("Saving...");
        try {
            await axios.put(settingsApiUrl, settings);
            setSaveStatus("Settings saved successfully! ✅");
            setTimeout(() => setSaveStatus(""), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setSaveStatus("⚠️ Error saving settings!");
            setTimeout(() => setSaveStatus(""), 5000);
        }
    };

    const handleReset = () => {
        setSettings({
            theme: 'light',
            itemsPerPage: 25,
            autoRefresh: true,
            autoRefreshInterval: 30,
            notifications: true,
            compactMode: false,
            showAdvancedFeatures: false
        });
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
        <div className="settings-container">
            <div className="settings-header">
                <h1>Application Settings</h1>
                <p>Configure your application preferences and behavior</p>
            </div>

            <div className="settings-form-card">
                <form className="settings-form">
                    {/* Display Settings */}
                    <div className="settings-section">
                        <h3>Display Settings</h3>
                        <div className="settings-grid">
                            <div className="form-group">
                                <label className="form-label">Theme</label>
                                <select 
                                    className="form-select" 
                                    name="theme" 
                                    value={settings.theme} 
                                    onChange={handleInputChange}
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="auto">Auto (System)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Items per page</label>
                                <select 
                                    className="form-select" 
                                    name="itemsPerPage" 
                                    value={settings.itemsPerPage} 
                                    onChange={handleInputChange}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="compactMode"
                                        checked={settings.compactMode}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkbox-text">Compact mode</span>
                                </label>
                                <small className="form-help">Reduce spacing and padding for more data on screen</small>
                            </div>
                        </div>
                    </div>

                    {/* Data & Refresh Settings */}
                    <div className="settings-section">
                        <h3>Data & Refresh Settings</h3>
                        <div className="settings-grid">
                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="autoRefresh"
                                        checked={settings.autoRefresh}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkbox-text">Auto-refresh data</span>
                                </label>
                                <small className="form-help">Automatically refresh table data periodically</small>
                            </div>

                            {settings.autoRefresh && (
                                <div className="form-group">
                                    <label className="form-label">Refresh interval (seconds)</label>
                                    <select 
                                        className="form-select" 
                                        name="autoRefreshInterval" 
                                        value={settings.autoRefreshInterval} 
                                        onChange={handleInputChange}
                                    >
                                        <option value={15}>15 seconds</option>
                                        <option value={30}>30 seconds</option>
                                        <option value={60}>1 minute</option>
                                        <option value={300}>5 minutes</option>
                                    </select>
                                </div>
                            )}
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
                                        name="showAdvancedFeatures"
                                        checked={settings.showAdvancedFeatures}
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
                        >
                            Reset to Defaults
                        </button>
                        
                        <button 
                            type="button" 
                            className={`save-btn ${saveStatus === "Saving..." ? "saving" : ""}`}
                            onClick={handleSave}
                            disabled={saveStatus === "Saving..."}
                        >
                            {saveStatus === "Saving..." ? (
                                <>
                                    <div className="btn-spinner"></div>
                                    Saving...
                                </>
                            ) : (
                                "Save Settings"
                            )}
                        </button>
                    </div>

                    {saveStatus && !saveStatus.includes("Saving") && (
                        <div className={`status-message ${saveStatus.includes("✅") ? "success" : "error"}`}>
                            {saveStatus}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;