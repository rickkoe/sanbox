# Audit Log Implementation - Continuation Guide

## Current Status (as of 2025-10-29)

### ✅ COMPLETED

#### Backend Infrastructure
- ✅ **Database Models**
  - `AuditLog` model created in `backend/core/models.py`
  - `AppSettings` extended with `audit_log_retention_days` field (default: 90 days)
  - Migrations created and applied
  - Django admin registered (read-only)

- ✅ **API Endpoints**
  - `GET /api/core/audit-log/` - List with filters & pagination
  - `POST /api/core/audit-log/purge/` - Manual purge (staff/superuser only)
  - URL routing configured in `backend/core/urls.py`

- ✅ **Audit Logging Utility** (`backend/core/audit.py`)
  - `log_login(user, request)` - Login tracking
  - `log_logout(user, request)` - Logout tracking
  - `log_import(user, customer, import_type, summary, details, status, duration)` - Import operations
  - `log_backup(user, backup_name, size_mb, status, duration, details)` - Backup operations
  - `log_restore(user, backup_name, status, duration, details)` - Restore operations
  - `log_create(user, entity_type, entity_name, customer, details)` - Generic create
  - `log_update(user, entity_type, entity_name, customer, details)` - Generic update
  - `log_delete(user, entity_type, entity_name, customer, details)` - Generic delete
  - `log_export(user, entity_type, customer, details)` - Export operations
  - `log_config_change(user, config_type, summary, details)` - Config changes

- ✅ **Active Logging**
  - Login/Logout (in `backend/authentication/views.py`)
  - SAN imports (in `backend/importer/tasks.py`)
  - Storage imports (in `backend/importer/tasks.py`)
  - Database backups (in `backend/backup/tasks.py`)
  - Database restores (in `backend/backup/tasks.py`)
  - **Fabric CRUD** (via Django signals in `backend/san/signals.py`)

- ✅ **Automation**
  - Celery periodic task `core.auto_purge_audit_logs` runs daily at 2 AM
  - Configured in `backend/sanbox/settings_docker.py` CELERY_BEAT_SCHEDULE

#### Frontend
- ✅ **AuditLog Page** (`frontend/src/pages/AuditLog.jsx`)
  - Timeline view with manual refresh
  - Pagination (50 per page)
  - Filter support
  - Route: `/audit-log`

- ✅ **Components**
  - `AuditLogEntry.jsx` - Expandable log cards
  - `AuditLogFilters.jsx` - Sidebar filters
  - Theme-compliant CSS with Bootstrap overrides

- ✅ **Settings UI** (`frontend/src/pages/SettingsPage.js`)
  - Retention period configuration
  - Current log count display
  - Manual purge button

- ✅ **Navigation**
  - Added to Settings dropdown in navbar
  - Activity icon from lucide-react

---

## 🔄 IN PROGRESS / REMAINING WORK

### Django Signals Approach (RECOMMENDED)

**Why signals?** The Django signals approach is superior to view-based logging because:
- ✅ Captures ALL model saves/deletes regardless of code path
- ✅ Works with Django admin, shell, imports, direct saves, etc.
- ✅ Centralized logging logic
- ✅ No need to modify every view function
- ✅ Can't be bypassed

**Current Implementation**: Fabric logging via signals in `backend/san/signals.py`

### Models Needing CRUD Logging

#### SAN Module (`backend/san/`)
1. ✅ **Fabric** - COMPLETED (via signals)
2. ❌ **Zone** - TODO
3. ❌ **Alias** - TODO
4. ❌ **Switch** - TODO

#### Storage Module (`backend/storage/`)
5. ❌ **Storage System** - TODO
6. ❌ **Volume** - TODO
7. ❌ **Host** - TODO

---

## STEP-BY-STEP IMPLEMENTATION GUIDE

### Step 1: Add Signal Handlers for Zones

**File: `backend/san/signals.py`**

Add these signal handlers to the existing `signals.py` file:

```python
@receiver(post_save, sender=Zone)
def zone_post_save(sender, instance, created, **kwargs):
    """Log zone creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New zone created
        log_create(
            user=user,
            entity_type='ZONE',
            entity_name=instance.name,
            customer=instance.fabric.customer if instance.fabric else None,
            details={
                'fabric': instance.fabric.name if instance.fabric else None,
                'member_count': instance.members.count()
            }
        )
    else:
        # Existing zone updated
        log_update(
            user=user,
            entity_type='ZONE',
            entity_name=instance.name,
            customer=instance.fabric.customer if instance.fabric else None,
            details={}
        )


@receiver(pre_delete, sender=Zone)
def zone_pre_delete(sender, instance, **kwargs):
    """Log zone deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    log_delete(
        user=user,
        entity_type='ZONE',
        entity_name=instance.name,
        customer=instance.fabric.customer if instance.fabric else None,
        details={
            'fabric': instance.fabric.name if instance.fabric else None,
            'member_count': instance.members.count()
        }
    )
```

