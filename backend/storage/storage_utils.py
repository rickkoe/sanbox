"""
Storage utility functions for generating mkhost scripts and other storage-related operations.
"""


def generate_mkhost_scripts(storage_systems, project=None):
    """
    Generate mkhost scripts for all storage systems.

    Args:
        storage_systems: QuerySet of Storage objects
        project: Optional Project object to filter hosts by project membership

    Returns:
        dict: Storage scripts organized by storage system name
    """
    storage_scripts = {}

    for storage in storage_systems:
        # Get all hosts assigned to this storage system with create=True
        from storage.models import Host

        if project:
            # Filter hosts by project membership via junction table
            # Only include hosts that are not yet deployed (need mkhost scripts)
            from core.models import ProjectHost
            host_ids = ProjectHost.objects.filter(
                project=project,
                host__storage=storage,
                host__deployed=False  # Only undeployed hosts need scripts
            ).values_list('host_id', flat=True)
            hosts = Host.objects.filter(id__in=host_ids).order_by('name')
        else:
            # Without a project, return empty - scripts require project context
            hosts = Host.objects.none()
        
        
        if not hosts.exists():
            storage_scripts[storage.name] = {
                "commands": [],
                "storage_type": storage.storage_type,
                "host_count": 0
            }
            continue
        
        commands = []

        for host in hosts:
            # Get WWPNs from HostWwpn records first
            from storage.models import HostWwpn
            host_wwpns = HostWwpn.objects.filter(host=host)

            # Collect WWPNs from HostWwpn table
            wwpn_list = []
            for hw in host_wwpns:
                if hw.wwpn:
                    # Remove colons and any other formatting from WWPN
                    clean_wwpn = hw.wwpn.replace(':', '').replace('-', '').strip()
                    if clean_wwpn and clean_wwpn not in wwpn_list:  # Avoid duplicates
                        wwpn_list.append(clean_wwpn)

            # Fallback to legacy wwpns field if no HostWwpn records
            if not wwpn_list and host.wwpns:
                # Parse legacy comma-separated wwpns field
                legacy_wwpns = host.wwpns.split(',')
                for wwpn in legacy_wwpns:
                    clean_wwpn = wwpn.replace(':', '').replace('-', '').strip()
                    if clean_wwpn and clean_wwpn not in wwpn_list:
                        wwpn_list.append(clean_wwpn)
                if wwpn_list:
                    print(f"ℹ️ Using legacy wwpns field for host {host.name}")

            # Skip hosts without WWPNs
            if not wwpn_list:
                print(f"⚠️ Skipping host {host.name} - no WWPNs found")
                continue

            # Generate command based on storage type
            command = generate_mkhost_command(storage, host, wwpn_list)
            if command:
                commands.append(command)
                print(f"✅ Generated command for host {host.name}")

        # Add section header at the beginning if there are commands
        if commands:
            commands.insert(0, f"### {storage.name.upper()} MKHOST COMMANDS")

        storage_scripts[storage.name] = {
            "commands": commands,
            "storage_type": storage.storage_type,
            "host_count": len([c for c in commands if not c.startswith('#')])
        }

        print(f"✅ Generated {len(commands) - 1 if commands else 0} commands for storage {storage.name}")
    
    return storage_scripts


def generate_mkhost_command(storage, host, wwpn_list):
    """
    Generate a single mkhost command based on storage type.
    
    Args:
        storage: Storage object
        host: Host object  
        wwpn_list: List of WWPNs for the host
        
    Returns:
        str: The mkhost command or None if unsupported storage type
    """
    if storage.storage_type == "FlashSystem":
        return generate_flashsystem_mkhost(storage, host, wwpn_list)
    elif storage.storage_type == "DS8000":
        return generate_ds8000_mkhost(storage, host, wwpn_list)
    else:
        print(f"⚠️ Skipping host {host.name} - unknown storage type: {storage.storage_type}")
        return None


def generate_flashsystem_mkhost(storage, host, wwpn_list):
    """
    Generate FlashSystem mkhost command.

    FlashSystem syntax: mkhost -name {name} -protocol fcscsi -fcwwpn {wwpn_list} -force -type {host_type}
    """
    # Join WWPNs with colons for FlashSystem
    wwpn_string = ':'.join(wwpn_list)
    host_type = host.host_type or "generic"

    command = f"mkhost -name {host.name} -protocol fcscsi -fcwwpn {wwpn_string} -force -type {host_type}"
    return command


