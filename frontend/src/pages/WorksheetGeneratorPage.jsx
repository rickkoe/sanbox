import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { FaFileExcel, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../api';
import '../styles/worksheet-generator.css';

const WorksheetGeneratorPage = () => {
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState({});

  // Load equipment types on mount
  useEffect(() => {
    loadEquipmentTypes();
  }, []);

  const loadEquipmentTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/core/equipment-types/');
      setEquipmentTypes(response.data);
    } catch (err) {
      setError('Failed to load equipment types: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEquipmentToggle = (equipmentType) => {
    const id = equipmentType.id;
    if (selectedEquipment[id]) {
      // Remove equipment
      const newSelected = { ...selectedEquipment };
      delete newSelected[id];
      setSelectedEquipment(newSelected);
    } else {
      // Add equipment with one empty item
      const emptyItem = {};
      equipmentType.fields_schema.forEach(field => {
        emptyItem[field.name] = '';
      });
      setSelectedEquipment({
        ...selectedEquipment,
        [id]: {
          type: equipmentType,
          items: [emptyItem]
        }
      });
    }
  };

  const handleAddItem = (equipmentTypeId) => {
    const equipment = selectedEquipment[equipmentTypeId];
    const emptyItem = {};
    equipment.type.fields_schema.forEach(field => {
      emptyItem[field.name] = '';
    });

    setSelectedEquipment({
      ...selectedEquipment,
      [equipmentTypeId]: {
        ...equipment,
        items: [...equipment.items, emptyItem]
      }
    });
  };

  const handleRemoveItem = (equipmentTypeId, itemIndex) => {
    const equipment = selectedEquipment[equipmentTypeId];
    const newItems = equipment.items.filter((_, idx) => idx !== itemIndex);

    if (newItems.length === 0) {
      // Remove equipment type entirely
      const newSelected = { ...selectedEquipment };
      delete newSelected[equipmentTypeId];
      setSelectedEquipment(newSelected);
    } else {
      setSelectedEquipment({
        ...selectedEquipment,
        [equipmentTypeId]: {
          ...equipment,
          items: newItems
        }
      });
    }
  };

  const handleFieldChange = (equipmentTypeId, itemIndex, fieldName, value) => {
    const equipment = selectedEquipment[equipmentTypeId];
    const newItems = [...equipment.items];
    newItems[itemIndex][fieldName] = value;

    setSelectedEquipment({
      ...selectedEquipment,
      [equipmentTypeId]: {
        ...equipment,
        items: newItems
      }
    });
  };

  const renderField = (field, value, onChange) => {
    switch (field.type) {
      case 'textarea':
        return (
          <Form.Control
            as="textarea"
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        );
      case 'number':
        return (
          <Form.Control
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        );
      case 'select':
        return (
          <Form.Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Form.Select>
        );
      case 'date':
        return (
          <Form.Control
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        );
      default: // text
        return (
          <Form.Control
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        );
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!customerName || !projectName) {
        setError('Please enter customer and project names');
        return;
      }

      if (Object.keys(selectedEquipment).length === 0) {
        setError('Please select at least one equipment type');
        return;
      }

      // Build payload
      const equipment = Object.entries(selectedEquipment).map(([id, data]) => ({
        type_id: parseInt(id),
        type_name: data.type.name,
        quantity: data.items.length,
        items: data.items
      }));

      const payload = {
        customer_name: customerName,
        project_name: projectName,
        contact: selectedContact || {
          name: '',
          email: '',
          phone: '',
          title: ''
        },
        equipment: equipment
      };

      // Generate worksheet
      const response = await api.post(
        '/api/core/worksheet-templates/generate_worksheet/',
        payload,
        { responseType: 'blob' }
      );

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `implementation_worksheet_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess('Worksheet generated and downloaded successfully!');
    } catch (err) {
      setError('Failed to generate worksheet: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="worksheet-generator-container">
        <div className="text-center">
          <Spinner animation="border" />
          <p className="mt-3">Loading equipment types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="worksheet-generator-container">
      <div className="page-header">
        <h1><FaFileExcel className="me-2" />Worksheet Generator</h1>
        <p className="text-muted">Generate professional implementation worksheets for equipment deployments</p>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      {/* Project Information */}
      <Card className="section-card mb-3">
        <Card.Header><strong>Project Information</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Customer Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Project Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Equipment Selection */}
      <Card className="section-card mb-3">
        <Card.Header><strong>Select Equipment Types</strong></Card.Header>
        <Card.Body>
          <div className="equipment-grid">
            {equipmentTypes.map(equipmentType => (
              <div
                key={equipmentType.id}
                className={`equipment-card ${selectedEquipment[equipmentType.id] ? 'selected' : ''}`}
                onClick={() => handleEquipmentToggle(equipmentType)}
              >
                <div className="equipment-card-header">
                  <strong>{equipmentType.name}</strong>
                  <span className="badge bg-secondary">{equipmentType.category}</span>
                </div>
                {equipmentType.vendor && (
                  <div className="text-muted small">{equipmentType.vendor}</div>
                )}
                {selectedEquipment[equipmentType.id] && (
                  <div className="mt-2">
                    <span className="badge bg-primary">
                      {selectedEquipment[equipmentType.id].items.length} selected
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* Equipment Details */}
      {Object.entries(selectedEquipment).map(([equipmentTypeId, data]) => (
        <Card key={equipmentTypeId} className="section-card mb-3">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <strong>{data.type.name} Details</strong>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => handleAddItem(equipmentTypeId)}
            >
              <FaPlus /> Add Another {data.type.name}
            </Button>
          </Card.Header>
          <Card.Body>
            {data.items.map((item, itemIndex) => (
              <div key={itemIndex} className="equipment-item mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">{data.type.name} #{itemIndex + 1}</h6>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => handleRemoveItem(equipmentTypeId, itemIndex)}
                  >
                    <FaTrash /> Remove
                  </Button>
                </div>
                <Row>
                  {data.type.fields_schema.map(field => (
                    <Col md={6} key={field.name}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          {field.label} {field.required && <span className="text-danger">*</span>}
                        </Form.Label>
                        {renderField(
                          field,
                          item[field.name] || '',
                          (value) => handleFieldChange(equipmentTypeId, itemIndex, field.name, value)
                        )}
                      </Form.Group>
                    </Col>
                  ))}
                </Row>
                {itemIndex < data.items.length - 1 && <hr />}
              </div>
            ))}
          </Card.Body>
        </Card>
      ))}

      {/* Generate Button */}
      <div className="text-center mt-4 mb-5">
        <Button
          variant="primary"
          size="lg"
          onClick={handleGenerate}
          disabled={generating || Object.keys(selectedEquipment).length === 0}
        >
          {generating ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Generating...
            </>
          ) : (
            <>
              <FaFileExcel className="me-2" />
              Generate Worksheet
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default WorksheetGeneratorPage;
