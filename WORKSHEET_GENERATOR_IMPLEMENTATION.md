# Worksheet Generator - Complete Implementation Plan

## Overview
A tool to generate professional Excel worksheets for equipment implementation projects. Users can select equipment types, fill in details, and download formatted .xlsx files.

---

## Backend Implementation ✅ COMPLETE

### Models Created
1. **ContactInfo** (`backend/customers/models.py`)
   - Fields: customer, name, email, phone_number, title, is_default, notes
   - Location: lines 17-77

2. **EquipmentType** (`backend/core/models.py`)
   - Fields: name, category, vendor, description, fields_schema, is_active, icon_name, display_order
   - Location: lines 842-908

3. **WorksheetTemplate** (`backend/core/models.py`)
   - Fields: name, customer, user, description, equipment_types, template_config, is_default, is_global
   - Location: lines 911-974

### API Endpoints
- `GET/POST /api/customers/contact-info/` - Contact CRUD
- `GET /api/customers/contact-info/by_customer/?customer_id=X` - Filter by customer
- `GET /api/customers/contact-info/default/?customer_id=X` - Get default contact
- `GET/POST /api/core/equipment-types/` - Equipment type CRUD
- `GET /api/core/equipment-types/categories/` - List all categories
- `GET /api/core/equipment-types/by_category/` - Group by category
- `GET/POST /api/core/worksheet-templates/` - Template CRUD
- `POST /api/core/worksheet-templates/generate_worksheet/` - Generate Excel file

### Seed Data Required
Create management command: `backend/core/management/commands/seed_equipment_types.py`

```python
# Sample Equipment Types to Create:

# SAN Switch (Cisco)
{
    "name": "SAN Switch - Cisco",
    "category": "network",
    "vendor": "Cisco",
    "icon_name": "FaNetworkWired",
    "display_order": 1,
    "fields_schema": [
        {"name": "switch_name", "label": "Switch Name", "type": "text", "required": true},
        {"name": "management_ip", "label": "Management IP", "type": "text", "required": true},
        {"name": "site_address", "label": "Site Address", "type": "textarea", "required": false},
        {"name": "serial_number", "label": "Serial Number", "type": "text", "required": false},
        {"name": "model", "label": "Model", "type": "select", "required": false,
         "options": ["MDS 9148", "MDS 9396", "MDS 9710", "MDS 9718"]},
        {"name": "port_count", "label": "Port Count", "type": "number", "required": false},
        {"name": "firmware_version", "label": "Firmware Version", "type": "text", "required": false}
    ]
}

# SAN Switch (Brocade)
{
    "name": "SAN Switch - Brocade",
    "category": "network",
    "vendor": "Brocade",
    "icon_name": "FaNetworkWired",
    "display_order": 2,
    "fields_schema": [
        {"name": "switch_name", "label": "Switch Name", "type": "text", "required": true},
        {"name": "management_ip", "label": "Management IP", "type": "text", "required": true},
        {"name": "site_address", "label": "Site Address", "type": "textarea", "required": false},
        {"name": "serial_number", "label": "Serial Number", "type": "text", "required": false},
        {"name": "model", "label": "Model", "type": "select", "required": false,
         "options": ["G620", "G630", "G720", "X6-4", "X7-4"]},
        {"name": "port_count", "label": "Port Count", "type": "number", "required": false},
        {"name": "firmware_version", "label": "Firmware Version", "type": "text", "required": false}
    ]
}

# FlashSystem
{
    "name": "IBM FlashSystem",
    "category": "storage",
    "vendor": "IBM",
    "icon_name": "FaHdd",
    "display_order": 3,
    "fields_schema": [
        {"name": "system_name", "label": "System Name", "type": "text", "required": true},
        {"name": "management_ip", "label": "Management IP", "type": "text", "required": true},
        {"name": "site_address", "label": "Site Address", "type": "textarea", "required": false},
        {"name": "serial_number", "label": "Serial Number", "type": "text", "required": false},
        {"name": "model", "label": "Model", "type": "select", "required": false,
         "options": ["5015", "5035", "5045", "5100", "5200", "7200", "9200", "9500"]},
        {"name": "node_count", "label": "Node Count", "type": "select", "required": false,
         "options": ["2", "4"]},
        {"name": "total_capacity_tb", "label": "Total Capacity (TB)", "type": "number", "required": false},
        {"name": "software_version", "label": "Software Version", "type": "text", "required": false}
    ]
}

# DS8000
{
    "name": "IBM DS8000",
    "category": "storage",
    "vendor": "IBM",
    "icon_name": "FaServer",
    "display_order": 4,
    "fields_schema": [
        {"name": "system_name", "label": "System Name", "type": "text", "required": true},
        {"name": "management_ip", "label": "Management IP", "type": "text", "required": true},
        {"name": "site_address", "label": "Site Address", "type": "textarea", "required": false},
        {"name": "serial_number", "label": "Serial Number", "type": "text", "required": false},
        {"name": "model", "label": "Model", "type": "select", "required": false,
         "options": ["DS8880", "DS8900F"]},
        {"name": "frame_count", "label": "Frame Count", "type": "number", "required": false},
        {"name": "total_capacity_tb", "label": "Total Capacity (TB)", "type": "number", "required": false},
        {"name": "microcode_level", "label": "Microcode Level", "type": "text", "required": false}
    ]
}

# Server
{
    "name": "Server",
    "category": "compute",
    "vendor": null,
    "icon_name": "FaServer",
    "display_order": 5,
    "fields_schema": [
        {"name": "server_name", "label": "Server Name", "type": "text", "required": true},
        {"name": "management_ip", "label": "Management IP", "type": "text", "required": true},
        {"name": "site_address", "label": "Site Address", "type": "textarea", "required": false},
        {"name": "serial_number", "label": "Serial Number", "type": "text", "required": false},
        {"name": "vendor", "label": "Vendor", "type": "select", "required": false,
         "options": ["IBM", "Dell", "HP", "Lenovo", "Cisco"]},
        {"name": "model", "label": "Model", "type": "text", "required": false},
        {"name": "cpu", "label": "CPU", "type": "text", "required": false},
        {"name": "memory_gb", "label": "Memory (GB)", "type": "number", "required": false},
        {"name": "operating_system", "label": "Operating System", "type": "text", "required": false}
    ]
}
```