### Step 2: Add Signal Handlers for Aliases

**File: `backend/san/signals.py`** (same file, add to existing)

```python
@receiver(post_save, sender=Alias)
def alias_post_save(sender, instance, created, **kwargs):
    """Log alias creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New alias created
        log_create(
            user=user,
            entity_type='ALIAS',
            entity_name=instance.name,
            customer=instance.fabric.customer if instance.fabric else None,
            details={
                'fabric': instance.fabric.name if instance.fabric else None,
                'wwpn': instance.wwpn
            }
        )
    else:
        # Existing alias updated
        log_update(
            user=user,
            entity_type='ALIAS',
            entity_name=instance.name,
            customer=instance.fabric.customer if instance.fabric else None,
            details={}
        )


@receiver(pre_delete, sender=Alias)
def alias_pre_delete(sender, instance, **kwargs):
    """Log alias deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    log_delete(
        user=user,
        entity_type='ALIAS',
        entity_name=instance.name,
        customer=instance.fabric.customer if instance.fabric else None,
        details={
            'fabric': instance.fabric.name if instance.fabric else None,
            'wwpn': instance.wwpn
        }
    )
```

### Step 3: Add Signal Handlers for Switches

**File: `backend/san/signals.py`** (same file, add to existing)

```python
@receiver(post_save, sender=Switch)
def switch_post_save(sender, instance, created, **kwargs):
    """Log switch creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New switch created
        log_create(
            user=user,
            entity_type='SWITCH',
            entity_name=instance.name,
            customer=instance.customer,
            details={
                'san_vendor': instance.san_vendor,
                'model': instance.model,
                'ip_address': instance.ip_address
            }
        )
    else:
        # Existing switch updated
        log_update(
            user=user,
            entity_type='SWITCH',
            entity_name=instance.name,
            customer=instance.customer,
            details={}
        )


@receiver(pre_delete, sender=Switch)
def switch_pre_delete(sender, instance, **kwargs):
    """Log switch deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    # Get fabric count before deletion
    fabric_count = instance.fabrics.count() if hasattr(instance, 'fabrics') else 0

    log_delete(
        user=user,
        entity_type='SWITCH',
        entity_name=instance.name,
        customer=instance.customer,
        details={'fabrics_affected': fabric_count}
    )
```

### Step 4: Create Signals for Storage Models

**File: `backend/storage/signals.py`** (NEW FILE - create this)

```python
"""
Django signals for Storage models to trigger audit logging
"""

from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from .models import Storage, Volume, Host
from core.audit import log_create, log_update, log_delete


@receiver(post_save, sender=Storage)
def storage_post_save(sender, instance, created, **kwargs):
    """Log storage system creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New storage system created
        log_create(
            user=user,
            entity_type='STORAGE_SYSTEM',
            entity_name=instance.name,
            customer=instance.customer,
            details={
                'vendor': instance.vendor,
                'model': instance.model,
                'serial_number': instance.serial_number,
                'total_capacity_tb': float(instance.total_capacity_tb) if instance.total_capacity_tb else None
            }
        )
    else:
        # Existing storage system updated
        log_update(
            user=user,
            entity_type='STORAGE_SYSTEM',
            entity_name=instance.name,
            customer=instance.customer,
            details={}
        )


@receiver(pre_delete, sender=Storage)
def storage_pre_delete(sender, instance, **kwargs):
    """Log storage system deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    # Get volume and host counts before deletion
    volume_count = instance.volumes.count() if hasattr(instance, 'volumes') else 0
    host_count = instance.hosts.count() if hasattr(instance, 'hosts') else 0

    log_delete(
        user=user,
        entity_type='STORAGE_SYSTEM',
        entity_name=instance.name,
        customer=instance.customer,
        details={
            'volumes_affected': volume_count,
            'hosts_affected': host_count
        }
    )


@receiver(post_save, sender=Volume)
def volume_post_save(sender, instance, created, **kwargs):
    """Log volume creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New volume created
        log_create(
            user=user,
            entity_type='VOLUME',
            entity_name=instance.name,
            customer=instance.storage.customer if instance.storage else None,
            details={
                'storage': instance.storage.name if instance.storage else None,
                'capacity_gb': float(instance.capacity_gb) if instance.capacity_gb else None,
                'pool_name': instance.pool_name
            }
        )
    # NOTE: We skip logging individual volume updates to avoid massive log volume
    # Bulk volume updates are already logged at the import level


@receiver(pre_delete, sender=Volume)
def volume_pre_delete(sender, instance, **kwargs):
    """Log volume deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    log_delete(
        user=user,
        entity_type='VOLUME',
        entity_name=instance.name,
        customer=instance.storage.customer if instance.storage else None,
        details={
            'storage': instance.storage.name if instance.storage else None,
            'capacity_gb': float(instance.capacity_gb) if instance.capacity_gb else None
        }
    )


@receiver(post_save, sender=Host)
def host_post_save(sender, instance, created, **kwargs):
    """Log host creation and updates"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    if created:
        # New host created
        log_create(
            user=user,
            entity_type='HOST',
            entity_name=instance.name,
            customer=instance.storage.customer if instance.storage else None,
            details={
                'storage': instance.storage.name if instance.storage else None,
                'host_type': instance.host_type
            }
        )
    else:
        # Existing host updated
        log_update(
            user=user,
            entity_type='HOST',
            entity_name=instance.name,
            customer=instance.storage.customer if instance.storage else None,
            details={}
        )


@receiver(pre_delete, sender=Host)
def host_pre_delete(sender, instance, **kwargs):
    """Log host deletion"""
    from threading import local
    _thread_locals = local()
    user = getattr(_thread_locals, 'user', None)

    log_delete(
        user=user,
        entity_type='HOST',
        entity_name=instance.name,
        customer=instance.storage.customer if instance.storage else None,
        details={
            'storage': instance.storage.name if instance.storage else None
        }
    )
```

