import React from "react";
import { Card, Form, Alert, Badge } from "react-bootstrap";

const PreviewSection = ({
  showPreviewSection,
  parsedData,
  showPreview,
  setShowPreview,
  selectedAliases,
  selectedZones,
  handleSelectAlias,
  handleSelectAll,
  handleSelectZone,
  handleSelectAllZones,
  getImportStats
}) => {
  if (!showPreviewSection || !parsedData.length) return null;

  const stats = getImportStats();

  return (
    <div className="mb-3" data-section="preview">
      {/* Aliases Preview */}
      {parsedData.filter(item => item.wwpn !== undefined).length > 0 && (
        <Card className="mb-3">
          <Card.Header 
            onClick={() => setShowPreview(prev => ({ ...prev, aliases: !prev.aliases }))}
            style={{ cursor: "pointer" }}
            className="d-flex justify-content-between align-items-center"
          >
            <h6 className="mb-0 text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                <polyline points={showPreview.aliases ? "6,9 12,15 18,9" : "9,6 15,12 9,18"}/>
              </svg>
              Aliases Preview ({parsedData.filter(item => item.wwpn !== undefined).length} items)
              {showPreview.aliases ? " - Click to collapse" : " - Click to expand"}
            </h6>
            <Badge bg="primary">
              {parsedData.filter(item => item.wwpn !== undefined).length} aliases
            </Badge>
          </Card.Header>
          {showPreview.aliases && (
            <Card.Body style={{ maxHeight: "500px", overflowY: "auto" }}>
              {stats.smartDetected > 0 && (
                <Alert variant="info" className="mb-3">
                  <div className="d-flex align-items-center">
                    <span className="me-2">🧠</span>
                    <div>
                      <strong>Smart Detection Summary:</strong> {stats.smartDetected} aliases processed
                      <br />
                      <small>
                        {stats.smartDetectedWithRules > 0 && (
                          <span className="text-success me-3">
                            ✅ {stats.smartDetectedWithRules} matched rules
                          </span>
                        )}
                        {stats.smartDetectedWithoutRules > 0 && (
                          <span className="text-warning">
                            ⚠️ {stats.smartDetectedWithoutRules} used default (no rule found)
                          </span>
                        )}
                      </small>
                    </div>
                  </div>
                </Alert>
              )}
              <div className="mb-2">
                <small className="text-muted">
                  💡 <strong>Tip:</strong> Use checkboxes to select specific aliases for import, or use "Import All" to import all new aliases. 
                  Existing aliases (highlighted in yellow) cannot be selected.
                </small>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}>
                        <Form.Check
                          type="checkbox"
                          checked={selectedAliases.size > 0 && selectedAliases.size === parsedData.filter(item => item.wwpn !== undefined && !item.existsInDatabase).length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          title="Select all new aliases"
                        />
                      </th>
                      <th>Name</th>
                      <th>WWPN</th>
                      <th>Use</th>
                      <th>Type</th>
                      <th>Create</th>
                      <th>Include in Zoning</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.filter(item => item.wwpn !== undefined).map((alias, index) => (
                      <tr key={index} className={alias.existsInDatabase ? "table-warning" : ""}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedAliases.has(index)}
                            onChange={(e) => handleSelectAlias(index, e.target.checked)}
                            disabled={alias.existsInDatabase}
                            title={alias.existsInDatabase ? "Cannot select existing aliases" : "Select for import"}
                          />
                        </td>
                        <td><code>{alias.name}</code></td>
                        <td><code>{alias.wwpn}</code></td>
                        <td>
                          <Badge bg="info">{alias.use}</Badge>
                          {alias.smartDetectionNote && (
                            <div>
                              <small className="text-muted">
                                🧠 {alias.smartDetectionNote}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge bg="secondary">{alias.cisco_alias || alias.aliasType || 'device-alias'}</Badge>
                        </td>
                        <td>{alias.create ? "✅" : "❌"}</td>
                        <td>{alias.include_in_zoning ? "✅" : "❌"}</td>
                        <td>
                          {alias.existsInDatabase ? (
                            <Badge bg="warning" title="This alias already exists in the database">
                              ⚠️ Exists
                            </Badge>
                          ) : (
                            <Badge bg="success" title="New alias - will be created">
                              ✨ New
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          )}
        </Card>
      )}

      {/* Zones Preview */}
      {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length > 0 && (
        <Card className="mb-3">
          <Card.Header 
            onClick={() => setShowPreview(prev => ({ ...prev, zones: !prev.zones }))}
            style={{ cursor: "pointer" }}
            className="d-flex justify-content-between align-items-center"
          >
            <h6 className="mb-0 text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                <polyline points={showPreview.zones ? "6,9 12,15 18,9" : "9,6 15,12 9,18"}/>
              </svg>
              Zones Preview ({parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length} items)
              {showPreview.zones ? " - Click to collapse" : " - Click to expand"}
            </h6>
            <Badge bg="primary">
              {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length} zones
            </Badge>
          </Card.Header>
          {showPreview.zones && (
            <Card.Body style={{ maxHeight: "500px", overflowY: "auto" }}>
              <div className="mb-2">
                <small className="text-muted">
                  💡 <strong>Tip:</strong> Use checkboxes to select specific zones for import. 
                  Existing zones (highlighted in yellow) cannot be selected.
                </small>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}>
                        <Form.Check
                          type="checkbox"
                          checked={selectedZones.size > 0 && selectedZones.size === parsedData.filter(item => (item.zone_type !== undefined || item.members !== undefined) && !item.existsInDatabase).length}
                          onChange={(e) => handleSelectAllZones(e.target.checked)}
                          title="Select all new zones"
                        />
                      </th>
                      <th>Name</th>
                      <th>VSAN</th>
                      <th>Type</th>
                      <th>Members</th>
                      <th>Resolved Members</th>
                      <th>Create</th>
                      <th>Exists</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).map((zone, index) => (
                      <tr key={index} className={zone.existsInDatabase ? "table-warning" : ""}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedZones.has(index)}
                            onChange={(e) => handleSelectZone(index, e.target.checked)}
                            disabled={zone.existsInDatabase}
                            title={zone.existsInDatabase ? "Cannot select existing zones" : "Select for import"}
                          />
                        </td>
                        <td><code>{zone.name}</code></td>
                        <td>{zone.vsan || 'N/A'}</td>
                        <td>
                          <Badge bg="info">{zone.zone_type || 'standard'}</Badge>
                        </td>
                        <td>
                          {zone.members ? zone.members.length : 0}
                        </td>
                        <td>
                          {zone.memberResolutionStats ? (
                            <span className={
                              zone.memberResolutionStats.resolved === zone.memberResolutionStats.total && zone.memberResolutionStats.total > 0
                                ? "text-success"
                                : zone.memberResolutionStats.total > 0
                                ? "text-danger"
                                : "text-muted"
                            }>
                              {zone.memberResolutionStats.resolved}
                              {zone.memberResolutionStats.total > 0 && (
                                <small className="text-muted ms-1">
                                  ({zone.memberResolutionStats.resolved === zone.memberResolutionStats.total ? "✅" : "❌"})
                                </small>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">0</span>
                          )}
                        </td>
                        <td>{zone.create ? "✅" : "❌"}</td>
                        <td>{zone.exists ? "✅" : "❌"}</td>
                        <td>
                          {zone.existsInDatabase ? (
                            <Badge bg="warning" title="This zone already exists in the database">
                              ⚠️ Exists
                            </Badge>
                          ) : (
                            <Badge bg="success" title="New zone - will be created">
                              ✨ New
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          )}
        </Card>
      )}
    </div>
  );
};

export default PreviewSection;