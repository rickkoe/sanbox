# Universal Importer - Architecture Documentation

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universal Importer                           │
│                     (Main Orchestrator)                          │
│                                                                   │
│  State Management:                                               │
│  • Wizard Navigation (4 steps)                                   │
│  • Data Source (files/text)                                      │
│  • Preview Data (parsed results)                                 │
│  • Configuration (fabric, conflicts)                             │
│  • Execution (progress, status)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Props & Callbacks
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Step 1       │     │ Step 2       │     │ Step 3       │
│ Select Type  │────▶│ Upload Data  │────▶│ Configure    │
└──────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ImportType    │     │DataUploader  │     │DataPreview   │
│Selector      │     │              │     │+             │
│              │     │              │     │ConfigPanel   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                    │
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Step 4       │
                                            │ Execute      │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ImportProgress│
                                            └──────────────┘
```

---

## Component Architecture

### Component Hierarchy Tree

```
UniversalImporter
│
├── StepIndicator
│   ├── Step Items (x4)
│   │   ├── Icon Wrapper
│   │   │   ├── Icon Background
│   │   │   ├── Icon Ring
│   │   │   ├── Icon
│   │   │   └── Check Badge
│   │   ├── Step Content
│   │   │   ├── Label
│   │   │   └── Description
│   │   └── Progress Line
│   └── Mobile Progress Bar
│
├── ImportTypeSelector
│   └── Import Cards (x3)
│       ├── Coming Soon Ribbon
│       ├── Background Effects
│       │   ├── Gradient
│       │   ├── Pattern
│       │   └── Glow
│       ├── Card Content
│       │   ├── Header
│       │   │   ├── Icon Container
│       │   │   └── Titles
│       │   ├── Features List
│       │   ├── Footer
│       │   │   ├── Stats
│       │   │   └── Action Button
│       │   └── Selection Indicator
│       └── Comparison Hint
│
├── DataUploader
│   ├── Tab Selector
│   │   ├── Upload Tab
│   │   └── Paste Tab
│   ├── File Upload Section
│   │   ├── Dropzone
│   │   │   ├── Background Pattern
│   │   │   ├── Border
│   │   │   ├── Glow Effect
│   │   │   └── Content
│   │   │       ├── Upload Icon
│   │   │       ├── Instructions
│   │   │       └── Format Chips
│   │   ├── File Preview
│   │   │   └── File Items
│   │   │       ├── Icon
│   │   │       ├── Info
│   │   │       └── Remove Button
│   │   └── Upload Tips
│   ├── Text Paste Section
│   │   ├── Header
│   │   │   ├── Title
│   │   │   └── Actions
│   │   ├── Editor Container
│   │   │   ├── Line Numbers
│   │   │   └── Text Area
│   │   └── Footer
│   │       ├── Character Count
│   │       └── Tips
│   └── Preview Button
│
├── DataPreview
│   ├── Parser Info
│   │   ├── Parser Badge
│   │   └── Warning Badge
│   ├── Stats Grid
│   │   └── Stat Cards (x3)
│   │       ├── Icon
│   │       ├── Content
│   │       └── Progress Bar
│   ├── Filter Bar
│   │   ├── Filter Toggle
│   │   └── Action Buttons
│   ├── Filter Panel
│   │   └── Search Inputs (x3)
│   └── Preview Tables
│       └── Table Sections (x3)
│           ├── Section Header
│           │   ├── Title
│           │   └── Select All Button
│           └── Table Container
│               ├── Table
│               │   ├── Thead (sticky)
│               │   └── Tbody
│               │       └── Rows
│               │           ├── Checkbox
│               │           └── Data Cells
│               └── Scrollbar
│
├── ConfigurationPanel
│   ├── Config Header
│   │   ├── Icon
│   │   └── Title
│   ├── Fabric Selection
│   │   ├── Custom Dropdown
│   │   │   ├── Trigger
│   │   │   └── Menu
│   │   │       ├── Search
│   │   │       ├── Create New Option
│   │   │       ├── Divider
│   │   │       └── Fabric Groups
│   │   │           └── Fabric Items
│   │   └── New Fabric Input
│   ├── Conflict Resolution
│   │   └── Conflict List
│   │       └── Conflict Items
│   │           ├── Header
│   │           └── Resolution Options
│   │               └── Radio Buttons (x3)
│   └── Import Options
│       └── Option Checkboxes (x3)
│
└── ImportProgress
    ├── Confetti Container
    ├── Status Card
    │   ├── Icon Wrapper
    │   │   ├── Background
    │   │   ├── Ring
    │   │   └── Icon
    │   └── Content
    │       ├── Title
    │       └── Description
    ├── Progress Section (Running)
    │   ├── Header
    │   ├── Progress Bar
    │   │   ├── Background
    │   │   ├── Fill
    │   │   └── Glow
    │   └── Details
    ├── Stats Section (Success)
    │   └── Stats Grid
    │       └── Stat Items
    ├── Error Section (Failed)
    │   ├── Header
    │   ├── Content
    │   └── Details
    ├── Action Section
    │   └── Action Buttons
    └── Timeline (Optional)
        └── Timeline Items
