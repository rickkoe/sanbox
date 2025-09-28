import React, { useContext } from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider, ConfigContext } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";

// Test imports from ZoneTableFast one by one
// import axios from "axios";
import { useSettings } from "./context/SettingsContext";
// import { useNavigate } from "react-router-dom";
import GenericTableFast from "./components/tables/GenericTable/GenericTableFast";
import CustomNamingApplier from "./components/naming/CustomNamingApplier";
import { getTextColumns } from "./utils/tableNamingUtils";

const TestZoneImports = () => {
  const { config } = useContext(ConfigContext); // Use ConfigContext like ZoneTableFast
  const { settings } = useSettings(); // Use SettingsContext like ZoneTableFast
  
  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SettingsProvider>
            <div style={{ padding: '20px' }}>
              <h1>Test Zone Imports - Step 6</h1>
              <p>Testing with useContext(ConfigContext) + useSettings...</p>
              <p>Theme: {settings.theme}</p>
              <p>Active Project: {config?.active_project?.name || 'None'}</p>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default TestZoneImports;