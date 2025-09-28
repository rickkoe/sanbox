import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";

// Test all three contexts
const TestContexts = () => {
  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SettingsProvider>
            <div style={{ padding: '20px' }}>
              <h1>Test All Three Contexts</h1>
              <p>Testing ConfigProvider + ThemeProvider + SettingsProvider...</p>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default TestContexts;