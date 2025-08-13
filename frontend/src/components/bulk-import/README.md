# Bulk Import Components Refactoring

This directory contains the refactored components from the original `BulkZoningImportPage.js`, which was broken down from a single 2,738-line file into multiple focused, maintainable components.

## Overview

The bulk import functionality allows users to import SAN aliases and zones from various file formats including:
- Cisco tech-support output files
- Device-alias configuration files  
- FC-alias configuration files
- Zone configuration files
- Raw text input

## Architecture

### Before Refactoring
- **Single file**: `BulkZoningImportPage.js` (2,738 lines)
- All logic, UI, parsing, and API calls in one component
- Difficult to maintain, test, and understand

### After Refactoring
- **Main file**: `BulkZoningImportPage.js` (443 lines - 84% reduction)
- **17 focused modules** across components, utilities, and services
- Clear separation of concerns
- Improved maintainability and testability

## Component Structure

### UI Components (`/components/bulk-import/`)

#### Core Components

**`ImportHeader.js`**
- Displays page title and description
- Handles fabric selection dropdown
- Shows loading states
- **Props**: `selectedFabric`, `setSelectedFabric`, `fabricOptions`, `loading`

**`ImportDefaults.js`**
- Manages alias and zone import default settings
- Handles preference saving with status indicators
- **Props**: `aliasDefaults`, `setAliasDefaults`, `zoneDefaults`, `setZoneDefaults`, `preferencesStatus`, `zonePreferencesStatus`, `handleSavePreferences`, `handleSaveZonePreferences`

**`ImportTabs.js`**
- Container for file upload and text paste tabs
- Manages active tab state
- **Props**: `activeTab`, `setActiveTab`, plus props for child components

#### Input Components

**`FileUploadZone.js`**
- Drag and drop file upload interface
- Visual feedback for drag states
- File selection button
- **Props**: `dragActive`, `selectedFabric`, `handleDrag`, `handleDrop`, `handleFileSelect`

**`TextPasteTab.js`**
- Text area for pasting configuration data
- Process and clear buttons
- Loading states
- **Props**: `textInput`, `setTextInput`, `selectedFabric`, `loading`, `handleTextPaste`

#### Display Components

**`UploadedFilesList.js`**
- Shows uploaded files with metadata
- File type detection badges
- Item count summaries
- **Props**: `uploadedFiles`, `parsedData`

**`PreviewSection.js`**
- Expandable preview tables for aliases and zones
- Selection checkboxes for individual items
- Smart detection summaries
- Unresolved member warnings
- **Props**: `showPreviewSection`, `parsedData`, `showPreview`, `setShowPreview`, selection handlers, `getImportStats`

**`ImportActions.js`**
- Import action buttons (Import Selected, Import All, Zones Only)
- Import statistics summary
- Duplicate warnings
- **Props**: `showPreviewSection`, `parsedData`, `getImportStats`, `importing`, selection sets, import handlers

**`ImportOverlay.js`**
- Full-screen loading overlays
- Animated indicators for parsing and importing
- **Props**: `parsing`, `importing`

### Utility Files (`/utils/`)

**`wwpnDetection.js`**
```javascript
export const detectWwpnType = async (wwpn) => { ... }
```
- Smart WWPN type detection via API
- Handles detection failures gracefully

**`dataProcessing.js`**
```javascript
export const detectDataTypes = (items) => { ... }
export const getImportStats = (parsedData) => { ... }
export const deduplicateItems = (items) => { ... }
```
- Data type detection utilities
- Import statistics calculation
- Item deduplication logic

**`techSupportParser.js`**
```javascript
export const parseTechSupportFile = (text) => { ... }
export const processTechSupportSection = (...) => { ... }
export const detectDataType = (text) => { ... }
```
- Complex parsing logic for Cisco tech-support files
- Section-by-section processing
- Data type auto-detection

**`aliasParser.js`**
```javascript
export const parseAliasData = async (text, fabricId, defaults) => { ... }
```
- Device-alias and FC-alias parsing
- Smart detection integration
- Format normalization

**`zoneParser.js`**
```javascript
export const parseZoneData = async (text, fabricId, defaults, batchAliases) => { ... }
```
- Zone configuration parsing
- Member resolution against existing aliases
- Unresolved member tracking

**`useBulkImport.js`**
```javascript
export const useBulkImport = (selectedFabric, aliasDefaults, zoneDefaults) => { ... }
```
- Custom React hook for bulk import state management
- File processing orchestration
- State updates and side effects

### Service Files (`/services/`)

**`bulkImportApi.js`**
```javascript
export const enhanceWithExistenceCheck = async (items) => { ... }
export const refreshAliasOptions = async (fabricId, ...) => { ... }
```
- API calls for checking item existence
- Alias options refreshing with retry logic
- Error handling and logging

## Data Flow

### 1. File Upload/Text Input
```
User Input → FileUploadZone/TextPasteTab → processFiles() → useBulkImport
```

### 2. Data Processing Pipeline
```
Raw Text → detectDataType() → Parser (alias/zone/tech-support) → deduplicateItems() → enhanceWithExistenceCheck() → Preview
```

### 3. Import Process
```
Selected Items → Import Handlers → API Calls → Status Updates → Results Display
```

## Usage Examples

### Basic Component Usage
```javascript
import {
  ImportHeader,
  ImportDefaults,
  ImportTabs,
  PreviewSection,
  ImportActions
} from '../components/bulk-import';

// In your component
<ImportHeader
  selectedFabric={selectedFabric}
  setSelectedFabric={setSelectedFabric}
  fabricOptions={fabricOptions}
  loading={loading}
/>
```

