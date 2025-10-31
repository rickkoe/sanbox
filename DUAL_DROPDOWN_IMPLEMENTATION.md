# Dual-Dropdown Context & Project View - Implementation Guide

**Date**: 2025-10-31
**Status**: Ready for Implementation
**Estimated Time**: 12-16 hours

---

## Executive Summary

Replace the single combined customer/project dropdown with two separate dropdowns in the navbar. Allow users to select a customer without requiring a project. Add "Project View" mode that shows only project entities with field_overrides applied and highlights modified cells.

---

## User Requirements Summary

1. ✅ **No Active Project**: Show "Project View" button but disabled/grayed out
2. ✅ **Project View Data**: Show ONLY entities in the project (from junction tables)
3. ✅ **Cell Highlighting**: Background color (light blue/yellow using theme variables)
4. ✅ **Button Labels**: "Customer View" and "Project View" (rename from "All" and "Current Project Only")
5. ✅ **Dropdown Layout**: Customer first, project appears to right once selected + "+ Create New" options
6. ✅ **Project Default**: Show "-- None --" as first option in project dropdown
7. ✅ **Auto-Clear Project**: When switching customers, automatically clear active project to null

---

## Phase 1: Backend Changes (2-3 hours)

### 1.1 Update UserConfig to Allow Null Project

**File**: `backend/core/models.py` (lines 78-146)

**Current Behavior**: The model already allows `active_project` to be null/blank
**Action Needed**: Verify validation in `save()` method allows customer without project

**Check this code** (around line 120):
```python
def save(self, *args, **kwargs):
    # Validate that active_project belongs to active_customer
    if self.active_project and self.active_customer:
        if not self.active_customer.projects.filter(id=self.active_project.id).exists():
            raise ValidationError(
                "Active project must belong to the active customer"
            )

    # This should already be fine - project can be null
    super().save(*args, **kwargs)
```

**No changes needed** - model already supports this.

---

### 1.2 Update user_config_view to Handle Null Project

**File**: `backend/core/views.py` (lines 125-177)

**Current Code** (around line 145):
```python
elif request.method == "PUT":
    try:
        data = json.loads(request.body)
        active_customer_id = data.get('active_customer_id')
        active_project_id = data.get('active_project_id')

        # ... validation code ...
```

**Change Needed**: Explicitly handle `active_project_id: null` to clear project

**FIND this section** and **REPLACE** with:
```python
elif request.method == "PUT":
    try:
        data = json.loads(request.body)
        active_customer_id = data.get('active_customer_id')
        active_project_id = data.get('active_project_id')  # Can be None/null

        user_config = UserConfig.get_or_create_for_user(user)

        # Handle customer change
        if active_customer_id:
            try:
                customer = Customer.objects.get(id=active_customer_id)
                user_config.active_customer = customer
            except Customer.DoesNotExist:
                return JsonResponse({"error": "Customer not found"}, status=404)

        # Handle project change (explicit null handling)
        if 'active_project_id' in data:  # Check if key exists
            if active_project_id is None:
                # Explicitly clear the project
                user_config.active_project = None
            else:
                try:
                    project = Project.objects.get(id=active_project_id)
                    # Verify project belongs to customer
                    if user_config.active_customer:
                        if not user_config.active_customer.projects.filter(id=project.id).exists():
                            return JsonResponse({"error": "Project does not belong to customer"}, status=400)
                    user_config.active_project = project
                except Project.DoesNotExist:
                    return JsonResponse({"error": "Project not found"}, status=404)

        user_config.save()

        # Rest of the code stays the same...
```

---

### 1.3 Create Project View Endpoints (Merged Data)

**File**: `backend/san/views.py`

**Location**: Add after `alias_list_view` function (around line 650)

**ADD this new function**:
```python
@csrf_exempt
@require_http_methods(["GET"])
def alias_project_view(request, project_id):
    """
    Get aliases in project with field_overrides applied (merged view).
    Returns only aliases in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.
    """
    from core.utils.field_merge import merge_with_overrides

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get all ProjectAlias entries for this project
    project_aliases = ProjectAlias.objects.filter(
        project=project
    ).select_related(
        'alias',
        'alias__fabric',
        'alias__host',
        'alias__storage'
    ).prefetch_related('alias__alias_wwpns')

    merged_data = []

    for pa in project_aliases:
        # Serialize base alias
        base_data = AliasSerializer(pa.alias).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pa.field_overrides:
            for field_name, override_value in pa.field_overrides.items():
                # Only apply if value actually differs from base
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    # New field from override
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pa.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    return JsonResponse({
        'results': merged_data,
        'count': len(merged_data)
    })
```

