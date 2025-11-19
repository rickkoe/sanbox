# Bulk Add/Remove Functionality - Code Diffs & Examples

## Problem Summary

7 out of 8 tables have issues in their bulk add/remove implementation. Only ZoneTable is correct and should be the reference.

---

## CRITICAL ISSUES WITH CODE EXAMPLES

### Issue 1: Pagination (ALL TABLES EXCEPT ZONE)

#### WRONG (Current - used by Alias, Fabric, Storage, Volume, Host, Port, Switch)
```javascript
useEffect(() => {
    const loadAllCustomerItems = async () => {
        if (showBulkModal && activeCustomerId && activeProjectId) {
            try {
                // ❌ SINGLE REQUEST - Will fail if >1000 items exist
                const response = await api.get(
                    `${API_URL}/api/storage/volumes/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`
                );
                if (response.data && response.data.results) {
                    setAllCustomerVolumes(response.data.results);
                }
            } catch (error) {
                console.error('Error loading customer volumes:', error);
                // ❌ Missing: setAllCustomerVolumes([])
            }
        }
    };
    loadAllCustomerItems();
}, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);
```

#### RIGHT (Zone - implements pagination correctly)
```javascript
useEffect(() => {
    const loadAllCustomerZones = async () => {
        if (showBulkModal && activeCustomerId && activeProjectId) {
            try {
                // ✓ PAGINATION LOOP - Handles any number of items
                let allZones = [];
                let page = 1;
                let hasMore = true;
                const pageSize = 500;
                
                while (hasMore) {
                    const response = await api.get(
                        `${API_URL}/api/san/zones/project/${activeProjectId}/?project_filter=all&page_size=${pageSize}&page=${page}`
                    );
                    const zones = response.data.results || response.data;
                    allZones = [...allZones, ...zones];
                    
                    hasMore = response.data.has_next;  // ✓ Check for more pages
                    page++;
                }
                
                setAllCustomerZones(allZones);
                console.log(`✅ Loaded ${allZones.length} customer zones for modal`);
            } catch (error) {
                console.error('❌ Error loading customer zones:', error);
                setAllCustomerZones([]);  // ✓ Reset on error
            }
        }
    };

    loadAllCustomerZones();
}, [showBulkModal, activeCustomerId, activeProjectId, API_URL]);
```

**Impact:** 
- Without pagination: System crashes when customer has >1000 items
- With pagination: Gracefully handles any number of items

**Fix:** Copy the pagination logic from Zone to all other tables

---

### Issue 2: Modal Parameter (ALIAS & FABRIC ONLY)

#### WRONG (Alias & Fabric)
```javascript
<BulkProjectMembershipModal
    show={showBulkModal}
    onHide={() => setShowBulkModal(false)}  // ❌ WRONG PARAMETER
    onSave={handleBulkAliasSave}
    items={allCustomerAliases}
    itemType="alias"
    projectName={config?.active_project?.name || ''}
/>
```

#### RIGHT (Zone and most others)
```javascript
<BulkProjectMembershipModal
    show={showBulkModal}
    onClose={() => setShowBulkModal(false)}  // ✓ CORRECT PARAMETER
    onSave={handleBulkAliasSave}
    items={allCustomerAliases}
    itemType="alias"
    projectName={config?.active_project?.name || ''}
/>
```

**Why:** The component accepts BOTH for backward compatibility, but Zone uses `onClose` consistently. See BulkProjectMembershipModal.jsx line 23:
```javascript
const handleModalClose = onHide || onClose;  // Supports both but should standardize
```

**Fix:** Change `onHide` to `onClose` in:
- AliasTableTanStackClean.jsx line 1245
- FabricTableTanStackClean.jsx line 520

---

### Issue 3: Error Handling & User Feedback

#### WRONG - No feedback (Volume, Host, Port)
```javascript
const handleBulkVolumeSave = useCallback(async (selectedIds) => {
    try {
        if (!allCustomerVolumes || allCustomerVolumes.length === 0) return;  // ❌ Silent return
        
        // ... add/remove logic ...
        
        setShowBulkModal(false);  // ❌ Close modal silently, no feedback
    } catch (error) {
        console.error('Error in bulk volume save:', error);
        // ❌ NO ALERT - User doesn't know if it failed
    }
}, [allCustomerVolumes, activeProjectId, API_URL, handleAddVolumeToProject]);
```

#### WRONG - Closes before showing result (Storage)
```javascript
// ... add/remove logic ...

console.log(`✅ Bulk operation complete: ${successCount} successful, ${errorCount} errors`);

// Reload table data
if (tableRef.current && tableRef.current.reloadData) {
    tableRef.current.reloadData();
}

// Close modal BEFORE showing result
setShowBulkModal(false);  // ❌ Closes first

// Show summary - But modal already closed!
if (errorCount > 0) {
    alert(`Bulk operation completed with errors:\n${successCount} successful\n${errorCount} failed`);
}
```

