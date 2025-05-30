#!/usr/bin/env python3
"""
Fibre Channel Zone Member Counter

This script parses FC zone configuration and counts members in each zone.
Supports both file input and direct text input.

Usage:
    python fc_zone_counter.py <config_file>
    or run interactively to paste config text
"""

import sys
import re
from collections import defaultdict

def parse_zone_config(config_text):
    """
    Parse FC zone configuration text and return zone member counts.
    
    Args:
        config_text (str): The zone configuration text
        
    Returns:
        dict: Dictionary with zone names as keys and member info as values
    """
    zones = {}
    current_zone = None
    
    lines = config_text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines and comments
        if not line or line.startswith('!'):
            continue
            
        # Check for zone definition
        zone_match = re.match(r'zone name\s+(\S+)\s+vsan\s+(\d+)', line)
        if zone_match:
            zone_name = zone_match.group(1)
            vsan_id = zone_match.group(2)
            current_zone = zone_name
            zones[current_zone] = {
                'vsan': vsan_id,
                'members': [],
                'targets': 0,
                'initiators': 0,
                'total': 0
            }
            continue
            
        # Check for member definition
        member_match = re.match(r'member pwwn\s+([0-9a-fA-F:]+)\s+(target|init)', line)
        if member_match and current_zone:
            pwwn = member_match.group(1)
            member_type = member_match.group(2)
            
            zones[current_zone]['members'].append({
                'pwwn': pwwn,
                'type': member_type
            })
            
            if member_type == 'target':
                zones[current_zone]['targets'] += 1
            else:
                zones[current_zone]['initiators'] += 1
            
            zones[current_zone]['total'] += 1
    
    return zones

def print_zone_summary(zones):
    """Print a summary of zone member counts."""
    if not zones:
        print("No zones found in the configuration.")
        return
    
    print(f"{'Zone Name':<25} {'VSAN':<6} {'Total':<7} {'Targets':<9} {'Initiators':<11}")
    print("-" * 65)
    
    total_zones = 0
    total_members = 0
    
    for zone_name, zone_info in zones.items():
        total_zones += 1
        total_members += zone_info['total']
        
        print(f"{zone_name:<25} {zone_info['vsan']:<6} "
              f"{zone_info['total']:<7} {zone_info['targets']:<9} "
              f"{zone_info['initiators']:<11}")
    
    print("-" * 65)
    print(f"Total zones: {total_zones}")
    print(f"Total members across all zones: {total_members}")

def print_detailed_report(zones):
    """Print detailed information for each zone."""
    print("\n" + "="*70)
    print("DETAILED ZONE REPORT")
    print("="*70)
    
    for zone_name, zone_info in zones.items():
        print(f"\nZone: {zone_name} (VSAN {zone_info['vsan']})")
        print(f"Total members: {zone_info['total']} "
              f"(Targets: {zone_info['targets']}, Initiators: {zone_info['initiators']})")
        print("-" * 50)
        
        # Group members by type
        targets = [m for m in zone_info['members'] if m['type'] == 'target']
        initiators = [m for m in zone_info['members'] if m['type'] == 'init']
        
        if targets:
            print("Targets:")
            for member in targets:
                print(f"  {member['pwwn']}")
        
        if initiators:
            print("Initiators:")
            for member in initiators:
                print(f"  {member['pwwn']}")

def main():
    """Main function to handle file input or interactive input."""
    config_text = ""
    
    # Check if file argument provided
    if len(sys.argv) > 1:
        filename = sys.argv[1]
        try:
            with open(filename, 'r') as file:
                config_text = file.read()
            print(f"Reading zone configuration from: {filename}")
        except FileNotFoundError:
            print(f"Error: File '{filename}' not found.")
            return
        except Exception as e:
            print(f"Error reading file: {e}")
            return
    else:
        # Interactive input
        print("Paste your FC zone configuration (press Ctrl+D or Ctrl+Z when done):")
        try:
            config_text = sys.stdin.read()
        except KeyboardInterrupt:
            print("\nOperation cancelled.")
            return
    
    if not config_text.strip():
        print("No configuration data provided.")
        return
    
    # Parse the configuration
    zones = parse_zone_config(config_text)
    
    if not zones:
        print("No valid zone configurations found.")
        return
    
    # Print summary
    print_zone_summary(zones)
    
    # Ask if user wants detailed report
    if len(sys.argv) <= 1:  # Only ask in interactive mode
        try:
            response = input("\nWould you like a detailed report? (y/n): ").lower().strip()
            if response in ['y', 'yes']:
                print_detailed_report(zones)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")

if __name__ == "__main__":
    main()