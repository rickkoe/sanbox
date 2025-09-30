import React, { useMemo } from 'react';
import TanStackTable from '../TanStackTable';

/**
 * Demo component to showcase the advanced filter functionality
 */
export function AdvancedFilterDemo() {
  // Sample data with various data types
  const sampleData = useMemo(() => [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      age: 28,
      department: 'Engineering',
      salary: 85000,
      isActive: true,
      startDate: '2022-01-15',
      country: 'USA'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      age: 32,
      department: 'Marketing',
      salary: 72000,
      isActive: false,
      startDate: '2021-06-10',
      country: 'Canada'
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      age: 45,
      department: 'Engineering',
      salary: 95000,
      isActive: true,
      startDate: '2020-03-22',
      country: 'USA'
    },
    {
      id: 4,
      name: 'Alice Brown',
      email: 'alice.brown@example.com',
      age: 29,
      department: 'Sales',
      salary: 68000,
      isActive: true,
      startDate: '2022-09-05',
      country: 'UK'
    },
    {
      id: 5,
      name: 'Charlie Wilson',
      email: 'charlie.wilson@example.com',
      age: 38,
      department: 'Engineering',
      salary: 88000,
      isActive: false,
      startDate: '2019-11-30',
      country: 'Australia'
    },
    {
      id: 6,
      name: 'Diana Miller',
      email: 'diana.miller@example.com',
      age: 26,
      department: 'Marketing',
      salary: 65000,
      isActive: true,
      startDate: '2023-02-14',
      country: 'USA'
    },
    {
      id: 7,
      name: 'Frank Davis',
      email: 'frank.davis@example.com',
      age: 41,
      department: 'Sales',
      salary: 78000,
      isActive: true,
      startDate: '2021-08-18',
      country: 'Canada'
    },
    {
      id: 8,
      name: 'Grace Lee',
      email: 'grace.lee@example.com',
      age: 35,
      department: 'Engineering',
      salary: 92000,
      isActive: false,
      startDate: '2020-12-03',
      country: 'USA'
    },
    {
      id: 9,
      name: 'Henry Martinez',
      email: 'henry.martinez@example.com',
      age: 33,
      department: 'Marketing',
      salary: 74000,
      isActive: true,
      startDate: '2022-04-25',
      country: 'Mexico'
    },
    {
      id: 10,
      name: 'Ivy Thompson',
      email: 'ivy.thompson@example.com',
      age: 30,
      department: 'Sales',
      salary: 71000,
      isActive: true,
      startDate: '2021-10-12',
      country: 'UK'
    },
  ], []);

  // Column definitions with various data types
  const columns = useMemo(() => [
    { data: 'id', type: 'number' },
    { data: 'name', type: 'text' },
    { data: 'email', type: 'text' },
    { data: 'age', type: 'number' },
    { data: 'department', type: 'select' },
    { data: 'salary', type: 'number' },
    { data: 'isActive', type: 'boolean' },
    { data: 'startDate', type: 'date' },
    { data: 'country', type: 'select' }
  ], []);

  const colHeaders = useMemo(() => [
    'ID',
    'Full Name',
    'Email Address',
    'Age',
    'Department',
    'Salary',
    'Active Status',
    'Start Date',
    'Country'
  ], []);

  // Dropdown sources for select-type columns
  const dropdownSources = useMemo(() => ({
    department: ['Engineering', 'Marketing', 'Sales'],
    country: ['USA', 'Canada', 'UK', 'Australia', 'Mexico'],
    isActive: [true, false]
  }), []);

  // Custom renderers for better display
  const customRenderers = useMemo(() => ({
    salary: (value) => `$${value?.toLocaleString() || 0}`,
    isActive: (value) => value ? '✅ Active' : '❌ Inactive',
    startDate: (value) => {
      if (!value) return '';
      const date = new Date(value);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }), []);

  // Debug logging
  console.log('AdvancedFilterDemo - sampleData:', sampleData);
  console.log('AdvancedFilterDemo - columns:', columns);
  console.log('AdvancedFilterDemo - colHeaders:', colHeaders);
  console.log('AdvancedFilterDemo - dropdownSources:', dropdownSources);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>Advanced Filter Demo</h2>
        <p>
          This demo showcases the comprehensive Excel-like filtering capabilities:
        </p>
        <ul style={{ fontSize: '14px', color: '#666' }}>
          <li><strong>Text Filters:</strong> Contains, doesn't contain, starts with, ends with, equals, not equals</li>
          <li><strong>Manual Selection:</strong> Excel-like checkboxes for individual item selection</li>
          <li><strong>Search within filters:</strong> Filter the items inside the dropdown</li>
          <li><strong>Multiple data types:</strong> Text, numbers, booleans, dates, and dropdowns</li>
          <li><strong>Visual indicators:</strong> Active filter count and clear functionality</li>
        </ul>

        <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
          Debug: {sampleData.length} rows loaded
        </div>
      </div>

      <TanStackTable
        data={sampleData}
        columns={columns}
        colHeaders={colHeaders}
        dropdownSources={dropdownSources}
        customRenderers={customRenderers}
        enableFiltering={true}
        enableSorting={true}
        enableRowSelection={true}
        enableExport={true}
        height="500px"
        tableName="filter_demo"
      />

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h3>Try these filter examples:</h3>
        <ul>
          <li>Filter <strong>Name</strong> "contains" → "john" (case insensitive)</li>
          <li>Filter <strong>Age</strong> → manually select specific ages or use number ranges</li>
          <li>Filter <strong>Department</strong> → select multiple departments</li>
          <li>Filter <strong>Email</strong> "ends with" → ".com"</li>
          <li>Filter <strong>Active Status</strong> → select True or False</li>
          <li>Apply multiple filters and see the combination effect</li>
        </ul>
      </div>
    </div>
  );
}

export default AdvancedFilterDemo;