import { useState, useEffect, useContext } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, Modal, Nav, Tab } from 'react-bootstrap';
import { FaFileExcel, FaPlus, FaTrash, FaUserPlus, FaSave, FaTimes, FaCopy } from 'react-icons/fa';
import api from '../api';
import { ConfigContext } from '../context/ConfigContext';
import '../styles/worksheet-generator.css';

const WorksheetGeneratorPage = () => {
  const { config } = useContext(ConfigContext);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [implementationCompany, setImplementationCompany] = useState(null);
  const [defaultContactId, setDefaultContactId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [plannedInstallationDate, setPlannedInstallationDate] = useState('');
  const [sites, setSites] = useState([
    {
      id: 1,
      name: 'Site 1',
      // Site Contact Information
      siteContactName: '',
      siteContactEmail: '',
      siteContactPhone: '',
      siteContactAltPhone: '',
      siteStreetAddress: '',
      siteCity: '',
      siteState: '',
      siteZip: '',
      siteNotes: '',
      // Infrastructure
      dnsServer1: '',
      dnsServer2: '',
      ntpServer: '',
      smtpServer: '',
      smtpPort: '',
      // Network defaults for equipment
      defaultSubnetMask: '',
      defaultGateway: '',
      // Implementation team contacts (multiple)
      implementationContacts: [],
      equipment: {}
    }
  ]);
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);

  // Contact creation modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone_number: '',
    title: ''
  });

  // Template management
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Track if fields were auto-filled
  const [autoFilledCustomer, setAutoFilledCustomer] = useState(false);
  const [autoFilledProject, setAutoFilledProject] = useState(false);

  // Load equipment types and templates on mount
  useEffect(() => {
    loadEquipmentTypes();
    loadTemplates();
  }, []);

  // Load contacts on mount (global implementation team)
  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    try {
      // First, find the implementation company
      const customersResponse = await api.get('/api/customers/?page_size=500');
      const customers = customersResponse.data.results || customersResponse.data;
      const implCompany = customers.find(c => c.is_implementation_company === true);

      if (implCompany) {
        setImplementationCompany(implCompany);

        // Load contacts for the implementation company
        const response = await api.get(`/api/customers/contact-info/?customer=${implCompany.id}`);
        const loadedContacts = response.data;
        setContacts(loadedContacts);

        // Auto-select the default contact for all sites
        const defaultContact = loadedContacts.find(c => c.is_default === true);
        if (defaultContact) {
          setDefaultContactId(defaultContact.id.toString());
          setSites(prevSites => prevSites.map(site => ({
            ...site,
            implementationContacts: site.implementationContacts.length > 0
              ? site.implementationContacts
              : [defaultContact.id.toString()]
          })));
        }
      } else {
        // No implementation company set yet
        setImplementationCompany(null);
        setContacts([]);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get('/api/core/worksheet-templates/');
      setTemplates(response.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) {
      setError('Template name is required');
      return;
    }

    // Check if any site has equipment
    const hasEquipment = sites.some(site => Object.keys(site.equipment).length > 0);
    if (!hasEquipment) {
      setError('Please select at least one equipment type before saving a template');
      return;
    }

    try {
      // Save the first site's equipment configuration as template
      const firstSiteWithEquipment = sites.find(site => Object.keys(site.equipment).length > 0);

      const template_config = {
        customer_name: customerName,
        project_name: projectName,
        equipment: Object.entries(firstSiteWithEquipment.equipment).map(([id, data]) => ({
          type_id: parseInt(id),
          type_name: data.type.name,
          quantity: data.items.length,
          items: data.items // Save all items with their field values
        }))
      };

      const templateData = {
        name: templateName,
        description: templateDescription,
        template_config: template_config,
        customer: config?.customer?.id || null,
        equipment_types: Object.keys(firstSiteWithEquipment.equipment).map(id => parseInt(id))
      };

      await api.post('/api/core/worksheet-templates/', templateData);
      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      loadTemplates();
      setSuccess('Template saved successfully!');
    } catch (err) {
      setError('Failed to save template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLoadTemplate = async (templateId) => {
    if (!templateId) return;

    try {
      const response = await api.get(`/api/core/worksheet-templates/${templateId}/`);
      const template = response.data;

      // Prefill customer and project names from template
      if (template.template_config?.customer_name) {
        setCustomerName(template.template_config.customer_name);
        setAutoFilledCustomer(false); // Don't show auto-fill text for template loads
      }
      if (template.template_config?.project_name) {
        setProjectName(template.template_config.project_name);
        setAutoFilledProject(false);
      }

      // Load equipment from template into the active site
      if (template.template_config?.equipment) {
        const newSelectedEquipment = {};

        for (const equipmentConfig of template.template_config.equipment) {
          const equipmentType = equipmentTypes.find(et => et.id === equipmentConfig.type_id);
          if (equipmentType) {
            let items = [];

            // Check if template has saved items (new format) or just first item fields (old format)
            if (equipmentConfig.items && Array.isArray(equipmentConfig.items)) {
              // New format: load all saved items
              items = equipmentConfig.items.map(savedItem => {
                const item = {};
                // Copy all fields except site_address
                Object.keys(savedItem).forEach(key => {
                  if (key !== 'site_address') {
                    item[key] = savedItem[key];
                  }
                });
                return item;
              });
            } else if (equipmentConfig.fields) {
              // Old format: use first item fields for backward compatibility
              const items_to_create = equipmentConfig.quantity || 1;
              for (let i = 0; i < items_to_create; i++) {
                const item = {};
                if (i === 0) {
                  // First item gets template values
                  Object.keys(equipmentConfig.fields).forEach(key => {
                    if (key !== 'site_address') {
                      item[key] = equipmentConfig.fields[key];
                    }
                  });
                } else {
                  // Additional items start empty
                  equipmentType.fields_schema.forEach(field => {
                    if (field.name !== 'site_address') {
                      item[field.name] = '';
                    }
                  });
                }
                items.push(item);
              }
            } else {
              // No saved data, create empty items
              const items_to_create = equipmentConfig.quantity || 1;
              for (let i = 0; i < items_to_create; i++) {
                const item = {};
                equipmentType.fields_schema.forEach(field => {
                  if (field.name !== 'site_address') {
                    item[field.name] = '';
                  }
                });
                items.push(item);
              }
            }

            newSelectedEquipment[equipmentConfig.type_id] = {
              type: equipmentType,
              items: items
            };
          }
        }

        // Update the active site's equipment
        updateSiteEquipment(activeSiteIndex, newSelectedEquipment);
      }

      setSuccess('Template loaded successfully into active site!');
    } catch (err) {
      setError('Failed to load template: ' + (err.response?.data?.error || err.message));
    }
  };

  const addSite = () => {
    const newSite = {
      id: Date.now(),
      name: `Site ${sites.length + 1}`,
      // Site Contact Information
      siteContactName: '',
      siteContactEmail: '',
      siteContactPhone: '',
      siteContactAltPhone: '',
      siteStreetAddress: '',
      siteCity: '',
      siteState: '',
      siteZip: '',
      siteNotes: '',
      // Infrastructure
      dnsServer1: '',
      dnsServer2: '',
      ntpServer: '',
      smtpServer: '',
      smtpPort: '',
      // Network defaults
      defaultSubnetMask: '',
      defaultGateway: '',
      // Implementation team contacts - auto-select default contact
      implementationContacts: defaultContactId ? [defaultContactId] : [],
      equipment: {}
    };
    setSites([...sites, newSite]);
    setActiveSiteIndex(sites.length);
  };

  const removeSite = (index) => {
    if (sites.length === 1) {
      setError('You must have at least one site');
      return;
    }
    const newSites = sites.filter((_, i) => i !== index);
    setSites(newSites);
    if (activeSiteIndex >= newSites.length) {
      setActiveSiteIndex(newSites.length - 1);
    }
  };

  const updateSite = (index, field, value) => {
    const newSites = [...sites];
    newSites[index][field] = value;
    setSites(newSites);
  };

  const updateSiteEquipment = (index, equipment) => {
    const newSites = [...sites];
    newSites[index].equipment = equipment;
    setSites(newSites);
  };

  const handleEquipmentToggle = (equipmentType) => {
    const id = equipmentType.id;
    const site = sites[activeSiteIndex];
    const currentEquipment = site.equipment;

    if (currentEquipment[id]) {
      // Remove equipment
      const newSelected = { ...currentEquipment };
      delete newSelected[id];
      updateSiteEquipment(activeSiteIndex, newSelected);
    } else {
      // Add equipment with one empty item (without site_address field)
      const emptyItem = {};
      equipmentType.fields_schema.forEach(field => {
        // Skip site_address as it's now at site level
        if (field.name !== 'site_address') {
          emptyItem[field.name] = '';
        }
      });

      // Add standard network fields for all equipment
      emptyItem['subnet_mask'] = site.defaultSubnetMask || '';
      emptyItem['default_gateway'] = site.defaultGateway || '';

      // Add VLAN only for non-switch equipment
      const isSwitch = equipmentType.name && equipmentType.name.toLowerCase().includes('switch');
      if (!isSwitch) {
        emptyItem['vlan'] = '';
      }

      updateSiteEquipment(activeSiteIndex, {
        ...currentEquipment,
        [id]: {
          type: equipmentType,
          items: [emptyItem]
        }
      });
    }
  };

  const handleAddItem = (equipmentTypeId) => {
    const currentEquipment = sites[activeSiteIndex].equipment;
    const equipment = currentEquipment[equipmentTypeId];
    const site = sites[activeSiteIndex];
    const emptyItem = {};

    equipment.type.fields_schema.forEach(field => {
      // Skip site_address as it's now at site level
      if (field.name !== 'site_address') {
        emptyItem[field.name] = '';
      }
    });

    // Add standard network fields for all equipment
    emptyItem['subnet_mask'] = site.defaultSubnetMask || '';
    emptyItem['default_gateway'] = site.defaultGateway || '';

    // Add VLAN only for non-switch equipment
    const isSwitch = equipment.type.name && equipment.type.name.toLowerCase().includes('switch');
    if (!isSwitch) {
      emptyItem['vlan'] = '';
    }

    updateSiteEquipment(activeSiteIndex, {
      ...currentEquipment,
      [equipmentTypeId]: {
        ...equipment,
        items: [...equipment.items, emptyItem]
      }
    });
  };

  const handleRemoveItem = (equipmentTypeId, itemIndex) => {
    const currentEquipment = sites[activeSiteIndex].equipment;
    const equipment = currentEquipment[equipmentTypeId];
    const newItems = equipment.items.filter((_, idx) => idx !== itemIndex);

    if (newItems.length === 0) {
      // Remove equipment type entirely
      const newSelected = { ...currentEquipment };
      delete newSelected[equipmentTypeId];
      updateSiteEquipment(activeSiteIndex, newSelected);
    } else {
      updateSiteEquipment(activeSiteIndex, {
        ...currentEquipment,
        [equipmentTypeId]: {
          ...equipment,
          items: newItems
        }
      });
    }
  };

  const handleDuplicateItem = (equipmentTypeId, itemIndex) => {
    const currentEquipment = sites[activeSiteIndex].equipment;
    const equipment = currentEquipment[equipmentTypeId];

    // Create a copy of the item at the specified index
    const itemToDuplicate = equipment.items[itemIndex];
    const duplicatedItem = { ...itemToDuplicate };

    // Insert the duplicated item right after the original
    const newItems = [...equipment.items];
    newItems.splice(itemIndex + 1, 0, duplicatedItem);

    updateSiteEquipment(activeSiteIndex, {
      ...currentEquipment,
      [equipmentTypeId]: {
        ...equipment,
        items: newItems
      }
    });
  };

  const handleFieldChange = (equipmentTypeId, itemIndex, fieldName, value) => {
    const currentEquipment = sites[activeSiteIndex].equipment;
    const equipment = currentEquipment[equipmentTypeId];
    const newItems = [...equipment.items];
    newItems[itemIndex][fieldName] = value;

    updateSiteEquipment(activeSiteIndex, {
      ...currentEquipment,
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
    // Validate required fields
    if (!newContact.name || !newContact.email) {
      setError('Contact name and email are required');
      return;
    }

    try {
      // Find or create the implementation company customer
      let implementationCompanyId = null;
      try {
        // Look up customer with is_implementation_company = true
        const customersResponse = await api.get('/api/customers/?page_size=500');
        const customers = customersResponse.data.results || customersResponse.data;
        const implementationCompany = customers.find(c => c.is_implementation_company === true);

        if (implementationCompany) {
          implementationCompanyId = implementationCompany.id;
        } else {
          // No implementation company exists yet - must be set in Settings first
          setError('No implementation company is configured. Please set up an implementation company in Settings first.');
          return;
        }
      } catch (customerErr) {
        console.error('Error handling implementation company customer:', customerErr);
        // If we can't create/find the customer, create contact without customer
      }

      // Create contact assigned to implementation company
      const contactData = {
        ...newContact,
        customer: implementationCompanyId
      };

      await api.post('/api/customers/contact-info/', contactData);

      // Reload contacts to get the updated list
      await loadContacts();

      setShowContactModal(false);
      setNewContact({ name: '', email: '', phone_number: '', title: '' });
      setSuccess('Implementation team contact created successfully!');
    } catch (err) {
      setError('Failed to create contact: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      setValidationError(null);

      // Validate at least one site has equipment
      const hasEquipment = sites.some(site => Object.keys(site.equipment).length > 0);
      if (!hasEquipment) {
        setValidationError('Please select at least one equipment type for at least one site');
        setGenerating(false);
        return;
      }

      // Validate all sites have at least one implementation contact
      const sitesWithoutContacts = sites
        .map((site, index) => ({ site, index }))
        .filter(({ site }) => !site.implementationContacts || site.implementationContacts.length === 0);

      if (sitesWithoutContacts.length > 0) {
        const siteNames = sitesWithoutContacts.map(({ site }) => site.name).join(', ');
        setValidationError(`Please select at least one implementation team contact for: ${siteNames}`);
        setGenerating(false);
        return;
      }

      // Build sites payload
      const sitesPayload = sites.map(site => {
        // Get implementation team contacts for this site
        const implementationTeam = site.implementationContacts.map(contactId => {
          const contact = contacts.find(c => c.id === parseInt(contactId));
          return contact ? {
            name: contact.name,
            email: contact.email,
            phone: contact.phone_number || '',
            title: contact.title || ''
          } : null;
        }).filter(c => c !== null);

        // Build equipment list for this site (with subnet/gateway from site defaults)
        const equipment = Object.entries(site.equipment).map(([id, data]) => ({
          type_id: parseInt(id),
          type_name: data.type.name,
          quantity: data.items.length,
          items: data.items.map(item => ({
            ...item,
            subnet_mask: item.subnet_mask || site.defaultSubnetMask || '',
            default_gateway: item.default_gateway || site.defaultGateway || ''
          }))
        }));

        return {
          name: site.name,
          // Site Information
          siteContactName: site.siteContactName,
          siteContactEmail: site.siteContactEmail,
          siteContactPhone: site.siteContactPhone,
          siteContactAltPhone: site.siteContactAltPhone,
          siteStreetAddress: site.siteStreetAddress,
          siteCity: site.siteCity,
          siteState: site.siteState,
          siteZip: site.siteZip,
          siteNotes: site.siteNotes,
          // Infrastructure
          dnsServer1: site.dnsServer1,
          dnsServer2: site.dnsServer2,
          ntpServer: site.ntpServer,
          smtpServer: site.smtpServer,
          smtpPort: site.smtpPort,
          // Implementation Team
          implementationTeam: implementationTeam,
          implementationCompanyName: implementationCompany?.name || '',
          equipment: equipment
        };
      });

      const payload = {
        customer_name: customerName,
        project_name: projectName,
        planned_installation_date: plannedInstallationDate,
        sites: sitesPayload
      };

      // Generate worksheet
      const response = await api.post(
        '/api/core/worksheet-templates/generate_worksheet/',
        payload,
        { responseType: 'blob' }
      );

      // Download file with descriptive name
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Build filename: {Implementation Company} {Customer} {Project} Implementation Worksheets {MMDDYY}.xlsx
      const today = new Date();
      const mmddyy = `${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;

      const parts = [];
      if (implementationCompany?.name) parts.push(implementationCompany.name);
      if (customerName) parts.push(customerName);
      if (projectName) parts.push(projectName);
      parts.push('Implementation Worksheets');
      parts.push(mmddyy);

      const filename = `${parts.join(' ')}.xlsx`;

      link.setAttribute('download', filename);
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
        <h1><FaFileExcel className="me-2" />Doc Builder</h1>
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
                <Form.Label>Client Name</Form.Label>
                <Form.Control
                  type="text"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  placeholder="Enter client name (optional)"
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
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Planned Installation Date</Form.Label>
                <Form.Control
                  type="date"
                  value={plannedInstallationDate}
                  onChange={(e) => setPlannedInstallationDate(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Template Section */}
      <Card className="section-card mb-3">
        <Card.Header><strong>Templates (Optional)</strong></Card.Header>
        <Card.Body>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Load from Template</Form.Label>
                <Form.Select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    if (e.target.value) handleLoadTemplate(e.target.value);
                  }}
                >
                  <option value="">-- Select a template --</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.is_global && ' (Global)'}
                    </option>
                  ))}
                </Form.Select>
                {templates.length > 0 && selectedTemplateId && (
                  <Form.Text className="text-muted">
                    {templates.find(t => t.id === parseInt(selectedTemplateId))?.description || ''}
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Label>&nbsp;</Form.Label>
              <Button
                variant="outline-success"
                className="w-100"
                onClick={() => setShowSaveTemplateModal(true)}
                disabled={!sites.some(site => Object.keys(site.equipment).length > 0)}
              >
                <FaSave className="me-2" />
                Save as Template
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sites Section with Tabs */}
      <Card className="section-card mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Sites & Equipment</strong>
          <Button size="sm" variant="outline-primary" onClick={addSite}>
            <FaPlus className="me-1" /> Add Site
          </Button>
        </Card.Header>
        <Card.Body>
          <Tab.Container activeKey={activeSiteIndex} onSelect={(k) => setActiveSiteIndex(parseInt(k))}>
            <Nav variant="tabs" className="mb-3">
              {sites.map((site, index) => (
                <Nav.Item key={site.id}>
                  <Nav.Link eventKey={index} className="d-flex align-items-center">
                    {site.name}
                    {sites.length > 1 && (
                      <Button
                        size="sm"
                        variant="link"
                        className="text-danger p-0 ms-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSite(index);
                        }}
                      >
                        <FaTimes />
                      </Button>
                    )}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            <Tab.Content>
              {sites.map((site, siteIndex) => (
                <Tab.Pane key={site.id} eventKey={siteIndex}>
                  {/* Site Name */}
                  <Row className="mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label><strong>Site Name</strong></Form.Label>
                        <Form.Control
                          type="text"
                          value={site.name}
                          onChange={(e) => updateSite(siteIndex, 'name', e.target.value)}
                          placeholder="e.g., Primary Data Center"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Site Information Header */}
                  <h6 className="mb-3 mt-4"><strong>Site Information</strong></h6>

                  {/* Site Contact */}
                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Site Contact Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.siteContactName}
                          onChange={(e) => updateSite(siteIndex, 'siteContactName', e.target.value)}
                          placeholder="Contact name"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Email Address</Form.Label>
                        <Form.Control
                          type="email"
                          value={site.siteContactEmail}
                          onChange={(e) => updateSite(siteIndex, 'siteContactEmail', e.target.value)}
                          placeholder="email@example.com"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Phone Number</Form.Label>
                        <Form.Control
                          type="tel"
                          value={site.siteContactPhone}
                          onChange={(e) => updateSite(siteIndex, 'siteContactPhone', e.target.value)}
                          placeholder="555-1234"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Alt. Phone</Form.Label>
                        <Form.Control
                          type="tel"
                          value={site.siteContactAltPhone}
                          onChange={(e) => updateSite(siteIndex, 'siteContactAltPhone', e.target.value)}
                          placeholder="555-5678"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Site Address */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Street Address</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.siteStreetAddress}
                          onChange={(e) => updateSite(siteIndex, 'siteStreetAddress', e.target.value)}
                          placeholder="123 Main St"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>City</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.siteCity}
                          onChange={(e) => updateSite(siteIndex, 'siteCity', e.target.value)}
                          placeholder="City"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={1}>
                      <Form.Group>
                        <Form.Label>State</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.siteState}
                          onChange={(e) => updateSite(siteIndex, 'siteState', e.target.value)}
                          placeholder="MN"
                          maxLength="2"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Zip</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.siteZip}
                          onChange={(e) => updateSite(siteIndex, 'siteZip', e.target.value)}
                          placeholder="55401"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Site Notes */}
                  <Row className="mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Notes (room, rack, location, etc.)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={site.siteNotes}
                          onChange={(e) => updateSite(siteIndex, 'siteNotes', e.target.value)}
                          placeholder="Building 2, Server Room A, Rack 5..."
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Infrastructure Settings */}
                  <Row className="mb-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>DNS Server IP 1</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.dnsServer1}
                          onChange={(e) => updateSite(siteIndex, 'dnsServer1', e.target.value)}
                          placeholder="8.8.8.8"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>DNS Server IP 2</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.dnsServer2}
                          onChange={(e) => updateSite(siteIndex, 'dnsServer2', e.target.value)}
                          placeholder="8.8.4.4"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>NTP Server</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.ntpServer}
                          onChange={(e) => updateSite(siteIndex, 'ntpServer', e.target.value)}
                          placeholder="time.google.com"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>SMTP Server</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.smtpServer}
                          onChange={(e) => updateSite(siteIndex, 'smtpServer', e.target.value)}
                          placeholder="smtp.example.com"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={1}>
                      <Form.Group>
                        <Form.Label>SMTP Port</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.smtpPort}
                          onChange={(e) => updateSite(siteIndex, 'smtpPort', e.target.value)}
                          placeholder="25"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Network Defaults for Equipment */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Default Subnet Mask (for equipment)</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.defaultSubnetMask}
                          onChange={(e) => updateSite(siteIndex, 'defaultSubnetMask', e.target.value)}
                          placeholder="255.255.255.0"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Default Gateway (for equipment)</Form.Label>
                        <Form.Control
                          type="text"
                          value={site.defaultGateway}
                          onChange={(e) => updateSite(siteIndex, 'defaultGateway', e.target.value)}
                          placeholder="10.0.0.1"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Implementation Team Contacts */}
                  <Row className="mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>
                          <strong>Implementation Team Contacts</strong>
                          <span className="text-danger"> *</span>
                          {implementationCompany && ` (${implementationCompany.name})`}
                        </Form.Label>
                        <Form.Select
                          multiple
                          value={site.implementationContacts}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value);
                            updateSite(siteIndex, 'implementationContacts', selected);
                          }}
                          style={{ minHeight: '100px' }}
                        >
                          {contacts.map(contact => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name} - {contact.email} {contact.phone_number ? `- ${contact.phone_number}` : ''}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Hold Ctrl/Cmd to select multiple contacts. <Button size="sm" variant="link" onClick={() => setShowContactModal(true)}>Add New Contact</Button>
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <hr />

                  {/* Equipment Selection for this Site */}
                  <h6 className="mb-3">Select Equipment Types<span className="text-danger"> *</span></h6>
                  <div className="equipment-grid mb-3">
                    {equipmentTypes.map(equipmentType => (
                      <div
                        key={equipmentType.id}
                        className={`equipment-card ${site.equipment[equipmentType.id] ? 'selected' : ''}`}
                        onClick={() => handleEquipmentToggle(equipmentType)}
                      >
                        <div className="equipment-card-header">
                          <strong>{equipmentType.name}</strong>
                          <span className="badge bg-secondary">{equipmentType.category}</span>
                        </div>
                        {equipmentType.vendor && (
                          <div className="text-muted small">{equipmentType.vendor}</div>
                        )}
                        {site.equipment[equipmentType.id] && (
                          <div className="mt-2">
                            <span className="badge bg-primary">
                              {site.equipment[equipmentType.id].items.length} selected
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Equipment Details for this Site */}
                  {Object.entries(site.equipment).map(([equipmentTypeId, data]) => (
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
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => handleDuplicateItem(equipmentTypeId, itemIndex)}
                      title="Duplicate this item with all current values"
                    >
                      <FaCopy /> Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleRemoveItem(equipmentTypeId, itemIndex)}
                    >
                      <FaTrash /> Remove
                    </Button>
                  </div>
                </div>
                <Row>
                  {data.type.fields_schema
                    .filter(field => field.name !== 'site_address') // Filter out site_address
                    .map(field => (
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
                  {/* Add network configuration fields */}
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Subnet Mask</Form.Label>
                      <Form.Control
                        type="text"
                        value={item.subnet_mask || ''}
                        onChange={(e) => handleFieldChange(equipmentTypeId, itemIndex, 'subnet_mask', e.target.value)}
                        placeholder="255.255.255.0"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Default Gateway</Form.Label>
                      <Form.Control
                        type="text"
                        value={item.default_gateway || ''}
                        onChange={(e) => handleFieldChange(equipmentTypeId, itemIndex, 'default_gateway', e.target.value)}
                        placeholder="10.0.0.1"
                      />
                    </Form.Group>
                  </Col>
                  {/* Add VLAN only for non-switch equipment */}
                  {!data.type.name.toLowerCase().includes('switch') && (
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>VLAN</Form.Label>
                        <Form.Control
                          type="text"
                          value={item.vlan || ''}
                          onChange={(e) => handleFieldChange(equipmentTypeId, itemIndex, 'vlan', e.target.value)}
                          placeholder="100"
                        />
                      </Form.Group>
                    </Col>
                  )}
                </Row>
                {itemIndex < data.items.length - 1 && <hr />}
              </div>
            ))}
          </Card.Body>
        </Card>
      ))}
                </Tab.Pane>
              ))}
            </Tab.Content>
          </Tab.Container>
        </Card.Body>
      </Card>

      {/* Generate Button */}
      <div className="text-center mt-4 mb-5">
        {validationError && (
          <Alert variant="danger" className="mb-3" onClose={() => setValidationError(null)} dismissible>
            <strong>Validation Error:</strong> {validationError}
          </Alert>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={handleGenerate}
          disabled={generating || !sites.some(site => Object.keys(site.equipment).length > 0)}
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

      {/* Save Template Modal */}
      <Modal show={showSaveTemplateModal} onHide={() => setShowSaveTemplateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Save as Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Name *</Form.Label>
            <Form.Control
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard SAN Deployment"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Optional description of what this template is for..."
            />
          </Form.Group>
          <Alert variant="info" className="mb-0">
            <small>
              This template will save your current configuration including selected equipment types
              and all equipment details (serial numbers, IPs, etc.) from the active site.
            </small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSaveTemplate}
            disabled={!templateName}
          >
            Save Template
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WorksheetGeneratorPage;