```

---

## Data Flow Architecture

### Step 1: Type Selection

```
User Interaction
       │
       ▼
┌──────────────────┐
│ Click Card       │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ onTypeSelect()   │
│ callback         │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ setImportType()  │
│ state update     │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Re-render with   │
│ selected state   │
└──────────────────┘
```

### Step 2: Upload Data

```
User Interaction
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────┐      ┌──────────┐     ┌──────────┐
│ Drag File│      │Click File│     │Paste Text│
└──────────┘      └──────────┘     └──────────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Store in     │
                  │ State        │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Click Preview│
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ handlePreview│
                  │ ()           │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ POST /parse- │
                  │ preview      │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ setPreviewData│
                  │ setStep(3)   │
                  └──────────────┘
```

### Step 3: Configure & Review

```
Preview Data
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────┐      ┌──────────┐     ┌──────────┐
│ Aliases  │      │  Zones   │     │ Fabrics  │
│ Table    │      │  Table   │     │  Table   │
└──────────┘      └──────────┘     └──────────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────────────────────────────────┐
│        User Selects Items                │
│    (Checkboxes, Select All buttons)      │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│     selectedAliases/Zones/Fabrics        │
│            (Sets)                         │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│      Configuration Panel                  │
│                                           │
│  ┌─────────────────────────────────┐    │
│  │  Select Fabric                   │    │
│  │  (Dropdown or Create New)        │    │
│  └─────────────────────────────────┘    │
│                                           │
│  ┌─────────────────────────────────┐    │
│  │  Resolve Conflicts               │    │
│  │  (Skip/Replace/Rename)           │    │
│  └─────────────────────────────────┘    │
│                                           │
│  ┌─────────────────────────────────┐    │
│  │  Import Options                  │    │
│  │  (Checkboxes)                    │    │
│  └─────────────────────────────────┘    │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│     Click "Start Import"                  │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│     handleImport()                        │
└──────────────────────────────────────────┘
```

### Step 4: Execute Import

```
handleImport()
       │
       ▼
┌──────────────────────────────────────────┐
│  POST /import-san-config/                │
│                                           │
│  Payload:                                 │
│  • customer_id                            │
│  • data (file/text content)               │
│  • fabric_id / fabric_name                │
│  • selected_items (aliases, zones)        │
│  • conflict_resolutions                   │
│  • project_id                             │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Response: { import_id, status }          │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  setImportId(import_id)                   │
│  setImportStatus('RUNNING')               │
│  setStep(4)                               │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  startProgressPolling(import_id)          │
│                                           │
│  setInterval(() => {                      │
│    GET /import-progress/{id}/             │
│    Update progress state                  │
│  }, 2000)                                 │
└──────────────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────┐      ┌──────────┐     ┌──────────┐
│ RUNNING  │      │COMPLETED │     │  FAILED  │
│          │      │          │     │          │
│ Show     │      │ Show     │     │ Show     │
│ Progress │      │ Success  │     │ Error    │
│ Bar      │      │ + Stats  │     │ Details  │
└──────────┘      └──────────┘     └──────────┘
```

---

## State Management Architecture

### State Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  UniversalImporter State                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Navigation State:                                       │
│  ┌────────────────────────────────────────────┐        │
│  │ step: number (1-4)                          │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Import Configuration:                                   │
│  ┌────────────────────────────────────────────┐        │
│  │ importType: 'san' | 'storage' | 'hosts'     │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Data Source:                                            │
│  ┌────────────────────────────────────────────┐        │
│  │ sourceType: 'file' | 'paste'                │        │
│  │ uploadedFiles: File[]                       │        │
│  │ pastedText: string                          │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Preview Data:                                           │
│  ┌────────────────────────────────────────────┐        │
│  │ previewData: {                              │        │
│  │   parser, counts, aliases, zones, fabrics   │        │
│  │ }                                            │        │
│  │ loading: boolean                            │        │
│  │ error: string | null                        │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Selection State:                                        │
│  ┌────────────────────────────────────────────┐        │
│  │ selectedAliases: Set<string>                │        │
│  │ selectedZones: Set<string>                  │        │
│  │ selectedFabrics: Set<string>                │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Configuration:                                          │
│  ┌────────────────────────────────────────────┐        │
│  │ fabricName: string                          │        │
│  │ selectedFabricId: string | 'new'            │        │
│  │ createNewFabric: boolean                    │        │
│  │ existingFabrics: Fabric[]                   │        │
│  │ conflicts: object                           │        │
│  │ conflictResolutions: object                 │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Execution State:                                        │
│  ┌────────────────────────────────────────────┐        │
│  │ importRunning: boolean                      │        │
│  │ importId: string | null                     │        │
│  │ importProgress: object                      │        │
│  │ importStatus: Status                        │        │
│  │ showLogsModal: boolean                      │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### State Transitions

```
Step 1 → Step 2:
  User selects import type
  canProceed() = importType !== null

