#!/usr/bin/env python3
"""
Script to populate HostWwpn records from existing alias-to-host relationships.
Run this after adding the HostWwpn model to sync existing data.
"""

import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings')
django.setup()

from storage.models import HostWwpn
from san.models import Alias

def populate_host_wwpns():
    """Create HostWwpn records for all existing alias-to-host relationships."""
    
    print("🔄 Starting HostWwpn population from existing aliases...")
    
    # Get all aliases that have both a host and a wwpn assigned
    aliases_with_hosts = Alias.objects.filter(
        host__isnull=False,
        wwpn__isnull=False
    ).exclude(wwpn='')
    
    print(f"📊 Found {aliases_with_hosts.count()} aliases with hosts and WWPNs")
    
    created_count = 0
    updated_count = 0
    error_count = 0
    
    for alias in aliases_with_hosts:
        try:
            # Try to create or update the HostWwpn record
            host_wwpn, created = HostWwpn.objects.get_or_create(
                host=alias.host,
                wwpn=alias.wwpn,
                defaults={
                    'source_type': 'alias',
                    'source_alias': alias
                }
            )
            
            if created:
                created_count += 1
                print(f"✅ Created: {alias.host.name} -> {alias.wwpn} (from alias: {alias.name})")
            else:
                # Update existing record to ensure it points to the correct alias
                if host_wwpn.source_type != 'alias' or host_wwpn.source_alias != alias:
                    host_wwpn.source_type = 'alias'
                    host_wwpn.source_alias = alias
                    host_wwpn.save()
                    updated_count += 1
                    print(f"🔄 Updated: {alias.host.name} -> {alias.wwpn} (from alias: {alias.name})")
                else:
                    print(f"⏭️  Skipped: {alias.host.name} -> {alias.wwpn} (already exists)")
                    
        except Exception as e:
            error_count += 1
            print(f"❌ Error processing alias {alias.name}: {e}")
    
    print(f"\n📈 Population Summary:")
    print(f"   ✅ Created: {created_count} new HostWwpn records")
    print(f"   🔄 Updated: {updated_count} existing HostWwpn records")  
    print(f"   ❌ Errors: {error_count}")
    print(f"   📊 Total processed: {aliases_with_hosts.count()} aliases")
    
    # Verify the results
    total_host_wwpns = HostWwpn.objects.count()
    alias_sourced_wwpns = HostWwpn.objects.filter(source_type='alias').count()
    manual_wwpns = HostWwpn.objects.filter(source_type='manual').count()
    
    print(f"\n🔍 Final HostWwpn Statistics:")
    print(f"   📊 Total HostWwpn records: {total_host_wwpns}")
    print(f"   🔗 From aliases: {alias_sourced_wwpns}")
    print(f"   ✏️  Manual: {manual_wwpns}")
    
    return created_count, updated_count, error_count

if __name__ == "__main__":
    try:
        created, updated, errors = populate_host_wwpns()
        if errors == 0:
            print("\n🎉 Population completed successfully!")
        else:
            print(f"\n⚠️  Population completed with {errors} errors.")
            
    except Exception as e:
        print(f"\n💥 Fatal error during population: {e}")
        raise