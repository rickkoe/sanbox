#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings')
django.setup()

from storage.models import Host, HostWwpn

print('Verifying HostWwpn objects in database:')
print('=' * 50)

# Get all HostWwpn objects
all_wwpns = HostWwpn.objects.all().order_by('host__name', 'wwpn')

print(f'Total HostWwpn objects: {all_wwpns.count()}')
print()

current_host = None
for wwpn_obj in all_wwpns:
    if current_host != wwpn_obj.host.name:
        current_host = wwpn_obj.host.name
        print(f'Host: {current_host}')
    
    print(f'  - WWPN: {wwpn_obj.wwpn}')
    print(f'    Source: {wwpn_obj.source_type}')
    print(f'    Created: {wwpn_obj.created_at}')
    print(f'    Storage: {wwpn_obj.host.storage.name if wwpn_obj.host.storage else "None"}')
    print()

# Test that the old wwpns field is empty/None
hosts_with_old_wwpns = Host.objects.exclude(wwpns__isnull=True).exclude(wwpns='')
print(f'Hosts with old wwpns field populated: {hosts_with_old_wwpns.count()}')
if hosts_with_old_wwpns.exists():
    print('WARNING: Some hosts still have data in the old wwpns field!')
    for host in hosts_with_old_wwpns:
        print(f'  {host.name}: {host.wwpns}')
else:
    print('✅ Old wwpns field is clean (empty/null)')

print('\n✅ HostWwpn verification completed!')