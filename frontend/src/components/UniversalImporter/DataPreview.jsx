import React, { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Database,
  GitBranch,
  Server
} from 'lucide-react';

const DataPreview = ({
  previewData,
  selectedAliases,
  selectedZones,
  selectedFabrics,
  onAliasToggle,
  onZoneToggle,
  onFabricToggle,
  onSelectAll,
  conflicts
}) => {
  const [expandedSections, setExpandedSections] = useState({
    aliases: true,
    zones: true,
    fabrics: true,
    switches: true
  });

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Check if all items in a section are selected
  const isAllSelected = useCallback((type) => {
    const items = previewData?.[type] || [];
    if (items.length === 0) return false;

    const selectedSet = type === 'aliases' ? selectedAliases :
                       type === 'zones' ? selectedZones : selectedFabrics;

    return items.every(item => {
      const key = `${item.name}_${item.fabric || 'default'}`;
      return selectedSet.has(key);
    });
  }, [previewData, selectedAliases, selectedZones, selectedFabrics]);

  // Stats cards data
  const stats = [
    {
      icon: Database,
      label: 'Aliases',
      value: previewData?.counts?.aliases || 0,
      selected: selectedAliases.size,
      color: 'primary'
    },
    {
      icon: GitBranch,
      label: 'Zones',
      value: previewData?.counts?.zones || 0,
      selected: selectedZones.size,
      color: 'success'
    },
    {
      icon: Server,
      label: 'Fabrics',
      value: previewData?.counts?.fabrics || 0,
      selected: 0, // Fabrics are not selectable - they are created or selected as targets
      color: 'info'
    },
    ...(previewData?.counts?.switches > 0 ? [{
      icon: Server,
      label: 'Switches',
      value: previewData?.counts?.switches || 0,
      selected: 0,
      color: 'warning'
    }] : [])
  ];

  return (
    <div className="data-preview">
      {/* Parser Info */}
      {previewData?.parser && (
        <div className="alert alert-info">
          <Info className="alert-icon" size={18} />
          <div className="alert-content">
            <div className="alert-title">Detected Format: {previewData.parser}</div>
            {previewData.warnings && previewData.warnings.length > 0 && (
              <div className="alert-message">{previewData.warnings.length} warnings found</div>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="preview-stats">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="stat-header">
                <div className={`stat-icon ${stat.color}`}>
                  <Icon size={20} />
                </div>
                <div className="stat-label">{stat.label}</div>
              </div>
              <div className="stat-value">{stat.value}</div>
              {stat.selected > 0 && (
                <div className="stat-subtext">{stat.selected} selected</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aliases Section */}
      {previewData?.aliases && previewData.aliases.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header" onClick={() => toggleSection('aliases')}>
            <div className="preview-section-title">
              {expandedSections.aliases ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              <Database size={18} />
              <span>Aliases ({previewData.aliases.length})</span>
              {conflicts && conflicts.aliases?.length > 0 && (
                <span className="conflict-badge">
                  <AlertTriangle size={14} />
                  {conflicts.aliases.length} conflicts
                </span>
              )}
            </div>
            <div className="preview-section-actions">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll('aliases');
                }}
              >
                {isAllSelected('aliases') ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {expandedSections.aliases && (
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="preview-checkbox"
                        checked={isAllSelected('aliases')}
                        onChange={() => onSelectAll('aliases')}
                      />
                    </th>
                    <th>Name</th>
                    <th>WWPN</th>
                    <th>Type</th>
                    <th>Fabric</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.aliases.map((alias) => {
                    const key = `${alias.name}_${alias.fabric || 'default'}`;
                    const isSelected = selectedAliases.has(key);
                    const hasConflict = conflicts?.aliases?.some(c => c.name === alias.name);

                    // Handle both single wwpn and multiple wwpns
                    const wwpns = alias.wwpns || (alias.wwpn ? [alias.wwpn] : []);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? 'selected' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="preview-checkbox"
                            checked={isSelected}
                            onChange={() => onAliasToggle(key)}
                          />
                        </td>
                        <td>
                          {alias.name}
                          {hasConflict && (
                            <AlertTriangle
                              size={14}
                              style={{ marginLeft: '8px', color: 'var(--color-attention-fg)' }}
                            />
                          )}
                        </td>
                        <td>
                          <code>
                            {wwpns[0]}
                            {wwpns.length > 1 && (
                              <span style={{ marginLeft: '4px', color: 'var(--color-accent-fg)', fontWeight: '600' }}>
                                (+{wwpns.length - 1})
                              </span>
                            )}
                          </code>
                        </td>
                        <td>{alias.type || 'device'}</td>
                        <td>{alias.fabric || 'default'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Zones Section */}
      {previewData?.zones && previewData.zones.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header" onClick={() => toggleSection('zones')}>
            <div className="preview-section-title">
              {expandedSections.zones ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              <GitBranch size={18} />
              <span>Zones ({previewData.zones.length})</span>
              {conflicts && conflicts.zones?.length > 0 && (
                <span className="conflict-badge">
                  <AlertTriangle size={14} />
                  {conflicts.zones.length} conflicts
                </span>
              )}
            </div>
            <div className="preview-section-actions">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll('zones');
                }}
              >
                {isAllSelected('zones') ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {expandedSections.zones && (
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="preview-checkbox"
                        checked={isAllSelected('zones')}
                        onChange={() => onSelectAll('zones')}
                      />
                    </th>
                    <th>Name</th>
                    <th>Members</th>
                    <th>Type</th>
                    <th>Fabric</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.zones.map((zone) => {
                    const key = `${zone.name}_${zone.fabric || 'default'}`;
                    const isSelected = selectedZones.has(key);
                    const hasConflict = conflicts?.zones?.some(c => c.name === zone.name);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? 'selected' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="preview-checkbox"
                            checked={isSelected}
                            onChange={() => onZoneToggle(key)}
                          />
                        </td>
                        <td>
                          {zone.name}
                          {hasConflict && (
                            <AlertTriangle
                              size={14}
                              style={{ marginLeft: '8px', color: 'var(--color-attention-fg)' }}
                            />
                          )}
                        </td>
                        <td>
                          {zone.members?.slice(0, 3).join(', ')}
                          {zone.members?.length > 3 && (
                            <span style={{ marginLeft: '4px', color: 'var(--muted-text)' }}>
                              (+{zone.members.length - 3} more)
                            </span>
                          )}
                        </td>
                        <td>{zone.type || 'standard'}</td>
                        <td>{zone.fabric || 'default'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fabrics Section - Informational only, no checkboxes */}
      {previewData?.fabrics && previewData.fabrics.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header" onClick={() => toggleSection('fabrics')}>
            <div className="preview-section-title">
              {expandedSections.fabrics ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              <Server size={18} />
              <span>Detected Fabrics ({previewData.fabrics.length})</span>
            </div>
          </div>

          {expandedSections.fabrics && (
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>VSAN</th>
                    <th>Zoneset</th>
                    <th>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.fabrics.map((fabric) => {
                    const key = `${fabric.name}_${fabric.vsan || 'default'}`;

                    return (
                      <tr key={key}>
                        <td>{fabric.name}</td>
                        <td>{fabric.vsan || '-'}</td>
                        <td>{fabric.zoneset_name || '-'}</td>
                        <td>{fabric.san_vendor || fabric.vendor || 'Unknown'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Switches Section (Read-only, no checkboxes) */}
      {previewData?.switches && previewData.switches.length > 0 && (
        <div className="preview-section">
          <div className="preview-section-header" onClick={() => toggleSection('switches')}>
            <div className="preview-section-title">
              {expandedSections.switches ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              <Server size={18} />
              <span>Switches ({previewData.switches.length})</span>
            </div>
          </div>

          {expandedSections.switches && (
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>WWNN</th>
                    <th>Model</th>
                    <th>Firmware</th>
                    <th>IP Address</th>
                    <th>Domain ID</th>
                    <th>Fabric</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.switches.map((sw, idx) => (
                    <tr key={idx}>
                      <td>{sw.name}</td>
                      <td><code>{sw.wwnn || '-'}</code></td>
                      <td>{sw.model || '-'}</td>
                      <td>{sw.firmware_version || '-'}</td>
                      <td>{sw.ip_address || '-'}</td>
                      <td>{sw.domain_id !== null && sw.domain_id !== undefined ? sw.domain_id : '-'}</td>
                      <td>{sw.fabric || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          background: sw.is_active ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
                          color: sw.is_active ? 'var(--color-success-fg)' : 'var(--color-danger-fg)'
                        }}>
                          {sw.is_active ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataPreview;
