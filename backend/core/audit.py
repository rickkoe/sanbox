"""
Audit Logging Utility

Provides helper functions for creating audit log entries throughout the application.
Logs user actions at the operation level, not per-object granularity.
"""

from .models import AuditLog
from django.contrib.auth.models import User
from customers.models import Customer


def get_client_ip(request):
    """
    Extract client IP address from request.
    Handles proxies and load balancers by checking X-Forwarded-For header.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For can be a comma-separated list, take the first IP
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_audit_event(
    user,
    action_type,
    summary,
    entity_type=None,
    entity_name=None,
    customer=None,
    details=None,
    status='SUCCESS',
    duration_seconds=None,
    ip_address=None
):
    """
    Create an audit log entry.

    Args:
        user: User who performed the action (can be User object, user ID, or None for system actions)
        action_type: Type of action (LOGIN, LOGOUT, IMPORT, BACKUP, RESTORE, CREATE, UPDATE, DELETE, EXPORT, CONFIG_CHANGE)
        summary: Human-readable summary of the action
        entity_type: Type of entity affected (optional)
        entity_name: Name of specific entity affected (optional)
        customer: Customer this action affects (can be Customer object or ID, optional)
        details: Dictionary of additional details (counts, errors, etc., optional)
        status: Status of the action (SUCCESS, FAILED, CANCELLED, IN_PROGRESS)
        duration_seconds: Duration of the action in seconds (optional)
        ip_address: IP address of the user (optional)

    Returns:
        AuditLog object
    """
    # Handle user parameter
    if isinstance(user, int):
        try:
            user = User.objects.get(id=user)
        except User.DoesNotExist:
            user = None
    elif user and not getattr(user, 'is_authenticated', False):
        # Handle AnonymousUser or unauthenticated users
        user = None

    # Handle customer parameter
    if isinstance(customer, int):
        try:
            customer = Customer.objects.get(id=customer)
        except Customer.DoesNotExist:
            customer = None

    # Create audit log entry
    audit_log = AuditLog.objects.create(
        user=user,
        action_type=action_type,
        entity_type=entity_type,
        entity_name=entity_name,
        customer=customer,
        summary=summary,
        details=details or {},
        status=status,
        duration_seconds=duration_seconds,
        ip_address=ip_address
    )

    return audit_log


def log_login(user, request, status='SUCCESS'):
    """
    Log a user login action.

    Args:
        user: User who logged in
        request: HTTP request object (for IP address extraction)
        status: Login status (SUCCESS or FAILED)
    """
    ip_address = get_client_ip(request) if request else None

    return log_audit_event(
        user=user,
        action_type='LOGIN',
        summary=f"User {user.username} logged in",
        ip_address=ip_address,
        status=status
    )


def log_logout(user, request, session_duration=None):
    """
    Log a user logout action.

    Args:
        user: User who logged out
        request: HTTP request object (for IP address extraction)
        session_duration: Duration of the session in seconds (optional)
    """
    ip_address = get_client_ip(request) if request else None
    details = {}
    if session_duration:
        details['session_duration'] = session_duration

    return log_audit_event(
        user=user,
        action_type='LOGOUT',
        summary=f"User {user.username} logged out",
        ip_address=ip_address,
        duration_seconds=session_duration,
        details=details
    )


def log_import(user, customer, import_type, summary, details, status='SUCCESS', duration_seconds=None):
    """
    Log a data import action.

    Args:
        user: User who initiated the import
        customer: Customer affected by the import
        import_type: Type of import (SAN, STORAGE, etc.)
        summary: Human-readable summary
        details: Dictionary with import stats (zones_created, aliases_created, etc.)
        status: Import status (SUCCESS, FAILED, CANCELLED, IN_PROGRESS)
        duration_seconds: Duration of the import
    """
    return log_audit_event(
        user=user,
        action_type='IMPORT',
        entity_type=import_type,
        customer=customer,
        summary=summary,
        details=details,
        status=status,
        duration_seconds=duration_seconds
    )


def log_backup(user, backup_name, size_mb=None, status='SUCCESS', duration_seconds=None, details=None):
    """
    Log a database backup action.

    Args:
        user: User who initiated the backup
        backup_name: Name of the backup file
        size_mb: Size of the backup in MB (optional)
        status: Backup status (SUCCESS, FAILED, IN_PROGRESS)
        duration_seconds: Duration of the backup
        details: Additional details (optional)
    """
    summary = f"Created database backup: {backup_name}"
    if size_mb:
        summary += f" ({size_mb:.2f} MB)"

    backup_details = details or {}
    if size_mb:
        backup_details['size_mb'] = size_mb

    return log_audit_event(
        user=user,
        action_type='BACKUP',
        entity_type='BACKUP',
        entity_name=backup_name,
        summary=summary,
        details=backup_details,
        status=status,
        duration_seconds=duration_seconds
    )


def log_restore(user, backup_name, status='SUCCESS', duration_seconds=None, details=None):
    """
    Log a database restore action.

    Args:
        user: User who initiated the restore
        backup_name: Name of the backup file being restored
        status: Restore status (SUCCESS, FAILED, IN_PROGRESS)
        duration_seconds: Duration of the restore
        details: Additional details (pre_restore_backup created, etc.)
    """
    summary = f"Restored database from backup: {backup_name}"

    return log_audit_event(
        user=user,
        action_type='RESTORE',
        entity_type='BACKUP',
        entity_name=backup_name,
        summary=summary,
        details=details or {},
        status=status,
        duration_seconds=duration_seconds
    )


def log_create(user, entity_type, entity_name, customer=None, details=None):
    """
    Log a create action.

    Args:
        user: User who created the entity
        entity_type: Type of entity (FABRIC, ZONE, ALIAS, STORAGE_SYSTEM, etc.)
        entity_name: Name of the entity created
        customer: Customer affected (optional)
        details: Additional details (optional)
    """
    summary = f"Created {entity_type.lower()}: {entity_name}"

    return log_audit_event(
        user=user,
        action_type='CREATE',
        entity_type=entity_type,
        entity_name=entity_name,
        customer=customer,
        summary=summary,
        details=details or {}
    )


def log_update(user, entity_type, entity_name, customer=None, details=None):
    """
    Log an update action.

    Args:
        user: User who updated the entity
        entity_type: Type of entity (FABRIC, ZONE, ALIAS, STORAGE_SYSTEM, etc.)
        entity_name: Name of the entity updated
        customer: Customer affected (optional)
        details: Additional details (fields changed, etc.)
    """
    summary = f"Updated {entity_type.lower()}: {entity_name}"

    return log_audit_event(
        user=user,
        action_type='UPDATE',
        entity_type=entity_type,
        entity_name=entity_name,
        customer=customer,
        summary=summary,
        details=details or {}
    )


def log_delete(user, entity_type, entity_name, customer=None, details=None):
    """
    Log a delete action.

    Args:
        user: User who deleted the entity
        entity_type: Type of entity (FABRIC, ZONE, ALIAS, STORAGE_SYSTEM, etc.)
        entity_name: Name of the entity deleted (or count if bulk delete)
        customer: Customer affected (optional)
        details: Additional details (count for bulk delete, etc.)
    """
    if isinstance(entity_name, int) or (details and 'count' in details):
        # Bulk delete
        count = entity_name if isinstance(entity_name, int) else details['count']
        summary = f"Deleted {count} {entity_type.lower()}(s)"
    else:
        summary = f"Deleted {entity_type.lower()}: {entity_name}"

    return log_audit_event(
        user=user,
        action_type='DELETE',
        entity_type=entity_type,
        entity_name=str(entity_name) if not isinstance(entity_name, int) else None,
        customer=customer,
        summary=summary,
        details=details or {}
    )


def log_export(user, entity_type, customer=None, details=None):
    """
    Log a data export action.

    Args:
        user: User who exported data
        entity_type: Type of entity exported
        customer: Customer affected (optional)
        details: Additional details (format, row count, etc.)
    """
    summary = f"Exported {entity_type.lower()} data"
    if details and 'count' in details:
        summary += f" ({details['count']} rows)"

    return log_audit_event(
        user=user,
        action_type='EXPORT',
        entity_type=entity_type,
        customer=customer,
        summary=summary,
        details=details or {}
    )


def log_config_change(user, config_type, summary, details=None):
    """
    Log a configuration change.

    Args:
        user: User who changed the configuration
        config_type: Type of configuration (CREDENTIALS, SETTINGS, etc.)
        summary: Human-readable summary of the change
        details: Additional details (fields changed, etc.)
    """
    return log_audit_event(
        user=user,
        action_type='CONFIG_CHANGE',
        entity_type=config_type,
        summary=summary,
        details=details or {}
    )
