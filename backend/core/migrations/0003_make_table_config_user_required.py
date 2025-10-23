# Generated manually to handle TableConfiguration user field migration
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


def assign_configs_to_first_user(apps, schema_editor):
    """
    Assign all TableConfiguration records with null user to the first user.
    """
    TableConfiguration = apps.get_model('core', 'TableConfiguration')
    User = apps.get_model('auth', 'User')

    # Get the first user (usually the admin or primary user)
    first_user = User.objects.first()

    if first_user:
        # Update all configs with null user to the first user
        null_user_configs = TableConfiguration.objects.filter(user__isnull=True)
        count = null_user_configs.count()
        null_user_configs.update(user=first_user)
        print(f"✅ Assigned {count} table configurations to user '{first_user.username}'")
    else:
        print("⚠️ No users found - table configurations with null user will need manual assignment")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # First, assign null users to the first user
        migrations.RunPython(
            assign_configs_to_first_user,
            reverse_code=migrations.RunPython.noop
        ),

        # Then alter the field to be non-nullable
        migrations.AlterField(
            model_name='tableconfiguration',
            name='user',
            field=models.ForeignKey(
                help_text='User this configuration belongs to',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='table_configurations',
                to=settings.AUTH_USER_MODEL
            ),
        ),
    ]
