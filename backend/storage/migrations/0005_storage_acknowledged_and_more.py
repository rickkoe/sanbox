# Generated by Django 5.1.6 on 2025-05-21 15:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('storage', '0004_storage_storage_system_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='storage',
            name='acknowledged',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='available_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='available_system_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='available_system_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='available_volume_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='available_written_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='callhome_system',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='capacity_savings_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='capacity_savings_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='co2_emission',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='compressed',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='condition',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='current_power_usage_watts',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='customer_country_code',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='customer_number',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='data_collection',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='data_collection_type',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='deduplication_savings_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='deduplication_savings_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='disks_count',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='element_manager_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='events_status',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='fc_ports_count',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='last_successful_monitor',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='last_successful_probe',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='mapped_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='mapped_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='overhead_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='pm_status',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='pools_count',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='power_efficiency',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='probe_schedule',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='probe_status',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='provisioned_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='provisioned_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='provisioned_written_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='ransomware_threat_detection',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='raw_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='read_cache_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='recent_fill_rate',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='recent_growth',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='remote_relationships_count',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='safe_guarded_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='safeguarded_used_capacity_percentage',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='safeguarded_virtual_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='shortfall_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='staas_environment',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='system_temperature_Fahrenheit',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='system_temperature_celsius',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='threat_notification_recipients',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='time_zone',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='unmapped_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='unmapped_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='unprotected_volumes_count',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='used_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='used_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='used_written_capacity_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='used_written_capacity_percent',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='vendor',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='volumes_count',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='write_cache_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storage',
            name='written_capacity_limit_bytes',
            field=models.BigIntegerField(blank=True, null=True),
        ),
    ]
