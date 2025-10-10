"""
Management command to create a default superuser if one doesn't exist.
Used for automated setup in development and production containers.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Creates a default superuser (admin/admin) if no superuser exists'

    def handle(self, *args, **options):
        User = get_user_model()

        # Check if any superuser exists
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(
                self.style.WARNING('Superuser already exists. Skipping creation.')
            )
            return

        # Create default superuser
        try:
            User.objects.create_superuser(
                username='admin',
                email='admin@example.com',
                password='admin'
            )
            self.stdout.write(
                self.style.SUCCESS(
                    'Successfully created default superuser (username: admin, password: admin)'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to create superuser: {e}')
            )