---

## Frontend Implementation

### Phase 1: MVP (Current) ✅

#### 1. Main Page Component
**File**: `frontend/src/pages/WorksheetGeneratorPage.jsx`
- Simple single-page form (no multi-step wizard for MVP)
- Sections: Project Info, Equipment Selection, Contact Info
- Generate & Download button

#### 2. Add to Tools Page
**File**: `frontend/src/pages/ToolsPage.js`
- Add new card with icon `FaFileExcel`
- Link to `/tools/worksheet-generator`

#### 3. Add Route
**File**: `frontend/src/App.js`
- Add route: `/tools/worksheet-generator`
- Add to scrollableRoutes array

#### 4. Basic Styling
**File**: `frontend/src/styles/worksheet-generator.css`
- Card-based layout
- Form styling
- Equipment item cards

---

### Phase 2: Enhanced Components (Future)

#### 1. Multi-Step Wizard
**File**: `frontend/src/components/WorksheetGenerator/StepWizard.jsx`
- Step 1: Project Information
- Step 2: Equipment Selection
- Step 3: Equipment Details (dynamic forms)
- Step 4: Contact & Logo
- Step 5: Preview & Generate

**File**: `frontend/src/components/WorksheetGenerator/StepIndicator.jsx`
- Visual step progress indicator
- Click to navigate between steps

#### 2. Equipment Selector
**File**: `frontend/src/components/WorksheetGenerator/EquipmentSelector.jsx`
- Grid of equipment type cards
- Grouped by category (Storage, Network, Compute, etc.)
- Quantity selector for each type
- Icons from react-icons

#### 3. Dynamic Equipment Form
**File**: `frontend/src/components/WorksheetGenerator/DynamicEquipmentForm.jsx`
- Renders form based on equipment type's `fields_schema`
- Supports: text, number, select, date, textarea
- Validation based on `required` flag
- Dynamic field rendering

**File**: `frontend/src/components/WorksheetGenerator/EquipmentFormItem.jsx`
- Individual equipment item form
- Copy/duplicate functionality
- Delete functionality

#### 4. Contact Selector
**File**: `frontend/src/components/WorksheetGenerator/ContactSelector.jsx`
- Dropdown to select existing contact
- "Add New Contact" button (opens modal)
- Display selected contact info

