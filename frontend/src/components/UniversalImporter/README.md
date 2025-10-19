# Universal Importer Components

## Overview

The Universal Importer is a comprehensive, enterprise-grade data import system built with React. It provides a professional, multi-step wizard interface for importing SAN configurations, storage systems, and host data into the Sanbox application.

This document provides complete technical documentation for the redesigned Universal Importer component system.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Component Library](#component-library)
3. [Styling System](#styling-system)
4. [Usage Guide](#usage-guide)
5. [API Integration](#api-integration)
6. [Theme Support](#theme-support)
7. [Customization](#customization)
8. [Performance Considerations](#performance-considerations)
9. [Accessibility](#accessibility)
10. [Troubleshooting](#troubleshooting)

---

## Architecture

### Component Hierarchy

```
UniversalImporter (Main Container)
├── StepIndicator
├── ImportTypeSelector
├── DataUploader
├── DataPreview
├── ConfigurationPanel
├── ImportProgress
└── ImportLogger (Modal)
```

### Design Principles

1. **Modular Architecture**: Each step is encapsulated in its own component
2. **Separation of Concerns**: Logic, presentation, and styling are separated
3. **Reusability**: Components can be used independently or combined
4. **Theme Integration**: Full support for light/dark themes
5. **Responsive Design**: Mobile-first approach with graceful degradation
6. **Performance**: Optimized with React hooks, memoization, and virtual scrolling

### File Structure

```
frontend/src/
├── pages/
│   ├── UniversalImporter.jsx          # Main orchestrator component
│   └── UniversalImporter.css          # Main styling and layout
├── components/
│   ├── UniversalImporter/
│   │   ├── StepIndicator.jsx          # Step progress visualization
│   │   ├── ImportTypeSelector.jsx     # Import type selection cards
│   │   ├── DataUploader.jsx           # File/text upload interface
│   │   ├── DataPreview.jsx            # Data preview tables
│   │   ├── ConfigurationPanel.jsx     # Import configuration
│   │   ├── ImportProgress.jsx         # Import execution & progress
│   │   ├── README.md                  # This documentation
│   │   └── styles/
│   │       ├── StepIndicator.css
│   │       ├── ImportTypeSelector.css
│   │       ├── DataUploader.css
│   │       ├── DataPreview.css
│   │       ├── ConfigurationPanel.css
│   │       └── ImportProgress.css
│   └── ImportLogger.js                # Log viewing modal (existing)
└── styles/
    └── themes.css                     # Global theme variables
```

---

## Component Library

### 1. StepIndicator

**Purpose**: Visual representation of the multi-step wizard progress

**Props**:
```javascript
{
  currentStep: number,    // Current active step (1-4)
  theme: string          // 'light' or 'dark'
}
```

**Features**:
- Animated step icons with glass-morphism effects
- Progress line with gradient fill
- Completion checkmarks with bounce animation
- Responsive design with mobile progress bar
- Hover effects with descriptions

**Usage**:
```jsx
<StepIndicator currentStep={2} theme="dark" />
```

**Visual States**:
- **Pending**: Muted colors, default icon
- **Active**: Primary color, pulsing ring animation
- **Completed**: Success color, checkmark overlay

---

### 2. ImportTypeSelector

**Purpose**: Card-based selection interface for import types

**Props**:
```javascript
{
  selectedType: string,           // Currently selected type ('san', 'storage', 'hosts')
  onTypeSelect: (type) => void,  // Selection callback
  theme: string                  // 'light' or 'dark'
}
```

**Features**:
- Glass-morphism card effects
- Animated icon backgrounds
- 3D transform on hover
- "Coming Soon" ribbon overlays
- Feature lists with icons
- Statistics display
- Disabled state for unavailable options

**Usage**:
```jsx
<ImportTypeSelector
  selectedType="san"
  onTypeSelect={(type) => setImportType(type)}
  theme="light"
/>
```

**Card Structure**:
Each card includes:
- Primary icon with animated background
- Title and description
- Feature list with checkmarks
- Statistics/status indicator
- Selection state indicator

---

### 3. DataUploader

**Purpose**: File upload and text paste interface with enhanced UX

**Props**:
```javascript
{
  sourceType: string,                    // 'file' or 'paste'
  onSourceTypeChange: (type) => void,   // Tab change callback
  uploadedFiles: File[],                 // Array of uploaded files
  onFilesChange: (files) => void,       // File change callback
  pastedText: string,                    // Pasted text content
  onTextChange: (text) => void,         // Text change callback
  onPreview: () => void,                // Preview action callback
  loading: boolean,                      // Loading state
  error: string,                        // Error message
  theme: string                         // 'light' or 'dark'
}
```

**Features**:

**File Upload Mode**:
- Drag-and-drop zone with visual feedback
- Click to browse files
- File preview with type icons
- File size display
- Multiple file support
- Remove file functionality
- Animated drag states

**Text Paste Mode**:
- Monaco-editor style code input
- Line numbers
- Fullscreen toggle
- Character and line counter
- Copy example functionality
- Syntax highlighting placeholder

**Usage**:
```jsx
<DataUploader
  sourceType="file"
  onSourceTypeChange={setSourceType}
  uploadedFiles={files}
  onFilesChange={setFiles}
  pastedText={text}
  onTextChange={setText}
  onPreview={handlePreview}
  loading={false}
  error={null}
  theme="dark"
/>
```

**Supported File Types**: `.txt`, `.csv`, `.log`, `.conf`, `.cfg`

---

### 4. DataPreview

**Purpose**: Display and manage preview data with selection controls

**Props**:
```javascript
{
  previewData: object,                           // Parsed data from API
  selectedAliases: Set,                          // Selected alias keys
  selectedZones: Set,                            // Selected zone keys
  selectedFabrics: Set,                          // Selected fabric keys
  onAliasToggle: (key) => void,                 // Alias selection toggle
  onZoneToggle: (key) => void,                  // Zone selection toggle
  onFabricToggle: (key) => void,                // Fabric selection toggle
  onSelectAll: (type) => void,                  // Select/deselect all
  onDeselectAll: (type) => void,                // Deselect all (legacy)
  conflicts: object,                             // Conflict data
  theme: string                                  // 'light' or 'dark'
}
```

**Preview Data Structure**:
```javascript
{
  parser: 'cisco_mds' | 'brocade',
  counts: {
    aliases: number,
    zones: number,
    fabrics: number
  },
  aliases: [
    { name: string, wwpn: string, type: string, fabric: string }
  ],
  zones: [
    { name: string, members: string[], type: string, fabric: string }
  ],
  fabrics: [
    { name: string, vsan: string, zoneset: string, vendor: string }
  ],
  conflicts: {
    zones: [{ name: string, existing: object, new: object }]
  },
  warnings: string[]
}
```

**Features**:
- Statistics cards with animated counters
- Parser format detection display
- Collapsible table sections
- Search/filter functionality
- Select/deselect all per section
- Row selection with visual feedback
- Conflict indicators
- Sticky table headers
- Virtual scrolling for large datasets
- Custom scrollbar styling

**Usage**:
```jsx
<DataPreview
  previewData={data}
  selectedAliases={selectedAliases}
  selectedZones={selectedZones}
  selectedFabrics={selectedFabrics}
  onAliasToggle={handleAliasToggle}
  onZoneToggle={handleZoneToggle}
  onFabricToggle={handleFabricToggle}
  onSelectAll={handleSelectAll}
  conflicts={conflicts}
  theme="dark"
/>
```

**Table Features**:
- **Aliases Table**: Name, WWPN, Type, Fabric
- **Zones Table**: Name, Members, Type, Fabric (with conflict indicators)
- **Fabrics Table**: Name, VSAN, Zoneset, Vendor

---

### 5. ConfigurationPanel

**Purpose**: Configure import settings and resolve conflicts

**Props**:
```javascript
{
  existingFabrics: array,                       // Array of existing fabrics
  selectedFabricId: string,                     // Selected fabric ID or 'new'
  onFabricSelect: (id) => void,                // Fabric selection callback
  createNewFabric: boolean,                     // Create new fabric flag
  onCreateNewToggle: (value) => void,          // Toggle callback
  fabricName: string,                           // New fabric name
  onFabricNameChange: (name) => void,          // Name change callback
  conflicts: object,                            // Conflict data
  conflictResolutions: object,                  // Resolution choices
  onConflictResolve: (name, resolution) => void, // Conflict resolution callback
  theme: string                                 // 'light' or 'dark'
}
```

**Features**:

**Fabric Selection**:
- Custom searchable dropdown
- Grouped by vendor
- Create new fabric option
- Visual vendor indicators
- Inline new fabric name input

**Conflict Resolution**:
- Side-by-side conflict display
- Resolution options:
  - Skip: Don't import conflicting item
  - Replace: Overwrite existing item
  - Rename: Import with modified name
- Visual conflict count
- Progress indicator for resolved conflicts

**Import Options**:
- Validate WWPNs checkbox
- Auto-create aliases checkbox
- Dry run mode checkbox

**Usage**:
```jsx
<ConfigurationPanel
  existingFabrics={fabrics}
  selectedFabricId={fabricId}
  onFabricSelect={setFabricId}
  createNewFabric={false}
  onCreateNewToggle={setCreateNewFabric}
  fabricName={fabricName}
  onFabricNameChange={setFabricName}
  conflicts={conflicts}
  conflictResolutions={resolutions}
  onConflictResolve={handleConflictResolve}
  theme="dark"
/>
```

**Fabric Object Structure**:
```javascript
{
  id: number,
  name: string,
  vsan: string,
  vendor: 'Cisco' | 'Brocade' | 'Other'
}
```

---

### 6. ImportProgress

**Purpose**: Display import execution status and results

**Props**:
```javascript
{
  importStatus: string,                  // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  importProgress: object,                // Progress data from API
  onViewLogs: () => void,               // View logs callback
  onViewFabrics: () => void,            // Navigate to fabrics callback
  onImportMore: () => void,             // Reset and import more callback
  onTryAgain: () => void,               // Retry import callback
  theme: string                         // 'light' or 'dark'
}
```

**Import Progress Structure**:
```javascript
{
  status: 'success' | 'error',
  progress: number,                      // 0-100
  message: string,
  current_item: string,
  stats: {
    aliases: number,
    zones: number,
    fabrics: number,
    duration: number
  },
  timeline: [
    { time: string, message: string, status: string }
  ],
  error: string,
  details: object
}
```

**Features**:

**Status Display**:
- Large animated status icon
- Color-coded states
- Status-specific messaging

**Progress Tracking** (Running state):
- Animated progress bar
- Percentage display
- Current item indicator
- Real-time updates

**Success State**:
- Confetti animation (5-second celebration)
- Statistics cards with animated counters
- Action buttons:
  - View Fabrics
  - Import More Data
  - View Logs

**Error State**:
- Error details display
- Code-formatted error message
- Action buttons:
  - Try Again
  - View Error Logs
  - Back to Start

**Timeline** (Optional):
- Step-by-step import progress
- Timestamped events
- Status indicators per event

**Usage**:
```jsx
<ImportProgress
  importStatus="COMPLETED"
  importProgress={progressData}
  onViewLogs={() => setShowLogs(true)}
  onViewFabrics={() => navigate('/san/fabrics')}
  onImportMore={handleReset}
  onTryAgain={handleRetry}
  theme="dark"
/>
```

---

## Styling System

### CSS Architecture

Each component has its own CSS file following this structure:

```css
/* Component-specific styles */
.component-name { }

/* Sub-elements */
.component-element { }

/* State modifiers */
.component-name.active { }
.component-name.disabled { }

/* Theme-specific overrides */
.theme-dark .component-name { }
.theme-light .component-name { }

/* Animations */
@keyframes animationName { }

/* Responsive breakpoints */
@media (max-width: 768px) { }
```

### Theme Variables Used

All components utilize CSS variables from `themes.css`:

**Color Variables**:
```css
--primary-color
--primary-light
--primary-rgb
--success-color
--error-color
--warning-color
--info-color
--text-color
--text-muted
--background-color
--background-secondary
--card-background
--border-color
```

**Effect Variables**:
```css
--shadow-sm
--shadow-md
--shadow-heavy
--border-radius
--transition-speed
--backdrop-blur
```

**Component-Specific**:
```css
--code-bg
--code-text
--table-bg
--table-row-hover
--table-row-selected
```

### Animation Library

**Core Animations**:
- `fadeIn` - Opacity fade in
- `fadeInUp` - Fade in with upward motion
- `slideIn` - Slide in from left
- `slideDown` - Expand downward
- `pulse` - Pulsing scale effect
- `spin` - Continuous rotation
- `shimmer` - Shimming highlight effect
- `checkIn` - Bouncy checkmark appearance
- `shake` - Horizontal shake for errors
- `confettiFall` - Confetti particle animation

**Timing Functions**:
- Standard: `cubic-bezier(0.4, 0, 0.2, 1)`
- Bounce: `cubic-bezier(0.68, -0.55, 0.265, 1.55)`
- Linear: `linear`

### Glass-morphism Effects

All premium cards use glass-morphism:

```css
.glass-card {
  background: rgba(var(--card-bg-rgb), 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## Usage Guide

### Basic Implementation

```jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfigContext } from '../context/ConfigContext';
import { useTheme } from '../context/ThemeContext';

import StepIndicator from '../components/UniversalImporter/StepIndicator';
import ImportTypeSelector from '../components/UniversalImporter/ImportTypeSelector';
// ... other imports

const UniversalImporter = () => {
  const { theme } = useTheme();
  const [step, setStep] = useState(1);

  return (
    <div className={`universal-importer theme-${theme}`}>
      <StepIndicator currentStep={step} theme={theme} />
      {/* Other components */}
    </div>
  );
};
```

### State Management

The main component manages state for:

1. **Wizard Navigation**: `step` (1-4)
2. **Import Type**: `importType` ('san', 'storage', 'hosts')
3. **Data Source**: `sourceType`, `uploadedFiles`, `pastedText`
4. **Preview**: `previewData`, `selectedAliases/Zones/Fabrics`
5. **Configuration**: `fabricName`, `selectedFabricId`, `conflicts`
6. **Execution**: `importId`, `importProgress`, `importStatus`

### Event Handlers

**Selection Handlers**:
```javascript
const handleAliasToggle = useCallback((aliasKey) => {
  setSelectedAliases(prev => {
    const newSet = new Set(prev);
    if (newSet.has(aliasKey)) {
      newSet.delete(aliasKey);
    } else {
      newSet.add(aliasKey);
    }
    return newSet;
  });
}, []);
```

**Navigation Handlers**:
```javascript
const handleNext = () => {
  if (step === 2) {
    handlePreview(); // Parse and preview data
  } else if (step === 3) {
    handleImport(); // Execute import
  } else {
    setStep(step + 1);
  }
};

const handleBack = () => {
  if (step > 1) setStep(step - 1);
};
```

### API Integration Pattern

```javascript
const handlePreview = async () => {
  setLoading(true);
  try {
    const response = await axios.post('/api/importer/parse-preview/', {
      customer_id: config.customer.id,
      data: dataToPreview,
      check_conflicts: true
    });
    setPreviewData(response.data);
    setStep(3);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

---

## API Integration

### Endpoints

**1. Parse Preview**
```
POST /api/importer/parse-preview/

Request:
{
  customer_id: number,
  data: string,
  check_conflicts: boolean
}

Response:
{
  success: boolean,
  parser: string,
  counts: { aliases: number, zones: number, fabrics: number },
  aliases: [...],
  zones: [...],
  fabrics: [...],
  conflicts: { zones: [...] },
  warnings: [...]
}
```

**2. Import SAN Config**
```
POST /api/importer/import-san-config/

Request:
{
  customer_id: number,
  data: string,
  fabric_id: number | null,
  fabric_name: string | null,
  create_new_fabric: boolean,
  selected_items: {
    aliases: string[],
    zones: string[],
    fabrics: string[]
  },
  conflict_resolutions: object,
  project_id: number
}

Response:
{
  import_id: string,
  status: string
}
```

**3. Import Progress**
```
GET /api/importer/import-progress/{import_id}/

Response:
{
  status: 'running' | 'completed' | 'failed',
  progress: number,
  message: string,
  current_item: string,
  stats: {...},
  timeline: [...]
}
```

**4. Import Logs**
```
GET /api/importer/logs/{import_id}/

Query Parameters:
- limit: number (default: 100)
- since: timestamp

Response:
{
  logs: [
    { timestamp: string, level: string, message: string }
  ]
}
```

### Progress Polling

```javascript
const startProgressPolling = (importId) => {
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(
        `/api/importer/import-progress/${importId}/`
      );
      setImportProgress(response.data);

      if (response.data.status === 'completed' ||
          response.data.status === 'failed') {
        clearInterval(interval);
        setImportRunning(false);
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, 2000); // Poll every 2 seconds

  return interval;
};
```

---

## Theme Support

### Light Theme

**Characteristics**:
- Clean, professional appearance
- Soft gradients and subtle depth
- Dark navy blue accents (#1e3a52)
- High contrast for readability
- Shadows: rgba(30, 58, 82, 0.1)

**Primary Colors**:
```css
--primary-color: #1e3a52
--primary-light: #2a4a68
--primary-rgb: 30, 58, 82
--card-background: rgba(255, 255, 255, 0.95)
--background-secondary: #f8fafc
```

### Dark Theme

**Characteristics**:
- Cyberpunk aesthetic
- Cyan/teal accents (#64ffda)
- Deep backgrounds
- Glowing effects
- Shadows: rgba(0, 0, 0, 0.4)

**Primary Colors**:
```css
--primary-color: #64ffda
--primary-light: #4fd1c7
--primary-rgb: 100, 255, 218
--card-background: rgba(30, 30, 60, 0.8)
--background-secondary: rgba(20, 20, 40, 0.6)
```

### Theme Switching

Themes are controlled via the `ThemeContext`:

```javascript
import { useTheme } from '../context/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme(); // 'light' or 'dark'

  return (
    <div className={`my-component theme-${theme}`}>
      {/* Content */}
    </div>
  );
};
```

### Adding Theme Support to New Components

1. Accept `theme` as a prop
2. Apply theme class to root element: `className={theme-${theme}}`
3. Use CSS variables from themes.css
4. Add theme-specific overrides:

```css
/* Component base styles use variables */
.my-component {
  background: var(--card-background);
  color: var(--text-color);
}

/* Dark theme specific overrides */
.theme-dark .my-component {
  box-shadow: 0 10px 40px rgba(100, 255, 218, 0.2);
}

/* Light theme specific overrides */
.theme-light .my-component {
  box-shadow: 0 10px 40px rgba(30, 58, 82, 0.1);
}
```

---

## Customization

### Modifying Colors

Edit `/frontend/src/styles/themes.css`:

```css
.theme-light {
  --primary-color: #your-color;
  --primary-light: #your-lighter-color;
  --primary-rgb: r, g, b;
}
```

### Adding New Import Types

1. Edit `ImportTypeSelector.jsx`:

```javascript
const importTypes = [
  // ... existing types
  {
    id: 'new-type',
    title: 'New Import Type',
    description: 'Description of new type',
    icon: YourIcon,
    color: 'primary',
    available: true,
    features: [
      { icon: Check, text: 'Feature 1' },
      { icon: Check, text: 'Feature 2' }
    ],
    stats: {
      icon: TrendingUp,
      value: '5K+',
      label: 'Items Imported'
    }
  }
];
```

2. Add corresponding logic to main component
3. Update API endpoints as needed

### Customizing Animations

Edit animation keyframes in component CSS files:

```css
@keyframes customAnimation {
  0% { /* start state */ }
  100% { /* end state */ }
}

.element {
  animation: customAnimation 0.5s ease;
}
```

### Adding New Steps

1. Update `StepIndicator.jsx` steps array
2. Add step content in main component
3. Update navigation logic
4. Add corresponding CSS

---

## Performance Considerations

### Optimization Techniques Used

1. **React.memo**: Prevent unnecessary re-renders
```javascript
const MemoizedComponent = React.memo(Component);
```

2. **useCallback**: Memoize callback functions
```javascript
const handleToggle = useCallback((key) => {
  // Logic
}, [dependencies]);
```

3. **useMemo**: Memoize expensive calculations
```javascript
const filteredData = useMemo(() => {
  return data.filter(/* filtering logic */);
}, [data, filterTerm]);
```

4. **Virtual Scrolling**: For large datasets in tables
5. **Lazy Loading**: Components loaded as needed
6. **Debounced Search**: Reduces API calls

### Performance Best Practices

- **Minimize State Updates**: Batch updates where possible
- **Avoid Inline Functions**: Use useCallback for event handlers
- **Optimize Images**: Use appropriate file formats and sizes
- **CSS Animations**: Use transforms instead of position changes
- **Conditional Rendering**: Only render visible components

### Measuring Performance

Use React DevTools Profiler:

```javascript
import { Profiler } from 'react';

<Profiler id="UniversalImporter" onRender={onRenderCallback}>
  <UniversalImporter />
</Profiler>
```

---

## Accessibility

### WCAG Compliance

All components follow WCAG 2.1 AA standards:

1. **Keyboard Navigation**:
   - All interactive elements are keyboard accessible
   - Tab order is logical
   - Focus states are clearly visible

2. **Screen Reader Support**:
   - Semantic HTML elements
   - ARIA labels where needed
   - Descriptive alt text

3. **Color Contrast**:
   - Text meets 4.5:1 contrast ratio
   - UI components meet 3:1 contrast ratio

4. **Motion**:
   - Respects `prefers-reduced-motion`
   - Animations can be disabled

### Accessibility Features

**Focus Management**:
```css
.component *:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**ARIA Labels**:
```jsx
<button aria-label="Close modal">
  <X size={20} />
</button>
```

### Testing Accessibility

Use these tools:
- **axe DevTools**: Browser extension for accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Chrome DevTools accessibility audit
- **Screen Reader Testing**: NVDA (Windows), VoiceOver (Mac)

---

## Troubleshooting

### Common Issues

**1. Components Not Rendering**

**Problem**: Components show blank or error

**Solution**:
- Check that all props are provided
- Verify theme prop is 'light' or 'dark'
- Check browser console for errors
- Ensure CSS files are imported

**2. Theme Not Applying**

**Problem**: Components don't match selected theme

**Solution**:
```javascript
// Verify theme context is available
import { useTheme } from '../context/ThemeContext';
const { theme } = useTheme();

// Check className application
<div className={`component theme-${theme}`}>
```

**3. Animations Not Working**

**Problem**: No animations or transitions

**Solution**:
- Check for `prefers-reduced-motion` setting
- Verify CSS is not being overridden
- Ensure keyframes are defined
- Check browser compatibility

**4. API Integration Failures**

**Problem**: Preview or import fails

**Solution**:
```javascript
// Add error handling
try {
  const response = await axios.post('/api/endpoint', data);
  // Handle success
} catch (err) {
  console.error('API Error:', err.response?.data);
  setError(err.response?.data?.error || 'Operation failed');
}
```

**5. Performance Issues**

**Problem**: Slow rendering or laggy interactions

**Solution**:
- Use React DevTools Profiler to identify bottlenecks
- Implement virtualization for large lists
- Memoize expensive computations
- Reduce unnecessary re-renders

### Debug Mode

Enable detailed logging:

```javascript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('State:', { step, importType, selectedItems });
}
```

### Browser Compatibility

**Supported Browsers**:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

**Known Issues**:
- Internet Explorer: Not supported
- Safari < 14: Backdrop filter may not work
- Firefox < 88: Some CSS Grid features limited

### Getting Help

1. **Check Documentation**: Review this README
2. **Browser Console**: Look for JavaScript errors
3. **React DevTools**: Inspect component props and state
4. **Network Tab**: Verify API calls and responses
5. **CSS Inspection**: Check computed styles in DevTools

---

## Advanced Topics

### Custom Validators

Add custom validation to imports:

```javascript
const validateData = (data) => {
  const errors = [];

  // Validate WWPNs
  data.aliases.forEach(alias => {
    if (!isValidWWPN(alias.wwpn)) {
      errors.push(`Invalid WWPN: ${alias.wwpn}`);
    }
  });

  return errors;
};
```

### Extending Import Types

To add support for new data types:

1. **Update ImportTypeSelector**: Add new card
2. **Create Parser**: Backend parser for new format
3. **Add API Endpoints**: New import endpoints
4. **Update DataPreview**: Tables for new data type
5. **Add Configuration**: Type-specific config options

### Custom Parsers

Backend parser structure:

```python
class CustomParser:
    def parse(self, data):
        # Parse logic
        return {
            'aliases': [],
            'zones': [],
            'fabrics': [],
            'metadata': {}
        }

    def validate(self, parsed_data):
        # Validation logic
        return errors
```

### Webhook Integration

Add webhooks for import completion:

```javascript
const handleImportComplete = async (importId, status) => {
  if (webhookUrl) {
    await axios.post(webhookUrl, {
      event: 'import_complete',
      import_id: importId,
      status: status,
      timestamp: new Date().toISOString()
    });
  }
};
```

---

## Migration Guide

### From Old to New Interface

If migrating from the previous Universal Importer:

1. **State Migration**: Update state structure to match new props
2. **API Compatibility**: Ensure API responses match expected format
3. **Theme Integration**: Apply theme classes to root elements
4. **Component Replacement**: Replace old components with new ones
5. **Testing**: Thoroughly test each step of the wizard

### Backwards Compatibility

The new interface maintains API compatibility:
- Same endpoints
- Same request/response formats
- Same data structures
- Existing imports continue to work

---

## Contributing

### Development Workflow

1. **Clone Repository**
2. **Install Dependencies**: `npm install`
3. **Start Dev Server**: `./start`
4. **Make Changes**
5. **Test Thoroughly**
6. **Submit PR**

### Code Style

- **JavaScript**: ES6+ with JSX
- **CSS**: BEM naming convention
- **Comments**: JSDoc for functions
- **Formatting**: Prettier (2 spaces)
- **Linting**: ESLint

### Testing Checklist

- [ ] All steps navigate correctly
- [ ] File upload works
- [ ] Text paste works
- [ ] Preview displays correctly
- [ ] Selection/deselection works
- [ ] Configuration saves properly
- [ ] Import executes successfully
- [ ] Progress updates in real-time
- [ ] Error handling works
- [ ] Theme switching works
- [ ] Responsive on mobile
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

---

## Changelog

### Version 2.0.0 (Current)

**New Features**:
- ✨ Complete UI redesign with premium styling
- ✨ Modular component architecture
- ✨ Glass-morphism effects
- ✨ Animated step indicator
- ✨ Enhanced drag-and-drop
- ✨ Virtual scrolling for tables
- ✨ Confetti success animation
- ✨ Timeline view for imports
- ✨ Custom searchable dropdowns
- ✨ Real-time progress tracking

**Improvements**:
- 🚀 Performance optimizations with memoization
- 🚀 Better theme integration
- 🚀 Responsive design enhancements
- 🚀 Accessibility improvements
- 🚀 Error handling refinements

**Breaking Changes**:
- None - Full backwards compatibility maintained

### Version 1.0.0 (Legacy)

- Initial Universal Importer implementation
- Basic multi-step wizard
- SAN configuration import
- Simple progress tracking

---

## Resources

### External Libraries

- **React**: https://react.dev
- **React Router**: https://reactrouter.com
- **Axios**: https://axios-http.com
- **Lucide React** (Icons): https://lucide.dev

### Related Documentation

- [Backend API Documentation](../../backend/docs/api.md)
- [Theme System Guide](../../docs/themes.md)
- [Component Library](../../docs/components.md)
- [Testing Guide](../../docs/testing.md)

### Design References

- [Material Design 3](https://m3.material.io)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)

---

## License

Copyright © 2025 Sanbox. All rights reserved.

---

## Contact

For questions or support:
- **Documentation Issues**: Create GitHub issue
- **Feature Requests**: Submit via GitHub
- **Bug Reports**: Use issue tracker

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Maintained By**: Sanbox Development Team