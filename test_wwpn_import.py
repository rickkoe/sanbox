#!/usr/bin/env python3
"""
Test script to verify WWPN import functionality
Run this from the backend directory after activating virtual environment
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings')
django.setup()

from django.db import transaction
from customers.models import Customer
from core.models import Project, Config
from storage.models import Host, HostWwpn
from importer.services import SimpleStorageImporter

def test_wwpn_parsing():
    """Test the WWPN parsing functionality"""
    
    # Create test customer and project
    with transaction.atomic():
        customer, created = Customer.objects.get_or_create(
            name="Test Customer",
            defaults={
                'insights_tenant': 'test_tenant',
                'insights_api_key': 'test_key'
            }
        )
        
        project, created = Project.objects.get_or_create(
            name="Test Project",
            customer=customer
        )
        
        config, created = Config.objects.get_or_create(
            customer=customer,
            defaults={'active_project': project}
        )
        
        # Create importer instance
        importer = SimpleStorageImporter(customer)
        
        # Test different WWPN formats
        test_cases = [
            {
                'name': 'String format (comma-separated)',
                'wwpns': 'C050760C392D0076,C050760C392D0077',
                'expected_count': 2
            },
            {
                'name': 'List format (formatted)',
                'wwpns': ['10:00:00:05:1e:12:34:56', '10:00:00:05:1e:12:34:57'],
                'expected_count': 2
            },
            {
                'name': 'List format (unformatted)',
                'wwpns': ['1000000051e123456', '1000000051e123457'],
                'expected_count': 2
            },
            {
                'name': 'Single WWPN string',
                'wwpns': 'C050760C392D0078',
                'expected_count': 1
            },
            {
                'name': 'Empty data',
                'wwpns': [],
                'expected_count': 0
            }
        ]
        
        print("Testing WWPN parsing functionality:")
        print("=" * 50)
        
        for i, test_case in enumerate(test_cases):
            print(f"\nTest {i+1}: {test_case['name']}")
            print(f"Input: {test_case['wwpns']}")
            
            # Parse WWPNs
            parsed_wwpns = importer._parse_individual_wwpns(test_case['wwpns'])
            
            print(f"Parsed: {parsed_wwpns}")
            print(f"Count: {len(parsed_wwpns)} (expected: {test_case['expected_count']})")
            
            if len(parsed_wwpns) == test_case['expected_count']:
                print("✅ PASS")
            else:
                print("❌ FAIL")
            
            # Validate WWPN format
            for wwpn in parsed_wwpns:
                if len(wwpn) == 23 and wwpn.count(':') == 7:
                    print(f"   ✅ Valid format: {wwpn}")
                else:
                    print(f"   ❌ Invalid format: {wwpn}")
        
        print("\n" + "=" * 50)
        print("WWPN parsing test completed!")

def test_host_wwpn_creation():
    """Test actual HostWwpn object creation"""
    
    print("\nTesting HostWwpn object creation:")
    print("=" * 50)
    
    try:
        # Get or create test data
        customer = Customer.objects.get(name="Test Customer")
        project = Project.objects.get(name="Test Project", customer=customer)
        
        # Create a test host
        host, created = Host.objects.get_or_create(
            name="TestHost_WWPN",
            project=project,
            defaults={'create': False}
        )
        
        print(f"Host: {host.name} (created: {created})")
        
        # Clear existing WWPNs
        existing_count = HostWwpn.objects.filter(host=host).count()
        if existing_count > 0:
            HostWwpn.objects.filter(host=host).delete()
            print(f"Cleared {existing_count} existing WWPNs")
        
        # Create importer and test WWPN creation
        importer = SimpleStorageImporter(customer)
        
        # Mock import record for logging
        from importer.models import StorageImport
        import_record = StorageImport.objects.create(
            customer=customer,
            status='running'
        )
        importer.import_record = import_record
        
        # Test WWPN creation
        test_wwpns = 'C050760C392D0076,C050760C392D0077,1000000051e123456'
        created_count = importer._create_host_wwpns(host, test_wwpns)
        
        print(f"Created {created_count} HostWwpn objects")
        
        # Verify in database
        host_wwpns = HostWwpn.objects.filter(host=host)
        print(f"Database count: {host_wwpns.count()}")
        
        for hw in host_wwpns:
            print(f"   - {hw.wwpn} (source: {hw.source_type})")
        
        # Test host's get_all_wwpns method
        all_wwpns = host.get_all_wwpns()
        print(f"Host.get_all_wwpns() returned {len(all_wwpns)} WWPNs:")
        for wwpn_info in all_wwpns:
            print(f"   - {wwpn_info['wwpn']} (source: {wwpn_info['source_type']})")
        
        # Test display string
        display_string = host.get_wwpn_display_string()
        print(f"Display string: {display_string}")
        
        print("✅ HostWwpn creation test completed successfully!")
        
        # Clean up
        import_record.delete()
        
    except Exception as e:
        print(f"❌ Error during HostWwpn creation test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("Starting WWPN import functionality tests...")
    
    try:
        test_wwpn_parsing()
        test_host_wwpn_creation()
        
        print("\n🎉 All tests completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)