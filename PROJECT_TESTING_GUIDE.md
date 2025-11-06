# Project Architecture Testing Guide

**Test Environment:**
- Customer: "Evolving Solutions"
- Project: "Test"
- User Role: Admin

**Testing Date:** _______________
**Tested By:** _______________

---

## Pre-Testing Setup

1. **Open Browser DevTools**
   - Press F12 or Cmd+Option+I (Mac)
   - Go to the **Console** tab
   - Clear console (click clear button or Cmd+K)

2. **Select Test Environment**
   - Navigate to application
   - Select Customer: **Evolving Solutions**
   - Select Project: **Test**
   - Confirm selection in navbar dropdowns

---

## Table 1: Alias Table (/san/aliases)

### A. Basic Table Display
- [ ] Navigate to `/san/aliases`
- [ ] Table loads without errors
- [ ] Data displays in table
- [ ] "Projects" column shows badges for project memberships
- [ ] Active project badge ("Test") is highlighted with **bg-primary** (blue)
- [ ] Other project badges show with **bg-secondary** (gray)

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View (Default)
- [ ] "Customer View" button is **active/primary** (blue background)
- [ ] Table shows **all aliases** for "Evolving Solutions" customer
- [ ] Project memberships column shows which aliases are in which projects
- [ ] Can see aliases that are NOT in "Test" project

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Project View Toggle
- [ ] Click "Project View" button
- [ ] Button becomes **active/primary** (blue)
- [ ] "Customer View" button becomes **outline** (gray)
- [ ] Table reloads with filtered data
- [ ] Table shows **only aliases** in "Test" project
- [ ] **No console errors**
- [ ] URL contains project view endpoint

**Console Check:** Open DevTools Console - should be clean (only errors OK)

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Bulk Add/Remove Modal - Opening
- [ ] Click the **checklist icon button** (rightmost button in toolbar)
- [ ] Modal opens with title "Add/Remove Aliases"
- [ ] Modal shows project info: "Project: Test"
- [ ] Search bar is visible
- [ ] Item list loads (may take a moment)
- [ ] "Select All" / "Deselect All" button visible

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### E. Bulk Modal - Pre-checked Items
- [ ] Items already in "Test" project are **pre-checked** ✓
- [ ] Items NOT in project are **unchecked**
- [ ] Selected count at bottom shows correct number
- [ ] Can scroll through list if many items

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### F. Bulk Modal - Search & Select
- [ ] Type in search box
- [ ] List filters to matching items only
- [ ] "Select All" selects all **filtered** items
- [ ] "Deselect All" unchecks all **filtered** items
- [ ] Clear search - full list returns
- [ ] Selected count updates correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### G. Adding Aliases to Project
**Switch back to Customer View first!**

- [ ] Click "Customer View" button
- [ ] Table shows all customer aliases
- [ ] Find an alias **NOT** in "Test" project (no "Test" badge)
- [ ] Note alias name: _______________
- [ ] Open bulk modal (checklist icon)
- [ ] Find the alias in the list
- [ ] **Check** the checkbox
- [ ] Click "OK" button
- [ ] Modal shows "Processing..." spinner
- [ ] Modal closes
- [ ] Table reloads automatically
- [ ] The alias now shows a "Test" badge (bg-primary blue)

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### H. Verify in Project View
- [ ] Click "Project View" button
- [ ] Table shows project-only aliases
- [ ] The alias you just added **appears** in the table
- [ ] **No console errors**

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### I. Removing Aliases from Project
**Stay in Project View**

- [ ] Note an alias name to remove: _______________
- [ ] Open bulk modal (checklist icon)
- [ ] Find the alias you want to remove
- [ ] It should be **pre-checked** ✓
- [ ] **Uncheck** the checkbox
- [ ] Click "OK" button
- [ ] Modal processes and closes
- [ ] Table reloads
- [ ] The alias is **gone** from Project View
- [ ] Switch to Customer View
- [ ] The alias is still there but **no "Test" badge**

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### J. Manage Project Button
- [ ] Click "Manage Project" button
- [ ] Navigates to `/settings/project`
- [ ] Project settings page loads correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### K. Console Error Check
**Open DevTools Console**

- [ ] No errors during table load
- [ ] No errors during view switching
- [ ] No errors during bulk operations
- [ ] No 500 errors in Network tab
- [ ] All API calls return 200 status

**✅ PASS** | **❌ FAIL** | **Errors Found:** _______________

---

## Table 2: Zone Table (/san/zones)