Step 2 → Step 3:
  User uploads/pastes data
  Calls handlePreview()
  API: POST /parse-preview/
  Sets previewData
  canProceed() = data exists

Step 3 → Step 4:
  User configures import
  Calls handleImport()
  API: POST /import-san-config/
  Sets importId
  Starts polling
  canProceed() = fabric selected && items selected

Step 4 → Step 1:
  Import completes/fails
  User clicks "Import More"
  Calls handleReset()
  Resets all state
```

---

## API Integration Architecture

### Backend Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend                              │
│                                                          │
│  UniversalImporter                                       │
│        │                                                 │
│        │ axios.post()                                    │
│        │                                                 │
└────────┼─────────────────────────────────────────────────┘
         │
         │ HTTP/JSON
         │
┌────────▼─────────────────────────────────────────────────┐
│                    Backend API                           │
│                                                          │
│  Django REST Framework                                   │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  /api/importer/parse-preview/             │          │
│  │  ────────────────────────────────         │          │
│  │  • Parse uploaded data                    │          │
│  │  • Detect format (Cisco/Brocade)          │          │
│  │  • Extract aliases, zones, fabrics        │          │
│  │  • Check for conflicts                    │          │
│  │  • Return structured data                 │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  /api/importer/import-san-config/         │          │
│  │  ────────────────────────────────         │          │
│  │  • Create Celery task                     │          │
│  │  • Return import_id                       │          │
│  │  • Process asynchronously                 │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  /api/importer/import-progress/{id}/      │          │
│  │  ────────────────────────────────         │          │
│  │  • Get task status from Celery            │          │
│  │  • Return progress percentage             │          │
│  │  • Return current processing item         │          │
│  │  • Return statistics                      │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  /api/importer/logs/{id}/                 │          │
│  │  ────────────────────────────────         │          │
│  │  • Stream import logs                     │          │
│  │  • Filter by timestamp                    │          │
│  │  • Paginate results                       │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  /api/san/fabrics/                        │          │
│  │  ────────────────────────────────         │          │
│  │  • List existing fabrics                  │          │
│  │  • Filter by customer                     │          │
│  │  • Return vendor information              │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │
         │
┌────────▼─────────────────────────────────────────────────┐
│              Background Processing                        │
│                                                          │
│  Celery Worker + Redis                                   │
│                                                          │
│  Import Task:                                            │
│  1. Parse data                                           │
│  2. Validate items                                       │
│  3. Create/update database records                       │
│  4. Update progress                                      │
│  5. Log operations                                       │
│  6. Handle errors                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Styling Architecture

### CSS Layer System

```
┌─────────────────────────────────────────────────────────┐
│                   Layer 1: Global                        │
│                   themes.css                             │
│                                                          │
│  • CSS Custom Properties                                │
│  • Theme variables (light/dark)                          │
│  • Global animations                                     │
│  • Accessibility styles                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ @import
                          ▼
┌─────────────────────────────────────────────────────────┐
│                Layer 2: Page Level                       │
│              UniversalImporter.css                       │
│                                                          │
│  • Container layout                                      │
│  • Step content wrapper                                  │
│  • Navigation buttons                                    │
│  • Page-level animations                                │
│  • Background patterns                                   │
│  • @imports component styles                            │
└─────────────────────────────────────────────────────────┘
                          │
                          │ @import
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 3: Component Styles                   │
│          styles/[ComponentName].css                      │
│                                                          │
│  Each component has isolated styles:                     │
│  • Component-specific classes                            │
│  • Sub-element styles                                    │
│  • State modifiers                                       │
│  • Theme overrides                                       │
│  • Component animations                                  │
│  • Responsive breakpoints                               │
└─────────────────────────────────────────────────────────┘
```

### CSS Naming Convention

```
BEM (Block Element Modifier)

