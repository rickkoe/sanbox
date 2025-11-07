# Continuation Prompt for Table Standardization Refactor

Copy and paste this prompt into a new Claude Code conversation to continue the work:

---

## Context

I'm continuing a table standardization refactor project that's 50% complete. The goal is to eliminate ~4,000 lines of duplicated code across 8 TanStack tables by using centralized hooks and components.

### ✅ What's Already Done (100% Backend, 25% Frontend)

**Backend (Complete):**
- Created `/Users/rickk/sanbox/backend/core/constants.py` with centralized `PROJECT_ACTION_CHOICES`
- Updated all 8 junction table models to use the centralized constant
- Created and **ran** migration `0014_rename_create_action_to_new.py` (340 records updated)
- Changed action values from 'create' → 'new' throughout the codebase
- Updated `ProjectSummary.jsx` to reference 'new' instead of 'create'

**Frontend Infrastructure (Complete):**
- Created `frontend/src/utils/projectStatusRenderer.js` - Badge renderer for New/Delete/Modified/Unmodified
- Created `frontend/src/hooks/useProjectViewAPI.js` - Centralized API URL generation
- Created `frontend/src/hooks/useProjectViewPermissions.js` - Unified permission checking
- Created `frontend/src/hooks/useProjectViewSelection.js` - Selection state management (~90 lines saved per table)
- Created `frontend/src/components/tables/ProjectView/ProjectViewToolbar.jsx` - Unified toolbar (~130 lines saved per table)

**Tables Refactored (2 of 8):**
1. ✅ `AliasTableTanStackClean.jsx` - Reduced from 1,679 → 1,295 lines (384 saved)
2. ✅ `ZoneTableTanStackClean.jsx` - Reduced from 2,120 → 1,777 lines (343 saved)

### 📋 What Needs to Be Done

**Complete the remaining 6 tables using the EXACT same pattern:**

1. `FabricTableTanStackClean.jsx`
2. `StorageTableTanStackClean.jsx`
3. `VolumeTableTanStackClean.jsx`
4. `HostTableTanStackClean.jsx`
5. `PortTableTanStackClean.jsx`
6. `SwitchTableTanStack.jsx`

### 📖 Instructions Available

**COMPLETE step-by-step instructions are in:**
`/Users/rickk/sanbox/TABLE_REFACTOR_INSTRUCTIONS.md`

This document contains:
- Detailed 9-step process for each table
- Entity-specific values reference table
- Code patterns to find and replace
- Testing checklist
- Troubleshooting guide

### 🎯 Your Task

Please complete the remaining 6 tables by following the pattern in `TABLE_REFACTOR_INSTRUCTIONS.md`. For each table:

1. **Read the instructions document first** - It has everything you need
2. **Follow the 9-step pattern** exactly as used for AliasTable and ZoneTable
3. **Use the entity-specific values table** (lines 291-302) for correct configuration
4. **Test each table** after completion using the checklist (lines 331-357)

### 🔧 Key Pattern Summary

For each table, you'll:
1. Add 5 new imports (hooks + components)
2. Remove old state (selectedRows, showActionsDropdown, etc.)
3. Add 3 hooks (useProjectViewAPI, useProjectViewPermissions, useProjectViewSelection)
4. Update permission checking
5. Update API_ENDPOINTS to use apiUrl from hook
6. **Add Project Status column** (shows New/Delete/Modified/Unmodified) in Project View
7. Remove 3 old handler functions (handleSelectAllPages, handleClearSelection, handleMarkForDeletion)
8. Remove old useEffects
9. Replace toolbar (~170 lines) with `<ProjectViewToolbar />` component
10. Replace Select All Banner (~60 lines) with `<SelectAllBanner />` from hook

### 📊 Expected Results

**Per table:**
- Before: ~1,600-2,100 lines
- After: ~1,200-1,700 lines
- Saved: ~300-400 lines per table (~20-25% reduction)

**All 6 tables:**
- Total lines saved: ~1,800-2,400 lines
- Duplicate code eliminated: 60% → <10%
- Perfect consistency across all tables

### 🏁 Success Criteria

When done, all 8 tables should:
- ✅ Have Project Status column in Project View (New/Delete/Modified/Unmodified badges)
- ✅ NO "In Project" or "Add/Remove" columns
- ✅ Use ProjectViewToolbar component
- ✅ Use SelectAllBanner from hook
- ✅ Actions dropdown from hook
- ✅ Work identically (consistent UX)
- ✅ Reduced by ~300-400 lines each

### 📁 File Locations

**Tables to update:**
- `/Users/rickk/sanbox/frontend/src/components/tables/FabricTableTanStackClean.jsx`
- `/Users/rickk/sanbox/frontend/src/components/tables/StorageTableTanStackClean.jsx`
- `/Users/rickk/sanbox/frontend/src/components/tables/VolumeTableTanStackClean.jsx`
- `/Users/rickk/sanbox/frontend/src/components/tables/HostTableTanStackClean.jsx`
- `/Users/rickk/sanbox/frontend/src/components/tables/PortTableTanStackClean.jsx`
- `/Users/rickk/sanbox/frontend/src/components/tables/SwitchTableTanStack.jsx`

**Reference implementations:**
- `/Users/rickk/sanbox/frontend/src/components/tables/AliasTableTanStackClean.jsx` (completed)
- `/Users/rickk/sanbox/frontend/src/components/tables/ZoneTableTanStackClean.jsx` (completed)

**Infrastructure files (already complete, don't modify):**
- `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewAPI.js`
- `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewPermissions.js`
- `/Users/rickk/sanbox/frontend/src/hooks/useProjectViewSelection.js`
- `/Users/rickk/sanbox/frontend/src/components/tables/ProjectView/ProjectViewToolbar.jsx`
- `/Users/rickk/sanbox/frontend/src/utils/projectStatusRenderer.js`

### 🚀 Getting Started

1. **First**, read `/Users/rickk/sanbox/TABLE_REFACTOR_INSTRUCTIONS.md` in full
2. **Then**, start with FabricTable (simplest, good warm-up)
3. **Follow** the 9-step checklist for each table
4. **Test** each table after completion

Please proceed with updating all 6 remaining tables. Let me know if you have any questions about the pattern or encounter any issues.

---

**Note:** The backend migration has already been run successfully, so you only need to focus on the frontend table refactoring.
