## Standardized Modal & Dropdown Components

**Created:** 2025-01-25
**Purpose:** Replace inconsistent modal and dropdown implementations across the app

---

## Problem

Currently, the app has **inconsistent modal and dropdown styling**:

### Modals:
- ❌ **BackupManagement** uses Bootstrap Modal (not theme-aware)
- ❌ **AliasTable** uses inline-styled custom modal (hardcoded colors)
- ❌ Different styling in each component
- ❌ Not theme-aware (don't update with theme changes)

### Dropdowns:
- ✅ **FilterDropdown** already uses theme context (good!)
- ❌ Other dropdowns have inconsistent styling
- ❌ No standardized approach

---

## Solution

### Standardized Components Created

#### 1. **Modal Components** (`/frontend/src/components/theme-demo/SampleModals.jsx`)

**Three modal types:**

##### A. Basic Modal
```jsx
import { Modal } from '../components/theme-demo/SampleModals';

<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Modal Title"
  size="md" // sm, md, lg, xl
  footer={
    <button onClick={() => setIsModalOpen(false)}>Close</button>
  }
>
  <p>Modal content goes here</p>
</Modal>
```

**Features:**
- Theme-aware (uses CSS variables)
- Multiple sizes (sm: 400px, md: 600px, lg: 800px, xl: 1000px)
- ESC key to close
- Click backdrop to close
- Optional header/footer
- Prevents body scroll when open
- Smooth animations

##### B. Confirmation Modal
```jsx
import { ConfirmModal } from '../components/theme-demo/SampleModals';

<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  message="Are you sure you want to delete this item? This cannot be undone."
  variant="danger" // info, warning, danger, success
  confirmText="Delete"
  cancelText="Cancel"
  isLoading={isDeleting}
/>
```

**Features:**
- Pre-styled for confirmations
- Variant colors (info/warning/danger/success)
- Icon indicators
- Loading state support

##### C. Form Modal
```jsx
import { FormModal } from '../components/theme-demo/SampleModals';

<FormModal
  isOpen={showForm}
  onClose={() => setShowForm(false)}
  onSubmit={handleSubmit}
  title="Edit Item"
  submitText="Save"
  isSubmitting={isSaving}
>
  <div className="form-group">
    <label>Name</label>
    <input type="text" className="form-input" />
  </div>
</FormModal>
```

**Features:**
- Form wrapper with submit/cancel
- Handles form submission
- Loading state support
- Pre-styled form controls

#### 2. **Dropdown Component** (`/frontend/src/components/theme-demo/SampleDropdowns.jsx`)

```jsx
import { Dropdown } from '../components/theme-demo/SampleDropdowns';

<Dropdown
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' }
  ]}
  value={selectedValue}
  onChange={setSelectedValue}
  placeholder="Select an option..."
  searchable={true}
  multi={false}
  disabled={false}
/>
```

**Features:**
- Theme-aware
- Searchable (optional)
- Multi-select support
- Custom option rendering
- Click-outside to close
- Keyboard navigation
- Disabled state

---

## Migration Guide

### Replacing Bootstrap Modals

#### Before (Bootstrap Modal):
```jsx
import { Modal } from 'react-bootstrap';

<Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
  <Modal.Header closeButton>
    <Modal.Title>Title</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    Content
  </Modal.Body>
  <Modal.Footer>
    <Button onClick={() => setShowModal(false)}>Close</Button>
  </Modal.Footer>
</Modal>
```

#### After (Standardized Modal):
```jsx
import { Modal } from '../components/theme-demo/SampleModals';

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Title"
  size="lg"
  footer={
    <button
      className="modal-btn modal-btn-primary"
      onClick={() => setShowModal(false)}
    >
      Close
    </button>
  }
>
  Content
</Modal>
```

### Replacing Inline-Styled Modals

#### Before (Inline Styles):
```jsx
<div
  className="modal show d-block"
  style={{
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 9999,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }}
>
  <div style={{
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '500px',
    margin: '100px auto'
  }}>
    Content
  </div>
</div>
```

#### After (Standardized Modal):
```jsx
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Title"
  size="md"
>
  Content
</Modal>
```

### Using Confirmation Modals

#### Before (window.confirm):
```jsx
if (!window.confirm('Are you sure you want to delete this?')) return;
await deleteItem(id);
```

#### After (Standardized ConfirmModal):
```jsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

// Trigger
<button onClick={() => setShowDeleteConfirm(true)}>Delete</button>

// Modal
<ConfirmModal
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={async () => {
    await deleteItem(id);
    setShowDeleteConfirm(false);
  }}
  title="Delete Item"
  message="Are you sure you want to delete this item? This cannot be undone."
  variant="danger"
  confirmText="Delete"
/>
```

---

## File Locations

### Components:
- **Modals**: `/frontend/src/components/theme-demo/SampleModals.jsx`
- **Modals CSS**: `/frontend/src/components/theme-demo/SampleModals.css`
- **Dropdowns**: `/frontend/src/components/theme-demo/SampleDropdowns.jsx`
- **Dropdowns CSS**: `/frontend/src/components/theme-demo/SampleDropdowns.css`

### Demo:
- Visit: `http://localhost:3000/theme-demo`
- Scroll down past the main component showcase
- See "Modal Examples" section
- See "Dropdown Examples" section

---

## Moving to Production

When ready to use these components throughout the app:

### Step 1: Move Components to Production Location

```bash
# Move from theme-demo to shared components
mv frontend/src/components/theme-demo/SampleModals.jsx \
   frontend/src/components/common/Modal.jsx

mv frontend/src/components/theme-demo/SampleModals.css \
   frontend/src/components/common/Modal.css

mv frontend/src/components/theme-demo/SampleDropdowns.jsx \
   frontend/src/components/common/Dropdown.jsx

mv frontend/src/components/theme-demo/SampleDropdowns.css \
   frontend/src/components/common/Dropdown.css
```

### Step 2: Update Imports

In components throughout the app:

```jsx
// Old
import { Modal } from 'react-bootstrap';

// New
import { Modal, ConfirmModal, FormModal } from '../components/common/Modal';
import { Dropdown } from '../components/common/Dropdown';
```

### Step 3: Replace Existing Modals/Dropdowns

**Priority order (most used first):**

1. **BackupManagement.jsx** - Has multiple Bootstrap modals
2. **AliasTableTanStackClean.jsx** - Has inline-styled error modal
3. **UniversalImporter.jsx** - Check for modals
4. **RestoreHistory.jsx** - Check for modals
5. **Other components** - Search for "Modal" in codebase

**Search command:**
```bash
# Find all files using Bootstrap Modal
grep -r "from 'react-bootstrap'" frontend/src/ | grep Modal

# Find inline modal styles
grep -r "className.*modal" frontend/src/ | grep style
```

### Step 4: Test Each Replacement

For each component you update:
1. Test modal opens
2. Test modal closes (button, ESC, backdrop)
3. Test in all 3 themes (Light, Dark, Dark+)
4. Test form submission (if FormModal)
5. Test confirmation flow (if ConfirmModal)

---

## CSS Variables Used

### Modals:
```css
--modal-bg               /* Modal background */
--modal-backdrop         /* Dark overlay */
--modal-border           /* Modal border */
--modal-shadow           /* Modal shadow */
--button-primary-bg      /* Primary button */
--button-bg              /* Secondary button */
--form-input-bg          /* Form inputs */
--color-danger-emphasis  /* Danger variant */
--color-success-emphasis /* Success variant */
--color-attention-emphasis /* Warning variant */
--color-info-emphasis    /* Info variant */
```

### Dropdowns:
```css
--form-input-bg          /* Dropdown trigger background */
--form-input-border      /* Dropdown border */
--form-input-focus-border /* Focused border */
--card-bg                /* Dropdown menu background */
--card-border            /* Menu border */
--shadow-lg              /* Menu shadow */
--color-accent-subtle    /* Selected option background */
--color-accent-emphasis  /* Selected option indicator */
```

All of these automatically update when switching themes!

---

## API Reference

### Modal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls visibility |
| `onClose` | function | required | Called when closing |
| `title` | string | - | Modal title |
| `children` | node | required | Modal content |
| `footer` | node | - | Footer content |
| `size` | string | 'md' | sm, md, lg, xl |
| `showCloseButton` | boolean | true | Show X button |
| `closeOnBackdrop` | boolean | true | Click backdrop to close |
| `closeOnEsc` | boolean | true | ESC key to close |

### ConfirmModal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls visibility |
| `onClose` | function | required | Called when closing |
| `onConfirm` | function | required | Called when confirming |
| `title` | string | required | Modal title |
| `message` | string | required | Confirmation message |
| `variant` | string | 'info' | info, warning, danger, success |
| `confirmText` | string | 'Confirm' | Confirm button text |
| `cancelText` | string | 'Cancel' | Cancel button text |
| `isLoading` | boolean | false | Disables buttons |

### FormModal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls visibility |
| `onClose` | function | required | Called when closing |
| `onSubmit` | function | required | Form submit handler |
| `title` | string | required | Modal title |
| `children` | node | required | Form content |
| `submitText` | string | 'Save' | Submit button text |
| `cancelText` | string | 'Cancel' | Cancel button text |
| `isSubmitting` | boolean | false | Disables buttons |
| `size` | string | 'md' | sm, md, lg, xl |

### Dropdown Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | array | required | `[{value, label}]` |
| `value` | any | required | Selected value(s) |
| `onChange` | function | required | Called on selection |
| `placeholder` | string | 'Select...' | Placeholder text |
| `searchable` | boolean | false | Enable search |
| `multi` | boolean | false | Multi-select |
| `disabled` | boolean | false | Disabled state |
| `renderOption` | function | - | Custom option renderer |
| `className` | string | '' | Additional classes |

---

## Best Practices

### Modals

1. **Always provide a title** - Helps users understand context
2. **Use appropriate variant** - info/warning/danger/success
3. **Use ConfirmModal for destructive actions** - Better UX than window.confirm
4. **Use FormModal for data entry** - Handles submission flow
5. **Keep modals focused** - One action per modal
6. **Test keyboard navigation** - ESC to close should work

### Dropdowns

1. **Use searchable for long lists** - 8+ options
2. **Provide clear placeholder** - "Select fabric..." not "Select..."
3. **Use multi-select sparingly** - Can be confusing
4. **Consider custom rendering** - For status indicators, icons, etc.
5. **Test with theme switching** - Should adapt to all themes

---

## Examples from Demo

Visit `/theme-demo` and scroll down to see:

### Modal Examples:
- Basic modal with custom footer
- Info confirmation
- Warning confirmation
- Danger confirmation (delete)
- Form modal with inputs
- All sizes (sm, md, lg, xl)

### Dropdown Examples:
- Simple dropdown
- Searchable dropdown
- Multi-select dropdown
- Disabled dropdown
- Custom rendered dropdown
- Usage code examples

**All examples are fully functional** - click buttons to try them!

---

## Next Steps

1. ✅ **Review in theme demo** - Test all variants and features
2. ✅ **Approve design** - Make sure you like the look and feel
3. ⏳ **Move to production** - Copy to `/components/common/`
4. ⏳ **Replace BackupManagement modals** - Start with this file
5. ⏳ **Replace AliasTable modal** - Fix inline styles
6. ⏳ **Search and replace** - Find all other modals/dropdowns
7. ⏳ **Remove Bootstrap Modal** - Clean up dependencies

---

**Last Updated:** 2025-01-25