Block:       .step-indicator
Element:     .step-indicator__item
Modifier:    .step-indicator__item--active

State:       .step-indicator.loading
Theme:       .theme-dark .step-indicator
```

---

## Performance Architecture

### Optimization Strategies

```
┌─────────────────────────────────────────────────────────┐
│                 Component Level                          │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ React.memo()                          │              │
│  │ • Prevent unnecessary re-renders      │              │
│  │ • Compare props shallow               │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ useCallback()                         │              │
│  │ • Memoize event handlers              │              │
│  │ • Stable function references          │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ useMemo()                             │              │
│  │ • Memoize expensive calculations      │              │
│  │ • Filter/sort operations              │              │
│  └──────────────────────────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Rendering Level                         │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ Virtual Scrolling                     │              │
│  │ • Only render visible rows            │              │
│  │ • Reduce DOM nodes                    │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ Conditional Rendering                 │              │
│  │ • Only render active step             │              │
│  │ • Lazy load modals                    │              │
│  └──────────────────────────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   CSS Level                              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ CSS Transforms                        │              │
│  │ • GPU-accelerated animations          │              │
│  │ • Transform instead of position       │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │ will-change Property                  │              │
│  │ • Hint browser for animations         │              │
│  │ • Optimize rendering layers           │              │
│  └──────────────────────────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                 Input Validation                         │
│                                                          │
│  Frontend:                                               │
│  • File type validation (.txt, .csv, .log)              │
│  • File size limits (10MB)                              │
│  • Text length validation                               │
│  • WWPN format validation                               │
│                                                          │
│  Backend:                                                │
│  • Schema validation                                     │
│  • SQL injection prevention (ORM)                        │
│  • XSS sanitization                                      │
│  • CSRF protection                                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Authentication/Authorization               │
│                                                          │
│  • Customer ID validation                                │
│  • Project ID validation                                 │
│  • User permissions check                                │
│  • Session management                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Protection                         │
│                                                          │
│  • Encrypted transport (HTTPS)                           │
│  • Secure cookie handling                                │
│  • No sensitive data in client state                     │
│  • Secure file upload handling                           │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Build Process

```
Development
     │
     ▼
┌──────────────┐
│ Source Code  │
│ (.jsx, .css) │
└──────────────┘
     │
     ▼
┌──────────────┐
│ Webpack/Vite │
│ Build        │
└──────────────┘
     │
     ├─── Transpile JSX → JS
     ├─── Bundle modules
     ├─── Minify code
     ├─── Optimize assets
     └─── Generate sourcemaps
     │
     ▼
┌──────────────┐
│ Production   │
│ Bundle       │
└──────────────┘
     │
     ▼
┌──────────────┐
│ Docker       │
│ Container    │
└──────────────┘
     │
     ▼
┌──────────────┐
│ Nginx        │
│ Serve        │
└──────────────┘
```

---

## Monitoring & Logging

### Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend Logging                        │
│                                                          │
│  • Console errors (development)                          │
│  • User interactions tracking                            │
│  • Performance metrics                                   │
│  • Error boundary catches                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend Logging                         │
│                                                          │
│  • API request/response logs                             │
│  • Celery task logs                                      │
│  • Error stack traces                                    │
│  • Performance timing                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Import-Specific Logging                     │
│                                                          │
│  • Parse events                                          │
│  • Validation errors                                     │
│  • Conflict detections                                   │
│  • Database operations                                   │
│  • Progress updates                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Future Architecture Considerations

### Planned Enhancements

1. **WebSocket Integration**
   - Real-time progress updates (instead of polling)
   - Live log streaming
   - Multi-user collaboration

2. **Advanced Caching**
   - Redux/Zustand state management
   - Service Worker for offline support
   - IndexedDB for large datasets

3. **Micro-Frontend Architecture**
   - Separate bundles per import type
   - Dynamic module loading
   - Independent deployment

4. **Enhanced Analytics**
   - Import success/failure rates
   - Performance metrics dashboard
   - User behavior tracking

5. **Plugin System**
   - Custom parsers
   - Custom validators
   - Custom post-import actions

---

**Version**: 2.0.0
**Last Updated**: January 2025
**Maintained By**: Sanbox Development Team