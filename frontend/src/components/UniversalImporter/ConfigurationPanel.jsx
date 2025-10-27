import React, { useState } from 'react';
import {
  Server,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const ConfigurationPanel = ({
  existingFabrics = [],
  selectedFabricId,
  onFabricSelect,
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
  previewData = null,
  fabricMapping = {},
  onFabricMappingChange
}) => {
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

  // Check if we have multiple fabrics that need mapping
  const hasMultipleFabrics = previewData?.fabrics && previewData.fabrics.length > 1;
  const useFabricMapping = hasMultipleFabrics && onFabricMappingChange;

  // Check if this is a switches-only import
  const isSwitchesOnly = (previewData?.counts?.switches > 0) &&
                         (previewData?.counts?.aliases === 0) &&
                         (previewData?.counts?.zones === 0);

  // Group fabrics by vendor
  const groupedFabrics = existingFabrics.reduce((acc, fabric) => {
    const vendorCode = fabric.san_vendor || 'Other';
    const vendorName = vendorCode === 'CI' ? 'Cisco' :
                       vendorCode === 'BR' ? 'Brocade' : 'Other';
    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(fabric);
    return acc;
  }, {});

  // Handle bulk conflict resolution
  const handleBulkResolve = (action) => {
    const allConflicts = [
      ...(conflicts?.zones || []).map(z => z.name),
      ...(conflicts?.aliases || []).map(a => a.name)
    ];
    allConflicts.forEach(name => onConflictResolve(name, action, renameSuffix));
  };

  return (
    <div className="configuration-panel">
      {/* Switches-Only Info Banner */}
      {isSwitchesOnly && (
        <div className="alert alert-info">
          <Info className="alert-icon" size={18} />
          <div className="alert-content">
            <div className="alert-title">Switches-Only Import</div>
            <div className="alert-message">
              Importing {previewData?.counts?.switches} switches. Fabric assignment is optional and can be configured later.
            </div>
          </div>
        </div>
      )}

      {/* Fabric Configuration Section */}
      {!isSwitchesOnly && (
        <>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Server size={20} />
            {useFabricMapping ? 'Map Source Fabrics' : 'Select Target Fabric'}
            {detectedVendor && (
              <span style={{
                padding: '4px 12px',
                background: 'var(--color-info-subtle)',
                color: 'var(--color-info-fg)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '500'
              }}>
                {detectedVendor === 'CI' ? 'Cisco' : 'Brocade'}
              </span>
            )}
          </h3>

          {/* Multi-Fabric Mapping Mode */}
          {useFabricMapping && (
            <>
              <div className="alert alert-info">
                <Info className="alert-icon" size={18} />
                <div className="alert-content">
                  <div className="alert-title">Multiple Fabrics Detected</div>
                  <div className="alert-message">
                    Your import contains {previewData.fabrics.length} fabrics. Map each to a target fabric in your database.
                  </div>
                </div>
              </div>

              {previewData.fabrics.map((sourceFabric) => {
                const mapping = fabricMapping[sourceFabric.name] || {};
                const isCreateNew = mapping.create_new;
                const selectedTargetId = mapping.fabric_id;

                return (
                  <div key={sourceFabric.name} style={{
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                    background: 'var(--secondary-bg)'
                  }}>
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <div style={{ fontWeight: '600', marginBottom: 'var(--space-1)' }}>
                        Source Fabric: {sourceFabric.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                        {sourceFabric.vsan && `VSAN ${sourceFabric.vsan}`}
                        {sourceFabric.zoneset_name && ` • Zoneset: ${sourceFabric.zoneset_name}`}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Target Fabric</label>
                      <select
                        className="form-select"
                        value={isCreateNew ? 'new' : selectedTargetId || ''}
                        onChange={(e) => {
                          if (e.target.value === 'new') {
                            onFabricMappingChange(sourceFabric.name, { create_new: true, name: sourceFabric.name });
                          } else {
                            onFabricMappingChange(sourceFabric.name, { fabric_id: parseInt(e.target.value) });
                          }
                        }}
                      >
                        <option value="">Select a fabric...</option>
                        <option value="new">Create New Fabric</option>
                        <option disabled>──────────</option>
                        {existingFabrics.map(fabric => (
                          <option key={fabric.id} value={fabric.id}>
                            {fabric.name} {fabric.vsan && `(VSAN ${fabric.vsan})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* New fabric inputs when creating new */}
                    {isCreateNew && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Fabric Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter fabric name..."
                            value={mapping.name || ''}
                            onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Zoneset Name</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={sourceFabric.zoneset_name || 'Enter zoneset name...'}
                            value={mapping.zoneset_name || ''}
                            onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, zoneset_name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">VSAN</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={sourceFabric.vsan ? `${sourceFabric.vsan}` : 'Enter VSAN...'}
                            value={mapping.vsan || ''}
                            onChange={(e) => onFabricMappingChange(sourceFabric.name, { ...mapping, vsan: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Single Fabric Mode (Legacy) */}
          {!useFabricMapping && (
            <>
              <div className="form-group">
                <label className="form-label">Target Fabric</label>
                <select
                  className="form-select"
                  value={selectedFabricId}
                  onChange={(e) => onFabricSelect(e.target.value)}
                >
                  <option value="new">Create New Fabric</option>
                  <option disabled>──────────</option>
                  {Object.entries(groupedFabrics).map(([vendor, fabrics]) => (
                    <optgroup key={vendor} label={vendor}>
                      {fabrics.map(fabric => (
                        <option key={fabric.id} value={fabric.id}>
                          {fabric.name} {fabric.vsan && `(VSAN ${fabric.vsan})`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {existingFabrics.length === 0 && (
                    <option disabled>No fabrics found</option>
                  )}
                </select>
              </div>

              {/* New Fabric Inputs */}
              {selectedFabricId === 'new' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Fabric Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter fabric name..."
                      value={fabricName}
                      onChange={(e) => onFabricNameChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Zoneset Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter zoneset name..."
                      value={zonesetName}
                      onChange={(e) => onZonesetNameChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">VSAN</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Auto-populated from import data"
                      value={vsan || ''}
                      onChange={(e) => onVsanChange(e.target.value)}
                      readOnly={!!vsan}
                      style={{ background: vsan ? 'var(--secondary-bg)' : 'var(--form-input-bg)' }}
                    />
                    {vsan && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)' }}>
                        <Info size={14} style={{ display: 'inline', marginRight: 'var(--space-1)' }} />
                        Auto-populated from imported data
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Conflict Resolution Section */}
      {conflicts && ((conflicts.zones && conflicts.zones.length > 0) || (conflicts.aliases && conflicts.aliases.length > 0)) && (
        <div className="conflict-resolution-section">
          <div className="conflict-resolution-header">
            <AlertCircle size={20} />
            <span>Conflict Resolution</span>
            <span style={{
              marginLeft: 'auto',
              padding: 'var(--space-1) var(--space-3)',
              background: 'var(--color-attention-subtle)',
              color: 'var(--color-attention-fg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600'
            }}>
              {(conflicts.zones?.length || 0) + (conflicts.aliases?.length || 0)} conflicts
            </span>
          </div>

          {/* Bulk Actions */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--secondary-bg)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)'
          }}>
            <div style={{ marginBottom: 'var(--space-3)', fontWeight: '600' }}>
              Apply to All Conflicts:
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <button
                className="conflict-btn"
                onClick={() => handleBulkResolve('skip')}
              >
                Skip All
              </button>
              <button
                className="conflict-btn"
                onClick={() => handleBulkResolve('replace')}
              >
                Replace All
              </button>
              <button
                className="conflict-btn"
                onClick={() => handleBulkResolve('rename')}
              >
                Import Duplicates
              </button>
            </div>

            {/* Rename Suffix */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', minWidth: 'fit-content' }}>
                Duplicate Suffix:
              </label>
              <input
                type="text"
                className="form-input"
                value={renameSuffix}
                onChange={(e) => setRenameSuffix(e.target.value)}
                placeholder="_copy"
                style={{ maxWidth: '150px' }}
              />
              {conflicts.zones?.[0] && (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)', fontStyle: 'italic' }}>
                  Preview: {conflicts.zones[0].name}{renameSuffix}
                </span>
              )}
            </div>

            <div style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-success-fg)',
              fontWeight: '500'
            }}>
              {Object.keys(conflictResolutions).length} of {(conflicts.zones?.length || 0) + (conflicts.aliases?.length || 0)} conflicts resolved
            </div>
          </div>

          {/* Alias Conflicts */}
          {conflicts.aliases && conflicts.aliases.length > 0 && (
            <>
              <div
                onClick={() => toggleConflictSection('aliases')}
                style={{
                  fontWeight: '600',
                  marginBottom: 'var(--space-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}
              >
                {expandedConflictSections.aliases ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Alias Conflicts ({conflicts.aliases.length})
              </div>
              {expandedConflictSections.aliases && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  {conflicts.aliases.map((conflict, index) => (
                    <div key={`alias-${index}`} className="conflict-item">
                      <div className="conflict-item-header">
                        <div className="conflict-name">{conflict.name}</div>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted-text)', marginBottom: 'var(--space-2)' }}>
                        <div>Existing: {conflict.existing_wwpn} in {conflict.existing_fabric}</div>
                        <div>New: {conflict.new_wwpn} in {conflict.new_fabric}</div>
                      </div>
                      <div className="conflict-actions">
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name] === 'skip' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'skip')}
                        >
                          Skip
                        </button>
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name] === 'replace' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'replace')}
                        >
                          Replace
                        </button>
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name]?.action === 'rename' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'rename', renameSuffix)}
                        >
                          Import Duplicate
                        </button>
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
                  marginBottom: 'var(--space-2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}
              >
                {expandedConflictSections.zones ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Zone Conflicts ({conflicts.zones.length})
              </div>
              {expandedConflictSections.zones && (
                <div>
                  {conflicts.zones.map((conflict, index) => (
                    <div key={`zone-${index}`} className="conflict-item">
                      <div className="conflict-item-header">
                        <div className="conflict-name">{conflict.name}</div>
                      </div>
                      <div className="conflict-actions">
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name] === 'skip' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'skip')}
                        >
                          Skip
                        </button>
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name] === 'replace' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'replace')}
                        >
                          Replace
                        </button>
                        <button
                          className={`conflict-btn ${conflictResolutions[conflict.name]?.action === 'rename' ? 'selected' : ''}`}
                          onClick={() => onConflictResolve(conflict.name, 'rename', renameSuffix)}
                        >
                          Import Duplicate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;
