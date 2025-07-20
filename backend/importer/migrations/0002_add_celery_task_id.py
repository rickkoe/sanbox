# Add celery_task_id field to StorageImport model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('importer', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='storageimport',
            name='celery_task_id',
            field=models.CharField(blank=True, help_text='Celery task ID for background processing', max_length=255, null=True),
        ),
    ]