def generate_ds8000_mkhost(storage, host, wwpn_list):
    """
    Generate DS8000 mkhost command.

    DS8000 syntax: mkhost -dev {device-id} -type "{host_type}" -hostport {wwpn_list} {name}
    """
    # Join WWPNs with commas (no spaces) for DS8000
    wwpn_string = ','.join(wwpn_list)
    host_type = host.host_type or "generic"

    # Build device-id from serial number: drop 0 from end, add 1 to end
    device_id = generate_ds8000_device_id(storage)

    command = f'mkhost -dev {device_id} -type "{host_type}" -hostport {wwpn_string} {host.name}'
    return command


def generate_ds8000_device_id(storage):
    """
    Generate DS8000 device ID from storage serial number.

    Logic: Drop trailing 0 from serial number and add 1 to the end.

    Args:
        storage: Storage object

    Returns:
        str: Generated device ID or fallback value
    """
    device_id = "NO-DEVICE-ID-DEFINED"  # Default fallback

    if storage.serial_number:
        serial = storage.serial_number.strip()
        if serial.endswith('0'):
            # Drop the 0 from the end and add 1
            device_id = f"IBM.2107-{serial[:-1] + '1'}"
            print(f"✅ DS8000 device ID generated: {storage.serial_number} -> {device_id}")
        elif serial.endswith('1'):
            device_id = f"IBM.2107-{serial}"
            print(f"✅ DS8000 device ID generated: {storage.serial_number} -> {device_id}")
    else:
        print(f"⚠️ No serial number found for DS8000 {storage.name}, using default device_id")

    return device_id


def generate_volume_mapping_scripts(storage_systems, project=None):
    """
    Generate volume mapping scripts for all storage systems.

    Creates commands to map volumes to hosts/clusters based on VolumeMapping records.

    Args:
        storage_systems: QuerySet of Storage objects
        project: Optional Project object to filter mappings by project membership

    Returns:
        dict: Mapping scripts organized by storage system name
    """
    from storage.models import VolumeMapping
    from core.models import ProjectVolumeMapping

    storage_scripts = {}

    for storage in storage_systems:
        if project:
            # Filter mappings by project membership via junction table
            # Only include mappings that are not yet deployed (need mapvol scripts)
            mapping_ids = ProjectVolumeMapping.objects.filter(
                project=project,
                volume_mapping__volume__storage=storage,
                volume_mapping__deployed=False  # Only undeployed mappings need scripts
            ).values_list('volume_mapping_id', flat=True)
            mappings = VolumeMapping.objects.filter(id__in=mapping_ids).select_related(
                'volume', 'target_host', 'target_cluster', 'target_lpar', 'assigned_host'
            ).order_by('target_type', 'target_host__name', 'target_cluster__name', 'volume__name')
        else:
            # Without a project, return empty - scripts require project context
            mappings = VolumeMapping.objects.none()

        if not mappings.exists():
            storage_scripts[storage.name] = {
                "commands": [],
                "storage_type": storage.storage_type,
                "mapping_count": 0,
                "volume_count": 0
            }
            continue

        # Count total volumes being mapped
        volume_count = mappings.count()

        commands = []

        if storage.storage_type == "DS8000":
            # DS8000: Group mappings by target for batch commands
            commands = generate_ds8000_volume_mapping_commands(storage, mappings)
        elif storage.storage_type == "FlashSystem":
            # FlashSystem: One command per volume-to-host/cluster mapping
            commands = generate_flashsystem_volume_mapping_commands(storage, mappings)
        else:
            print(f"⚠️ Skipping storage {storage.name} - unknown storage type: {storage.storage_type}")

        # Add section header at the beginning if there are commands
        if commands:
            commands.insert(0, f"### {storage.name.upper()} MAPVOL COMMANDS")

        storage_scripts[storage.name] = {
            "commands": commands,
            "storage_type": storage.storage_type,
            "mapping_count": len([c for c in commands if not c.startswith('#')]),
            "volume_count": volume_count
        }

        print(f"✅ Generated {len(commands) - 1 if commands else 0} volume mapping commands for {volume_count} volumes on storage {storage.name}")

    return storage_scripts


