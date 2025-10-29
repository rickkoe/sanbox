"""
Celery tasks for core app
"""

from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .models import AuditLog, AppSettings
from .audit import log_audit_event


@shared_task(name='core.auto_purge_audit_logs')
def auto_purge_audit_logs_task():
    """
    Automatically purge old audit logs based on retention policy.
    This task runs daily at 2 AM (configured in Celery beat schedule).

    Returns:
        dict: Summary of purge operation
    """
    try:
        # Get retention setting
        settings = AppSettings.get_settings()
        retention_days = settings.audit_log_retention_days

        # Calculate cutoff date
        cutoff_date = timezone.now() - timedelta(days=retention_days)

        # Delete old logs
        old_logs = AuditLog.objects.filter(timestamp__lt=cutoff_date)
        deleted_count = old_logs.count()

        if deleted_count > 0:
            old_logs.delete()

            # Log the purge action (using system/None user for automatic tasks)
            log_audit_event(
                user=None,
                action_type='DELETE',
                entity_type='SETTINGS',
                summary=f"Automatic purge: Deleted {deleted_count} audit logs older than {retention_days} days",
                details={
                    'deleted_count': deleted_count,
                    'retention_days': retention_days,
                    'cutoff_date': cutoff_date.isoformat(),
                    'automatic': True
                }
            )

            print(f"✅ Auto-purge complete: Deleted {deleted_count} audit logs older than {retention_days} days")
        else:
            print(f"✅ Auto-purge: No audit logs to delete (retention: {retention_days} days)")

        return {
            'success': True,
            'deleted_count': deleted_count,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date.isoformat()
        }

    except Exception as e:
        print(f"❌ Error in auto_purge_audit_logs_task: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }
