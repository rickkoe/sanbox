import React from "react";
import { Card, Form } from "react-bootstrap";

const ImportHeader = ({ selectedFabric, setSelectedFabric, fabricOptions, loading }) => {
  return (
    <Card>
      <Card.Header>
        <h4 className="mb-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <path d="M16 13H8"/>
            <path d="M16 17H8"/>
            <path d="M10 9H8"/>
          </svg>
          Bulk Alias & Zone Import
        </h4>
        <small className="text-muted">
          Import multiple files containing alias and zone data automatically. Supports Cisco show tech-support files, device-alias, fcalias, and zone configurations.
        </small>
      </Card.Header>

      <Card.Body>
        {/* Fabric Selection */}
        <Form.Group className="mb-3">
          <Form.Label><strong>Select Fabric</strong></Form.Label>
          <Form.Select
            value={selectedFabric}
            onChange={(e) => setSelectedFabric(e.target.value)}
            disabled={loading}
          >
            <option value="">Choose a fabric...</option>
            {fabricOptions.map((fabric) => (
              <option key={fabric.id} value={fabric.id}>
                {fabric.name}
              </option>
            ))}
          </Form.Select>
          {loading && <small className="text-muted">Loading fabrics...</small>}
        </Form.Group>
      </Card.Body>
    </Card>
  );
};

export default ImportHeader;