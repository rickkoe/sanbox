# Generated by Django 5.1.6 on 2025-05-06 21:46

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('storage', '0003_alter_storage_storage_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='storage',
            name='storage_system_id',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
