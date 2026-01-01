"""
Volume Distribution Algorithm for IBM i LPARs

Distributes volumes evenly across hosts in an LPAR.
For DS8000: Groups by LSS first, then distributes LSS groups.
"""

from collections import defaultdict
from .volume_range_utils import get_lss_from_volume_id


def distribute_volumes_to_lpar(volumes, lpar_hosts, storage_type='DS8000'):
    """
    Distribute volumes across hosts in an LPAR.

    Args:
        volumes: QuerySet or list of Volume objects (or dicts with 'id', 'volume_id')
        lpar_hosts: QuerySet or list of Host objects in the LPAR
        storage_type: 'DS8000' for LSS-aware distribution, else simple round-robin

    Returns:
        dict: {host_id: [volume_ids, ...], ...}
    """
    if not volumes or not lpar_hosts:
        return {}

    hosts = list(lpar_hosts)
    host_count = len(hosts)

    if host_count == 0:
        return {}

    # Initialize result structure
    distribution = {host.id: [] for host in hosts}

    if storage_type == 'DS8000':
        # LSS-aware distribution for DS8000
        distribution = _distribute_ds8000_volumes(volumes, hosts)
    else:
        # Simple round-robin for other storage types
        distribution = _distribute_round_robin(volumes, hosts)

    return distribution


def _distribute_ds8000_volumes(volumes, hosts):
    """
    DS8000-specific distribution: Split each LSS into contiguous ranges across hosts.

    Logic:
    1. Group volumes by LSS (first 2 hex digits of volume_id)
    2. For each LSS, assign contiguous ranges to each host
    3. Use global volume count tracking to decide which hosts get extras
    4. Final rebalancing ensures max 1-volume difference between any hosts

    Example: If LSS 50 has 107 volumes and there are 2 hosts:
    - Host 1 gets volumes 5000-5035 (54 volumes, contiguous)
    - Host 2 gets volumes 5036-506A (53 volumes, contiguous)
    """
    # Group volumes by LSS
    lss_groups = defaultdict(list)
    for vol in volumes:
        vol_id = vol.volume_id if hasattr(vol, 'volume_id') else vol.get('volume_id', '')
        lss = get_lss_from_volume_id(vol_id)
        if lss:
            lss_groups[lss].append(vol)
        else:
            # Volumes without LSS go to a special group
            lss_groups['__no_lss__'].append(vol)

    # Sort LSS groups by name for consistent ordering
    sorted_lss = sorted(lss_groups.keys())

    # Initialize distribution
    distribution = {host.id: [] for host in hosts}
    host_list = list(hosts)
    host_count = len(host_list)

    # Calculate the ideal global distribution
    total_volumes = len(volumes)
    ideal_base = total_volumes // host_count
    ideal_remainder = total_volumes % host_count
    # Hosts 0 through (ideal_remainder-1) should get ideal_base+1 volumes
    # Hosts ideal_remainder through (host_count-1) should get ideal_base volumes

    # Track running total for each host to guide distribution decisions
    host_counts = {host.id: 0 for host in host_list}

    # For each LSS, split volumes into contiguous ranges
    for lss in sorted_lss:
        lss_volumes = lss_groups[lss]
        # Sort volumes within LSS for contiguous assignment
        lss_volumes_sorted = sorted(
            lss_volumes,
            key=lambda v: v.volume_id if hasattr(v, 'volume_id') else v.get('volume_id', '')
        )

        total_vols = len(lss_volumes_sorted)
        if total_vols == 0:
            continue

        # Calculate how many volumes each host gets from this LSS
        base_count = total_vols // host_count
        remainder = total_vols % host_count

        # Sort hosts by current count (ascending) to give extras to hosts with fewer volumes
        # This ensures global balance across LSS groups
        sorted_hosts = sorted(host_list, key=lambda h: host_counts[h.id])

        # Assign contiguous ranges to each host
        current_idx = 0
        for i, host in enumerate(sorted_hosts):
            # This host gets base_count volumes, plus 1 extra if we still have remainder
            count = base_count + (1 if i < remainder else 0)

            # Assign contiguous range
            for vol in lss_volumes_sorted[current_idx:current_idx + count]:
                vol_id = vol.id if hasattr(vol, 'id') else vol.get('id')
                distribution[host.id].append(vol_id)
                host_counts[host.id] += 1

            current_idx += count

    return distribution


def _distribute_round_robin(volumes, hosts):
    """
    Simple round-robin distribution for non-DS8000 storage.
    """
    distribution = {host.id: [] for host in hosts}
    host_list = list(hosts)

    for i, vol in enumerate(volumes):
        host = host_list[i % len(host_list)]
        vol_id = vol.id if hasattr(vol, 'id') else vol.get('id')
        distribution[host.id].append(vol_id)

    return distribution


