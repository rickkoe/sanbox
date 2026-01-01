"""
Volume Range Utilities for DS8000

Calculates contiguous volume ranges from individual Volume records.
Groups by: storage, LSS/LCU (first 2 hex digits), format, capacity_bytes

Also generates DSCLI commands for volume provisioning.
"""

import hashlib
from collections import defaultdict
from .storage_utils import generate_ds8000_device_id


def get_lss_from_volume_id(volume_id):
    """
    Extract LSS (first 2 hex digits) from 4-digit volume_id.

    Args:
        volume_id: String like '1000', '5A3F', etc.

    Returns:
        str: First 2 hex digits uppercase, or None if invalid
    """
    if volume_id and len(volume_id) >= 2:
        return volume_id[:2].upper()
    return None


def is_contiguous(vol_id_a, vol_id_b):
    """
    Check if two volume IDs are hex-contiguous (B follows A by exactly 1).

    Args:
        vol_id_a: First volume ID (e.g., '100A')
        vol_id_b: Second volume ID (e.g., '100B')

    Returns:
        bool: True if vol_id_b = vol_id_a + 1 in hex
    """
    try:
        a = int(vol_id_a, 16)
        b = int(vol_id_b, 16)
        return b == a + 1
    except (ValueError, TypeError):
        return False


def generate_range_id(storage_id, lss, start_vol, end_vol, fmt, capacity):
    """
    Generate a unique ID for a volume range.

    Returns a hash based on the range properties.
    """
    key = f"{storage_id}:{lss}:{start_vol}:{end_vol}:{fmt}:{capacity}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def format_capacity_display(capacity_bytes):
    """
    Format capacity bytes to human-readable string.

    Returns:
        str: Formatted string like '50 GiB', '1.5 TiB', etc.
    """
    if capacity_bytes is None:
        return 'Unknown'

    tib = capacity_bytes / (1024 ** 4)
    gib = capacity_bytes / (1024 ** 3)
    mib = capacity_bytes / (1024 ** 2)

    if tib >= 1:
        return f"{tib:.1f} TiB" if tib % 1 else f"{int(tib)} TiB"
    elif gib >= 1:
        return f"{gib:.1f} GiB" if gib % 1 else f"{int(gib)} GiB"
    else:
        return f"{mib:.1f} MiB" if mib % 1 else f"{int(mib)} MiB"


def calculate_volume_ranges(volumes):
    """
    Calculate contiguous volume ranges from a list of volumes.

    Groups volumes by (storage_id, lss, format, capacity_bytes) and finds
    contiguous sequences within each group.

    Args:
        volumes: QuerySet or list of Volume objects with attributes:
            - id, storage_id, storage (with .name), volume_id, format,
            - capacity_bytes, pool_name, committed, deployed

    Returns:
        list: List of range dicts:
        [
            {
                'range_id': str,
                'storage_id': int,
                'storage_name': str,
                'lss': str,
                'start_volume': str,
                'end_volume': str,
                'format': str,
                'capacity_bytes': int,
                'capacity_display': str,
                'volume_count': int,
                'volume_ids': [int, ...],
                'pool_name': str or None,
                'committed': bool,
                'deployed': bool,
            },
            ...
        ]
    """
    # Group volumes by (storage_id, lss, format, capacity_bytes, pool_name)
    groups = defaultdict(list)

    for vol in volumes:
        vol_id = vol.volume_id
        if not vol_id or len(vol_id) < 2:
            continue

        lss = get_lss_from_volume_id(vol_id)
        if not lss:
            continue

        # Group key includes pool name for more precise grouping
        key = (
            vol.storage_id,
            lss,
            vol.format or 'Unknown',
            vol.capacity_bytes or 0,
            vol.pool.name if vol.pool else ''
        )
        groups[key].append(vol)

    ranges = []

    for (storage_id, lss, fmt, capacity, pool_name), vols in groups.items():
        # Sort by volume_id (hex value)
        sorted_vols = sorted(vols, key=lambda v: int(v.volume_id, 16))

        if not sorted_vols:
            continue

        # Find contiguous sequences
        current_range_start = sorted_vols[0]
        current_range_vols = [sorted_vols[0]]

        for i in range(1, len(sorted_vols)):
            prev_vol = sorted_vols[i - 1]
            curr_vol = sorted_vols[i]

            if is_contiguous(prev_vol.volume_id, curr_vol.volume_id):
                # Continue the current range
                current_range_vols.append(curr_vol)
            else:
                # End current range and start new one
                ranges.append(_create_range_dict(
                    current_range_start,
                    current_range_vols,
                    lss, fmt, capacity, pool_name
                ))
                current_range_start = curr_vol
                current_range_vols = [curr_vol]

        # Don't forget the last range
        ranges.append(_create_range_dict(
            current_range_start,
            current_range_vols,
            lss, fmt, capacity, pool_name
        ))

    # Sort ranges by LSS, then by start volume
    ranges.sort(key=lambda r: (r['lss'], int(r['start_volume'], 16)))

    return ranges