### Step 5: Register Storage Signals

**File: `backend/storage/apps.py`**

Update the StorageConfig class:

```python
from django.apps import AppConfig


class StorageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'storage'

    def ready(self):
        """Import signals when the app is ready"""
        import storage.signals  # noqa
```

### Step 6: Restart Backend

After adding all signals:

```bash
docker-compose -f docker-compose.dev.yml restart backend
```

---

## TESTING CHECKLIST

### Test Each Model Type

For **each model** (Fabric, Zone, Alias, Switch, Storage, Volume, Host):

1. **Create Test**
   - Create a new instance via the UI
   - Check audit log page for "Created {entity_type}: {name}" entry
   - Verify details are populated correctly
   - Verify customer is associated

2. **Update Test**
   - Edit an existing instance
   - Check audit log page for "Updated {entity_type}: {name}" entry

3. **Delete Test**
   - Delete an instance
   - Check audit log page for "Deleted {entity_type}: {name}" entry
   - Verify related counts (zones_affected, volumes_affected, etc.)

### Test Filters

1. Filter by Action Type (CREATE, UPDATE, DELETE)
2. Filter by Status (SUCCESS, FAILED)
3. Filter by Customer
4. Filter by Date Range
5. Test pagination

### Test Settings

1. Change retention period
2. Verify setting is saved (auto-save)
3. Click "Purge Old Logs Now"
4. Verify old logs are deleted
5. Check log count updates

---

## KNOWN ISSUES & SOLUTIONS

### Issue: User is NULL in Audit Logs

**Problem**: The signals use `threading.local()` to get the current user, but this may not always work.

**Solution**: Implement middleware to set the user in thread-local storage.

