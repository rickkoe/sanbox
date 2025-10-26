import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Copy,
  Download,
  Upload,
  Edit,
  Trash2
} from 'lucide-react';
import './SamplePage.css';

const SamplePage = () => {
  const [selectedOption, setSelectedOption] = useState('option1');
  const [isChecked, setIsChecked] = useState(true);
  const [switchValue, setSwitchValue] = useState(false);

  return (
    <div className="sample-page">
      {/* Page Header */}
      <div className="sample-page-header">
        <div>
          <h1 className="sample-page-title">Theme Demo Components</h1>
          <p className="sample-page-subtitle">
            Comprehensive UI elements showcase for theme testing
          </p>
        </div>
        <div className="sample-page-actions">
          <button className="sample-btn sample-btn-secondary">
            <Download size={16} />
            Export
          </button>
          <button className="sample-btn sample-btn-primary">
            <Upload size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Alerts</h2>
        <div className="sample-alerts-grid">
          <div className="sample-alert sample-alert-info">
            <Info size={18} />
            <div>
              <strong>Information:</strong> This is an informational message with details.
            </div>
          </div>
          <div className="sample-alert sample-alert-success">
            <CheckCircle size={18} />
            <div>
              <strong>Success:</strong> Operation completed successfully!
            </div>
          </div>
          <div className="sample-alert sample-alert-warning">
            <AlertTriangle size={18} />
            <div>
              <strong>Warning:</strong> Please review this before proceeding.
            </div>
          </div>
          <div className="sample-alert sample-alert-danger">
            <AlertCircle size={18} />
            <div>
              <strong>Error:</strong> An error occurred during the operation.
            </div>
          </div>
        </div>
      </section>

      {/* Cards Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Cards</h2>
        <div className="sample-cards-grid">
          <div className="sample-card">
            <div className="sample-card-header">
              <h3 className="sample-card-title">Storage Overview</h3>
              <span className="sample-badge sample-badge-success">Active</span>
            </div>
            <div className="sample-card-body">
              <div className="sample-stat">
                <span className="sample-stat-label">Total Capacity</span>
                <span className="sample-stat-value">24.5 TB</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Used</span>
                <span className="sample-stat-value">18.2 TB</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Available</span>
                <span className="sample-stat-value">6.3 TB</span>
              </div>
            </div>
          </div>

          <div className="sample-card">
            <div className="sample-card-header">
              <h3 className="sample-card-title">SAN Zones</h3>
              <span className="sample-badge sample-badge-info">42 Total</span>
            </div>
            <div className="sample-card-body">
              <div className="sample-stat">
                <span className="sample-stat-label">Active Zones</span>
                <span className="sample-stat-value">38</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Inactive</span>
                <span className="sample-stat-value">4</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Warnings</span>
                <span className="sample-stat-value">2</span>
              </div>
            </div>
          </div>

          <div className="sample-card">
            <div className="sample-card-header">
              <h3 className="sample-card-title">Customers</h3>
              <span className="sample-badge">15</span>
            </div>
            <div className="sample-card-body">
              <div className="sample-stat">
                <span className="sample-stat-label">Enterprise</span>
                <span className="sample-stat-value">8</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Standard</span>
                <span className="sample-stat-value">7</span>
              </div>
              <div className="sample-stat">
                <span className="sample-stat-label">Trial</span>
                <span className="sample-stat-value">0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Forms Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Form Controls</h2>
        <div className="sample-form-grid">
          <div className="sample-form-group">
            <label className="sample-label">Text Input</label>
            <input
              type="text"
              className="sample-input"
              placeholder="Enter zone name..."
            />
          </div>

          <div className="sample-form-group">
            <label className="sample-label">Email Input</label>
            <input
              type="email"
              className="sample-input"
              placeholder="user@example.com"
            />
          </div>

          <div className="sample-form-group">
            <label className="sample-label">Select Dropdown</label>
            <select
              className="sample-select"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              <option value="option1">Fabric A</option>
              <option value="option2">Fabric B</option>
              <option value="option3">Fabric C</option>
            </select>
          </div>

          <div className="sample-form-group">
            <label className="sample-label">Textarea</label>
            <textarea
              className="sample-textarea"
              rows="3"
              placeholder="Enter description..."
            ></textarea>
          </div>

          <div className="sample-form-group">
            <label className="sample-label">Checkboxes</label>
            <div className="sample-checkbox-group">
              <label className="sample-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                />
                <span>Enable notifications</span>
              </label>
              <label className="sample-checkbox">
                <input type="checkbox" />
                <span>Auto-backup</span>
              </label>
              <label className="sample-checkbox">
                <input type="checkbox" />
                <span>Email reports</span>
              </label>
            </div>
          </div>

          <div className="sample-form-group">
            <label className="sample-label">Radio Buttons</label>
            <div className="sample-radio-group">
              <label className="sample-radio">
                <input type="radio" name="storage-type" defaultChecked />
                <span>Block Storage</span>
              </label>
              <label className="sample-radio">
                <input type="radio" name="storage-type" />
                <span>File Storage</span>
              </label>
              <label className="sample-radio">
                <input type="radio" name="storage-type" />
                <span>Object Storage</span>
              </label>
            </div>
          </div>
        </div>

        <div className="sample-form-group">
          <label className="sample-switch">
            <input
              type="checkbox"
              checked={switchValue}
              onChange={(e) => setSwitchValue(e.target.checked)}
            />
            <span className="sample-switch-slider"></span>
            <span className="sample-switch-label">Enable advanced features</span>
          </label>
        </div>
      </section>

      {/* Buttons Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Buttons</h2>
        <div className="sample-buttons-grid">
          <div className="sample-button-group">
            <h4 className="sample-subsection-title">Primary Buttons</h4>
            <div className="sample-button-row">
              <button className="sample-btn sample-btn-primary">Primary</button>
              <button className="sample-btn sample-btn-primary">
                <Edit size={16} />
                With Icon
              </button>
              <button className="sample-btn sample-btn-primary" disabled>
                Disabled
              </button>
            </div>
          </div>

          <div className="sample-button-group">
            <h4 className="sample-subsection-title">Secondary Buttons</h4>
            <div className="sample-button-row">
              <button className="sample-btn sample-btn-secondary">Secondary</button>
              <button className="sample-btn sample-btn-secondary">
                <Copy size={16} />
                With Icon
              </button>
              <button className="sample-btn sample-btn-secondary" disabled>
                Disabled
              </button>
            </div>
          </div>

          <div className="sample-button-group">
            <h4 className="sample-subsection-title">Status Buttons</h4>
            <div className="sample-button-row">
              <button className="sample-btn sample-btn-success">
                <CheckCircle size={16} />
                Success
              </button>
              <button className="sample-btn sample-btn-danger">
                <Trash2 size={16} />
                Danger
              </button>
              <button className="sample-btn sample-btn-warning">
                <AlertTriangle size={16} />
                Warning
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Code Block Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Code Blocks</h2>
        <pre className="sample-code">
          <code>{`{
  "zone_name": "SAN_ZONE_001",
  "fabric": "Fabric_A",
  "members": [
    "10:00:00:05:1e:0a:0b:0c",
    "50:00:09:73:00:18:ec:43"
  ],
  "status": "active"
}`}</code>
        </pre>
      </section>

      {/* Badges Section */}
      <section className="sample-section">
        <h2 className="sample-section-title">Badges & Pills</h2>
        <div className="sample-badges-container">
          <span className="sample-badge">Default</span>
          <span className="sample-badge sample-badge-primary">Primary</span>
          <span className="sample-badge sample-badge-success">Success</span>
          <span className="sample-badge sample-badge-warning">Warning</span>
          <span className="sample-badge sample-badge-danger">Danger</span>
          <span className="sample-badge sample-badge-info">Info</span>
        </div>
      </section>

      {/* TanStack Table Note */}
      <section className="sample-section">
        <h2 className="sample-section-title">TanStack Tables</h2>
        <div className="sample-alert sample-alert-info">
          <Info size={18} />
          <div>
            <strong>TanStack Table Styling:</strong> The full TanStack table example is shown below this component showcase.
            Scroll down to see the SampleTable component which demonstrates:
            <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
              <li>Sortable columns with visual indicators</li>
              <li>Hover states and row selection</li>
              <li>Status badges (Active, Inactive, Warning)</li>
              <li>Pagination controls</li>
              <li>Toolbar with action buttons</li>
              <li>All using theme variables for automatic theme support</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SamplePage;
