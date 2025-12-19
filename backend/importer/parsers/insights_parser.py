"""
IBM Storage Insights Parser

This parser integrates IBM Storage Insights API into the universal importer framework.
It treats API credentials as a "parseable source" just like Cisco/Brocade CLI text.
"""

from .base_parser import (
    BaseParser, ParseResult,
    ParsedStorageSystem, ParsedVolume, ParsedHost, ParsedPort
)
from .insights_api_client_v2 import StorageInsightsClientV2
from typing import Dict, Optional, List
import json
import logging
import re

logger = logging.getLogger(__name__)


class InsightsParser(BaseParser):
    """Parser for IBM Storage Insights API data"""

    def __init__(self):
        super().__init__()
        self.client = None
        self.progress_callback_fn = None

    def detect_format(self, data: str) -> bool:
        """
        Detect if input contains IBM Storage Insights credentials.

        Expects JSON with structure:
        {
            "tenant_id": "...",
            "api_key": "...",
            "selected_systems": [...],  # Optional
            "import_options": {...}     # Optional
        }
        """
        try:
            parsed = json.loads(data)
            return 'tenant_id' in parsed and 'api_key' in parsed
        except:
            return False

    def parse(self, data: str) -> ParseResult:
        """
        Parse IBM Storage Insights API credentials and fetch data.

        Args:
            data: JSON string with credentials and options

        Returns:
            ParseResult with storage_systems, volumes, hosts populated
        """
        try:
            config = json.loads(data)

            # Extract credentials
            tenant_id = config['tenant_id']
            api_key = config['api_key']
            selected_systems = config.get('selected_systems', None)
            import_options = config.get('import_options', {
                'storage_systems': True,
                'volumes': True,
                'hosts': True,
                'ports': False
            })
            filters = config.get('filters', {})

            # Create V2 client with parallel support
            self.client = StorageInsightsClientV2(
                tenant_id=tenant_id,
                api_key=api_key,
                max_workers=5
            )

            self.add_metadata('tenant_id', tenant_id)
            self.add_metadata('import_options', import_options)
            self.add_metadata('selected_systems', selected_systems)
            self.add_metadata('parser', 'InsightsParser')

            logger.info(f"InsightsParser: Fetching data from IBM Storage Insights for tenant {tenant_id}")

            # Fetch data using optimized V2 client
            api_data = self.client.get_all_data_optimized(
                storage_system_ids=selected_systems,
                import_options=import_options,
                progress_callback=self._progress_callback
            )

            logger.info(f"InsightsParser: Received {len(api_data['storage_systems'])} storage systems")

            # Debug: Log volumes_by_system structure
            volumes_by_system = api_data.get('volumes_by_system', {})
            total_raw_volumes = sum(len(v) for v in volumes_by_system.values())
            logger.info(f"InsightsParser: Received volumes_by_system with {len(volumes_by_system)} systems and {total_raw_volumes} total raw volumes")
            for sys_id, vols in volumes_by_system.items():
                logger.info(f"InsightsParser: System {sys_id} has {len(vols)} raw volumes")
                if vols:
                    # Log first volume structure for debugging
                    logger.debug(f"InsightsParser: Sample volume keys: {list(vols[0].keys()) if vols else 'none'}")

            # Transform API data to ParseResult
            storage_systems = self._parse_storage_systems(
                api_data['storage_systems']
            )

            volumes = self._parse_volumes(
                volumes_by_system
            )

            hosts = self._parse_hosts(
                api_data['hosts_by_system']
            )

            ports = self._parse_ports(
                api_data.get('ports_by_system', {})
            )

            logger.info(f"InsightsParser: Parsed {len(storage_systems)} systems, {len(volumes)} volumes, {len(hosts)} hosts")

            return ParseResult(
                # SAN fields (empty for storage imports)
                fabrics=[],
                aliases=[],
                zones=[],
                switches=[],

                # Storage fields (populated)
                storage_systems=storage_systems,
                volumes=volumes,
                hosts=hosts,
                ports=ports,

                # Metadata
                errors=self.errors,
                warnings=self.warnings,
                metadata=self.metadata,
                import_type='storage'
            )

        except Exception as e:
            error_msg = f"Failed to fetch from IBM Storage Insights: {str(e)}"
            logger.error(f"InsightsParser: {error_msg}")
            self.add_error(error_msg)
            return ParseResult(
                fabrics=[], aliases=[], zones=[], switches=[],
                storage_systems=[], volumes=[], hosts=[], ports=[],
                errors=self.errors, warnings=self.warnings,
                metadata=self.metadata,
                import_type='storage'
            )

    def _parse_storage_systems(self, systems_data: List[Dict]) -> List[ParsedStorageSystem]:
        """Transform API storage systems to ParsedStorageSystem objects"""
        parsed_systems = []

        for system in systems_data:
            try:
                # Extract required fields
                storage_system_id = system.get('storage_system_id')
                if not storage_system_id:
                    self.add_warning(f"Storage system missing storage_system_id: {system.get('name', 'unknown')}")
                    continue

                name = system.get('name', '')
                storage_type = self._map_storage_type(system.get('type', ''))

                # Build ParsedStorageSystem with all available fields
                parsed_systems.append(ParsedStorageSystem(
                    storage_system_id=storage_system_id,
                    name=name,
                    storage_type=storage_type,

                    # Basic info
                    vendor=system.get('vendor'),
                    model=system.get('model'),
                    serial_number=system.get('serial_number'),
                    machine_type=system.get('machine_type'),
                    system_id=system.get('system_id'),
                    wwnn=system.get('wwnn'),
                    firmware_level=system.get('firmware_level'),
                    uuid=system.get('uuid'),
                    location=system.get('location'),

                    # Network
                    primary_ip=system.get('primary_ip'),
                    secondary_ip=system.get('secondary_ip'),

                    # System health
                    probe_status=system.get('probe_status'),
                    condition=system.get('condition'),
                    events_status=system.get('events_status'),
                    pm_status=system.get('pm_status'),

                    # Capacity fields (comprehensive mapping)
                    raw_capacity_bytes=system.get('raw_capacity_bytes'),
                    capacity_bytes=system.get('capacity_bytes'),
                    used_capacity_bytes=system.get('used_capacity_bytes'),
                    used_capacity_percent=system.get('used_capacity_percent'),
                    available_capacity_bytes=system.get('available_capacity_bytes'),
                    available_system_capacity_bytes=system.get('available_system_capacity_bytes'),
                    available_system_capacity_percent=system.get('available_system_capacity_percent'),
                    available_volume_capacity_bytes=system.get('available_volume_capacity_bytes'),
                    available_written_capacity_bytes=system.get('available_written_capacity_bytes'),
                    provisioned_capacity_bytes=system.get('provisioned_capacity_bytes'),
                    provisioned_capacity_percent=system.get('provisioned_capacity_percent'),
                    provisioned_written_capacity_percent=system.get('provisioned_written_capacity_percent'),
                    mapped_capacity_bytes=system.get('mapped_capacity_bytes'),
                    mapped_capacity_percent=system.get('mapped_capacity_percent'),
                    unmapped_capacity_bytes=system.get('unmapped_capacity_bytes'),
                    unmapped_capacity_percent=system.get('unmapped_capacity_percent'),
                    overhead_capacity_bytes=system.get('overhead_capacity_bytes'),
                    used_written_capacity_bytes=system.get('used_written_capacity_bytes'),
                    used_written_capacity_percent=system.get('used_written_capacity_percent'),
                    written_capacity_limit_bytes=system.get('written_capacity_limit_bytes'),
                    overprovisioned_capacity_bytes=system.get('overprovisioned_capacity_bytes'),
                    unallocated_volume_capacity_bytes=system.get('unallocated_volume_capacity_bytes'),
                    remaining_unallocated_capacity_bytes=system.get('remaining_unallocated_capacity_bytes'),
                    shortfall_percent=system.get('shortfall_percent'),

                    # Efficiency and data reduction
                    deduplication_savings_bytes=system.get('deduplication_savings_bytes'),
                    deduplication_savings_percent=system.get('deduplication_savings_percent'),
                    compression_savings_bytes=system.get('compression_savings_bytes'),
                    compression_savings_percent=system.get('compression_savings_percent'),
                    capacity_savings_bytes=system.get('capacity_savings_bytes'),
                    capacity_savings_percent=system.get('capacity_savings_percent'),
                    data_reduction_savings_bytes=system.get('data_reduction_savings_bytes'),
                    data_reduction_savings_percent=system.get('data_reduction_savings_percent'),
                    data_reduction_ratio=system.get('data_reduction_ratio'),
                    total_compression_ratio=system.get('total_compression_ratio'),
                    total_savings_ratio=system.get('total_savings_ratio'),
                    drive_compression_ratio=system.get('drive_compression_ratio'),
                    drive_compression_savings_bytes=system.get('drive_compression_savings_bytes'),
                    drive_compression_savings_percent=system.get('drive_compression_savings_percent'),
                    pool_compression_ratio=system.get('pool_compression_ratio'),
                    pool_compression_savings_bytes=system.get('pool_compression_savings_bytes'),
                    pool_compression_savings_percent=system.get('pool_compression_savings_percent'),

                    # Snapshots
                    snapshot_written_capacity_bytes=system.get('snapshot_written_capacity_bytes'),
                    snapshot_provisioned_capacity_bytes=system.get('snapshot_provisioned_capacity_bytes'),

                    # Safeguarded
                    safe_guarded_capacity_bytes=system.get('safe_guarded_capacity_bytes'),
                    safeguarded_virtual_capacity_bytes=system.get('safeguarded_virtual_capacity_bytes'),
                    safeguarded_used_capacity_percentage=system.get('safeguarded_used_capacity_percentage'),

                    # Cache
                    read_cache_bytes=system.get('read_cache_bytes'),
                    write_cache_bytes=system.get('write_cache_bytes'),

                    # Counts
                    volumes_count=system.get('volumes_count'),
                    pools_count=system.get('pools_count'),
                    disks_count=system.get('disks_count'),
                    managed_disks_count=system.get('managed_disks_count'),
                    fc_ports_count=system.get('fc_ports_count'),
                    ip_ports_count=system.get('ip_ports_count'),
                    host_connections_count=system.get('host_connections_count'),
                    volume_groups_count=system.get('volume_groups_count'),
                    unprotected_volumes_count=system.get('unprotected_volumes_count'),
                    remote_relationships_count=system.get('remote_relationships_count'),

                    # Performance and metrics
                    recent_fill_rate=system.get('recent_fill_rate'),
                    recent_growth=system.get('recent_growth'),
                    current_power_usage_watts=system.get('current_power_usage_watts'),
                    system_temperature_celsius=system.get('system_temperature_celsius'),
                    system_temperature_Fahrenheit=system.get('system_temperature_Fahrenheit'),
                    power_efficiency=system.get('power_efficiency'),
                    co2_emission=system.get('co2_emission'),

                    # Timestamps
                    last_successful_probe=system.get('last_successful_probe'),
                    last_successful_monitor=system.get('last_successful_monitor'),

                    # Customer and system info
                    customer_country_code=system.get('customer_country_code'),
                    customer_number=system.get('customer_number'),
                    data_collection=system.get('data_collection'),
                    data_collection_type=system.get('data_collection_type'),
                    time_zone=system.get('time_zone'),
                    staas_environment=system.get('staas_environment'),
                    element_manager_url=system.get('element_manager_url'),
                    probe_schedule=system.get('probe_schedule'),
                    acknowledged=system.get('acknowledged'),
                    compressed=system.get('compressed'),
                    callhome_system=system.get('callhome_system'),
                    ransomware_threat_detection=system.get('ransomware_threat_detection'),
                    threat_notification_recipients=system.get('threat_notification_recipients'),
                    topology=system.get('topology'),
                    cluster_id_alias=system.get('cluster_id_alias'),
                ))

            except Exception as e:
                self.add_warning(f"Failed to parse system {system.get('name', 'unknown')}: {e}")
                logger.error(f"Error parsing system: {e}")

        return parsed_systems

    def _parse_volumes(self, volumes_by_system: Dict[str, List[Dict]]) -> List[ParsedVolume]:
        """Transform API volumes to ParsedVolume objects"""
        parsed_volumes = []

        for system_id, volumes in volumes_by_system.items():
            logger.info(f"Parsing {len(volumes)} volumes for system {system_id}")
            if volumes and len(volumes) > 0:
                # Log first volume keys for debugging
                first_vol = volumes[0]
                logger.info(f"Sample volume keys for system {system_id}: {list(first_vol.keys())}")
            for volume in volumes:
                try:
                    # API may return volume_id, id, or vdisk_id depending on system type
                    volume_id = (
                        volume.get('volume_id') or
                        volume.get('id') or
                        volume.get('vdisk_id') or
                        volume.get('uid') or
                        volume.get('unique_id')  # Also try unique_id
                    )
                    if not volume_id:
                        self.add_warning(f"Volume missing ID - available keys: {list(volume.keys())}, name: {volume.get('name', 'unknown')}")
                        continue

                    parsed_volumes.append(ParsedVolume(
                        volume_id=volume_id,
                        name=volume.get('name', ''),
                        storage_system_id=system_id,

                        # Capacity
                        capacity_bytes=volume.get('capacity_bytes'),
                        used_capacity_bytes=volume.get('used_capacity_bytes'),
                        used_capacity_percent=volume.get('used_capacity_percent'),
                        available_capacity_bytes=volume.get('available_capacity_bytes'),
                        written_capacity_bytes=volume.get('written_capacity_bytes'),
                        written_capacity_percent=volume.get('written_capacity_percent'),
                        reserved_volume_capacity_bytes=volume.get('reserved_volume_capacity_bytes'),

                        # Pool info
                        pool_name=volume.get('pool_name'),
                        pool_id=volume.get('pool_id'),

                        # Properties
                        thin_provisioned=volume.get('thin_provisioned'),
                        compressed=volume.get('compressed'),
                        raid_level=volume.get('raid_level'),
                        encryption=volume.get('encryption'),
                        flashcopy=volume.get('flashcopy'),
                        auto_expand=volume.get('auto_expand'),

                        # Status and config
                        status_label=volume.get('status_label'),
                        acknowledged=volume.get('acknowledged'),
                        node=volume.get('node'),
                        io_group=volume.get('io_group'),
                        volume_number=volume.get('volume_number'),
                        natural_key=volume.get('naturalKey'),  # Note: API uses camelCase

                        # Easy Tier
                        easy_tier=volume.get('easy_tier'),
                        easy_tier_status=volume.get('easy_tier_status'),

                        # Tier capacity fields
                        tier0_flash_capacity_percent=volume.get('tier0_flash_capacity_percent'),
                        tier1_flash_capacity_percent=volume.get('tier1_flash_capacity_percent'),
                        scm_capacity_percent=volume.get('scm_capacity_percent'),
                        enterprise_hdd_capacity_percent=volume.get('enterprise_hdd_capacity_percent'),
                        nearline_hdd_capacity_percent=volume.get('nearline_hdd_capacity_percent'),
                        tier0_flash_capacity_bytes=volume.get('tier0_flash_capacity_bytes'),
                        tier1_flash_capacity_bytes=volume.get('tier1_flash_capacity_bytes'),
                        scm_capacity_bytes=volume.get('scm_capacity_bytes'),
                        enterprise_hdd_capacity_bytes=volume.get('enterprise_hdd_capacity_bytes'),
                        nearline_hdd_capacity_bytes=volume.get('nearline_hdd_capacity_bytes'),

                        # Safeguarded fields
                        safeguarded_virtual_capacity_bytes=volume.get('safeguarded_virtual_capacity_bytes'),
                        safeguarded_used_capacity_percentage=volume.get('safeguarded_used_capacity_percentage'),
                        safeguarded_allocation_capacity_bytes=volume.get('safeguarded_allocation_capacity_bytes'),
                    ))

                except Exception as e:
                    self.add_warning(f"Failed to parse volume: {e}")
                    logger.error(f"Error parsing volume: {e}")

        return parsed_volumes

    def _parse_hosts(self, hosts_by_system: Dict[str, List[Dict]]) -> List[ParsedHost]:
        """Transform API hosts to ParsedHost objects"""
        parsed_hosts = []

        for system_id, hosts in hosts_by_system.items():
            for host in hosts:
                try:
                    name = host.get('name', '')
                    if not name:
                        continue

                    # Parse WWPNs from API format (can be string, list, etc.)
                    wwpns = self._parse_wwpns(host.get('wwpns', []))

                    parsed_hosts.append(ParsedHost(
                        name=name,
                        storage_system_id=system_id,
                        wwpns=wwpns,

                        # Host info
                        host_type=host.get('host_type'),
                        status=host.get('status'),
                        acknowledged=host.get('acknowledged'),

                        # Relationship
                        storage_system=host.get('storage_system'),
                        associated_resource=host.get('associated_resource'),
                        volume_group=host.get('volume_group'),

                        # Counts
                        vols_count=host.get('vols_count'),
                        fc_ports_count=host.get('fc_ports_count'),

                        # Metadata
                        natural_key=host.get('natural_key'),
                        last_data_collection=host.get('last_data_collection'),
                    ))

                except Exception as e:
                    self.add_warning(f"Failed to parse host: {e}")
                    logger.error(f"Error parsing host: {e}")

        return parsed_hosts

    def _parse_ports(self, ports_by_system: Dict[str, List[Dict]]) -> List[ParsedPort]:
        """Transform API ports to ParsedPort objects"""
        parsed_ports = []

        for system_id, ports in ports_by_system.items():
            for port in ports:
                try:
                    port_id = port.get('port_id') or port.get('id')
                    if not port_id:
                        continue

                    parsed_ports.append(ParsedPort(
                        port_id=port_id,
                        storage_system_id=system_id,
                        wwpn=port.get('wwpn'),
                        port_type=port.get('port_type') or port.get('type'),
                        status=port.get('status'),
                        speed=port.get('speed'),
                        node=port.get('node'),
                        port_name=port.get('port_name') or port.get('name'),
                    ))

                except Exception as e:
                    self.add_warning(f"Failed to parse port: {e}")
                    logger.error(f"Error parsing port: {e}")

        return parsed_ports

    def _parse_wwpns(self, wwpns_data) -> List[str]:
        """
        Parse WWPNs from various API formats (string, list, etc.)

        Handles formats like:
        - "C050760C392D0076,C050760C392D0077" (comma-separated string)
        - ["10:00:00:05:1e:12:34:56", "10:00:00:05:1e:12:34:57"] (list)
        - ["C050760C392D0076", "C050760C392D0077"] (list without colons)
        """
        if not wwpns_data:
            return []

        formatted_wwpns = []

        # Handle case where wwpns_data is a string (most common)
        if isinstance(wwpns_data, str):
            # Split by comma: "C050760C392D0076,C050760C392D0077" -> ["C050760C392D0076", "C050760C392D0077"]
            wwpn_strings = [wwpn.strip() for wwpn in wwpns_data.split(',') if wwpn.strip()]

            for wwpn_hex in wwpn_strings:
                try:
                    formatted = self.normalize_wwpn(wwpn_hex)
                    formatted_wwpns.append(formatted)
                except ValueError as e:
                    self.add_warning(f"Invalid WWPN format: {wwpn_hex}")

        # Handle case where wwpns_data is a list
        elif isinstance(wwpns_data, list):
            for wwpn_raw in wwpns_data:
                if not wwpn_raw:
                    continue

                if isinstance(wwpn_raw, str):
                    try:
                        formatted = self.normalize_wwpn(wwpn_raw)
                        formatted_wwpns.append(formatted)
                    except ValueError as e:
                        self.add_warning(f"Invalid WWPN format: {wwpn_raw}")

        return formatted_wwpns

    def _map_storage_type(self, api_type: str) -> str:
        """Map API type codes to friendly storage type names"""
        type_mapping = {
            '2145': 'FlashSystem',
            '2107': 'DS8000',
            '2076': 'Storwize',
            'flashsystem': 'FlashSystem',
            'ds8000': 'DS8000',
            'storwize': 'Storwize',
        }

        # Check for exact matches first (case-insensitive)
        lower_type = str(api_type).lower()
        if lower_type in type_mapping:
            return type_mapping[lower_type]

        # Check for partial matches
        if 'flash' in lower_type:
            return 'FlashSystem'
        elif 'ds8' in lower_type or '2107' in str(api_type):
            return 'DS8000'
        elif 'storwize' in lower_type or '2076' in str(api_type):
            return 'Storwize'

        # Return original if no mapping found
        return api_type or 'Unknown'

    def _progress_callback(self, current: int, total: int, message: str):
        """Handle progress updates from API client"""
        # Could be used to update Celery task state or logging
        logger.info(f"InsightsParser progress: {message} ({current}/{total})")
        if self.progress_callback_fn:
            self.progress_callback_fn(current, total, message)

    def set_progress_callback(self, callback):
        """Set external progress callback (e.g., for Celery task updates)"""
        self.progress_callback_fn = callback
