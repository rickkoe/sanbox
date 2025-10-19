#!/usr/bin/env python
"""Test section extraction from show-tech-support.log"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings_docker')

import django
django.setup()

from importer.parsers.cisco_parser import CiscoParser

# Read the file
file_path = '/app/claude_import_examples/cisco/show-tech-support.log' if os.path.exists('/app') else '../claude_import_examples/cisco/show-tech-support.log'
with open(file_path, 'r') as f:
    data = f.read()

parser = CiscoParser()
sections = parser._extract_sections(data)

print("=== SECTIONS EXTRACTED ===")
for section_name in sections.keys():
    section_data = sections[section_name]
    print(f"\n{section_name}:")
    print(f"  Length: {len(section_data)} characters")
    print(f"  Lines: {len(section_data.split(chr(10)))}")

    # Count fcalias occurrences
    fcalias_count = section_data.count('fcalias name vwsfs003p_c2p1_virt')
    if fcalias_count > 0:
        print(f"  *** Contains 'fcalias name vwsfs003p_c2p1_virt': {fcalias_count} times")

print("\n=== PARSING FCALIAS SECTION ===")
fcalias_section = sections.get('show fcalias vsan 1-4093', '')
fcaliases_by_vsan = parser._parse_fcalias_section(fcalias_section)

# Count vwsfs003p_c2p1_virt aliases
count = 0
for vsan, aliases in fcaliases_by_vsan.items():
    for alias in aliases:
        if alias.name == 'vwsfs003p_c2p1_virt':
            count += 1
            print(f"  Found: {alias.name} -> {alias.wwpn} (use: {alias.use})")

print(f"\nTotal vwsfs003p_c2p1_virt aliases created: {count}")
