# Universal Importer - Troubleshooting Guide

This guide helps resolve common issues with the Universal Importer.

---

## Table of Contents

1. [Import Progress Issues](#import-progress-issues)
2. [Statistics Display Problems](#statistics-display-problems)
3. [Icon and UI Errors](#icon-and-ui-errors)
4. [Import Never Completes](#import-never-completes)
5. [File Upload Issues](#file-upload-issues)
6. [Theme and Styling Issues](#theme-and-styling-issues)
7. [Backend and API Issues](#backend-and-api-issues)
8. [Debug Mode](#debug-mode)
9. [Getting Help](#getting-help)

---

## Import Progress Issues

### Problem: Import Progress Stuck on "Running"

**Symptoms**:
- Progress bar continues animating after import completes
- Status shows "Import in Progress" indefinitely
- No completion feedback

**Solutions**:

1. **Check the completion modal**:
   - A modal should automatically pop up when import completes
   - Even if progress appears stuck, the modal will show success

2. **Check browser console**:
   ```javascript
   // Look for these messages:
   "IMPORT COMPLETED DETECTED!"
   "Setting COMPLETED state with success progress"
   ```

3. **Verify backend status**:
   ```bash
   # Check backend logs
   docker-compose -f docker-compose.dev.yml logs backend | grep "import completed"
   ```

4. **Force refresh the page**:
   - Sometimes React state gets out of sync
   - Refresh will reset the UI state

### Problem: Progress Bar Not Updating

**Symptoms**:
- Progress stays at 0%
- No status messages appear

**Solutions**:

1. **Check Celery worker**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs celery-worker
   ```

2. **Verify Redis is running**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps redis
   ```

---

## Statistics Display Problems

### Problem: Wrong Statistics Displayed

**Symptoms**:
- Modal shows "0 items imported" when items were actually imported
- Statistics don't match what was imported
- Fabric shows as "1 Updated" when it was created

**Root Causes**:
- Backend not returning stats correctly
- Frontend not extracting stats from right fields

**Solutions**:

1. **Enable debug logging**:
   ```javascript
   // In browser console
   localStorage.setItem('debug_import', 'true');
   ```

2. **Check the API response**:
   - Open Network tab in DevTools
   - Look for `/api/importer/import-progress/` calls
   - Verify response contains:
     ```json
     {
       "aliases_imported": 320,
       "zones_imported": 340,
       "fabrics_created": 1,
       "stats": { ... }
     }
     ```

3. **Verify backend changes**:
   - Ensure `/backend/importer/views.py` includes stats extraction
   - Check `api_response_summary` field is populated

### Problem: Duration Shows Wrong Time

**Symptoms**:
- Duration shows 0 seconds
- Duration shows incorrect value

**Solution**:
- The duration is parsed from "HH:MM:SS.microseconds" format
- Check console for the raw duration value

---

## Icon and UI Errors

### Problem: "Terminal is not defined" Error

**Symptoms**:
- React error: "Terminal is not defined"
- Component fails to render

**Root Cause**:
- lucide-react library updated icon names

**Solution**:

Update imports in affected components:
```jsx
// Wrong
import { Terminal } from 'lucide-react';

// Correct
import { SquareTerminal } from 'lucide-react';
```

### Problem: Icons Not Showing

**Symptoms**:
- Empty spaces where icons should be
- Console errors about missing icons

**Solutions**:

1. **Check lucide-react version**:
   ```bash
   cd frontend && npm list lucide-react
   ```

2. **Reinstall dependencies**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec frontend npm install --legacy-peer-deps
   ```

---

## Import Never Completes

### Problem: Import Hangs Forever

**Symptoms**:
- Import starts but never finishes
- No error messages appear

**Diagnostic Steps**:

1. **Check backend logs**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs backend | tail -100
   ```

2. **Check Celery worker**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs celery-worker | tail -100
   ```

3. **Check database for import record**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
   ```
   ```python
   from importer.models import StorageImport
   StorageImport.objects.latest('id').__dict__
   ```

4. **Common causes**:
   - Celery worker crashed
   - Redis connection lost
   - Database transaction locked
   - Large file taking long time

**Solutions**:

1. **Restart services**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart celery-worker redis
   ```

2. **Check file size**:
   - Files over 10MB may take several minutes
   - Consider splitting large files

---

## File Upload Issues

### Problem: File Won't Upload

**Symptoms**:
- Drop zone doesn't accept file
- "Invalid file type" message
- File appears but preview fails

**Solutions**:

1. **Check file format**:
   - Supported: .txt, .log, .cfg, .conf
   - Must be plain text format

2. **Check file size**:
   - Max recommended: 10MB
   - Larger files may timeout

3. **Try paste method instead**:
   - Copy file contents
   - Switch to "Paste Text" tab
   - Paste directly

### Problem: Drag and Drop Not Working

**Symptoms**:
- Can't drag files into drop zone
- Drop zone doesn't highlight

**Solutions**:

1. **Browser compatibility**:
   - Ensure using modern browser (Chrome, Firefox, Edge)
   - Clear browser cache

2. **Use click to browse**:
   - Click the drop zone to open file picker

---

## Theme and Styling Issues

### Problem: Dark Mode Not Working

**Symptoms**:
- Components show light theme in dark mode
- Mixed theme appearance

**Solutions**:

1. **Check theme context**:
   ```javascript
   // In console
   localStorage.getItem('theme')
   ```

2. **Force theme refresh**:
   ```javascript
   localStorage.setItem('theme', 'dark');
   location.reload();
   ```

### Problem: Broken Styling

**Symptoms**:
- Components look unstyled
- Glass effects missing
- Layout broken

**Solutions**:

1. **Check CSS files loaded**:
   - Network tab should show all .css files
   - No 404 errors on stylesheets

2. **Rebuild frontend**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec frontend npm run build
   ```

---

## Backend and API Issues

### Problem: API Errors

**Symptoms**:
- "Failed to start import" message
- Network errors in console

**Solutions**:

1. **Check backend is running**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps backend
   ```

2. **Check API endpoint**:
   ```bash
   curl http://localhost:8000/api/importer/import-progress/1/
   ```

3. **Check CORS settings**:
   - Backend `settings_docker.py` should allow frontend origin

### Problem: Database Errors

**Symptoms**:
- "Customer not found" errors
- Import fails immediately

**Solutions**:

1. **Run migrations**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
   ```

2. **Check customer exists**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
   ```
   ```python
   from customers.models import Customer
   Customer.objects.all()
   ```

---

## Debug Mode

### Enable Debug Logging

Add to browser console to enable detailed logging:

```javascript
// Enable import debug mode
localStorage.setItem('debug_import', 'true');

// Enable all debug logs
localStorage.setItem('debug', '*');

// Disable debug mode
localStorage.removeItem('debug_import');
localStorage.removeItem('debug');
```

### What Debug Mode Shows

- Poll response data
- Stats extraction process
- State changes
- API calls and responses
- Error details

### Check Component State

```javascript
// In React DevTools
// Select UniversalImporter component
// View state in right panel
$r.state  // Shows component state
$r.props  // Shows component props
```

### Network Debugging

1. Open Chrome DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - `/api/importer/parse-preview/` - Initial parsing
   - `/api/importer/import-san-config/` - Start import
   - `/api/importer/import-progress/` - Progress polling

---

## Getting Help

### Before Asking for Help

1. **Check logs**:
   ```bash
   # Frontend
   docker-compose -f docker-compose.dev.yml logs frontend | tail -100

   # Backend
   docker-compose -f docker-compose.dev.yml logs backend | tail -100

   # Celery
   docker-compose -f docker-compose.dev.yml logs celery-worker | tail -100
   ```

2. **Gather information**:
   - Browser and version
   - Error messages (exact text)
   - Screenshots if UI issue
   - Network tab HAR file
   - Console output

3. **Try basic fixes**:
   - Clear browser cache
   - Restart Docker containers
   - Pull latest code

### Common Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Import stuck | Check completion modal appeared |
| Stats wrong | Restart backend container |
| Icons missing | Update to SquareTerminal |
| Theme broken | Clear localStorage |
| Can't upload | Check file format |
| API errors | Check backend running |

### Contact Support

If issue persists after troubleshooting:

1. Create GitHub issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Error messages
   - Environment details

2. Include debug logs:
   ```bash
   # Collect all logs
   ./collect-logs.sh > debug-logs.txt
   ```

3. Tag issue with `universal-importer` label

---

## Performance Issues

### Problem: Import Very Slow

**Symptoms**:
- Import takes > 5 minutes
- UI becomes unresponsive

**Solutions**:

1. **Check file size**:
   - Files > 1MB may be slow
   - Consider splitting large files

2. **Check database performance**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec postgres pg_top
   ```

3. **Monitor memory**:
   ```bash
   docker stats
   ```

### Problem: Browser Freezes

**Symptoms**:
- Tab becomes unresponsive
- High CPU usage

**Solutions**:

1. **Limit data preview**:
   - Don't select all items if > 1000
   - Import in batches

2. **Use Chrome Task Manager**:
   - Shift+Esc in Chrome
   - Check memory usage

---

## Recovery Procedures

### Reset Import State

If import is stuck in bad state:

```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Clear Import History

```bash
# Django shell
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
```
```python
from importer.models import StorageImport
StorageImport.objects.filter(status='running').update(status='failed')
```

### Restart All Services

```bash
# Complete restart
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

---

## Known Issues

### Current Limitations

1. **File size**: Best performance with files < 5MB
2. **Browser support**: Chrome/Edge recommended
3. **Concurrent imports**: Only one import at a time
4. **Large datasets**: > 10,000 items may timeout

### Workarounds

- Split large files into smaller chunks
- Use paste method for small configs
- Import during off-peak hours
- Use batch import for large datasets

---

**Last Updated**: October 2024
**Version**: 2.0.1