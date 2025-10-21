import { useState, useEffect, useContext } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, Modal } from 'react-bootstrap';
import { FaFileExcel, FaPlus, FaTrash, FaUserPlus } from 'react-icons/fa';
import api from '../api';
import { ConfigContext } from '../context/ConfigContext';
import '../styles/worksheet-generator.css';

const WorksheetGeneratorPage = () => {
  const { config } = useContext(ConfigContext);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState({});

  // Contact creation modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone_number: '',
    title: ''
  });

  // Track if fields were auto-filled
  const [autoFilledCustomer, setAutoFilledCustomer] = useState(false);
  const [autoFilledProject, setAutoFilledProject] = useState(false);

  // Load equipment types on mount
  useEffect(() => {
    loadEquipmentTypes();
  }, []);

  // Load contacts when config changes
  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.customer?.id]);

  // Prefill from config when it becomes available
  useEffect(() => {
    if (config?.customer?.name && !customerName && !autoFilledCustomer) {
      setCustomerName(config.customer.name);
      setAutoFilledCustomer(true);
    }
    if (config?.active_project?.name && !projectName && !autoFilledProject) {
      setProjectName(config.active_project.name);
      setAutoFilledProject(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.customer?.name, config?.active_project?.name]);

  const handleCustomerNameChange = (value) => {
    setCustomerName(value);
    // Hide helper text if user modifies the auto-filled value
    if (autoFilledCustomer && value !== config?.customer?.name) {
      setAutoFilledCustomer(false);
    }
  };

  const handleProjectNameChange = (value) => {
    setProjectName(value);
    // Hide helper text if user modifies the auto-filled value
    if (autoFilledProject && value !== config?.active_project?.name) {
      setAutoFilledProject(false);
    }
  };

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

  const loadContacts = async () => {
    if (!config?.customer?.id) return;

    try {
      const response = await api.get(`/api/customers/contact-info/?customer=${config.customer.id}`);
      setContacts(response.data);

      // Auto-select default contact if available
      const defaultContact = response.data.find(c => c.is_default);
      if (defaultContact) {
        setSelectedContactId(defaultContact.id.toString());
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
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
          />
        );
      case 'number':
        return (
          <Form.Control
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'select':
        return (
          <Form.Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
          />
        );
      default: // text
        return (
          <Form.Control
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  const handleCreateContact = async () => {
    if (!config?.customer?.id) {
      setError('No customer selected. Please select a customer in the configuration.');
      return;
    }

    // Validate required fields
    if (!newContact.name || !newContact.email) {
      setError('Contact name and email are required');
      return;
    }

    try {
      const contactData = {
        ...newContact,
        customer: config.customer.id
      };

      const response = await api.post('/api/customers/contact-info/', contactData);
      setContacts([...contacts, response.data]);
      setSelectedContactId(response.data.id.toString());
      setShowContactModal(false);
      setNewContact({ name: '', email: '', phone_number: '', title: '' });
      setSuccess('Contact created successfully!');
    } catch (err) {
      setError('Failed to create contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);

      // Validate at least one equipment type is selected
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

      // Get selected contact data
      const selectedContact = contacts.find(c => c.id === parseInt(selectedContactId));
      const contactPayload = selectedContact ? {
        name: selectedContact.name,
        email: selectedContact.email,
        phone: selectedContact.phone_number || '',
        title: selectedContact.title || ''
      } : {
        name: '',
        email: '',
        phone: '',
        title: ''
      };

      const payload = {
        customer_name: customerName,
        project_name: projectName,
        contact: contactPayload,
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
                <Form.Label>Customer Name</Form.Label>
                <Form.Control
                  type="text"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  placeholder="Enter customer name (optional)"
                />
                {autoFilledCustomer && (
                  <Form.Text className="text-muted">
                    Auto-filled from active customer
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Project Name</Form.Label>
                <Form.Control
                  type="text"
                  value={projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  placeholder="Enter project name (optional)"
                />
                {autoFilledProject && (
                  <Form.Text className="text-muted">
                    Auto-filled from active project
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Contact Information Section */}
      <Card className="section-card mb-3">
        <Card.Header><strong>Contact Information (Optional)</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Select Contact</Form.Label>
                <Form.Select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                >
                  <option value="">No contact (leave blank)</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} - {contact.email}
                      {contact.is_default && ' (Default)'}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Label>&nbsp;</Form.Label>
              <Button
                variant="outline-primary"
                className="w-100"
                onClick={() => setShowContactModal(true)}
              >
                <FaUserPlus className="me-2" />
                Create New Contact
              </Button>
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
                          {field.label}
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

      {/* Contact Creation Modal */}
      <Modal show={showContactModal} onHide={() => setShowContactModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Contact</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name *</Form.Label>
            <Form.Control
              type="text"
              value={newContact.name}
              onChange={(e) => setNewContact({...newContact, name: e.target.value})}
              placeholder="Enter contact name"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email *</Form.Label>
            <Form.Control
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact({...newContact, email: e.target.value})}
              placeholder="contact@example.com"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              value={newContact.phone_number}
              onChange={(e) => setNewContact({...newContact, phone_number: e.target.value})}
              placeholder="555-123-4567"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control
              type="text"
              value={newContact.title}
              onChange={(e) => setNewContact({...newContact, title: e.target.value})}
              placeholder="e.g., IT Manager"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowContactModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateContact}
            disabled={!newContact.name || !newContact.email}
          >
            Create Contact
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WorksheetGeneratorPage;