def _extract_name_prefix(volumes):
    """
    Extract the common name prefix from a list of volumes.

    Volume names are expected to be in format: {name_prefix}_{volume_id}
    Returns the prefix if all volumes share it, otherwise None.
    """
    if not volumes:
        return None

    # Collect prefixes (using uppercase for comparison, but storing original case)
    prefix_map = {}  # Maps uppercase prefix to original case prefix
    for vol in volumes:
        if not vol.name or not vol.volume_id:
            continue
        # Check if name ends with _{volume_id} (case-insensitive for volume_id)
        expected_suffix = f"_{vol.volume_id.upper()}"
        name_upper = vol.name.upper()
        if name_upper.endswith(expected_suffix):
            prefix = vol.name[:-len(expected_suffix)]
            prefix_upper = prefix.upper()
            if prefix_upper not in prefix_map:
                prefix_map[prefix_upper] = prefix
        else:
            # Name doesn't follow the pattern
            return None

    # If all volumes share the same prefix (case-insensitive), return it
    if len(prefix_map) == 1:
        return list(prefix_map.values())[0]
    return None


def _create_range_dict(start_vol, vols, lss, fmt, capacity, pool_name):
    """
    Create a range dictionary from a list of contiguous volumes.
    """
    end_vol = vols[-1]

    # Check if all volumes have same committed/deployed status
    all_committed = all(v.committed for v in vols)
    all_deployed = all(v.deployed for v in vols)

    # Extract common name prefix from volume names
    name_prefix = _extract_name_prefix(vols)

    return {
        'range_id': generate_range_id(
            start_vol.storage_id, lss,
            start_vol.volume_id.upper(), end_vol.volume_id.upper(),
            fmt, capacity
        ),
        'storage_id': start_vol.storage_id,
        'storage_name': start_vol.storage.name if start_vol.storage else 'Unknown',
        'lss': lss,
        'start_volume': start_vol.volume_id.upper(),
        'end_volume': end_vol.volume_id.upper(),
        'format': fmt,
        'capacity_bytes': capacity,
        'capacity_display': format_capacity_display(capacity),
        'volume_count': len(vols),
        'volume_ids': [v.id for v in vols],
        'pool_name': pool_name or None,
        'name_prefix': name_prefix,
        'committed': all_committed,
        'deployed': all_deployed,
    }


def validate_volume_range(start_volume, end_volume):
    """
    Validate a volume range specification.

    Args:
        start_volume: Start volume ID (4-digit hex)
        end_volume: End volume ID (4-digit hex)

    Returns:
        tuple: (is_valid, error_message, details)
        - is_valid: bool
        - error_message: str or None
        - details: dict with 'start_int', 'end_int', 'lss', 'count' if valid
    """
    # Normalize to uppercase
    start = start_volume.upper().strip() if start_volume else ''
    end = end_volume.upper().strip() if end_volume else ''

    # Validate format (4 hex digits)
    import re
    hex_pattern = re.compile(r'^[0-9A-F]{4}$')

    if not hex_pattern.match(start):
        return False, f"Invalid start volume '{start}': must be 4 hex digits (0000-FFFF)", None

    if not hex_pattern.match(end):
        return False, f"Invalid end volume '{end}': must be 4 hex digits (0000-FFFF)", None

    # Parse hex values
    start_int = int(start, 16)
    end_int = int(end, 16)

    # Validate order
    if end_int < start_int:
        return False, f"End volume ({end}) must be >= start volume ({start})", None

    # Validate same LSS
    start_lss = start[:2]
    end_lss = end[:2]
    if start_lss != end_lss:
        return False, f"Start ({start}) and end ({end}) must be in same LSS (first 2 digits must match)", None

    # Calculate count
    count = end_int - start_int + 1

    # Sanity check - don't allow extremely large ranges
    if count > 256:
        return False, f"Range too large ({count} volumes). Maximum 256 volumes per range.", None

    return True, None, {
        'start_int': start_int,
        'end_int': end_int,
        'lss': start_lss,
        'count': count,
        'start_volume': start,
        'end_volume': end,
    }


def generate_volume_ids_for_range(start_volume, end_volume):
    """
    Generate list of volume IDs for a range.

    Args:
        start_volume: Start volume ID (e.g., '1000')
        end_volume: End volume ID (e.g., '100F')

    Returns:
        list: List of volume IDs ['1000', '1001', ..., '100F']
    """
    is_valid, error, details = validate_volume_range(start_volume, end_volume)
    if not is_valid:
        raise ValueError(error)

    return [f"{i:04X}" for i in range(details['start_int'], details['end_int'] + 1)]


def generate_dscli_commands(storage, ranges, command_type='create'):
    """
    Generate DSCLI commands for volume operations.

    Args:
        storage: Storage object
        ranges: List of range dicts from calculate_volume_ranges()
        command_type: 'create' or 'delete'

    Returns:
        dict: {
            'device_id': str,
            'commands': [str, ...],
            'command_count': int
        }
    """
    device_id = generate_ds8000_device_id(storage)
    commands = []

    for r in ranges:
        if command_type == 'create':
            cmd = _generate_create_command(device_id, r)
            if cmd:
                commands.append(cmd)
        elif command_type == 'delete':
            cmd = _generate_delete_command(device_id, r)
            if cmd:
                commands.append(cmd)

    # Add section header at the beginning if there are commands
    if commands:
        header = f"### {storage.name.upper()} MKVOL COMMANDS" if command_type == 'create' else f"### {storage.name.upper()} RMVOL COMMANDS"
        commands.insert(0, header)

    return {
        'device_id': device_id,
        'commands': commands,
        'command_count': len([c for c in commands if not c.startswith('#')]),
    }