#### RIGHT - Zone provides complete feedback
```javascript
const handleBulkZoneSave = useCallback(async (selectedIds) => {
    try {
        // ... add/remove logic ...
        
        let successCount = 0;
        let errorCount = 0;
        
        // ... process additions and removals ...
        
        // Show results
        if (errorCount > 0) {
            alert(`Completed with errors: ${successCount} successful, ${errorCount} failed`);
        } else if (successCount > 0) {
            alert(`Successfully updated ${successCount} zones`);
        }
        
        // Reload table to get fresh data
        if (tableRef.current?.reloadData) {
            tableRef.current.reloadData();
        }
        
        console.log('✅ Bulk operation completed:', { successCount, errorCount });
    } catch (error) {
        console.error('❌ Bulk zone save error:', error);
        alert(`Error during bulk operation: ${error.message}`);
    }
}, [activeProjectId, API_URL, handleAddZoneToProject, allCustomerZones]);
```

**Alternatively - Switch (also good)**
```javascript
// Show results
if (errorCount > 0) {
    alert(`Completed with ${errorCount} error(s). ${successCount} switch(es) updated successfully.`);
} else if (successCount > 0) {
    alert(`Successfully updated ${successCount} switch(es).`);
}

// Reload table data
if (tableRef.current && tableRef.current.reloadData) {
    tableRef.current.reloadData();
}

setShowBulkModal(false);  // ✓ Close AFTER showing alert
```

**Fix:** Add to Volume, Host, Port:
```javascript
// Show results to user BEFORE closing
let successCount = 0;
let errorCount = 0;

// ... process adds/removes, track counts ...

if (errorCount > 0) {
    alert(`Completed with ${errorCount} error(s). ${successCount} item(s) updated successfully.`);
} else if (successCount > 0) {
    alert(`Successfully updated ${successCount} items.`);
}

if (tableRef.current && tableRef.current.reloadData) {
    tableRef.current.reloadData();
}

setShowBulkModal(false);  // Close AFTER showing result
```

---

### Issue 4: Fallback to tableRef Data (FABRIC ONLY)

#### WRONG (Fabric)
```javascript
<BulkProjectMembershipModal
    show={showBulkModal}
    onHide={() => setShowBulkModal(false)}
    items={
        // ❌ SMELL: Falls back to tableRef data if modal data not loaded
        allCustomerFabrics.length > 0 
            ? allCustomerFabrics 
            : (tableRef.current?.getTableData() || [])
    }
    onSave={handleBulkFabricSave}
    itemType="fabric"
    projectName={config?.active_project?.name || ''}
/>
```

**Why this is wrong:**
1. `tableRef.current.getTableData()` returns CURRENT PAGE data only, not all fabrics
2. If user is on page 3, modal only shows items from page 3
3. Bulk operation will only work on visible items

#### RIGHT (Zone and others)
```javascript
<BulkProjectMembershipModal
    show={showBulkModal}
    onClose={() => setShowBulkModal(false)}
    onSave={handleBulkZoneSave}
    items={allCustomerZones}  // ✓ Always use loaded data
    itemType="zone"
    projectName={config?.active_project?.name || ''}
/>
```

**Fix:** Remove fallback in FabricTableTanStackClean.jsx line 521:
```javascript
// BEFORE:
items={allCustomerFabrics.length > 0 ? allCustomerFabrics : (tableRef.current?.getTableData() || [])}

// AFTER:
items={allCustomerFabrics}
```

---

## SUMMARY: Table by Table

### AliasTableTanStackClean.jsx
```diff
- onHide={() => setShowBulkModal(false)}
+ onClose={() => setShowBulkModal(false)}
```
**Location:** Line 1245
**Also needed:** Add pagination (Issue 1)

---

### FabricTableTanStackClean.jsx
```diff
// Issue 1: No pagination (lines 81-98)
- const response = await api.get(
-     `${API_URL}/api/san/fabrics/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=all&page_size=10000`
- );

+ let allFabrics = [];
+ let page = 1;
+ let hasMore = true;
+ const pageSize = 500;
+ while (hasMore) {
+     const response = await api.get(
+         `${API_URL}/api/san/fabrics/?customer_id=${customerId}&project_id=${activeProjectId}&project_filter=all&page_size=${pageSize}&page=${page}`
+     );
+     const fabrics = response.data.results || response.data;
+     allFabrics = [...allFabrics, ...fabrics];
+     hasMore = response.data.has_next;
+     page++;
+ }

// Issue 2: Wrong parameter (line 520)
- onHide={() => setShowBulkModal(false)}
+ onClose={() => setShowBulkModal(false)}

// Issue 3: Wrong fallback (line 521)
- items={allCustomerFabrics.length > 0 ? allCustomerFabrics : (tableRef.current?.getTableData() || [])}
+ items={allCustomerFabrics}
```

---

