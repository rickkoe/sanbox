import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SanVendorProvider } from "./context/SanVendorContext";
import { ImportStatusProvider } from "./context/ImportStatusContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TableControlsProvider } from "./context/TableControlsContext";
import { BreadcrumbContext } from "./context/BreadcrumbContext";
import ZoneTableFast from "./components/tables/ZoneTableFast";

// Debug test - just load ZoneTableFast with all providers
const DebugZoneTable = () => {
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
                    <div style={{ padding: '20px' }}>
                      <h1>Debug: ZoneTableFast Only</h1>
                      <ZoneTableFast />
                    </div>
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

export default DebugZoneTable;