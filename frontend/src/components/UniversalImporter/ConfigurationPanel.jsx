import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import {
  Settings,
  Plus,
  Server,
  AlertCircle,
  Info,
  Search,
  Check,
  ChevronDown,
  ChevronRight
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
  zonesetName,
  onZonesetNameChange,
  vsan,
  onVsanChange,
  conflicts,
  conflictResolutions,
  onConflictResolve,
  detectedVendor,
  theme,
  onStartImport,
  canStartImport = false,
  // NEW: Fabric mapping props
  previewData = null,
  fabricMapping = {},
  onFabricMappingChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedConflictSections, setExpandedConflictSections] = useState({
    aliases: true,
    zones: true
  });
  const [renameSuffix, setRenameSuffix] = useState('_copy');

  const toggleConflictSection = (section) => {
    setExpandedConflictSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get first conflict name for preview
  const getFirstConflictName = () => {
    if (conflicts?.aliases?.length > 0) {
      return conflicts.aliases[0].name;
    } else if (conflicts?.zones?.length > 0) {
      return conflicts.zones[0].name;
    }
    return null;
  };

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

  // Check if we have multiple fabrics that need mapping
  const hasMultipleFabrics = previewData?.fabrics && previewData.fabrics.length > 1;
  const useFabricMapping = hasMultipleFabrics && onFabricMappingChange;

  // Check if this is a switches-only import
  const isSwitchesOnly = (previewData?.counts?.switches > 0) &&
                         (previewData?.counts?.aliases === 0) &&
                         (previewData?.counts?.zones === 0);

  return (
    <div className={`configuration-panel theme-${theme}`}>
      {!isSwitchesOnly && (
        <>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Server size={24} />
            {useFabricMapping ? 'Map Source Fabrics to Database' : 'Select Target Fabric'}
            {detectedVendor && (
              <span style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: 'var(--color-info-subtle)',
                color: 'var(--color-info-emphasis)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                {detectedVendor === 'CI' ? 'Cisco' : 'Brocade'}
              </span>
            )}
          </h3>
        </>
      )}

      {isSwitchesOnly && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--color-accent-subtle)',
          border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Info size={18} style={{ color: 'var(--color-accent-fg)' }} />
            <span style={{ fontWeight: '600', color: theme === 'dark' ? 'var(--color-accent-fg)' : 'var(--color-accent-emphasis)' }}>
              Switches-Only Import
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: theme === 'dark' ? 'var(--color-fg-muted)' : 'var(--color-fg-muted)' }}>
            Importing {previewData?.counts?.switches} switches. Fabric assignment is optional and can be configured later.
          </p>
        </div>
      )}

      {/* Fabric Mapping Mode - Show mapping UI for multiple fabrics */}
      {!isSwitchesOnly && useFabricMapping && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            backgroundColor: 'var(--color-accent-subtle)',
            border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Info size={16} style={{ color: 'var(--color-accent-fg)' }} />
              <span style={{ fontWeight: '600', color: theme === 'dark' ? 'var(--color-accent-fg)' : 'var(--color-accent-emphasis)' }}>
                Multiple Fabrics Detected
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: theme === 'dark' ? 'var(--color-fg-muted)' : 'var(--color-fg-muted)' }}>
              Your import data contains {previewData.fabrics.length} fabrics. Map each source fabric to a target fabric in your database.
            </p>
          </div>

          {previewData.fabrics.map((sourceFabric) => {
            const mapping = fabricMapping[sourceFabric.name] || {};
            const isCreateNew = mapping.create_new;
            const selectedTargetId = mapping.fabric_id;

            return (
              <div key={sourceFabric.name} style={{
                border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: 'var(--color-canvas-subtle)'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    Source Fabric: {sourceFabric.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
                    {sourceFabric.vsan && `VSAN ${sourceFabric.vsan}`}
                    {sourceFabric.zoneset_name && ` • Zoneset: ${sourceFabric.zoneset_name}`}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                    Target Fabric
                  </label>
                  <Dropdown className="fabric-dropdown-wrapper">
                    <Dropdown.Toggle variant="outline-secondary" style={{ width: '100%', textAlign: 'left' }}>
                      {isCreateNew ? 'Create New Fabric' :
                       selectedTargetId ? existingFabrics.find(f => f.id === selectedTargetId)?.name || 'Select a Fabric' :
                       'Select a Fabric'}
                    </Dropdown.Toggle>
                    <Dropdown.Menu style={{ maxHeight: '300px', overflow: 'auto', width: '100%' }}>
                      <Dropdown.Item onClick={() => onFabricMappingChange(sourceFabric.name, { create_new: true })}>
                        <Plus size={16} style={{ marginRight: '8px' }} />
                        Create New Fabric
                        {isCreateNew && <Check size={16} style={{ marginLeft: 'auto' }} />}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      {existingFabrics.map(fabric => (
                        <Dropdown.Item
                          key={fabric.id}
                          onClick={() => onFabricMappingChange(sourceFabric.name, { fabric_id: fabric.id })}
                          active={selectedTargetId === fabric.id}
                        >
                          <Server size={16} style={{ marginRight: '8px' }} />
                          {fabric.name}
                          {fabric.vsan && <span style={{ marginLeft: '8px', color: 'var(--color-fg-muted)' }}>VSAN {fabric.vsan}</span>}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                {/* Show new fabric inputs if creating new */}
                {isCreateNew && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                        Fabric Name <span style={{ color: 'var(--color-danger-emphasis)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Enter fabric name..."
                        value={mapping.name || ''}
                        onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                        Zoneset Name
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={sourceFabric.zoneset_name || 'Enter zoneset name...'}
                        value={mapping.zoneset_name || ''}
                        onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, zoneset_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                        VSAN
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={sourceFabric.vsan ? `${sourceFabric.vsan}` : 'Enter VSAN...'}
                        value={mapping.vsan || ''}
                        onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, vsan: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy Single Fabric Mode */}
      {!isSwitchesOnly && !useFabricMapping && (
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
                    {fabric.vsan && <span style={{ marginLeft: '8px', color: 'var(--color-fg-muted)' }}>VSAN {fabric.vsan}</span>}
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
      )}

      {/* New Fabric Inputs - Legacy Single Fabric Mode */}
      {!isSwitchesOnly && !useFabricMapping && selectedFabricId === 'new' && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
              Fabric Name <span style={{ color: 'var(--color-danger-emphasis)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Enter fabric name..."
              value={fabricName}
              onChange={(e) => onFabricNameChange(e.target.value)}
              className="form-control"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
              Zoneset Name <span style={{ color: 'var(--color-danger-emphasis)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Enter zoneset name..."
              value={zonesetName}
              onChange={(e) => onZonesetNameChange(e.target.value)}
              className="form-control"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
              VSAN
            </label>
            <input
              type="text"
              placeholder="Auto-populated from import data"
              value={vsan || ''}
              onChange={(e) => onVsanChange(e.target.value)}
              className="form-control"
              readOnly={!!vsan}
              style={{ backgroundColor: vsan ? 'var(--secondary-bg)' : 'white' }}
            />
            {vsan && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
                <Info size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Auto-populated from imported data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conflict Resolution */}
      {conflicts && ((conflicts.zones && conflicts.zones.length > 0) || (conflicts.aliases && conflicts.aliases.length > 0)) && (
        <div style={{ marginTop: '2rem' }}>
        <div className="config-section">
          <div className="section-label">
            <AlertCircle size={18} className="warning-icon" />
            <span>Conflict Resolution</span>
            <div className="conflict-count">
              {(conflicts.zones?.length || 0) + (conflicts.aliases?.length || 0)} conflicts
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="bulk-actions" style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--color-canvas-subtle)',
            borderRadius: '8px',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Apply to All:</div>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '500',
                color: theme === 'dark' ? 'var(--color-success-emphasis)' : 'var(--color-success-emphasis)',
                backgroundColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                border: `1px solid ${theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(5, 150, 105, 0.3)'}`
              }}>
                {Object.keys(conflictResolutions).length} of {(conflicts.zones?.length || 0) + (conflicts.aliases?.length || 0)} conflicts resolved
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const allConflicts = [
                    ...(conflicts.zones || []).map(z => z.name),
                    ...(conflicts.aliases || []).map(a => a.name)
                  ];
                  allConflicts.forEach(name => onConflictResolve(name, 'skip'));
                }}
              >
                Skip All
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const allConflicts = [
                    ...(conflicts.zones || []).map(z => z.name),
                    ...(conflicts.aliases || []).map(a => a.name)
                  ];
                  allConflicts.forEach(name => onConflictResolve(name, 'replace'));
                }}
              >
                Replace All
              </button>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => {
                  const allConflicts = [
                    ...(conflicts.zones || []).map(z => z.name),
                    ...(conflicts.aliases || []).map(a => a.name)
                  ];
                  allConflicts.forEach(name => onConflictResolve(name, 'rename', renameSuffix));
                }}
              >
                Import Duplicate for All
              </button>
            </div>

            {/* Rename Suffix Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '500', minWidth: 'fit-content' }}>
                Duplicate Suffix:
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={renameSuffix}
                onChange={(e) => setRenameSuffix(e.target.value)}
                placeholder="_copy"
                style={{ maxWidth: '150px' }}
              />
              {getFirstConflictName() && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                  Preview: {getFirstConflictName()}{renameSuffix}
                </span>
              )}
            </div>

            {/* Start Import Button */}
            {onStartImport && (
              <div style={{ borderTop: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, paddingTop: '0.75rem' }}>
                <button
                  className="btn btn-success"
                  onClick={onStartImport}
                  disabled={!canStartImport}
                  style={{
                    width: '100%',
                    fontWeight: '600',
                    padding: '0.5rem 1rem'
                  }}
                >
                  Start Import
                </button>
              </div>
            )}
          </div>

          {/* Alias Conflicts */}
          {conflicts.aliases && conflicts.aliases.length > 0 && (
            <>
              <div
                onClick={() => toggleConflictSection('aliases')}
                style={{
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {expandedConflictSections.aliases ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Alias Conflicts ({conflicts.aliases.length})
              </div>
              {expandedConflictSections.aliases && (
              <div className="conflict-list">
                {conflicts.aliases.map((conflict, index) => (
                  <div key={`alias-${index}`} className="conflict-item">
                    <div className="conflict-header">
                      <div className="conflict-name">
                        <span className="conflict-label">Alias:</span>
                        <code>{conflict.name}</code>
                      </div>
                      <div className="conflict-type">Duplicate Found</div>
                    </div>

                    <div className="conflict-details" style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)', marginBottom: '0.5rem' }}>
                      <div>Existing: {conflict.existing_wwpn} in {conflict.existing_fabric} {conflict.existing_use && `[${conflict.existing_use}]`}</div>
                      <div>New: {conflict.new_wwpn} in {conflict.new_fabric} {conflict.new_use && `[${conflict.new_use}]`}</div>
                    </div>

                    <div className="conflict-options">
                      <label className="conflict-option">
                        <input
                          type="radio"
                          name={`alias-conflict-${index}`}
                          value="skip"
                          checked={conflictResolutions[conflict.name] === 'skip'}
                          onChange={() => onConflictResolve(conflict.name, 'skip')}
                        />
                        <div className="option-content">
                          <span className="option-title">Skip</span>
                          <span className="option-desc">Don't import this alias</span>
                        </div>
                      </label>

                      <label className="conflict-option">
                        <input
                          type="radio"
                          name={`alias-conflict-${index}`}
                          value="replace"
                          checked={conflictResolutions[conflict.name] === 'replace'}
                          onChange={() => onConflictResolve(conflict.name, 'replace')}
                        />
                        <div className="option-content">
                          <span className="option-title">Replace</span>
                          <span className="option-desc">Overwrite existing alias</span>
                        </div>
                      </label>

                      <label className="conflict-option">
                        <input
                          type="radio"
                          name={`alias-conflict-${index}`}
                          value="rename"
                          checked={conflictResolutions[conflict.name] === 'rename'}
                          onChange={() => onConflictResolve(conflict.name, 'rename', renameSuffix)}
                        />
                        <div className="option-content">
                          <span className="option-title">Import Duplicate</span>
                          <span className="option-desc">Import as {conflict.name}{renameSuffix}</span>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </>
          )}

          {/* Zone Conflicts */}
          {conflicts.zones && conflicts.zones.length > 0 && (
            <>
              <div
                onClick={() => toggleConflictSection('zones')}
                style={{
                  fontWeight: '600',
                  marginTop: '1rem',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {expandedConflictSections.zones ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Zone Conflicts ({conflicts.zones.length})
              </div>
              {expandedConflictSections.zones && (
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
                      onChange={() => onConflictResolve(conflict.name, 'rename', renameSuffix)}
                    />
                    <div className="option-content">
                      <span className="option-title">Import Duplicate</span>
                      <span className="option-desc">Import as {conflict.name}{renameSuffix}</span>
                    </div>
                  </label>
                </div>
              </div>
            ))}
              </div>
              )}
            </>
          )}

          <div className="conflict-summary">
            <Info size={16} />
            <span>
              {Object.keys(conflictResolutions).length} of {(conflicts.zones?.length || 0) + (conflicts.aliases?.length || 0)} conflicts resolved
            </span>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;