"""
Pool Utilities for DS8000 and FlashSystem

Generates DSCLI/CLI commands for pool provisioning.
"""

from .storage_utils import generate_ds8000_device_id


def generate_pool_create_command(storage, pool_name, storage_type='FB', rank_group=0):
    """
    Generate pool creation command for DS8000 or FlashSystem.

    DS8000: mkextpool -dev {device_id} -rankgrp {rank_group} -stgtype {fb|ckd} {pool_name}
    FlashSystem: mkmdiskgrp -name {pool_name} -ext 1024

    Args:
        storage: Storage model instance
        pool_name: Name of the pool to create (max 16 chars for DS8000)
        storage_type: 'FB' or 'CKD' (only applicable for DS8000)
        rank_group: 0 or 1 (only applicable for DS8000)

    Returns:
        str: DSCLI command string
    """
    if storage.storage_type == 'DS8000':
        device_id = generate_ds8000_device_id(storage)
        stg_type = storage_type.lower()
        return f"mkextpool -dev {device_id} -rankgrp {rank_group} -stgtype {stg_type} {pool_name}"
    elif storage.storage_type == 'FlashSystem':
        # FlashSystem uses mkmdiskgrp
        # -ext specifies extent size in MiB (1024 is a common default)
        return f"mkmdiskgrp -name {pool_name} -ext 1024"
    else:
        return f"# Unsupported storage type: {storage.storage_type}"


def generate_pool_delete_command(storage, pool_name):
    """
    Generate pool deletion command for DS8000 or FlashSystem.

    DS8000: rmextpool -dev {device_id} {pool_name}
    FlashSystem: rmmdiskgrp {pool_name}

    Args:
        storage: Storage model instance
        pool_name: Name of the pool to delete

    Returns:
        str: DSCLI command string
    """
    if storage.storage_type == 'DS8000':
        device_id = generate_ds8000_device_id(storage)
        return f"rmextpool -dev {device_id} {pool_name}"
    elif storage.storage_type == 'FlashSystem':
        return f"rmmdiskgrp {pool_name}"
    else:
        return f"# Unsupported storage type: {storage.storage_type}"


def generate_pool_commands_for_storage(storage, pools, command_type='create'):
    """
    Generate DSCLI commands for multiple pools on a storage system.

    Args:
        storage: Storage model instance
        pools: List of Pool model instances or dicts with pool data
        command_type: 'create' or 'delete'

    Returns:
        dict: {
            'device_id': str,
            'storage_name': str,
            'commands': list of str,
            'command_count': int
        }
    """
    device_id = generate_ds8000_device_id(storage) if storage.storage_type == 'DS8000' else None
    commands = []

    for pool in pools:
        # Handle both Pool model instances and dicts
        if hasattr(pool, 'name'):
            pool_name = pool.name
            storage_type = pool.storage_type
        else:
            pool_name = pool.get('name')
            storage_type = pool.get('storage_type', 'FB')

        if command_type == 'create':
            cmd = generate_pool_create_command(storage, pool_name, storage_type)
        else:
            cmd = generate_pool_delete_command(storage, pool_name)

        commands.append(cmd)

    return {
        'device_id': device_id or 'N/A',
        'storage_name': storage.name,
        'commands': commands,
        'command_count': len(commands)
    }
