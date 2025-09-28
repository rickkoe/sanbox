import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import MinimalZoneTableFast from "./MinimalZoneTableFast";

const TestMinimalZone = () => {
  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SettingsProvider>
            <MinimalZoneTableFast />
          </SettingsProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default TestMinimalZone;