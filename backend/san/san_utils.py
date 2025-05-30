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
        command_list.extend(['config t', 'device-alias database'])
    command_list.append(f'device-alias name {alias.name} pwwn {wwpn_colonizer(alias.wwpn)}')
    return command_list


def build_fcalias_commands(alias, command_list):
    """
    Builds fcalias command for a given alias.
    """
    command_list.append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
    return command_list

def generate_alias_commands(aliases, config):
    # Create dictionaries with default structure containing commands list and fabric_info
    device_alias_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    fcalias_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    brocade_alias_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    
    for alias in aliases:
        key = alias.fabric.name
        # Store fabric info if not already stored
        fabric_info = {
            "name": alias.fabric.name,
            "san_vendor": alias.fabric.san_vendor,
            "vsan": alias.fabric.vsan
        }
        
        # Set fabric info for all dictionaries to ensure it's available
        if device_alias_command_dict[key]["fabric_info"] is None:
            device_alias_command_dict[key]["fabric_info"] = fabric_info
        if fcalias_command_dict[key]["fabric_info"] is None:
            fcalias_command_dict[key]["fabric_info"] = fabric_info
        if brocade_alias_command_dict[key]["fabric_info"] is None:
            brocade_alias_command_dict[key]["fabric_info"] = fabric_info
            
        if alias.fabric.san_vendor == 'CI':
            if alias.cisco_alias == 'device-alias':
                if not device_alias_command_dict[key]["commands"]:
                    device_alias_command_dict[key]["commands"].extend(['config t', 'device-alias database'])
                device_alias_command_dict[key]["commands"].append(f'device-alias name {alias.name} pwwn {wwpn_colonizer(alias.wwpn)}')
            elif alias.cisco_alias == 'fcalias':
                fcalias_command_dict[key]["commands"].append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
        elif alias.fabric.san_vendor == 'BR':
            brocade_alias_command_dict[key]["commands"].append(f'alicreate "{alias.name}", "{alias.wwpn}"')
    
    # Add commit command for device aliases
    for key in device_alias_command_dict:
        if device_alias_command_dict[key]["commands"]:
            device_alias_command_dict[key]["commands"].append('device-alias commit')

    # Merge the dictionaries with new structure
    result = {}
    for key in set(list(device_alias_command_dict.keys()) + list(fcalias_command_dict.keys()) + list(brocade_alias_command_dict.keys())):
        result[key] = {
            "commands": [],
            "fabric_info": None
        }
        
        if key in device_alias_command_dict and device_alias_command_dict[key]["commands"]:
            result[key]["commands"].extend(device_alias_command_dict[key]["commands"])
            result[key]["fabric_info"] = device_alias_command_dict[key]["fabric_info"]
            
        if key in fcalias_command_dict and fcalias_command_dict[key]["commands"]:
            result[key]["commands"].extend(fcalias_command_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = fcalias_command_dict[key]["fabric_info"]
            
        if key in brocade_alias_command_dict and brocade_alias_command_dict[key]["commands"]:
            result[key]["commands"].extend(brocade_alias_command_dict[key]["commands"])
            if not result[key]["fabric_info"]:
                result[key]["fabric_info"] = brocade_alias_command_dict[key]["fabric_info"]
    
    # Sort by fabric names
    return dict(sorted(result.items()))

def generate_zone_commands(zones, config):
    all_aliases = Alias.objects.filter(create=True, projects=config.active_project)
    alias_command_dict = defaultdict(list)
    zone_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    zoneset_command_dict = defaultdict(lambda: {"commands": [], "fabric_info": None})
    
    # Get alias commands in old format
    alias_commands = generate_alias_commands(all_aliases, config)
    
    # Create Zone Commands
    all_zones = Zone.objects.select_related('fabric').prefetch_related('members').filter(create='True', projects=config.active_project).order_by('id')
    firstpass = False  # Set trigger for Cisco config t command
    
    for zone in all_zones:
        zone_members = zone.members.filter(include_in_zoning=True)
        zone_member_list = []
        for zone_member in zone_members:
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
            zone_command_dict[key]["commands"].extend([f'### ZONE COMMANDS FOR {key.upper()} '])
        if key not in zoneset_command_dict or not zoneset_command_dict[key]["commands"]:
            zoneset_command_dict[key]["commands"].extend([f'### ZONESET COMMANDS FOR {key.upper()} '])
            
        if zone_member_length > 0:
            if zone.fabric.san_vendor == 'CI':
                if firstpass == False:
                    zone_command_dict[key]["commands"].append('config t')
                    firstpass = True
                if len(zoneset_command_dict[key]["commands"]) == 2:
                    print(zoneset_command_dict[key]["commands"])
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

    
    for key in zoneset_command_dict:
        if zoneset_command_dict[key]["commands"]:
            fabric_info = zoneset_command_dict[key]["fabric_info"]
            if fabric_info and fabric_info["san_vendor"] == 'CI':
                zoneset_command_dict[key]["commands"].append(f'zoneset activate name {fabric_info["name"]} vsan {fabric_info["vsan"]}')
                if config.cisco_zoning_mode == 'enhanced':
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
    for key in set(list(alias_command_dict.keys()) + list(zone_command_dict.keys()) + list(zoneset_command_dict.keys())):
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
    
    # Sort by fabric names
    sorted_result = dict(sorted(result.items()))
    return sorted_result