**File**: `frontend/src/components/WorksheetGenerator/ContactFormModal.jsx`
- Modal for creating new contact
- Form fields: name, email, phone, title
- Save to database and auto-select

#### 5. Worksheet Preview
**File**: `frontend/src/components/WorksheetGenerator/WorksheetPreview.jsx`
- Shows structure of generated worksheet
- Lists all equipment and field counts
- File size estimate
- Edit/back buttons

#### 6. Template Management
**File**: `frontend/src/components/WorksheetGenerator/TemplateSaveModal.jsx`
- Save current configuration as template
- Template name & description

**File**: `frontend/src/components/WorksheetGenerator/TemplateSelector.jsx`
- Load saved templates
- Global templates vs user templates
- Delete user templates

---

### Phase 3: Advanced Features (Future)

#### 1. Logo Upload
**File**: `frontend/src/components/WorksheetGenerator/LogoUploader.jsx`
- Image upload component
- Preview uploaded logo
- Store as base64 or file URL
- Send to backend for embedding in Excel

#### 2. Custom Branding
**File**: `frontend/src/components/WorksheetGenerator/BrandingSettings.jsx`
- Custom color scheme for headers
- Company name
- Footer text
- Header/footer customization

#### 3. Bulk Import
**File**: `frontend/src/components/WorksheetGenerator/BulkImportModal.jsx`
- CSV/Excel import for equipment data
- Map columns to fields
- Preview import

#### 4. Worksheet History
**Model**: Create `WorksheetHistory` model
- Track generated worksheets
- Store configuration
- Download previous worksheets
- Share worksheets

#### 5. PDF Export
- Add PDF generation backend (use reportlab or weasyprint)
- Same data, different format

#### 6. Email Worksheet
- Email directly from app
- Attach generated worksheet
- Email to selected contact

---

## API Integration (Frontend)

### Service File
**File**: `frontend/src/services/worksheetService.js`

```javascript
import axios from 'axios';

const API_BASE = '/api/core';
const CUSTOMER_API = '/api/customers';

export const worksheetService = {
  // Equipment Types
  getEquipmentTypes: () => axios.get(`${API_BASE}/equipment-types/`),
  getEquipmentTypesByCategory: () => axios.get(`${API_BASE}/equipment-types/by_category/`),

  // Contact Info
  getContacts: (customerId) => axios.get(`${CUSTOMER_API}/contact-info/?customer=${customerId}`),
  getDefaultContact: (customerId) => axios.get(`${CUSTOMER_API}/contact-info/default/?customer_id=${customerId}`),
  createContact: (data) => axios.post(`${CUSTOMER_API}/contact-info/`, data),

  // Templates
  getTemplates: () => axios.get(`${API_BASE}/worksheet-templates/`),
  saveTemplate: (data) => axios.post(`${API_BASE}/worksheet-templates/`, data),
  deleteTemplate: (id) => axios.delete(`${API_BASE}/worksheet-templates/${id}/`),

  // Generate Worksheet
  generateWorksheet: (data) => axios.post(
    `${API_BASE}/worksheet-templates/generate_worksheet/`,
    data,
    { responseType: 'blob' }
  )
};
```

---

## Styling Guidelines

### Color Scheme
- Primary: `#0066CC` (blue, matches existing theme)
- Success: `#28a745` (green)
- Danger: `#dc3545` (red)
- Light: `#f8f9fa`
- Dark: `#343a40`

### Component Structure
```css
.worksheet-generator-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.section-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.equipment-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.equipment-card:hover {
  border-color: #0066CC;
  box-shadow: 0 4px 8px rgba(0,102,204,0.2);
}

.equipment-card.selected {
  border-color: #0066CC;
  background: #f0f7ff;
}
```

---

## State Management

### Main State Structure
```javascript
const [worksheetData, setWorksheetData] = useState({
  customerName: '',
  projectName: '',
  contact: null,
  equipment: []
});

const [equipmentTypes, setEquipmentTypes] = useState([]);
const [selectedEquipment, setSelectedEquipment] = useState({});
const [loading, setLoading] = useState(false);
```

### Equipment State
```javascript
// Format: { [equipmentTypeId]: { quantity: number, items: [...] } }
{
  1: {  // SAN Switch ID
    quantity: 2,
    items: [
      { switch_name: 'SW01', management_ip: '10.0.0.1', ... },
      { switch_name: 'SW02', management_ip: '10.0.0.2', ... }
    ]
  },
  3: {  // FlashSystem ID
    quantity: 1,
    items: [
      { system_name: 'FS01', management_ip: '10.0.1.1', ... }
    ]
  }
}
```

