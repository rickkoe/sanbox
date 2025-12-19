# DS8000 Volume Range Implementation

**Version:** 1.0
**Date:** 2025-12-18
**Purpose:** Technical documentation for the DS8000 Volume Range Management feature

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Data Structures](#data-structures)
6. [Key Algorithms](#key-algorithms)
7. [DSCLI Command Generation](#dscli-command-generation)
8. [Theme/Styling Patterns](#themestyling-patterns)
9. [Future Development Areas](#future-development-areas)

---

## Overview

### What This Feature Does

The DS8000 Volume Range Management feature allows users to:

1. **View volumes as ranges** - Instead of seeing 256 individual volumes, see them grouped as "1000-10FF" when they share the same characteristics
2. **Create volume ranges** - Specify a start/end hex range and have individual volume records created in the database
3. **Generate DSCLI commands** - Output `mkfbvol` or `mkckdvol` commands for provisioning volumes on actual DS8000 hardware
4. **Delete ranges** - Remove all volumes in a range at once

### DS8000 Volume Naming Structure

- **4-digit hexadecimal volume IDs**: `0000` through `FFFF`
- **First 2 digits = LSS** (Logical Subsystem) for FB volumes or **LCU** (Logical Control Unit) for CKD volumes
- **Volume types**: FB (Fixed Block) or CKD (Count Key Data)
- **Example**: Volumes `1000-100F` are all in LSS `10`

### Range Grouping Rules

Volumes are grouped into a single range when they share:
- Same storage system (DS8000)
- Same LSS/LCU (first 2 hex digits)
- Same format (FB or CKD)
- Same capacity_bytes
- Same pool_name (optional)
- **Contiguous hex sequence** (no gaps)

**Example**: If volumes `1000, 1001, 1002, 1004, 1005` exist (note: `1003` is missing), they become:
- Range 1: `1000-1002` (3 volumes)
- Range 2: `1004-1005` (2 volumes)

---

## Architecture

### File Structure

```
backend/storage/
├── volume_range_utils.py     # Core range calculation and DSCLI generation
├── views.py                  # API endpoints (appended at end of file)
├── urls.py                   # URL patterns for volume range endpoints
├── storage_utils.py          # Existing DS8000 device ID generation
└── models.py                 # Volume model (existing, unchanged)

frontend/src/
├── pages/
│   └── StorageVolumeRangesPage.js    # Main page component
├── components/modals/
│   └── CreateVolumeRangeModal.jsx    # Range creation form
├── styles/
│   └── volume-ranges.css             # All styling for this feature
└── App.js                            # Route added here
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/storage/<id>/volume-ranges/` | GET | Calculate and return volume ranges |
| `/api/storage/<id>/volume-ranges/create/` | POST | Create volumes from a range spec |
| `/api/storage/<id>/volume-ranges/delete/` | POST | Delete volumes by ID list |
| `/api/storage/<id>/volume-ranges/dscli/` | POST | Generate DSCLI commands |

### Navigation

- **Entry point**: Storage detail page (`/storage/:id`) shows "Volume Ranges" stat card for DS8000 storage types only
- **Route**: `/storage/:id/volume-ranges`
- **Conditional rendering**: The "Volume Ranges" link only appears when `storage.storage_type === 'DS8000'`

---

## Backend Implementation

### volume_range_utils.py

**Location**: `/backend/storage/volume_range_utils.py`

#### Key Functions

```python
def calculate_volume_ranges(volumes):
    """
    Groups volumes into contiguous ranges.

    Input: QuerySet of Volume objects
    Output: List of range dicts with keys:
        - range_id: unique hash for identification
        - storage_id, storage_name
        - lss: first 2 hex digits
        - start_volume, end_volume: 4-digit hex strings
        - format: 'FB' or 'CKD'
        - capacity_bytes, capacity_display
        - volume_count
        - volume_ids: list of Volume.id integers
        - pool_name
        - committed, deployed: bool flags
    """

def validate_volume_range(start_volume, end_volume):
    """
    Validates hex range inputs.

    Returns: (is_valid: bool, error_message: str, details: dict)

    Validation rules:
    - Must be 4 hex digits (0000-FFFF)
    - end >= start
    - Same LSS (first 2 digits must match)
    - Max 256 volumes per range
    """

def generate_volume_ids_for_range(start_volume, end_volume):
    """
    Returns list of 4-digit hex strings for a range.
    Example: ('1000', '1003') -> ['1000', '1001', '1002', '1003']
    """

def generate_dscli_commands(storage, ranges, command_type='create'):
    """
    Generates DSCLI commands for volume operations.

    Returns: {
        'device_id': 'IBM.2107-XXXXXXX',
        'commands': ['mkfbvol ...', ...],
        'command_count': int
    }
    """

def generate_dscli_for_new_range(storage, start_volume, end_volume, fmt, capacity_bytes, pool_name):
    """
    Generates a single DSCLI command for a new range (before DB records exist).
    Used for preview in the create modal.
    """
```

#### Helper Functions

```python
def get_lss_from_volume_id(volume_id):
    """'1000' -> '10'"""

def is_contiguous(vol_id_a, vol_id_b):
    """Check if B = A + 1 in hex"""

def generate_range_id(storage_id, lss, start_vol, end_vol, fmt, capacity):
    """Generate unique hash for range identification"""

def format_capacity_display(capacity_bytes):
    """Convert bytes to '50 GB' or '1.5 TB' format"""
```

### views.py Additions

**Location**: End of `/backend/storage/views.py` (around line 2625+)

Four new view functions:

1. **volume_ranges_list** - GET endpoint
   - Validates storage is DS8000
   - Applies Customer View filtering (committed=True OR not in project)
   - Calls `calculate_volume_ranges()`
   - Returns JSON with ranges array

2. **volume_range_create** - POST endpoint
   - Validates range inputs
   - Checks for existing volumes (conflict detection)
   - Creates individual Volume records in a loop
   - Optionally adds to project via ProjectVolume junction
   - Clears dashboard cache

3. **volume_range_delete** - POST endpoint
   - Deletes volumes by ID list
   - Removes ProjectVolume memberships first
   - Clears dashboard cache

4. **volume_range_dscli** - POST endpoint
   - Two modes:
     - `range_ids` array: Generate commands for existing ranges
     - `start_volume/end_volume`: Preview command for new range

### urls.py Additions

```python
# In backend/storage/urls.py
path("<int:storage_id>/volume-ranges/", volume_ranges_list, name="volume-ranges-list"),
path("<int:storage_id>/volume-ranges/create/", volume_range_create, name="volume-range-create"),
path("<int:storage_id>/volume-ranges/delete/", volume_range_delete, name="volume-range-delete"),
path("<int:storage_id>/volume-ranges/dscli/", volume_range_dscli, name="volume-range-dscli"),
```

---

## Frontend Implementation

### StorageVolumeRangesPage.js

**Location**: `/frontend/src/pages/StorageVolumeRangesPage.js`

#### Component Structure

```jsx
const StorageVolumeRangesPage = () => {
  // URL params
  const { id } = useParams();  // storage ID

  // State
  const [storage, setStorage] = useState(null);
  const [ranges, setRanges] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [selectedRanges, setSelectedRanges] = useState({});  // {range_id: bool}

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDscliModal, setShowDscliModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // DSCLI state
  const [dscliCommands, setDscliCommands] = useState([]);

  // ...
};
```

#### Key Features

1. **Header with device ID badge** - Shows DS8000 device ID (IBM.2107-XXXXX)
2. **Action bar** - Create Range, Generate DSCLI buttons, Select All checkbox
3. **Range cards** - Selectable cards showing range details
4. **Three modals**:
   - CreateVolumeRangeModal - Form for creating new ranges
   - DSCLI Preview Modal (inline) - Shows generated commands with copy/download
   - Delete Confirmation Modal (inline) - Confirms range deletion

### CreateVolumeRangeModal.jsx

**Location**: `/frontend/src/components/modals/CreateVolumeRangeModal.jsx`

#### Props

```jsx
<CreateVolumeRangeModal
  show={boolean}
  onClose={function}
  storageId={number}
  storageName={string}
  deviceId={string}
  onSuccess={function}  // Called after successful creation
/>
```

#### Form Fields

| Field | Type | Validation |
|-------|------|------------|
| start_volume | 4-digit hex | Required, 0000-FFFF |
| end_volume | 4-digit hex | Required, >= start, same LSS |
| format | dropdown | FB or CKD |
| capacity_gb | number | Required, > 0 |
| pool_name | text | Optional, defaults to P0 |

#### Two-Step Flow

1. **Preview** - User fills form, clicks "Preview"
   - Validates inputs
   - Calls DSCLI endpoint for command preview
   - Shows volume count, total capacity, DSCLI command
2. **Create** - User confirms, clicks "Create X Volumes"
   - Calls create endpoint
   - Refreshes range list on success

### App.js Changes

```jsx
// Lazy import
const StorageVolumeRangesPage = React.lazy(() => import("./pages/StorageVolumeRangesPage"));

// Route (around line 223)
<Route path="/storage/:id/volume-ranges" element={<StorageVolumeRangesPage />} />
```

### StoragePage.js Changes

**Location**: Around line 380

```jsx
// Import
import { Layers } from "lucide-react";

// Conditional stat card (only for DS8000)
{storage.storage_type === 'DS8000' && (
  <Link to={`/storage/${id}/volume-ranges`} className="stat-card stat-card-clickable">
    <div className="stat-icon">
      <Layers size={32} />
    </div>
    <div className="stat-content">
      <div className="stat-value">Ranges</div>
      <div className="stat-label">Volume Ranges</div>
    </div>
    <div className="stat-arrow">→</div>
  </Link>
)}
```

---

## Data Structures

### Volume Model Fields (Relevant)

```python
# backend/storage/models.py - Volume model
volume_id = CharField(max_length=16)      # "1000", "100F", etc.
lss_lcu = CharField(max_length=10)        # "10", "5A", etc.
format = CharField(max_length=10)         # "FB" or "CKD"
capacity_bytes = BigIntegerField()        # Volume size
pool_name = CharField(max_length=64)      # "P0", etc.
storage = ForeignKey(Storage)             # Parent storage system
unique_id = CharField(unique=True)        # "{storage_system_id}_{volume_id}"
committed = BooleanField(default=False)
deployed = BooleanField(default=False)
```

### Range Object (API Response)

```json
{
  "range_id": "a1b2c3d4e5f6",
  "storage_id": 1,
  "storage_name": "DS8K-01",
  "lss": "10",
  "start_volume": "1000",
  "end_volume": "100F",
  "format": "FB",
  "capacity_bytes": 53687091200,
  "capacity_display": "50 GB",
  "volume_count": 16,
  "volume_ids": [101, 102, 103, ...],
  "pool_name": "P0",
  "committed": false,
  "deployed": false
}
```

### Create Request Body

```json
{
  "start_volume": "1000",
  "end_volume": "100F",
  "format": "FB",
  "capacity_bytes": 53687091200,
  "pool_name": "P0",
  "active_project_id": 123  // optional
}
```

---

## Key Algorithms

### Range Calculation Algorithm

```python
def calculate_volume_ranges(volumes):
    # 1. Group by (storage_id, lss, format, capacity_bytes, pool_name)
    groups = defaultdict(list)
    for vol in volumes:
        lss = vol.volume_id[:2].upper()
        key = (vol.storage_id, lss, vol.format, vol.capacity_bytes, vol.pool_name)
        groups[key].append(vol)

    ranges = []
    for key, vols in groups.items():
        # 2. Sort by volume_id (hex value)
        sorted_vols = sorted(vols, key=lambda v: int(v.volume_id, 16))

        # 3. Walk through, find contiguous sequences
        current_start = sorted_vols[0]
        current_vols = [sorted_vols[0]]

        for i in range(1, len(sorted_vols)):
            prev = sorted_vols[i-1]
            curr = sorted_vols[i]

            if int(curr.volume_id, 16) == int(prev.volume_id, 16) + 1:
                # Contiguous - extend current range
                current_vols.append(curr)
            else:
                # Gap - emit current range, start new
                ranges.append(create_range_dict(current_start, current_vols, ...))
                current_start = curr
                current_vols = [curr]

        # Emit final range
        ranges.append(create_range_dict(current_start, current_vols, ...))

    return sorted(ranges, key=lambda r: (r['lss'], int(r['start_volume'], 16)))
```

### Hex Contiguity Check

```python
def is_contiguous(vol_id_a, vol_id_b):
    """Check if B = A + 1 in hex"""
    a = int(vol_id_a, 16)  # '100A' -> 4106
    b = int(vol_id_b, 16)  # '100B' -> 4107
    return b == a + 1
```

---

## DSCLI Command Generation

### DS8000 Device ID

The device ID is generated from the storage serial number:

```python
def generate_ds8000_device_id(storage):
    """
    Logic: Drop trailing '0' from serial number and add '1'
    Example: Serial "75NRC90" -> "IBM.2107-75NRC91"
    """
    if storage.serial_number:
        serial = storage.serial_number.strip()
        if serial.endswith('0'):
            return f"IBM.2107-{serial[:-1]}1"
        elif serial.endswith('1'):
            return f"IBM.2107-{serial}"
    return "NO-DEVICE-ID-DEFINED"
```

### FB Volume Command (mkfbvol)

```bash
mkfbvol -dev IBM.2107-75NRC91 -extpool P0 -cap 50 -stgtype fb -qty 16 1000
```

Parameters:
- `-dev`: Device ID
- `-extpool`: Pool name
- `-cap`: Capacity in GB
- `-stgtype fb`: Fixed Block type
- `-qty`: Number of volumes to create
- Final arg: Starting volume ID (hex)

### CKD Volume Command (mkckdvol)

```bash
mkckdvol -dev IBM.2107-75NRC91 -extpool P0 -cap 3339 -qty 8 1800
```

Parameters:
- `-cap`: Capacity in cylinders (not GB)
- Cylinder approximation: `capacity_bytes / (849 * 1024)`

### Delete Command (rmvol)

```bash
rmvol -dev IBM.2107-75NRC91 1000-100F
```

Or for single volume:
```bash
rmvol -dev IBM.2107-75NRC91 1000
```

---

## Theme/Styling Patterns

### CSS File Location

`/frontend/src/styles/volume-ranges.css`

### Key Patterns Used

1. **Theme-Aware Alerts** (following THEME_SYSTEM_DOCUMENTATION.md):
   - `.volume-range-error-alert` - Red 4px left border
   - `.volume-range-info-alert` - Blue 4px left border
   - `.volume-range-warning-alert` - Orange 4px left border
   - All use `var(--secondary-bg)` background, `var(--primary-text)` text

2. **Bootstrap Modal Overrides** (critical for dark themes):
   ```css
   .modal.theme-dark .modal-content,
   .modal.theme-dark-plus .modal-content {
     background: var(--card-bg, #161b22) !important;
     /* Triple background declaration */
   }

   .modal.theme-dark .modal-body {
     background: transparent !important;
   }
   ```

3. **Form Hints** (no gray text):
   ```css
   .volume-range-form-hint {
     color: var(--primary-text) !important;
     opacity: 0.65;  /* Use opacity, not gray color */
   }
   ```

4. **Range Cards**:
   - `.range-card` - Selectable card with checkbox
   - `.range-card.selected` - Blue border highlight
   - `.format-badge-fb` / `.format-badge-ckd` - Green/yellow badges

### No Emojis Policy

All icons use SVG (lucide-react):
- `ArrowLeft`, `Plus`, `Terminal`, `Trash2`, `Copy`, `Download`, `Check`, `Layers`

---

## Future Development Areas

### 1. FlashSystem Volume Ranges

FlashSystem uses different volume naming:
- Volume names are strings, not hex IDs
- May need different grouping logic
- Different DSCLI commands (`mkvdisk` instead of `mkfbvol`)

### 2. Host Management

Similar range-based management for hosts:
- Bulk host creation
- `mkhost` script generation (already exists in `storage_utils.py`)
- Host-to-volume mapping

### 3. Volume-to-Host Mapping

- `mkhostconnection` command generation
- Map volume ranges to host ranges
- LUN assignment

### 4. Replication

- Metro Mirror / Global Mirror setup
- `mkpprc` command generation
- Requires source/target volume pairing

### 5. Project Integration

Current implementation:
- Volumes can be added to projects on creation (`active_project_id`)
- Uses existing ProjectVolume junction table

Future:
- Range-level project operations
- Commit/deploy workflow for ranges

### 6. Import from DS8000

- Parse existing DS8000 configuration
- Import volume definitions
- Detect existing ranges

---

## Testing Notes

### Manual Testing

1. **Navigate to DS8000 storage**: `/storage/:id` where storage_type = 'DS8000'
2. **Click "Volume Ranges"** stat card
3. **Create a range**: Click "Create Range", enter hex values
4. **Verify volumes created**: Check `/storage/:id/volumes`
5. **Generate DSCLI**: Select ranges, click "Generate DSCLI"
6. **Delete range**: Click trash icon on a range

### Edge Cases

- Single volume (start = end)
- Non-contiguous volumes (should split into multiple ranges)
- Different pool names (should be separate ranges)
- Mixed FB/CKD volumes (should be separate ranges)
- Existing volumes conflict detection

### API Testing

```bash
# Get ranges
curl http://localhost:8000/api/storage/1/volume-ranges/

# Create range
curl -X POST http://localhost:8000/api/storage/1/volume-ranges/create/ \
  -H "Content-Type: application/json" \
  -d '{"start_volume":"1000","end_volume":"100F","format":"FB","capacity_bytes":53687091200,"pool_name":"P0"}'

# Generate DSCLI
curl -X POST http://localhost:8000/api/storage/1/volume-ranges/dscli/ \
  -H "Content-Type: application/json" \
  -d '{"range_ids":["abc123"],"command_type":"create"}'
```

---

## Dependencies

### Backend
- Django (existing)
- No new packages required

### Frontend
- React Bootstrap (Modal, Form, Spinner)
- lucide-react (icons)
- axios (API calls)
- No new packages required

---

## Related Files Reference

| Purpose | File Path |
|---------|-----------|
| Range calculation | `backend/storage/volume_range_utils.py` |
| API views | `backend/storage/views.py` (end of file) |
| URL patterns | `backend/storage/urls.py` |
| Device ID generation | `backend/storage/storage_utils.py` |
| Volume model | `backend/storage/models.py` |
| Main page | `frontend/src/pages/StorageVolumeRangesPage.js` |
| Create modal | `frontend/src/components/modals/CreateVolumeRangeModal.jsx` |
| Styling | `frontend/src/styles/volume-ranges.css` |
| Route | `frontend/src/App.js` (line ~223) |
| Nav link | `frontend/src/pages/StoragePage.js` (line ~380) |
| Theme docs | `THEME_SYSTEM_DOCUMENTATION.md` |

---

## Pool Model Implementation

**Added:** 2025-12-18

### Overview

Pools are storage containers that hold volumes. Previously, `Volume.pool_name` was a simple CharField. This implementation creates a proper `Pool` model with a ForeignKey relationship, enabling:

1. **Pool management** - CRUD operations on pools via TanStack table
2. **Pool-Storage relationship** - Each pool belongs to one storage system
3. **Storage type enforcement** - DS8000 pools can be FB or CKD; FlashSystem pools are always FB
4. **Project workflow** - Pools follow the same project-based editing pattern as other entities
5. **DSCLI command generation** - Generate `mkextpool` (DS8000) or `mkmdiskgrp` (FlashSystem) commands

### Architecture

#### File Structure

```
backend/storage/
├── models.py              # Pool model added (line ~191)
├── serializers.py         # PoolSerializer added (line ~226)
├── views.py               # pool_list, pool_detail, pool_project_view (end of file)
├── urls.py                # Pool URL patterns added
└── pool_utils.py          # NEW: DSCLI command generation for pools

backend/core/
├── models.py              # ProjectPool junction table added (after ProjectVolume)
├── project_views.py       # project_add_pool, project_remove_pool added
└── urls.py                # Pool project endpoints added

frontend/src/
├── components/tables/
│   └── PoolTableTanStackClean.jsx    # NEW: Pool management table
├── pages/
│   └── StoragePoolsPage.js           # NEW: Page wrapper
├── hooks/
│   └── useSidebarConfig.js           # Pools link added to storage sidebar
├── components/modals/
│   └── CreateVolumeRangeModal.jsx    # Enhanced with pool dropdown
├── config/
│   └── tableColumnConfig.json        # Pool table configuration added
└── App.js                            # Route added
```

### Backend Implementation

#### Pool Model

**Location:** `backend/storage/models.py` (line ~191)

```python
class Pool(models.Model):
    STORAGE_TYPE_CHOICES = [
        ('FB', 'Fixed Block'),
        ('CKD', 'Count Key Data'),
    ]

    name = models.CharField(max_length=16)  # DS8000 limit
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='pools')
    storage_type = models.CharField(max_length=3, choices=STORAGE_TYPE_CHOICES, default='FB')

    # Standard lifecycle fields
    committed = models.BooleanField(default=False)
    deployed = models.BooleanField(default=False)
    created_by_project = models.ForeignKey('core.Project', null=True, blank=True, ...)
    last_modified_by = models.ForeignKey(User, null=True, blank=True, ...)
    unique_id = models.CharField(max_length=64, unique=True)

    class Meta:
        unique_together = ['storage', 'name']

    @property
    def db_volumes_count(self):
        return self.volumes.count()
```

#### Volume.pool_ref ForeignKey

**Location:** `backend/storage/models.py` (line ~442)

```python
# Added to Volume model (named pool_ref to avoid conflict with existing pool_id CharField)
pool_ref = models.ForeignKey(
    'Pool',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='volumes',
    help_text="Pool this volume belongs to (FK to Pool model)"
)
# Existing pool_name and pool_id CharFields retained for backward compatibility
```

#### ProjectPool Junction Table

**Location:** `backend/core/models.py` (after ProjectVolume)

```python
class ProjectPool(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_pools')
    pool = models.ForeignKey('storage.Pool', on_delete=models.CASCADE, related_name='project_memberships')
    action = models.CharField(max_length=10, choices=PROJECT_ACTION_CHOICES, default='new')
    delete_me = models.BooleanField(default=False)
    field_overrides = models.JSONField(default=dict, blank=True)
    added_by = models.ForeignKey(User, null=True, ...)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['project', 'pool']
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/storage/pools/` | GET | List pools (Customer View filtered) |
| `/api/storage/pools/` | POST | Create pool |
| `/api/storage/pools/<id>/` | GET/PUT/PATCH/DELETE | Pool detail operations |
| `/api/storage/<storage_id>/pools/` | GET | Pools for specific storage |
| `/api/storage/project/<id>/view/pools/` | GET | Project View with field_overrides |
| `/api/storage/project/<id>/view/pools/` | POST | Save pool changes in project |
| `/api/core/projects/<id>/add-pool/` | POST | Add pool to project |
| `/api/core/projects/<id>/remove-pool/<pool_id>/` | DELETE | Remove pool from project |

#### pool_utils.py

**Location:** `backend/storage/pool_utils.py` (NEW FILE)

```python
def generate_pool_create_command(storage, pool_name, storage_type='FB', rank_group=0):
    """
    DS8000: mkextpool -dev {device_id} -rankgrp {rank_group} -stgtype {fb|ckd} {pool_name}
    FlashSystem: mkmdiskgrp -name {pool_name} -ext 1024
    """

def generate_pool_delete_command(storage, pool_name):
    """
    DS8000: rmextpool -dev {device_id} {pool_name}
    FlashSystem: rmmdiskgrp {pool_name}
    """

def generate_pool_commands_for_storage(storage, pools, command_type='create'):
    """Generate commands for multiple pools"""
```

### Frontend Implementation

#### PoolTableTanStackClean.jsx

**Location:** `frontend/src/components/tables/PoolTableTanStackClean.jsx` (NEW FILE)

Follows `VolumeTableTanStackClean.jsx` pattern:
- Props: `storageId`, `hideColumns`
- Uses hooks: `useProjectViewAPI`, `useProjectViewSelection`, `useProjectViewPermissions`
- Customer View is read-only; Project View is editable
- storage_type dropdown: Read-only for FlashSystem (auto-set to FB), editable for DS8000
- Tracks `storageSystemTypes` map to enforce FB for FlashSystem

#### StoragePoolsPage.js

**Location:** `frontend/src/pages/StoragePoolsPage.js` (NEW FILE)

```jsx
const StoragePoolsPage = () => {
  const { id } = useParams();
  // Fetches storage, updates breadcrumb, renders PoolTableTanStackClean
  return (
    <PoolTableTanStackClean
      storageId={parseInt(id)}
      hideColumns={['storage']}
    />
  );
};
```

#### Table Column Configuration

**Location:** `frontend/src/config/tableColumnConfig.json`

```json
"pool": {
  "defaultSort": { "column": "name", "direction": "asc" },
  "columns": [
    { "id": "name", "title": "Pool Name", "type": "text", "required": true, "defaultVisible": true },
    { "id": "storage", "title": "Storage System", "type": "dropdown", "dropdownSource": "storage", "required": true },
    { "id": "storage_type", "title": "Type", "type": "dropdown", "dropdownSource": "storage_type", "required": true },
    { "id": "db_volumes_count", "title": "Volumes", "type": "numeric", "readOnly": true },
    { "id": "project_memberships", "title": "Projects", "type": "custom", "readOnly": true },
    { "id": "committed", "title": "Committed", "type": "checkbox" },
    { "id": "deployed", "title": "Deployed", "type": "checkbox" }
  ]
}
```

#### Sidebar & Routing

**Sidebar:** `frontend/src/hooks/useSidebarConfig.js`
```javascript
{
  path: `/storage/${storageIdMatch[1]}/pools`,
  label: "Pools",
  icon: Database,  // from lucide-react
}
```

**Route:** `frontend/src/App.js`
```jsx
const StoragePoolsPage = React.lazy(() => import("./pages/StoragePoolsPage"));
// ...
<Route path="/storage/:id/pools" element={<StoragePoolsPage />} />
```

**Table routes pattern:** Added `location.pathname.match(/^\/storage\/\d+\/pools$/)`

#### CreateVolumeRangeModal Enhancement

**Location:** `frontend/src/components/modals/CreateVolumeRangeModal.jsx`

Enhanced with:
1. **Pool dropdown** - Fetches pools from `/api/storage/{storageId}/pools/`
2. **"+ Create New Pool" option** - Shows inline form when selected
3. **Inline pool creation form**:
   - Pool name input (max 16 chars)
   - Pool type dropdown (FB/CKD for DS8000, read-only FB for FlashSystem)
4. **New prop:** `storageType` - Passed from parent to determine FlashSystem vs DS8000

```jsx
<CreateVolumeRangeModal
  show={boolean}
  storageId={number}
  storageName={string}
  storageType={string}  // NEW: 'DS8000' or 'FlashSystem'
  deviceId={string}
  activeProjectId={number}
  onSuccess={function}
/>
```

### Database Migration

```bash
# Migrations created:
# 1. storage.0026_add_pool_model - Creates Pool table and Volume.pool_ref FK
# 2. core.0025_add_project_pool - Creates ProjectPool junction table

docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

**Note:** Existing volumes retain `pool_name` CharField. No auto-migration of data - `Volume.pool_ref` is nullable.

### Key Behaviors

1. **Customer View Filtering:** Pools shown if `committed=True` OR not in any project
2. **Project View:** Pools can only be created/edited/deleted through projects
3. **FlashSystem Enforcement:** storage_type auto-set to 'FB' on save
4. **Unique Constraint:** `(storage, name)` - No duplicate pool names per storage system
5. **Volume Count:** `db_volumes_count` property counts volumes via `pool_ref` FK

### DSCLI Commands

**DS8000 Pool Creation:**
```bash
mkextpool -dev IBM.2107-75NRC91 -rankgrp 0 -stgtype fb P0
```

**FlashSystem Pool Creation:**
```bash
mkmdiskgrp -name P0 -ext 1024
```

**DS8000 Pool Deletion:**
```bash
rmextpool -dev IBM.2107-75NRC91 P0
```

**FlashSystem Pool Deletion:**
```bash
rmmdiskgrp P0
```

### Files Reference

| Purpose | File Path |
|---------|-----------|
| Pool model | `backend/storage/models.py` (line ~191) |
| Volume.pool_ref FK | `backend/storage/models.py` (line ~442) |
| ProjectPool junction | `backend/core/models.py` (after ProjectVolume) |
| Pool serializer | `backend/storage/serializers.py` (line ~226) |
| Pool views | `backend/storage/views.py` (end of file, line ~3037+) |
| Pool URL patterns | `backend/storage/urls.py` |
| Pool DSCLI utils | `backend/storage/pool_utils.py` (NEW) |
| Project add/remove pool | `backend/core/project_views.py` (line ~1075) |
| Project pool URLs | `backend/core/urls.py` (line ~179) |
| Pool table component | `frontend/src/components/tables/PoolTableTanStackClean.jsx` (NEW) |
| Pool page | `frontend/src/pages/StoragePoolsPage.js` (NEW) |
| Column config | `frontend/src/config/tableColumnConfig.json` |
| Sidebar link | `frontend/src/hooks/useSidebarConfig.js` (line ~59) |
| Route | `frontend/src/App.js` (line ~226) |
| Volume range modal | `frontend/src/components/modals/CreateVolumeRangeModal.jsx` |

### Future Enhancements

1. **Link volumes to pools** - Update existing volumes to use `pool_ref` FK instead of `pool_name`
2. **Pool capacity tracking** - Add `capacity_bytes`, `used_capacity_bytes` fields
3. **Pool import** - Import pools from Storage Insights API
4. **Bulk pool operations** - Create multiple pools at once
5. **Pool-based volume filtering** - Filter volume table by pool
