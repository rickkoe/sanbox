"""
Management command to set up demo data including customer, project, and config for admin user.
This ensures the default admin user can log into the frontend application with a complete setup.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from customers.models import Customer
from core.models import Project, Config, UserConfig


class Command(BaseCommand):
    help = 'Sets up demo customer, project, config, and assigns admin user to it'

    def handle(self, *args, **options):
        User = get_user_model()

        # Check if admin user exists
        try:
            admin_user = User.objects.get(username='admin')
        except User.DoesNotExist:
            self.stdout.write(
                self.style.WARNING('Admin user does not exist. Skipping demo data setup.')
            )
            return

        # Create demo customer if it doesn't exist
        demo_customer, customer_created = Customer.objects.get_or_create(
            name='Demo Company',
            defaults={
                'notes': 'Demo customer for testing and development',
            }
        )

        if customer_created:
            self.stdout.write(
                self.style.SUCCESS(f'Created demo customer: {demo_customer.name}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Demo customer already exists: {demo_customer.name}')
            )

        # No customer membership needed - all users have access to all customers

        # Create demo project if it doesn't exist
        demo_project, project_created = Project.objects.get_or_create(
            name='Demo Project',
            defaults={
                'notes': 'Demo project for testing and development',
            }
        )

        if project_created:
            self.stdout.write(
                self.style.SUCCESS(f'Created demo project: {demo_project.name}')
            )
            # Add the project to the customer
            demo_customer.projects.add(demo_project)
        else:
            self.stdout.write(
                self.style.WARNING(f'Demo project already exists: {demo_project.name}')
            )
            # Ensure project is linked to customer
            if demo_project not in demo_customer.projects.all():
                demo_customer.projects.add(demo_project)
                self.stdout.write(
                    self.style.SUCCESS(f'Linked demo project to {demo_customer.name}')
                )

        # Create or update config for the customer with active project
        config, config_created = Config.objects.get_or_create(
            customer=demo_customer,
            defaults={
                'active_project': demo_project,
                'is_active': True,
            }
        )

        if config_created:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Created active config for customer "{demo_customer.name}" '
                    f'with project "{demo_project.name}"'
                )
            )
        else:
            # Update existing config if needed
            if config.active_project != demo_project or not config.is_active:
                config.active_project = demo_project
                config.is_active = True
                config.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Updated config for customer "{demo_customer.name}" '
                        f'to use project "{demo_project.name}"'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING('Config already exists and is properly configured')
                )

        self.stdout.write(
            self.style.SUCCESS(
                '\n✅ Setup complete! Admin user can now log into the frontend.'
                '\n   Customer: Demo Company'
                '\n   Project: Demo Project'
                '\n   Role: Admin'
                '\n   Status: Active config ready'
            )
        )