### A. Basic Table Display
- [ ] Navigate to `/san/zones`
- [ ] Table loads without errors
- [ ] Data displays in table
- [ ] "Projects" column shows badges for project memberships
- [ ] Active project badge ("Test") is highlighted with **bg-primary** (blue)

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View (Default)
- [ ] "Customer View" button is active (blue)
- [ ] Table shows **all zones** for customer
- [ ] Project memberships column visible
- [ ] Can see zones NOT in "Test" project

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Project View Toggle
- [ ] Click "Project View" button
- [ ] Button becomes active/primary (blue)
- [ ] Table reloads with filtered data
- [ ] Shows **only zones** in "Test" project
- [ ] **No console errors**

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Bulk Modal - Opening & Pre-checked
- [ ] Click checklist icon button
- [ ] Modal opens: "Add/Remove Zones"
- [ ] Items in project are **pre-checked** ✓
- [ ] Items NOT in project are unchecked
- [ ] Search and filters work

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### E. Adding Zones to Project
- [ ] Switch to Customer View
- [ ] Find zone NOT in "Test" project
- [ ] Note zone name: _______________
- [ ] Open bulk modal
- [ ] Check the zone
- [ ] Click OK
- [ ] Modal processes
- [ ] Table reloads
- [ ] Zone now has "Test" badge

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### F. Removing Zones from Project
- [ ] Switch to Project View
- [ ] Note zone to remove: _______________
- [ ] Open bulk modal
- [ ] Uncheck the zone (should be pre-checked)
- [ ] Click OK
- [ ] Table reloads
- [ ] Zone is gone from Project View
- [ ] Switch to Customer View - zone still exists, no badge

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### G. Console Error Check
- [ ] No errors in console
- [ ] No 500 errors in Network tab
- [ ] All operations successful

**✅ PASS** | **❌ FAIL** | **Errors:** _______________

---

## Table 3: Storage Table (/storage)

### A. Basic Table Display
- [ ] Navigate to `/storage`
- [ ] Table loads without errors
- [ ] Storage systems display
- [ ] "Projects" column shows badges
- [ ] Active project badge highlighted (blue)

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View & Project View Toggle
- [ ] Customer View shows all storage systems
- [ ] Project View shows only project storage
- [ ] Toggle works without errors

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Bulk Modal Functionality
- [ ] Checklist button opens modal
- [ ] Pre-checked items correct
- [ ] Can add storage to project
- [ ] Can remove storage from project
- [ ] Table updates correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Console Error Check
- [ ] No console errors
- [ ] No network errors

**✅ PASS** | **❌ FAIL** | **Errors:** _______________

---

## Table 4: Volume Table (/storage/volumes)

### A. Basic Table Display
- [ ] Navigate to `/storage/volumes`
- [ ] Table loads without errors
- [ ] Volumes display
- [ ] "Projects" column shows badges
- [ ] Active project badge highlighted

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View & Project View Toggle
- [ ] Customer View shows all volumes
- [ ] Project View shows only project volumes
- [ ] Toggle works without errors

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Bulk Modal Functionality
- [ ] Modal opens correctly
- [ ] Pre-checked items correct
- [ ] Can add volumes to project
- [ ] Can remove volumes from project
- [ ] Table updates correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Console Error Check
- [ ] No console errors
- [ ] No network errors

**✅ PASS** | **❌ FAIL** | **Errors:** _______________

---

## Table 5: Host Table (/storage/hosts)

### A. Basic Table Display
- [ ] Navigate to `/storage/hosts`
- [ ] Table loads without errors
- [ ] Hosts display
- [ ] "Projects" column shows badges
- [ ] Active project badge highlighted

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View & Project View Toggle
- [ ] Customer View shows all hosts
- [ ] Project View shows only project hosts
- [ ] Toggle works without errors

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Bulk Modal Functionality
- [ ] Modal opens correctly
- [ ] Pre-checked items correct
- [ ] Can add hosts to project
- [ ] Can remove hosts from project
- [ ] Table updates correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Console Error Check
- [ ] No console errors
- [ ] No network errors

**✅ PASS** | **❌ FAIL** | **Errors:** _______________

---

## Table 6: Port Table (/storage/ports)

### A. Basic Table Display
- [ ] Navigate to `/storage/ports`
- [ ] Table loads without errors
- [ ] Ports display
- [ ] "Projects" column shows badges
- [ ] Active project badge highlighted

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### B. Customer View & Project View Toggle
- [ ] Customer View shows all ports
- [ ] Project View shows only project ports
- [ ] Toggle works without errors

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### C. Bulk Modal Functionality
- [ ] Modal opens correctly
- [ ] Pre-checked items correct
- [ ] Can add ports to project
- [ ] Can remove ports from project
- [ ] Table updates correctly

**✅ PASS** | **❌ FAIL** | **Notes:** _______________

---

### D. Console Error Check
- [ ] No console errors
- [ ] No network errors

**✅ PASS** | **❌ FAIL** | **Errors:** _______________

---

## Overall Testing Summary

### Tables Tested:
- [ ] Alias Table - **PASS** / **FAIL**
- [ ] Zone Table - **PASS** / **FAIL**
- [ ] Storage Table - **PASS** / **FAIL**
- [ ] Volume Table - **PASS** / **FAIL**
- [ ] Host Table - **PASS** / **FAIL**
- [ ] Port Table - **PASS** / **FAIL**

### Critical Issues Found:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Minor Issues Found:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Console Errors:
- **Total Errors:** _______________
- **Severity:** Low / Medium / High
- **Details:** _______________________________________________

---

## Testing Notes

**What worked well:**
_______________________________________________
_______________________________________________

**What needs improvement:**
_______________________________________________
_______________________________________________

**Additional observations:**
_______________________________________________
_______________________________________________

---

**Testing Complete:** _______________
**Sign-off:** _______________
