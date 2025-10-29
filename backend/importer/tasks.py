from celery import shared_task
from django.utils import timezone
from .models import StorageImport
# Legacy SimpleStorageImporter removed - now using unified ImportOrchestrator
from .logger import ImportLogger
from customers.models import Customer
from core.audit import log_import
import logging
import traceback

logger = logging.getLogger(__name__)


class CancelledException(Exception):
    """Exception raised when an import is cancelled by user"""
    pass


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

        # Progress callback with cancellation check
        def progress_callback(current, total, message):
            # Check for cancellation flag
            import_record.refresh_from_db()
            if import_record.cancelled:
                import_logger.info('Import cancellation detected, stopping...')
                raise CancelledException('Import cancelled by user')

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

        # Determine import type from stats (check for non-zero values, not just key existence)
        # Since orchestrator initializes all stats to 0, we need to check actual values
        has_storage_data = (
            result['stats'].get('storage_systems_created', 0) > 0 or
            result['stats'].get('storage_systems_updated', 0) > 0 or
            result['stats'].get('volumes_created', 0) > 0 or
            result['stats'].get('volumes_updated', 0) > 0 or
            result['stats'].get('hosts_created', 0) > 0 or
            result['stats'].get('hosts_updated', 0) > 0
        )

        if has_storage_data:
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
        import_record.import_type = 'storage_insights' if import_type == 'storage' else 'san_config'
        import_record.api_response_summary = {
            'import_type': import_type,
            'stats': result['stats'],
            'metadata': result['metadata']
        }
        import_record.save()

        # Calculate duration
        duration_seconds = None
        if import_record.started_at and import_record.completed_at:
            duration_seconds = int((import_record.completed_at - import_record.started_at).total_seconds())

        # Create audit log entry
        if import_type == 'storage':
            summary = (
                f"Imported storage data: {result['stats']['storage_systems_created']} systems created, "
                f"{result['stats']['storage_systems_updated']} updated, "
                f"{result['stats']['volumes_created']} volumes created, "
                f"{result['stats']['hosts_created']} hosts created"
            )
            entity_type = 'STORAGE_SYSTEM'
        else:
            summary = (
                f"Imported SAN configuration: {result['stats']['zones_created']} zones created, "
                f"{result['stats']['zones_updated']} updated, "
                f"{result['stats']['aliases_created']} aliases created, "
                f"{result['stats']['aliases_updated']} updated"
            )
            entity_type = 'ZONE'

        log_import(
            user=import_record.initiated_by,
            customer=import_record.customer,
            import_type=entity_type,
            summary=summary,
            details=result['stats'],
            status='SUCCESS',
            duration_seconds=duration_seconds
        )

        return {
            'import_id': import_record.id,
            'status': 'completed',
            'stats': result['stats']
        }

    except CancelledException as e:
        # Handle cancellation gracefully
        logger.info(f"Import {import_id} was cancelled by user")

        try:
            import_record = StorageImport.objects.get(id=import_id)
            import_logger = ImportLogger(import_record)
            import_logger.info('Import cancelled by user. Partial data may have been imported.')

            import_record.status = 'cancelled'
            import_record.error_message = 'Import cancelled by user. Partial data may have been imported.'
            import_record.completed_at = timezone.now()
            import_record.save()

            # Calculate duration
            duration_seconds = None
            if import_record.started_at and import_record.completed_at:
                duration_seconds = int((import_record.completed_at - import_record.started_at).total_seconds())

            # Log cancellation
            log_import(
                user=import_record.initiated_by,
                customer=import_record.customer,
                import_type='IMPORT',
                summary=f"Import cancelled by user (partial data may have been imported)",
                details={'cancelled': True},
                status='CANCELLED',
                duration_seconds=duration_seconds
            )

        except Exception as log_error:
            logger.error(f"Failed to update cancelled import: {log_error}")

        return {
            'import_id': import_id,
            'status': 'cancelled',
            'message': 'Import cancelled by user'
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

            # Calculate duration
            duration_seconds = None
            if import_record.started_at and import_record.completed_at:
                duration_seconds = int((import_record.completed_at - import_record.started_at).total_seconds())

            # Log failure
            log_import(
                user=import_record.initiated_by,
                customer=import_record.customer,
                import_type='IMPORT',
                summary=f"Import failed: {str(e)}",
                details={'error': str(e)},
                status='FAILED',
                duration_seconds=duration_seconds
            )

        except Exception as log_error:
            logger.error(f"Failed to log error: {log_error}")

        raise