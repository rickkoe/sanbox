# Generated manually for Zone model performance optimization

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('san', '0003_alias_logged_in'),
    ]

    operations = [
        # Add database indexes for commonly queried Zone fields
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS san_zone_name_idx ON san_zone (name);",
            reverse_sql="DROP INDEX IF EXISTS san_zone_name_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS san_zone_fabric_id_idx ON san_zone (fabric_id);",
            reverse_sql="DROP INDEX IF EXISTS san_zone_fabric_id_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS san_zone_zone_type_idx ON san_zone (zone_type);",
            reverse_sql="DROP INDEX IF EXISTS san_zone_zone_type_idx;"
        ),
        migrations.RunSQL(
            'CREATE INDEX IF NOT EXISTS san_zone_create_delete_exists_idx ON san_zone ("create", "delete", "exists");',
            reverse_sql="DROP INDEX IF EXISTS san_zone_create_delete_exists_idx;"
        ),
        # Add composite index for fabric and name (common filter combination)
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS san_zone_fabric_name_idx ON san_zone (fabric_id, name);",
            reverse_sql="DROP INDEX IF EXISTS san_zone_fabric_name_idx;"
        ),
    ]