---

## Testing Checklist

### Backend
- [ ] Can create ContactInfo via API
- [ ] Can create EquipmentType via API
- [ ] Can retrieve equipment types by category
- [ ] Can generate Excel file with sample data
- [ ] Excel file downloads correctly
- [ ] Excel file has proper formatting

### Frontend MVP
- [ ] Page loads without errors
- [ ] Can select equipment types
- [ ] Can enter quantities
- [ ] Forms render based on equipment type
- [ ] Can enter equipment details
- [ ] Can select/create contact
- [ ] Generate button triggers download
- [ ] Downloaded file opens in Excel
- [ ] File contains correct data

### Frontend Enhanced (Future)
- [ ] Multi-step wizard navigation works
- [ ] Can save templates
- [ ] Can load templates
- [ ] Logo upload works
- [ ] Bulk import works
- [ ] Email sending works

---

## Deployment Notes

### Requirements Update
✅ Added `openpyxl==3.1.5` to `backend/requirements.txt`
- Installed in container: `docker-compose -f docker-compose.dev.yml exec backend pip install openpyxl==3.1.5`

### Migrations
✅ Created and applied:
- `customers/migrations/0002_contactinfo.py`
- `core/migrations/0005_equipmenttype_worksheettemplate.py`

### Seed Data
Run after deployment:
```bash
docker-compose -f docker-compose.dev.yml exec backend python manage.py seed_equipment_types
```

---

## Future Enhancements Priority

1. **High Priority**
   - Multi-step wizard (better UX)
   - Template save/load (reusability)
   - Logo upload (branding)

2. **Medium Priority**
   - Bulk import (efficiency)
   - Worksheet history (tracking)
   - Custom branding (customization)

3. **Low Priority**
   - PDF export (alternative format)
   - Email functionality (convenience)
   - Multiple languages (i18n)

---

## Known Limitations (MVP)

1. No logo embedding (placeholder only)
2. Single-page form (no wizard)
3. No template save/load
4. No bulk import
5. No preview before generate
6. Basic styling
7. No validation feedback
8. No progress indicators

---

## Files Created/Modified

### Backend
✅ `backend/customers/models.py` - Added ContactInfo model
✅ `backend/customers/serializers.py` - Added ContactInfoSerializer
✅ `backend/customers/views.py` - Added ContactInfoViewSet
✅ `backend/customers/urls.py` - Added contact-info routes
✅ `backend/customers/admin.py` - Added ContactInfoAdmin
✅ `backend/core/models.py` - Added EquipmentType, WorksheetTemplate
✅ `backend/core/serializers.py` - Added EquipmentTypeSerializer, WorksheetTemplateSerializer
✅ `backend/core/worksheet_views.py` - NEW FILE - Equipment & worksheet views
✅ `backend/core/urls.py` - Added equipment-types, worksheet-templates routes
✅ `backend/core/admin.py` - Added EquipmentTypeAdmin, WorksheetTemplateAdmin
✅ `backend/requirements.txt` - Added openpyxl

### Frontend (MVP)
⏳ `frontend/src/pages/WorksheetGeneratorPage.jsx` - NEW FILE
⏳ `frontend/src/styles/worksheet-generator.css` - NEW FILE
⏳ `frontend/src/pages/ToolsPage.js` - Add card
⏳ `frontend/src/App.js` - Add route
⏳ `frontend/src/services/worksheetService.js` - NEW FILE (optional)

### Future Frontend Files
- `frontend/src/components/WorksheetGenerator/` (directory)
  - StepWizard.jsx
  - StepIndicator.jsx
  - EquipmentSelector.jsx
  - DynamicEquipmentForm.jsx
  - EquipmentFormItem.jsx
  - ContactSelector.jsx
  - ContactFormModal.jsx
  - WorksheetPreview.jsx
  - TemplateSaveModal.jsx
  - TemplateSelector.jsx
  - LogoUploader.jsx
  - BrandingSettings.jsx
  - BulkImportModal.jsx

---

## End of Documentation
This document provides complete implementation details for the Worksheet Generator feature, from MVP to full implementation.
