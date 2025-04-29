import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeConfigApiUrl = "http://127.0.0.1:8000/api/core/active-config/";

  useEffect(() => {
    fetchActiveConfig();
  }, []);

  const fetchActiveConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(activeConfigApiUrl);

      if (Object.keys(response.data).length > 0) {
        setConfig(response.data);
      } else {
        setConfig(null);  // ✅ No active config found
      }
    } catch (err) {
      console.error("❌ Error fetching active config:", err);
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigContext.Provider value={{ config, loading, error, refreshConfig: fetchActiveConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};