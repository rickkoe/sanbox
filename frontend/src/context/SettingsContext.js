import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    theme: 'light',
    items_per_page: 25,
    auto_refresh: true,
    auto_refresh_interval: 30,
    notifications: true,
    compact_mode: false,
    show_advanced_features: false,
    zone_ratio: 'one-to-one',
    alias_max_zones: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const settingsApiUrl = "/api/core/settings/";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(settingsApiUrl);
      if (response.data && Object.keys(response.data).length > 0) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (err) {
      console.error("❌ Error fetching settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updatedSettings) => {
    try {
      const response = await axios.put(settingsApiUrl, updatedSettings);
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
      return { success: true };
    } catch (err) {
      console.error("❌ Error updating settings:", err);
      return { success: false, error: err.message };
    }
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      error,
      fetchSettings,
      updateSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};