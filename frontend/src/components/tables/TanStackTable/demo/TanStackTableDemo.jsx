import React, { useState, useMemo } from 'react';
import TanStackTable from '../TanStackTable';

/**
 * Demo component to test TanStack Table functionality
 * This serves as both a demo and a basic test of the table implementation
 */
export function TanStackTableDemo() {
  // Sample data
  const sampleData = useMemo(() => [
    { id: 1, name: 'John Doe', email: 'john@example.com', department: 'Engineering', active: true, salary: 75000, joinDate: '2022-01-15' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', department: 'Marketing', active: true, salary: 68000, joinDate: '2021-08-22' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', department: 'Sales', active: false, salary: 62000, joinDate: '2020-03-10' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', department: 'Engineering', active: true, salary: 82000, joinDate: '2023-02-01' },
    { id: 5, name: 'Charlie Davis', email: 'charlie@example.com', department: 'HR', active: true, salary: 58000, joinDate: '2021-11-30' },
    { id: 6, name: 'Diana Wilson', email: 'diana@example.com', department: 'Engineering', active: true, salary: 91000, joinDate: '2019-05-20' },
    { id: 7, name: 'Edward Miller', email: 'edward@example.com', department: 'Marketing', active: false, salary: 64000, joinDate: '2022-07-12' },
    { id: 8, name: 'Fiona Garcia', email: 'fiona@example.com', department: 'Sales', active: true, salary: 70000, joinDate: '2023-01-08' },
  ], []);

  // Column definitions
  const columns = useMemo(() => [
    { data: 'id', type: 'number' },
    { data: 'name', type: 'text' },
    { data: 'email', type: 'email' },
    { data: 'department', type: 'select' },
    { data: 'active', type: 'boolean' },
    { data: 'salary', type: 'number' },
    { data: 'joinDate', type: 'date' },
  ], []);

  const colHeaders = [
    'ID',
    'Name',
    'Email',
    'Department',
    'Active',
    'Salary',
    'Join Date'
  ];

  // Dropdown sources
  const dropdownSources = {
    department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'],
  };

  // Custom renderers
  const customRenderers = {
    salary: (value) => (
      <span style={{ fontFamily: 'monospace', color: '#2c3e50' }}>
        ${value?.toLocaleString() || '0'}
      </span>
    ),
    active: (value) => (
      <span style={{
        color: value ? '#27ae60' : '#e74c3c',
        fontWeight: '600'
      }}>
        {value ? '✓ Active' : '✗ Inactive'}
      </span>
    ),
  };

  // State for demo controls
  const [enableVirtualization, setEnableVirtualization] = useState(true);
  const [enableCopyPaste, setEnableCopyPaste] = useState(true);
  const [enableFiltering, setEnableFiltering] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [enableExport, setEnableExport] = useState(true);

  // Event handlers
  const handleDataChange = (changes) => {
    console.log('Data changed:', changes);
  };

  const handleSelectionChange = (selection) => {
    console.log('Selection changed:', selection);
  };

  const handleSave = async (data) => {
    console.log('Saving data:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: 'Data saved successfully!' };
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>TanStack Table Demo</h1>
      <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
        High-performance replacement for GenericTable with Excel-like features
      </p>

      {/* Demo Controls */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        flexWrap: 'wrap'
      }}>
        <h3 style={{ width: '100%', margin: '0 0 15px 0', color: '#2c3e50' }}>Demo Controls</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableVirtualization}
            onChange={(e) => setEnableVirtualization(e.target.checked)}
          />
          Virtualization
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableCopyPaste}
            onChange={(e) => setEnableCopyPaste(e.target.checked)}
          />
          Copy/Paste
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableFiltering}
            onChange={(e) => setEnableFiltering(e.target.checked)}
          />
          Filtering
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableSorting}
            onChange={(e) => setEnableSorting(e.target.checked)}
          />
          Sorting
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={enableExport}
            onChange={(e) => setEnableExport(e.target.checked)}
          />
          Export
        </label>
      </div>

      {/* Instructions */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#e8f4f8',
        borderRadius: '8px',
        border: '1px solid #3498db'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Try These Features:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Selection:</strong> Click cells, drag to select ranges, use Shift+click to extend</li>
          <li><strong>Copy/Paste:</strong> Use Ctrl+C to copy, Ctrl+V to paste (if enabled)</li>
          <li><strong>Fill Operations:</strong> Select cells and use Ctrl+D for fill down, Ctrl+R for fill right</li>
          <li><strong>Keyboard Navigation:</strong> Arrow keys, Page Up/Down, Home/End, Ctrl+arrows for jumping</li>
          <li><strong>Sorting:</strong> Click column headers to sort (if enabled)</li>
          <li><strong>Filtering:</strong> Use the global search box or column filters (if enabled)</li>
          <li><strong>Export:</strong> Use the export dropdown to download CSV or Excel (if enabled)</li>
        </ul>
      </div>

      {/* Table Container */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <TanStackTable
          // Data
          data={sampleData}
          columns={columns}
          colHeaders={colHeaders}

          // Features
          enableVirtualization={enableVirtualization}
          enableCopyPaste={enableCopyPaste}
          enableFiltering={enableFiltering}
          enableSorting={enableSorting}
          enableExport={enableExport}
          enableRowSelection={true}
          enableFillOperations={true}
          enableKeyboardNavigation={true}

          // Configuration
          height="500px"
          dropdownSources={dropdownSources}
          customRenderers={customRenderers}

          // Events
          onDataChange={handleDataChange}
          onSelectionChange={handleSelectionChange}
          onSave={handleSave}

          // Storage
          storageKey="tanstack_demo"
          tableName="employee_demo"
        />
      </div>

      {/* Performance Info */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f0f8e8',
        borderRadius: '8px',
        border: '1px solid #27ae60'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Performance Notes:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>This demo uses {sampleData.length} rows - virtualization activates at 100+ rows</li>
          <li>Virtual scrolling provides smooth performance with thousands of rows</li>
          <li>Server pagination recommended for datasets larger than 1000 rows</li>
          <li>All Excel features work together seamlessly</li>
        </ul>
      </div>
    </div>
  );
}

export default TanStackTableDemo;