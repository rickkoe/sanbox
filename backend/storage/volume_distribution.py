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
    DS8000-specific distribution: Group by LSS, then distribute LSS groups.

    Logic:
    1. Group volumes by LSS (first 2 hex digits of volume_id)
    2. Sort LSS groups by size (largest first for better balance)
    3. Assign entire LSS groups to hosts round-robin
    4. This keeps volumes from same LSS on same host (I/O optimization)
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

    # Sort LSS groups by volume count (largest first for better balance)
    sorted_lss = sorted(lss_groups.keys(), key=lambda x: len(lss_groups[x]), reverse=True)

    # Track volume counts per host for load balancing
    host_loads = {host.id: 0 for host in hosts}
    distribution = {host.id: [] for host in hosts}

    # Assign each LSS group to the host with least volumes
    for lss in sorted_lss:
        lss_volumes = lss_groups[lss]
        # Find host with minimum load
        min_host_id = min(host_loads, key=host_loads.get)

        # Assign all volumes from this LSS to this host
        for vol in lss_volumes:
            vol_id = vol.id if hasattr(vol, 'id') else vol.get('id')
            distribution[min_host_id].append(vol_id)

        host_loads[min_host_id] += len(lss_volumes)

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

        hosts_data.append({
            'host_id': host.id,
            'host_name': host.name,
            'volume_count': len(host_vol_ids),
            'lss_groups': sorted(lss_set),
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
            'distribution_type': 'LSS-aware' if storage_type == 'DS8000' else 'Round-robin',
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
