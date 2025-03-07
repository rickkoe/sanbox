import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = () => {
    axios.get('http://127.0.0.1:8000/api/core/config/')
      .then(res => setConfig(res.data))
      .catch(err => console.error('Error fetching config:', err));
  };

  const refreshConfig = () => fetchConfig();

  return (
    <ConfigContext.Provider value={{ config, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};