def _bytes_to_ckd_cylinders(capacity_bytes):
    """
    Convert capacity in bytes to CKD 3390 cylinders.

    3390 geometry: 15 tracks/cylinder, 56,664 bytes/track
    1 cylinder = 849,960 bytes ≈ 850 KB

    Common 3390 mod sizes:
    - Mod 1: 1113 cylinders (~946 MB)
    - Mod 2: 2226 cylinders (~1.9 GB)
    - Mod 3: 3339 cylinders (~2.8 GB)
    - Mod 9: 10017 cylinders (~8.5 GB)
    - Mod 27: 32760 cylinders (~27.8 GB)
    - Mod 54: 65520 cylinders (~55.7 GB)
    """
    if not capacity_bytes:
        return 3339  # Default to Mod 3

    bytes_per_cylinder = 849960  # 15 tracks * 56,664 bytes/track
    return max(1, int(capacity_bytes / bytes_per_cylinder))


def _generate_create_command(device_id, range_dict):
    """
    Generate a volume creation command for a range.

    FB volumes: mkfbvol -dev {device} -extpool {pool} -cap {gb} {start}-{end}
    CKD volumes: mkckdvol -dev {device} -extpool {pool} -datatype 3390 -cap {cyl} {start}-{end}

    Per IBM docs: Volume range specified by IDs separated by dash.
    The range determines which volumes are created (no -qty parameter).
    """
    fmt = range_dict.get('format', '').upper()
    pool = range_dict.get('pool_name') or 'P0'
    start = range_dict.get('start_volume', '0000')
    end = range_dict.get('end_volume', '0000')
    capacity_bytes = range_dict.get('capacity_bytes', 0)

    # Format volume range - show range if more than 1 volume
    vol_range = start if start == end else f"{start}-{end}"

    # Convert capacity to GB for FB volumes
    capacity_gb = int(capacity_bytes / (1024 ** 3)) if capacity_bytes else 50

    if fmt == 'FB':
        return f"mkfbvol -dev {device_id} -extpool {pool} -cap {capacity_gb} {vol_range}"
    elif fmt == 'CKD':
        # CKD uses cylinders with 3390 datatype
        capacity_cyl = _bytes_to_ckd_cylinders(capacity_bytes)
        # Use 3390-A for large volumes (>65520 cylinders)
        datatype = '3390-A' if capacity_cyl > 65520 else '3390'
        return f"mkckdvol -dev {device_id} -extpool {pool} -datatype {datatype} -cap {capacity_cyl} {vol_range}"
    else:
        # Unknown format, generate FB command with comment
        return f"# Unknown format '{fmt}' - mkfbvol -dev {device_id} -extpool {pool} -cap {capacity_gb} {vol_range}"


def _generate_delete_command(device_id, range_dict):
    """
    Generate a volume deletion command for a range.

    rmvol -dev {device} {vol_id}
    """
    start = range_dict.get('start_volume', '0000')
    end = range_dict.get('end_volume', '0000')

    if start == end:
        return f"rmvol -dev {device_id} {start}"
    else:
        return f"rmvol -dev {device_id} {start}-{end}"


def generate_dscli_for_new_range(storage, start_volume, end_volume, fmt, capacity_bytes, pool_name=None):
    """
    Generate DSCLI command for a new range (before volumes exist in DB).

    Args:
        storage: Storage object
        start_volume: Start volume ID
        end_volume: End volume ID
        fmt: 'FB' or 'CKD'
        capacity_bytes: Volume capacity in bytes
        pool_name: Optional pool name

    Returns:
        str: DSCLI command
    """
    is_valid, error, details = validate_volume_range(start_volume, end_volume)
    if not is_valid:
        raise ValueError(error)

    device_id = generate_ds8000_device_id(storage)
    pool = pool_name or 'P0'
    capacity_gb = int(capacity_bytes / (1024 ** 3)) if capacity_bytes else 50

    # Format volume range - show range if more than 1 volume
    start = details['start_volume']
    end = details['end_volume']
    vol_range = start if start == end else f"{start}-{end}"

    if fmt.upper() == 'FB':
        return f"mkfbvol -dev {device_id} -extpool {pool} -cap {capacity_gb} {vol_range}"
    elif fmt.upper() == 'CKD':
        capacity_cyl = int(capacity_bytes / (849 * 1024)) if capacity_bytes else 3339
        return f"mkckdvol -dev {device_id} -extpool {pool} -cap {capacity_cyl} {vol_range}"
    else:
        raise ValueError(f"Invalid format '{fmt}': must be 'FB' or 'CKD'")
