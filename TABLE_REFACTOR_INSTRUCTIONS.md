# Table Standardization Refactor - Continuation Instructions

## Status: ~50% Complete (1 of 8 tables done)

### ✅ Completed Work

#### Backend (100% Complete)
1. **Created**: `/Users/rickk/sanbox/backend/core/constants.py`
   - Centralized `PROJECT_ACTION_CHOICES` constant
   - Changed 'create' → 'new' action

2. **Updated**: `/Users/rickk/sanbox/backend/core/models.py`
   - All 8 junction tables now use `PROJECT_ACTION_CHOICES` from constants
   - Removed 8 duplicate ACTION_CHOICES definitions

3. **Created**: `/Users/rickk/sanbox/backend/core/migrations/0014_rename_create_action_to_new.py`
   - Data migration to update existing records from 'create' → 'new'
   - **NOT YET RUN** - needs `python manage.py migrate`

4. **Updated**: `/Users/rickk/sanbox/frontend/src/pages/ProjectSummary.jsx`
   - Changed 3 references from 'create' → 'new'
   - Lines 121, 168, 362

#### Frontend Infrastructure (100% Complete)
1. **Created**: `/Users/rickk/sanbox/frontend/src/utils/projectStatusRenderer.js`
   - `getProjectStatusBadge()` function
   - `projectStatusColumn` definition
   - Renders: New/Delete/Modified/Unmodified

2. **Created**: `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewAPI.js`
   - Centralizes API URL generation
   - Auto-switches from Project View → Customer View
   - Saves ~40 lines per table

3. **Created**: `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewPermissions.js`
   - Unified permission checking
   - Returns: canEdit, canDelete, isViewer, etc.

4. **Created**: `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewSelection.js`
   - Selection state management
   - Bulk action handlers
   - Returns SelectAllBanner and ActionsDropdown components
   - Saves ~90 lines per table

5. **Created**: `/Users/rickk/sanbox/frontend/src/components/tables/ProjectView/ProjectViewToolbar.jsx`
   - Unified toolbar component
   - Saves ~130 lines per table

#### Frontend Tables (12.5% Complete - 1 of 8)
1. **✅ COMPLETE**: `/Users/rickk/sanbox/frontend/src/components/tables/AliasTableTanStackClean.jsx`
   - Reduced from 1,679 → 1,295 lines (384 lines saved)
   - Added Project Status column
   - Using all new hooks and components

---

## ⏳ Remaining Work: 7 Tables

### Tables to Update (in order of priority):
1. `ZoneTableTanStackClean.jsx` (similar to Alias)
2. `FabricTableTanStackClean.jsx`
3. `VolumeTableTanStackClean.jsx`
4. `StorageTableTanStackClean.jsx`
5. `HostTableTanStackClean.jsx`
6. `PortTableTanStackClean.jsx`
7. `SwitchTableTanStack.jsx`

---

## 📋 Step-by-Step Instructions for Each Table

### Pattern Overview
Each table update follows this exact pattern (using ZoneTable as example):

### Step 1: Add Imports
At the top of the file, ADD these 5 new imports:

```javascript
// ADD after existing imports
import { useProjectViewSelection } from "../../hooks/useProjectViewSelection";
import { useProjectViewAPI } from "../../hooks/useProjectViewAPI";
import { useProjectViewPermissions } from "../../hooks/useProjectViewPermissions";
import ProjectViewToolbar from "./ProjectView/ProjectViewToolbar";
import { projectStatusColumn } from "../../utils/projectStatusRenderer";
```

### Step 2: Remove Old State and Add Hooks
**FIND and REMOVE** these state declarations (around line 25-45):
```javascript
const [selectedRows, setSelectedRows] = useState(new Set());
const [showActionsDropdown, setShowActionsDropdown] = useState(false);
const [showSelectAllBanner, setShowSelectAllBanner] = useState(false);
const selectedRowsRef = useRef(new Set());
// And the useEffect that syncs selectedRowsRef
```

**ADD after `activeCustomerId` declaration**:
```javascript
// Use centralized API hook
const { apiUrl } = useProjectViewAPI({
    projectFilter,
    setProjectFilter,
    activeProjectId,
    activeCustomerId,
    entityType: 'zones', // CHANGE per table: aliases, zones, fabrics, etc.
    baseUrl: `${API_URL}/api/san`, // or api/storage for storage tables
    localStorageKey: 'zoneTableProjectFilter' // CHANGE per table
});

// Use centralized permissions hook
const { canEdit, canDelete, isViewer, isProjectOwner, isAdmin, readOnlyMessage } = useProjectViewPermissions({
    role: config?.active_project?.user_role,
    projectFilter,
    entityName: 'zones' // CHANGE per table
});

// Use centralized selection hook
const {
    selectedRows,
    selectedRowsRef,
    handleSelectAllPages,
    handleClearSelection,
    handleMarkForDeletion,
    SelectAllBanner,
    ActionsDropdown
} = useProjectViewSelection({
    tableRef,
    projectFilter,
    activeProjectId,
    apiUrl,
    entityType: 'zone', // CHANGE per table (singular): alias, zone, fabric, etc.
    API_URL,
    totalRowCount
});
```