**ADD zone version** (same pattern):
```python
@csrf_exempt
@require_http_methods(["GET"])
def zone_project_view(request, project_id):
    """
    Get zones in project with field_overrides applied (merged view).
    """
    from core.utils.field_merge import merge_with_overrides

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get all ProjectZone entries for this project
    project_zones = ProjectZone.objects.filter(
        project=project
    ).select_related(
        'zone',
        'zone__fabric'
    ).prefetch_related('zone__members')

    merged_data = []

    for pz in project_zones:
        # Serialize base zone
        base_data = ZoneSerializer(pz.zone).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pz.field_overrides:
            for field_name, override_value in pz.field_overrides.items():
                # Skip member_ids (handled separately)
                if field_name == 'member_ids':
                    continue

                # Only apply if value actually differs from base
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pz.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    return JsonResponse({
        'results': merged_data,
        'count': len(merged_data)
    })
```

---

### 1.4 Add URL Routes

**File**: `backend/san/urls.py`

**ADD these routes** after the existing alias/zone routes:
```python
path('aliases/project/<int:project_id>/view/', alias_project_view, name='alias-project-view'),
path('zones/project/<int:project_id>/view/', zone_project_view, name='zone-project-view'),
```

**Also update imports** at top of file:
```python
from .views import (
    # ... existing imports ...
    alias_project_view,
    zone_project_view
)
```

---

## Phase 2: Frontend - Dual Dropdown Component (3-4 hours)

### 2.1 Create DualContextDropdown Component

**File**: `frontend/src/components/navigation/DualContextDropdown.jsx` (NEW FILE)

