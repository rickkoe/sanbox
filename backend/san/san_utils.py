from collections import defaultdict
from core.models import Config
from san.models import Alias, Zone, Fabric
from .san_tools import wwpn_colonizer

def merge_dicts(*dicts):
    merged_dict = {}
    for d in dicts:
        for key, value in d.items():
            if key in merged_dict:
                merged_dict[key].extend(value)
            else:
                merged_dict[key] = value
    return merged_dict

def build_device_alias_commands(alias, command_list):
    """
    Builds device alias command for a given alias.
    If the command list is empty, add startup commands.
    """
    if not command_list:
        command_list.extend(['device-alias database'])
    command_list.append(f'device-alias name {alias.name} pwwn {wwpn_colonizer(alias.wwpn)}')
    return command_list


def build_fcalias_commands(alias, command_list):
    """
    Builds fcalias command for a given alias.
    """
    command_list.append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
    return command_list

def generate_alias_deletion_commands(aliases, config):
    # Create dictionaries with default structure containing commands list and fabric_info for deletion
    device_alias_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    
    for alias in aliases:
        key = alias.fabric.name
        # Store fabric info if not already stored
        fabric_info = {
            "name": alias.fabric.name,
            "san_vendor": alias.fabric.san_vendor,
            "vsan": alias.fabric.vsan
        }
        
        # Set fabric info for device alias deletion dictionary
        if device_alias_delete_dict[key]["fabric_info"] is None:
            device_alias_delete_dict[key]["fabric_info"] = fabric_info
            
        if alias.fabric.san_vendor == 'CI':
            if alias.cisco_alias == 'device-alias':
                if not device_alias_delete_dict[key]["commands"]:
                    device_alias_delete_dict[key]["commands"].append(f'### ALIAS DELETION COMMANDS FOR {key.upper()} ')
                    device_alias_delete_dict[key]["commands"].append('device-alias database')
                device_alias_delete_dict[key]["commands"].append(f'no device-alias name {alias.name}')
    
    # Add commit command for device aliases
    for key in device_alias_delete_dict:
        if device_alias_delete_dict[key]["commands"]:
            device_alias_delete_dict[key]["commands"].append('device-alias commit')

    # Sort by fabric names and return
    return dict(sorted(device_alias_delete_dict.items()))

