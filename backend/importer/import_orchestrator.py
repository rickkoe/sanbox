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
from django.utils import timezone
from san.models import Fabric, Alias, AliasWWPN, Zone, WwpnPrefix, Switch
from storage.models import Storage, Volume, Host, HostWwpn
from customers.models import Customer
from core.models import ProjectAlias, ProjectZone, ProjectHost
from .parsers.base_parser import (
    ParseResult, ParsedFabric, ParsedAlias, ParsedZone, ParsedSwitch,
    ParsedStorageSystem, ParsedVolume, ParsedHost, ParsedPort
)
from .parsers.cisco_parser import CiscoParser
from .parsers.brocade_parser import BrocadeParser
from .parsers.insights_parser import InsightsParser
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
            # SAN stats
            'fabrics_created': 0,
            'fabrics_updated': 0,
            'aliases_created': 0,
            'aliases_updated': 0,
            'zones_created': 0,
            'zones_updated': 0,
            'switches_created': 0,
            'switches_updated': 0,

            # Storage stats
            'storage_systems_created': 0,
            'storage_systems_updated': 0,
            'volumes_created': 0,
            'volumes_updated': 0,
            'hosts_created': 0,
            'hosts_updated': 0,
            'ports_created': 0,
            'ports_updated': 0,

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
        conflict_resolutions: Optional[dict] = None,
        fabric_mapping: Optional[dict] = None
    ) -> Dict:
        """
        Import SAN configuration from text data (CLI output, CSV, etc.).

        Args:
            data: Raw text data to parse
            fabric_id: ID of existing fabric to use for all imports (legacy single-fabric mode)
            fabric_name_override: Optional fabric name to use when creating new fabric (legacy)
            zoneset_name_override: Optional zoneset name to use when creating new fabric (legacy)
            vsan_override: Optional VSAN to use when creating new fabric (legacy)
            create_new_fabric: If True, create new fabric; if False, use existing (legacy)
            conflict_resolutions: Dict mapping item names to resolution action (skip/replace/rename)
            fabric_mapping: Dict mapping parsed fabric names to target fabric config
                           Format: {
                               "parsed_fabric_name": {
                                   "fabric_id": 123  # Use existing fabric
                               }
                               OR
                               "parsed_fabric_name": {
                                   "create_new": True,
                                   "name": "New Fabric Name",
                                   "zoneset_name": "zoneset",
                                   "vsan": "10"
                               }
                           }

        Returns:
            Dict with import statistics
        """
        self._report_progress(0, 100, "Detecting data format...")

        # Auto-detect parser (now includes InsightsParser)
        parser = None
        for parser_class in [InsightsParser, CiscoParser, BrocadeParser]:
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

        # Route to appropriate import method based on type
        if parse_result.import_type == 'storage':
            logger.info("Detected storage import (IBM Storage Insights)")
            return self._import_storage_data(parse_result)
        else:
            logger.info("Detected SAN configuration import")
            # Validate and import SAN data
            return self._import_parse_result(
                parse_result,
                fabric_id,
                fabric_name_override,
                zoneset_name_override,
                vsan_override,
                create_new_fabric,
                conflict_resolutions or {},
                fabric_mapping
            )

    def preview_import(self, data: str, check_conflicts: bool = False) -> Dict:
        """
        Preview what would be imported without committing to database.

        Args:
            data: Raw text data to parse (SAN text or JSON credentials)
            check_conflicts: If True, check for duplicate zones (SAN only)

        Returns:
            Dict with preview information
        """
        # Auto-detect parser (including InsightsParser)
        parser = None
        for parser_class in [InsightsParser, CiscoParser, BrocadeParser]:
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

        # Handle storage import preview differently
        if parse_result.import_type == 'storage':
            return self._preview_storage_import(parse_result)

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
            'switches': [
                {
                    'name': s.name,
                    'wwnn': s.wwnn,
                    'model': s.model,
                    'serial_number': s.serial_number,
                    'firmware_version': s.firmware_version,
                    'ip_address': s.ip_address,
                    'domain_id': s.domain_id,
                    'fabric': s.fabric_name,
                    'is_active': s.is_active,
                    'location': s.location
                }
                for s in parse_result.switches
            ],
            'counts': {
                'fabrics': len(active_fabrics),  # Use filtered count
                'aliases': len(unique_aliases),  # Use deduplicated count
                'zones': len(parse_result.zones),
                'switches': len(parse_result.switches)
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

    def _preview_storage_import(self, parse_result: ParseResult) -> Dict:
        """
        Preview storage import (IBM Storage Insights).

        Args:
            parse_result: ParseResult with storage data

        Returns:
            Dict with preview information for storage systems, volumes, hosts
        """
        return {
            'success': True,
            'import_type': 'storage',
            'parser': 'InsightsParser',
            'metadata': parse_result.metadata,
            'storage_systems': [
                {
                    'storage_system_id': sys.storage_system_id,
                    'name': sys.name,
                    'type': sys.storage_type,
                    'vendor': sys.vendor,
                    'model': sys.model,
                    'serial_number': sys.serial_number,
                    'capacity_bytes': sys.capacity_bytes,
                    'used_capacity_bytes': sys.used_capacity_bytes,
                    'used_capacity_percent': sys.used_capacity_percent,
                    'status': sys.probe_status
                }
                for sys in parse_result.storage_systems
            ],
            'volumes': [
                {
                    'volume_id': vol.volume_id,
                    'name': vol.name,
                    'storage_system_id': vol.storage_system_id,
                    'capacity_bytes': vol.capacity_bytes,
                    'used_capacity_bytes': vol.used_capacity_bytes,
                    'pool_name': vol.pool_name,
                    'thin_provisioned': vol.thin_provisioned
                }
                for vol in parse_result.volumes
            ],
            'hosts': [
                {
                    'name': host.name,
                    'storage_system_id': host.storage_system_id,
                    'wwpn_count': len(host.wwpns),
                    'wwpns': host.wwpns[:5],  # Show first 5 WWPNs
                    'host_type': host.host_type,
                    'status': host.status
                }
                for host in parse_result.hosts
            ],
            'counts': {
                'storage_systems': len(parse_result.storage_systems),
                'volumes': len(parse_result.volumes),
                'hosts': len(parse_result.hosts),
                'ports': len(parse_result.ports)
            },
            'errors': parse_result.errors,
            'warnings': parse_result.warnings
        }

    @transaction.atomic
    def _import_parse_result(
        self,
        parse_result: ParseResult,
        fabric_id: Optional[int] = None,
        fabric_name_override: Optional[str] = None,
        zoneset_name_override: Optional[str] = None,
        vsan_override: Optional[str] = None,
        create_new_fabric: bool = False,
        conflict_resolutions: Optional[dict] = None,
        fabric_mapping: Optional[dict] = None
    ) -> Dict:
        """Import parsed data into database within a transaction"""

        conflict_resolutions = conflict_resolutions or {}
        self._report_progress(40, 100, "Determining target fabric...")

        # NEW: Fabric mapping mode - map each parsed fabric to a target fabric
        if fabric_mapping:
            logger.info(f"Using fabric mapping mode with {len(fabric_mapping)} mapped fabrics")
            fabric_map = self._build_fabric_map_from_mapping(parse_result, fabric_mapping)
        # LEGACY: If user selected existing fabric, use it for everything
        elif fabric_id:
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

        # Import switches (if any)
        if parse_result.switches:
            self._report_progress(90, 100, "Importing switches...")
            self._import_switches(parse_result.switches, fabric_map)

        self._report_progress(100, 100, "Import complete!")

        return {
            'success': True,
            'stats': self.stats,
            'fabrics': list(fabric_map.values()),
            'metadata': parse_result.metadata
        }

    def _build_fabric_map_from_mapping(
        self,
        parse_result: ParseResult,
        fabric_mapping: dict
    ) -> Dict[str, Fabric]:
        """
        Build fabric map from user-provided fabric mapping.

        Args:
            parse_result: Parsed data containing fabric information
            fabric_mapping: Dict mapping parsed fabric names to target fabric config

        Returns:
            Dict mapping parsed fabric name to Fabric instance
        """
        fabric_map = {}

        for parsed_fabric in parse_result.fabrics:
            fabric_name = parsed_fabric.name

            # Get mapping config for this fabric
            if fabric_name not in fabric_mapping:
                logger.warning(f"No mapping found for fabric {fabric_name}, skipping")
                self.stats['warnings'].append(f"No mapping found for fabric {fabric_name}")
                continue

            mapping_config = fabric_mapping[fabric_name]

            try:
                # Check if we should use an existing fabric
                if 'fabric_id' in mapping_config:
                    fabric_id = mapping_config['fabric_id']
                    from san.models import Fabric
                    fabric = Fabric.objects.get(id=fabric_id, customer=self.customer)
                    logger.info(f"Mapped {fabric_name} to existing fabric: {fabric.name} (ID: {fabric_id})")
                    fabric_map[fabric_name] = fabric

                # Or create a new fabric
                elif mapping_config.get('create_new'):
                    new_fabric_name = mapping_config.get('name', fabric_name)
                    zoneset_name = mapping_config.get('zoneset_name', parsed_fabric.zoneset_name or '')
                    vsan = mapping_config.get('vsan', parsed_fabric.vsan)

                    from san.models import Fabric
                    fabric = Fabric.objects.create(
                        customer=self.customer,
                        name=new_fabric_name,
                        san_vendor=parsed_fabric.san_vendor,
                        zoneset_name=zoneset_name,
                        vsan=vsan
                    )
                    self.stats['fabrics_created'] += 1
                    logger.info(f"Created new fabric {new_fabric_name} for {fabric_name}")
                    fabric_map[fabric_name] = fabric

                else:
                    error_msg = f"Invalid mapping config for fabric {fabric_name}: {mapping_config}"
                    self.stats['errors'].append(error_msg)
                    logger.error(error_msg)

            except Exception as e:
                error_msg = f"Error mapping fabric {fabric_name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

        return fabric_map

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

                    # Prepare defaults dict
                    fabric_defaults = {
                        'san_vendor': parsed_fabric.san_vendor,
                        'zoneset_name': zoneset_name,
                        'vsan': vsan
                    }

                    # If importing within a project, set created_by_project for new fabrics
                    if self.project_id:
                        try:
                            from core.models import Project
                            project = Project.objects.get(id=self.project_id)
                            fabric_defaults['created_by_project'] = project
                        except Project.DoesNotExist:
                            pass  # Project not found, proceed without setting created_by_project

                    fabric, created = Fabric.objects.get_or_create(
                        customer=self.customer,
                        name=fabric_name,
                        defaults=fabric_defaults
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

                # Get fabric for this alias
                # NEW: If alias has a fabric_name, use it to look up the mapped fabric
                # LEGACY: If fabric_map has only one fabric, use that for all aliases
                fabric = None
                if parsed_alias.fabric_name and parsed_alias.fabric_name in fabric_map:
                    # Use the specific fabric mapped for this alias's source fabric
                    fabric = fabric_map[parsed_alias.fabric_name]
                    logger.debug(f"Using mapped fabric {fabric.name} for alias {alias_name} from {parsed_alias.fabric_name}")
                elif len(fabric_map) == 1:
                    # Legacy mode: single fabric for all imports
                    fabric = list(fabric_map.values())[0]
                    logger.debug(f"Using single fabric {fabric.name} for alias {alias_name}")
                else:
                    # Multiple fabrics available but no mapping - skip this alias
                    self.stats['warnings'].append(
                        f"No fabric mapping found for alias {alias_name} (source fabric: {parsed_alias.fabric_name})"
                    )
                    logger.warning(f"Skipping alias {alias_name} - no fabric mapping")
                    continue

                # Create or update alias
                # NOTE: Alias model now uses (fabric, name) as unique identifier
                # WWPNs are stored in separate AliasWWPN junction table

                # Prepare defaults dict
                alias_defaults = {
                    'cisco_alias': parsed_alias.alias_type,  # Field is 'cisco_alias' not 'alias_type'
                    'use': parsed_alias.use or ''
                }

                # If importing within a project, set created_by_project for new aliases
                if self.project_id:
                    try:
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        alias_defaults['created_by_project'] = project
                    except Project.DoesNotExist:
                        pass  # Project not found, proceed without setting created_by_project

                alias, created = Alias.objects.update_or_create(
                    fabric=fabric,
                    name=parsed_alias.name,
                    defaults=alias_defaults
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
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        # Use junction table instead of M2M
                        ProjectAlias.objects.get_or_create(
                            project=project,
                            alias=alias,
                            defaults={
                                'action': 'new',  # Fixed: was 'create', should be 'new' for commit detection
                                'include_in_zoning': False,
                                'added_by': None,
                                'notes': 'Imported from SAN configuration'
                            }
                        )
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

                # Get fabric for this zone
                # NEW: If zone has a fabric_name, use it to look up the mapped fabric
                # LEGACY: If fabric_map has only one fabric, use that for all zones
                fabric = None
                if parsed_zone.fabric_name and parsed_zone.fabric_name in fabric_map:
                    # Use the specific fabric mapped for this zone's source fabric
                    fabric = fabric_map[parsed_zone.fabric_name]
                    logger.debug(f"Using mapped fabric {fabric.name} for zone {zone_name} from {parsed_zone.fabric_name}")
                elif len(fabric_map) == 1:
                    # Legacy mode: single fabric for all imports
                    fabric = list(fabric_map.values())[0]
                    logger.debug(f"Using single fabric {fabric.name} for zone {zone_name}")
                else:
                    # Multiple fabrics available but no mapping - skip this zone
                    self.stats['warnings'].append(
                        f"No fabric mapping found for zone {zone_name} (source fabric: {parsed_zone.fabric_name})"
                    )
                    logger.warning(f"Skipping zone {zone_name} - no fabric mapping")
                    continue

                # Create or update zone

                # Prepare defaults dict
                zone_defaults = {
                    'zone_type': parsed_zone.zone_type if parsed_zone.zone_type in ['smart', 'standard'] else 'standard'
                }

                # If importing within a project, set created_by_project for new zones
                if self.project_id:
                    try:
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        zone_defaults['created_by_project'] = project
                    except Project.DoesNotExist:
                        pass  # Project not found, proceed without setting created_by_project

                zone, created = Zone.objects.update_or_create(
                    fabric=fabric,
                    name=parsed_zone.name,
                    defaults=zone_defaults
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
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        # Use junction table instead of M2M
                        ProjectZone.objects.get_or_create(
                            project=project,
                            zone=zone,
                            defaults={
                                'action': 'new',  # Fixed: was 'create', should be 'new' for commit detection
                                'added_by': None,
                                'notes': 'Imported from SAN configuration'
                            }
                        )
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

    def _import_switches(
        self,
        parsed_switches: List[ParsedSwitch],
        fabric_map: Dict[str, Fabric]
    ) -> Dict[str, Switch]:
        """
        Import switches into database.

        Args:
            parsed_switches: List of switches to import
            fabric_map: Mapping of fabric names to Fabric instances

        Returns:
            Dict mapping switch name to Switch instance
        """
        switch_map = {}

        if not parsed_switches:
            logger.warning("No switches to import!")
            return switch_map

        for i, parsed_switch in enumerate(parsed_switches):
            if i % 10 == 0:  # Update progress every 10 switches
                progress = 90 + int(10 * i / len(parsed_switches))
                self._report_progress(progress, 100, f"Importing switches ({i}/{len(parsed_switches)})...")

            try:
                switch_name = parsed_switch.name

                # Get fabric for this switch (optional - switches can exist without fabric assignment)
                fabric = None
                if fabric_map:
                    if parsed_switch.fabric_name and parsed_switch.fabric_name in fabric_map:
                        # Use the specific fabric mapped for this switch's source fabric
                        fabric = fabric_map[parsed_switch.fabric_name]
                        logger.debug(f"Mapped switch {switch_name} to fabric {fabric.name}")
                    elif len(fabric_map) == 1:
                        # If only one fabric, use it
                        fabric = list(fabric_map.values())[0]
                        logger.debug(f"Assigned switch {switch_name} to single fabric {fabric.name}")
                    else:
                        logger.info(f"Switch {switch_name} will be imported without fabric assignment")
                else:
                    logger.info(f"Switch {switch_name} will be imported without fabric assignment")

                # Create or update switch
                switch, created = Switch.objects.update_or_create(
                    customer=self.customer,
                    name=switch_name,
                    defaults={
                        'wwnn': parsed_switch.wwnn,
                        'san_vendor': parsed_switch.san_vendor,
                        'model': parsed_switch.model,
                        'serial_number': parsed_switch.serial_number,
                        'firmware_version': parsed_switch.firmware_version,
                        'ip_address': parsed_switch.ip_address,
                        'is_active': parsed_switch.is_active,
                        'location': parsed_switch.location,
                        'notes': parsed_switch.notes
                    }
                )

                # Link to fabric if one was specified
                if fabric:
                    from san.models import SwitchFabric
                    SwitchFabric.objects.update_or_create(
                        switch=switch,
                        fabric=fabric,
                        defaults={'domain_id': parsed_switch.domain_id}
                    )

                if created:
                    self.stats['switches_created'] += 1
                    logger.info(f"Created switch: {switch_name}")
                else:
                    self.stats['switches_updated'] += 1
                    logger.info(f"Updated switch: {switch_name}")

                switch_map[switch_name] = switch

            except Exception as e:
                error_msg = f"Error importing switch {parsed_switch.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

        return switch_map

    def _import_storage_data(self, parse_result: ParseResult) -> Dict:
        """
        Import storage systems, volumes, hosts from parsed IBM Storage Insights data.

        Args:
            parse_result: ParseResult with storage_systems, volumes, hosts populated

        Returns:
            Dict with import statistics
        """
        self._report_progress(40, 100, "Starting storage import...")

        try:
            # Import storage systems
            if parse_result.storage_systems:
                self._report_progress(45, 100, f"Importing {len(parse_result.storage_systems)} storage systems...")
                self._import_storage_systems(parse_result.storage_systems)

            # Import volumes
            if parse_result.volumes:
                self._report_progress(60, 100, f"Importing {len(parse_result.volumes)} volumes...")
                self._import_volumes(parse_result.volumes)

            # Import hosts
            if parse_result.hosts:
                self._report_progress(80, 100, f"Importing {len(parse_result.hosts)} hosts...")
                self._import_hosts(parse_result.hosts)

            # Import ports (if any)
            if parse_result.ports:
                self._report_progress(95, 100, f"Importing {len(parse_result.ports)} ports...")
                self._import_ports(parse_result.ports)

            self._report_progress(100, 100, "Storage import complete!")

            # Clear dashboard cache when import completes
            try:
                from core.dashboard_views import clear_dashboard_cache_for_customer
                clear_dashboard_cache_for_customer(self.customer.id)
            except Exception as e:
                logger.warning(f"Failed to clear dashboard cache: {e}")

            return {
                'success': True,
                'stats': self.stats,
                'metadata': parse_result.metadata
            }

        except Exception as e:
            error_msg = f"Storage import failed: {str(e)}"
            self.stats['errors'].append(error_msg)
            logger.error(error_msg)
            raise

    @transaction.atomic
    def _import_storage_systems(self, parsed_systems: List[ParsedStorageSystem]):
        """Import storage systems into database"""
        logger.info(f"Importing {len(parsed_systems)} storage systems")

        for system in parsed_systems:
            try:
                # Build defaults dict with all non-None fields
                defaults = {
                    'customer': self.customer,
                    'name': system.name,
                    'storage_type': system.storage_type,
                }

                # Add all optional fields that have values
                optional_fields = [
                    'vendor', 'model', 'serial_number', 'machine_type', 'system_id',
                    'wwnn', 'firmware_level', 'uuid', 'location',
                    'primary_ip', 'secondary_ip',
                    'probe_status', 'condition', 'events_status', 'pm_status',
                    'raw_capacity_bytes', 'capacity_bytes', 'used_capacity_bytes',
                    'used_capacity_percent', 'available_capacity_bytes',
                    'available_system_capacity_bytes', 'available_system_capacity_percent',
                    'available_volume_capacity_bytes', 'available_written_capacity_bytes',
                    'provisioned_capacity_bytes', 'provisioned_capacity_percent',
                    'provisioned_written_capacity_percent', 'mapped_capacity_bytes',
                    'mapped_capacity_percent', 'unmapped_capacity_bytes', 'unmapped_capacity_percent',
                    'overhead_capacity_bytes', 'used_written_capacity_bytes',
                    'used_written_capacity_percent', 'written_capacity_limit_bytes',
                    'overprovisioned_capacity_bytes', 'unallocated_volume_capacity_bytes',
                    'remaining_unallocated_capacity_bytes', 'shortfall_percent',
                    'deduplication_savings_bytes', 'deduplication_savings_percent',
                    'compression_savings_bytes', 'compression_savings_percent',
                    'capacity_savings_bytes', 'capacity_savings_percent',
                    'data_reduction_savings_bytes', 'data_reduction_savings_percent',
                    'data_reduction_ratio', 'total_compression_ratio', 'total_savings_ratio',
                    'drive_compression_ratio', 'drive_compression_savings_bytes',
                    'drive_compression_savings_percent', 'pool_compression_ratio',
                    'pool_compression_savings_bytes', 'pool_compression_savings_percent',
                    'snapshot_written_capacity_bytes', 'snapshot_provisioned_capacity_bytes',
                    'safe_guarded_capacity_bytes', 'safeguarded_virtual_capacity_bytes',
                    'safeguarded_used_capacity_percentage',
                    'read_cache_bytes', 'write_cache_bytes',
                    'volumes_count', 'pools_count', 'disks_count', 'managed_disks_count',
                    'fc_ports_count', 'ip_ports_count', 'host_connections_count',
                    'volume_groups_count', 'unprotected_volumes_count', 'remote_relationships_count',
                    'recent_fill_rate', 'recent_growth', 'current_power_usage_watts',
                    'system_temperature_celsius', 'system_temperature_Fahrenheit',
                    'power_efficiency', 'co2_emission',
                    'last_successful_probe', 'last_successful_monitor',
                    'customer_country_code', 'customer_number', 'data_collection',
                    'data_collection_type', 'time_zone', 'staas_environment',
                    'element_manager_url', 'probe_schedule', 'acknowledged', 'compressed',
                    'callhome_system', 'ransomware_threat_detection',
                    'threat_notification_recipients', 'topology', 'cluster_id_alias'
                ]

                for field in optional_fields:
                    value = getattr(system, field, None)
                    if value is not None:
                        defaults[field] = value

                # Add timestamps
                defaults['imported'] = timezone.now()
                defaults['updated'] = timezone.now()

                # If importing within a project, set created_by_project for new storage systems
                if self.project_id:
                    try:
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        defaults['created_by_project'] = project
                    except Project.DoesNotExist:
                        pass  # Project not found, proceed without setting created_by_project

                # Create or update storage system
                storage, created = Storage.objects.update_or_create(
                    storage_system_id=system.storage_system_id,
                    customer=self.customer,
                    defaults=defaults
                )

                if created:
                    self.stats['storage_systems_created'] += 1
                    logger.info(f"Created storage system: {system.name}")
                else:
                    self.stats['storage_systems_updated'] += 1
                    logger.info(f"Updated storage system: {system.name}")

            except Exception as e:
                error_msg = f"Failed to import storage system {system.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

    @transaction.atomic
    def _import_volumes(self, parsed_volumes: List[ParsedVolume]):
        """Import volumes into database"""
        logger.info(f"Importing {len(parsed_volumes)} volumes")

        # Build mapping of storage_system_id to Storage objects
        system_cache = {}

        for volume in parsed_volumes:
            try:
                # Get parent storage system (with caching)
                if volume.storage_system_id not in system_cache:
                    try:
                        system_cache[volume.storage_system_id] = Storage.objects.get(
                            storage_system_id=volume.storage_system_id,
                            customer=self.customer
                        )
                    except Storage.DoesNotExist:
                        self.stats['warnings'].append(
                            f"Storage system {volume.storage_system_id} not found for volume {volume.name}"
                        )
                        continue

                storage = system_cache[volume.storage_system_id]

                # Build defaults dict
                defaults = {
                    'storage': storage,
                    'name': volume.name,
                    'volume_id': volume.volume_id,
                }

                # Add all optional fields that have values
                optional_fields = [
                    'capacity_bytes', 'used_capacity_bytes', 'used_capacity_percent',
                    'available_capacity_bytes', 'written_capacity_bytes', 'written_capacity_percent',
                    'reserved_volume_capacity_bytes', 'pool_name', 'pool_id',
                    'thin_provisioned', 'compressed', 'raid_level', 'encryption',
                    'flashcopy', 'auto_expand', 'status_label', 'acknowledged',
                    'node', 'io_group', 'volume_number', 'natural_key',
                    'easy_tier', 'easy_tier_status',
                    'tier0_flash_capacity_percent', 'tier1_flash_capacity_percent',
                    'scm_capacity_percent', 'enterprise_hdd_capacity_percent',
                    'nearline_hdd_capacity_percent', 'tier0_flash_capacity_bytes',
                    'tier1_flash_capacity_bytes', 'scm_capacity_bytes',
                    'enterprise_hdd_capacity_bytes', 'nearline_hdd_capacity_bytes',
                    'safeguarded_virtual_capacity_bytes', 'safeguarded_used_capacity_percentage',
                    'safeguarded_allocation_capacity_bytes'
                ]

                for field in optional_fields:
                    value = getattr(volume, field, None)
                    if value is not None:
                        defaults[field] = value

                # Create unique_id for volume
                unique_id = f"{volume.storage_system_id}_{volume.volume_id}"

                # If importing within a project, set created_by_project for new volumes
                if self.project_id:
                    try:
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        defaults['created_by_project'] = project
                    except Project.DoesNotExist:
                        pass  # Project not found, proceed without setting created_by_project

                # Create or update volume
                vol, created = Volume.objects.update_or_create(
                    unique_id=unique_id,
                    defaults=defaults
                )

                if created:
                    self.stats['volumes_created'] += 1
                else:
                    self.stats['volumes_updated'] += 1

            except Exception as e:
                error_msg = f"Failed to import volume {volume.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

    @transaction.atomic
    def _import_hosts(self, parsed_hosts: List[ParsedHost]):
        """Import hosts with WWPNs into database"""
        logger.info(f"Importing {len(parsed_hosts)} hosts")

        # Build mapping of storage_system_id to Storage objects
        system_cache = {}

        for host in parsed_hosts:
            try:
                # Get parent storage system (with caching)
                if host.storage_system_id not in system_cache:
                    try:
                        system_cache[host.storage_system_id] = Storage.objects.get(
                            storage_system_id=host.storage_system_id,
                            customer=self.customer
                        )
                    except Storage.DoesNotExist:
                        self.stats['warnings'].append(
                            f"Storage system {host.storage_system_id} not found for host {host.name}"
                        )
                        continue

                storage = system_cache[host.storage_system_id]

                # Build defaults dict - only include fields that exist in the model
                defaults = {}

                # Add all optional fields that have values
                optional_fields = [
                    'host_type', 'status', 'acknowledged', 'storage_system',
                    'associated_resource', 'volume_group', 'vols_count',
                    'fc_ports_count', 'natural_key', 'last_data_collection'
                ]

                for field in optional_fields:
                    value = getattr(host, field, None)
                    if value is not None:
                        defaults[field] = value

                # Add timestamps
                defaults['imported'] = timezone.now()

                # If importing within a project, set created_by_project for new hosts
                if self.project_id:
                    try:
                        from core.models import Project
                        project = Project.objects.get(id=self.project_id)
                        defaults['created_by_project'] = project
                    except Project.DoesNotExist:
                        pass  # Project not found, proceed without setting created_by_project

                # Create or update host - lookup by name and storage
                host_obj, created = Host.objects.update_or_create(
                    name=host.name,
                    storage=storage,
                    defaults=defaults
                )

                # Clear existing manual WWPNs and recreate
                HostWwpn.objects.filter(host=host_obj, source_type='manual').delete()

                # Create new HostWwpn entries
                for wwpn in host.wwpns:
                    HostWwpn.objects.create(
                        host=host_obj,
                        wwpn=wwpn,
                        source_type='manual'
                    )

                if created:
                    self.stats['hosts_created'] += 1
                    logger.info(f"Created host: {host.name} with {len(host.wwpns)} WWPNs")
                else:
                    self.stats['hosts_updated'] += 1
                    logger.info(f"Updated host: {host.name} with {len(host.wwpns)} WWPNs")

            except Exception as e:
                error_msg = f"Failed to import host {host.name}: {e}"
                self.stats['errors'].append(error_msg)
                logger.error(error_msg)

    @transaction.atomic
    def _import_ports(self, parsed_ports: List[ParsedPort]):
        """Import storage ports (placeholder for future implementation)"""
        logger.info(f"Port import not yet implemented ({len(parsed_ports)} ports found)")
        # TODO: Implement port import if Port model is created
        self.stats['warnings'].append(f"{len(parsed_ports)} ports found but port import not yet implemented")
