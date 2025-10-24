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
class ParseResult:
    """Result of parsing operation"""
    fabrics: List[ParsedFabric]
    aliases: List[ParsedAlias]
    zones: List[ParsedZone]
    errors: List[str]
    warnings: List[str]
    metadata: Dict


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
