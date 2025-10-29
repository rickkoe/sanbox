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
    from core.middleware import get_current_user
    user = get_current_user()

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
    elif kwargs.get('update_fields') is not None:
        # Existing storage system updated (only log if explicit field update)
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
    from core.middleware import get_current_user
    user = get_current_user()

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
    from core.middleware import get_current_user
    user = get_current_user()

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
    from core.middleware import get_current_user
    user = get_current_user()

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
    """Log host creation (updates not logged to avoid log spam)"""
    from core.middleware import get_current_user
    user = get_current_user()

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
    # Note: Updates not logged - hosts change frequently and would flood the audit log


@receiver(pre_delete, sender=Host)
def host_pre_delete(sender, instance, **kwargs):
    """Log host deletion"""
    from core.middleware import get_current_user
    user = get_current_user()

    log_delete(
        user=user,
        entity_type='HOST',
        entity_name=instance.name,
        customer=instance.storage.customer if instance.storage else None,
        details={
            'storage': instance.storage.name if instance.storage else None
        }
    )