**CREATE this file**:
```jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { Building2, FolderOpen, Plus } from 'lucide-react';
import { ConfigContext } from '../../context/ConfigContext';
import axios from 'axios';

const DualContextDropdown = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, updateUserConfig, refreshConfig } = useContext(ConfigContext);
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Load all customers on mount
    useEffect(() => {
        loadCustomers();
    }, []);

    // Initialize selected values from config
    useEffect(() => {
        if (config?.customer) {
            setSelectedCustomer(config.customer);
        }
        if (config?.active_project) {
            setSelectedProject(config.active_project);
        } else {
            setSelectedProject(null);
        }
    }, [config]);

    // Load projects when customer changes
    useEffect(() => {
        if (selectedCustomer) {
            loadProjectsForCustomer(selectedCustomer.id);
        } else {
            setProjects([]);
            setSelectedProject(null);
        }
    }, [selectedCustomer?.id]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const response = await axios.get(`${API_URL}/api/core/customers/`);
            setCustomers(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const loadProjectsForCustomer = async (customerId) => {
        setLoadingProjects(true);
        try {
            const response = await axios.get(`${API_URL}/api/core/projects/${customerId}/`);
            setProjects(response.data);
        } catch (error) {
            console.error('Error loading projects:', error);
            setProjects([]);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleCustomerChange = async (customerId) => {
        if (customerId === 'create_new') {
            navigate('/customers');
            return;
        }

        const customer = customers.find(c => c.id === parseInt(customerId));
        setSelectedCustomer(customer);

        // Auto-clear project when switching customers (Requirement 7A)
        setSelectedProject(null);

        // Update backend: set customer, clear project
        await updateUserConfig(customer.id, null);
        await refreshConfig();
    };

    const handleProjectChange = async (projectId) => {
        if (projectId === 'create_new') {
            navigate('/projects');
            return;
        }

        if (projectId === 'none') {
            // User explicitly selected "-- None --"
            setSelectedProject(null);
            await updateUserConfig(selectedCustomer.id, null);
        } else {
            const project = projects.find(p => p.id === parseInt(projectId));
            setSelectedProject(project);
            await updateUserConfig(selectedCustomer.id, project.id);
        }

        await refreshConfig();
    };

    return (
        <div className="dual-context-dropdown">
            {/* Customer Dropdown */}
            <Dropdown>
                <Dropdown.Toggle
                    variant="outline-secondary"
                    size="sm"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '180px',
                        backgroundColor: 'var(--dropdown-bg)',
                        color: 'var(--dropdown-text)',
                        border: '1px solid var(--border-color)'
                    }}
                >
                    <Building2 size={16} />
                    {loadingCustomers ? (
                        'Loading...'
                    ) : selectedCustomer ? (
                        selectedCustomer.name
                    ) : (
                        'Select Customer'
                    )}
                </Dropdown.Toggle>

                <Dropdown.Menu style={{
                    backgroundColor: 'var(--dropdown-bg)',
                    border: '1px solid var(--border-color)'
                }}>
                    {customers.map(c => (
                        <Dropdown.Item
                            key={c.id}
                            onClick={() => handleCustomerChange(c.id)}
                            active={selectedCustomer?.id === c.id}
                            style={{
                                color: 'var(--dropdown-text)',
                                backgroundColor: selectedCustomer?.id === c.id ? 'var(--color-accent-subtle)' : 'transparent'
                            }}
                        >
                            {c.name}
                        </Dropdown.Item>
                    ))}
                    <Dropdown.Divider />
                    <Dropdown.Item
                        onClick={() => handleCustomerChange('create_new')}
                        style={{ color: 'var(--color-success-fg)' }}
                    >
                        <Plus size={14} style={{ marginRight: '6px' }} />
                        Create New Customer
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>

            {/* Project Dropdown (only show if customer selected) */}
            {selectedCustomer && (
                <Dropdown>
                    <Dropdown.Toggle
                        variant="outline-secondary"
                        size="sm"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            minWidth: '180px',
                            backgroundColor: 'var(--dropdown-bg)',
                            color: 'var(--dropdown-text)',
                            border: '1px solid var(--border-color)'
                        }}
                    >
                        <FolderOpen size={16} />
                        {loadingProjects ? (
                            'Loading...'
                        ) : selectedProject ? (
                            selectedProject.name
                        ) : (
                            'No Project'
                        )}
                    </Dropdown.Toggle>

                    <Dropdown.Menu style={{
                        backgroundColor: 'var(--dropdown-bg)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <Dropdown.Item
                            onClick={() => handleProjectChange('none')}
                            active={!selectedProject}
                            style={{
                                color: 'var(--dropdown-text)',
                                fontStyle: 'italic',
                                backgroundColor: !selectedProject ? 'var(--color-accent-subtle)' : 'transparent'
                            }}
                        >
                            -- None --
                        </Dropdown.Item>

                        {projects.length > 0 && <Dropdown.Divider />}

                        {projects.map(p => (
                            <Dropdown.Item
                                key={p.id}
                                onClick={() => handleProjectChange(p.id)}
                                active={selectedProject?.id === p.id}
                                style={{
                                    color: 'var(--dropdown-text)',
                                    backgroundColor: selectedProject?.id === p.id ? 'var(--color-accent-subtle)' : 'transparent'
                                }}
                            >
                                {p.name}
                            </Dropdown.Item>
                        ))}

                        <Dropdown.Divider />
                        <Dropdown.Item
                            onClick={() => handleProjectChange('create_new')}
                            style={{ color: 'var(--color-success-fg)' }}
                        >
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            Create New Project
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            )}
        </div>
    );
};

export default DualContextDropdown;
```

---

### 2.2 Update Navbar to Use DualContextDropdown

**File**: `frontend/src/components/navigation/Navbar.jsx`

**FIND** the import of NavbarContext (around line 10):
```javascript
import NavbarContext from './NavbarContext';
```

**REPLACE** with:
```javascript
import DualContextDropdown from './DualContextDropdown';
```

**FIND** the usage of `<NavbarContext />` in the JSX (around line 100):
```jsx
<NavbarContext />
```

**REPLACE** with:
```jsx
<DualContextDropdown />
```

---

### 2.3 Add CSS Styling

**File**: `frontend/src/styles/navbar.css`

**ADD** at the end of the file:
```css
/* Dual Context Dropdown Styling */
.dual-context-dropdown {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
  margin-right: 16px;
}

.dual-context-dropdown .dropdown-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  white-space: nowrap;
}

.dual-context-dropdown .dropdown-toggle:hover {
  background-color: var(--color-accent-subtle) !important;
}

.dual-context-dropdown .dropdown-menu {
  max-height: 400px;
  overflow-y: auto;
}

.dual-context-dropdown .dropdown-item:hover {
  background-color: var(--color-accent-subtle);
}
```

