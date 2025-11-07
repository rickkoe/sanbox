# Generated migration to rename 'create' action to 'new' across all project junction tables

from django.db import migrations


def rename_create_to_new(apps, schema_editor):
    """Update all junction tables: 'create' → 'new'"""
    tables = [
        'ProjectFabric',
        'ProjectSwitch',
        'ProjectAlias',
        'ProjectZone',
        'ProjectStorage',
        'ProjectHost',
        'ProjectVolume',
        'ProjectPort',
    ]

    for table_name in tables:
        Model = apps.get_model('core', table_name)
        updated_count = Model.objects.filter(action='create').update(action='new')
        print(f"Updated {updated_count} records in {table_name}")


def reverse_rename(apps, schema_editor):
    """Reverse the migration: 'new' → 'create'"""
    tables = [
        'ProjectFabric',
        'ProjectSwitch',
        'ProjectAlias',
        'ProjectZone',
        'ProjectStorage',
        'ProjectHost',
        'ProjectVolume',
        'ProjectPort',
    ]

    for table_name in tables:
        Model = apps.get_model('core', table_name)
        Model.objects.filter(action='new').update(action='create')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_migrate_to_junction_tables'),
    ]

    operations = [
        migrations.RunPython(rename_create_to_new, reverse_rename),
    ]
