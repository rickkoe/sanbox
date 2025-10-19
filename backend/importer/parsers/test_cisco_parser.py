"""
Quick test script for Cisco parser
"""

import sys
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings_docker')
django.setup()

from importer.parsers.cisco_parser import CiscoParser

def test_running_config():
    """Test with show running-config example"""
    print("=" * 80)
    print("Testing Cisco Parser with running-config format")
    print("=" * 80)

    # Read the example file
    with open('/Users/rickk/sanbox/claude_import_examples/cisco/show-running-config.txt', 'r') as f:
        data = f.read()

    parser = CiscoParser()

    # Test detection
    can_parse = parser.detect_format(data)
    print(f"\nCan parse: {can_parse}")

    if can_parse:
        # Parse the data
        result = parser.parse(data)

        print(f"\n--- Parse Results ---")
        print(f"Fabrics found: {len(result.fabrics)}")
        for fabric in result.fabrics[:5]:  # Show first 5
            print(f"  - {fabric.name} (VSAN {fabric.vsan}, Zoneset: {fabric.zoneset_name})")

        print(f"\nAliases found: {len(result.aliases)}")
        device_aliases = [a for a in result.aliases if a.alias_type == 'device-alias']
        fcaliases = [a for a in result.aliases if a.alias_type == 'fcalias']
        print(f"  - Device-aliases: {len(device_aliases)}")
        print(f"  - FCaliases: {len(fcaliases)}")

        # Show sample aliases
        print(f"\n  Sample device-aliases:")
        for alias in device_aliases[:3]:
            print(f"    {alias.name}: {alias.wwpn} (use: {alias.use})")

        print(f"\n  Sample fcaliases:")
        for alias in fcaliases[:3]:
            print(f"    {alias.name}: {alias.wwpn} (use: {alias.use}, fabric: {alias.fabric_name})")

        print(f"\nZones found: {len(result.zones)}")
        peer_zones = [z for z in result.zones if z.zone_type == 'peer']
        standard_zones = [z for z in result.zones if z.zone_type == 'standard']
        print(f"  - Peer zones: {len(peer_zones)}")
        print(f"  - Standard zones: {len(standard_zones)}")

        # Show sample zones
        print(f"\n  Sample peer zones:")
        for zone in peer_zones[:2]:
            print(f"    {zone.name} (fabric: {zone.fabric_name})")
            print(f"      Members: {zone.members[:3]}...")
            if zone.member_types:
                print(f"      Member types: {dict(list(zone.member_types.items())[:3])}")

        print(f"\n  Sample standard zones:")
        for zone in standard_zones[:2]:
            print(f"    {zone.name} (fabric: {zone.fabric_name})")
            print(f"      Members: {zone.members[:3]}...")

        print(f"\nErrors: {len(result.errors)}")
        for error in result.errors[:5]:
            print(f"  - {error}")

        print(f"\nWarnings: {len(result.warnings)}")
        for warning in result.warnings[:5]:
            print(f"  - {warning}")

        print(f"\nMetadata: {result.metadata}")


if __name__ == '__main__':
    test_running_config()