---

## Phase 3: Project View Mode in Tables (4-5 hours)

### 3.1 Update Alias Table - Filter Buttons

**File**: `frontend/src/components/tables/AliasTableTanStackClean.jsx`

**FIND** the filter buttons (around line 1117-1141):
```jsx
<button
  className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
  onClick={() => handleFilterChange('all')}
>
  All Aliases
</button>

<button
  className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
  onClick={() => handleFilterChange('current')}
>
  Current Project Only
</button>
```

**REPLACE** with:
```jsx
{/* Customer View Button */}
<button
  className={`btn ${projectFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
  onClick={() => handleFilterChange('all')}
  style={{
    marginRight: '8px'
  }}
>
  Customer View
</button>

{/* Project View Button - Disabled if no active project */}
<button
  className={`btn ${projectFilter === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
  onClick={() => handleFilterChange('current')}
  disabled={!activeProjectId}
  style={{
    opacity: activeProjectId ? 1 : 0.5,
    cursor: activeProjectId ? 'pointer' : 'not-allowed'
  }}
  title={!activeProjectId ? 'Select a project to enable Project View' : 'Show only aliases in this project'}
>
  Project View
</button>
```

---

### 3.2 Update Alias Table - API Endpoint Logic

**File**: `frontend/src/components/tables/AliasTableTanStackClean.jsx`

**FIND** the API_ENDPOINTS definition (around line 136-143):
```javascript
const API_ENDPOINTS = {
    aliases: `${API_URL}/api/san/aliases/project/`,
    fabrics: `${API_URL}/api/san/fabrics/`,
    hosts: `${API_URL}/api/san/hosts/project/`,
    aliasSave: `${API_URL}/api/san/aliases/save/`,
    aliasDelete: `${API_URL}/api/san/aliases/delete/`
};
```

**REPLACE** with:
```javascript
const API_ENDPOINTS = useMemo(() => {
    const baseUrl = `${API_URL}/api/san`;

    // Use different endpoint based on filter mode
    let aliasesUrl;
    if (projectFilter === 'current' && activeProjectId) {
        // Project View: Use merged data endpoint (only project entities with overrides applied)
        aliasesUrl = `${baseUrl}/aliases/project/${activeProjectId}/view/`;
    } else {
        // Customer View: Use regular endpoint (all customer entities)
        aliasesUrl = `${baseUrl}/aliases/project/${activeProjectId}/?project_filter=${projectFilter}`;
    }

    return {
        aliases: aliasesUrl,
        fabrics: `${baseUrl}/fabrics/`,
        hosts: `${baseUrl}/hosts/project/`,
        aliasSave: `${baseUrl}/aliases/save/`,
        aliasDelete: `${baseUrl}/aliases/delete/`
    };
}, [API_URL, activeProjectId, projectFilter]);
```

---

### 3.3 Add Cell Highlighting for Modified Fields

**File**: `frontend/src/components/tables/AliasTableTanStackClean.jsx`

**FIND** the `customRenderers` useMemo (around line 583):

**ADD** this new renderer function INSIDE the `customRenderers` object:

```javascript
// Add after the existing renderers, before the return statement

// Cell renderer for highlighting modified fields in Project View
const highlightModifiedCell = (rowData, prop, rowIndex, colIndex, accessorKey, value) => {
    // Only apply highlighting in Project View
    if (projectFilter !== 'current') {
        return value;
    }

    const modifiedFields = rowData.modified_fields || [];

    // Check if this field was modified via field_overrides
    if (modifiedFields.includes(accessorKey)) {
        // Return HTML with highlighted styling
        return `<div style="
            background-color: var(--color-accent-subtle);
            border-left: 3px solid var(--color-accent-emphasis);
            padding: 4px;
            margin: -4px;
        " title="Modified in this project">${value || ''}</div>`;
    }

    return value;
};