def generate_ds8000_volume_mapping_commands(storage, mappings):
    """
    Generate DS8000 chhost volume mapping commands.

    DS8000 syntax: chhost -dev {device_id} -action map -volume {volume_ids} {host_name}

    Groups volumes by target host for efficient batch commands.
    Uses volume ranges (e.g., 5000-5006) for contiguous volumes.
    For LPAR mappings, uses the assigned_host field.
    For cluster mappings, generates commands for each host in the cluster.

    Args:
        storage: Storage object
        mappings: QuerySet of VolumeMapping objects

    Returns:
        list: List of chhost command strings
    """
    device_id = generate_ds8000_device_id(storage)
    commands = []

    # Group mappings by effective target host
    host_volumes = {}  # {host_name: [volume_ids]}

    for mapping in mappings:
        volume_id = mapping.volume.volume_id
        if not volume_id:
            print(f"⚠️ Skipping mapping - volume {mapping.volume.name} has no volume_id")
            continue

        if mapping.target_type == 'host':
            if mapping.target_host:
                host_name = mapping.target_host.name
                if host_name not in host_volumes:
                    host_volumes[host_name] = []
                host_volumes[host_name].append(volume_id)

        elif mapping.target_type == 'cluster':
            # For clusters, map to all hosts in the cluster
            if mapping.target_cluster:
                for host in mapping.target_cluster.hosts.all():
                    host_name = host.name
                    if host_name not in host_volumes:
                        host_volumes[host_name] = []
                    host_volumes[host_name].append(volume_id)

        elif mapping.target_type == 'lpar':
            # For LPAR, use the assigned_host
            if mapping.assigned_host:
                host_name = mapping.assigned_host.name
                if host_name not in host_volumes:
                    host_volumes[host_name] = []
                host_volumes[host_name].append(volume_id)
            else:
                print(f"⚠️ Skipping LPAR mapping - no assigned_host for volume {mapping.volume.name}")

    # Generate commands for each host
    for host_name, volume_ids in sorted(host_volumes.items()):
        if not volume_ids:
            continue
        # Format volume IDs as ranges where possible
        volume_string = format_volume_ids_as_ranges(volume_ids)
        command = f"chhost -dev {device_id} -action map -volume {volume_string} {host_name}"
        commands.append(command)
        print(f"✅ DS8000 map command: {host_name} <- {len(volume_ids)} volumes")

    return commands


def format_volume_ids_as_ranges(volume_ids):
    """
    Convert a list of volume IDs into a comma-separated string with ranges.

    Contiguous volume IDs are collapsed into ranges (e.g., 5000-5006).
    Non-contiguous volumes are listed individually.

    Args:
        volume_ids: List of volume ID strings (4-digit hex, e.g., ['5000', '5001', '5002', '5010'])

    Returns:
        str: Formatted string like "5000-5002,5010"
    """
    if not volume_ids:
        return ""

    # Remove duplicates, normalize to uppercase, and sort by hex value
    unique_ids = sorted(set(v.upper() for v in volume_ids), key=lambda x: int(x, 16))

    if not unique_ids:
        return ""

    ranges = []
    range_start = unique_ids[0]
    range_end = unique_ids[0]

    for i in range(1, len(unique_ids)):
        current = unique_ids[i]
        prev = unique_ids[i - 1]

        # Check if current is contiguous with previous (hex value + 1)
        try:
            if int(current, 16) == int(prev, 16) + 1:
                # Extend the current range
                range_end = current
            else:
                # End the current range and start a new one
                if range_start == range_end:
                    ranges.append(range_start)
                else:
                    ranges.append(f"{range_start}-{range_end}")
                range_start = current
                range_end = current
        except (ValueError, TypeError):
            # If conversion fails, treat as non-contiguous
            if range_start == range_end:
                ranges.append(range_start)
            else:
                ranges.append(f"{range_start}-{range_end}")
            range_start = current
            range_end = current

    # Don't forget the last range
    if range_start == range_end:
        ranges.append(range_start)
    else:
        ranges.append(f"{range_start}-{range_end}")

    return ','.join(ranges)


