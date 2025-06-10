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

# Add this to your tasks.py

@shared_task(bind=True)
def run_enhanced_import_task(self, import_job_id, customer_id=None, import_type='full', selected_systems=None):
    """
    Enhanced async task to run Storage Insights import with selected systems
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
            message=f'Starting enhanced import task: {self.request.id}',
            details={
                'task_id': self.request.id, 
                'import_type': import_type,
                'selected_systems': selected_systems,
                'customer_id': customer_id
            }
        )
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 0,
                'total': len(selected_systems) if selected_systems else 1,
                'status': f'Starting {import_type} import...',
                'stage': 'initializing'
            }
        )
        
        # Run the enhanced import
        importer = EnhancedStorageImporter(import_job)
        importer.run_selective_import(
            customer_id=customer_id, 
            import_type=import_type,
            selected_systems=selected_systems,
            progress_callback=lambda current, total, status: self.update_state(
                state='PROGRESS',
                meta={'current': current, 'total': total, 'status': status}
            )
        )
        
        return {
            'job_id': import_job.job_id,
            'status': import_job.status,
            'processed': import_job.processed_items,
            'successful': import_job.success_count,
            'errors': import_job.error_count,
            'selected_systems': selected_systems
        }
        
    except ImportJob.DoesNotExist:
        logger.error(f"Import job {import_job_id} not found")
        raise
        
    except Exception as e:
        logger.error(f"Enhanced import task failed: {str(e)}")
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
                message=f'Enhanced import task failed: {str(e)}',
                details={'error': str(e), 'traceback': traceback.format_exc()}
            )
        except:
            pass
            
        raise

# Add this class to your storage_importer.py

class EnhancedStorageImporter(StorageImporter):
    """Enhanced storage importer with selective import capabilities"""
    
    def __init__(self, import_job: ImportJob):
        super().__init__(import_job)
        self.progress_callback = None
    
    def run_selective_import(self, customer_id: int = None, import_type: str = 'full', 
                           selected_systems: list = None, progress_callback=None):
        """Main import orchestration method for selected systems"""
        try:
            self.progress_callback = progress_callback
            self.import_job.status = 'running'
            self.import_job.started_at = timezone.now()
            self.import_job.save()
            
            if customer_id:
                self.customer = Customer.objects.get(id=customer_id)
            
            self._log('info', f'Starting {import_type} import for selected systems', {
                'selected_systems': selected_systems,
                'customer_id': customer_id
            })
            
            # Update progress
            self._update_progress(0, len(selected_systems) if selected_systems else 1, 
                                'Initializing import...')
            
            if import_type in ['full', 'storage_only']:
                storage_results = self._import_selected_storage_systems(selected_systems)
                
            if import_type in ['full', 'volumes_only']:
                volume_results = self._import_volumes_for_selected_systems(selected_systems)
                
            if import_type in ['full', 'hosts_only']:
                host_results = self._import_hosts_for_selected_systems(selected_systems)
            
            self._finalize_import('completed')
            
        except Exception as e:
            self._log('error', f'Selective import failed: {str(e)}', {'exception': str(e)})
            self._finalize_import('failed')
            raise
    
    def _import_selected_storage_systems(self, selected_systems):
        """Import only the selected storage systems"""
        self._log('info', 'Fetching selected storage systems from API')
        
        # Get all storage systems first
        all_systems = self.api_client.paginate_all(self.api_client.get_storage_systems)
        
        if not all_systems:
            self._log('warning', 'No storage systems found in API')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        # Filter to only selected systems
        systems = [sys for sys in all_systems if sys.get('storage_system_id') in selected_systems]
        
        if not systems:
            self._log('warning', f'None of the selected systems found in API response')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        self.import_job.total_items = len(systems)
        self.import_job.save()
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        
        for i, system_data in enumerate(systems, 1):
            try:
                self._update_progress(i, len(systems), 
                                    f'Processing storage system: {system_data.get("name", "unknown")}')
                
                result = self._process_storage_system(system_data)
                results[result] += 1
                self.import_job.processed_items += 1
                
                if result != 'error':
                    self.import_job.success_count += 1
                else:
                    self.import_job.error_count += 1
                    
                self.import_job.save()
                
            except Exception as e:
                self._log('error', f'Failed to process storage system {system_data.get("name", "unknown")}', 
                         {'system_data': system_data, 'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
                self.import_job.save()
        
        self._log('info', f'Selected storage systems import complete', results)
        return results
    
    def _import_volumes_for_selected_systems(self, selected_systems):
        """Import volumes only for selected storage systems"""
        self._log('info', 'Starting volumes import for selected systems')
        
        # Get storage systems that match our selected list
    def _import_volumes_for_selected_systems(self, selected_systems):
        """Import volumes only for selected storage systems"""
        self._log('info', 'Starting volumes import for selected systems')
        
        # Get storage systems that match our selected list
        storage_systems = Storage.objects.filter(
            storage_system_id__in=selected_systems
        )
        
        if self.customer:
            storage_systems = storage_systems.filter(customer=self.customer)
        
        if not storage_systems.exists():
            self._log('warning', 'No matching storage systems found for volume import')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        total_systems = storage_systems.count()
        
        for i, storage in enumerate(storage_systems, 1):
            try:
                self._update_progress(i, total_systems, 
                                    f'Importing volumes for: {storage.name}')
                
                system_results = self._import_volumes_for_system(storage)
                for key in results:
                    results[key] += system_results[key]
                    
            except Exception as e:
                self._log('error', f'Failed to import volumes for {storage.name}', {'error': str(e)})
                results['errors'] += 1
        
        return results
    
    def _import_hosts_for_selected_systems(self, selected_systems):
        """Import hosts only for selected storage systems"""
        self._log('info', 'Starting hosts import for selected systems')
        
        # Get storage systems that match our selected list
        storage_systems = Storage.objects.filter(
            storage_system_id__in=selected_systems
        )
        
        if self.customer:
            storage_systems = storage_systems.filter(customer=self.customer)
        
        if not storage_systems.exists():
            self._log('warning', 'No matching storage systems found for host import')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        total_systems = storage_systems.count()
        
        for i, storage in enumerate(storage_systems, 1):
            try:
                self._update_progress(i, total_systems, 
                                    f'Importing hosts for: {storage.name}')
                
                system_results = self._import_hosts_for_system(storage)
                for key in results:
                    results[key] += system_results[key]
                    
            except Exception as e:
                self._log('error', f'Failed to import hosts for {storage.name}', {'error': str(e)})
                results['errors'] += 1
        
        return results
    
    def _update_progress(self, current, total, status):
        """Update progress via callback if available"""
        if self.progress_callback:
            self.progress_callback(current, total, status)