### Step 3: Update Permission Checking
**FIND and REPLACE** old permission code (around line 200):
```javascript
// OLD - REMOVE:
const isViewer = userRole === 'viewer';
const isProjectOwner = user && projectOwner && user.id === projectOwner;
const isAdmin = userRole === 'admin';
const canModifyProject = !isViewer && (isProjectOwner || isAdmin);
const canEditInfrastructure = canModifyProject;
const isReadOnly = !canModifyProject || projectFilter === 'all';

// NEW - REPLACE WITH:
const userRole = getUserRole(activeCustomerId);
const canEditInfrastructure = projectFilter === 'current' ? canEdit : true;
const isReadOnly = projectFilter === 'current' ? !canEdit : false;
```

### Step 4: Update API Endpoints
**FIND and REPLACE** the API_ENDPOINTS useMemo (around line 205-230):

```javascript
// OLD - REMOVE long if/else chain

// NEW - REPLACE WITH:
const API_ENDPOINTS = useMemo(() => {
    const baseUrl = `${API_URL}/api/san`; // or api/storage

    return {
        zones: apiUrl, // CHANGE key per table: aliases, zones, fabrics, etc.
        // ... keep other endpoints (fabrics, hosts, save, delete)
    };
}, [API_URL, apiUrl]);
```

### Step 5: Add Project Status Column
**FIND** the baseColumns useMemo (around line 220), **ADD** after the _selected column:

```javascript
const baseColumns = useMemo(() => {
    const allColumns = [];

    // Add selection checkbox column only in Project View
    if (projectFilter === 'current') {
        allColumns.push({
            data: "_selected",
            title: "Select",
            type: "checkbox",
            readOnly: false,
            width: 60,
            defaultVisible: true,
            accessorKey: "_selected"
        });

        // ADD THIS - Project Status column
        allColumns.push(projectStatusColumn);
    }

    // ... rest of columns
}, [projectFilter]);
```

### Step 6: Remove Old Handler Functions
**FIND and DELETE** these three functions (~85 lines total):
1. `const handleSelectAllPages = useCallback(async () => { ... }, [...]);`
2. `const handleClearSelection = useCallback(() => { ... }, []);`
3. `const handleMarkForDeletion = useCallback(async () => { ... }, [...]);`

**FIND and DELETE** old useEffects:
1. Auto-switch useEffect (`if (!activeProjectId && projectFilter === 'current')`)
2. Force _selected visibility useEffect
3. Sync selectedRows useEffect (~50 lines with setInterval)
4. Close actions dropdown useEffect

**REPLACE all deleted code with single comment**:
```javascript
// Selection state and actions dropdown are now managed by useProjectViewSelection hook
// Auto-switch and force visibility are now handled by hooks
```

### Step 7: Replace Toolbar
**FIND** the filterToggleButtons definition (~170 lines of JSX), **REPLACE WITH**:

```javascript
// Use ProjectViewToolbar component (replaces ~170 lines of duplicated code)
const filterToggleButtons = (
    <ProjectViewToolbar
        projectFilter={projectFilter}
        onFilterChange={handleFilterChange}
        activeProjectId={activeProjectId}
        onBulkClick={() => setShowBulkModal(true)}
        ActionsDropdown={ActionsDropdown}
        entityName="zones" // CHANGE per table
    />
);
```

### Step 8: Replace Select All Banner
**FIND** the Select All Banner JSX (~ 58 lines), **REPLACE WITH**:

```javascript
{/* Select All Banner from hook */}
<SelectAllBanner />
```

### Step 9: Verify totalCheckboxSelected Prop
**FIND** the TanStackCRUDTable component, **ENSURE** these props exist:
```javascript
<TanStackCRUDTable
    // ... other props
    totalCheckboxSelected={selectedRows.size}
    onClearAllCheckboxes={handleClearSelection}
/>
```

---

## 🔧 Entity-Specific Values Reference

For each table, use these values:

| Table | entityType (hook) | entityType (selection) | entityName | localStorageKey | baseUrl |
|-------|------------------|----------------------|------------|-----------------|---------|
| AliasTable | 'aliases' | 'alias' | 'aliases' | 'aliasTableProjectFilter' | `/api/san` |
| ZoneTable | 'zones' | 'zone' | 'zones' | 'zoneTableProjectFilter' | `/api/san` |
| FabricTable | 'fabrics' | 'fabric' | 'fabrics' | 'fabricTableProjectFilter' | `/api/san` |
| SwitchTable | 'switches' | 'switch' | 'switches' | 'switchTableProjectFilter' | `/api/san` |
| VolumeTable | 'volumes' | 'volume' | 'volumes' | 'volumeTableProjectFilter' | `/api/storage` |
| StorageTable | 'storage' | 'storage' | 'storage systems' | 'storageTableProjectFilter' | `/api/storage` |
| HostTable | 'hosts' | 'host' | 'hosts' | 'hostTableProjectFilter' | `/api/storage` |
| PortTable | 'ports' | 'port' | 'ports' | 'portTableProjectFilter' | `/api/storage` |

---

## ✅ Testing Each Table

After updating each table:

1. **Check for errors**: `npm run build` (in frontend container)
2. **Visual check**:
   - Open table in browser
   - Customer View: Should show all data
   - Project View: Should show Project Status column
   - Actions dropdown should appear
   - Select rows → check Actions count
   - Bulk modal should open

3. **Test selection**:
   - Select some rows
   - "Select All Pages" banner should appear
   - Click "Select all X items"
   - Actions dropdown → Mark for Deletion
   - Should update status to "Delete"

---

## 🏃 Run Migrations

**AFTER** all tables are updated, run backend migrations:

```bash
cd /Users/rickk/sanbox
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

Expected output:
```
Running migrations:
  Applying core.0014_rename_create_action_to_new... OK
```

---

## 📊 Expected Results

### Per Table:
- **Before**: ~1,600-2,100 lines
- **After**: ~1,200-1,700 lines
- **Saved**: ~300-400 lines per table (~20-25% reduction)

### Total Project:
- **Lines removed**: ~2,400 lines across 8 tables
- **New infrastructure**: ~800 lines (hooks + components)
- **Net reduction**: ~1,600 lines
- **Duplicate code eliminated**: ~60% → <10%

---

## 🐛 Troubleshooting

### Common Issues:

1. **"Cannot redeclare variable"**
   - Forgot to remove old state declarations
   - Check lines 25-50 for duplicate const declarations

2. **"Cannot read property of undefined"**
   - Check entityType values match table (singular vs plural)
   - Verify baseUrl is correct (`/api/san` vs `/api/storage`)

3. **Actions dropdown doesn't appear**
   - Ensure `ActionsDropdown` is passed to ProjectViewToolbar
   - Check projectFilter === 'current'

4. **Selection not working**
   - Verify `totalCheckboxSelected` and `onClearAllCheckboxes` props
   - Check preprocessData uses `selectedRowsRef.current`

5. **Project Status column missing**
   - Ensure `projectStatusColumn` is added INSIDE `if (projectFilter === 'current')` block
   - Check import is present

---

## 📝 Checklist Per Table

- [ ] Add 5 new imports
- [ ] Remove old state (selectedRows, showActionsDropdown, etc.)
- [ ] Add 3 hooks (API, Permissions, Selection)
- [ ] Update permission checking
- [ ] Update API_ENDPOINTS
- [ ] Add Project Status column
- [ ] Remove 3 handler functions
- [ ] Remove 4 useEffects
- [ ] Replace filterToggleButtons with ProjectViewToolbar
- [ ] Replace Select All Banner with component
- [ ] Verify TanStackCRUDTable props
- [ ] Test in browser
- [ ] Check no console errors

---

## 🎯 Priority Order

1. **ZoneTable** - Similar to Alias, high usage
2. **FabricTable** - Simpler, good next step
3. **StorageTable** - Different baseUrl pattern
4. **VolumeTable** - Validate storage pattern works
5. **HostTable** - Similar to Volume
6. **PortTable** - Similar to Volume
7. **SwitchTable** - Different file name pattern

---

## 💾 Backup Strategy

Before starting each table:
```bash
cp frontend/src/components/tables/ZoneTableTanStackClean.jsx \
   frontend/src/components/tables/ZoneTableTanStackClean.jsx.backup
```

---

## 🎉 Completion Criteria

All 8 tables should:
- ✅ Have Project Status column in Project View
- ✅ NO "In Project" or "Add/Remove" columns
- ✅ Use ProjectViewToolbar component
- ✅ Use SelectAllBanner from hook
- ✅ Actions dropdown from hook
- ✅ Reduced by ~300-400 lines each
- ✅ Work identically (consistent UX)

Backend:
- ✅ Migration successfully applied
- ✅ All 'create' records → 'new' in database

---

**Last Updated**: Current session
**Files Changed So Far**: 14 files (1 table complete, 7 remain)
**Estimated Time Remaining**: 2-3 hours for remaining 7 tables