// Apply to all data columns (not project columns)
const dataColumns = ['name', 'use', 'notes', 'cisco_alias', 'committed', 'deployed', 'logged_in'];
dataColumns.forEach(colName => {
    renderers[colName] = highlightModifiedCell;
});
```

**UPDATE the dependencies** of the useMemo:
```javascript
}, [wwpnColumnCount, activeProjectId, projectFilter]); // Add projectFilter
```

---

### 3.4 Add Project View Legend

**File**: `frontend/src/components/tables/AliasTableTanStackClean.jsx`

**FIND** the JSX where buttons are rendered (around line 1100), **ADD BEFORE the buttons**:

```jsx
{/* Project View Legend - Only show in Project View mode */}
{projectFilter === 'current' && activeProjectId && (
  <div style={{
    padding: '10px 14px',
    marginBottom: '12px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    fontSize: '13px'
  }}>
    <span style={{ fontWeight: 600, color: 'var(--primary-text)' }}>
      📊 Project View
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '24px',
        height: '20px',
        backgroundColor: 'var(--color-accent-subtle)',
        borderLeft: '3px solid var(--color-accent-emphasis)',
        borderRadius: '3px'
      }} />
      <span style={{ color: 'var(--secondary-text)' }}>
        Modified field (overridden in this project)
      </span>
    </div>
    <div style={{ marginLeft: 'auto', color: 'var(--secondary-text)', fontSize: '12px' }}>
      Showing {/* count will be auto-populated by table */} entities from this project
    </div>
  </div>
)}

{/* Filter Buttons */}
<div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
  {/* ... your buttons here ... */}
</div>
```

---

### 3.5 Same Changes for Zone Table

**File**: `frontend/src/components/tables/ZoneTableTanStackClean.jsx`

**Apply the EXACT same changes**:

1. Update filter button labels ("Customer View" / "Project View")
2. Disable "Project View" when no activeProjectId
3. Update API_ENDPOINTS with useMemo (use zone endpoint `/zones/project/${id}/view/`)
4. Add cell highlighting renderer
5. Add legend

---

## Phase 4: Testing Checklist (2-3 hours)

### Test Scenarios

**Test 1: Customer-Only Selection**
- [ ] Select customer from dropdown
- [ ] Select "-- None --" in project dropdown
- [ ] Verify "Project View" button is disabled/grayed
- [ ] Verify "Customer View" shows all customer aliases
- [ ] No console errors

**Test 2: Project Selection & Highlighting**
- [ ] Select customer
- [ ] Select a project
- [ ] Click "Project View" button
- [ ] Verify only project aliases shown
- [ ] Create new alias in project
- [ ] Edit an alias → change "name" field
- [ ] Verify "name" cell is highlighted in Project View
- [ ] Switch to "Customer View" → verify highlighting removed

**Test 3: Customer Switch Auto-Clear**
- [ ] Select Customer A + Project X
- [ ] Switch to Customer B in dropdown
- [ ] Verify project dropdown shows "No Project"
- [ ] Verify "Project View" button is disabled
- [ ] No console errors

**Test 4: Create New Options**
- [ ] Click "+ Create New Customer" → navigates to /customers
- [ ] Select customer
- [ ] Click "+ Create New Project" → navigates to /projects

**Test 5: field_overrides Accuracy**
- [ ] In project, edit alias: change "name" from "host01" to "host01_new"
- [ ] In Project View, verify ONLY "name" cell is highlighted (not all cells)
- [ ] Edit again: change "use" from "init" to "target"
- [ ] Verify both "name" and "use" cells highlighted

**Test 6: Theme Compatibility**
- [ ] Switch to Light theme → verify highlighting visible
- [ ] Switch to Dark theme → verify highlighting visible
- [ ] Switch to Dark+ theme → verify highlighting visible

**Test 7: Edge Cases**
- [ ] Customer with 0 projects → dropdown shows "-- None --" + Create New only
- [ ] No customers exist → dropdown shows create option
- [ ] Large dataset (100+ aliases) → performance acceptable

---

## Phase 5: Documentation & Cleanup (1 hour)

### 5.1 Remove Old NavbarContext Component

**File to DELETE**: `frontend/src/components/navigation/NavbarContext.js`

Delete this file entirely - it's been replaced by DualContextDropdown.

---

### 5.2 Update CLAUDE.md

**File**: `CLAUDE.md`

**ADD new section** after the "Context and State Management" section:

```markdown
## Dual Context System (Customer & Project Selection)

