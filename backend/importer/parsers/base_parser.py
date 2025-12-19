"""
Base parser class for all data import parsers.

This provides a common interface and utility methods for parsing
various data formats (CLI output, CSV files, etc.) for import into the database.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re


@dataclass
class ParsedFabric:
    """Represents a parsed SAN fabric"""
    name: str
    vsan: Optional[int] = None
    zoneset_name: Optional[str] = None
    san_vendor: str = 'BR'  # BR or CI
    exists: bool = False
    notes: Optional[str] = None


@dataclass
class ParsedAlias:
    """Represents a parsed SAN alias"""
    name: str
    wwpns: List[str]  # List of WWPNs for this alias
    alias_type: str = 'device-alias'  # device-alias, fcalias, or wwpn
    use: Optional[str] = None  # init, target, both
    fabric_name: Optional[str] = None

    @property
    def wwpn(self):
        """Return first WWPN for backward compatibility"""
        return self.wwpns[0] if self.wwpns else None


@dataclass
class ParsedZone:
    """Represents a parsed SAN zone"""
    name: str
    members: List[str]  # List of alias names or WWPNs
    zone_type: str = 'standard'  # standard or peer
    member_types: Optional[Dict[str, str]] = None  # For peer zones: member_name -> init/target/both
    fabric_name: Optional[str] = None


@dataclass
class ParsedSwitch:
    """Represents a parsed SAN switch"""
    name: str
    wwnn: Optional[str] = None  # World Wide Node Name
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    ip_address: Optional[str] = None
    domain_id: Optional[int] = None
    san_vendor: str = 'BR'  # BR or CI
    fabric_name: Optional[str] = None
    is_active: bool = True
    location: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ParsedStorageSystem:
    """Represents a parsed storage system from IBM Storage Insights"""
    storage_system_id: str
    name: str
    storage_type: str  # FlashSystem, DS8000, etc.

    # Basic info
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    machine_type: Optional[str] = None
    system_id: Optional[str] = None
    wwnn: Optional[str] = None
    firmware_level: Optional[str] = None
    uuid: Optional[str] = None
    location: Optional[str] = None

    # Network
    primary_ip: Optional[str] = None
    secondary_ip: Optional[str] = None

    # System health
    probe_status: Optional[str] = None
    condition: Optional[str] = None
    events_status: Optional[str] = None
    pm_status: Optional[str] = None

    # Capacity fields
    raw_capacity_bytes: Optional[int] = None
    capacity_bytes: Optional[int] = None
    used_capacity_bytes: Optional[int] = None
    used_capacity_percent: Optional[float] = None
    available_capacity_bytes: Optional[int] = None
    available_system_capacity_bytes: Optional[int] = None
    available_system_capacity_percent: Optional[float] = None
    available_volume_capacity_bytes: Optional[int] = None
    available_written_capacity_bytes: Optional[int] = None
    provisioned_capacity_bytes: Optional[int] = None
    provisioned_capacity_percent: Optional[float] = None
    provisioned_written_capacity_percent: Optional[float] = None
    mapped_capacity_bytes: Optional[int] = None
    mapped_capacity_percent: Optional[float] = None
    unmapped_capacity_bytes: Optional[int] = None
    unmapped_capacity_percent: Optional[float] = None
    overhead_capacity_bytes: Optional[int] = None
    used_written_capacity_bytes: Optional[int] = None
    used_written_capacity_percent: Optional[float] = None
    written_capacity_limit_bytes: Optional[int] = None
    overprovisioned_capacity_bytes: Optional[int] = None
    unallocated_volume_capacity_bytes: Optional[int] = None
    remaining_unallocated_capacity_bytes: Optional[int] = None
    shortfall_percent: Optional[float] = None

    # Efficiency and data reduction
    deduplication_savings_bytes: Optional[int] = None
    deduplication_savings_percent: Optional[float] = None
    compression_savings_bytes: Optional[int] = None
    compression_savings_percent: Optional[float] = None
    capacity_savings_bytes: Optional[int] = None
    capacity_savings_percent: Optional[float] = None
    data_reduction_savings_bytes: Optional[int] = None
    data_reduction_savings_percent: Optional[float] = None
    data_reduction_ratio: Optional[float] = None
    total_compression_ratio: Optional[float] = None
    total_savings_ratio: Optional[float] = None
    drive_compression_ratio: Optional[float] = None
    drive_compression_savings_bytes: Optional[int] = None
    drive_compression_savings_percent: Optional[float] = None
    pool_compression_ratio: Optional[float] = None
    pool_compression_savings_bytes: Optional[int] = None
    pool_compression_savings_percent: Optional[float] = None

    # Snapshots
    snapshot_written_capacity_bytes: Optional[int] = None
    snapshot_provisioned_capacity_bytes: Optional[int] = None

    # Safeguarded
    safe_guarded_capacity_bytes: Optional[int] = None
    safeguarded_virtual_capacity_bytes: Optional[int] = None
    safeguarded_used_capacity_percentage: Optional[float] = None

    # Cache
    read_cache_bytes: Optional[int] = None
    write_cache_bytes: Optional[int] = None

    # Counts
    volumes_count: Optional[int] = None
    pools_count: Optional[int] = None
    disks_count: Optional[int] = None
    managed_disks_count: Optional[int] = None
    fc_ports_count: Optional[int] = None
    ip_ports_count: Optional[int] = None
    host_connections_count: Optional[int] = None
    volume_groups_count: Optional[int] = None
    unprotected_volumes_count: Optional[int] = None
    remote_relationships_count: Optional[int] = None

    # Performance and metrics
    recent_fill_rate: Optional[float] = None
    recent_growth: Optional[float] = None
    current_power_usage_watts: Optional[float] = None
    system_temperature_celsius: Optional[float] = None
    system_temperature_Fahrenheit: Optional[float] = None
    power_efficiency: Optional[float] = None
    co2_emission: Optional[float] = None

    # Timestamps
    last_successful_probe: Optional[str] = None
    last_successful_monitor: Optional[str] = None

    # Customer and system info
    customer_country_code: Optional[str] = None
    customer_number: Optional[str] = None
    data_collection: Optional[str] = None
    data_collection_type: Optional[str] = None
    time_zone: Optional[str] = None
    staas_environment: Optional[str] = None
    element_manager_url: Optional[str] = None
    probe_schedule: Optional[str] = None
    acknowledged: Optional[bool] = None
    compressed: Optional[bool] = None
    callhome_system: Optional[bool] = None
    ransomware_threat_detection: Optional[bool] = None
    threat_notification_recipients: Optional[str] = None
    topology: Optional[str] = None
    cluster_id_alias: Optional[str] = None


@dataclass
class ParsedVolume:
    """Represents a parsed volume from IBM Storage Insights"""
    volume_id: str
    name: str
    storage_system_id: str  # Links to ParsedStorageSystem

    # Capacity
    capacity_bytes: Optional[int] = None
    used_capacity_bytes: Optional[int] = None
    used_capacity_percent: Optional[float] = None
    available_capacity_bytes: Optional[int] = None
    written_capacity_bytes: Optional[int] = None
    written_capacity_percent: Optional[float] = None
    reserved_volume_capacity_bytes: Optional[int] = None

    # Pool info
    pool_name: Optional[str] = None
    pool_id: Optional[str] = None

    # Properties
    thin_provisioned: Optional[str] = None
    compressed: Optional[bool] = None
    raid_level: Optional[str] = None
    encryption: Optional[str] = None
    flashcopy: Optional[str] = None
    auto_expand: Optional[bool] = None

    # Status and config
    status_label: Optional[str] = None
    acknowledged: Optional[bool] = None
    node: Optional[str] = None
    io_group: Optional[str] = None
    volume_number: Optional[int] = None
    natural_key: Optional[str] = None

    # Easy Tier
    easy_tier: Optional[str] = None
    easy_tier_status: Optional[str] = None

    # Tier capacity fields
    tier0_flash_capacity_percent: Optional[float] = None
    tier1_flash_capacity_percent: Optional[float] = None
    scm_capacity_percent: Optional[float] = None
    enterprise_hdd_capacity_percent: Optional[float] = None
    nearline_hdd_capacity_percent: Optional[float] = None
    tier0_flash_capacity_bytes: Optional[int] = None
    tier1_flash_capacity_bytes: Optional[int] = None
    scm_capacity_bytes: Optional[int] = None
    enterprise_hdd_capacity_bytes: Optional[int] = None
    nearline_hdd_capacity_bytes: Optional[int] = None

    # Safeguarded fields
    safeguarded_virtual_capacity_bytes: Optional[int] = None
    safeguarded_used_capacity_percentage: Optional[float] = None
    safeguarded_allocation_capacity_bytes: Optional[int] = None


@dataclass
class ParsedHost:
    """Represents a parsed host from IBM Storage Insights"""
    name: str
    storage_system_id: str  # Links to ParsedStorageSystem
    wwpns: List[str]  # List of WWPNs

    # Host info
    host_type: Optional[str] = None
    status: Optional[str] = None
    acknowledged: Optional[str] = None

    # Relationship
    storage_system: Optional[str] = None
    associated_resource: Optional[str] = None
    volume_group: Optional[str] = None

    # Counts
    vols_count: Optional[int] = None
    fc_ports_count: Optional[int] = None

    # Metadata
    natural_key: Optional[str] = None
    last_data_collection: Optional[int] = None


@dataclass
class ParsedPort:
    """Represents a SAN port from IBM Storage Insights"""
    port_id: str
    storage_system_id: str
    wwpn: Optional[str] = None
    port_type: Optional[str] = None  # FC, iSCSI, etc.
    status: Optional[str] = None
    speed: Optional[str] = None
    node: Optional[str] = None
    port_name: Optional[str] = None


@dataclass
class ParsedPool:
    """Represents a storage pool from IBM Storage Insights"""
    pool_id: str
    name: str
    storage_system_id: str

    # Pool type (FB = Fixed Block, CKD = Count Key Data)
    storage_type: str = 'FB'

    # Capacity fields
    capacity_bytes: Optional[int] = None
    used_capacity_bytes: Optional[int] = None
    used_capacity_percent: Optional[float] = None
    available_capacity_bytes: Optional[int] = None
    available_capacity_percent: Optional[float] = None
    provisioned_capacity_bytes: Optional[int] = None
    provisioned_capacity_percent: Optional[float] = None
    written_capacity_bytes: Optional[int] = None
    written_capacity_percent: Optional[float] = None

    # Pool properties
    status: Optional[str] = None
    raid_level: Optional[str] = None
    compressed: Optional[bool] = None
    easy_tier: Optional[str] = None
    easy_tier_status: Optional[str] = None

    # Tier capacity
    tier0_flash_capacity_bytes: Optional[int] = None
    tier1_flash_capacity_bytes: Optional[int] = None
    tier0_flash_capacity_percent: Optional[float] = None
    tier1_flash_capacity_percent: Optional[float] = None

    # Metadata
    volumes_count: Optional[int] = None
    mdisk_count: Optional[int] = None
    natural_key: Optional[str] = None

    # For matching during import
    exists_in_db: bool = False
    db_pool_id: Optional[int] = None


@dataclass
class ParseResult:
    """Result of parsing operation"""
    # SAN configuration objects (existing)
    fabrics: List[ParsedFabric]
    aliases: List[ParsedAlias]
    zones: List[ParsedZone]
    switches: List[ParsedSwitch] = None

    # Storage objects (new)
    storage_systems: List[ParsedStorageSystem] = None
    pools: List[ParsedPool] = None
    volumes: List[ParsedVolume] = None
    hosts: List[ParsedHost] = None
    ports: List[ParsedPort] = None

    # Metadata
    errors: List[str] = None
    warnings: List[str] = None
    metadata: Dict = None

    # Import type identifier
    import_type: str = 'san'  # 'san' or 'storage'

    def __post_init__(self):
        """Initialize mutable default arguments"""
        if self.switches is None:
            self.switches = []
        if self.storage_systems is None:
            self.storage_systems = []
        if self.pools is None:
            self.pools = []
        if self.volumes is None:
            self.volumes = []
        if self.hosts is None:
            self.hosts = []
        if self.ports is None:
            self.ports = []
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []
        if self.metadata is None:
            self.metadata = {}


class BaseParser(ABC):
    """Abstract base class for all parsers"""

    def __init__(self):
        self.errors = []
        self.warnings = []
        self.metadata = {}

    @abstractmethod
    def parse(self, data: str) -> ParseResult:
        """
        Parse the input data and return structured results.

        Args:
            data: Raw input data (file content, text paste, etc.)

        Returns:
            ParseResult containing parsed fabrics, aliases, zones, and any errors/warnings
        """
        pass

    @abstractmethod
    def detect_format(self, data: str) -> bool:
        """
        Detect if this parser can handle the given data format.

        Args:
            data: Raw input data to analyze

        Returns:
            True if this parser can handle the format, False otherwise
        """
        pass

    def normalize_wwpn(self, wwpn: str) -> str:
        """
        Normalize WWPN to standard format (lowercase with colons).

        Args:
            wwpn: WWPN in any format (with/without colons, dashes, etc.)

        Returns:
            Normalized WWPN in format: aa:bb:cc:dd:ee:ff:00:11
        """
        # Remove all non-hex characters
        clean = re.sub(r'[^0-9a-fA-F]', '', wwpn)

        # Ensure it's 16 characters
        if len(clean) != 16:
            raise ValueError(f"Invalid WWPN length: {wwpn} (cleaned: {clean})")

        # Format with colons and convert to lowercase
        formatted = ':'.join([clean[i:i+2] for i in range(0, 16, 2)])
        return formatted.lower()

    def detect_wwpn_type(self, wwpn: str) -> Optional[str]:
        """
        Detect if WWPN is likely an initiator or target based on prefix.
        Uses the WwpnPrefix table for detection.

        Args:
            wwpn: WWPN string

        Returns:
            'init', 'target', or None if unknown
        """
        try:
            # Import here to avoid circular imports
            from san.models import WwpnPrefix
            return WwpnPrefix.detect_wwpn_type(wwpn)
        except Exception as e:
            self.warnings.append(f"Could not detect WWPN type for {wwpn}: {e}")
            return None

    def is_valid_wwpn(self, wwpn: str) -> bool:
        """
        Check if a string is a valid WWPN format.

        Args:
            wwpn: String to validate

        Returns:
            True if valid WWPN format, False otherwise
        """
        # Remove common separators
        clean = re.sub(r'[:\-\s]', '', wwpn)

        # Check if it's 16 hex characters
        if len(clean) == 16 and all(c in '0123456789abcdefABCDEF' for c in clean):
            return True
        return False

    def add_error(self, message: str):
        """Add an error message"""
        self.errors.append(message)

    def add_warning(self, message: str):
        """Add a warning message"""
        self.warnings.append(message)

    def add_metadata(self, key: str, value):
        """Add metadata about the parsing operation"""
        self.metadata[key] = value


class ParserFactory:
    """Factory for creating appropriate parsers based on input data"""

    _parsers = []  # Will be populated with available parser classes

    @classmethod
    def register_parser(cls, parser_class):
        """Register a parser class"""
        cls._parsers.append(parser_class)
        return parser_class

    @classmethod
    def get_parser(cls, data: str) -> Optional[BaseParser]:
        """
        Get appropriate parser for the given data.

        Args:
            data: Raw input data

        Returns:
            Parser instance that can handle the data, or None if no parser found
        """
        for parser_class in cls._parsers:
            parser = parser_class()
            if parser.detect_format(data):
                return parser
        return None

    @classmethod
    def list_parsers(cls) -> List[str]:
        """List all registered parsers"""
        return [parser.__name__ for parser in cls._parsers]
