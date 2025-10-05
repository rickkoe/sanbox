"""
Django management command to backfill authentication-related data.

This command:
1. Sets owner for projects that don't have one (to first superuser or None)
2. Sets last_modified_by for fabrics and storage systems to first superuser
3. Initializes version field to 0 for optimistic locking

Run with: python manage.py backfill_auth_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Project
from san.models import Fabric
from storage.models import Storage


class Command(BaseCommand):
    help = 'Backfill authentication and audit data for existing records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        # Get first superuser to use as default owner/modifier
        try:
            default_user = User.objects.filter(is_superuser=True).first()
            if not default_user:
                self.stdout.write(self.style.WARNING(
                    'No superuser found. Creating a default admin user...'
                ))
                if not dry_run:
                    default_user = User.objects.create_superuser(
                        username='admin',
                        email='admin@example.com',
                        password='changeme123'
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f'Created superuser: admin (password: changeme123)'
                    ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error getting/creating superuser: {e}'))
            return

        # Backfill Project owners
        self.stdout.write('\n' + '='*60)
        self.stdout.write('BACKFILLING PROJECT OWNERS')
        self.stdout.write('='*60)
        
        projects_without_owner = Project.objects.filter(owner__isnull=True)
        project_count = projects_without_owner.count()
        
        if project_count > 0:
            self.stdout.write(f'Found {project_count} projects without owners')
            
            if not dry_run and default_user:
                updated = projects_without_owner.update(owner=default_user)
                self.stdout.write(self.style.SUCCESS(
                    f'✅ Updated {updated} projects with owner: {default_user.username}'
                ))
            elif dry_run:
                self.stdout.write(self.style.WARNING(
                    f'Would update {project_count} projects with owner: {default_user.username if default_user else "None"}'
                ))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All projects already have owners'))

        # Backfill Fabric audit fields
        self.stdout.write('\n' + '='*60)
        self.stdout.write('BACKFILLING FABRIC AUDIT FIELDS')
        self.stdout.write('='*60)
        
        try:
            fabrics_without_modifier = Fabric.objects.filter(last_modified_by__isnull=True)
            fabric_count = fabrics_without_modifier.count()
            
            if fabric_count > 0:
                self.stdout.write(f'Found {fabric_count} fabrics without last_modified_by')
                
                if not dry_run and default_user:
                    updated = fabrics_without_modifier.update(
                        last_modified_by=default_user,
                        version=0
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Updated {updated} fabrics with last_modified_by: {default_user.username}'
                    ))
                elif dry_run:
                    self.stdout.write(self.style.WARNING(
                        f'Would update {fabric_count} fabrics with last_modified_by: {default_user.username if default_user else "None"}'
                    ))
            else:
                self.stdout.write(self.style.SUCCESS('✅ All fabrics already have audit fields'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error updating fabrics: {e}'))

        # Backfill Storage audit fields
        self.stdout.write('\n' + '='*60)
        self.stdout.write('BACKFILLING STORAGE AUDIT FIELDS')
        self.stdout.write('='*60)
        
        try:
            storage_without_modifier = Storage.objects.filter(last_modified_by__isnull=True)
            storage_count = storage_without_modifier.count()
            
            if storage_count > 0:
                self.stdout.write(f'Found {storage_count} storage systems without last_modified_by')
                
                if not dry_run and default_user:
                    updated = storage_without_modifier.update(
                        last_modified_by=default_user,
                        version=0
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Updated {updated} storage systems with last_modified_by: {default_user.username}'
                    ))
                elif dry_run:
                    self.stdout.write(self.style.WARNING(
                        f'Would update {storage_count} storage systems with last_modified_by: {default_user.username if default_user else "None"}'
                    ))
            else:
                self.stdout.write(self.style.SUCCESS('✅ All storage systems already have audit fields'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error updating storage systems: {e}'))

        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write('SUMMARY')
        self.stdout.write('='*60)
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                'DRY RUN completed. Run without --dry-run to apply changes.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                '✅ Backfill completed successfully!'
            ))
            if default_user:
                self.stdout.write(f'Default user: {default_user.username}')
        
        self.stdout.write('')
