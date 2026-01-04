import React, { useState, useMemo } from 'react';

/**
 * PPRCConfigPanel - Configuration panel for PPRC Paths
 *
 * Features:
 * - Show Fabrics toggle with fabric color legend
 * - Replication Groups with tabs
 * - LSS Mode (All LSSs / Custom LSSs) for Group 1
 * - LSS selector for custom mode with source->target mapping
 */
const PPRCConfigPanel = ({
  showFabrics,
  onToggleFabrics,
  fabricColors,
  replicationGroups,
  activeGroup,
  onSelectGroup,
  onCreateGroup,
  onDeleteGroup,
  lssMode,
  onChangeLssMode,
  onSetupEvenOdd,
  availableLss,
  selectedLssMappings,
  onAddLssMapping,
  onRemoveLssMapping,
  disabledLss,
  canAddGroup,
  loading,
}) => {
  const [newTargetLss, setNewTargetLss] = useState({});
  const [showLssModal, setShowLssModal] = useState(false);
  const [selectedSourceLss, setSelectedSourceLss] = useState(null);

  // Get unique fabrics from the passed colors (already sorted and colored by parent)
  const uniqueFabrics = useMemo(() => {
    if (!fabricColors) return [];
    return Object.entries(fabricColors).map(([name, color]) => ({
      name,
      color
    }));
  }, [fabricColors]);

  const handleLssClick = (lss) => {
    if (disabledLss.includes(lss.lss)) return;
    setSelectedSourceLss(lss);
    setNewTargetLss({ ...newTargetLss, [lss.lss]: lss.lss }); // Default to same LSS
    setShowLssModal(true);
  };

  const handleAddMapping = () => {
    if (selectedSourceLss && newTargetLss[selectedSourceLss.lss]) {
      onAddLssMapping(selectedSourceLss.lss, newTargetLss[selectedSourceLss.lss]);
      setShowLssModal(false);
      setSelectedSourceLss(null);
    }
  };

  return (
    <div className="pprc-config-panel">
      {/* Fabric Validation Section */}
      <div className="pprc-config-section pprc-fabric-section">
        <div className="pprc-config-row">
          <label className="form-check pprc-fabric-toggle">
            <input
              type="checkbox"
              className="form-check-input"
              checked={showFabrics}
              onChange={(e) => onToggleFabrics(e.target.checked)}
            />
            <span className="form-check-label">Show Fabrics</span>
          </label>

          {showFabrics && uniqueFabrics.length > 0 && (
            <div className="pprc-fabric-legend">
              {uniqueFabrics.map(({ name, color }) => (
                <span key={name} className="pprc-fabric-legend-item">
                  <span
                    className="pprc-fabric-dot"
                    style={{ backgroundColor: color }}
                  />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {showFabrics && (
          <div className="pprc-fabric-warning">
            <small className="text-muted">
              When enabled, paths between different fabrics will be marked as invalid.
            </small>
          </div>
        )}
      </div>

      {/* Replication Groups Section */}
      <div className="pprc-config-section pprc-groups-section">
        <h6 className="pprc-section-title">Replication Groups</h6>

        {/* Group Tabs */}
        <div className="pprc-group-tabs">
          {replicationGroups.map((group) => {
            // Determine badge text based on lss_mode
            const modeBadge = {
              'all': 'All',
              'even': 'Even',
              'odd': 'Odd',
              'custom': null, // No badge for custom
            }[group.lss_mode];

            return (
              <button
                key={group.id}
                className={`pprc-group-tab ${activeGroup?.id === group.id ? 'active' : ''}`}
                onClick={() => onSelectGroup(group)}
              >
                Group {group.group_number}
                {modeBadge && <span className="pprc-group-mode-badge">{modeBadge}</span>}
                {group.group_number > 1 && group.lss_mode !== 'odd' && (
                  <span
                    className="pprc-group-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGroup(group.id);
                    }}
                    title="Delete group"
                  >
                    ×
                  </span>
                )}
              </button>
            );
          })}
          {canAddGroup && (
            <button
              className="pprc-group-tab pprc-group-add"
              onClick={onCreateGroup}
              disabled={loading}
            >
              + Add Group
            </button>
          )}
        </div>

        {/* LSS Mode Toggle (only for Group 1, and only when not in even/odd mode) */}
        {activeGroup?.group_number === 1 && lssMode !== 'even' && lssMode !== 'odd' && (
          <div className="pprc-lss-mode">
            <label className="form-check form-check-inline">
              <input
                type="radio"
                className="form-check-input"
                checked={lssMode === 'all'}
                onChange={() => onChangeLssMode('all')}
              />
              <span className="form-check-label">All LSSs</span>
            </label>
            <label className="form-check form-check-inline">
              <input
                type="radio"
                className="form-check-input"
                checked={lssMode === 'custom'}
                onChange={() => onChangeLssMode('custom')}
              />
              <span className="form-check-label">Custom LSSs</span>
            </label>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm ms-2"
              onClick={onSetupEvenOdd}
              disabled={loading}
              title="Split LSSs: Group 1 gets even LSSs (00, 02, 04...), Group 2 gets odd LSSs (01, 03, 05...)"
            >
              Even/Odd Split
            </button>
          </div>
        )}

        {/* Show info when in even/odd mode */}
        {activeGroup && (lssMode === 'even' || lssMode === 'odd') && (
          <div className="pprc-lss-mode">
            <small className="text-muted">
              {lssMode === 'even'
                ? 'Group 1 handles all even-numbered LSSs (00, 02, 04...). Source and target LSS are the same.'
                : 'Group 2 handles all odd-numbered LSSs (01, 03, 05...). Source and target LSS are the same.'}
            </small>
            {activeGroup.group_number === 1 && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm ms-3"
                onClick={() => onChangeLssMode('all')}
                disabled={loading}
                title="Reset Group 1 to All LSSs mode (removes Group 2 odd assignment)"
              >
                Reset to All LSSs
              </button>
            )}
          </div>
        )}

        {/* LSS Selector (visible in custom mode) */}
        {lssMode === 'custom' && activeGroup && (
          <div className="pprc-lss-section">
            {/* Selected LSS Mappings */}
            {selectedLssMappings.length > 0 && (
              <div className="pprc-lss-selected">
                <span className="pprc-lss-label">Selected:</span>
                {selectedLssMappings.map((mapping) => (
                  <span key={mapping.id} className="pprc-lss-mapping-badge">
                    {mapping.source_lss} → {mapping.target_lss}
                    <span
                      className="pprc-lss-remove"
                      onClick={() => onRemoveLssMapping(mapping.id)}
                      title="Remove mapping"
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Available LSS Grid */}
            <div className="pprc-lss-available">
              <span className="pprc-lss-label">Available LSSs:</span>
              <div className="pprc-lss-grid">
                {availableLss.map((lss) => {
                  const isDisabled = disabledLss.includes(lss.lss);
                  const isSelected = selectedLssMappings.some(m => m.source_lss === lss.lss);
                  return (
                    <div
                      key={lss.lss}
                      className={`pprc-lss-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => !isDisabled && !isSelected && handleLssClick(lss)}
                      title={
                        isDisabled
                          ? `Assigned to Group ${lss.assigned_group_number}`
                          : isSelected
                            ? 'Already in this group'
                            : `Click to add LSS ${lss.lss}`
                      }
                    >
                      {lss.lss}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* No groups message */}
        {replicationGroups.length === 0 && (
          <div className="pprc-no-groups">
            <p className="text-muted">No replication groups yet. Select a target storage to get started.</p>
          </div>
        )}
      </div>

      {/* LSS Target Mapping Modal */}
      {showLssModal && selectedSourceLss && (
        <div className="pprc-modal-overlay" onClick={() => setShowLssModal(false)}>
          <div className="pprc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pprc-modal-header">
              <h6>Add LSS Mapping</h6>
              <button
                className="pprc-modal-close"
                onClick={() => setShowLssModal(false)}
              >
                ×
              </button>
            </div>
            <div className="pprc-modal-body">
              <div className="pprc-lss-mapping-form">
                <div className="pprc-lss-mapping-field">
                  <label>Source LSS</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedSourceLss.lss}
                    readOnly
                  />
                </div>
                <div className="pprc-lss-mapping-arrow">→</div>
                <div className="pprc-lss-mapping-field">
                  <label>Target LSS</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newTargetLss[selectedSourceLss.lss] || ''}
                    onChange={(e) => setNewTargetLss({
                      ...newTargetLss,
                      [selectedSourceLss.lss]: e.target.value.toUpperCase().slice(0, 2)
                    })}
                    placeholder="e.g., 50"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
            <div className="pprc-modal-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowLssModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddMapping}
                disabled={!newTargetLss[selectedSourceLss.lss]}
              >
                Add Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PPRCConfigPanel;
