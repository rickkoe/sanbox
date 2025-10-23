"""
Celery tasks for backup and restore operations
"""

from celery import shared_task
from django.utils import timezone
from .models import BackupRecord, RestoreRecord
from .service import BackupService, RestoreService


@shared_task(bind=True)
def create_backup_task(self, backup_id, include_media=False):
    """
    Celery task to create a database backup

    Args:
        backup_id: ID of BackupRecord
        include_media: Whether to include media files

    Returns:
        dict: Result information
    """
    try:
        backup = BackupRecord.objects.get(id=backup_id)
        service = BackupService(backup)

        # Update task progress
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 10,
                'total': 100,
                'status': 'Starting backup...',
                'backup_id': backup_id
            }
        )

        # Create backup
        success, error = service.create_backup(include_media=include_media)

        if success:
            return {
                'status': 'completed',
                'backup_id': backup_id,
                'name': backup.name,
                'size_mb': backup.size_mb,
                'duration': str(backup.duration)
            }
        else:
            return {
                'status': 'failed',
                'backup_id': backup_id,
                'error': error
            }

    except BackupRecord.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Backup record {backup_id} not found'
        }
    except Exception as e:
        return {
            'status': 'failed',
            'backup_id': backup_id,
            'error': str(e)
        }


@shared_task(bind=True)
def restore_backup_task(self, restore_id):
    """
    Celery task to restore a database from backup

    Args:
        restore_id: ID of RestoreRecord

    Returns:
        dict: Result information
    """
    try:
        restore = RestoreRecord.objects.get(id=restore_id)
        service = RestoreService(restore)

        # Update task progress
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 10,
                'total': 100,
                'status': 'Validating backup...',
                'restore_id': restore_id
            }
        )

        # Perform restore
        success, error = service.restore_backup()

        if success:
            return {
                'status': 'completed',
                'restore_id': restore_id,
                'backup_name': restore.backup.name,
                'duration': str(restore.duration)
            }
        else:
            return {
                'status': 'failed',
                'restore_id': restore_id,
                'error': error
            }

    except RestoreRecord.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Restore record {restore_id} not found'
        }
    except Exception as e:
        return {
            'status': 'failed',
            'restore_id': restore_id,
            'error': str(e)
        }


@shared_task(bind=True)
def verify_backup_task(self, backup_id):
    """
    Celery task to verify a backup

    Args:
        backup_id: ID of BackupRecord

    Returns:
        dict: Result information
    """
    try:
        backup = BackupRecord.objects.get(id=backup_id)
        service = BackupService(backup)

        # Verify backup
        success, error = service.verify_backup()

        if success:
            return {
                'status': 'verified',
                'backup_id': backup_id,
                'name': backup.name
            }
        else:
            return {
                'status': 'failed',
                'backup_id': backup_id,
                'error': error
            }

    except BackupRecord.DoesNotExist:
        return {
            'status': 'failed',
            'error': f'Backup record {backup_id} not found'
        }
    except Exception as e:
        return {
            'status': 'failed',
            'backup_id': backup_id,
            'error': str(e)
        }


@shared_task
def auto_backup_task():
    """
    Scheduled task for automatic backups
    Called by Celery Beat at the top of every hour
    Checks if it should run based on configuration (hourly or daily)
    """
    from .models import BackupConfiguration
    from datetime import datetime, timedelta
    from django.utils import timezone
    from zoneinfo import ZoneInfo

    try:
        config = BackupConfiguration.get_config()

        if not config.auto_backup_enabled:
            return {'status': 'skipped', 'reason': 'auto backup disabled'}

        # Get current time in server's local timezone
        # Django stores times in UTC, but scheduled hour is in local time
        server_tz = ZoneInfo('America/Chicago')  # Match CELERY_TIMEZONE
        now_utc = timezone.now()
        now_local = now_utc.astimezone(server_tz)
        current_hour = now_local.hour

        # For daily frequency, only run at the configured hour
        if config.auto_backup_frequency == 'daily':
            if current_hour != config.auto_backup_hour:
                return {
                    'status': 'skipped',
                    'reason': f'daily backup: current hour {current_hour} (local) != configured hour {config.auto_backup_hour}',
                    'current_time_utc': str(now_utc),
                    'current_time_local': str(now_local)
                }

        # Check if a backup has already been created this hour
        # to avoid duplicates if the task runs multiple times
        # Use local time for the range check
        hour_start_local = now_local.replace(minute=0, second=0, microsecond=0)
        hour_end_local = hour_start_local + timedelta(hours=1)

        # Convert back to UTC for database query (Django stores in UTC)
        utc_tz = ZoneInfo('UTC')
        hour_start_utc = hour_start_local.astimezone(utc_tz)
        hour_end_utc = hour_end_local.astimezone(utc_tz)

        existing_backup = BackupRecord.objects.filter(
            created_at__gte=hour_start_utc,
            created_at__lt=hour_end_utc,
            description__contains="Scheduled automatic backup"
        ).exists()

        if existing_backup:
            return {
                'status': 'skipped',
                'reason': 'backup already created for this hour'
            }

        # Create backup record
        backup = BackupRecord.objects.create(
            name=f"Automatic Backup - {now_local.strftime('%Y-%m-%d %H:%M')}",
            description="Scheduled automatic backup",
            backup_type='full',
            django_version='',  # Will be filled by service
            python_version='',
            migration_state={},
            installed_apps=[]
        )

        # Start backup task
        task = create_backup_task.delay(
            backup.id,
            include_media=config.auto_backup_include_media
        )

        backup.celery_task_id = task.id
        backup.save()

        return {
            'status': 'started',
            'backup_id': backup.id,
            'task_id': task.id,
            'scheduled_hour': config.auto_backup_hour
        }

    except Exception as e:
        return {
            'status': 'failed',
            'error': str(e)
        }