The application uses a dual-dropdown system in the navbar for context selection:

### Customer Dropdown
- Always visible
- Allows selecting active customer
- Includes "+ Create New Customer" option
- Stored in UserConfig per-user

### Project Dropdown
- Appears only when customer is selected
- Includes "-- None --" option (allows customer without project)
- Includes "+ Create New Project" option
- Auto-clears when switching customers
- Stored in UserConfig per-user

### Customer View vs Project View

**Customer View** (default):
- Shows all entities across all projects for the active customer
- Uses regular API endpoints
- No field highlighting

**Project View** (requires active project):
- Shows ONLY entities in the active project (via junction tables)
- Merges base entity data with field_overrides from project
- Highlights modified fields with blue background
- Uses `/project/{id}/view/` API endpoints
- Disabled if no active project selected

### Field Highlighting in Project View
- Modified fields show light blue background with left border
- Indicates field has overrides in project (stored in field_overrides JSON)
- Only fields that differ from base value are highlighted
- Legend displayed above table explaining highlighting
```

---

### 5.3 Update FIELD_OVERRIDE_IMPLEMENTATION.md

**File**: `FIELD_OVERRIDE_IMPLEMENTATION.md`

**ADD new section** after "Usage Guide":

```markdown
## Project View Mode

### What is Project View?

Project View is a special display mode that shows:
1. **Only entities in the active project** (not all customer entities)
2. **Merged data** (base object + field_overrides applied)
3. **Visual highlighting** of modified fields

### How to Use Project View

1. Select a customer from the Customer dropdown
2. Select a project from the Project dropdown
3. Navigate to Aliases or Zones table
4. Click "Project View" button

### Visual Indicators

**Modified Field Highlighting**:
- Background: Light blue (`var(--color-accent-subtle)`)
- Left Border: Dark blue (`var(--color-accent-emphasis)`)
- Tooltip: "Modified in this project"

**Legend**:
- Displayed above table when in Project View
- Shows example of highlighted cell
- Explains what highlighting means

### Technical Implementation

**Backend**:
- New endpoints: `/api/san/aliases/project/{id}/view/`
- Merges `Alias` base data with `ProjectAlias.field_overrides`
- Returns `modified_fields` array listing override field names

**Frontend**:
- Custom cell renderer checks `modified_fields` array
- Applies highlighting only to fields in that array
- Disabled when no active project selected

### Switching Between Views

- **Customer View**: Shows all customer data, no highlighting
- **Project View**: Shows only project data, with highlighting
- Toggle preserved in localStorage per-table
- "Project View" disabled (grayed out) when no active project

### Performance

- Merging happens backend-side (efficient)
- Only entities in project fetched (smaller dataset in Project View)
- Uses select_related/prefetch_related for optimized queries
```

---

## Files Summary

### Created (2 files)
- `frontend/src/components/navigation/DualContextDropdown.jsx` (NEW)
- Backend functions in `backend/san/views.py` (alias_project_view, zone_project_view)

### Modified (8 files)
- `backend/core/views.py` - user_config_view null project handling
- `backend/san/views.py` - Add project view endpoints
- `backend/san/urls.py` - Add new routes
- `frontend/src/components/navigation/Navbar.jsx` - Use DualContextDropdown
- `frontend/src/styles/navbar.css` - Add dropdown styling
- `frontend/src/components/tables/AliasTableTanStackClean.jsx` - Project View + highlighting
- `frontend/src/components/tables/ZoneTableTanStackClean.jsx` - Project View + highlighting
- `CLAUDE.md` - Documentation
- `FIELD_OVERRIDE_IMPLEMENTATION.md` - Documentation

### Deleted (1 file)
- `frontend/src/components/navigation/NavbarContext.js` (replaced)

---

## Estimated Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| 1 | Backend Changes | 2-3 hours |
| 2 | Dual Dropdown Component | 3-4 hours |
| 3 | Project View Mode in Tables | 4-5 hours |
| 4 | Testing | 2-3 hours |
| 5 | Documentation & Cleanup | 1 hour |
| **Total** | | **12-16 hours** |

---

## Ready to Implement!

This document contains all code snippets, file locations, and exact changes needed.

**Recommended approach**: Implement phase-by-phase, testing after each phase before moving to the next.

---

**End of Implementation Guide**
