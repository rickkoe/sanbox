"""
Management command to create CustomerMembership records for admin user.
This fixes the issue where admin has no customer memberships and can't see any data.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from customers.models import Customer
from core.models import CustomerMembership


class Command(BaseCommand):
    help = 'Create CustomerMembership records for admin user as admin for all customers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Username to create memberships for (default: admin)'
        )
        parser.add_argument(
            '--role',
            type=str,
            default='admin',
            choices=['admin', 'member', 'viewer'],
            help='Role to assign (default: admin)'
        )

    def handle(self, *args, **options):
        username = options['username']
        role = options['role']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
            return

        customers = Customer.objects.all()
        created_count = 0
        skipped_count = 0

        self.stdout.write(f'\n🔧 Creating CustomerMembership records for user: {username}')
        self.stdout.write(f'   Role: {role}')
        self.stdout.write(f'   Total customers: {customers.count()}\n')

        for customer in customers:
            # Check if membership already exists
            membership, created = CustomerMembership.objects.get_or_create(
                customer=customer,
                user=user,
                defaults={'role': role}
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✅ Created: {customer.name} ({role})'
                    )
                )
                created_count += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'  ⏭️  Skipped: {customer.name} (already exists as {membership.role})'
                    )
                )
                skipped_count += 1

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(f'✅ Created: {created_count} memberships'))
        if skipped_count > 0:
            self.stdout.write(self.style.WARNING(f'⏭️  Skipped: {skipped_count} (already existed)'))
        self.stdout.write('=' * 60 + '\n')