def generate_mklcu_scripts(storage_systems, project=None):
    """
    Generate mklcu scripts for DS8000 storage systems with CKD volumes.

    mklcu creates Logical Control Units (LCUs) for CKD volumes.
    Each LSS that contains CKD volumes needs an LCU with a defined SSID.

    Args:
        storage_systems: QuerySet of Storage objects
        project: Project object to filter volumes by project membership

    Returns:
        dict: mklcu scripts organized by storage system name
    """
    from storage.models import Volume, LSSSummary
    from core.models import ProjectVolume
    from .views import get_lss_from_volume_id

    storage_scripts = {}

    for storage in storage_systems:
        # Only DS8000 storage systems support mklcu
        if storage.storage_type != 'DS8000':
            continue

        # Get CKD volumes for this storage that are in the project and not deployed
        if project:
            volume_ids = ProjectVolume.objects.filter(
                project=project,
                volume__storage=storage,
                volume__format='CKD',
                volume__deployed=False  # Only undeployed volumes need LCU scripts
            ).values_list('volume_id', flat=True)
            ckd_volumes = Volume.objects.filter(id__in=volume_ids)
        else:
            # Without a project, return empty - scripts require project context
            ckd_volumes = Volume.objects.none()

        if not ckd_volumes.exists():
            continue

        # Group volumes by LSS to find CKD LSSs
        ckd_lss_set = set()
        for volume in ckd_volumes:
            lss = get_lss_from_volume_id(volume.volume_id)
            if lss:
                ckd_lss_set.add(lss.upper())

        if not ckd_lss_set:
            continue

        # Get LSS Summary records for these CKD LSSs
        lss_summaries = LSSSummary.objects.filter(
            storage=storage,
            lss__in=ckd_lss_set
        ).order_by('lss')

        # Build commands and track warnings
        commands = []
        lss_with_ssid = []
        lss_without_ssid = []
        device_id = generate_ds8000_device_id(storage)

        for lss in sorted(ckd_lss_set):
            lss_summary = lss_summaries.filter(lss=lss).first()
            ssid = lss_summary.ssid if lss_summary else None

            if ssid:
                lss_with_ssid.append(lss)
                # Generate mklcu command
                # mklcu -dev {device_id} -qty 1 -id {lss} -ss {ssid}
                command = f"mklcu -dev {device_id} -qty 1 -id {lss} -ss {ssid}"
                commands.append(command)
            else:
                lss_without_ssid.append(lss)

        # Add section header at the beginning if there are commands
        if commands:
            commands.insert(0, f"### {storage.name.upper()} MKLCU COMMANDS")

        storage_scripts[storage.name] = {
            "commands": commands,
            "storage_type": storage.storage_type,
            "device_id": device_id,
            "lcu_count": len(lss_with_ssid),
            "lss_without_ssid": lss_without_ssid,
            "lss_without_ssid_count": len(lss_without_ssid),
            "total_ckd_lss": len(ckd_lss_set),
        }

        if lss_without_ssid:
            print(f"⚠️ {storage.name}: {len(lss_without_ssid)} CKD LSSs without SSID: {', '.join(lss_without_ssid)}")

        print(f"✅ Generated {len(commands) - 1 if commands else 0} mklcu commands for storage {storage.name}")

    return storage_scripts


def generate_flashsystem_volume_mapping_commands(storage, mappings):
    """
    Generate FlashSystem volume mapping commands.

    For hosts: mkvdiskhostmap -host {host_name} [-scsi {lun_id}] {volume_name}
    For clusters: mkvolumehostclustermap -hostcluster {cluster_name} [-scsi {lun_id}] {volume_name}

    Args:
        storage: Storage object
        mappings: QuerySet of VolumeMapping objects

    Returns:
        list: List of mkvdiskhostmap/mkvolumehostclustermap command strings
    """
    commands = []

    for mapping in mappings:
        volume_name = mapping.volume.name
        if not volume_name:
            print(f"⚠️ Skipping mapping - volume has no name")
            continue

        lun_option = f" -scsi {mapping.lun_id}" if mapping.lun_id is not None else ""

        if mapping.target_type == 'host':
            if mapping.target_host:
                host_name = mapping.target_host.name
                command = f"mkvdiskhostmap -host {host_name}{lun_option} {volume_name}"
                commands.append(command)
                print(f"✅ FlashSystem host map: {host_name} <- {volume_name}")

        elif mapping.target_type == 'cluster':
            if mapping.target_cluster:
                cluster_name = mapping.target_cluster.name
                command = f"mkvolumehostclustermap -hostcluster {cluster_name}{lun_option} {volume_name}"
                commands.append(command)
                print(f"✅ FlashSystem cluster map: {cluster_name} <- {volume_name}")

        elif mapping.target_type == 'lpar':
            # For LPAR on FlashSystem, map to assigned host
            if mapping.assigned_host:
                host_name = mapping.assigned_host.name
                command = f"mkvdiskhostmap -host {host_name}{lun_option} {volume_name}"
                commands.append(command)
                print(f"✅ FlashSystem LPAR host map: {host_name} <- {volume_name}")
            else:
                print(f"⚠️ Skipping LPAR mapping - no assigned_host for volume {volume_name}")

    return commands