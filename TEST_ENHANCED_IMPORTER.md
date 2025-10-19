# Testing the Enhanced Universal Importer

## ✅ What's New and Ready to Test

### 1. **Checkbox Selection System**
Navigate to: `http://localhost:3000/import/universal`

**Test Steps:**
1. Upload your Cisco `show-running-config.txt` file (or paste text)
2. Click **"Preview Import"**
3. **Verify** you see three sections with checkboxes:
   - Aliases section with "X of Y selected" counter
   - Zones section with "X of Y selected" counter
   - Fabrics section with "X of Y selected" counter
4. **Test Selection:**
   - Click individual checkboxes - row should highlight in blue
   - Click header checkbox - should select/deselect all in that section
   - Click "Select All" button - all rows selected
   - Click "Deselect All" button - all rows deselected
   - Counter should update in real-time

**Expected:**
- All items auto-selected by default
- Selection counter accurate
- Selected rows highlighted
- Scrollable tables if many items

### 2. **Fabric Dropdown**
**Test Steps:**
1. After preview loads, scroll to "Import Configuration" section
2. **Verify** dropdown shows:
   - "Create New Fabric" (default selected)
   - Separator line
   - "Cisco Fabrics" group (if you have Cisco fabrics)
   - "Brocade Fabrics" group (if you have Brocade fabrics)
   - Existing fabrics show with "(VSAN: X)" notation
3. **Test "Create New Fabric":**
   - Should show text input below
   - Placeholder shows first fabric name from config
   - Can leave blank or enter custom name
4. **Test selecting existing fabric:**
   - Select a fabric from dropdown
   - Text input should hide
   - Import will merge into selected fabric

**Expected:**
- Dropdown populates on page load
- Fabrics grouped by vendor
- UI changes based on selection

### 3. **Duplicate Detection**
**Test Steps:**
1. Import a file once (let it complete)
2. Import the **same file again**
3. On preview step, look for warning box
4. **Verify** warning shows:
   - "⚠️ Duplicate Zones Detected!"
   - Number of conflicting zones
   - Message about resolving in next step

**Expected:**
- Conflicts detected for zones already in database
- Warning message clear and visible
- Details show which zones conflict

### 4. **Enhanced Preview Display**
**Test Steps:**
1. Upload a large config file (100+ zones)
2. Click **"Preview Import"**
3. **Verify:**
   - ALL aliases shown (not limited to 100)
   - ALL zones shown (not limited to 100)
   - ALL fabrics shown
   - Tables are scrollable (max height ~400px)
   - WWPNs shown in monospace font
   - Member counts accurate

**Expected:**
- Complete data preview
- Scrollable if many items
- Clean table formatting
- No truncation

### 5. **Step 4 Formatting**
**Test Steps:**
1. Select items and start import
2. **Verify** Step 4 shows:
   - Status badge centered at top
   - Progress bar centered below
   - Progress message below bar
   - "View Import Logs" button centered
   - On completion: buttons properly spaced
   - Everything vertically centered

**Expected:**
- Clean, centered layout
- No overlapping elements
- Proper spacing between components
- Buttons aligned

---

## ⚠️ Known Limitations (Not Yet Implemented)

### 1. **No Conflict Resolution UI Yet**
- Conflict warning shows, but you can't resolve conflicts yet
- Currently, duplicate zones will be **replaced** (update_or_create behavior)
- Conflict resolution step (3.5) coming next

### 2. **Selection Doesn't Filter Import Yet**
- You can select/deselect items
- Selection is sent to backend
- **But**: Backend doesn't filter yet - imports everything
- This feature is next on the list

### 3. **No Bulk Actions Yet**
- Can't apply same action to all conflicts
- Can't rename with pattern
- Can't skip all duplicates

---

## 🐛 Debugging Import Issues

### If Import Doesn't Start:
```bash
# Check backend logs
docker-compose -f docker-compose.dev.yml logs backend -f

# Check Celery logs
docker-compose -f docker-compose.dev.yml logs celery-worker -f
```

### If Import Hangs:
1. Check Celery worker is running:
   ```bash
   docker-compose -f docker-compose.dev.yml ps celery-worker
   ```
2. Check for errors in logs
3. Verify customer ID is correct
4. Check fabric selection is valid

### If No Data Appears After Import:
1. Check import completed successfully (status = 'completed')
2. Navigate to `/san/fabrics` - verify fabric exists
3. Navigate to `/san/aliases` - filter by fabric
4. Navigate to `/san/zones` - filter by fabric
5. Check import logs for errors

---

## 📊 Success Criteria

### ✅ Frontend Working If:
- [ ] All preview sections show with checkboxes
- [ ] Selection toggles work smoothly
- [ ] Counters update accurately
- [ ] Fabric dropdown populated
- [ ] Step 4 formatted correctly
- [ ] No console errors (F12)

### ✅ Backend Working If:
- [ ] Preview API returns all items
- [ ] Conflicts detected for duplicates
- [ ] Import task starts (check logs)
- [ ] Progress updates received
- [ ] Import completes (status = 'completed')
- [ ] Data appears in database

### ✅ Full Success If:
- [ ] Can preview 500+ items with checkboxes
- [ ] Can select/deselect items smoothly
- [ ] Conflict warning shows for duplicates
- [ ] Import executes without errors
- [ ] Aliases appear in /san/aliases
- [ ] Zones appear in /san/zones
- [ ] Fabric created/updated correctly

---

## 🔍 What to Report

### If Something Doesn't Work:

1. **Which step failed?**
   - Step 1: Type selection
   - Step 2: Upload/paste
   - Step 3: Preview
   - Step 4: Import execution

2. **Error messages:**
   - Screenshot of any error alerts
   - Browser console errors (F12 → Console tab)
   - Network errors (F12 → Network tab → look for red items)

3. **Backend logs:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs backend --tail=50
   docker-compose -f docker-compose.dev.yml logs celery-worker --tail=50
   ```

4. **What you expected vs. what happened:**
   - Expected: "Preview should show 200 zones with checkboxes"
   - Actual: "Preview shows only 100 zones, no checkboxes"

---

## 🎯 Next Features to Test (When Ready)

### Conflict Resolution (Coming Next):
- Step 3.5 appears when conflicts detected
- Table shows existing vs. new zone comparison
- Bulk action dropdown:
  - Skip all
  - Rename all with suffix
  - Replace all
  - Merge all
- Individual resolution per zone
- "Apply to similar" button

### Selected Item Filtering:
- Deselect 50 zones
- Import
- Verify only selected zones imported
- Deselected zones not in database

### Advanced Conflict Handling:
- Rename pattern: "{name}_imported"
- Merge members: Existing members + new members
- Smart detection: Same name, same members = skip

---

## 💡 Tips for Testing

1. **Start small:** Test with a small config file (10-20 zones) first
2. **Check each step:** Don't rush - verify each step works before proceeding
3. **Use browser DevTools:** F12 → Console for errors, Network for API calls
4. **Test edge cases:**
   - File with 0 zones
   - File with 1000+ zones
   - File with duplicate names
   - File with invalid data
5. **Compare before/after:** Check database before import, then after

---

## 📞 Support Info

- **Docs**: `UNIVERSAL_IMPORTER_ENHANCEMENTS.md` - Full implementation details
- **Original Guide**: `TESTING_UNIVERSAL_IMPORTER.md` - Basic usage
- **Fixes Applied**: `FIXES_APPLIED.md` - Previous fixes

---

**Ready to Test!** 🚀

The enhancements are deployed and running. Start with Step 1 above and work through the checklist.
