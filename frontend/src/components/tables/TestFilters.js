import React from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

registerAllModules();

const TestFilters = () => {
  const testData = [
    { name: 'John', age: 30, city: 'New York' },
    { name: 'Jane', age: 25, city: 'Boston' },
    { name: 'Bob', age: 35, city: 'Chicago' }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2>Filter Test</h2>
      <HotTable
        data={testData}
        colHeaders={['Name', 'Age', 'City']}
        columns={[
          { data: 'name' },
          { data: 'age' },
          { data: 'city' }
        ]}
        filters={true}
        dropdownMenu={true}
        licenseKey="non-commercial-and-evaluation"
        width="600px"
        height="300px"
      />
    </div>
  );
};

export default TestFilters; // Make sure you have this line