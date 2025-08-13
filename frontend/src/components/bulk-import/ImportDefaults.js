import React from "react";
import { Card, Form } from "react-bootstrap";

const ImportDefaults = ({
  aliasDefaults,
  setAliasDefaults,
  zoneDefaults,
  setZoneDefaults
}) => {
  return (
    <>
      {/* Alias Import Defaults */}
      <Card className="mb-3">
        <Card.Header>
          <h6 className="mb-0">Alias Import Defaults</h6>
        </Card.Header>
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Check
                  type="checkbox"
                  id="create-aliases"
                  label="Create Aliases"
                  checked={aliasDefaults.create}
                  onChange={(e) => setAliasDefaults(prev => ({ ...prev, create: e.target.checked }))}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Check
                  type="checkbox"
                  id="include-in-zoning"
                  label="Include in Zoning"
                  checked={aliasDefaults.includeInZoning}
                  onChange={(e) => setAliasDefaults(prev => ({ ...prev, includeInZoning: e.target.checked }))}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label><strong>Use</strong></Form.Label>
                <Form.Select
                  value={aliasDefaults.use}
                  onChange={(e) => setAliasDefaults(prev => ({ ...prev, use: e.target.value }))}
                >
                  <option value="init">Initiator</option>
                  <option value="target">Target</option>
                  <option value="smart">Smart Detection</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label><strong>Alias Type</strong></Form.Label>
                <Form.Select
                  value={aliasDefaults.aliasType}
                  onChange={(e) => setAliasDefaults(prev => ({ ...prev, aliasType: e.target.value }))}
                >
                  <option value="original">Original</option>
                  <option value="device-alias">Device Alias</option>
                  <option value="fcalias">FC Alias</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-12">
              <Form.Group>
                <Form.Label><strong>Conflict Resolution</strong></Form.Label>
                <Form.Select
                  value={aliasDefaults.conflictResolution}
                  onChange={(e) => setAliasDefaults(prev => ({ ...prev, conflictResolution: e.target.value }))}
                >
                  <option value="device-alias">Prefer device-alias</option>
                  <option value="fcalias">Prefer fcalias</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Zone Import Defaults */}
      <Card className="mb-3">
        <Card.Header>
          <h6 className="mb-0">Zone Import Defaults</h6>
        </Card.Header>
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Check
                  type="checkbox"
                  id="create-zones"
                  label="Create"
                  checked={zoneDefaults.create}
                  onChange={(e) => setZoneDefaults(prev => ({ ...prev, create: e.target.checked }))}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Check
                  type="checkbox"
                  id="zone-exists"
                  label="Exists"
                  checked={zoneDefaults.exists}
                  onChange={(e) => setZoneDefaults(prev => ({ ...prev, exists: e.target.checked }))}
                />
              </Form.Group>
            </div>
            <div className="col-md-12">
              <Form.Group>
                <Form.Label><strong>Zone Type</strong></Form.Label>
                <Form.Select
                  value={zoneDefaults.zoneType}
                  onChange={(e) => setZoneDefaults(prev => ({ ...prev, zoneType: e.target.value }))}
                >
                  <option value="standard">Standard</option>
                  <option value="smart">Smart</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </Card.Body>
      </Card>
    </>
  );
};

export default ImportDefaults;