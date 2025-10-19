import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
  Database,
  GitBranch,
  Server,
  Search,
  Filter,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import './styles/DataPreview.css';

const DataPreview = ({
  previewData,
  selectedAliases,
  selectedZones,
  selectedFabrics,
  onAliasToggle,
  onZoneToggle,
  onFabricToggle,
  onSelectAll,
  onDeselectAll,
  conflicts,
  theme
}) => {
  const [expandedSections, setExpandedSections] = useState({
    aliases: true,
    zones: true,
    fabrics: true
  });
  const [searchTerms, setSearchTerms] = useState({
    aliases: '',
    zones: '',
    fabrics: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Filter data based on search terms
  const filteredData = useMemo(() => {
    const filterItems = (items, searchTerm, type) => {
      if (!searchTerm) return items;
      const term = searchTerm.toLowerCase();

      switch (type) {
        case 'aliases':
          return items.filter(item =>
            item.name?.toLowerCase().includes(term) ||
            item.wwpn?.toLowerCase().includes(term)
          );
        case 'zones':
          return items.filter(item =>
            item.name?.toLowerCase().includes(term) ||
            item.members?.some(m => m.toLowerCase().includes(term))
          );
        case 'fabrics':
          return items.filter(item =>
            item.name?.toLowerCase().includes(term) ||
            item.vsan?.toString().includes(term)
          );
        default:
          return items;
      }
    };

    return {
      aliases: filterItems(previewData?.aliases || [], searchTerms.aliases, 'aliases'),
      zones: filterItems(previewData?.zones || [], searchTerms.zones, 'zones'),
      fabrics: filterItems(previewData?.fabrics || [], searchTerms.fabrics, 'fabrics')
    };
  }, [previewData, searchTerms]);

  // Check if all items in a section are selected
  const isAllSelected = useCallback((type) => {
    const items = filteredData[type] || [];
    if (items.length === 0) return false;

    const selectedSet = type === 'aliases' ? selectedAliases :
                       type === 'zones' ? selectedZones : selectedFabrics;

    return items.every(item => {
      const key = `${item.name}_${item.fabric || 'default'}`;
      return selectedSet.has(key);
    });
  }, [filteredData, selectedAliases, selectedZones, selectedFabrics]);

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
      selected: selectedFabrics.size,
      color: 'info'
    }
  ];

  return (
    <div className={`data-preview theme-${theme}`}>
      {/* Parser Info */}
      {previewData?.parser && (
        <div className="parser-info">
          <div className="parser-badge">
            <Info size={16} />
            <span>Detected Format: {previewData.parser}</span>
          </div>
          {previewData.warnings && previewData.warnings.length > 0 && (
            <div className="warning-badge">
              <AlertTriangle size={16} />
              <span>{previewData.warnings.length} warnings</span>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card color-${stat.color}`}>
            <div className="stat-icon">
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">
                {stat.value}
                {stat.selected > 0 && (
                  <span className="stat-selected">({stat.selected} selected)</span>
                )}
              </div>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{
                  width: `${(stat.selected / stat.value) * 100}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <button
          className="filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          <span>Filters</span>
          {showFilters ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="filter-actions">
          <button className="action-btn">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-item">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search aliases..."
              value={searchTerms.aliases}
              onChange={(e) => setSearchTerms(prev => ({ ...prev, aliases: e.target.value }))}
            />
          </div>
          <div className="filter-item">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search zones..."
              value={searchTerms.zones}
              onChange={(e) => setSearchTerms(prev => ({ ...prev, zones: e.target.value }))}
            />
          </div>
          <div className="filter-item">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search fabrics..."
              value={searchTerms.fabrics}
              onChange={(e) => setSearchTerms(prev => ({ ...prev, fabrics: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Data Tables */}
      <div className="preview-tables">
        {/* Aliases Table */}
        <div className="table-section">
          <div className="section-header" onClick={() => toggleSection('aliases')}>
            <div className="section-title">
              {expandedSections.aliases ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <Database size={20} />
              <span>Aliases ({filteredData.aliases?.length || 0})</span>
            </div>
            <div className="section-actions">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll('aliases');
                }}
              >
                {isAllSelected('aliases') ? (
                  <>
                    <CheckSquare size={16} />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={16} />
                    <span>Select All</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {expandedSections.aliases && (
            <div className="table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
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
                  {filteredData.aliases?.map((alias, index) => {
                    const key = `${alias.name}_${alias.fabric || 'default'}`;
                    const isSelected = selectedAliases.has(key);

                    return (
                      <tr
                        key={key}
                        className={`${isSelected ? 'selected' : ''}`}
                        onClick={() => onAliasToggle(key)}
                      >
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="name-col">{alias.name}</td>
                        <td className="wwpn-col">
                          <code>{alias.wwpn}</code>
                        </td>
                        <td>
                          <span className="type-badge">{alias.type || 'device'}</span>
                        </td>
                        <td>{alias.fabric || 'default'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Zones Table */}
        <div className="table-section">
          <div className="section-header" onClick={() => toggleSection('zones')}>
            <div className="section-title">
              {expandedSections.zones ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <GitBranch size={20} />
              <span>Zones ({filteredData.zones?.length || 0})</span>
              {conflicts && conflicts.zones?.length > 0 && (
                <span className="conflict-badge">
                  <AlertTriangle size={14} />
                  {conflicts.zones.length} conflicts
                </span>
              )}
            </div>
            <div className="section-actions">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll('zones');
                }}
              >
                {isAllSelected('zones') ? (
                  <>
                    <CheckSquare size={16} />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={16} />
                    <span>Select All</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {expandedSections.zones && (
            <div className="table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
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
                  {filteredData.zones?.map((zone) => {
                    const key = `${zone.name}_${zone.fabric || 'default'}`;
                    const isSelected = selectedZones.has(key);
                    const hasConflict = conflicts?.zones?.some(c => c.name === zone.name);

                    return (
                      <tr
                        key={key}
                        className={`${isSelected ? 'selected' : ''} ${hasConflict ? 'has-conflict' : ''}`}
                        onClick={() => onZoneToggle(key)}
                      >
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="name-col">
                          {zone.name}
                          {hasConflict && (
                            <AlertTriangle size={14} className="conflict-icon" />
                          )}
                        </td>
                        <td className="members-col">
                          <div className="members-list">
                            {zone.members?.slice(0, 2).map((member, idx) => (
                              <span key={idx} className="member-badge">
                                {member}
                              </span>
                            ))}
                            {zone.members?.length > 2 && (
                              <span className="member-more">
                                +{zone.members.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="type-badge">{zone.type || 'standard'}</span>
                        </td>
                        <td>{zone.fabric || 'default'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fabrics Table */}
        <div className="table-section">
          <div className="section-header" onClick={() => toggleSection('fabrics')}>
            <div className="section-title">
              {expandedSections.fabrics ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <Server size={20} />
              <span>Fabrics ({filteredData.fabrics?.length || 0})</span>
            </div>
            <div className="section-actions">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll('fabrics');
                }}
              >
                {isAllSelected('fabrics') ? (
                  <>
                    <CheckSquare size={16} />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={16} />
                    <span>Select All</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {expandedSections.fabrics && (
            <div className="table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={isAllSelected('fabrics')}
                        onChange={() => onSelectAll('fabrics')}
                      />
                    </th>
                    <th>Name</th>
                    <th>VSAN</th>
                    <th>Zoneset</th>
                    <th>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.fabrics?.map((fabric) => {
                    const key = `${fabric.name}_${fabric.vsan || 'default'}`;
                    const isSelected = selectedFabrics.has(key);

                    return (
                      <tr
                        key={key}
                        className={`${isSelected ? 'selected' : ''}`}
                        onClick={() => onFabricToggle(key)}
                      >
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="name-col">{fabric.name}</td>
                        <td>{fabric.vsan || '-'}</td>
                        <td>{fabric.zoneset || '-'}</td>
                        <td>
                          <span className="vendor-badge">{fabric.vendor || 'Unknown'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataPreview;