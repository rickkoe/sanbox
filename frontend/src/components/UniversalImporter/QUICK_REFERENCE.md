# Universal Importer - Quick Reference Guide

## Component Quick Reference

### StepIndicator
```jsx
<StepIndicator currentStep={1-4} theme="light|dark" />
```
**Shows**: Progress through 4-step wizard with animations

---

### ImportTypeSelector
```jsx
<ImportTypeSelector
  selectedType="san|storage|hosts"
  onTypeSelect={(type) => setType(type)}
  theme="light|dark"
/>
```
**Shows**: Cards for selecting import data type

---

### DataUploader
```jsx
<DataUploader
  sourceType="file|paste"
  onSourceTypeChange={setType}
  uploadedFiles={files}
  onFilesChange={setFiles}
  pastedText={text}
  onTextChange={setText}
  onPreview={handlePreview}
  loading={false}
  error={null}
  theme="light|dark"
/>
```
**Shows**: File upload or text paste interface

---

### DataPreview
```jsx
<DataPreview
  previewData={data}
  selectedAliases={Set}
  selectedZones={Set}
  selectedFabrics={Set}
  onAliasToggle={(key) => toggle(key)}
  onZoneToggle={(key) => toggle(key)}
  onFabricToggle={(key) => toggle(key)}
  onSelectAll={(type) => selectAll(type)}
  conflicts={conflicts}
  theme="light|dark"
/>
```
**Shows**: Tables with preview data and selection checkboxes

---

### ConfigurationPanel
```jsx
<ConfigurationPanel
  existingFabrics={fabrics}
  selectedFabricId={id}
  onFabricSelect={setId}
  createNewFabric={false}
  onCreateNewToggle={setCreate}
  fabricName={name}
  onFabricNameChange={setName}
  conflicts={conflicts}
  conflictResolutions={resolutions}
  onConflictResolve={(name, resolution) => resolve(name, resolution)}
  theme="light|dark"
/>
```
**Shows**: Import configuration and conflict resolution

---

### ImportProgress
```jsx
<ImportProgress
  importStatus="PENDING|RUNNING|COMPLETED|FAILED"
  importProgress={progress}
  onViewLogs={() => showLogs()}
  onViewFabrics={() => navigate('/fabrics')}
  onImportMore={() => reset()}
  onTryAgain={() => retry()}
  theme="light|dark"
/>
```
**Shows**: Import execution status and results

---

## Common Props

All components accept:
- **theme**: `'light'` or `'dark'` - Required for proper theming

---

## CSS Class Patterns

### Theme Classes
```css
.component-name.theme-light { }
.component-name.theme-dark { }
```

### State Classes
```css
.component-name.active { }
.component-name.selected { }
.component-name.disabled { }
.component-name.loading { }
.component-name.error { }
```

### Modifier Classes
```css
.component-name.color-primary { }
.component-name.color-success { }
.component-name.color-error { }
.component-name.size-small { }
.component-name.size-large { }
```

---

## Theme Variables

### Colors
```css
--primary-color
--primary-light
--success-color
--error-color
--warning-color
--info-color
--text-color
--text-muted
--background-color
--border-color
```

### Effects
```css
--shadow-sm
--shadow-md
--border-radius
--transition-speed
```

---

## API Endpoints

### Parse Preview
```
POST /api/importer/parse-preview/
Body: { customer_id, data, check_conflicts }
Returns: { parser, counts, aliases, zones, fabrics, conflicts }
```

### Import Config
```
POST /api/importer/import-san-config/
Body: { customer_id, data, fabric_id, selected_items, conflict_resolutions }
Returns: { import_id, status }
```

### Import Progress
```
GET /api/importer/import-progress/{import_id}/
Returns: { status, progress, message, stats }
```

### Import Logs
```
GET /api/importer/logs/{import_id}/?limit=100&since=timestamp
Returns: { logs: [...] }
```

---

## Common Patterns

### State Setup
```javascript
const [step, setStep] = useState(1);
const [importType, setImportType] = useState('san');
const [sourceType, setSourceType] = useState('file');
const [uploadedFiles, setUploadedFiles] = useState([]);
const [pastedText, setPastedText] = useState('');
const [previewData, setPreviewData] = useState(null);
const [selectedAliases, setSelectedAliases] = useState(new Set());
```

### Toggle Handler
```javascript
const handleToggle = useCallback((key) => {
  setSelected(prev => {
    const newSet = new Set(prev);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    return newSet;
  });
}, []);
```

### API Call Pattern
```javascript
const handleAction = async () => {
  setLoading(true);
  setError(null);
  try {
    const response = await axios.post('/api/endpoint', data);
    // Handle success
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Progress Polling
```javascript
const interval = setInterval(async () => {
  const response = await axios.get(`/api/progress/${id}/`);
  setProgress(response.data);
  if (response.data.status === 'completed') {
    clearInterval(interval);
  }
}, 2000);
```

---

## Responsive Breakpoints

```css
/* Desktop */
@media (min-width: 1200px) { }

/* Tablet */
@media (max-width: 1200px) { }
@media (max-width: 768px) { }

/* Mobile */
@media (max-width: 480px) { }
```

---

## Common Animations

### Fade In
```css
animation: fadeIn 0.5s ease;

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Slide In
```css
animation: slideIn 0.5s ease;

@keyframes slideIn {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### Pulse
```css
animation: pulse 2s infinite;

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

---

## Troubleshooting Quick Fixes

### Components Not Showing
✓ Check theme prop is provided
✓ Verify CSS imports
✓ Check browser console for errors

### Theme Not Working
✓ Apply `theme-${theme}` class to root element
✓ Import themes.css
✓ Use CSS variables

### Performance Issues
✓ Add React.memo to components
✓ Use useCallback for handlers
✓ Implement virtual scrolling for large lists

### API Errors
✓ Check network tab in DevTools
✓ Verify endpoint URLs
✓ Check request payload format
✓ Add error handling

---

## File Locations

```
frontend/src/
├── components/UniversalImporter/
│   ├── StepIndicator.jsx
│   ├── ImportTypeSelector.jsx
│   ├── DataUploader.jsx
│   ├── DataPreview.jsx
│   ├── ConfigurationPanel.jsx
│   ├── ImportProgress.jsx
│   └── styles/
│       ├── StepIndicator.css
│       ├── ImportTypeSelector.css
│       ├── DataUploader.css
│       ├── DataPreview.css
│       ├── ConfigurationPanel.css
│       └── ImportProgress.css
├── pages/
│   ├── UniversalImporter.jsx
│   └── UniversalImporter.css
└── styles/
    └── themes.css
```

---

## Testing Checklist

Quick test list:
- [ ] Step 1: Select type
- [ ] Step 2: Upload file
- [ ] Step 2: Paste text
- [ ] Step 3: Preview displays
- [ ] Step 3: Select items
- [ ] Step 3: Configure fabric
- [ ] Step 3: Resolve conflicts
- [ ] Step 4: Import runs
- [ ] Step 4: Progress updates
- [ ] Step 4: Success/error handled
- [ ] Theme switching works
- [ ] Mobile responsive
- [ ] Keyboard navigation

---

## Version Info

**Current Version**: 2.0.0
**Last Updated**: January 2025
**Status**: Production Ready

---

## Quick Links

- [Full Documentation](./README.md)
- [Theme Guide](../../styles/themes.css)
- [API Docs](../../../backend/docs/api.md)
- [Issue Tracker](https://github.com/yourorg/sanbox/issues)