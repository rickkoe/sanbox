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
