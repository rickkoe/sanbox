# Logo Not Appearing in Production Worksheets - Troubleshooting Guide

## Quick Diagnosis

Run this on your production server to diagnose the issue:

```bash
./scripts/check-logo-production.sh
```

This will check:
- Where Django is looking for the logo
- If the logo file exists in the container
- All common logo file locations

## Common Issues and Fixes

### Issue 1: Logo File Not in Container

**Symptom:** Script shows logo file doesn't exist

**Fix:**
```bash
# Option A: Rebuild container (recommended)
docker-compose build --no-cache backend
docker-compose up -d backend

# Option B: Manually copy logo to container
docker cp backend/static/images/company-logo.png sanbox_backend:/app/static/images/
docker-compose restart backend
```

### Issue 2: Logo File Path Mismatch

**Symptom:** Logo exists but in different location than code expects

**Check what the code is looking for:**
```bash
docker-compose exec backend python manage.py shell -c "
import os
from django.conf import settings
logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
print(f'Looking for logo at: {logo_path}')
print(f'Exists: {os.path.exists(logo_path)}')
"
```

**Expected output:**
```
Looking for logo at: /app/static/images/company-logo.png
Exists: True
```

### Issue 3: Logo File Missing from Git

**Symptom:** Logo exists locally but not in production after deployment

**Check if logo is in git:**
```bash
git ls-files backend/static/images/company-logo.png
```

**If not in git, add it:**
```bash
git add backend/static/images/company-logo.png
git commit -m "Add company logo for worksheets"
git push origin main
```

**Then deploy:**
```bash
# On production
./deploy-container.sh
```

### Issue 4: Static Files Not Copied in Dockerfile

**Symptom:** Logo missing after container rebuild

**Verify Dockerfile includes static files:**
```bash
grep -A 2 "COPY.*\." backend/Dockerfile
```

Should show:
```dockerfile
COPY --chown=appuser:appuser . .
```

This copies all files including `static/` directory.

## Manual Verification Steps

### Step 1: Check Logo Exists Locally

```bash
ls -lh backend/static/images/company-logo.png
```

Expected: File should exist and be ~29KB

### Step 2: Check Logo in Container

```bash
docker-compose exec backend ls -lh /app/static/images/company-logo.png
```

Expected: File exists in container at `/app/static/images/company-logo.png`

### Step 3: Check Django Settings

```bash
docker-compose exec backend python manage.py shell -c "
from django.conf import settings
print(f'BASE_DIR: {settings.BASE_DIR}')
print(f'STATIC_ROOT: {settings.STATIC_ROOT}')
"
```

Expected:
```
BASE_DIR: /app
STATIC_ROOT: /app/static/  (or similar)
```

### Step 4: Test Logo Loading in Python

```bash
docker-compose exec backend python manage.py shell << 'EOF'
import os
from django.conf import settings
from openpyxl.drawing.image import Image as XLImage

logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
print(f"Logo path: {logo_path}")
print(f"File exists: {os.path.exists(logo_path)}")

if os.path.exists(logo_path):
    try:
        img = XLImage(logo_path)
        print(f"Image loaded successfully")
        print(f"Image size: {img.width}x{img.height}")
    except Exception as e:
        print(f"Error loading image: {e}")
else:
    print("Logo file not found!")
EOF
```

Expected: Image loads successfully with dimensions shown

### Step 5: Check Worksheet Generation Logs

Generate a worksheet and check backend logs for errors:

```bash
docker-compose logs backend --tail=100 | grep -i "logo\|error"
```

Look for any error messages related to logo loading.

## Complete Fix Procedure

If logo is still not appearing after diagnosis, follow these steps:

### 1. Ensure Logo Exists in Git Repository

```bash
# On your local machine
ls -lh backend/static/images/company-logo.png

# If missing, get it from dev container
docker cp sanbox_dev_backend:/app/static/images/company-logo.png backend/static/images/

# Add to git
git add backend/static/images/company-logo.png
git commit -m "Add company logo for worksheets"
git push origin main
```

### 2. Deploy Latest Code to Production

```bash
# On production server
git pull origin main

# Or use deployment script
./deploy-container.sh
```

### 3. Rebuild Production Container

```bash
# On production server
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

### 4. Verify Logo in Container

```bash
docker-compose exec backend ls -lh /app/static/images/company-logo.png
```

### 5. Test Worksheet Generation

1. Go to production worksheet generator
2. Add at least one implementation team contact (or not - it should work either way)
3. Generate a worksheet
4. Open Excel file and check footer for logo

## Logo File Requirements

- **Path:** `backend/static/images/company-logo.png`
- **Format:** PNG
- **Recommended size:** ~200-300px wide, transparent background
- **Current size:** ~29KB (28.8K)

## Code Reference

The logo loading code is in `backend/core/worksheet_views.py`:

```python
# Line 212: Logo path definition
logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')

# Line 643: Logo loading condition (now always checks if exists)
if os.path.exists(logo_path):
    # Load and add logo to worksheet
```

## Quick Test Command

Run this single command to verify everything:

```bash
docker-compose exec backend python -c "
import os
from django.conf import settings
path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
print('LOGO CHECK:', 'EXISTS' if os.path.exists(path) else 'MISSING', 'at', path)
"
```

Expected output:
```
LOGO CHECK: EXISTS at /app/static/images/company-logo.png
```

## Still Not Working?

If logo still doesn't appear after all these steps:

1. Check the actual generated Excel file for any errors
2. Try opening the Excel file in different programs (Excel, LibreOffice)
3. Check if the logo appears but is very small or outside visible area
4. Review backend logs during worksheet generation for Python errors

## Contact for Help

If none of these solutions work, gather this information:

```bash
# Run diagnostic
./scripts/check-logo-production.sh > logo-diagnostic.txt

# Get backend logs
docker-compose logs backend --tail=200 > backend-logs.txt

# Check container files
docker-compose exec backend find /app -name "*.png" > png-files.txt
```

Then review these files to identify the issue.
