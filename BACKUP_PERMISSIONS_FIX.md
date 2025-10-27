# Backup Permissions Fix for Production

## Problem Summary

Backups were failing in production with the error:
```
pg_dump: error: could not open output file "/app/backups/sanbox_backup_20251027_161006.dump": Permission denied
```

**Root Cause**: The Docker named volume `backup_files` was created with root ownership, but the container runs as `appuser` (UID 1001). The Dockerfile was missing `/app/backups` directory creation, so Docker created the volume directory with default (root) ownership.

## Solution Applied

Updated `backend/Dockerfile` to create the `/app/backups` directory with proper ownership in both development and production stages. This ensures that when Docker initializes the named volume, it copies the directory permissions from the image.

## Deployment Steps

### 1. Rebuild the Docker Image

From your production server, rebuild the backend image:

```bash
cd /path/to/sanbox

# Pull latest code changes (if deploying from git)
git pull

# Rebuild the backend image
docker build -t sanbox-backend:latest -f backend/Dockerfile --target production backend/
```

Or if using the deployment script:
```bash
./deploy-container.sh
```

### 2. Fix Existing Volume Permissions

You have two options to fix the permissions on the existing `backup_files` volume:

#### Option A: Clean Slate (Recommended if no important backups exist)

**WARNING**: This will delete all existing backups in the volume!

```bash
# Stop all services
docker-compose down

# Remove the backup volume
docker volume rm sanbox_backup_files

# Start services (volume will be recreated with correct permissions)
docker-compose up -d
```

#### Option B: Fix Permissions on Existing Volume (Preserves existing backups)

```bash
# Stop the celery-worker and celery-beat containers
docker-compose stop celery-worker celery-beat backend

# Run a temporary container with root access to fix permissions
docker run --rm \
  -v sanbox_backup_files:/app/backups \
  alpine:latest \
  sh -c "chown -R 1001:1001 /app/backups && chmod -R 755 /app/backups"

# Restart the services
docker-compose up -d
```

### 3. Verify the Fix

Test that backups now work:

```bash
# Check the permissions in the volume
docker-compose exec backend ls -la /app/backups

# Expected output should show:
# drwxr-xr-x ... appuser appuser ... .

# Try creating a manual backup through the UI
# Navigate to: https://your-domain.com/backups
# Click "Create Backup"

# Or test via command line
docker-compose exec backend python manage.py shell << EOF
from backup.models import BackupRecord
from backup.tasks import create_backup_task

backup = BackupRecord.objects.create(
    name="Test Backup",
    description="Testing permissions fix",
    backup_type='full',
    django_version='5.1.6',
    python_version='3.12',
    migration_state={},
    installed_apps=[]
)

task = create_backup_task.delay(backup.id, include_media=False)
print(f"Backup task started: {task.id}")
EOF

# Check logs for success
docker-compose logs -f celery-worker
```

## Technical Details

### Changes Made to Dockerfile

**Before** (lines 69 and 102):
```dockerfile
RUN mkdir -p /app/logs /app/static /app/media && \
    chown -R appuser:appuser /app
```

**After**:
```dockerfile
RUN mkdir -p /app/logs /app/static /app/media /app/backups && \
    chown -R appuser:appuser /app
```

### Why This Works

1. **Docker Volume Initialization**: When a named volume is first mounted to a container, Docker copies the contents and permissions from the image's directory at that mount point to the volume.

2. **Proper Ownership**: By creating `/app/backups` in the Dockerfile and setting ownership to `appuser:appuser` before switching to the non-root user, we ensure the directory has the correct permissions.

3. **Container Security**: The container continues to run as a non-root user (`appuser`), maintaining security best practices while having write access to the backup directory.

### Why Dev Worked but Production Failed

- **Development** uses a bind mount (`./dev_backups:/app/backups`)
  - Bind mounts on Mac Docker Desktop use permissive file sharing
  - Host directory is writable by containers

- **Production** uses a named volume (`backup_files:/app/backups`)
  - Named volumes are created by Docker daemon
  - Without pre-existing directory in image, they default to root ownership
  - Non-root container user cannot write to root-owned directories

## Prevention

This fix ensures that future deployments will not have this issue. The `/app/backups` directory is now part of the Docker image with proper ownership, so any new volume mounts will inherit the correct permissions.

## Rollback

If you need to rollback to the previous image:

```bash
# Use the previous image version
VERSION=previous_version docker-compose up -d

# Or rebuild from the previous commit
git checkout <previous-commit>
docker build -t sanbox-backend:rollback -f backend/Dockerfile --target production backend/
VERSION=rollback docker-compose up -d
```

## Related Files

- [backend/Dockerfile](backend/Dockerfile) - Lines 69 and 102 updated
- [docker-compose.yml](docker-compose.yml) - Line 71 defines the backup_files volume
- [backend/backup/service.py](backend/backup/service.py) - Backup service that writes to /app/backups
- [backend/backup/tasks.py](backend/backup/tasks.py) - Celery tasks that call the backup service

## Support

If backups continue to fail after applying this fix:

1. Check container user: `docker-compose exec backend id`
2. Check directory permissions: `docker-compose exec backend ls -la /app/backups`
3. Check volume ownership: `docker run --rm -v sanbox_backup_files:/app/backups alpine:latest ls -la /app/backups`
4. Check Celery worker logs: `docker-compose logs celery-worker`
5. Check backup logs in the UI: Navigate to `/backups` and view the log for the failed backup

---
**Date**: 2025-10-27
**Issue**: Permission denied when creating backups in production
**Resolution**: Added `/app/backups` directory creation to Dockerfile with proper ownership
