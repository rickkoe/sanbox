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

def generate_alias_commands(aliases, config):
    alias_command_dict = defaultdict(list)
    for alias in aliases:
        key = alias.fabric.name
        if config.san_vendor == 'CI':
            if config.cisco_alias == 'device-alias':
                build_device_alias_commands(alias, alias_command_dict[key])
            elif config.cisco_alias == 'fcalias':
                build_fcalias_commands(alias, alias_command_dict[key])
        elif config.san_vendor == 'BR':
            alias_command_dict[key].append(f'alicreate "{alias.name}", "{alias.wwpn}"')
    
    if config.san_vendor == 'CI' and config.cisco_alias == 'device-alias':
        for key in alias_command_dict:
            alias_command_dict[key].append('device-alias commit')
    
    return dict(sorted(alias_command_dict.items()))