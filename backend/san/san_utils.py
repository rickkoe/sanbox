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


def create_aliases(request):
    config = Config.objects.first()
    if not config:
        raise ValueError("Configuration is missing.")

    # Filter alias records based on the config's project
    all_aliases = Alias.objects.filter(create='True', fabric__project=config.project)
    alias_command_dict = defaultdict(list)

    for alias in all_aliases:
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

    # Sort the alias commands by fabric names
    sorted_dict = dict(sorted(alias_command_dict.items()))
    context = {
        'alias_command_dict': sorted_dict,
        'heading': 'Alias Commands',
        'pageview': 'Aliases'
    }
    return context