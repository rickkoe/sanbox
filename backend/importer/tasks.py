from celery import shared_task
from django.utils import timezone
from .models import StorageImport
from .services import SimpleStorageImporter
from customers.models import Customer
import logging
import traceback

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_simple_import_task(self, import_id):
    """
    Async task to run simple storage import in the background
    """
    try:
        # Get the import record
        import_record = StorageImport.objects.get(id=import_id)
        
        # Update status to running with task ID
        import_record.celery_task_id = self.request.id
        import_record.status = 'running'
        import_record.save()
        
        logger.info(f'Starting simple import task {self.request.id} for customer {import_record.customer.name}')
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 0,
                'total': 100,
                'status': 'Initializing import...',
                'import_id': import_record.id
            }
        )
        
        # Run the import
        importer = SimpleStorageImporter(import_record.customer)
        importer.import_record = import_record  # Use existing record
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 25,
                'total': 100,
                'status': 'Fetching data from IBM Storage Insights...',
                'import_id': import_record.id
            }
        )
        
        # Override the import method to add progress updates
        result = importer._run_import_with_progress(self)
        
        logger.info(f'Simple import task {self.request.id} completed successfully')
        
        return {
            'import_id': import_record.id,
            'status': result.status,
            'storage_systems_imported': result.storage_systems_imported,
            'volumes_imported': result.volumes_imported,
            'hosts_imported': result.hosts_imported,
            'total_items_imported': result.total_items_imported
        }
        
    except StorageImport.DoesNotExist:
        logger.error(f"Import record {import_id} not found")
        raise
        
    except Exception as e:
        logger.error(f"Simple import task failed: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Update import record status if we can
        try:
            import_record = StorageImport.objects.get(id=import_id)
            import_record.status = 'failed'
            import_record.error_message = str(e)
            import_record.completed_at = timezone.now()
            import_record.save()
        except:
            pass
            
        raise


@shared_task
def cleanup_old_imports():
    """
    Periodic task to clean up old import records
    """
    from datetime import timedelta
    
    # Delete import records older than 30 days
    cutoff_date = timezone.now() - timedelta(days=30)
    old_imports = StorageImport.objects.filter(started_at__lt=cutoff_date)
    
    deleted_count = old_imports.count()
    old_imports.delete()
    
    logger.info(f"Cleaned up {deleted_count} old import records")
    return {'deleted_imports': deleted_count}