### StorageTableTanStackClean.jsx
```diff
// Issue 1: No pagination (lines 84-101)
- const response = await api.get(
-     `${API_URL}/api/storage/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`
- );

+ let allStorage = [];
+ let page = 1;
+ let hasMore = true;
+ const pageSize = 500;
+ while (hasMore) {
+     const response = await api.get(
+         `${API_URL}/api/storage/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=${pageSize}&page=${page}`
+     );
+     const storage = response.data.results || response.data;
+     allStorage = [...allStorage, ...storage];
+     hasMore = response.data.has_next;
+     page++;
+ }

// Issue 2: Wrong close order (lines 197-208)
// Current order: reload -> close -> show alert
- // Reload table data
- if (tableRef.current && tableRef.current.reloadData) {
-     tableRef.current.reloadData();
- }
- 
- // Close modal
- setShowBulkModal(false);
- 
- // Show summary
- if (errorCount > 0) {
-     alert(...);

+ // Show summary BEFORE closing
+ if (errorCount > 0) {
+     alert(`Completed with ${errorCount} error(s). ${successCount} storage systems updated successfully.`);
+ } else if (successCount > 0) {
+     alert(`Successfully updated ${successCount} storage systems.`);
+ }
+ 
+ // Reload table data
+ if (tableRef.current && tableRef.current.reloadData) {
+     tableRef.current.reloadData();
+ }
+ 
+ // Close modal
+ setShowBulkModal(false);
```

---

### VolumeTableTanStackClean.jsx
```diff
// Issue 1: No pagination (lines 204-219)
- const response = await api.get(
-     `${API_URL}/api/storage/volumes/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=1000`
- );

+ let allVolumes = [];
+ let page = 1;
+ let hasMore = true;
+ const pageSize = 500;
+ while (hasMore) {
+     const response = await api.get(
+         `${API_URL}/api/storage/volumes/?customer=${activeCustomerId}&project_id=${activeProjectId}&page_size=${pageSize}&page=${page}`
+     );
+     const volumes = response.data.results || response.data;
+     allVolumes = [...allVolumes, ...volumes];
+     hasMore = response.data.has_next;
+     page++;
+ }
+ setAllCustomerVolumes(allVolumes);

// Issue 2: No error feedback (lines 237-260)
- const handleBulkVolumeSave = useCallback(async (selectedIds) => {
-     try {
-         if (!allCustomerVolumes || allCustomerVolumes.length === 0) return;
-         // ... logic ...
-         
-         setShowBulkModal(false);
-     } catch (error) {
-         console.error('Error in bulk volume save:', error);
-     }

+ const handleBulkVolumeSave = useCallback(async (selectedIds) => {
+     try {
+         if (!allCustomerVolumes || allCustomerVolumes.length === 0) {
+             alert('No volumes available');
+             return;
+         }
+         
+         let successCount = 0;
+         let errorCount = 0;
+         
+         // ... process adds/removes, track counts ...
+         
+         // Show result BEFORE closing
+         if (errorCount > 0) {
+             alert(`Completed with ${errorCount} error(s). ${successCount} volume(s) updated successfully.`);
+         } else if (successCount > 0) {
+             alert(`Successfully updated ${successCount} volume(s).`);
+         }
+         
+         if (tableRef.current && tableRef.current.reloadData) {
+             tableRef.current.reloadData();
+         }
+         
+         setShowBulkModal(false);
+     } catch (error) {
+         console.error('Error in bulk volume save:', error);
+         alert(`Error during bulk operation: ${error.message}`);
+     }
```

---

### HostTableTanStackClean.jsx
```diff
// Same issues as VolumeTable
// Issue 1: Add pagination (lines 173-188)
// Issue 2: Add error feedback (lines 206-229)
```

---

### PortTableTanStackClean.jsx
```diff
// Same issues as VolumeTable
// Issue 1: Add pagination (lines 198-213)
// Issue 2: Add error feedback (lines 231-254)
```

---

### SwitchTableTanStack.jsx
```diff
// Issue 1: Manual annotation instead of API response (lines 332-374)
// Currently: Fetches all switches, then fetches project switches, then manually marks membership
// Should: Use API response that already includes in_active_project flag

// Issue 2: Keep the good error handling (it's already correct at lines 453-457)
+ // Already has: if (errorCount > 0) { alert(...) }
```

---

## Testing Checklist

After applying fixes, test each table:

### Pagination Test
- [ ] Table with >1000 items loads all items in bulk modal
- [ ] Modal shows complete count, not 1000

### Modal Parameter Test
- [ ] Modal opens and closes properly
- [ ] No console errors about undefined prop

### Error Feedback Test
- [ ] User sees success message on completion
- [ ] User sees error count if any operations failed
- [ ] Table reloads after bulk operation completes
- [ ] Modal closes AFTER feedback shown

### Fallback Test (Fabric only)
- [ ] Pagination 2+ pages
- [ ] Open bulk modal on page 2
- [ ] Modal shows ALL fabrics, not just page 2
- [ ] Bulk operation affects all selected, not just visible

