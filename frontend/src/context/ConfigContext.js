import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true); // ✅ Loading state
  const [error, setError] = useState(null); // ✅ Error state

  useEffect(() => {
    fetchActiveConfig();
  }, []);

  const fetchActiveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching active config...");
      const response = await axios.get('http://127.0.0.1:8000/api/core/configs/?is_active=True'); // ✅ Fetch only active config

      console.log("✅ API Response:", response.data);

      if (response.data.length > 0) {
        setConfig(response.data[0]); // ✅ Assume the first result is the active config
        console.log("🎯 Active Config Set:", response.data[0]);
        console.log("Active Customer:", response.data[0].customer.name)
      } else {
        setConfig(null);
        console.warn("⚠️ No active config found.");
      }
    } catch (err) {
      console.error("❌ Error fetching active config:", err);
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
      console.log("⏳ Fetching complete. Loading state:", false);
    }
  };

  return (
    <ConfigContext.Provider value={{ config, refreshConfig: fetchActiveConfig, loading, error }}>
      {children}
    </ConfigContext.Provider>
  );
};