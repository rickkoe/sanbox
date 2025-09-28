import React from 'react';

// Minimal test app to isolate context issues
const TestApp = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test App - Minimal Version</h1>
      <p>If this loads without errors, the issue is in our components.</p>
      <p>If this still has context errors, the issue is deeper.</p>
    </div>
  );
};

export default TestApp;