**File: `backend/core/middleware.py`** (create if doesn't exist)

```python
"""
Middleware for audit logging
"""

from threading import local

_thread_locals = local()


def get_current_user():
    """Get the current user from thread-local storage"""
    return getattr(_thread_locals, 'user', None)


class AuditLogMiddleware:
    """
    Middleware to store the current user in thread-local storage
    for use by Django signals
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Store the user in thread-local storage
        _thread_locals.user = getattr(request, 'user', None)

        response = self.get_response(request)

        # Clean up
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user

        return response
```

**Add to `backend/sanbox/settings_docker.py`:**

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.AuditLogMiddleware',  # ADD THIS LINE
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

**Update signals to use middleware:**

Replace this in ALL signal handlers:
```python
from threading import local
_thread_locals = local()
user = getattr(_thread_locals, 'user', None)
```

With this:
```python
from core.middleware import get_current_user
user = get_current_user()
```

---

## OPTIONAL ENHANCEMENTS

### 1. Bulk Operation Logging

For bulk deletes (e.g., delete 50 zones at once), you may want to aggregate:

```python
# In views.py or wherever bulk delete happens
log_delete(
    user=request.user,
    entity_type='ZONE',
    entity_name=f"{count} zones",  # Or use count directly
    customer=customer,
    details={
        'count': count,
        'fabric': fabric_name,
        'bulk_operation': True
    }
)
```

### 2. Configuration Change Logging

Add logging for important config changes:

```python
# In views where AppSettings is updated
log_config_change(
    user=request.user,
    config_type='SETTINGS',
    summary=f"Updated audit log retention period to {new_value} days",
    details={'old_value': old_value, 'new_value': new_value}
)
```

### 3. Export Logging

Add logging when users export data:

```python
# In export views
log_export(
    user=request.user,
    entity_type='ZONE',
    customer=customer,
    details={
        'format': 'CSV',
        'count': row_count
    }
)
```

---

## FILE LOCATIONS QUICK REFERENCE

### Backend Files
- **Models**: `backend/core/models.py` (AuditLog, AppSettings)
- **Audit Utility**: `backend/core/audit.py`
- **API Views**: `backend/core/views.py`
- **URL Config**: `backend/core/urls.py`
- **Celery Tasks**: `backend/core/tasks.py`
- **SAN Signals**: `backend/san/signals.py`
- **Storage Signals**: `backend/storage/signals.py` (create this)
- **Middleware**: `backend/core/middleware.py` (create this)

### Frontend Files
- **Main Page**: `frontend/src/pages/AuditLog.jsx`
- **Main CSS**: `frontend/src/pages/AuditLog.css`
- **Entry Component**: `frontend/src/components/audit/AuditLogEntry.jsx`
- **Entry CSS**: `frontend/src/components/audit/AuditLogEntry.css`
- **Filters Component**: `frontend/src/components/audit/AuditLogFilters.jsx`
- **Filters CSS**: `frontend/src/components/audit/AuditLogFilters.css`
- **Settings Page**: `frontend/src/pages/SettingsPage.js`
- **Navigation**: `frontend/src/components/navigation/UserSection.js`
- **App Routes**: `frontend/src/App.js`

---

## COMPLETION CRITERIA

The audit logging system is COMPLETE when:

- ✅ All 7 model types log create/update/delete operations
- ✅ Logs appear in the Activity Log page (`/audit-log`)
- ✅ Filters work correctly
- ✅ Pagination works
- ✅ Manual purge works
- ✅ Automatic daily purge works (check logs at 2 AM)
- ✅ Retention period setting is editable
- ✅ All logs include correct user information
- ✅ All logs include correct customer association
- ✅ Detail fields are populated appropriately
- ✅ Works in all three themes (Light, Dark, Dark+)

---

## TROUBLESHOOTING

### Logs Not Appearing

1. Check if signals are registered:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
   >>> from django.db.models import signals
   >>> from san.models import Fabric
   >>> signals.post_save.has_listeners(Fabric)
   True  # Should return True
   ```

2. Check for signal errors:
   ```bash
   docker-compose -f docker-compose.dev.yml logs backend | grep -i error
   ```

3. Check database:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "from core.models import AuditLog; print(AuditLog.objects.count())"
   ```

### User is NULL

- Implement the middleware solution (see "Known Issues" section above)

### Performance Issues

- If logs grow too large, reduce retention period
- Run manual purge: POST to `/api/core/audit-log/purge/`
- Check Celery is running: `docker-compose -f docker-compose.dev.yml logs celery`

---

## NEXT STEPS PRIORITY

1. **Implement middleware** (CRITICAL - fixes NULL user issue)
2. **Add Zone signals** (high-value, frequently modified)
3. **Add Alias signals** (high-value, frequently modified)
4. **Add Storage System signals** (high-value)
5. **Add Switch signals** (medium-value)
6. **Add Host signals** (medium-value)
7. **Add Volume signals** (low-value - may create too many logs)

---

## ESTIMATED TIME TO COMPLETE

- Middleware implementation: 15 minutes
- Each model signal implementation: 10 minutes
- Testing each model: 5 minutes
- **Total estimated time**: 2-3 hours

---

## SUCCESS METRICS

After full implementation, you should see audit logs for:
- User login/logout activities
- All import operations (SAN & Storage)
- All backup/restore operations
- All CRUD operations on Fabrics, Zones, Aliases, Switches
- All CRUD operations on Storage Systems, Hosts
- Volume creates/deletes (updates skipped to avoid log spam)

The Activity Log page should provide full transparency into:
- WHO did WHAT
- WHEN it happened
- WHICH customer was affected
- WHAT the results were

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Status**: Fabric logging implemented via signals; remaining models pending
