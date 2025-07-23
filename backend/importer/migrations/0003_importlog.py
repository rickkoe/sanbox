# Fixed migration for ImportLog model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('importer', '0002_storageimport_celery_task_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImportLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('level', models.CharField(choices=[('DEBUG', 'Debug'), ('INFO', 'Info'), ('WARNING', 'Warning'), ('ERROR', 'Error')], default='INFO', max_length=10)),
                ('message', models.TextField()),
                ('details', models.JSONField(blank=True, help_text='Additional structured data', null=True)),
                ('import_record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='logs', to='importer.storageimport')),
            ],
            options={
                'verbose_name': 'Import Log',
                'verbose_name_plural': 'Import Logs',
                'ordering': ['timestamp'],
            },
        ),
    ]