from collections import defaultdict
from core.models import Config
from san.models import Alias


def build_device_alias_commands(alias, command_list):
    """
    Builds device alias command for a given alias.
    If the command list is empty, add startup commands.
    """
    if not command_list:
        command_list.extend(['config t', 'device-alias database'])
    command_list.append(f'device-alias name {alias.name} pwwn {alias.wwpn}')
    return command_list


def build_fcalias_commands(alias, command_list):
    """
    Builds fcalias command for a given alias.
    """
    command_list.append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
    return command_list

def create_zone_command_dict():
    config = Config.objects.first()
    all_aliases = Alias.objects.filter(create='True', fabric__project=config.project)
    alias_command_dict = defaultdict(list)
    zone_command_dict = defaultdict(list)
    zoneset_command_dict = defaultdict(list)
    for alias in all_aliases:
        key = alias.fabric.name
        if key not in alias_command_dict:
            alias_command_dict[key].append(f'### ALIAS COMMANDS FOR {key.upper()}')
        if config.san_vendor == 'CI':
            if config.cisco_alias == 'device-alias':
                if len(alias_command_dict[key]) == 1:
                    alias_command_dict[key].extend(['config t','device-alias database'])
                alias_command_dict[key].append(f'device-alias name {alias.name} pwwn {alias.wwpn}')
            elif config.cisco_alias == 'fcalias':
                if len(alias_command_dict[key]) == 1:
                    alias_command_dict[key].append('config t')
                alias_command_dict[key].append(f'fcalias name {alias.name} vsan {alias.fabric.vsan} ; member pwwn {alias.wwpn} {alias.use}')
        elif config.san_vendor == 'BR':
            alias_command_dict[key].append(f'alicreate "{alias.name}", "{alias.wwpn}"')
    if config.san_vendor == 'CI' and config.cisco_alias == 'device-alias':
        for key in alias_command_dict:
            alias_command_dict[key].append('device-alias commit')
    # Create Zone Commands
    alias_type = config.cisco_alias
    all_zones = Zone.objects.select_related('fabric').prefetch_related('members').filter(create='True', fabric__project=config.project).order_by('id')
    firstpass = False # Set trigger for Cisco config t command
    for zone in all_zones:
        zone_members = zone.members.filter(include_in_zoning=True)
        zone_member_list = []
        for zone_member in zone_members:
            zone_member_list.append(zone_member.name)
        zone_member_length = len(zone_member_list)
        print(zone_member_length)
        key = zone.fabric.name
        if key not in zone_command_dict:
            zone_command_dict[key].extend(['',f'### ZONE COMMANDS FOR {key.upper()} '])
        if key not in zoneset_command_dict:
            zoneset_command_dict[key].extend(['',f'### ZONESET COMMANDS FOR {key.upper()} '])
        if zone_member_length > 0:
            if config.san_vendor == 'CI':
                if firstpass == False:
                    zone_command_dict[key].append('config t')
                    firstpass = True
                if len(zoneset_command_dict[key]) == 2:
                    zoneset_command_dict[key].append(f'zoneset name {zone.fabric.zoneset_name} vsan {zone.fabric.vsan}')
                zone_command_dict[key].append(f'zone name {zone.name} vsan {zone.fabric.vsan}')
                if zone.exists == False:
                    zoneset_command_dict[key].append(f'member {zone.name}')
                for zone_member in zone_members:
                    if config.cisco_alias == 'fcalias':  
                        zone_command_dict[key].append(f'member {alias_type} {zone_member.name}')
                    elif config.cisco_alias == 'device-alias' and zone.zone_type == 'smart_peer':
                        zone_command_dict[key].append(f'member {alias_type} {zone_member.name} {zone_member.use}')
                    elif config.cisco_alias == 'device-alias' and zone.zone_type == 'standard':
                        zone_command_dict[key].append(f'member {alias_type} {zone_member.name}')
                    elif config.cisco_alias == 'wwpn':
                        if zone.zone_type == 'smart_peer':
                            zone_command_dict[key].append(f'member pwwn {zone_member.wwpn} {zone_member.use}')
                        elif zone.zone_type == 'standard':
                            zone_command_dict[key].append(f'member pwwn {zone_member.wwpn}')
            if config.san_vendor == 'BR':
                if zone.zone_type == 'standard':
                    zone_member_list = ';'.join(zone_member_list)
                    if zone.exists == True:
                        zone_command_dict[key].append(f'zoneadd "{zone.name}", "{zone_member_list}"')
                    elif zone.exists == False:
                        zone_command_dict[key].append(f'zonecreate "{zone.name}", "{zone_member_list}"')
                elif zone.zone_type == 'smart_peer':
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
                        zone_command_dict[key].append(f'zoneadd --peerzone "{zone.name}"{principal}{members}')
                    elif zone.exists == False:
                        zone_command_dict[key].append(f'zonecreate --peerzone "{zone.name}" -principal "{targets}" -members "{initiators}"')
                if len(zoneset_command_dict[key]) == 2 and zone.fabric.exists == False and zone.exists == False:
                    zoneset_command_dict[key].append(f'cfgcreate "{zone.fabric.zoneset_name}", "{zone.name}"')
                elif zone.exists == False:
                    zoneset_command_dict[key].append(f'cfgadd "{zone.fabric.zoneset_name}", "{zone.name}"')
                else:
                    pass
                    # print(f'Zone {zone.name} not added to a config:   Fabric: {zone.fabric.exists} Zone: {zone.exists}')

    
    for key in zoneset_command_dict:
        fabric = Fabric.objects.get(name=key, project=config.project)
        if config.san_vendor == 'CI':
            zoneset_command_dict[key].append(f'zoneset activate name {fabric.zoneset_name} vsan {fabric.vsan}')
            if config.cisco_zoning_mode == 'enhanced':
                zoneset_command_dict[key].append(f'zone commit vsan {fabric.vsan}')
        elif config.san_vendor == 'BR':
            zoneset_command_dict[key].append(f'cfgenable "{fabric.zoneset_name}"')
    command_dict = merge_dicts(alias_command_dict, zone_command_dict, zoneset_command_dict)
    command_dict = dict(command_dict)
    # Sort by fabric names
    sorted_command_dict = dict(sorted(command_dict.items()))
    return sorted_command_dict

def create_zones(request):
    zone_command_dict = create_zone_command_dict()
    context = {
        'zone_command_dict': zone_command_dict,
        'heading': 'Zone Commands',
        'pageview': 'Zones'
        }
    return render(request, 'create_zones.html', context)