def generate_alias_deletion_only_commands(delete_aliases, project):
    """
    Generate only alias deletion commands (separate from creation commands).
    Args:
        delete_aliases: QuerySet of aliases to delete
        project: Project instance (not used directly, but kept for consistency)
    """
    device_alias_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    fcalias_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    brocade_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    
    # Process delete aliases
    for alias in delete_aliases:
        key = alias.fabric.name
        fabric_info = {
            "name": alias.fabric.name,
            "san_vendor": alias.fabric.san_vendor,
            "vsan": alias.fabric.vsan
        }
        
        # Set fabric info for deletion dictionaries
        if device_alias_delete_dict[key]["fabric_info"] is None:
            device_alias_delete_dict[key]["fabric_info"] = fabric_info
        if fcalias_delete_dict[key]["fabric_info"] is None:
            fcalias_delete_dict[key]["fabric_info"] = fabric_info
        if brocade_delete_dict[key]["fabric_info"] is None:
            brocade_delete_dict[key]["fabric_info"] = fabric_info
            
        if alias.fabric.san_vendor == 'CI':
            if alias.cisco_alias == 'device-alias':
                if not device_alias_delete_dict[key]["commands"]:
                    device_alias_delete_dict[key]["commands"].append(f'### ALIAS DELETION COMMANDS FOR {key.upper()} ')
                    device_alias_delete_dict[key]["commands"].append('device-alias database')
                device_alias_delete_dict[key]["commands"].append(f'no device-alias name {alias.name}')
            elif alias.cisco_alias == 'fcalias':
                if not fcalias_delete_dict[key]["commands"]:
                    fcalias_delete_dict[key]["commands"].append(f'### FCALIAS DELETION COMMANDS FOR {key.upper()} ')
                fcalias_delete_dict[key]["commands"].append(f'no fcalias name {alias.name} vsan {alias.fabric.vsan}')
        elif alias.fabric.san_vendor == 'BR':
            if not brocade_delete_dict[key]["commands"]:
                brocade_delete_dict[key]["commands"].append(f'### ALIAS DELETION COMMANDS FOR {key.upper()} ')
            brocade_delete_dict[key]["commands"].append(f'alidelete "{alias.name}"')
    
    # Add commit commands for device alias deletion
    for key in device_alias_delete_dict:
        if device_alias_delete_dict[key]["commands"]:
            device_alias_delete_dict[key]["commands"].append('device-alias commit')
    
    # Merge deletion commands
    result = {}
    all_keys = set(list(device_alias_delete_dict.keys()) + list(fcalias_delete_dict.keys()) + list(brocade_delete_dict.keys()))
    
    for key in all_keys:
        result[key] = {
            "commands": [],
            "fabric_info": None
        }
        
        # Add device-alias deletion commands first
        if key in device_alias_delete_dict and device_alias_delete_dict[key]["commands"]:
            result[key]["commands"].extend(device_alias_delete_dict[key]["commands"])
            result[key]["fabric_info"] = device_alias_delete_dict[key]["fabric_info"]
        
        # Add fcalias deletion commands
        if key in fcalias_delete_dict and fcalias_delete_dict[key]["commands"]:
            result[key]["commands"].extend(fcalias_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = fcalias_delete_dict[key]["fabric_info"]
        
        # Add brocade deletion commands
        if key in brocade_delete_dict and brocade_delete_dict[key]["commands"]:
            result[key]["commands"].extend(brocade_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = brocade_delete_dict[key]["fabric_info"]
    
    # Sort by fabric names
    return dict(sorted(result.items()))

def generate_alias_commands(create_aliases, delete_aliases, project):
    """
    Generate alias commands for the given project.
    Args:
        create_aliases: QuerySet of aliases to create
        delete_aliases: QuerySet of aliases to delete
        project: Project instance (not used directly, but kept for consistency)
    """
    # Create separate dictionaries for creation and deletion commands
    device_alias_create_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    fcalias_create_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    brocade_create_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})

    device_alias_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    fcalias_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    brocade_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    
    # Process create aliases
    for alias in create_aliases:
        key = alias.fabric.name
        fabric_info = {
            "name": alias.fabric.name,
            "san_vendor": alias.fabric.san_vendor,
            "vsan": alias.fabric.vsan
        }
        
        # Set fabric info for creation dictionaries
        if device_alias_create_dict[key]["fabric_info"] is None:
            device_alias_create_dict[key]["fabric_info"] = fabric_info
        if fcalias_create_dict[key]["fabric_info"] is None:
            fcalias_create_dict[key]["fabric_info"] = fabric_info
        if brocade_create_dict[key]["fabric_info"] is None:
            brocade_create_dict[key]["fabric_info"] = fabric_info
            
        if alias.fabric.san_vendor == 'CI':
            if alias.cisco_alias == 'device-alias':
                if not device_alias_create_dict[key]["commands"]:
                    device_alias_create_dict[key]["commands"].append(f'### ALIAS CREATION COMMANDS FOR {key.upper()} ')
                    device_alias_create_dict[key]["commands"].append('device-alias database')
                device_alias_create_dict[key]["commands"].append(f'device-alias name {alias.name} pwwn {wwpn_colonizer(alias.wwpn)}')
            elif alias.cisco_alias == 'fcalias':
                if not fcalias_create_dict[key]["commands"]:
                    fcalias_create_dict[key]["commands"].append(f'### FCALIAS CREATION COMMANDS FOR {key.upper()} ')
                fcalias_create_dict[key]["commands"].append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
        elif alias.fabric.san_vendor == 'BR':
            if not brocade_create_dict[key]["commands"]:
                brocade_create_dict[key]["commands"].append(f'### ALIAS CREATION COMMANDS FOR {key.upper()} ')
            brocade_create_dict[key]["commands"].append(f'alicreate "{alias.name}", "{wwpn_colonizer(alias.wwpn)}"')
    
    # Add commit commands for device alias creation
    for key in device_alias_create_dict:
        if device_alias_create_dict[key]["commands"]:
            device_alias_create_dict[key]["commands"].append('device-alias commit')
    
    # Process delete aliases (device-alias and fcalias)
    for alias in delete_aliases:
        key = alias.fabric.name
        fabric_info = {
            "name": alias.fabric.name,
            "san_vendor": alias.fabric.san_vendor,
            "vsan": alias.fabric.vsan
        }
        
        # Set fabric info for deletion dictionaries
        if device_alias_delete_dict[key]["fabric_info"] is None:
            device_alias_delete_dict[key]["fabric_info"] = fabric_info
        if fcalias_delete_dict[key]["fabric_info"] is None:
            fcalias_delete_dict[key]["fabric_info"] = fabric_info
        if brocade_delete_dict[key]["fabric_info"] is None:
            brocade_delete_dict[key]["fabric_info"] = fabric_info
            
        if alias.fabric.san_vendor == 'CI':
            if alias.cisco_alias == 'device-alias':
                if not device_alias_delete_dict[key]["commands"]:
                    device_alias_delete_dict[key]["commands"].append(f'### CLEANUP/DELETION COMMANDS FOR {key.upper()} ')
                    device_alias_delete_dict[key]["commands"].append('device-alias database')
                device_alias_delete_dict[key]["commands"].append(f'no device-alias name {alias.name}')
            elif alias.cisco_alias == 'fcalias':
                if not fcalias_delete_dict[key]["commands"]:
                    fcalias_delete_dict[key]["commands"].append(f'### CLEANUP/DELETION COMMANDS FOR {key.upper()} ')
                fcalias_delete_dict[key]["commands"].append(f'no fcalias name {alias.name} vsan {alias.fabric.vsan}')
        elif alias.fabric.san_vendor == 'BR':
            if not brocade_delete_dict[key]["commands"]:
                brocade_delete_dict[key]["commands"].append(f'### CLEANUP/DELETION COMMANDS FOR {key.upper()} ')
            brocade_delete_dict[key]["commands"].append(f'alidelete "{alias.name}"')
    
    # Add commit commands for device alias deletion
    for key in device_alias_delete_dict:
        if device_alias_delete_dict[key]["commands"]:
            device_alias_delete_dict[key]["commands"].append('device-alias commit')
    
    # Merge creation and deletion commands with creation first, then deletion
    result = {}
    all_keys = set(list(device_alias_create_dict.keys()) + list(fcalias_create_dict.keys()) + 
                   list(brocade_create_dict.keys()) + list(device_alias_delete_dict.keys()) + 
                   list(fcalias_delete_dict.keys()) + list(brocade_delete_dict.keys()))
    
    for key in all_keys:
        result[key] = {
            "commands": [],
            "fabric_info": None
        }
        
        # Add creation commands first
        if key in device_alias_create_dict and device_alias_create_dict[key]["commands"]:
            result[key]["commands"].extend(device_alias_create_dict[key]["commands"])
            result[key]["fabric_info"] = device_alias_create_dict[key]["fabric_info"]
            
        if key in fcalias_create_dict and fcalias_create_dict[key]["commands"]:
            result[key]["commands"].extend(fcalias_create_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = fcalias_create_dict[key]["fabric_info"]
            
        if key in brocade_create_dict and brocade_create_dict[key]["commands"]:
            result[key]["commands"].extend(brocade_create_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = brocade_create_dict[key]["fabric_info"]
        
        # Add a blank line separator if we have both creation and deletion commands
        has_deletions = ((key in device_alias_delete_dict and device_alias_delete_dict[key]["commands"]) or
                        (key in fcalias_delete_dict and fcalias_delete_dict[key]["commands"]) or
                        (key in brocade_delete_dict and brocade_delete_dict[key]["commands"]))
        if result[key]["commands"] and has_deletions:
            result[key]["commands"].append('')
        
        # Add deletion commands at the bottom
        if key in device_alias_delete_dict and device_alias_delete_dict[key]["commands"]:
            result[key]["commands"].extend(device_alias_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = device_alias_delete_dict[key]["fabric_info"]
        
        # Add fcalias deletion commands after device-alias commit
        if key in fcalias_delete_dict and fcalias_delete_dict[key]["commands"]:
            result[key]["commands"].extend(fcalias_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = fcalias_delete_dict[key]["fabric_info"]
        
        # Add brocade deletion commands
        if key in brocade_delete_dict and brocade_delete_dict[key]["commands"]:
            result[key]["commands"].extend(brocade_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = brocade_delete_dict[key]["fabric_info"]
    
    # Sort by fabric names
    return dict(sorted(result.items()))

def generate_zone_commands(create_zones, delete_zones, project):
    """
    Generate zone commands for the given project.
    Args:
        create_zones: QuerySet of zones to create
        delete_zones: QuerySet of zones to delete
        project: Project instance to generate commands for
    """
    from core.models import ProjectAlias

    # Get aliases for this project via junction table with action='create'
    create_alias_ids = ProjectAlias.objects.filter(
        project=project,
        action='create'
    ).values_list('alias_id', flat=True)
    create_aliases = Alias.objects.filter(id__in=create_alias_ids)

    # Get aliases for this project via junction table with action='delete'
    delete_alias_ids = ProjectAlias.objects.filter(
        project=project,
        action='delete'
    ).values_list('alias_id', flat=True)
    delete_aliases = Alias.objects.filter(id__in=delete_alias_ids)
    alias_command_dict = defaultdict(list)
    zone_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    zoneset_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    zone_delete_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})

    # Get alias commands in new format
    alias_commands = generate_alias_commands(create_aliases, delete_aliases, project)
    
    # Create Zone Commands
    all_zones = create_zones.select_related('fabric').prefetch_related('members').order_by('id')

    # Get all alias IDs that should be included in zoning for this project
    zoning_alias_ids = set(
        ProjectAlias.objects.filter(
            project=project,
            include_in_zoning=True
        ).values_list('alias_id', flat=True)
    )

    for zone in all_zones:
        # Filter zone members to only those included in zoning for this project
        zone_member_list = []
        for zone_member in zone.members.all():
            if zone_member.id in zoning_alias_ids:
                zone_member_list.append(zone_member.name)
        zone_member_length = len(zone_member_list)
        key = zone.fabric.name
        
        # Store fabric info
        fabric_info = {
            "name": zone.fabric.name,
            "san_vendor": zone.fabric.san_vendor,
            "zoneset_name": zone.fabric.zoneset_name,
            "vsan": zone.fabric.vsan
        }
        
        # Set fabric info if not already set
        if zone_command_dict[key]["fabric_info"] is None:
            zone_command_dict[key]["fabric_info"] = fabric_info
        if zoneset_command_dict[key]["fabric_info"] is None:
            zoneset_command_dict[key]["fabric_info"] = fabric_info
        
        if key not in zone_command_dict or not zone_command_dict[key]["commands"]:
            zone_command_dict[key]["commands"].extend([' ', f'### ZONE COMMANDS FOR {key.upper()} '])
        if key not in zoneset_command_dict or not zoneset_command_dict[key]["commands"]:
            zoneset_command_dict[key]["commands"].extend([' ', f'### ZONESET COMMANDS FOR {key.upper()} '])
            
        if zone_member_length > 0:
            if zone.fabric.san_vendor == 'CI':
                if len(zoneset_command_dict[key]["commands"]) == 2:
                    zoneset_command_dict[key]["commands"].append(f'zoneset name {zone.fabric.zoneset_name} vsan {zone.fabric.vsan}')
                zone_command_dict[key]["commands"].append(f'zone name {zone.name} vsan {zone.fabric.vsan}')
                if zone.exists == False:
                    zoneset_command_dict[key]["commands"].append(f'member {zone.name}')
                for zone_member in zone_members:
                    if zone_member.cisco_alias == 'fcalias':  
                        zone_command_dict[key]["commands"].append(f'member {zone_member.cisco_alias} {zone_member.name}')
                    elif zone_member.cisco_alias == 'device-alias' and zone.zone_type == 'smart':
                        zone_command_dict[key]["commands"].append(f'member {zone_member.cisco_alias} {zone_member.name} {zone_member.use}')
                    elif zone_member.cisco_alias == 'device-alias' and zone.zone_type == 'standard':
                        zone_command_dict[key]["commands"].append(f'member {zone_member.cisco_alias} {zone_member.name}')
                    elif zone_member.cisco_alias == 'wwpn':
                        if zone.zone_type == 'smart':
                            zone_command_dict[key]["commands"].append(f'member pwwn {zone_member.wwpn} {zone_member.use}')
                        elif zone.zone_type == 'standard':
                            zone_command_dict[key]["commands"].append(f'member pwwn {zone_member.wwpn}')
            elif zone.fabric.san_vendor == 'BR':
                if zone.zone_type == 'standard':
                    zone_member_list = ';'.join(zone_member_list)
                    if zone.exists == True:
                        zone_command_dict[key]["commands"].append(f'zoneadd "{zone.name}", "{zone_member_list}"')
                    elif zone.exists == False:
                        zone_command_dict[key]["commands"].append(f'zonecreate "{zone.name}", "{zone_member_list}"')
                elif zone.zone_type == 'smart':
                    initiators = ';'.join([alias.name for alias in zone_members if alias.use == 'init'])
                    targets = ';'.join([alias.name for alias in zone_members if alias.use == 'target'])
                    if zone.exists == True:
                        if targets: 
                            principal = f' -principal "{targets}"'
                        else:
                            principal = ''
                        if initiators:
                            members = f' -members "{initiators}"'
                        else:
                            members = ''
                        zone_command_dict[key]["commands"].append(f'zoneadd --peerzone "{zone.name}"{principal}{members}')
                    elif zone.exists == False:
                        zone_command_dict[key]["commands"].append(f'zonecreate --peerzone "{zone.name}" -principal "{targets}" -members "{initiators}"')
                if len(zoneset_command_dict[key]["commands"]) == 2 and zone.fabric.exists == False and zone.exists == False:
                    zoneset_command_dict[key]["commands"].append(f'cfgcreate "{zone.fabric.zoneset_name}", "{zone.name}"')
                elif zone.exists == False:
                    zoneset_command_dict[key]["commands"].append(f'cfgadd "{zone.fabric.zoneset_name}", "{zone.name}"')
                else:
                    pass

    
    # Process Zone Deletions
    for zone in delete_zones.select_related('fabric'):
        key = zone.fabric.name
        fabric_info = {
            "name": zone.fabric.name,
            "san_vendor": zone.fabric.san_vendor,
            "zoneset_name": zone.fabric.zoneset_name,
            "vsan": zone.fabric.vsan
        }
        
        # Set fabric info for deletion dictionary
        if zone_delete_dict[key]["fabric_info"] is None:
            zone_delete_dict[key]["fabric_info"] = fabric_info
        
        if zone.fabric.san_vendor == 'CI':
            if not zone_delete_dict[key]["commands"]:
                zone_delete_dict[key]["commands"].append(f'### CLEANUP/DELETION COMMANDS FOR {key.upper()} ')
            zone_delete_dict[key]["commands"].append(f'no zone name {zone.name} vsan {zone.fabric.vsan}')
        elif zone.fabric.san_vendor == 'BR':
            if not zone_delete_dict[key]["commands"]:
                zone_delete_dict[key]["commands"].append(f'### CLEANUP/DELETION COMMANDS FOR {key.upper()} ')
            zone_delete_dict[key]["commands"].append(f'zonedelete "{zone.name}"')
    
    for key in zoneset_command_dict:
        if zoneset_command_dict[key]["commands"]:
            fabric_info = zoneset_command_dict[key]["fabric_info"]
            if fabric_info and fabric_info["san_vendor"] == 'CI':
                zoneset_command_dict[key]["commands"].append(f'zoneset activate name {fabric_info["zoneset_name"]} vsan {fabric_info["vsan"]}')
                # Default to enhanced mode for zone commit (cisco_zoning_mode field was removed)
                zoneset_command_dict[key]["commands"].append(f'zone commit vsan {fabric_info["vsan"]}')
            elif fabric_info and fabric_info["san_vendor"] == 'BR':
                zoneset_command_dict[key]["commands"].append(f'cfgenable "{fabric_info["zoneset_name"]}"')
    
    # Convert the old format alias commands to new format
    alias_command_dict = {}
    for key, value in alias_commands.items():
        if isinstance(value, dict) and "commands" in value:
            # Already in new format
            alias_command_dict[key] = value
        else:
            # Convert old format to new format
            alias_command_dict[key] = {
                "commands": value,
                "fabric_info": zone_command_dict.get(key, {}).get("fabric_info")
            }

    # Merge all command dictionaries
    result = {}
    for key in set(list(alias_command_dict.keys()) + list(zone_command_dict.keys()) + list(zoneset_command_dict.keys()) + list(zone_delete_dict.keys())):
        result[key] = {
            "commands": [],
            "fabric_info": None
        }
        
        # Add alias commands
        if key in alias_command_dict:
            if isinstance(alias_command_dict[key], dict) and "commands" in alias_command_dict[key]:
                result[key]["commands"].extend(alias_command_dict[key]["commands"])
                if not result[key]["fabric_info"] and "fabric_info" in alias_command_dict[key]:
                    result[key]["fabric_info"] = alias_command_dict[key]["fabric_info"]
            else:
                # Handle old format (directly commands array)
                result[key]["commands"].extend(alias_command_dict[key])
        
        # Add zone commands
        if key in zone_command_dict and zone_command_dict[key]["commands"]:
            result[key]["commands"].extend(zone_command_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = zone_command_dict[key]["fabric_info"]
        
        # Add zoneset commands
        if key in zoneset_command_dict and zoneset_command_dict[key]["commands"]:
            result[key]["commands"].extend(zoneset_command_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = zoneset_command_dict[key]["fabric_info"]
        
        # Add blank line separator if we have zone deletion commands
        if result[key]["commands"] and key in zone_delete_dict and zone_delete_dict[key]["commands"]:
            result[key]["commands"].append('')
        
        # Add zone deletion commands at the bottom
        if key in zone_delete_dict and zone_delete_dict[key]["commands"]:
            result[key]["commands"].extend(zone_delete_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = zone_delete_dict[key]["fabric_info"]
    
    # Sort by fabric names
    sorted_result = dict(sorted(result.items()))
    return sorted_result

def generate_zone_deletion_commands(delete_zones, project):
    """
    Generate comprehensive zone deletion scripts in reverse order: zoneset -> zones -> aliases -> activate.
    Args:
        delete_zones: QuerySet of zones to delete
        project: Project instance to generate commands for
    """
    from core.models import ProjectAlias

    print(f"🔍 Starting generate_zone_deletion_commands with {delete_zones.count()} zones")

    try:
        # Get aliases for this project via junction table with action='delete'
        delete_alias_ids = ProjectAlias.objects.filter(
            project=project,
            action='delete'
        ).values_list('alias_id', flat=True)
        delete_aliases = Alias.objects.filter(id__in=delete_alias_ids)
        print(f"🔍 Found {delete_aliases.count()} aliases to delete")

        # Get all alias IDs that should be included in zoning for this project
        zoning_alias_ids = set(
            ProjectAlias.objects.filter(
                project=project,
                include_in_zoning=True
            ).values_list('alias_id', flat=True)
        )

        # Group everything by fabric
        fabric_scripts = defaultdict(lambda: {"commands": [], "fabric_info": None})
        
        # Process delete zones to get all unique fabrics
        all_zones = delete_zones.select_related('fabric').prefetch_related('members').order_by('id')
        
        for zone in all_zones:
            key = zone.fabric.name
            fabric_info = {
                "name": zone.fabric.name,
                "san_vendor": zone.fabric.san_vendor,
                "zoneset_name": zone.fabric.zoneset_name,
                "vsan": zone.fabric.vsan
            }
            
            # Set fabric info if not already set
            if fabric_scripts[key]["fabric_info"] is None:
                fabric_scripts[key]["fabric_info"] = fabric_info
        
        print(f"🔍 Processing {len(fabric_scripts)} fabrics for deletion")
        
        # For each fabric, build the complete deletion script in reverse order
        for fabric_key, fabric_data in fabric_scripts.items():
            print(f"🔍 Processing fabric for deletion: {fabric_key}")
            fabric_info = fabric_data["fabric_info"]
            commands = []
            
            # Get aliases for this fabric
            fabric_aliases = delete_aliases.filter(fabric__name=fabric_key)
            print(f"🔍 Found {fabric_aliases.count()} aliases to delete for fabric {fabric_key}")
            
            if fabric_info["san_vendor"] == 'CI':
                # CISCO DELETION FORMAT (in reverse order)
                print(f"🔍 Processing Cisco fabric deletion {fabric_key}")
                
                # Start with config t
                commands.append('config t')
                
                # 1. REMOVE ZONES FROM ZONESET
                commands.append('')  # blank line before zoneset commands
                commands.append(f'### ZONESET REMOVAL COMMANDS FOR {fabric_key.upper()}')
                commands.append(f'zoneset name {fabric_info["zoneset_name"]} vsan {fabric_info["vsan"]}')
                
                fabric_zones = all_zones.filter(fabric__name=fabric_key)
                for zone in fabric_zones:
                    # Check if zone has any members included in zoning for this project
                    has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                    if has_zoning_members:
                        commands.append(f'  no member {zone.name}')

                # 2. DELETE ZONES
                commands.append('')  # blank line before zone commands
                commands.append(f'### ZONE DELETION COMMANDS FOR {fabric_key.upper()}')

                for zone in fabric_zones:
                    # Check if zone has any members included in zoning for this project
                    has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                    if has_zoning_members:
                        commands.append(f'no zone name {zone.name} vsan {fabric_info["vsan"]}')
                
                # 3. DELETE ALIASES
                commands.append('')  # blank line before alias commands
                commands.append(f'### ALIAS DELETION COMMANDS FOR {fabric_key.upper()}')
                
                # Delete FCaliases first
                fcaliases = fabric_aliases.filter(cisco_alias='fcalias')
                for alias in fcaliases:
                    commands.append(f'no fcalias name {alias.name} vsan {fabric_info["vsan"]}')
                
                # Then delete device-aliases
                device_aliases = fabric_aliases.filter(cisco_alias='device-alias')
                if device_aliases.exists():
                    commands.append('device-alias database')
                    for alias in device_aliases:
                        commands.append(f'no device-alias name {alias.name}')
                    commands.append('device-alias commit')
                
                # 4. ACTIVATE ZONESET
                commands.append('')  # blank line before activation
                commands.append(f'### ZONESET ACTIVATION COMMANDS FOR {fabric_key.upper()}')
                commands.append(f'zoneset activate name {fabric_info["zoneset_name"]} vsan {fabric_info["vsan"]}')
                commands.append(f'zone commit vsan {fabric_info["vsan"]}')
                
                # End with copy run start
                commands.append('')  # blank line before copy run start
                commands.append('copy run start')
            
            elif fabric_info["san_vendor"] == 'BR':
                # BROCADE DELETION FORMAT (in reverse order)
                print(f"🔍 Processing Brocade fabric deletion {fabric_key}")
                
                # 1. REMOVE ZONES FROM CONFIGURATION
                commands.append('')  # blank line before zoneset commands
                commands.append(f'### CONFIGURATION REMOVAL COMMANDS FOR {fabric_key.upper()}')
                
                fabric_zones = all_zones.filter(fabric__name=fabric_key)
                for zone in fabric_zones:
                    # Check if zone has any members included in zoning for this project
                    has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                    if has_zoning_members:
                        commands.append(f'cfgremove "{fabric_info["zoneset_name"]}", "{zone.name}"')

                # 2. DELETE ZONES
                commands.append('')  # blank line before zone commands
                commands.append(f'### ZONE DELETION COMMANDS FOR {fabric_key.upper()}')

                for zone in fabric_zones:
                    # Check if zone has any members included in zoning for this project
                    has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                    if has_zoning_members:
                        commands.append(f'zonedelete "{zone.name}"')
                
                # 3. DELETE ALIASES
                commands.append('')  # blank line before alias commands
                commands.append(f'### ALIAS DELETION COMMANDS FOR {fabric_key.upper()}')
                
                brocade_aliases = fabric_aliases
                for alias in brocade_aliases:
                    commands.append(f'alidelete "{alias.name}"')
                
                # 4. ENABLE CONFIGURATION
                commands.append('')  # blank line before activation
                commands.append(f'### CONFIGURATION ACTIVATION COMMANDS FOR {fabric_key.upper()}')
                commands.append(f'cfgenable "{fabric_info["zoneset_name"]}"')
            
            fabric_data["commands"] = commands
            print(f"✅ Generated {len(commands)} deletion commands for fabric {fabric_key}")
        
        # Sort by fabric names
        result = dict(sorted(fabric_scripts.items()))
        print(f"✅ Successfully generated deletion scripts for {len(result)} fabrics")
        return result
        
    except Exception as e:
        print(f"❌ Error in generate_zone_deletion_commands: {e}")
        import traceback
        traceback.print_exc()
        raise

def generate_zone_creation_commands(create_zones, project):
    """
    Generate zone creation scripts with aliases included in the specified format.
    Args:
        create_zones: QuerySet of zones to create
        project: Project instance to generate commands for
    """
    from core.models import ProjectAlias

    print(f"🔍 Starting generate_zone_creation_commands with {create_zones.count()} zones")

    try:
        # Get aliases for this project via junction table with action='create'
        create_alias_ids = ProjectAlias.objects.filter(
            project=project,
            action='create'
        ).values_list('alias_id', flat=True)
        create_aliases = Alias.objects.filter(id__in=create_alias_ids)
        print(f"🔍 Found {create_aliases.count()} aliases to create")

        # Get all alias IDs that should be included in zoning for this project
        zoning_alias_ids = set(
            ProjectAlias.objects.filter(
                project=project,
                include_in_zoning=True
            ).values_list('alias_id', flat=True)
        )

        # Group everything by fabric
        fabric_scripts = defaultdict(lambda: {"commands": [], "fabric_info": None})

        # Process create zones to get all unique fabrics
        all_zones = create_zones.select_related('fabric').prefetch_related('members').order_by('id')
        
        for zone in all_zones:
            key = zone.fabric.name
            fabric_info = {
                "name": zone.fabric.name,
                "san_vendor": zone.fabric.san_vendor,
                "zoneset_name": zone.fabric.zoneset_name,
                "vsan": zone.fabric.vsan
            }
            
            # Set fabric info if not already set
            if fabric_scripts[key]["fabric_info"] is None:
                fabric_scripts[key]["fabric_info"] = fabric_info
        
        print(f"🔍 Processing {len(fabric_scripts)} fabrics")
        
        # For each fabric, build the complete script
        for fabric_key, fabric_data in fabric_scripts.items():
            print(f"🔍 Processing fabric: {fabric_key}")
            fabric_info = fabric_data["fabric_info"]
            commands = []
            
            # Get aliases for this fabric
            fabric_aliases = create_aliases.filter(fabric__name=fabric_key)
            print(f"🔍 Found {fabric_aliases.count()} aliases for fabric {fabric_key}")
            
            if fabric_info["san_vendor"] == 'CI':
                # CISCO FORMAT
                print(f"🔍 Processing Cisco fabric {fabric_key}")
                
                # Start with config t
                commands.append('config t')
                commands.append('')  # blank line after config t
                
                # 1. ALIAS CREATION COMMANDS
                commands.append(f'### {fabric_key.upper()} ALIAS CREATION COMMANDS')
                
                # Device-alias commands
                device_aliases = fabric_aliases.filter(cisco_alias='device-alias')
                if device_aliases.exists():
                    commands.append('device-alias database')
                    for alias in device_aliases:
                        commands.append(f'device-alias name {alias.name} pwwn {wwpn_colonizer(alias.wwpn)}')
                    commands.append('device-alias commit')
                
                # FCAlias commands  
                fcaliases = fabric_aliases.filter(cisco_alias='fcalias')
                for alias in fcaliases:
                    commands.append(f'fcalias name {alias.name} vsan {fabric_info["vsan"]} ; member pwwn {wwpn_colonizer(alias.wwpn)} {alias.use}')
                
                # 2. ZONE COMMANDS
                commands.append('')  # blank line before zone commands
                commands.append(f'### ZONE COMMANDS FOR {fabric_key.upper()}')
                
                fabric_zones = all_zones.filter(fabric__name=fabric_key)
                for zone in fabric_zones:
                    # Get zone members that are included in zoning for this project
                    zone_members = [member for member in zone.members.all() if member.id in zoning_alias_ids]
                    if len(zone_members) > 0:
                        # Zone creation line with comment
                        commands.append(f'zone name {zone.name} vsan {fabric_info["vsan"]}')

                        # Add members
                        for member in zone_members:
                            if member.cisco_alias == 'fcalias':
                                # fcalias doesn't get a use because it's defined in the alias
                                commands.append(f'  member fcalias {member.name}')
                            elif member.cisco_alias == 'device-alias':
                                if zone.zone_type == 'smart':
                                    commands.append(f'  member device-alias {member.name} {member.use}')
                                else:  # standard zone
                                    commands.append(f'  member device-alias {member.name}')
                            elif member.cisco_alias == 'wwpn':
                                if zone.zone_type == 'smart':
                                    commands.append(f'  member pwwn {wwpn_colonizer(member.wwpn)} {member.use}')
                                else:  # standard zone
                                    commands.append(f'  member pwwn {wwpn_colonizer(member.wwpn)}')
                
                # 3. ZONESET COMMANDS
                commands.append('')  # blank line before zoneset commands
                commands.append(f'### ZONESET COMMANDS FOR {fabric_key.upper()}')
                
                if fabric_zones.exists():
                    commands.append(f'zoneset name {fabric_info["zoneset_name"]} vsan {fabric_info["vsan"]}')

                    # Add zone members to zoneset
                    for zone in fabric_zones:
                        # Check if zone has any members included in zoning for this project
                        has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                        if has_zoning_members and not zone.exists:
                            commands.append(f'  member {zone.name}')
                    
                    # Activate and commit
                    commands.append(f'zoneset activate name {fabric_info["zoneset_name"]} vsan {fabric_info["vsan"]}')
                    commands.append(f'zone commit vsan {fabric_info["vsan"]}')
                
                # End with copy run start
                commands.append('')  # blank line before copy run start
                commands.append('copy run start')
            
            elif fabric_info["san_vendor"] == 'BR':
                # BROCADE FORMAT
                print(f"🔍 Processing Brocade fabric {fabric_key}")
                
                # 1. ALIAS CREATION COMMANDS
                commands.append(f'### {fabric_key.upper()} ALIAS CREATION COMMANDS')
                
                brocade_aliases = fabric_aliases
                for alias in brocade_aliases:
                    commands.append(f'alicreate "{alias.name}", "{wwpn_colonizer(alias.wwpn)}"')
                
                # 2. ZONE COMMANDS
                commands.append('')  # blank line before zone commands
                commands.append(f'### ZONE COMMANDS FOR {fabric_key.upper()}')
                
                fabric_zones = all_zones.filter(fabric__name=fabric_key)
                for zone in fabric_zones:
                    # Get zone members that are included in zoning for this project
                    zone_members = [member for member in zone.members.all() if member.id in zoning_alias_ids]
                    if len(zone_members) > 0:
                        if zone.zone_type == 'smart':
                            # Separate initiators and targets
                            initiators = [m.name for m in zone_members if m.use == 'init']
                            targets = [m.name for m in zone_members if m.use == 'target']
                            
                            initiators_str = ';'.join(initiators) if initiators else ''
                            targets_str = ';'.join(targets) if targets else ''
                            
                            if zone.exists:
                                commands.append(f'zoneadd --peerzone "{zone.name}" -principal "{targets_str}" -members "{initiators_str}"  #smart zone')
                            else:
                                commands.append(f'zonecreate --peerzone "{zone.name}" -principal "{targets_str}" -members "{initiators_str}"  #smart zone')
                        else:  # standard zone
                            members = [m.name for m in zone_members]
                            members_str = ';'.join(members)
                            
                            if zone.exists:
                                commands.append(f'zoneadd "{zone.name}", "{members_str}"  #standard zone')
                            else:
                                commands.append(f'zonecreate "{zone.name}", "{members_str}"  #standard zone')
                
                # 3. ZONESET COMMANDS  
                commands.append('')  # blank line before zoneset commands
                commands.append(f'### ZONESET COMMANDS FOR {fabric_key.upper()}')
                
                if fabric_zones.exists():
                    
                    # Check if fabric exists to determine cfgcreate vs cfgadd
                    fabric_exists = getattr(fabric_zones.first().fabric, 'exists', True)
                    if not fabric_exists:
                        # Use cfgcreate for first zone if fabric doesn't exist
                        # Find first zone with members included in zoning
                        first_zone = None
                        for zone in fabric_zones:
                            if any(member.id in zoning_alias_ids for member in zone.members.all()):
                                first_zone = zone
                                break
                        if first_zone:
                            commands.append(f'cfgcreate "{fabric_info["zoneset_name"]}", "{first_zone.name}"')
                            # Add remaining zones with cfgadd
                            for zone in fabric_zones.exclude(id=first_zone.id):
                                # Check if zone has any members included in zoning for this project
                                has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                                if has_zoning_members and not zone.exists:
                                    commands.append(f'cfgadd "{fabric_info["zoneset_name"]}", "{zone.name}"')
                    else:
                        # Use cfgadd for all zones if fabric exists
                        for zone in fabric_zones:
                            # Check if zone has any members included in zoning for this project
                            has_zoning_members = any(member.id in zoning_alias_ids for member in zone.members.all())
                            if has_zoning_members and not zone.exists:
                                commands.append(f'cfgadd "{fabric_info["zoneset_name"]}", "{zone.name}"')
                    
                    # Enable configuration
                    commands.append(f'cfgenable "{fabric_info["zoneset_name"]}"')
            
            fabric_data["commands"] = commands
            print(f"✅ Generated {len(commands)} commands for fabric {fabric_key}")
            print(f"🔍 First 10 commands: {commands[:10]}")
        
        # Sort by fabric names
        result = dict(sorted(fabric_scripts.items()))
        print(f"✅ Successfully generated scripts for {len(result)} fabrics")
        return result
        
    except Exception as e:
        print(f"❌ Error in generate_zone_creation_commands: {e}")
        import traceback
        traceback.print_exc()
        raise