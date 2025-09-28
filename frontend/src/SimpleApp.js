import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SanVendorProvider } from "./context/SanVendorContext";
import { ImportStatusProvider } from "./context/ImportStatusContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TableControlsProvider } from "./context/TableControlsContext";
import { BreadcrumbContext } from "./context/BreadcrumbContext";
import GenericTableFast from "./components/tables/GenericTable/GenericTableFast";

// Simple test to isolate context provider issues
const SimpleApp = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple App Test</h1>
      <p>Testing with GenericTableFast import only (not rendered)...</p>
    </div>
  );
};

const SimpleAppWithAllProviders = () => {
  const breadcrumbMap = {};
  const setBreadcrumbMap = () => {};
  
  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SanVendorProvider>
            <ImportStatusProvider>
              <SettingsProvider>
                <TableControlsProvider>
                  <BreadcrumbContext.Provider value={{ breadcrumbMap, setBreadcrumbMap }}>
                    <SimpleApp />
                  </BreadcrumbContext.Provider>
                </TableControlsProvider>
              </SettingsProvider>
            </ImportStatusProvider>
          </SanVendorProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default SimpleAppWithAllProviders;