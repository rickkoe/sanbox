# Generated migration for adding dashboard widgets

from django.db import migrations


def create_widget_types(apps, schema_editor):
    """Create initial widget types for dashboard"""
    WidgetType = apps.get_model('core', 'WidgetType')

    widget_types = [
        {
            'name': 'san_overview',
            'display_name': 'SAN Configuration Overview',
            'description': 'Overview of fabrics, zones, aliases, and switches for active project',
            'component_name': 'SanOverviewWidget',
            'category': 'metrics',
            'icon': 'FaNetworkWired',
            'default_width': 6,
            'default_height': 300,
            'min_width': 4,
            'min_height': 250,
            'max_width': 12,
            'max_height': 600,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'zone_deployment',
            'display_name': 'Zone Deployment Status',
            'description': 'Shows zones that exist (deployed) vs designed (not deployed)',
            'component_name': 'ZoneDeploymentWidget',
            'category': 'metrics',
            'icon': 'FaCheckCircle',
            'default_width': 4,
            'default_height': 300,
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'alias_distribution',
            'display_name': 'Alias Distribution',
            'description': 'Breakdown of aliases by use type (initiator/target/both)',
            'component_name': 'AliasDistributionWidget',
            'category': 'charts',
            'icon': 'FaChartBar',
            'default_width': 4,
            'default_height': 350,
            'min_width': 3,
            'min_height': 300,
            'max_width': 8,
            'max_height': 600,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'storage_inventory',
            'display_name': 'Storage Systems Inventory',
            'description': 'Count by storage system type and status overview',
            'component_name': 'StorageInventoryWidget',
            'category': 'metrics',
            'icon': 'FaServer',
            'default_width': 4,
            'default_height': 300,
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'host_connectivity',
            'display_name': 'Host Connectivity',
            'description': 'Total hosts tracked with WWPN assignment status',
            'component_name': 'HostConnectivityWidget',
            'category': 'metrics',
            'icon': 'FaHdd',
            'default_width': 4,
            'default_height': 300,
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'import_activity',
            'display_name': 'Recent Import Activity',
            'description': 'Last import job status with items imported',
            'component_name': 'ImportActivityWidget',
            'category': 'activity',
            'icon': 'FaCloudUploadAlt',
            'default_width': 6,
            'default_height': 300,
            'min_width': 4,
            'min_height': 250,
            'max_width': 12,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'backup_health',
            'display_name': 'Backup Health',
            'description': 'Latest backup status, size, and time since last backup',
            'component_name': 'BackupHealthWidget',
            'category': 'health',
            'icon': 'FaDatabase',
            'default_width': 4,
            'default_height': 300,
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'wwpn_inventory',
            'display_name': 'WWPN Inventory',
            'description': 'Total WWPNs with source breakdown (manual vs alias-derived)',
            'component_name': 'WwpnInventoryWidget',
            'category': 'metrics',
            'icon': 'FaTags',
            'default_width': 4,
            'default_height': 300,
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'project_activity',
            'display_name': 'Project Activity Log',
            'description': 'Recent modifications to zones and aliases with audit trail',
            'component_name': 'ProjectActivityWidget',
            'category': 'activity',
            'icon': 'FaClock',
            'default_width': 6,
            'default_height': 400,
            'min_width': 4,
            'min_height': 300,
            'max_width': 12,
            'max_height': 600,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        },
        {
            'name': 'storage_capacity',
            'display_name': 'Storage Capacity Summary',
            'description': 'Total capacity, used, available, and compression savings',
            'component_name': 'StorageCapacityWidget',
            'category': 'metrics',
            'icon': 'FaChartLine',
            'default_width': 6,
            'default_height': 350,
            'min_width': 4,
            'min_height': 300,
            'max_width': 12,
            'max_height': 600,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        }
    ]

    for widget_data in widget_types:
        WidgetType.objects.get_or_create(
            name=widget_data['name'],
            defaults=widget_data
        )


def remove_widget_types(apps, schema_editor):
    """Remove widget types on migration rollback"""
    WidgetType = apps.get_model('core', 'WidgetType')

    widget_names = [
        'san_overview',
        'zone_deployment',
        'alias_distribution',
        'storage_inventory',
        'host_connectivity',
        'import_activity',
        'backup_health',
        'wwpn_inventory',
        'project_activity',
        'storage_capacity'
    ]

    WidgetType.objects.filter(name__in=widget_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_alter_projectgroup_unique_together_and_more'),
    ]

    operations = [
        migrations.RunPython(create_widget_types, remove_widget_types),
    ]
