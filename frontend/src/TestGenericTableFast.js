import React from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "./context/ConfigContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

// Test just react-data-grid directly
const TestGenericTableFast = () => {
  const columns = [
    { key: 'id', name: 'ID', width: 120 },
    { key: 'name', name: 'Name', width: 200 }
  ];
  
  const rows = [
    { id: 1, name: 'Test Row 1' },
    { id: 2, name: 'Test Row 2' }
  ];

  return (
    <Router>
      <ConfigProvider>
        <ThemeProvider>
          <SettingsProvider>
            <div style={{ padding: '20px' }}>
              <h1>Test DataGrid Directly</h1>
              <div style={{ height: '400px' }}>
                <DataGrid 
                  columns={columns}
                  rows={rows}
                />
              </div>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </ConfigProvider>
    </Router>
  );
};

export default TestGenericTableFast;