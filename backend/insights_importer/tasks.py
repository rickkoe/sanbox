from celery import shared_task
from django.utils import timezone
from .models import ImportJob, ImportLog, APICredentials
from .importers.storage_importer import StorageImporter
from customers.models import Customer
import logging
import traceback
import uuid

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_import_task(self, import_job_id, customer_id=None, import_type='full'):
    """
    Async task to run Storage Insights import in the background
    """
    try:
        # Get the import job
        import_job = ImportJob.objects.get(id=import_job_id)
        
        # Update task ID in the job
        import_job.celery_task_id = self.request.id
        import_job.status = 'running'
        import_job.started_at = timezone.now()
        import_job.save()
        
        # Log the start
        ImportLog.objects.create(
            import_job=import_job,
            level='info',
            message=f'Starting async import task: {self.request.id}',
            details={'task_id': self.request.id, 'import_type': import_type}
        )
        
        # Run the import
        importer = StorageImporter(import_job)
        importer.run_import(customer_id=customer_id, import_type=import_type)
        
        return {
            'job_id': import_job.job_id,
            'status': import_job.status,
            'processed': import_job.processed_items,
            'successful': import_job.success_count,
            'errors': import_job.error_count
        }
        
    except ImportJob.DoesNotExist:
        logger.error(f"Import job {import_job_id} not found")
        raise
        
    except Exception as e:
        logger.error(f"Import task failed: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Update job status if we can
        try:
            import_job = ImportJob.objects.get(id=import_job_id)
            import_job.status = 'failed'
            import_job.error_details = str(e)
            import_job.completed_at = timezone.now()
            import_job.save()
            
            ImportLog.objects.create(
                import_job=import_job,
                level='error',
                message=f'Import task failed: {str(e)}',
                details={'error': str(e), 'traceback': traceback.format_exc()}
            )
        except:
            pass
            
        raise


@shared_task(bind=True)
def test_connection_task(self, credentials_id):
    """
    Async task to test Storage Insights connection
    """
    try:
        credentials = APICredentials.objects.get(id=credentials_id)
        
        from .api_client import StorageInsightsAPIClient
        client = StorageInsightsAPIClient(credentials)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 2, 'status': 'Testing authentication...'}
        )
        
        # Test authentication
        if not client.authenticate():
            return {
                'status': 'error',
                'message': 'Authentication failed'
            }
        
        # Update progress
        self.update_state(
            state='PROGRESS', 
            meta={'current': 2, 'total': 2, 'status': 'Testing API call...'}
        )
        
        # Test API call
        if client.test_connection():
            return {
                'status': 'success',
                'message': 'Connection successful',
                'token_expires': client.token_expires.isoformat() if client.token_expires else None
            }
        else:
            return {
                'status': 'error',
                'message': 'API call failed'
            }
            
    except APICredentials.DoesNotExist:
        return {
            'status': 'error',
            'message': 'Credentials not found'
        }
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        return {
            'status': 'error', 
            'message': f'Connection test error: {str(e)}'
        }


@shared_task
def cleanup_old_jobs():
    """
    Periodic task to clean up old import jobs and logs
    """
    from datetime import timedelta
    
    # Delete jobs older than 30 days
    cutoff_date = timezone.now() - timedelta(days=30)
    old_jobs = ImportJob.objects.filter(created_at__lt=cutoff_date)
    
    deleted_count = old_jobs.count()
    old_jobs.delete()
    
    logger.info(f"Cleaned up {deleted_count} old import jobs")
    return {'deleted_jobs': deleted_count}


@shared_task(bind=True)
def scheduled_import_task(self, credentials_id, customer_id=None, import_type='incremental'):
    """
    Scheduled task for automatic imports
    """
    try:
        credentials = APICredentials.objects.get(id=credentials_id)
        
        # Create a new import job
        import_job = ImportJob.objects.create(
            job_id=f"scheduled-{timezone.now().strftime('%Y%m%d-%H%M%S')}",
            job_type=import_type,
            api_credentials=credentials,
            celery_task_id=self.request.id
        )
        
        # Run the import
        importer = StorageImporter(import_job)
        importer.run_import(customer_id=customer_id, import_type=import_type)
        
        return {
            'job_id': import_job.job_id,
            'status': import_job.status,
            'processed': import_job.processed_items,
            'successful': import_job.success_count,
            'errors': import_job.error_count
        }
        
    except Exception as e:
        logger.error(f"Scheduled import failed: {str(e)}")
        raise