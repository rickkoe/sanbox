# Logo in Worksheets - Permanent Fix Applied

## Problem

The company logo was not appearing in production-generated worksheets because the `.dockerignore` file was excluding the entire `static/` directory from being copied into the Docker container during builds.

## Root Cause

**File:** `backend/.dockerignore` (line 40)

```dockerignore
# Static and media files (will be collected in container)
static/          # ← This excluded ALL static files, including the logo
staticfiles/
media/
```

The intent was to exclude collected static files (like Django admin CSS/JS), but it also excluded our custom logo file that needs to be bundled with the application.

## Solution Applied

Updated `backend/.dockerignore` to exclude most static files BUT allow the `static/images/` directory:

```dockerignore
# Static and media files (will be collected in container)
# BUT allow static/images/ directory for logos and required images
static/*         # ← Exclude all files in static/
!static/images/  # ← EXCEPT the images directory (negation pattern)
staticfiles/
media/
```

### How Docker Negation Patterns Work

- `static/*` - Excludes everything directly under `static/`
- `!static/images/` - Re-includes the `images/` directory and its contents
- Result: `static/images/company-logo.png` is now copied into the container

## Files Changed

1. **backend/.dockerignore** - Updated to allow static/images/ directory

## Verification

After this fix, the logo will automatically be included in all future container builds.

### Test the Fix

```bash
# Rebuild the container
docker-compose build --no-cache backend
docker-compose up -d backend

# Verify logo is in the container
docker exec sanbox_backend ls -lh /app/static/images/company-logo.png

# Should show:
# -rw-r--r-- 1 appuser appuser 28.8K ... company-logo.png
```

## Deployment Steps

### For Production

```bash
# 1. Pull latest code (includes .dockerignore fix)
git pull origin main

# 2. Rebuild containers
docker-compose build --no-cache backend
docker-compose up -d backend

# 3. Verify logo exists
./scripts/check-logo-production.sh

# Should show: "Exists: True" in step 2
```

### For Future Deployments

No manual steps needed! The logo will automatically be included in all future container builds because:

1. Logo file is in git: `backend/static/images/company-logo.png`
2. `.dockerignore` now allows the images directory
3. Dockerfile copies all application code: `COPY --chown=appuser:appuser . .`

## Adding More Static Images

If you need to add more static images (like additional logos, icons, etc.):

1. Place them in `backend/static/images/`
2. Add to git: `git add backend/static/images/your-image.png`
3. Commit and deploy - they'll automatically be included

The `.dockerignore` pattern `!static/images/` allows the entire images directory.

## Why We Exclude Other Static Files

The `.dockerignore` still excludes most of `static/` because:

- Django's `collectstatic` command gathers CSS/JS from installed packages
- These collected files can be large (Django admin, REST framework, etc.)
- They're regenerated during container startup
- Including them would bloat the Docker image unnecessarily

But our custom logo is different:
- It's a permanent part of the application
- It's needed for worksheet generation (backend process)
- It must be available inside the container

## Technical Details

### Docker Context and .dockerignore

When you run `docker build`, Docker:
1. Reads the entire directory (the "build context")
2. Filters files based on `.dockerignore`
3. Sends remaining files to Docker daemon
4. Uses them when executing `COPY` commands in Dockerfile

The `.dockerignore` file improves build performance and reduces image size by excluding unnecessary files.

### File Path in Container

The logo ends up at: `/app/static/images/company-logo.png`

This is because:
- Dockerfile sets: `WORKDIR /app`
- Dockerfile runs: `COPY --chown=appuser:appuser . .`
- The `static/images/` directory (now not ignored) gets copied
- Result: `/app/static/images/company-logo.png`

### Code Reference

The worksheet generation code looks for the logo at:

```python
# backend/core/worksheet_views.py, line 212
logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
# Resolves to: /app/static/images/company-logo.png
```

## Checklist for Permanent Fix

- [x] Logo file in git repository
- [x] `.dockerignore` updated to allow `static/images/`
- [x] Changes committed to git
- [ ] Changes pushed to remote
- [ ] Production rebuilt with new .dockerignore
- [ ] Logo verified in production worksheets

## Quick Commands

### Check Logo Status
```bash
./scripts/check-logo-production.sh
```

### Rebuild Production
```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Verify in Container
```bash
docker exec sanbox_backend ls -lh /app/static/images/company-logo.png
```

## Future Maintenance

No special maintenance needed. The logo will automatically be included in all future builds as long as:

1. The file exists at `backend/static/images/company-logo.png`
2. The `.dockerignore` pattern remains: `!static/images/`
3. The Dockerfile continues to copy application code

---

**Status:** ✅ Fix applied and ready for deployment
**Next Step:** Commit changes and deploy to production
