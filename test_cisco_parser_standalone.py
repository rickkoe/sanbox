"""
Standalone test for Cisco parser (no Django required)
"""

import sys
import os
import re

# Simplified parser classes for testing
class ParsedFabric:
    def __init__(self, name, vsan=None, zoneset_name=None, san_vendor='CI', exists=False):
        self.name = name
        self.vsan = vsan
        self.zoneset_name = zoneset_name
        self.san_vendor = san_vendor
        self.exists = exists

class ParsedAlias:
    def __init__(self, name, wwpn, alias_type='device-alias', use=None, fabric_name=None):
        self.name = name
        self.wwpn = wwpn
        self.alias_type = alias_type
        self.use = use
        self.fabric_name = fabric_name

class ParsedZone:
    def __init__(self, name, members, zone_type='standard', member_types=None, fabric_name=None):
        self.name = name
        self.members = members
        self.zone_type = zone_type
        self.member_types = member_types
        self.fabric_name = fabric_name

class ParseResult:
    def __init__(self, fabrics, aliases, zones, errors, warnings, metadata):
        self.fabrics = fabrics
        self.aliases = aliases
        self.zones = zones
        self.errors = errors
        self.warnings = warnings
        self.metadata = metadata

# Simple test to verify parsing logic
def test_patterns():
    print("=" * 80)
    print("Testing Cisco Parser Patterns")
    print("=" * 80)

    # Read the example file
    file_path = '/Users/rickk/sanbox/claude_import_examples/cisco/show-running-config.txt'
    with open(file_path, 'r') as f:
        data = f.read()

    print(f"\nFile size: {len(data)} bytes")

    # Test device-alias pattern
    device_alias_pattern = r'device-alias name (\S+) pwwn ([0-9a-f:]+)'
    device_aliases = re.findall(device_alias_pattern, data, re.IGNORECASE)
    print(f"\nDevice-aliases found: {len(device_aliases)}")
    print("First 5:")
    for name, wwpn in device_aliases[:5]:
        print(f"  {name}: {wwpn}")

    # Test fcalias pattern
    fcalias_pattern = r'fcalias name (\S+) vsan (\d+)'
    fcaliases = re.findall(fcalias_pattern, data)
    print(f"\nFCaliases found: {len(fcaliases)}")
    print("First 5:")
    for name, vsan in fcaliases[:5]:
        print(f"  {name} (VSAN {vsan})")

    # Test zone pattern
    zone_pattern = r'zone name (\S+) vsan (\d+)'
    zones = re.findall(zone_pattern, data)
    print(f"\nZones found: {len(zones)}")
    print("First 5:")
    for name, vsan in zones[:5]:
        print(f"  {name} (VSAN {vsan})")

    # Test zoneset pattern
    zoneset_pattern = r'zoneset name (\S+) vsan (\d+)'
    zonesets = re.findall(zoneset_pattern, data)
    print(f"\nZonesets found: {len(zonesets)}")
    for name, vsan in zonesets:
        print(f"  {name} (VSAN {vsan})")

    # Look for a sample zone with members
    sample_zone_pattern = r'zone name (zv_\S+) vsan (\d+)\s*\n((?:  .*\n)*)'
    sample_zones = list(re.finditer(sample_zone_pattern, data))
    if sample_zones:
        print(f"\nSample zone detail:")
        match = sample_zones[0]
        print(f"  Name: {match.group(1)}")
        print(f"  VSAN: {match.group(2)}")
        print(f"  Members block:")
        for line in match.group(3).split('\n')[:5]:
            print(f"    {line}")

    # Check for peer zone indicators
    peer_zone_pattern = r'member pwwn [0-9a-f:]+ (target|init|both)'
    peer_indicators = re.findall(peer_zone_pattern, data, re.IGNORECASE)
    print(f"\nPeer zone member tags found: {len(peer_indicators)}")
    if peer_indicators:
        print(f"  Types: {set(peer_indicators)}")

    print("\n" + "=" * 80)
    print("Pattern testing complete!")
    print("=" * 80)

if __name__ == '__main__':
    test_patterns()