def _calculate_volume_ranges(volumes):
    """
    Calculate volume ranges from a list of volumes.
    Groups consecutive volume IDs into ranges.

    Args:
        volumes: List of volume objects or dicts with 'volume_id' field

    Returns:
        list: [{'lss': '50', 'start': '00', 'end': '3F', 'count': 64}, ...]
    """
    if not volumes:
        return []

    # Group volumes by LSS
    lss_volumes = defaultdict(list)
    for vol in volumes:
        vol_id = vol.volume_id if hasattr(vol, 'volume_id') else vol.get('volume_id', '')
        if vol_id and len(vol_id) >= 4:
            lss = vol_id[:2].upper()
            addr = vol_id[2:4].upper()
            lss_volumes[lss].append(addr)

    # Build ranges for each LSS
    ranges = []
    for lss in sorted(lss_volumes.keys()):
        addrs = sorted(lss_volumes[lss], key=lambda x: int(x, 16))

        if not addrs:
            continue

        # Find consecutive sequences
        current_start = addrs[0]
        current_end = addrs[0]
        current_count = 1

        for i in range(1, len(addrs)):
            current_val = int(current_end, 16)
            next_val = int(addrs[i], 16)

            if next_val == current_val + 1:
                # Consecutive
                current_end = addrs[i]
                current_count += 1
            else:
                # Gap found, save current range and start new one
                ranges.append({
                    'lss': lss,
                    'start': current_start,
                    'end': current_end,
                    'count': current_count
                })
                current_start = addrs[i]
                current_end = addrs[i]
                current_count = 1

        # Don't forget the last range
        ranges.append({
            'lss': lss,
            'start': current_start,
            'end': current_end,
            'count': current_count
        })

    return ranges


def preview_distribution(volumes, lpar_hosts, storage_type='DS8000'):
    """
    Generate a preview of the distribution for UI display.

    Args:
        volumes: QuerySet or list of Volume objects
        lpar_hosts: QuerySet or list of Host objects
        storage_type: 'DS8000' for LSS-aware, else round-robin

    Returns:
        dict: {
            'hosts': [
                {
                    'host_id': int,
                    'host_name': str,
                    'volume_count': int,
                    'lss_groups': ['10', '20', ...],  # For DS8000
                    'volume_ranges': [{'lss': '50', 'start': '00', 'end': '3F', 'count': 64}, ...],
                    'volumes': [{'id': int, 'name': str, 'volume_id': str}, ...]
                },
                ...
            ],
            'summary': {
                'total_volumes': int,
                'total_hosts': int,
                'distribution_type': str,
                'balanced': bool  # True if volumes are evenly distributed
            }
        }
    """
    distribution = distribute_volumes_to_lpar(volumes, lpar_hosts, storage_type)

    # Build volume lookup
    vol_lookup = {}
    for vol in volumes:
        vol_id = vol.id if hasattr(vol, 'id') else vol.get('id')
        vol_lookup[vol_id] = vol

    # Build result
    hosts_data = []
    for host in lpar_hosts:
        host_vol_ids = distribution.get(host.id, [])
        host_vols = [vol_lookup.get(vid) for vid in host_vol_ids if vid in vol_lookup]

        # Calculate LSS groups for DS8000
        lss_set = set()
        for vol in host_vols:
            if vol:
                vol_id = vol.volume_id if hasattr(vol, 'volume_id') else vol.get('volume_id', '')
                lss = get_lss_from_volume_id(vol_id)
                if lss:
                    lss_set.add(lss)

        # Calculate volume ranges for this host
        volume_ranges = _calculate_volume_ranges(host_vols) if storage_type == 'DS8000' else []

        hosts_data.append({
            'host_id': host.id,
            'host_name': host.name,
            'volume_count': len(host_vol_ids),
            'lss_groups': sorted(lss_set),
            'volume_ranges': volume_ranges,
            'volumes': [
                {
                    'id': v.id if hasattr(v, 'id') else v.get('id'),
                    'name': v.name if hasattr(v, 'name') else v.get('name'),
                    'volume_id': v.volume_id if hasattr(v, 'volume_id') else v.get('volume_id'),
                }
                for v in host_vols if v
            ]
        })

    # Check if balanced (difference between max and min is at most 1)
    counts = [h['volume_count'] for h in hosts_data]
    balanced = (max(counts) - min(counts) <= 1) if counts else True

    return {
        'hosts': hosts_data,
        'summary': {
            'total_volumes': len(volumes),
            'total_hosts': len(lpar_hosts),
            'distribution_type': 'Contiguous ranges' if storage_type == 'DS8000' else 'Round-robin',
            'balanced': balanced
        }
    }


def get_effective_mappings_for_cluster(volume_mappings):
    """
    For a HostCluster, return the expanded mappings (all hosts get all volumes).

    Args:
        volume_mappings: QuerySet of VolumeMapping objects targeting a cluster

    Returns:
        list: [{'volume_id': int, 'host_id': int}, ...] - one entry per volume-host pair
    """
    expanded = []
    for mapping in volume_mappings:
        if mapping.target_type == 'cluster' and mapping.target_cluster:
            # Get all hosts in the cluster
            for host in mapping.target_cluster.hosts.all():
                expanded.append({
                    'volume_id': mapping.volume_id,
                    'host_id': host.id,
                    'mapping_id': mapping.id
                })
    return expanded


def get_effective_mappings_for_lpar(volume_mappings):
    """
    For an IBMiLPAR, return the actual host assignments.

    Args:
        volume_mappings: QuerySet of VolumeMapping objects targeting an LPAR

    Returns:
        list: [{'volume_id': int, 'host_id': int, 'lss': str}, ...]
    """
    expanded = []
    for mapping in volume_mappings:
        if mapping.target_type == 'lpar' and mapping.assigned_host:
            lss = get_lss_from_volume_id(mapping.volume.volume_id) if mapping.volume else None
            expanded.append({
                'volume_id': mapping.volume_id,
                'host_id': mapping.assigned_host_id,
                'mapping_id': mapping.id,
                'lss': lss
            })
    return expanded
