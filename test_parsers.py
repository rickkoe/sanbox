#!/usr/bin/env python
"""
Test script to verify parser improvements for Universal Importer
Tests Cisco and Brocade parsers with example files
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings_docker')

import django
django.setup()

from importer.parsers.cisco_parser import CiscoParser
from importer.parsers.brocade_parser import BrocadeParser


def test_cisco_parser():
    """Test Cisco parser with example file"""
    print("\n" + "="*80)
    print("TESTING CISCO PARSER")
    print("="*80)

    # Read example file
    cisco_file = 'claude_import_examples/cisco/show-running-config.txt'

    if not os.path.exists(cisco_file):
        print(f"ERROR: Cisco example file not found: {cisco_file}")
        return False

    with open(cisco_file, 'r') as f:
        data = f.read()

    print(f"\nParsing file: {cisco_file}")
    print(f"File size: {len(data)} bytes")

    # Create parser and parse
    parser = CiscoParser()

    if not parser.detect_format(data):
        print("ERROR: Parser did not detect Cisco format!")
        return False

    print("✓ Format detected as Cisco")

    result = parser.parse(data)

    # Print summary
    print(f"\n--- PARSE RESULTS ---")
    print(f"Fabrics found: {len(result.fabrics)}")
    for fabric in result.fabrics:
        print(f"  - {fabric.name} (VSAN {fabric.vsan})")

    print(f"\nDevice-aliases found: {len([a for a in result.aliases if a.alias_type == 'device-alias'])}")
    print(f"FC-aliases found: {len([a for a in result.aliases if a.alias_type == 'fcalias'])}")
    print(f"Total aliases: {len(result.aliases)}")

    # Show first 5 device-aliases
    device_aliases = [a for a in result.aliases if a.alias_type == 'device-alias'][:5]
    if device_aliases:
        print(f"\nFirst 5 device-aliases:")
        for alias in device_aliases:
            print(f"  - {alias.name}: {alias.wwpn} ({alias.use})")

    print(f"\nZones found: {len(result.zones)}")
    # Show first 3 zones
    for zone in result.zones[:3]:
        print(f"  - {zone.name} ({zone.zone_type}) - {len(zone.members)} members")
        print(f"    Members: {', '.join(zone.members[:5])}{'...' if len(zone.members) > 5 else ''}")

    print(f"\nErrors: {len(result.errors)}")
    for error in result.errors[:5]:
        print(f"  - {error}")

    print(f"\nWarnings: {len(result.warnings)}")
    for warning in result.warnings[:5]:
        print(f"  - {warning}")

    # Check critical items
    success = True
    if len(device_aliases) == 0:
        print("\n❌ FAIL: No device-aliases found!")
        success = False
    else:
        print(f"\n✓ SUCCESS: Found {len(device_aliases)} device-aliases")

    if len(result.zones) == 0:
        print("❌ FAIL: No zones found!")
        success = False
    else:
        print(f"✓ SUCCESS: Found {len(result.zones)} zones")

    return success


def test_brocade_parser():
    """Test Brocade parser with example files"""
    print("\n" + "="*80)
    print("TESTING BROCADE PARSER")
    print("="*80)

    # Test files
    alias_file = 'claude_import_examples/brocade/Rick_Koetter_251017_2325_ESILABS_AliasInfo.csv'
    zone_file = 'claude_import_examples/brocade/Rick_Koetter_251017_2325_ESILABS_ZoneInfo.csv'
    fabric_file = 'claude_import_examples/brocade/Rick_Koetter_251017_2325_ESILABS_FabricSummary.csv'

    success = True

    # Test alias parsing
    print(f"\n--- TESTING ALIAS PARSER ---")
    if not os.path.exists(alias_file):
        print(f"ERROR: Alias file not found: {alias_file}")
        return False

    with open(alias_file, 'r') as f:
        alias_data = f.read()

    parser = BrocadeParser()

    if not parser.detect_format(alias_data):
        print("ERROR: Parser did not detect Brocade format!")
        return False

    print("✓ Format detected as Brocade")

    result = parser.parse(alias_data)

    print(f"\nAliases found: {len(result.aliases)}")

    # Find aliases with multiple WWPNs (e.g., Host1, PS75_Dsiasp)
    multi_wwpn_aliases = {}
    for alias in result.aliases:
        if alias.name in multi_wwpn_aliases:
            multi_wwpn_aliases[alias.name] += 1
        else:
            multi_wwpn_aliases[alias.name] = 1

    multi_wwpn_count = sum(1 for count in multi_wwpn_aliases.values() if count > 1)
    print(f"Aliases with multiple WWPNs: {multi_wwpn_count}")

    # Show examples of multi-WWPN aliases
    print(f"\nExamples of multi-WWPN aliases:")
    count = 0
    for alias_name, wwpn_count in multi_wwpn_aliases.items():
        if wwpn_count > 1 and count < 3:
            wwpns = [a.wwpn for a in result.aliases if a.name == alias_name]
            print(f"  - {alias_name}: {wwpn_count} WWPNs")
            for wwpn in wwpns:
                print(f"    → {wwpn}")
            count += 1

    if multi_wwpn_count == 0:
        print("❌ FAIL: No multi-WWPN aliases found (expected at least 10)")
        success = False
    else:
        print(f"✓ SUCCESS: Found {multi_wwpn_count} aliases with multiple WWPNs")

    # Test zone parsing
    print(f"\n--- TESTING ZONE PARSER ---")
    if not os.path.exists(zone_file):
        print(f"ERROR: Zone file not found: {zone_file}")
        return False

    with open(zone_file, 'r') as f:
        zone_data = f.read()

    parser = BrocadeParser()
    result = parser.parse(zone_data)

    print(f"\nZones found: {len(result.zones)}")

    # Count peer zones
    peer_zones = [z for z in result.zones if z.zone_type == 'peer']
    print(f"Peer zones: {len(peer_zones)}")
    print(f"Standard zones: {len(result.zones) - len(peer_zones)}")

    # Show examples
    print(f"\nFirst 3 peer zones:")
    for zone in peer_zones[:3]:
        print(f"  - {zone.name} - {len(zone.members)} members")
        print(f"    Members: {', '.join(zone.members[:3])}{'...' if len(zone.members) > 3 else ''}")

    if len(peer_zones) == 0:
        print("❌ FAIL: No peer zones found (expected many)")
        success = False
    else:
        print(f"✓ SUCCESS: Found {len(peer_zones)} peer zones")

    # Test fabric parsing
    print(f"\n--- TESTING FABRIC PARSER ---")
    if not os.path.exists(fabric_file):
        print(f"ERROR: Fabric file not found: {fabric_file}")
        return False

    with open(fabric_file, 'r') as f:
        fabric_data = f.read()

    parser = BrocadeParser()
    result = parser.parse(fabric_data)

    print(f"\nFabrics found: {len(result.fabrics)}")
    for fabric in result.fabrics:
        print(f"  - {fabric.name} (Zoneset: {fabric.zoneset_name})")

    if len(result.fabrics) == 0:
        print("❌ FAIL: No fabrics found")
        success = False
    else:
        print(f"✓ SUCCESS: Found {len(result.fabrics)} fabrics")

    return success


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("UNIVERSAL IMPORTER PARSER TESTS")
    print("="*80)

    cisco_success = test_cisco_parser()
    brocade_success = test_brocade_parser()

    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Cisco Parser: {'✓ PASS' if cisco_success else '❌ FAIL'}")
    print(f"Brocade Parser: {'✓ PASS' if brocade_success else '❌ FAIL'}")
    print("="*80)

    if cisco_success and brocade_success:
        print("\n✓ ALL TESTS PASSED!\n")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
