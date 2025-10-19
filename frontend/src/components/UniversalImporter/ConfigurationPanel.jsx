import React, { useState } from 'react';
import {
  Settings,
  Plus,
  Server,
  AlertCircle,
  Info,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import './styles/ConfigurationPanel.css';

const ConfigurationPanel = ({
  existingFabrics,
  selectedFabricId,
  onFabricSelect,
  createNewFabric,
  onCreateNewToggle,
  fabricName,
  onFabricNameChange,
  conflicts,
  conflictResolutions,
  onConflictResolve,
  theme
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Group fabrics by vendor
  const groupedFabrics = existingFabrics.reduce((acc, fabric) => {
    const vendor = fabric.vendor || 'Other';
    if (!acc[vendor]) acc[vendor] = [];
    acc[vendor].push(fabric);
    return acc;
  }, {});

  // Filter fabrics based on search
  const filteredFabrics = existingFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fabric.vsan?.toString().includes(searchTerm)
  );

  // Handle fabric selection
  const handleFabricSelect = (fabricId) => {
    onFabricSelect(fabricId);
    setShowDropdown(false);
    setSearchTerm('');
  };

  // Get selected fabric name
  const getSelectedFabricName = () => {
    if (selectedFabricId === 'new') {
      return createNewFabric ? 'Create New Fabric' : 'Select a Fabric';
    }
    const fabric = existingFabrics.find(f => f.id === selectedFabricId);
    return fabric ? `${fabric.name} (VSAN ${fabric.vsan})` : 'Select a Fabric';
  };

  return (
    <div className={`configuration-panel theme-${theme}`}>
      <div className="config-header">
        <div className="config-icon">
          <Settings size={24} />
        </div>
        <div className="config-title">
          <h3>Import Configuration</h3>
          <p>Configure how the data will be imported into your system</p>
        </div>
      </div>

      {/* Fabric Selection */}
      <div className="config-section">
        <div className="section-label">
          <Server size={18} />
          <span>Target Fabric</span>
          <div className="required-badge">Required</div>
        </div>

        <div className="fabric-selector">
          {/* Custom Dropdown */}
          <div className="custom-dropdown">
            <button
              className="dropdown-trigger"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="dropdown-value">{getSelectedFabricName()}</span>
              <ChevronDown size={18} className={showDropdown ? 'rotated' : ''} />
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                {/* Search Box */}
                <div className="dropdown-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search fabrics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Create New Option */}
                <div
                  className={`dropdown-item create-new ${selectedFabricId === 'new' ? 'selected' : ''}`}
                  onClick={() => handleFabricSelect('new')}
                >
                  <Plus size={16} />
                  <span>Create New Fabric</span>
                  {selectedFabricId === 'new' && <Check size={16} className="check-icon" />}
                </div>

                <div className="dropdown-divider" />

                {/* Existing Fabrics */}
                {Object.entries(groupedFabrics).map(([vendor, fabrics]) => {
                  const vendorFabrics = searchTerm
                    ? fabrics.filter(f => filteredFabrics.includes(f))
                    : fabrics;

                  if (vendorFabrics.length === 0) return null;

                  return (
                    <div key={vendor} className="dropdown-group">
                      <div className="dropdown-group-label">{vendor}</div>
                      {vendorFabrics.map(fabric => (
                        <div
                          key={fabric.id}
                          className={`dropdown-item ${selectedFabricId === fabric.id ? 'selected' : ''}`}
                          onClick={() => handleFabricSelect(fabric.id)}
                        >
                          <Server size={16} />
                          <div className="dropdown-item-content">
                            <span className="fabric-name">{fabric.name}</span>
                            <span className="fabric-vsan">VSAN {fabric.vsan}</span>
                          </div>
                          {selectedFabricId === fabric.id && <Check size={16} className="check-icon" />}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {filteredFabrics.length === 0 && searchTerm && (
                  <div className="dropdown-empty">No fabrics found</div>
                )}
              </div>
            )}
          </div>

          {/* New Fabric Name Input */}
          {selectedFabricId === 'new' && (
            <div className="new-fabric-input">
              <input
                type="text"
                placeholder="Enter new fabric name..."
                value={fabricName}
                onChange={(e) => onFabricNameChange(e.target.value)}
                className="fabric-name-input"
              />
              <div className="input-hint">
                <Info size={14} />
                <span>This will create a new fabric in your system</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conflict Resolution */}
      {conflicts && conflicts.zones && conflicts.zones.length > 0 && (
        <div className="config-section">
          <div className="section-label">
            <AlertCircle size={18} className="warning-icon" />
            <span>Conflict Resolution</span>
            <div className="conflict-count">{conflicts.zones.length} conflicts</div>
          </div>

          <div className="conflict-list">
            {conflicts.zones.map((conflict, index) => (
              <div key={index} className="conflict-item">
                <div className="conflict-header">
                  <div className="conflict-name">
                    <span className="conflict-label">Zone:</span>
                    <code>{conflict.name}</code>
                  </div>
                  <div className="conflict-type">Duplicate Found</div>
                </div>

                <div className="conflict-options">
                  <label className="conflict-option">
                    <input
                      type="radio"
                      name={`conflict-${index}`}
                      value="skip"
                      checked={conflictResolutions[conflict.name] === 'skip'}
                      onChange={() => onConflictResolve(conflict.name, 'skip')}
                    />
                    <div className="option-content">
                      <span className="option-title">Skip</span>
                      <span className="option-desc">Don't import this zone</span>
                    </div>
                  </label>

                  <label className="conflict-option">
                    <input
                      type="radio"
                      name={`conflict-${index}`}
                      value="replace"
                      checked={conflictResolutions[conflict.name] === 'replace'}
                      onChange={() => onConflictResolve(conflict.name, 'replace')}
                    />
                    <div className="option-content">
                      <span className="option-title">Replace</span>
                      <span className="option-desc">Overwrite existing zone</span>
                    </div>
                  </label>

                  <label className="conflict-option">
                    <input
                      type="radio"
                      name={`conflict-${index}`}
                      value="rename"
                      checked={conflictResolutions[conflict.name] === 'rename'}
                      onChange={() => onConflictResolve(conflict.name, 'rename')}
                    />
                    <div className="option-content">
                      <span className="option-title">Rename</span>
                      <span className="option-desc">Import with new name</span>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="conflict-summary">
            <Info size={16} />
            <span>
              {Object.keys(conflictResolutions).length} of {conflicts.zones.length} conflicts resolved
            </span>
          </div>
        </div>
      )}

      {/* Import Options */}
      <div className="config-section">
        <div className="section-label">
          <Settings size={18} />
          <span>Import Options</span>
        </div>

        <div className="import-options">
          <label className="option-checkbox">
            <input type="checkbox" defaultChecked />
            <div className="checkbox-content">
              <span className="checkbox-label">Validate WWPNs</span>
              <span className="checkbox-desc">Ensure all WWPNs are in valid format</span>
            </div>
          </label>

          <label className="option-checkbox">
            <input type="checkbox" defaultChecked />
            <div className="checkbox-content">
              <span className="checkbox-label">Auto-create aliases</span>
              <span className="checkbox-desc">Create aliases for unrecognized WWPNs</span>
            </div>
          </label>

          <label className="option-checkbox">
            <input type="checkbox" />
            <div className="checkbox-content">
              <span className="checkbox-label">Dry run</span>
              <span className="checkbox-desc">Preview changes without importing</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationPanel;