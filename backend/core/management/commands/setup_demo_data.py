"""
Management command to set up demo data including customer and membership for admin user.
This ensures the default admin user can log into the frontend application.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from customers.models import Customer
from core.models import CustomerMembership


class Command(BaseCommand):
    help = 'Sets up demo customer and assigns admin user to it'

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

        # Check if admin already has customer memberships
        if admin_user.customer_memberships.exists():
            self.stdout.write(
                self.style.WARNING('Admin user already has customer memberships. Skipping demo data setup.')
            )
            return

        # Create demo customer if it doesn't exist
        demo_customer, created = Customer.objects.get_or_create(
            name='Demo Company',
            defaults={
                'notes': 'Demo customer for testing and development',
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created demo customer: {demo_customer.name}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Demo customer already exists: {demo_customer.name}')
            )

        # Create customer membership for admin user
        membership, created = CustomerMembership.objects.get_or_create(
            user=admin_user,
            customer=demo_customer,
            defaults={
                'role': 'admin',
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Created admin membership for user "{admin_user.username}" '
                    f'in customer "{demo_customer.name}" with role "admin"'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING('Admin membership already exists')
            )

        self.stdout.write(
            self.style.SUCCESS(
                '\n✅ Setup complete! Admin user can now log into the frontend with admin/admin'
            )
        )
