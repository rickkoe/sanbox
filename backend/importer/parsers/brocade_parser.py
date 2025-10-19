"""
Brocade SAN Switch Configuration Parser

Parses output from:
- SAN Health Report CSVs (FabricSummary, AliasInfo, ZoneInfo, SwitchSummary)
- CLI commands (cfgshow, alishow, zoneshow)

Handles Brocade-specific formats including peer zone detection.
"""

import re
import csv
from io import StringIO
from typing import Dict, List, Optional
from .base_parser import (
    BaseParser, ParseResult, ParsedFabric, ParsedAlias, ParsedZone, ParserFactory
)


@ParserFactory.register_parser
class BrocadeParser(BaseParser):
    """Parser for Brocade switch configurations"""

    def __init__(self):
        super().__init__()
        self.csv_type = None

    def detect_format(self, data: str) -> bool:
        """
        Detect if this is Brocade configuration data.

        Look for Brocade-specific CSV headers or CLI output.
        """
        brocade_indicators = [
            r'Fabric Name,Fabric Principal Switch',  # FabricSummary.csv
            r'Fabric Name,Active Zone Config,Alias Name',  # AliasInfo.csv
            r'Fabric Name,Active Zone Config,Active Zones',  # ZoneInfo.csv
            r'Switch Name,Switch WWN,Model Number',  # SwitchSummary.csv
            r'Defined configuration:',  # cfgshow output
            r'Effective configuration:',  # cfgshow output
        ]

        for pattern in brocade_indicators:
            if re.search(pattern, data, re.IGNORECASE):
                return True
        return False

    def parse(self, data: str) -> ParseResult:
        """Parse Brocade configuration data"""
        self.add_metadata('parser', 'BrocadeParser')
        self.add_metadata('data_size', len(data))

        # Determine format type
        if 'Fabric Name,Fabric Principal Switch' in data:
            return self._parse_fabric_summary_csv(data)
        elif 'Fabric Name,Active Zone Config,Alias Name' in data:
            return self._parse_alias_info_csv(data)
        elif 'Fabric Name,Active Zone Config,Active Zones' in data:
            return self._parse_zone_info_csv(data)
        elif 'Defined configuration:' in data or 'Effective configuration:' in data:
            return self._parse_cfgshow_output(data)
        else:
            # Try to detect if it's a combined CSV dump with multiple CSVs
            return self._parse_combined_csv(data)

    def _parse_fabric_summary_csv(self, data: str) -> ParseResult:
        """Parse FabricSummary.csv from SAN Health report"""
        self.add_metadata('format', 'FabricSummary.csv')

        fabrics = []
        reader = csv.DictReader(StringIO(data))

        for row in reader:
            fabric_name = row.get('Fabric Name', '').strip()
            active_zoneset = row.get('Active Zone Config', '').strip()

            if fabric_name:
                fabrics.append(ParsedFabric(
                    name=fabric_name,
                    zoneset_name=active_zoneset if active_zoneset else None,
                    san_vendor='BR',
                    exists=False,
                    notes=f"Principal: {row.get('Fabric Principal Switch', '')}"
                ))

        return ParseResult(
            fabrics=fabrics,
            aliases=[],
            zones=[],
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _parse_alias_info_csv(self, data: str) -> ParseResult:
        """Parse AliasInfo.csv from SAN Health report"""
        self.add_metadata('format', 'AliasInfo.csv')

        aliases = []
        reader = csv.DictReader(StringIO(data))

        for row in reader:
            fabric_name = row.get('Fabric Name', '').strip()
            alias_name = row.get('Alias Name', '').strip()
            member_wwpns = row.get('Alias Member(s)', '').strip()

            if not alias_name or not member_wwpns:
                continue

            # Parse space-separated WWPNs - Brocade can have multiple WWPNs in one alias
            # Split by spaces and filter out empty strings
            wwpn_list = [w.strip() for w in member_wwpns.split() if w.strip()]

            for wwpn in wwpn_list:
                if not self.is_valid_wwpn(wwpn):
                    self.add_warning(f'Skipping invalid WWPN "{wwpn}" for alias {alias_name}')
                    continue

                try:
                    normalized_wwpn = self.normalize_wwpn(wwpn)
                    wwpn_type = self.detect_wwpn_type(normalized_wwpn)

                    # Create one alias entry per WWPN
                    # If an alias has multiple WWPNs, we create multiple alias records
                    aliases.append(ParsedAlias(
                        name=alias_name,
                        wwpn=normalized_wwpn,
                        alias_type='fcalias',  # Brocade uses fcalias
                        use=wwpn_type,
                        fabric_name=fabric_name
                    ))
                except ValueError as e:
                    self.add_error(f'Invalid WWPN for alias {alias_name}: {e}')

        return ParseResult(
            fabrics=[],
            aliases=aliases,
            zones=[],
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _parse_zone_info_csv(self, data: str) -> ParseResult:
        """Parse ZoneInfo.csv from SAN Health report"""
        self.add_metadata('format', 'ZoneInfo.csv')

        zones = []
        reader = csv.DictReader(StringIO(data))

        for row in reader:
            fabric_name = row.get('Fabric Name', '').strip()
            zone_name = row.get('Active Zones', '').strip()
            members_str = row.get('Zone Member(s)', '').strip()

            if not zone_name or not members_str:
                continue

            # Parse comma-separated members
            # Remove trailing commas that are common in CSV exports
            members = [m.strip() for m in members_str.split(',') if m.strip()]

            # Detect peer zones:
            # - Brocade peer zones have members starting with "00:" (principal member indicator)
            # - Zone name often contains "peerzone" or "peer_"
            is_peer_zone = False
            member_types = {}
            clean_members = []

            # Check if zone name suggests peer zone
            if 'peerzone' in zone_name.lower() or 'peer_' in zone_name.lower():
                is_peer_zone = True

            for member in members:
                # Check if this is a special peer zone indicator (starts with 00:)
                if member.startswith('00:'):
                    is_peer_zone = True
                    # This is a principal member indicator, skip it
                    # The actual members follow after this
                    continue

                # Member can be either an alias name or a raw WWPN
                if self.is_valid_wwpn(member):
                    # This is a raw WWPN (direct zone member)
                    try:
                        normalized = self.normalize_wwpn(member)
                        detected_type = self.detect_wwpn_type(normalized)

                        # For peer zones, try to detect member type
                        if is_peer_zone and detected_type:
                            member_types[member] = detected_type

                        # Keep the WWPN as-is for member lookup
                        clean_members.append(member)
                    except ValueError:
                        # Invalid WWPN, treat as alias name
                        clean_members.append(member)
                else:
                    # This is an alias name
                    clean_members.append(member)

            # Only create zone if it has actual members
            if clean_members:
                zones.append(ParsedZone(
                    name=zone_name,
                    members=clean_members,
                    zone_type='peer' if is_peer_zone else 'standard',
                    member_types=member_types if is_peer_zone else None,
                    fabric_name=fabric_name
                ))
            else:
                self.add_warning(f'Zone {zone_name} has no valid members, skipping')

        return ParseResult(
            fabrics=[],
            aliases=[],
            zones=zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _parse_combined_csv(self, data: str) -> ParseResult:
        """Parse combined CSV data (multiple CSV files concatenated)"""
        self.add_metadata('format', 'combined-csv')

        all_fabrics = []
        all_aliases = []
        all_zones = []

        # Split by CSV headers
        sections = re.split(r'\n(?=Fabric Name,)', data)

        for section in sections:
            if not section.strip():
                continue

            # Try each CSV parser
            if 'Fabric Principal Switch' in section:
                result = self._parse_fabric_summary_csv(section)
                all_fabrics.extend(result.fabrics)
            elif 'Alias Name,Alias Member' in section:
                result = self._parse_alias_info_csv(section)
                all_aliases.extend(result.aliases)
            elif 'Active Zones,Zone Status' in section or 'Zone Member(s)' in section:
                result = self._parse_zone_info_csv(section)
                all_zones.extend(result.zones)

        return ParseResult(
            fabrics=all_fabrics,
            aliases=all_aliases,
            zones=all_zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _parse_cfgshow_output(self, data: str) -> ParseResult:
        """Parse Brocade cfgshow CLI command output"""
        self.add_metadata('format', 'cfgshow-cli')

        fabrics = []
        aliases = []
        zones = []

        # Parse effective configuration section
        effective_match = re.search(
            r'Effective configuration:\s*\n(.*?)(?=Defined configuration:|$)',
            data,
            re.DOTALL
        )

        if effective_match:
            config_data = effective_match.group(1)

            # Parse cfg (zoneset) - format: "cfg:   zoneset_name"
            cfg_match = re.search(r'cfg:\s+(\S+)', config_data)
            zoneset_name = cfg_match.group(1) if cfg_match else None

            # Create a fabric entry
            fabrics.append(ParsedFabric(
                name='brocade_fabric',
                zoneset_name=zoneset_name,
                san_vendor='BR',
                exists=False
            ))

            # Parse zones - format: "zone:  zone_name"
            zone_pattern = r'zone:\s+(\S+)(?:\n\s+(.+?))?(?=\n\s*(?:zone:|cfg:|$))'
            for zone_match in re.finditer(zone_pattern, config_data, re.DOTALL):
                zone_name = zone_match.group(1)
                members_block = zone_match.group(2) if zone_match.group(2) else ''

                # Parse members (semicolon-separated)
                members = []
                if members_block:
                    # Members can be aliases or WWPNs, separated by semicolons
                    member_list = [m.strip() for m in members_block.split(';') if m.strip()]

                    for member in member_list:
                        # Check if it's a WWPN or alias
                        if self.is_valid_wwpn(member):
                            # Use WWPN without colons as member name
                            members.append(member.replace(':', '').replace('-', ''))
                        else:
                            members.append(member)

                zones.append(ParsedZone(
                    name=zone_name,
                    members=members,
                    zone_type='standard',  # CLI output doesn't show peer zone tags clearly
                    fabric_name='brocade_fabric'
                ))

        # Parse defined configuration for aliases
        defined_match = re.search(
            r'Defined configuration:\s*\n(.*?)$',
            data,
            re.DOTALL
        )

        if defined_match:
            config_data = defined_match.group(1)

            # Parse aliases - format: "alias:  alias_name  wwpn1; wwpn2"
            alias_pattern = r'alias:\s+(\S+)\s+(.+?)(?=\n\s*(?:alias:|zone:|cfg:|$))'
            for alias_match in re.finditer(alias_pattern, config_data, re.DOTALL):
                alias_name = alias_match.group(1)
                wwpns_str = alias_match.group(2).strip()

                # Parse semicolon-separated WWPNs
                wwpn_list = [w.strip() for w in wwpns_str.split(';') if w.strip()]

                for wwpn in wwpn_list:
                    if not self.is_valid_wwpn(wwpn):
                        continue

                    try:
                        normalized_wwpn = self.normalize_wwpn(wwpn)
                        wwpn_type = self.detect_wwpn_type(normalized_wwpn)

                        aliases.append(ParsedAlias(
                            name=alias_name,
                            wwpn=normalized_wwpn,
                            alias_type='fcalias',
                            use=wwpn_type,
                            fabric_name='brocade_fabric'
                        ))
                    except ValueError as e:
                        self.add_error(f'Invalid WWPN for alias {alias_name}: {e}')

        return ParseResult(
            fabrics=fabrics,
            aliases=aliases,
            zones=zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )
