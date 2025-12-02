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
            # If a host is in the project, it should be included in scripts
            from core.models import ProjectHost
            host_ids = ProjectHost.objects.filter(
                project=project,
                host__storage=storage
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
            # Get WWPNs from HostWwpn records
            from storage.models import HostWwpn
            host_wwpns = HostWwpn.objects.filter(host=host)

            # Collect WWPNs
            wwpn_list = []
            for hw in host_wwpns:
                if hw.wwpn:
                    # Remove colons and any other formatting from WWPN
                    clean_wwpn = hw.wwpn.replace(':', '').replace('-', '').strip()
                    if clean_wwpn and clean_wwpn not in wwpn_list:  # Avoid duplicates
                        wwpn_list.append(clean_wwpn)

            # Skip hosts without WWPNs
            if not wwpn_list:
                print(f"⚠️ Skipping host {host.name} - no WWPNs found in HostWwpn records")
                continue
            
            # Generate command based on storage type
            command = generate_mkhost_command(storage, host, wwpn_list)
            if command:
                commands.append(command)
                print(f"✅ Generated command for host {host.name}: {command}")
        
        storage_scripts[storage.name] = {
            "commands": commands,
            "storage_type": storage.storage_type,
            "host_count": len(commands)
        }
        
        print(f"✅ Generated {len(commands)} commands for storage {storage.name}")
    
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
    # Join WWPNs with commas (no spaces) for FlashSystem
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
    
    # Put host_type in quotes for DS8000
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