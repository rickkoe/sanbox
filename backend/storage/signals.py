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
        
        # Create or update the HostWwpn record
        host_wwpn, created = HostWwpn.objects.get_or_create(
            host=instance.host,
            wwpn=instance.wwpn,
            defaults={
                'source_type': 'alias',
                'source_alias': instance
            }
        )
        
        # If it already existed but wasn't from this alias, update it
        if not created:
            if host_wwpn.source_type != 'alias' or host_wwpn.source_alias != instance:
                # This WWPN was manually assigned, but now an alias claims it
                # Update to reference the alias (alias takes precedence)
                host_wwpn.source_type = 'alias'
                host_wwpn.source_alias = instance
                host_wwpn.save()

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