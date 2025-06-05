from django.core.management.base import BaseCommand
from insights_importer.models import APICredentials, ImportJob
from insights_importer.importers.storage_importer import StorageImporter
from customers.models import Customer
import uuid


class Command(BaseCommand):
    help = 'Test the new Storage Insights importer'
    
    def add_arguments(self, parser):
        parser.add_argument('--tenant', type=str, required=True, help='Storage Insights tenant ID')
        parser.add_argument('--api-key', type=str, required=True, help='Storage Insights API key')
        parser.add_argument('--customer-id', type=int, help='Customer ID to import for')
        parser.add_argument('--import-type', type=str, default='storage_only', 
                          choices=['full', 'storage_only', 'volumes_only', 'hosts_only'])
    
    def handle(self, *args, **options):
        # Create or get credentials
        credentials, created = APICredentials.objects.get_or_create(
            name=f"Test-{options['tenant']}",
            defaults={
                'base_url': 'https://insights.ibm.com/restapi/v1',
                'username': options['tenant'],
                'password': options['api_key'],
                'tenant_id': options['tenant'],
            }
        )
        
        if created:
            self.stdout.write(f"Created new credentials: {credentials.name}")
        else:
            self.stdout.write(f"Using existing credentials: {credentials.name}")
        
        # Create import job
        import_job = ImportJob.objects.create(
            job_id=str(uuid.uuid4()),
            job_type=options['import_type'],
            api_credentials=credentials,
        )
        
        self.stdout.write(f"Created import job: {import_job.job_id}")
        
        # Run import
        try:
            importer = StorageImporter(import_job)
            importer.run_import(
                customer_id=options.get('customer_id'),
                import_type=options['import_type']
            )
            
            self.stdout.write(
                self.style.SUCCESS(f"Import completed successfully!")
            )
            self.stdout.write(f"Job status: {import_job.status}")
            self.stdout.write(f"Processed: {import_job.processed_items}")
            self.stdout.write(f"Successful: {import_job.success_count}")
            self.stdout.write(f"Errors: {import_job.error_count}")
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Import failed: {str(e)}")
            )