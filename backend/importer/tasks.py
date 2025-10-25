from celery import shared_task
from django.utils import timezone
from .models import StorageImport
# Legacy SimpleStorageImporter removed - now using unified ImportOrchestrator
from .logger import ImportLogger
from customers.models import Customer
import logging
import traceback

logger = logging.getLogger(__name__)


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


@shared_task(bind=True)
def run_san_import_task(self, import_id, config_data, fabric_id=None, fabric_name=None, zoneset_name=None, vsan=None, create_new_fabric=False, conflict_resolutions=None, project_id=None, fabric_mapping=None):
    """
    Universal import task - handles both SAN and Storage imports.

    Auto-detects import type based on config_data format:
    - SAN text (Cisco/Brocade CLI) → SAN configuration import
    - JSON credentials → IBM Storage Insights import

    Args:
        import_id: StorageImport record ID
        config_data: Either SAN CLI text or JSON credentials string
        fabric_id, fabric_name, etc.: SAN-specific options (ignored for storage imports)
        conflict_resolutions: Conflict resolution strategies
        project_id: Optional project assignment
        fabric_mapping: Multi-fabric mapping for SAN imports

    Note: This task name is kept for backward compatibility but now handles all import types.
    """
    try:
        # Get the import record
        import_record = StorageImport.objects.get(id=import_id)

        # Initialize logging
        import_logger = ImportLogger(import_record)
        import_logger.info(f'Starting universal import task {self.request.id} for customer {import_record.customer.name}')

        if project_id:
            import_logger.info(f'Zones/Hosts will be assigned to project ID: {project_id}')

        if fabric_mapping:
            import_logger.info(f'Using fabric mapping mode with {len(fabric_mapping)} mapped fabrics')
        elif fabric_id:
            import_logger.info(f'Using existing fabric ID: {fabric_id}')
        elif create_new_fabric:
            import_logger.info(f'Creating new fabric: {fabric_name} (zoneset: {zoneset_name}, vsan: {vsan})')

        if conflict_resolutions:
            import_logger.info(f'Conflict resolutions provided for {len(conflict_resolutions)} items')

        # Update status
        import_record.celery_task_id = self.request.id
        import_record.status = 'running'
        import_record.save()

        # Progress callback
        def progress_callback(current, total, message):
            import_logger.info(message)
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': current,
                    'total': total,
                    'status': message,
                    'import_id': import_record.id
                }
            )

        # Run the import (orchestrator auto-detects type)
        from .import_orchestrator import ImportOrchestrator
        orchestrator = ImportOrchestrator(import_record.customer, progress_callback, project_id=project_id)

        import_logger.info('Starting import (auto-detecting type)...')
        result = orchestrator.import_from_text(
            config_data,
            fabric_id,
            fabric_name,
            zoneset_name,
            vsan,
            create_new_fabric,
            conflict_resolutions or {},
            fabric_mapping
        )

        # Determine import type from stats
        if 'storage_systems_created' in result['stats']:
            import_type = 'storage'
            import_record.storage_systems_imported = result['stats'].get('storage_systems_created', 0) + result['stats'].get('storage_systems_updated', 0)
            import_record.volumes_imported = result['stats'].get('volumes_created', 0) + result['stats'].get('volumes_updated', 0)
            import_record.hosts_imported = result['stats'].get('hosts_created', 0) + result['stats'].get('hosts_updated', 0)

            import_logger.info(
                f'Storage import completed successfully - '
                f'{result["stats"]["storage_systems_created"]} systems, '
                f'{result["stats"]["volumes_created"]} volumes, '
                f'{result["stats"]["hosts_created"]} hosts created'
            )
        else:
            import_type = 'san_config'
            import_logger.info(
                f'SAN import completed successfully - '
                f'{result["stats"]["zones_created"]} zones, '
                f'{result["stats"]["aliases_created"]} aliases created'
            )

        # Update import record with results
        import_record.status = 'completed'
        import_record.completed_at = timezone.now()
        import_record.api_response_summary = {
            'import_type': import_type,
            'stats': result['stats'],
            'metadata': result['metadata']
        }
        import_record.save()

        return {
            'import_id': import_record.id,
            'status': 'completed',
            'stats': result['stats']
        }

    except StorageImport.DoesNotExist:
        logger.error(f"Import record {import_id} not found")
        raise

    except Exception as e:
        logger.error(f"Universal import task failed: {str(e)}")
        logger.error(traceback.format_exc())

        # Update import record status
        try:
            import_record = StorageImport.objects.get(id=import_id)
            import_logger = ImportLogger(import_record)
            import_logger.error(f'Import failed: {str(e)}', {'error': str(e), 'traceback': traceback.format_exc()})

            import_record.status = 'failed'
            import_record.error_message = str(e)
            import_record.completed_at = timezone.now()
            import_record.save()

        except Exception as log_error:
            logger.error(f"Failed to log error: {log_error}")

        raise