# Worksheet Generator - Phase 2 Enhancements

## Status: Ready for Implementation

This document contains the planned enhancements for Phase 2 of the Worksheet Generator. These features build upon the working MVP.

---

## Current Status ✅

### Working Features (MVP)
- ✅ Equipment type selection
- ✅ Dynamic equipment forms
- ✅ Excel generation with company branding
- ✅ Company logo embedding
- ✅ Professional color scheme (#505050, #B3B3B3, #A2CA62, #64CAE6, #FFFFFF)
- ✅ Sidebar navigation link
- ✅ Tools page card

---

## Phase 2 Features to Implement

### 1. Contact Selector & Creator ⏳

**Goal**: Allow users to select existing contacts or create new ones for the worksheet.

**Implementation**:

Add to `WorksheetGeneratorPage.jsx`:

```javascript
// Additional state
const [contacts, setContacts] = useState([]);
const [selectedContactId, setSelectedContactId] = useState('');
const [showContactModal, setShowContactModal] = useState(false);
const [newContact, setNewContact] = useState({
  name: '',
  email: '',
  phone_number: '',
  title: ''
});

// Load contacts function
const loadContacts = async () => {
  if (!config?.customer?.id) return;

  try {
    const response = await api.get(`/api/customers/contact-info/?customer=${config.customer.id}`);
    setContacts(response.data);

    // Auto-select default contact
    const defaultContact = response.data.find(c => c.is_default);
    if (defaultContact) {
      setSelectedContactId(defaultContact.id);
    }
  } catch (err) {
    console.error('Failed to load contacts:', err);
  }
};

// Create contact function
const handleCreateContact = async () => {
  if (!config?.customer?.id) {
    setError('No customer selected');
    return;
  }

  try {
    const contactData = {
      ...newContact,
      customer: config.customer.id
    };

    const response = await api.post('/api/customers/contact-info/', contactData);
    setContacts([...contacts, response.data]);
    setSelectedContactId(response.data.id);
    setShowContactModal(false);
    setNewContact({ name: '', email: '', phone_number: '', title: '' });
    setSuccess('Contact created successfully!');
  } catch (err) {
    setError('Failed to create contact: ' + err.message);
  }
};
```

**UI Component**:

```jsx
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
        required
      />
    </Form.Group>
    <Form.Group className="mb-3">
      <Form.Label>Email *</Form.Label>
      <Form.Control
        type="email"
        value={newContact.email}
        onChange={(e) => setNewContact({...newContact, email: e.target.value})}
        required
      />
    </Form.Group>
    <Form.Group className="mb-3">
      <Form.Label>Phone Number</Form.Label>
      <Form.Control
        type="tel"
        value={newContact.phone_number}
        onChange={(e) => setNewContact({...newContact, phone_number: e.target.value})}
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
    <Button variant="primary" onClick={handleCreateContact}>
      Create Contact
    </Button>
  </Modal.Footer>
</Modal>
```

**Update `handleGenerate` function**:

```javascript
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
```

---

### 2. Prefill from Active Customer/Project ⏳

**Goal**: Auto-fill customer and project names from the active configuration.

**Implementation**:

```javascript
// Add useContext import
import { ConfigContext } from '../context/ConfigContext';

// In component
const { config } = useContext(ConfigContext);

// Prefill function
const prefillFromConfig = () => {
  if (config?.customer?.name) {
    setCustomerName(config.customer.name);
  }
  if (config?.active_project?.name) {
    setProjectName(config.active_project.name);
  }
};

// Call in useEffect
useEffect(() => {
  loadEquipmentTypes();
  loadContacts();
  prefillFromConfig();
}, [config]);
```

**UI Enhancement**:

```jsx
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
      {config?.customer?.name && (
        <Form.Text className="text-muted">
          Auto-filled from active customer
        </Form.Text>
      )}
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
      {config?.active_project?.name && (
        <Form.Text className="text-muted">
          Auto-filled from active project
        </Form.Text>
      )}
    </Form.Group>
  </Col>
</Row>
```

---

### 3. Template Save & Load 🔜

**Goal**: Allow users to save worksheet configurations as templates for reuse.

**API Endpoints** (already created):
- `GET /api/core/worksheet-templates/` - List templates
- `POST /api/core/worksheet-templates/` - Create template
- `GET /api/core/worksheet-templates/{id}/` - Get template
- `DELETE /api/core/worksheet-templates/{id}/` - Delete template

**Implementation**:

```javascript
// State
const [templates, setTemplates] = useState([]);
const [selectedTemplateId, setSelectedTemplateId] = useState('');
const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
const [templateName, setTemplateName] = useState('');
const [templateDescription, setTemplateDescription] = useState('');

// Load templates
const loadTemplates = async () => {
  try {
    const response = await api.get('/api/core/worksheet-templates/');
    setTemplates(response.data);
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
};

// Save template
const handleSaveTemplate = async () => {
  try {
    const template_config = {
      customer_name: customerName,
      project_name: projectName,
      equipment: Object.entries(selectedEquipment).map(([id, data]) => ({
        type_id: parseInt(id),
        quantity: data.items.length,
        fields: data.items[0] // Save first item as template
      }))
    };

    const templateData = {
      name: templateName,
      description: templateDescription,
      template_config: template_config,
      customer: config?.customer?.id || null,
      equipment_types: Object.keys(selectedEquipment).map(id => parseInt(id))
    };

    await api.post('/api/core/worksheet-templates/', templateData);
    setShowSaveTemplateModal(false);
    setTemplateName('');
    setTemplateDescription('');
    loadTemplates();
    setSuccess('Template saved successfully!');
  } catch (err) {
    setError('Failed to save template: ' + err.message);
  }
};

// Load template
const handleLoadTemplate = async (templateId) => {
  try {
    const response = await api.get(`/api/core/worksheet-templates/${templateId}/`);
    const template = response.data;

    // Prefill from template
    if (template.template_config.customer_name) {
      setCustomerName(template.template_config.customer_name);
    }
    if (template.template_config.project_name) {
      setProjectName(template.template_config.project_name);
    }

    // Load equipment from template
    // Implementation depends on template_config structure

    setSuccess('Template loaded successfully!');
  } catch (err) {
    setError('Failed to load template: ' + err.message);
  }
};
```

**UI Component**:

```jsx
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
        </Form.Group>
      </Col>
      <Col md={4}>
        <Form.Label>&nbsp;</Form.Label>
        <Button
          variant="outline-success"
          className="w-100"
          onClick={() => setShowSaveTemplateModal(true)}
          disabled={Object.keys(selectedEquipment).length === 0}
        >
          Save as Template
        </Button>
      </Col>
    </Row>
  </Card.Body>
</Card>
```

---

### 4. Footer with Contact Info 🔜

**Goal**: Add a professional footer to the Excel worksheet with contact information.

**Backend Implementation** (`worksheet_views.py`):

```python
# After equipment sections, before auto-adjust columns

# Add footer section
current_row += 2  # Add some space

# Footer separator
ws.merge_cells(f'A{current_row}:D{current_row}')
cell = ws[f'A{current_row}']
cell.value = ""
cell.border = Border(top=Side(style='thick', color='505050'))
current_row += 1

# Company info footer
contact = data.get('contact', {})
if contact and contact.get('name'):
    ws.merge_cells(f'A{current_row}:D{current_row}')
    cell = ws[f'A{current_row}']
    cell.value = "Contact Information"
    cell.font = Font(name='Calibri', size=10, bold=True, color='505050')
    current_row += 1

    ws.merge_cells(f'A{current_row}:D{current_row}')
    cell = ws[f'A{current_row}']
    footer_text = f"{contact.get('name', '')}"
    if contact.get('title'):
        footer_text += f" - {contact.get('title', '')}"
    if contact.get('email'):
        footer_text += f" | {contact.get('email', '')}"
    if contact.get('phone'):
        footer_text += f" | {contact.get('phone', '')}"
    cell.value = footer_text
    cell.font = Font(name='Calibri', size=9, color='505050')
    cell.alignment = center_alignment
    current_row += 1

# Generated timestamp
ws.merge_cells(f'A{current_row}:D{current_row}')
cell = ws[f'A{current_row}']
cell.value = f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M')}"
cell.font = Font(name='Calibri', size=8, italic=True, color='B3B3B3')
cell.alignment = center_alignment
```

---

## Implementation Priority

### Phase 2A (High Priority)
1. ✅ Prefill from active customer/project - **Easiest, high value**
2. ✅ Contact selector with existing contacts - **Moderate, high value**
3. ✅ Contact creator modal - **Moderate, high value**
4. ✅ Footer with contact info - **Easy, professional touch**

### Phase 2B (Medium Priority)
5. ⏳ Template save functionality - **Moderate, nice to have**
6. ⏳ Template load functionality - **Moderate, nice to have**

### Phase 2C (Low Priority - Future)
7. 🔜 Logo upload interface
8. 🔜 Custom branding settings
9. 🔜 Bulk equipment import
10. 🔜 Worksheet preview before generate

---

## Testing Checklist

### Contact Features
- [ ] Contacts load for active customer
- [ ] Default contact auto-selected
- [ ] Can create new contact via modal
- [ ] New contact appears in dropdown
- [ ] Selected contact included in worksheet
- [ ] Footer shows contact info properly

### Prefill Features
- [ ] Customer name prefills from active config
- [ ] Project name prefills from active config
- [ ] Can override prefilled values
- [ ] Works when no active config

### Template Features (When Implemented)
- [ ] Can save current configuration as template
- [ ] Template appears in list
- [ ] Can load template
- [ ] Template prefills correctly
- [ ] Can delete own templates
- [ ] Global templates appear for all users

---

## Files to Modify

### Frontend
- `frontend/src/pages/WorksheetGeneratorPage.jsx` - Main component
- `frontend/src/styles/worksheet-generator.css` - Styling for modals

### Backend
- `backend/core/worksheet_views.py` - Add footer generation

---

## Quick Implementation Guide

### Step 1: Add Prefill (5 minutes)
1. Import ConfigContext
2. Add prefillFromConfig function
3. Call in useEffect
4. Test with active customer/project

### Step 2: Add Contact Selector (15 minutes)
1. Add loadContacts function
2. Add contact dropdown UI
3. Update handleGenerate to use selected contact
4. Test contact selection

### Step 3: Add Contact Creator (20 minutes)
1. Add modal state
2. Add create contact function
3. Add modal UI
4. Test contact creation

### Step 4: Add Footer (10 minutes)
1. Update worksheet_views.py
2. Add footer section code
3. Test worksheet generation

**Total Time**: ~50 minutes for Phase 2A

---

## Notes

- All backend API endpoints already exist
- Models are in place
- Just need to wire up the UI
- Templates are optional - can be added later
- Focus on contact features first for immediate value

---

**Status**: Ready to implement Phase 2A features
**Estimated Completion**: 1 hour
**Priority**: High - These features significantly improve user experience
