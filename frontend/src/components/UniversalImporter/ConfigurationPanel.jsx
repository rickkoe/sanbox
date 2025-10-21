import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import {
  Settings,
  Plus,
  Server,
  AlertCircle,
  Info,
  Search,
  Check
} from 'lucide-react';
import './styles/ConfigurationPanel.css';

const ConfigurationPanel = ({
  existingFabrics = [],  // Default to empty array
  selectedFabricId,
  onFabricSelect,
  createNewFabric,
  onCreateNewToggle,
  fabricName,
  onFabricNameChange,
  conflicts,
  conflictResolutions,
  onConflictResolve,
  detectedVendor,
  theme
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Group fabrics by vendor
  const groupedFabrics = existingFabrics.reduce((acc, fabric) => {
    // Use san_vendor field and map to display name
    const vendorCode = fabric.san_vendor || 'Other';
    const vendorName = vendorCode === 'CI' ? 'Cisco' :
                       vendorCode === 'BR' ? 'Brocade' :
                       'Other';
    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(fabric);
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
    setSearchTerm('');
  };

  // Get selected fabric name
  const getSelectedFabricName = () => {
    if (selectedFabricId === 'new') {
      return createNewFabric ? 'Create New Fabric' : 'Select a Fabric';
    }
    const fabric = existingFabrics.find(f => f.id === selectedFabricId);
    if (fabric) {
      return fabric.vsan ? `${fabric.name} (VSAN ${fabric.vsan})` : fabric.name;
    }
    return 'Select a Fabric';
  };

  return (
    <div className={`configuration-panel theme-${theme}`}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Server size={24} />
        Select Target Fabric
        {detectedVendor && (
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            {detectedVendor === 'CI' ? 'Cisco' : 'Brocade'}
          </span>
        )}
      </h3>

      <Dropdown className="fabric-dropdown-wrapper">
        <Dropdown.Toggle variant="outline-secondary" style={{ minWidth: '300px', textAlign: 'left' }}>
          {getSelectedFabricName()}
        </Dropdown.Toggle>

        <Dropdown.Menu className="fabric-dropdown-menu" style={{ maxHeight: '400px', overflow: 'auto', minWidth: '300px' }}>
          {/* Search */}
          <div style={{ padding: '8px' }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search fabrics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <Dropdown.Divider />

          {/* Create New Option */}
          <Dropdown.Item onClick={() => handleFabricSelect('new')}>
            <Plus size={16} style={{ marginRight: '8px' }} />
            Create New Fabric
            {selectedFabricId === 'new' && <Check size={16} style={{ marginLeft: 'auto' }} />}
          </Dropdown.Item>

          <Dropdown.Divider />

          {/* Existing Fabrics */}
          {Object.entries(groupedFabrics).map(([vendor, fabrics]) => {
            const vendorFabrics = searchTerm
              ? fabrics.filter(f => filteredFabrics.includes(f))
              : fabrics;

            if (vendorFabrics.length === 0) return null;

            return (
              <div key={vendor}>
                <Dropdown.Header>{vendor}</Dropdown.Header>
                {vendorFabrics.map(fabric => (
                  <Dropdown.Item
                    key={fabric.id}
                    onClick={() => handleFabricSelect(fabric.id)}
                    active={selectedFabricId === fabric.id}
                  >
                    <Server size={16} style={{ marginRight: '8px' }} />
                    {fabric.name}
                    {fabric.vsan && <span style={{ marginLeft: '8px', color: '#6c757d' }}>VSAN {fabric.vsan}</span>}
                  </Dropdown.Item>
                ))}
              </div>
            );
          })}

          {filteredFabrics.length === 0 && existingFabrics.length === 0 && (
            <Dropdown.ItemText>
              No {detectedVendor === 'CI' ? 'Cisco' : detectedVendor === 'BR' ? 'Brocade' : ''} fabrics found
            </Dropdown.ItemText>
          )}
        </Dropdown.Menu>
      </Dropdown>

      {/* New Fabric Name Input */}
      {selectedFabricId === 'new' && (
        <div style={{ marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Enter new fabric name..."
            value={fabricName}
            onChange={(e) => onFabricNameChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '1rem'
            }}
          />
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <Info size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
            This will create a new fabric in your system
          </div>
        </div>
      )}

      {/* Conflict Resolution */}
      {conflicts && conflicts.zones && conflicts.zones.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
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
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;