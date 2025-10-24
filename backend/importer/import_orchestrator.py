"""
Import Orchestrator Service

Coordinates the entire import process:
1. Parse data using appropriate parser
2. Validate parsed data
3. Import into database
4. Track progress and handle errors
"""

from typing import Dict, List, Optional, Callable
from django.db import transaction
from san.models import Fabric, Alias, AliasWWPN, Zone, WwpnPrefix
from customers.models import Customer
from .parsers.base_parser import ParseResult, ParsedFabric, ParsedAlias, ParsedZone
from .parsers.cisco_parser import CiscoParser
from .parsers.brocade_parser import BrocadeParser
import logging

logger = logging.getLogger(__name__)


class ImportOrchestrator:
    """Orchestrates the import process from parsing to database insertion"""

    def __init__(self, customer: Customer, progress_callback: Optional[Callable] = None, project_id: Optional[int] = None):
        """
        Initialize orchestrator.

        Args:
            customer: Customer instance for this import
            progress_callback: Optional callback(current, total, message)
            project_id: Optional project ID to assign zones to
        """
        self.customer = customer
        self.progress_callback = progress_callback
        self.project_id = project_id
        self.stats = {
            'fabrics_created': 0,
            'fabrics_updated': 0,
            'aliases_created': 0,
            'aliases_updated': 0,
            'zones_created': 0,
            'zones_updated': 0,
            'errors': [],
            'warnings': []
        }

    def _report_progress(self, current: int, total: int, message: str):
        """Report progress if callback is provided"""
        if self.progress_callback:
            self.progress_callback(current, total, message)

    def import_from_text(
        self,
        data: str,
        fabric_id: Optional[int] = None,
        fabric_name_override: Optional[str] = None,
        zoneset_name_override: Optional[str] = None,
        vsan_override: Optional[str] = None,
        create_new_fabric: bool = False,
        conflict_resolutions: Optional[dict] = None
    ) -> Dict:
        """
        Import SAN configuration from text data (CLI output, CSV, etc.).

        Args:
            data: Raw text data to parse
            fabric_id: ID of existing fabric to use for all imports
            fabric_name_override: Optional fabric name to use when creating new fabric
            zoneset_name_override: Optional zoneset name to use when creating new fabric
            vsan_override: Optional VSAN to use when creating new fabric
            create_new_fabric: If True, create new fabric; if False, use existing
            conflict_resolutions: Dict mapping item names to resolution action (skip/replace/rename)

        Returns:
            Dict with import statistics
        """
        self._report_progress(0, 100, "Detecting data format...")

        # Auto-detect parser
        parser = None
        for parser_class in [CiscoParser, BrocadeParser]:
            test_parser = parser_class()
            if test_parser.detect_format(data):
                parser = test_parser
                break

        if not parser:
            raise ValueError("Could not detect data format. Unsupported format.")

        parser_name = parser.__class__.__name__
        self._report_progress(10, 100, f"Parsing data with {parser_name}...")

        # Parse the data
        parse_result = parser.parse(data)

        # Store parse errors/warnings
        self.stats['errors'].extend(parse_result.errors)
        self.stats['warnings'].extend(parse_result.warnings)

        if parse_result.errors:
            logger.warning(f"Parse errors: {parse_result.errors}")

        self._report_progress(30, 100, "Validating parsed data...")

        # Validate and import
        return self._import_parse_result(
            parse_result,
            fabric_id,
            fabric_name_override,
            zoneset_name_override,
            vsan_override,
            create_new_fabric,
            conflict_resolutions or {}
        )

    def preview_import(self, data: str, check_conflicts: bool = False) -> Dict:
        """
        Preview what would be imported without committing to database.

        Args:
            data: Raw text data to parse
            check_conflicts: If True, check for duplicate zones

        Returns:
            Dict with preview information
        """
        # Auto-detect parser
        parser = None
        for parser_class in [CiscoParser, BrocadeParser]:
            test_parser = parser_class()
            if test_parser.detect_format(data):
                parser = test_parser
                break

        if not parser:
            return {
                'success': False,
                'error': 'Could not detect data format. Unsupported format.',
                'parser': None
            }

        # Parse the data
        parse_result = parser.parse(data)

        # Check for conflicts if requested
        conflicts = None
        if check_conflicts:
            conflicts = self._detect_conflicts(parse_result)

        # Deduplicate aliases before preview (same logic as database import)
        # Use a dict with (fabric, name) as key to remove duplicates
        # With multi-WWPN support, we now key on alias name only (WWPNs are in a list)
        # Keep FIRST occurrence to preserve correct "use" field from parser
        unique_aliases = {}
        for a in parse_result.aliases:
            key = (a.fabric_name, a.name)
            if key not in unique_aliases:
                unique_aliases[key] = a
            else:
                # If duplicate has a more specific "use" value (target/init/both), prefer it
                existing_use = unique_aliases[key].use or ''
                new_use = a.use or ''
                if new_use in ['target', 'init', 'both'] and existing_use not in ['target', 'init', 'both']:
                    unique_aliases[key] = a

        # Add info message if duplicates were removed
        duplicates_removed = len(parse_result.aliases) - len(unique_aliases)
        if duplicates_removed > 0:
            parse_result.warnings.append(
                f'{duplicates_removed} duplicate alias entries removed from preview (same name)'
            )

        # Filter out fabrics that have no aliases or zones assigned to them
        # Build sets of fabric identifiers (both by name and by vsan) that have actual data
        fabrics_with_aliases = set(a.fabric_name for a in unique_aliases.values() if a.fabric_name)
        fabrics_with_zones = set(z.fabric_name for z in parse_result.zones if z.fabric_name)
        fabrics_with_data_by_name = fabrics_with_aliases | fabrics_with_zones

        # Filter fabrics to only include those with data
        # Match by both name and VSAN (since fabric names might vary, e.g., "vsan75" vs "vsan0075")
        active_fabrics = []
        skipped_fabrics = 0
        for f in parse_result.fabrics:
            has_data = False

            # Check by exact name match
            if f.name in fabrics_with_data_by_name:
                has_data = True
            # Check by VSAN match (e.g., vsan75 matches vsan0075)
            elif f.vsan:
                vsan_variants = [f'vsan{f.vsan}', f'vsan{f.vsan:04d}']
                if any(variant in fabrics_with_data_by_name for variant in vsan_variants):
                    has_data = True

            if has_data:
                active_fabrics.append(f)
            else:
                skipped_fabrics += 1
                logger.info(f"Skipping fabric {f.name} (VSAN {f.vsan}) - no aliases or zones found")

        # Add warning if fabrics were skipped
        if skipped_fabrics > 0:
            parse_result.warnings.append(
                f'{skipped_fabrics} fabric(s) skipped - no aliases or zones assigned'
            )

        return {
            'success': True,
            'parser': parser.__class__.__name__,
            'metadata': parse_result.metadata,
            'fabrics': [
                {
                    'name': f.name,
                    'vsan': f.vsan,
                    'zoneset_name': f.zoneset_name,
                    'san_vendor': f.san_vendor
                }
                for f in active_fabrics
            ],
            'aliases': [
                {
                    'name': a.name,
                    'wwpn': a.wwpn,  # First WWPN for backward compatibility
                    'wwpns': a.wwpns,  # Full list of WWPNs
                    'type': a.alias_type,
                    'use': a.use,
                    'fabric': a.fabric_name
                }
                for a in unique_aliases.values()
            ],
            'zones': [
                {
                    'name': z.name,
                    'member_count': len(z.members),
                    'type': z.zone_type,
                    'fabric': z.fabric_name,
                    'members': z.members[:10]  # Show first 10 members
                }
                for z in parse_result.zones  # Return all for checkbox selection
            ],
            'counts': {
                'fabrics': len(active_fabrics),  # Use filtered count
                'aliases': len(unique_aliases),  # Use deduplicated count
                'zones': len(parse_result.zones)
            },
            'conflicts': conflicts,
            'errors': parse_result.errors,
            'warnings': parse_result.warnings
        }

    def _detect_conflicts(self, parse_result: ParseResult) -> Dict:
        """
        Detect conflicts between parsed data and existing database records.

        Returns:
            Dict with conflict information
        """
        conflicts = {
            'zones': [],
            'aliases': [],
            'fabrics': []
        }

        # Check for duplicate zones (zones with same name in customer's fabrics)
        zone_names = [z.name for z in parse_result.zones]
        if zone_names:
            # Get unique zone names to avoid duplicate conflict entries
            unique_zone_names = list(set(zone_names))
            existing_zones = Zone.objects.filter(
                fabric__customer=self.customer,
                name__in=unique_zone_names
            ).select_related('fabric').values('name', 'fabric__name', 'zone_type')

            # Track zones we've already added to conflicts
            seen_conflicts = set()

            for existing_zone in existing_zones:
                zone_name = existing_zone['name']
                # Only add each zone conflict once
                if zone_name not in seen_conflicts:
                    # Find the parsed zone with same name
                    parsed_zone = next((z for z in parse_result.zones if z.name == zone_name), None)
                    if parsed_zone:
                        conflicts['zones'].append({
                            'name': zone_name,
                            'existing_fabric': existing_zone['fabric__name'],
                            'existing_type': existing_zone['zone_type'],
                            'new_fabric': parsed_zone.fabric_name or 'Unknown',
                            'new_type': parsed_zone.zone_type,
                            'new_member_count': len(parsed_zone.members)
                        })
                        seen_conflicts.add(zone_name)

        # Check for duplicate aliases (aliases with same name in customer's fabrics)
        alias_names = [a.name for a in parse_result.aliases]
        if alias_names:
            # Get unique alias names to avoid duplicate conflict entries
            unique_alias_names = list(set(alias_names))
            existing_aliases = Alias.objects.filter(
                fabric__customer=self.customer,
                name__in=unique_alias_names
            ).select_related('fabric').prefetch_related('alias_wwpns').values('id', 'name', 'fabric__name', 'use')

            # Track aliases we've already added to conflicts
            seen_conflicts = set()

            for existing_alias in existing_aliases:
                alias_name = existing_alias['name']
                # Only add each alias conflict once
                if alias_name not in seen_conflicts:
                    # Find the parsed alias with same name
                    parsed_alias = next((a for a in parse_result.aliases if a.name == alias_name), None)
                    if parsed_alias:
                        # Get the first WWPNs for display purposes
                        alias_obj = Alias.objects.get(id=existing_alias['id'])
                        existing_wwpns = alias_obj.wwpns
                        existing_wwpn_display = existing_wwpns[0] if existing_wwpns else 'N/A'
                        if len(existing_wwpns) > 1:
                            existing_wwpn_display += f' (+{len(existing_wwpns)-1} more)'

                        new_wwpn_display = parsed_alias.wwpns[0] if parsed_alias.wwpns else 'N/A'
                        if len(parsed_alias.wwpns) > 1:
                            new_wwpn_display += f' (+{len(parsed_alias.wwpns)-1} more)'

                        conflicts['aliases'].append({
                            'name': alias_name,
                            'existing_wwpn': existing_wwpn_display,
                            'existing_fabric': existing_alias['fabric__name'],
                            'existing_use': existing_alias.get('use', ''),
                            'new_wwpn': new_wwpn_display,
                            'new_fabric': parsed_alias.fabric_name or 'Unknown',
                            'new_use': parsed_alias.use or ''
                        })
                        seen_conflicts.add(alias_name)

        return conflicts

    @transaction.atomic
    def _import_parse_result(
        self,
        parse_result: ParseResult,
        fabric_id: Optional[int] = None,
        fabric_name_override: Optional[str] = None,
        zoneset_name_override: Optional[str] = None,
        vsan_override: Optional[str] = None,
        create_new_fabric: bool = False,
        conflict_resolutions: Optional[dict] = None
    ) -> Dict:
        """Import parsed data into database within a transaction"""

        conflict_resolutions = conflict_resolutions or {}
        self._report_progress(40, 100, "Determining target fabric...")

        # If user selected existing fabric, use it for everything
        if fabric_id:
            try:
                from san.models import Fabric
                fabric = Fabric.objects.get(id=fabric_id, customer=self.customer)
                logger.info(f"Using user-selected fabric: {fabric.name}")
                fabric_map = {fabric.name: fabric}
                # Don't create/update fabric stats since we're using existing
            except Fabric.DoesNotExist:
                raise ValueError(f"Fabric with ID {fabric_id} not found for customer {self.customer.name}")
        else:
            # Legacy behavior: filter and import fabrics from parsed data
            # Filter out fabrics with no data (same logic as preview)
            fabrics_with_aliases = set(a.fabric_name for a in parse_result.aliases if a.fabric_name)
            fabrics_with_zones = set(z.fabric_name for z in parse_result.zones if z.fabric_name)
            fabrics_with_data_by_name = fabrics_with_aliases | fabrics_with_zones

            active_fabrics = []
            for f in parse_result.fabrics:
                has_data = False

                # Check by exact name match
                if f.name in fabrics_with_data_by_name:
                    has_data = True
                # Check by VSAN match (e.g., vsan75 matches vsan0075)
                elif f.vsan:
                    vsan_variants = [f'vsan{f.vsan}', f'vsan{f.vsan:04d}']
                    if any(variant in fabrics_with_data_by_name for variant in vsan_variants):
                        has_data = True

                if has_data:
                    active_fabrics.append(f)
                else:
                    logger.info(f"Skipping fabric {f.name} (VSAN {f.vsan}) during import - no aliases or zones")
                    self.stats['warnings'].append(f"Fabric {f.name} skipped - no data to import")

            # Import fabrics (only active ones with data)
            fabric_map = self._import_fabrics(
                active_fabrics,
                fabric_name_override,
                zoneset_name_override,
                vsan_override,
                create_new_fabric
            )

        self._report_progress(55, 100, "Importing aliases...")

        # Import aliases
        logger.info(f"Starting alias import: {len(parse_result.aliases)} aliases to import")
        logger.info(f"Fabric map: {list(fabric_map.keys())}")
        alias_map = self._import_aliases(parse_result.aliases, fabric_map, conflict_resolutions)
        logger.info(f"Alias import complete: {self.stats['aliases_created']} created, {self.stats['aliases_updated']} updated")

        self._report_progress(75, 100, "Importing zones...")

        # Import zones
        self._import_zones(parse_result.zones, fabric_map, alias_map, conflict_resolutions)

        self._report_progress(100, 100, "Import complete!")

        return {
            'success': True,
            'stats': self.stats,
            'fabrics': list(fabric_map.values()),
            'metadata': parse_result.metadata
        }

    def _import_fabrics(
        self,
        parsed_fabrics: List[ParsedFabric],
        name_override: Optional[str],
        zoneset_name_override: Optional[str],
        vsan_override: Optional[str],
        create_new: bool
    ) -> Dict[str, Fabric]:
        """
        Import fabrics into database.

        Returns:
            Dict mapping parsed fabric name to Fabric instance
        """
        fabric_map = {}

        for parsed_fabric in parsed_fabrics:
            fabric_name = name_override or parsed_fabric.name
            zoneset_name = zoneset_name_override or parsed_fabric.zoneset_name or ''
            vsan = vsan_override or parsed_fabric.vsan

            try:
                if create_new:
                    # Create new fabric
                    fabric = Fabric.objects.create(
                        customer=self.customer,
                        name=fabric_name,
                        san_vendor=parsed_fabric.san_vendor,
                        zoneset_name=zoneset_name,
                        vsan=vsan
                    )
                    self.stats['fabrics_created'] += 1
                    logger.info(f"Created new fabric: {fabric_name} (zoneset: {zoneset_name}, vsan: {vsan})")
                else:
                    # Try to find existing fabric or create new
                    fabric, created = Fabric.objects.get_or_create(
                        customer=self.customer,
                        name=fabric_name,
                        defaults={
                            'san_vendor': parsed_fabric.san_vendor,
                            'zoneset_name': zoneset_name,
                            'vsan': vsan
                        }
                    )

                    if created:
                        self.stats['fabrics_created'] += 1
                        logger.info(f"Created fabric: {fabric_name}")
                    else:
                        # Update zoneset and vsan if provided
                        if zoneset_name:
                            fabric.zoneset_name = zoneset_name
                        if vsan:
                            fabric.vsan = vsan
                        fabric.save()
                        self.stats['fabrics_updated'] += 1
                        logger.info(f"Updated fabric: {fabric_name}")

                fabric_map[parsed_fabric.name] = fabric

            except Exception as e:
                error_msg = f"Error importing fabric {fabric_name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

        return fabric_map

    def _import_aliases(
        self,
        parsed_aliases: List[ParsedAlias],
        fabric_map: Dict[str, Fabric],
        conflict_resolutions: dict = None
    ) -> Dict[str, Alias]:
        """
        Import aliases into database with conflict resolution.

        Args:
            parsed_aliases: List of aliases to import
            fabric_map: Mapping of fabric names to Fabric instances
            conflict_resolutions: Dict mapping alias names to resolution actions (skip/replace/rename)

        Returns:
            Dict mapping alias name to Alias instance
        """
        alias_map = {}
        conflict_resolutions = conflict_resolutions or {}

        logger.info(f"_import_aliases called with {len(parsed_aliases)} aliases and {len(fabric_map)} fabrics")
        if not parsed_aliases:
            logger.warning("No aliases to import!")
            return alias_map
        if not fabric_map:
            logger.error("No fabrics in fabric_map!")
            return alias_map

        for i, parsed_alias in enumerate(parsed_aliases):
            if i % 50 == 0:  # Update progress every 50 aliases
                progress = 55 + int(20 * i / len(parsed_aliases))
                self._report_progress(progress, 100, f"Importing aliases ({i}/{len(parsed_aliases)})...")

            try:
                alias_name = parsed_alias.name
                resolution = conflict_resolutions.get(alias_name)

                # Handle skip - don't import this alias
                if resolution == 'skip':
                    logger.info(f"Skipping alias {alias_name} per conflict resolution")
                    self.stats['aliases_skipped'] = self.stats.get('aliases_skipped', 0) + 1
                    continue

                # Handle replace - delete existing aliases with same name first
                if resolution == 'replace':
                    deleted_count = Alias.objects.filter(
                        fabric__customer=self.customer,
                        name=alias_name
                    ).delete()[0]
                    if deleted_count > 0:
                        logger.info(f"Deleted {deleted_count} existing alias(es) named {alias_name}")
                        self.stats['aliases_replaced'] = self.stats.get('aliases_replaced', 0) + deleted_count

                # Handle rename - append custom suffix to avoid conflicts
                # Resolution can be 'rename' (legacy) or {'action': 'rename', 'suffix': '...'} (new)
                rename_suffix = '_copy'  # default
                if isinstance(resolution, dict) and resolution.get('action') == 'rename':
                    rename_suffix = resolution.get('suffix', '_copy')
                    resolution = 'rename'

                if resolution == 'rename':
                    original_name = alias_name
                    # Try with just the suffix first
                    alias_name = f"{original_name}{rename_suffix}"
                    # If that exists, append counter
                    if Alias.objects.filter(fabric__customer=self.customer, name=alias_name).exists():
                        counter = 1
                        while Alias.objects.filter(fabric__customer=self.customer, name=alias_name).exists():
                            alias_name = f"{original_name}{rename_suffix}_{counter}"
                            counter += 1
                    logger.info(f"Renamed alias {original_name} to {alias_name}")
                    parsed_alias.name = alias_name  # Update the parsed alias name

                # Get fabric - when user selects a fabric, fabric_map has only one entry
                if not fabric_map:
                    self.stats['warnings'].append(f"No fabric available for alias {parsed_alias.name}, skipping")
                    continue

                # Use the first (and typically only) fabric in the map
                fabric = list(fabric_map.values())[0]

                # Create or update alias
                # NOTE: Alias model now uses (fabric, name) as unique identifier
                # WWPNs are stored in separate AliasWWPN junction table
                alias, created = Alias.objects.update_or_create(
                    fabric=fabric,
                    name=parsed_alias.name,
                    defaults={
                        'cisco_alias': parsed_alias.alias_type,  # Field is 'cisco_alias' not 'alias_type'
                        'use': parsed_alias.use or ''
                    }
                )

                if created:
                    self.stats['aliases_created'] += 1
                else:
                    self.stats['aliases_updated'] += 1
                    # Clear existing WWPNs for this alias (we'll recreate them)
                    alias.alias_wwpns.all().delete()

                # Create AliasWWPN entries for each WWPN
                for order, wwpn in enumerate(parsed_alias.wwpns):
                    AliasWWPN.objects.create(
                        alias=alias,
                        wwpn=wwpn,
                        order=order
                    )

                # Assign alias to project if project_id was provided
                if self.project_id:
                    try:
                        from san.models import Project
                        project = Project.objects.get(id=self.project_id)
                        alias.projects.add(project)
                        logger.debug(f"Assigned alias {alias.name} to project {project.name}")
                    except Project.DoesNotExist:
                        self.stats['warnings'].append(f"Project with ID {self.project_id} not found")
                    except Exception as e:
                        self.stats['warnings'].append(f"Error assigning alias to project: {e}")

                # Use composite key for alias map (name can appear in multiple fabrics)
                alias_key = f"{fabric.name}:{parsed_alias.name}"
                alias_map[alias_key] = alias

                # Also map by just name for backward compatibility
                if parsed_alias.name not in alias_map:
                    alias_map[parsed_alias.name] = alias

            except Exception as e:
                error_msg = f"Error importing alias {parsed_alias.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

        return alias_map

    def _import_zones(
        self,
        parsed_zones: List[ParsedZone],
        fabric_map: Dict[str, Fabric],
        alias_map: Dict[str, Alias],
        conflict_resolutions: dict = None
    ):
        """Import zones into database with conflict resolution"""

        conflict_resolutions = conflict_resolutions or {}

        for i, parsed_zone in enumerate(parsed_zones):
            if i % 25 == 0:  # Update progress every 25 zones
                progress = 75 + int(20 * i / len(parsed_zones))
                self._report_progress(progress, 100, f"Importing zones ({i}/{len(parsed_zones)})...")

            try:
                zone_name = parsed_zone.name
                resolution = conflict_resolutions.get(zone_name)

                # Handle skip - don't import this zone
                if resolution == 'skip':
                    logger.info(f"Skipping zone {zone_name} per conflict resolution")
                    self.stats['zones_skipped'] = self.stats.get('zones_skipped', 0) + 1
                    continue

                # Handle replace - delete existing zones with same name first
                if resolution == 'replace':
                    deleted_count = Zone.objects.filter(
                        fabric__customer=self.customer,
                        name=zone_name
                    ).delete()[0]
                    if deleted_count > 0:
                        logger.info(f"Deleted {deleted_count} existing zone(s) named {zone_name}")
                        self.stats['zones_replaced'] = self.stats.get('zones_replaced', 0) + deleted_count

                # Handle rename - append custom suffix to avoid conflicts
                # Resolution can be 'rename' (legacy) or {'action': 'rename', 'suffix': '...'} (new)
                rename_suffix = '_copy'  # default
                if isinstance(resolution, dict) and resolution.get('action') == 'rename':
                    rename_suffix = resolution.get('suffix', '_copy')
                    resolution = 'rename'

                if resolution == 'rename':
                    original_name = zone_name
                    # Try with just the suffix first
                    zone_name = f"{original_name}{rename_suffix}"
                    # If that exists, append counter
                    if Zone.objects.filter(fabric__customer=self.customer, name=zone_name).exists():
                        counter = 1
                        while Zone.objects.filter(fabric__customer=self.customer, name=zone_name).exists():
                            zone_name = f"{original_name}{rename_suffix}_{counter}"
                            counter += 1
                    logger.info(f"Renamed zone {original_name} to {zone_name}")
                    parsed_zone.name = zone_name  # Update the parsed zone name

                # Get fabric - when user selects a fabric, fabric_map has only one entry
                if not fabric_map:
                    self.stats['warnings'].append(f"No fabric available for zone {parsed_zone.name}, skipping")
                    continue

                # Use the first (and typically only) fabric in the map
                fabric = list(fabric_map.values())[0]

                # Create or update zone
                zone, created = Zone.objects.update_or_create(
                    fabric=fabric,
                    name=parsed_zone.name,
                    defaults={
                        'zone_type': parsed_zone.zone_type if parsed_zone.zone_type in ['smart', 'standard'] else 'standard'
                    }
                )

                if created:
                    self.stats['zones_created'] += 1
                else:
                    self.stats['zones_updated'] += 1
                    # Clear existing members for update
                    zone.members.clear()

                # Add zone members
                zone_aliases = []
                for member_name in parsed_zone.members:
                    # Try to find the alias
                    alias = None

                    # Try fabric-specific lookup first (by name)
                    fabric_key = f"{fabric.name}:{member_name}"
                    if fabric_key in alias_map:
                        alias = alias_map[fabric_key]
                    elif member_name in alias_map:
                        alias = alias_map[member_name]
                    else:
                        # Check if member is a WWPN (with or without colons)
                        is_wwpn = False
                        formatted_wwpn = None

                        # Check for WWPN with colons
                        if ':' in member_name and len(member_name.replace(':', '')) == 16:
                            is_wwpn = True
                            formatted_wwpn = member_name.lower()
                        # Check for WWPN without colons
                        elif len(member_name) == 16 and all(c in '0123456789abcdefABCDEF' for c in member_name):
                            is_wwpn = True
                            formatted_wwpn = ':'.join([member_name[j:j+2] for j in range(0, 16, 2)]).lower()

                        if is_wwpn and formatted_wwpn:
                            # Try to find existing alias by WWPN
                            try:
                                alias = Alias.objects.filter(
                                    fabric=fabric,
                                    wwpn=formatted_wwpn
                                ).first()

                                if not alias:
                                    # Create a WWPN-type alias
                                    wwpn_type = WwpnPrefix.detect_wwpn_type(formatted_wwpn)

                                    alias, _ = Alias.objects.get_or_create(
                                        fabric=fabric,
                                        name=formatted_wwpn.replace(':', ''),  # WWPN without colons as name
                                        wwpn=formatted_wwpn,
                                        defaults={
                                            'cisco_alias': 'wwpn',  # Use correct field name
                                            'use': wwpn_type or ''
                                        }
                                    )
                                    alias_map[formatted_wwpn] = alias
                            except Exception as e:
                                self.stats['warnings'].append(f"Error handling WWPN {formatted_wwpn}: {e}")
                                continue
                        else:
                            self.stats['warnings'].append(
                                f"Could not find alias '{member_name}' for zone {parsed_zone.name}"
                            )
                            continue

                    if alias:
                        zone_aliases.append(alias)

                # Add all aliases to zone using ManyToManyField
                if zone_aliases:
                    zone.members.add(*zone_aliases)

                # Assign zone to project if project_id was provided
                if self.project_id:
                    try:
                        from san.models import Project
                        project = Project.objects.get(id=self.project_id)
                        zone.projects.add(project)
                        logger.info(f"Assigned zone {zone.name} to project {project.name}")
                    except Project.DoesNotExist:
                        self.stats['warnings'].append(f"Project with ID {self.project_id} not found")
                    except Exception as e:
                        self.stats['warnings'].append(f"Error assigning zone to project: {e}")

                # Set imported timestamp
                from django.utils import timezone
                zone.imported = timezone.now()

            except Exception as e:
                error_msg = f"Error importing zone {parsed_zone.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)