### Using the Custom Hook
```javascript
import { useBulkImport } from '../utils/useBulkImport';

const {
  uploadedFiles,
  parsedData,
  loading,
  parsing,
  importing,
  processFiles
} = useBulkImport(selectedFabric, aliasDefaults, zoneDefaults);
```

### Using Utility Functions
```javascript
import { getImportStats, detectDataTypes } from '../utils/dataProcessing';
import { parseAliasData } from '../utils/aliasParser';

const stats = getImportStats(parsedData);
const aliases = await parseAliasData(textContent, fabricId, defaults);
```

## File Support

### Supported Formats

**Tech-Support Files**
- Full Cisco `show tech-support` output
- Extracts: device-aliases, zones, FLOGI database
- Auto-detects sections and VSANs

**Device-Alias Files**
```
device-alias name HOST_01 pwwn 10:00:00:00:c9:7b:5c:01
device-alias name HOST_02 pwwn 10:00:00:00:c9:7b:5c:02
```

**FC-Alias Files**
```
fcalias name STORAGE_ARRAY vsan 1
  member pwwn 20:00:00:25:b5:00:00:0f
  member pwwn 20:00:00:25:b5:00:00:10
```

**Zone Files**
```
zone name ZONE_HOST_01_to_STORAGE vsan 1
  device-alias HOST_01
  fcalias STORAGE_ARRAY
```

### Smart Detection Features

- **WWPN Type Detection**: Automatically detects initiator vs target based on WWPN prefixes
- **File Type Detection**: Auto-identifies file format from content patterns
- **Existence Checking**: Validates against existing database entries
- **Member Resolution**: Resolves zone members against available aliases

## Configuration

### Import Defaults

**Alias Defaults**
```javascript
{
  create: true,              // Create new aliases
  includeInZoning: false,    // Include in zones
  use: "init",              // Type: "init", "target", or "smart"
  aliasType: "original",     // Preserve source type
  conflictResolution: "device-alias" // Preference for conflicts
}
```

**Zone Defaults**
```javascript
{
  create: true,     // Create new zones
  exists: false,    // Existence flag
  zoneType: "standard" // Zone type
}
```

## Testing

### Component Testing
Each component can be tested independently:

```javascript
import { render, screen } from '@testing-library/react';
import ImportHeader from './ImportHeader';

test('renders fabric selection', () => {
  render(<ImportHeader fabricOptions={[]} selectedFabric="" />);
  expect(screen.getByText('Select Fabric')).toBeInTheDocument();
});
```

### Utility Testing
```javascript
import { getImportStats } from '../utils/dataProcessing';

test('calculates import stats correctly', () => {
  const mockData = [
    { wwpn: '10:00:00:00:c9:7b:5c:01', existsInDatabase: false },
    { wwpn: '10:00:00:00:c9:7b:5c:02', existsInDatabase: true }
  ];
  const stats = getImportStats(mockData);
  expect(stats.newAliases).toBe(1);
  expect(stats.duplicateAliases).toBe(1);
});
```

## Performance Considerations

### Large File Handling
- **Streaming processing**: Large files processed in chunks
- **Background parsing**: Non-blocking UI during processing
- **Progress indicators**: Visual feedback for long operations
- **Memory management**: Efficient data structures for large datasets

### API Optimization
- **Batch existence checks**: Multiple items checked in single API call
- **Retry logic**: Automatic retry for failed operations
- **Caching**: Alias options cached to reduce API calls
- **Debounced updates**: State updates batched for performance

## Error Handling

### File Processing Errors
- Invalid file formats
- Malformed data
- Network failures during smart detection
- Large file timeouts

### Import Errors
- Duplicate entries
- Missing dependencies
- API failures
- Validation errors

### User Experience
- Clear error messages
- Recovery suggestions  
- Retry mechanisms
- Progress preservation

## Migration Guide

### From Legacy Component
If you're migrating from the old monolithic component:

1. **Replace imports**:
```javascript
// Old
import BulkZoningImportPage from './pages/BulkZoningImportPage';

// New - same import works, but now uses refactored code
import BulkZoningImportPage from './pages/BulkZoningImportPage';
```

2. **No breaking changes**: The main component interface remains the same
3. **New utilities available**: You can now import and use individual utilities
4. **Component reusability**: Individual UI components can be reused elsewhere

### Extending Functionality

**Adding New File Formats**:
1. Add detection logic to `detectDataType()`
2. Create new parser in `/utils/`
3. Update `processFiles()` in `useBulkImport`

**Adding New UI Features**:
1. Create new component in `/components/bulk-import/`
2. Add to `index.js` exports
3. Import and use in main page

## Future Improvements

### Planned Enhancements
- **Drag & drop for individual zones/aliases**
- **Bulk editing of import settings**
- **Import templates and presets**
- **Advanced filtering and search**
- **Export functionality for processed data**

### Technical Debt
- **Import handlers**: Complex import logic could be further extracted
- **API error handling**: More granular error handling for different failure modes
- **Performance**: Additional optimizations for very large files
- **Testing**: Increase test coverage for edge cases

## Contributing

When adding new functionality:

1. **Follow the established patterns** - Keep components focused and single-purpose
2. **Add proper TypeScript types** - Ensure type safety
3. **Write tests** - Both unit and integration tests
4. **Update documentation** - Keep this README current
5. **Consider performance** - Large file processing should remain responsive

## Dependencies

### Required Packages
- `react` - Core React functionality
- `react-bootstrap` - UI components
- `axios` - API calls

### Optional Enhancements
- `@testing-library/react` - Component testing
- `@types/react` - TypeScript support

---

**Total Refactoring Impact:**
- **Lines of code reduced**: 2,738 → 443 (84% reduction)
- **Maintainability**: Dramatically improved
- **Testability**: Each component independently testable
- **Reusability**: Components available for other features
- **Performance**: Optimized data processing and API calls