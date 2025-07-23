from celery import shared_task
from django.utils import timezone
from .models import StorageImport
from .services import SimpleStorageImporter
from .logger import ImportLogger
from customers.models import Customer
import logging
import traceback

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_simple_import_task(self, import_id, selective_options=None):
    """
    Async task to run storage import in the background
    Supports selective import based on user selections
    """
    try:
        # Get the import record
        import_record = StorageImport.objects.get(id=import_id)
        
        # Initialize logging
        import_logger = ImportLogger(import_record)
        import_logger.info(f'Starting import task {self.request.id} for customer {import_record.customer.name}')
        
        # Update status to running with task ID
        import_record.celery_task_id = self.request.id
        import_record.status = 'running'
        import_record.save()
        
        import_logger.info('Import status updated to running')
        logger.info(f'Starting simple import task {self.request.id} for customer {import_record.customer.name}')
        
        # Update progress
        import_logger.info('Initializing import process...')
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 0,
                'total': 100,
                'status': 'Initializing import...',
                'import_id': import_record.id
            }
        )
        
        # Check if this is a selective import and extract options
        selective_options = None
        if hasattr(import_record, 'api_response_summary') and import_record.api_response_summary:
            if import_record.api_response_summary.get('selective_import'):
                selective_options = {
                    'selected_systems': import_record.api_response_summary.get('selected_systems', []),
                    'import_options': import_record.api_response_summary.get('import_options', {})
                }
                import_logger.info(f'Selective import detected: {len(selective_options["selected_systems"])} systems, options: {selective_options["import_options"]}')
        
        # Run the import
        import_logger.info('Creating storage importer instance')
        importer = SimpleStorageImporter(import_record.customer)
        importer.import_record = import_record  # Use existing record
        importer.logger = import_logger  # Pass logger to importer
        
        # Update progress
        import_logger.info('Connecting to IBM Storage Insights API...')
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 25,
                'total': 100,
                'status': 'Fetching data from IBM Storage Insights...',
                'import_id': import_record.id
            }
        )
        
        # Override the import method to add progress updates with selective options
        import_logger.info('Starting data import process')
        if selective_options:
            result = importer._run_selective_import_with_progress(self, selective_options)
        else:
            result = importer._run_import_with_progress(self)
        
        import_logger.info(f'Import completed successfully - {result.total_items_imported} total items imported')
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
            import_logger = ImportLogger(import_record)
            import_logger.error(f'Import task failed: {str(e)}', {'error': str(e), 'traceback': traceback.format_exc()})
            
            import_record.status = 'failed'
            import_record.error_message = str(e)
            import_record.completed_at = timezone.now()
            import_record.save()
            
            import_logger.info('Import status updated to failed')
        except Exception as log_error:
            logger.error(f"Failed to log error: {log_error}")
            
        raise


@shared_task
def test_task():
    """Simple test task to verify Celery is working"""
    try:
        # Try to create a test log entry
        from .models import StorageImport
        from .logger import ImportLogger
        
        # Find the most recent import
        import_record = StorageImport.objects.filter(status='running').first()
        if import_record:
            logger = ImportLogger(import_record)
            logger.info('TEST TASK EXECUTED - Celery is working!')
            return {'status': 'success', 'message': 'Test task completed'}
        else:
            return {'status': 'no_import', 'message': 'No running import found'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


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