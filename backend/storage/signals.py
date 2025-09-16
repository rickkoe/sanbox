from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.apps import apps

@receiver(post_save, sender='san.Alias')
def sync_alias_wwpn_to_host(sender, instance, created, **kwargs):
    """
    When an alias is saved with a host assignment, create/update the corresponding HostWwpn
    """
    if instance.host and instance.wwpn:
        # Get the HostWwpn model to avoid circular imports
        HostWwpn = apps.get_model('storage', 'HostWwpn')
        
        # First, remove any existing manual records for this WWPN on this host
        # This ensures alias records take precedence over manual ones
        manual_records = HostWwpn.objects.filter(
            host=instance.host,
            wwpn=instance.wwpn,
            source_type='manual'
        )
        
        if manual_records.exists():
            count = manual_records.count()
            manual_records.delete()
            print(f"🗑️ Removed {count} manual WWPN record(s) for {instance.wwpn} on host {instance.host.name} (replaced by alias)")
        
        # Create or update the HostWwpn record for this alias
        host_wwpn, created = HostWwpn.objects.get_or_create(
            host=instance.host,
            wwpn=instance.wwpn,
            source_type='alias',
            source_alias=instance,
            defaults={
                'source_type': 'alias',
                'source_alias': instance
            }
        )
        
        if created:
            print(f"✅ Created new HostWwpn for alias {instance.name} -> host {instance.host.name} (WWPN: {instance.wwpn})")
        else:
            print(f"🔄 HostWwpn already exists for alias {instance.name} -> host {instance.host.name} (WWPN: {instance.wwpn})")

@receiver(pre_save, sender='san.Alias')
def handle_alias_host_change(sender, instance, **kwargs):
    """
    Handle cases where an alias changes its host assignment or WWPN
    """
    if instance.pk:  # Only for existing aliases
        try:
            # Get the old version from the database
            old_alias = sender.objects.get(pk=instance.pk)
            HostWwpn = apps.get_model('storage', 'HostWwpn')
            
            # If the host or WWPN changed, clean up the old HostWwpn
            if (old_alias.host != instance.host) or (old_alias.wwpn != instance.wwpn):
                if old_alias.host and old_alias.wwpn:
                    HostWwpn.objects.filter(
                        host=old_alias.host,
                        wwpn=old_alias.wwpn,
                        source_type='alias',
                        source_alias=old_alias
                    ).delete()
        except sender.DoesNotExist:
            # Alias doesn't exist yet, this is a new creation
            pass

@receiver(post_delete, sender='san.Alias')
def remove_alias_wwpn_from_host(sender, instance, **kwargs):
    """
    When an alias is deleted, remove the corresponding HostWwpn if it was sourced from this alias
    """
    if instance.host and instance.wwpn:
        HostWwpn = apps.get_model('storage', 'HostWwpn')
        
        # Remove the HostWwpn record that was sourced from this alias
        HostWwpn.objects.filter(
            host=instance.host,
            wwpn=instance.wwpn,
            source_type='alias',
            source_alias=instance
        ).delete()