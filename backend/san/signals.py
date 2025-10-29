"""
Django signals for SAN models to trigger audit logging
"""

from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from .models import Fabric, Zone, Alias, Switch
from core.audit import log_create, log_update, log_delete


@receiver(post_save, sender=Fabric)
def fabric_post_save(sender, instance, created, **kwargs):
    """Log fabric creation and updates"""
    from core.middleware import get_current_user
    user = get_current_user()

    if created:
        # New fabric created
        log_create(
            user=user,
            entity_type='FABRIC',
            entity_name=instance.name,
            customer=instance.customer,
            details={
                'zoneset_name': instance.zoneset_name,
                'vsan': instance.vsan,
                'san_vendor': instance.san_vendor
            }
        )
    elif kwargs.get('update_fields') is not None:
        # Existing fabric updated (only log if explicit field update)
        log_update(
            user=user,
            entity_type='FABRIC',
            entity_name=instance.name,
            customer=instance.customer,
            details={}
        )


@receiver(pre_delete, sender=Fabric)
def fabric_pre_delete(sender, instance, **kwargs):
    """Log fabric deletion (using pre_delete to access related data)"""
    from core.middleware import get_current_user
    user = get_current_user()

    # Get zone count before deletion
    zone_count = instance.zones.count() if hasattr(instance, 'zones') else 0

    log_delete(
        user=user,
        entity_type='FABRIC',
        entity_name=instance.name,
        customer=instance.customer,
        details={'zones_affected': zone_count}
    )


@receiver(post_save, sender=Zone)
def zone_post_save(sender, instance, created, **kwargs):
    """Log zone creation (updates not logged to avoid log spam)"""
    from core.middleware import get_current_user
    user = get_current_user()

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
    # Note: Updates not logged - zones change frequently and would flood the audit log


@receiver(pre_delete, sender=Zone)
def zone_pre_delete(sender, instance, **kwargs):
    """Log zone deletion"""
    from core.middleware import get_current_user
    user = get_current_user()

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


@receiver(post_save, sender=Alias)
def alias_post_save(sender, instance, created, **kwargs):
    """Log alias creation (updates not logged to avoid log spam)"""
    from core.middleware import get_current_user
    user = get_current_user()

    if created:
        # New alias created
        log_create(
            user=user,
            entity_type='ALIAS',
            entity_name=instance.name,
            customer=instance.fabric.customer if instance.fabric else None,
            details={
                'fabric': instance.fabric.name if instance.fabric else None
            }
        )
    # Note: Updates not logged - aliases change frequently and would flood the audit log


@receiver(pre_delete, sender=Alias)
def alias_pre_delete(sender, instance, **kwargs):
    """Log alias deletion"""
    from core.middleware import get_current_user
    user = get_current_user()

    log_delete(
        user=user,
        entity_type='ALIAS',
        entity_name=instance.name,
        customer=instance.fabric.customer if instance.fabric else None,
        details={
            'fabric': instance.fabric.name if instance.fabric else None
        }
    )


@receiver(post_save, sender=Switch)
def switch_post_save(sender, instance, created, **kwargs):
    """Log switch creation and updates"""
    from core.middleware import get_current_user
    user = get_current_user()

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
    elif kwargs.get('update_fields') is not None:
        # Existing switch updated (only log if explicit field update)
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
    from core.middleware import get_current_user
    user = get_current_user()

    # Get fabric count before deletion
    fabric_count = instance.fabrics.count() if hasattr(instance, 'fabrics') else 0

    log_delete(
        user=user,
        entity_type='SWITCH',
        entity_name=instance.name,
        customer=instance.customer,
        details={'fabrics_affected': fabric_count}
    )
