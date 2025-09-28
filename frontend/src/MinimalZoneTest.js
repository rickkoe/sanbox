import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";

// Test just the imports without rendering ZoneTableFast
const MinimalZoneTest = () => {
  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SettingsProvider>
            <div style={{ padding: '20px' }}>
              <h1>Minimal Test - Just Providers</h1>
              <p>If this loads, the issue is in ZoneTableFast itself</p>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default MinimalZoneTest;