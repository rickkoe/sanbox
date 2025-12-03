"""
Cisco MDS SAN Switch Configuration Parser

Parses output from:
- show tech-support
- show running-config
- show device-alias database
- show fcalias vsan 1-4093
- show zone vsan 1-4093
- show zoneset active vsan 1-4093
- show vsan

Handles both device-aliases and fcaliases, peer zones with init/target/both tags.
"""

import re
from typing import Dict, List, Optional, Tuple
from .base_parser import (
    BaseParser, ParseResult, ParsedFabric, ParsedAlias, ParsedZone, ParserFactory
)


@ParserFactory.register_parser
class CiscoParser(BaseParser):
    """Parser for Cisco MDS switch configurations"""

    def __init__(self):
        super().__init__()
        self.current_section = None
        self.section_data = {}

    def detect_format(self, data: str) -> bool:
        """
        Detect if this is Cisco MDS configuration data.

        Look for characteristic Cisco commands or output patterns.
        """
        cisco_indicators = [
            r'`show tech-support',
            r'show device-alias database',
            r'show fcalias vsan',
            r'show zone vsan',
            r'show running-config',
            r'device-alias database',
            r'fcalias name',
            r'fcalias name \S+ vsan \d+\s*;',  # Single-line fcalias format
            r'zone name .* vsan',
        ]

        for pattern in cisco_indicators:
            if re.search(pattern, data, re.IGNORECASE):
                return True
        return False

    def parse(self, data: str) -> ParseResult:
        """
        Parse Cisco MDS configuration data.

        Returns structured ParseResult with fabrics, aliases, and zones.
        """
        self.add_metadata('parser', 'CiscoParser')
        self.add_metadata('data_size', len(data))

        # Determine if this is tech-support or running-config
        is_tech_support = '`show tech-support' in data or '`show ' in data

        if is_tech_support:
            return self._parse_tech_support(data)
        else:
            return self._parse_running_config(data)

    def _parse_tech_support(self, data: str) -> ParseResult:
        """Parse show tech-support format"""
        self.add_metadata('format', 'tech-support')

        # Detect if multiple tech-support files are concatenated
        # Look for PuTTY log markers or multiple exact `show vsan` sections
        putty_log_count = len(re.findall(r'PuTTY log \d{4}\.\d{2}\.\d{2}', data))

        # Also count exact `show vsan` markers (with closing backtick, not `show vsan membership`)
        exact_vsan_count = len(re.findall(r'`show vsan`', data))

        file_count = max(putty_log_count, exact_vsan_count)

        if file_count > 1:
            # Multiple files detected - use combined parser
            self.add_metadata('multi_file', True)
            self.add_metadata('file_count', file_count)
            return self._parse_multi_tech_support(data)

        # Single file - use original logic
        return self._parse_single_tech_support(data)

    def _parse_single_tech_support(self, data: str) -> ParseResult:
        """Parse a single tech-support file"""
        # Extract relevant sections
        sections = self._extract_sections(data)

        # Parse each section
        fabrics = self._parse_vsan_section(sections.get('show vsan', ''))
        device_aliases = self._parse_device_alias_section(sections.get('show device-alias database', ''))
        fcaliases_by_vsan = self._parse_fcalias_section(sections.get('show fcalias vsan 1-4093', ''))
        zones_by_vsan = self._parse_zone_section(sections.get('show zone vsan 1-4093', ''))
        zonesets_by_vsan = self._parse_zoneset_section(sections.get('show zoneset active vsan 1-4093', ''))

        # Update fabrics with zoneset names
        for fabric in fabrics:
            if fabric.vsan and fabric.vsan in zonesets_by_vsan:
                fabric.zoneset_name = zonesets_by_vsan[fabric.vsan]

        # Build VSAN to fabric name mapping for normalizing aliases/zones
        vsan_to_fabric_name = {f.vsan: f.name for f in fabrics if f.vsan}

        # Combine all aliases and normalize fabric_name
        all_aliases = device_aliases.copy()
        for vsan, fcaliases in fcaliases_by_vsan.items():
            for alias in fcaliases:
                # Update fabric_name to match actual fabric name
                if vsan in vsan_to_fabric_name:
                    alias.fabric_name = vsan_to_fabric_name[vsan]
            all_aliases.extend(fcaliases)

        # Combine all zones and normalize fabric_name
        all_zones = []
        for vsan, zones in zones_by_vsan.items():
            for zone in zones:
                # Update fabric_name to match actual fabric name
                if vsan in vsan_to_fabric_name:
                    zone.fabric_name = vsan_to_fabric_name[vsan]
            all_zones.extend(zones)

        # Create fabric entries for any VSANs found in aliases/zones but not in fabrics list
        existing_vsans = {f.vsan for f in fabrics if f.vsan}
        all_vsans = set(fcaliases_by_vsan.keys()) | set(zones_by_vsan.keys())

        for vsan in all_vsans:
            if vsan not in existing_vsans:
                # Create a fabric entry for this VSAN
                fabrics.append(ParsedFabric(
                    name=f'vsan{vsan}',
                    vsan=vsan,
                    zoneset_name=zonesets_by_vsan.get(vsan),
                    san_vendor='CI',
                    exists=False
                ))

        return ParseResult(
            fabrics=fabrics,
            aliases=all_aliases,
            zones=all_zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _parse_multi_tech_support(self, data: str) -> ParseResult:
        """Parse multiple tech-support files concatenated together"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Parsing multiple tech-support files")

        # Extract all occurrences of each section type
        all_sections = self._extract_all_sections(data)

        # Collect all parsed data
        all_fabrics = []
        all_aliases = []
        all_zones = []
        all_zonesets = {}  # vsan -> zoneset_name

        # Parse each set of sections
        for section_set in all_sections:
            # Parse VSAN section for fabrics
            fabrics = self._parse_vsan_section(section_set.get('show vsan', ''))
            all_fabrics.extend(fabrics)

            # Parse device aliases
            device_aliases = self._parse_device_alias_section(section_set.get('show device-alias database', ''))
            all_aliases.extend(device_aliases)

            # Parse fcaliases
            fcaliases_by_vsan = self._parse_fcalias_section(section_set.get('show fcalias vsan 1-4093', ''))
            for vsan, fcaliases in fcaliases_by_vsan.items():
                all_aliases.extend(fcaliases)

            # Parse zones
            zones_by_vsan = self._parse_zone_section(section_set.get('show zone vsan 1-4093', ''))
            for vsan, zones in zones_by_vsan.items():
                all_zones.extend(zones)

            # Parse zonesets
            zonesets_by_vsan = self._parse_zoneset_section(section_set.get('show zoneset active vsan 1-4093', ''))
            all_zonesets.update(zonesets_by_vsan)

        # Deduplicate fabrics by VSAN
        unique_fabrics = self._deduplicate_fabrics(all_fabrics)

        # Update fabrics with zoneset names
        for fabric in unique_fabrics:
            if fabric.vsan and fabric.vsan in all_zonesets:
                fabric.zoneset_name = all_zonesets[fabric.vsan]

        # Build VSAN to fabric name mapping for normalizing aliases/zones
        vsan_to_fabric_name = {f.vsan: f.name for f in unique_fabrics if f.vsan}

        # Normalize fabric_name on aliases and zones to match actual fabric names
        # Parse VSAN from fabric_name string (e.g., "vsan75" -> 75)
        for alias in all_aliases:
            if alias.fabric_name and alias.fabric_name.startswith('vsan'):
                try:
                    vsan = int(alias.fabric_name.replace('vsan', ''))
                    if vsan in vsan_to_fabric_name:
                        alias.fabric_name = vsan_to_fabric_name[vsan]
                except (ValueError, TypeError):
                    pass

        for zone in all_zones:
            if zone.fabric_name and zone.fabric_name.startswith('vsan'):
                try:
                    vsan = int(zone.fabric_name.replace('vsan', ''))
                    if vsan in vsan_to_fabric_name:
                        zone.fabric_name = vsan_to_fabric_name[vsan]
                except (ValueError, TypeError):
                    pass

        # Deduplicate aliases by name
        unique_aliases = self._deduplicate_aliases(all_aliases)

        # Deduplicate zones by name and VSAN
        unique_zones = self._deduplicate_zones(all_zones)

        # Create fabric entries for any VSANs found in aliases/zones but not in fabrics list
        existing_vsans = {f.vsan for f in unique_fabrics if f.vsan}
        alias_vsans = {getattr(a, 'vsan', None) for a in unique_aliases if getattr(a, 'vsan', None)}
        zone_vsans = {getattr(z, 'vsan', None) for z in unique_zones if getattr(z, 'vsan', None)}
        all_vsans = alias_vsans | zone_vsans

        for vsan in all_vsans:
            if vsan not in existing_vsans:
                unique_fabrics.append(ParsedFabric(
                    name=f'vsan{vsan}',
                    vsan=vsan,
                    zoneset_name=all_zonesets.get(vsan),
                    san_vendor='CI',
                    exists=False
                ))

        logger.info(f"Multi-file parse results: {len(unique_fabrics)} fabrics, {len(unique_aliases)} aliases, {len(unique_zones)} zones")

        return ParseResult(
            fabrics=unique_fabrics,
            aliases=unique_aliases,
            zones=unique_zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _extract_all_sections(self, data: str) -> List[Dict[str, str]]:
        """
        Extract all occurrences of each section from multiple tech-support files.

        Returns a list of dicts, where each dict represents one file's sections.
        """
        import logging
        logger = logging.getLogger(__name__)

        # Sections we care about - use exact match (section name with closing backtick)
        target_sections = {
            '`show vsan`': 'show vsan',
            '`show device-alias database`': 'show device-alias database',
            '`show fcalias vsan 1-4093`': 'show fcalias vsan 1-4093',
            '`show zone vsan 1-4093`': 'show zone vsan 1-4093',
            '`show zoneset active vsan 1-4093`': 'show zoneset active vsan 1-4093'
        }

        # Split data into individual tech-support outputs
        # Try PuTTY log markers first, then fall back to `show vsan` sections
        file_chunks = re.split(r'(?=PuTTY log \d{4}\.\d{2}\.\d{2})', data)
        file_chunks = [chunk for chunk in file_chunks if chunk.strip()]

        # If PuTTY log split didn't work (only 1 chunk), try splitting on `show vsan`
        if len(file_chunks) <= 1:
            # Split on exact `show vsan` section (lookahead to keep the marker)
            file_chunks = re.split(r'(?=`show vsan`)', data)
            file_chunks = [chunk for chunk in file_chunks if chunk.strip()]
            logger.info(f"Split on show vsan markers: {len(file_chunks)} chunks")
        else:
            logger.info(f"Split on PuTTY log markers: {len(file_chunks)} chunks")

        file_sections = []

        for chunk_idx, chunk in enumerate(file_chunks):
            current_file = {}
            current_section = None
            section_lines = []

            lines = chunk.split('\n')

            for line in lines:
                trimmed_line = line.strip()

                # Check for exact section header match
                matched_section = None
                for header, section_name in target_sections.items():
                    if trimmed_line == header:
                        matched_section = section_name
                        break

                if matched_section:
                    # Save previous section if any
                    if current_section and section_lines:
                        current_file[current_section] = '\n'.join(section_lines)
                        section_lines = []

                    current_section = matched_section
                elif trimmed_line.startswith('`show ') or trimmed_line.startswith('`'):
                    # Different section header - save current and stop collecting
                    if current_section and section_lines:
                        current_file[current_section] = '\n'.join(section_lines)
                        section_lines = []
                    current_section = None
                elif current_section:
                    section_lines.append(line)

            # Save last section
            if current_section and section_lines:
                current_file[current_section] = '\n'.join(section_lines)

            if current_file:
                logger.info(f"File {chunk_idx + 1}: extracted sections {list(current_file.keys())}")
                file_sections.append(current_file)

        return file_sections

    def _deduplicate_fabrics(self, fabrics: List[ParsedFabric]) -> List[ParsedFabric]:
        """Deduplicate fabrics by VSAN, keeping the first occurrence with most data"""
        seen = {}
        for fabric in fabrics:
            key = fabric.vsan
            if key not in seen:
                seen[key] = fabric
            else:
                # Merge attributes - keep non-None values
                existing = seen[key]
                if fabric.zoneset_name and not existing.zoneset_name:
                    existing.zoneset_name = fabric.zoneset_name
                if fabric.name and (not existing.name or existing.name == f'vsan{fabric.vsan}'):
                    existing.name = fabric.name
        return list(seen.values())

    def _deduplicate_aliases(self, aliases: List[ParsedAlias]) -> List[ParsedAlias]:
        """Deduplicate aliases by name, keeping the first occurrence"""
        seen = {}
        for alias in aliases:
            # Key by name and VSAN (for fcaliases) or just name (for device-aliases)
            vsan = getattr(alias, 'vsan', None)
            key = (alias.name, vsan if vsan else 0)
            if key not in seen:
                seen[key] = alias
            else:
                # Merge WWPNs if the existing alias has fewer
                existing = seen[key]
                if len(alias.wwpns) > len(existing.wwpns):
                    existing.wwpns = alias.wwpns
        return list(seen.values())

    def _deduplicate_zones(self, zones: List[ParsedZone]) -> List[ParsedZone]:
        """Deduplicate zones by name and VSAN, keeping the first occurrence"""
        seen = {}
        for zone in zones:
            vsan = getattr(zone, 'vsan', None)
            key = (zone.name, vsan if vsan else 0)
            if key not in seen:
                seen[key] = zone
            else:
                # Merge members if the existing zone has fewer
                existing = seen[key]
                if len(zone.members) > len(existing.members):
                    existing.members = zone.members
        return list(seen.values())

    def _parse_running_config(self, data: str) -> ParseResult:
        """Parse show running-config format"""
        self.add_metadata('format', 'running-config')

        fabrics = []
        aliases = []
        zones = []

        # Parse device-alias database
        device_alias_match = re.search(
            r'device-alias database(.*?)(?=\ndevice-alias commit|\n[a-z][a-z]|\nend|\Z)',
            data,
            re.DOTALL | re.IGNORECASE
        )
        if device_alias_match:
            aliases.extend(self._parse_device_alias_block(device_alias_match.group(1)))

        # Parse fcalias definitions
        fcalias_pattern = r'fcalias name (\S+) vsan (\d+)\s*\n((?:  .*\n)*)'
        for match in re.finditer(fcalias_pattern, data):
            alias_name = match.group(1)
            vsan = int(match.group(2))
            members = match.group(3)

            # Extract WWPNs from members
            wwpn_matches = re.findall(r'member pwwn ([0-9a-f:]+)', members, re.IGNORECASE)

            # Collect all WWPNs for this alias
            normalized_wwpns = []
            first_use = None
            for wwpn in wwpn_matches:
                normalized_wwpn = self.normalize_wwpn(wwpn)
                normalized_wwpns.append(normalized_wwpn)

                if not first_use:
                    wwpn_type = self.detect_wwpn_type(normalized_wwpn)
                    # Detect peer zone tag (target, init, both)
                    tag_match = re.search(rf'member pwwn {re.escape(wwpn)}\s+(target|init|both)', members, re.IGNORECASE)
                    first_use = tag_match.group(1) if tag_match else wwpn_type

            # Create a single ParsedAlias with all WWPNs
            if normalized_wwpns:
                aliases.append(ParsedAlias(
                    name=alias_name,
                    wwpns=normalized_wwpns,
                    alias_type='fcalias',
                    use=first_use,
                    fabric_name=f'vsan{vsan}'
                ))

        # Parse single-line fcalias commands (e.g., "fcalias name X vsan Y ; member pwwn Z init")
        single_line_fcaliases = self._parse_single_line_fcalias(data)
        for vsan, fcaliases in single_line_fcaliases.items():
            aliases.extend(fcaliases)

        # Parse zone definitions
        zone_pattern = r'zone name (\S+) vsan (\d+)\s*\n((?:  .*\n)*)'
        for match in re.finditer(zone_pattern, data):
            zone_name = match.group(1)
            vsan = int(match.group(2))
            members_block = match.group(3)

            zone = self._parse_zone_block(zone_name, vsan, members_block)
            if zone:
                zones.append(zone)

        # Parse zones without indentation (alternate format)
        zones_no_indent = self._parse_zones_no_indent(data)
        for vsan, zone_list in zones_no_indent.items():
            zones.extend(zone_list)

        # Parse zoneset active (to get zoneset names)
        zoneset_pattern = r'zoneset name (\S+) vsan (\d+)'
        zoneset_by_vsan = {}
        for match in re.finditer(zoneset_pattern, data):
            zoneset_name = match.group(1)
            vsan = int(match.group(2))
            zoneset_by_vsan[vsan] = zoneset_name

        # Create fabrics from VSANs found
        vsans = set()
        for alias in aliases:
            if alias.fabric_name and alias.fabric_name.startswith('vsan'):
                vsans.add(int(alias.fabric_name.replace('vsan', '')))
        for zone in zones:
            if zone.fabric_name and zone.fabric_name.startswith('vsan'):
                vsans.add(int(zone.fabric_name.replace('vsan', '')))

        for vsan in sorted(vsans):
            fabrics.append(ParsedFabric(
                name=f'vsan{vsan}',
                vsan=vsan,
                zoneset_name=zoneset_by_vsan.get(vsan),
                san_vendor='CI',
                exists=False
            ))

        return ParseResult(
            fabrics=fabrics,
            aliases=aliases,
            zones=zones,
            errors=self.errors,
            warnings=self.warnings,
            metadata=self.metadata
        )

    def _extract_sections(self, data: str) -> Dict[str, str]:
        """
        Extract relevant sections from tech-support output.

        Returns dict mapping section name to content.
        """
        sections = {}

        # Sections we care about - use exact match (section name with closing backtick)
        target_sections = {
            '`show vsan`': 'show vsan',
            '`show device-alias database`': 'show device-alias database',
            '`show fcalias vsan 1-4093`': 'show fcalias vsan 1-4093',
            '`show zone vsan 1-4093`': 'show zone vsan 1-4093',
            '`show zoneset active vsan 1-4093`': 'show zoneset active vsan 1-4093'
        }

        lines = data.split('\n')
        current_section = None
        section_lines = []
        sections_found = 0

        for line in lines:
            # Check if this is a section header (trim whitespace)
            trimmed_line = line.strip()

            # Check for exact section header match
            matched_section = None
            for header, section_name in target_sections.items():
                if trimmed_line == header:
                    matched_section = section_name
                    break

            if matched_section:
                # Save previous section if any
                if current_section and section_lines:
                    sections[current_section] = '\n'.join(section_lines)
                    section_lines = []

                current_section = matched_section
                sections_found += 1
            elif trimmed_line.startswith('`show ') or trimmed_line.startswith('`'):
                # Different section header - save current and stop collecting
                if current_section and section_lines:
                    sections[current_section] = '\n'.join(section_lines)
                    section_lines = []
                current_section = None
            elif current_section:
                section_lines.append(line)

        # Save last section
        if current_section and section_lines:
            sections[current_section] = '\n'.join(section_lines)

        self.add_metadata('sections_found', list(sections.keys()))
        return sections

    def _parse_vsan_section(self, data: str) -> List[ParsedFabric]:
        """Parse 'show vsan' output"""
        fabrics = []

        # Pattern: vsan 75 information
        #          name:vsan0075  state:active
        vsan_pattern = r'vsan (\d+) information.*?name:(\S+)\s+state:(\S+)'

        for match in re.finditer(vsan_pattern, data, re.DOTALL):
            vsan_id = int(match.group(1))
            name = match.group(2)
            state = match.group(3)

            # Skip VSANs that are down
            if state.lower() != 'active':
                self.add_warning(f'Skipping VSAN {vsan_id} - state is {state}')
                continue

            fabrics.append(ParsedFabric(
                name=name if name != f'vsan{vsan_id:04d}' else f'vsan{vsan_id}',
                vsan=vsan_id,
                san_vendor='CI',
                exists=False
            ))

        return fabrics

    def _parse_device_alias_section(self, data: str) -> List[ParsedAlias]:
        """Parse 'show device-alias database' output"""
        aliases = []

        # Pattern: device-alias name PRD03A_CLM_01a pwwn c0:50:76:09:15:09:01:14
        # Note: device-alias typically has single WWPN per alias, but we support the list format
        pattern = r'device-alias name (\S+) pwwn ([0-9a-f:]+)'

        for match in re.finditer(pattern, data, re.IGNORECASE):
            alias_name = match.group(1)
            wwpn = match.group(2)

            try:
                normalized_wwpn = self.normalize_wwpn(wwpn)
                wwpn_type = self.detect_wwpn_type(normalized_wwpn)

                aliases.append(ParsedAlias(
                    name=alias_name,
                    wwpns=[normalized_wwpn],  # Single WWPN in a list
                    alias_type='device-alias',
                    use=wwpn_type
                ))
            except ValueError as e:
                self.add_error(f'Invalid WWPN for device-alias {alias_name}: {e}')

        return aliases

    def _parse_fcalias_section(self, data: str) -> Dict[int, List[ParsedAlias]]:
        """Parse 'show fcalias vsan 1-4093' output"""
        # Dictionary to collect WWPNs per alias: {vsan: {alias_name: {wwpns: [], use: str, alias_type: str}}}
        alias_wwpns_by_vsan = {}

        # Pattern: fcalias name s_78E37VE_n1p9 vsan 75
        #            pwwn 50:05:07:68:10:35:7a:a9 [target]
        current_alias = None
        current_vsan = None

        for line in data.split('\n'):
            line = line.strip()

            # Match fcalias name line
            alias_match = re.match(r'fcalias name (\S+) vsan (\d+)', line)
            if alias_match:
                current_alias = alias_match.group(1)
                current_vsan = int(alias_match.group(2))
                if current_vsan not in alias_wwpns_by_vsan:
                    alias_wwpns_by_vsan[current_vsan] = {}
                if current_alias not in alias_wwpns_by_vsan[current_vsan]:
                    alias_wwpns_by_vsan[current_vsan][current_alias] = {
                        'wwpns': [],
                        'use': None,
                        'alias_type': 'fcalias'
                    }
                continue

            # Match pwwn member line
            if current_alias and current_vsan:
                pwwn_match = re.match(r'pwwn ([0-9a-f:]+)(?:\s+\[(\w+)\])?', line, re.IGNORECASE)
                if pwwn_match:
                    wwpn = pwwn_match.group(1)
                    tag = pwwn_match.group(2)  # Could be target, init, both, OR an alias name

                    try:
                        normalized_wwpn = self.normalize_wwpn(wwpn)
                        wwpn_type = self.detect_wwpn_type(normalized_wwpn)

                        # Only use tag if it's a valid zone tag (target, init, both)
                        # Brackets can also contain alias names like [s_78E37VE_n1p9] which should be ignored
                        if tag and tag.lower() in ['target', 'init', 'both']:
                            use = tag.lower()
                        else:
                            use = wwpn_type

                        # Add WWPN to the alias
                        alias_wwpns_by_vsan[current_vsan][current_alias]['wwpns'].append(normalized_wwpn)
                        # Use the first detected use type (all WWPNs in same alias should have same use)
                        if not alias_wwpns_by_vsan[current_vsan][current_alias]['use']:
                            alias_wwpns_by_vsan[current_vsan][current_alias]['use'] = use

                    except ValueError as e:
                        self.add_error(f'Invalid WWPN for fcalias {current_alias}: {e}')

        # Convert to list of ParsedAlias objects
        aliases_by_vsan = {}
        for vsan, aliases_dict in alias_wwpns_by_vsan.items():
            aliases_by_vsan[vsan] = []
            for alias_name, alias_data in aliases_dict.items():
                if alias_data['wwpns']:  # Only create if we have at least one WWPN
                    aliases_by_vsan[vsan].append(ParsedAlias(
                        name=alias_name,
                        wwpns=alias_data['wwpns'],
                        alias_type=alias_data['alias_type'],
                        use=alias_data['use'],
                        fabric_name=f'vsan{vsan}'
                    ))

        return aliases_by_vsan

    def _parse_single_line_fcalias(self, data: str) -> Dict[int, List[ParsedAlias]]:
        """
        Parse single-line fcalias creation commands.

        Format: fcalias name <name> vsan <vsan_id> ; member pwwn <wwpn> [init|target|both]

        Examples:
            fcalias name P10_MGT01A_port2 vsan 80 ; member pwwn C0:50:76:0C:9E:6D:00:0E init
            fcalias name P10_PRD01ABK_port2 vsan 80 ; member pwwn C0:50:76:0C:9E:6D:00:CE
        """
        aliases_by_vsan = {}

        # Pattern: fcalias name <name> vsan <vsan_id> ; member pwwn <wwpn> [init|target|both]?
        pattern = r'fcalias\s+name\s+(\S+)\s+vsan\s+(\d+)\s*;\s*member\s+pwwn\s+([0-9a-fA-F:]+)(?:\s+(init|target|both))?'

        for match in re.finditer(pattern, data, re.IGNORECASE):
            alias_name = match.group(1)
            vsan = int(match.group(2))
            wwpn = match.group(3)
            role = match.group(4)  # May be None

            try:
                normalized_wwpn = self.normalize_wwpn(wwpn)

                # Determine use type: explicit role > auto-detect
                if role:
                    use = role.lower()
                else:
                    use = self.detect_wwpn_type(normalized_wwpn)

                if vsan not in aliases_by_vsan:
                    aliases_by_vsan[vsan] = []

                aliases_by_vsan[vsan].append(ParsedAlias(
                    name=alias_name,
                    wwpns=[normalized_wwpn],
                    alias_type='fcalias',
                    use=use,
                    fabric_name=f'vsan{vsan}'
                ))
            except ValueError as e:
                self.add_error(f'Invalid WWPN for fcalias {alias_name}: {e}')

        return aliases_by_vsan

    def _parse_zone_section(self, data: str) -> Dict[int, List[ParsedZone]]:
        """Parse 'show zone vsan 1-4093' output"""
        zones_by_vsan = {}

        current_zone = None
        current_vsan = None
        zone_members = []
        member_types = {}
        is_peer_zone = False

        for line in data.split('\n'):
            line = line.strip()

            # Match zone name line: zone name sz_78E37VE_port9 vsan 75
            zone_match = re.match(r'zone name (\S+) vsan (\d+)', line)
            if zone_match:
                # Save previous zone if any
                if current_zone and current_vsan:
                    if current_vsan not in zones_by_vsan:
                        zones_by_vsan[current_vsan] = []

                    zones_by_vsan[current_vsan].append(ParsedZone(
                        name=current_zone,
                        members=zone_members,
                        zone_type='peer' if is_peer_zone else 'standard',
                        member_types=member_types if is_peer_zone else None,
                        fabric_name=f'vsan{current_vsan}'
                    ))

                # Start new zone
                current_zone = zone_match.group(1)
                current_vsan = int(zone_match.group(2))
                zone_members = []
                member_types = {}
                is_peer_zone = False
                continue

            # Match member lines
            if current_zone:
                # pwwn 50:05:07:68:10:35:7a:a9 [s_78E37VE_n1p9] target
                # fcalias fc_alias_name
                # device-alias device_alias_name

                # Check for pwwn member (could be peer zone)
                pwwn_match = re.match(
                    r'pwwn ([0-9a-f:]+)(?:\s+\[(\S+)\])?\s*(target|init|both)?',
                    line,
                    re.IGNORECASE
                )
                if pwwn_match:
                    wwpn = pwwn_match.group(1)
                    alias_name = pwwn_match.group(2)  # Optional alias name in brackets
                    member_tag = pwwn_match.group(3)  # Optional peer zone tag

                    if member_tag:
                        is_peer_zone = True

                    # If there's an alias name in brackets, use it; otherwise use the WWPN
                    if alias_name:
                        member_name = alias_name
                    else:
                        # Use the actual WWPN (will be resolved during import)
                        member_name = wwpn

                    zone_members.append(member_name)

                    if member_tag:
                        member_types[member_name] = member_tag

                    continue

                # Check for fcalias member
                fcalias_match = re.match(r'fcalias (\S+)', line)
                if fcalias_match:
                    zone_members.append(fcalias_match.group(1))
                    continue

                # Check for device-alias member
                device_alias_match = re.match(r'device-alias (\S+)', line)
                if device_alias_match:
                    zone_members.append(device_alias_match.group(1))
                    continue

        # Save last zone
        if current_zone and current_vsan:
            if current_vsan not in zones_by_vsan:
                zones_by_vsan[current_vsan] = []

            zones_by_vsan[current_vsan].append(ParsedZone(
                name=current_zone,
                members=zone_members,
                zone_type='peer' if is_peer_zone else 'standard',
                member_types=member_types if is_peer_zone else None,
                fabric_name=f'vsan{current_vsan}'
            ))

        return zones_by_vsan

    def _parse_zoneset_section(self, data: str) -> Dict[int, str]:
        """Parse 'show zoneset active vsan 1-4093' output"""
        zonesets = {}

        # Pattern: zoneset name fabA_config_051125 vsan 75
        pattern = r'zoneset name (\S+) vsan (\d+)'

        for match in re.finditer(pattern, data):
            zoneset_name = match.group(1)
            vsan = int(match.group(2))
            zonesets[vsan] = zoneset_name

        return zonesets

    def _parse_device_alias_block(self, block: str) -> List[ParsedAlias]:
        """Parse device-alias database block from running-config"""
        aliases = []

        pattern = r'device-alias name (\S+) pwwn ([0-9a-f:]+)'
        for match in re.finditer(pattern, block, re.IGNORECASE):
            alias_name = match.group(1)
            wwpn = match.group(2)

            try:
                normalized_wwpn = self.normalize_wwpn(wwpn)
                wwpn_type = self.detect_wwpn_type(normalized_wwpn)

                aliases.append(ParsedAlias(
                    name=alias_name,
                    wwpns=[normalized_wwpn],  # Single WWPN in a list
                    alias_type='device-alias',
                    use=wwpn_type
                ))
            except ValueError as e:
                self.add_error(f'Invalid WWPN for device-alias {alias_name}: {e}')

        return aliases

    def _parse_zone_block(self, zone_name: str, vsan: int, members_block: str) -> Optional[ParsedZone]:
        """Parse a zone member block from running-config"""
        members = []
        member_types = {}
        is_peer_zone = False

        for line in members_block.split('\n'):
            line = line.strip()
            if not line or line.startswith('!'):
                continue

            # Check for different member types
            # Pattern 1: member pwwn xx:xx:xx... [optional peer zone tag]
            pwwn_match = re.match(r'member pwwn ([0-9a-f:]+)(?:\s+(target|init|both))?', line, re.IGNORECASE)
            if pwwn_match:
                wwpn = pwwn_match.group(1)
                tag = pwwn_match.group(2)

                if tag:
                    is_peer_zone = True

                # Use the actual WWPN as member (will be resolved during import)
                members.append(wwpn)

                if tag:
                    member_types[wwpn] = tag
                continue

            # Pattern 2: member fcalias <name>
            fcalias_match = re.match(r'member fcalias (\S+)', line)
            if fcalias_match:
                members.append(fcalias_match.group(1))
                continue

            # Pattern 3: member device-alias <name>
            device_alias_match = re.match(r'member device-alias (\S+)', line)
            if device_alias_match:
                members.append(device_alias_match.group(1))
                continue

        if not members:
            return None

        return ParsedZone(
            name=zone_name,
            members=members,
            zone_type='peer' if is_peer_zone else 'standard',
            member_types=member_types if is_peer_zone else None,
            fabric_name=f'vsan{vsan}'
        )

    def _parse_zones_no_indent(self, data: str) -> Dict[int, List[ParsedZone]]:
        """
        Parse zone definitions where member lines have no indentation.

        Format:
            zone name <zone_name> vsan <vsan_id>
            member fcalias <alias_name>
            member fcalias <alias_name>
            zone name <next_zone> vsan <vsan_id>
            ...
        """
        zones_by_vsan = {}

        lines = data.split('\n')
        current_zone = None
        current_vsan = None
        zone_members = []

        for line in lines:
            line = line.strip()

            # Check for zone header
            zone_match = re.match(r'zone name (\S+) vsan (\d+)', line)
            if zone_match:
                # Save previous zone if any
                if current_zone and current_vsan and zone_members:
                    if current_vsan not in zones_by_vsan:
                        zones_by_vsan[current_vsan] = []
                    zones_by_vsan[current_vsan].append(ParsedZone(
                        name=current_zone,
                        members=zone_members,
                        zone_type='standard',
                        member_types=None,
                        fabric_name=f'vsan{current_vsan}'
                    ))

                # Start new zone
                current_zone = zone_match.group(1)
                current_vsan = int(zone_match.group(2))
                zone_members = []
                continue

            # Check for member lines (only if we're in a zone)
            if current_zone:
                # member fcalias <name>
                fcalias_match = re.match(r'member fcalias (\S+)', line)
                if fcalias_match:
                    zone_members.append(fcalias_match.group(1))
                    continue

                # member device-alias <name>
                device_alias_match = re.match(r'member device-alias (\S+)', line)
                if device_alias_match:
                    zone_members.append(device_alias_match.group(1))
                    continue

                # member pwwn <wwpn> [tag]
                pwwn_match = re.match(r'member pwwn ([0-9a-f:]+)', line, re.IGNORECASE)
                if pwwn_match:
                    zone_members.append(pwwn_match.group(1))
                    continue

        # Save last zone
        if current_zone and current_vsan and zone_members:
            if current_vsan not in zones_by_vsan:
                zones_by_vsan[current_vsan] = []
            zones_by_vsan[current_vsan].append(ParsedZone(
                name=current_zone,
                members=zone_members,
                zone_type='standard',
                member_types=None,
                fabric_name=f'vsan{current_vsan}'
            ))

        return zones_by_vsan
