"""
API views for backup and restore operations
"""

from django.shortcuts import get_object_or_404
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from datetime import datetime
import json
import os

from .models import BackupRecord, BackupLog, RestoreRecord, BackupConfiguration
from .tasks import create_backup_task, restore_backup_task, verify_backup_task


@csrf_exempt
@require_http_methods(['GET'])
def list_backups(request):
    """List all backups with metadata"""
    try:
        status_filter = request.GET.get('status')
        limit = int(request.GET.get('limit', 50))

        backups = BackupRecord.objects.all()

        if status_filter:
            backups = backups.filter(status=status_filter)

        backups = backups[:limit]

        data = []
        for backup in backups:
            data.append({
                'id': backup.id,
                'name': backup.name,
                'description': backup.description,
                'status': backup.status,
                'backup_type': backup.backup_type,
                'created_at': backup.created_at.isoformat(),
                'started_at': backup.started_at.isoformat() if backup.started_at else None,
                'completed_at': backup.completed_at.isoformat() if backup.completed_at else None,
                'duration': str(backup.duration) if backup.duration else None,
                'file_size': backup.file_size,
                'size_mb': backup.size_mb,
                'django_version': backup.django_version,
                'python_version': backup.python_version,
                'postgres_version': backup.postgres_version,
                'app_version': backup.app_version,
                'includes_media': backup.includes_media,
                'migration_count': len(backup.migration_state) if backup.migration_state else 0,
                'table_count': len(backup.table_counts) if backup.table_counts else 0,
                'error_message': backup.error_message,
                'created_by': backup.created_by.username if backup.created_by else None,
            })

        return JsonResponse(data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def get_backup(request, backup_id):
    """Get detailed information about a specific backup"""
    try:
        backup = get_object_or_404(BackupRecord, id=backup_id)

        data = {
            'id': backup.id,
            'name': backup.name,
            'description': backup.description,
            'status': backup.status,
            'backup_type': backup.backup_type,
            'created_at': backup.created_at.isoformat(),
            'started_at': backup.started_at.isoformat() if backup.started_at else None,
            'completed_at': backup.completed_at.isoformat() if backup.completed_at else None,
            'duration': str(backup.duration) if backup.duration else None,
            'file_path': backup.file_path,
            'file_size': backup.file_size,
            'size_mb': backup.size_mb,
            'checksum': backup.checksum,
            'django_version': backup.django_version,
            'python_version': backup.python_version,
            'postgres_version': backup.postgres_version,
            'app_version': backup.app_version,
            'migration_state': backup.migration_state,
            'installed_apps': backup.installed_apps,
            'database_size': backup.database_size,
            'table_counts': backup.table_counts,
            'includes_media': backup.includes_media,
            'media_file_path': backup.media_file_path,
            'media_file_size': backup.media_file_size,
            'celery_task_id': backup.celery_task_id,
            'error_message': backup.error_message,
            'metadata': backup.metadata,
            'created_by': backup.created_by.username if backup.created_by else None,
        }

        return JsonResponse(data)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def create_backup(request):
    """Create a new backup"""
    try:
        data = json.loads(request.body)
        name = data.get('name')
        description = data.get('description', '')
        include_media = data.get('include_media', False)
        backup_type = data.get('backup_type', 'full')

        if not name:
            # Generate default name
            name = f"Backup {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        # Create backup record
        backup = BackupRecord.objects.create(
            name=name,
            description=description,
            backup_type=backup_type,
            includes_media=include_media,
            django_version='',  # Will be filled by service
            python_version='',
            migration_state={},
            installed_apps=[]
        )

        # Start backup task
        task = create_backup_task.delay(backup.id, include_media=include_media)

        backup.celery_task_id = task.id
        backup.save()

        return JsonResponse({
            'id': backup.id,
            'name': backup.name,
            'status': backup.status,
            'task_id': task.id,
            'message': 'Backup started successfully'
        }, status=201)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def restore_backup(request, backup_id):
    """Restore from a backup"""
    try:
        data = json.loads(request.body) if request.body else {}
        backup = get_object_or_404(BackupRecord, id=backup_id)

        # Check if backup is completed
        if backup.status != 'completed' and backup.status != 'verified':
            return JsonResponse({
                'error': f'Cannot restore from backup with status: {backup.status}'
            }, status=400)

        restore_media = data.get('restore_media', True)
        run_migrations = data.get('run_migrations', True)

        # Create restore record
        restore = RestoreRecord.objects.create(
            backup=backup,
            restore_media=restore_media,
            run_migrations=run_migrations
        )

        # Start restore task
        task = restore_backup_task.delay(restore.id)

        restore.celery_task_id = task.id
        restore.save()

        return JsonResponse({
            'id': restore.id,
            'backup_id': backup.id,
            'status': restore.status,
            'task_id': task.id,
            'message': 'Restore started successfully'
        }, status=201)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def verify_backup(request, backup_id):
    """Verify backup integrity"""
    try:
        backup = get_object_or_404(BackupRecord, id=backup_id)

        # Start verification task
        task = verify_backup_task.delay(backup.id)

        backup.celery_task_id = task.id
        backup.save()

        return JsonResponse({
            'id': backup.id,
            'status': 'verifying',
            'task_id': task.id,
            'message': 'Verification started'
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['DELETE'])
def delete_backup(request, backup_id):
    """Delete a backup"""
    try:
        backup = get_object_or_404(BackupRecord, id=backup_id)

        # Don't allow deleting in-progress backups
        if backup.status == 'in_progress':
            return JsonResponse({
                'error': 'Cannot delete backup in progress'
            }, status=400)

        # Delete files from filesystem
        if backup.file_path and os.path.exists(backup.file_path):
            os.remove(backup.file_path)

        if backup.media_file_path and os.path.exists(backup.media_file_path):
            os.remove(backup.media_file_path)

        backup.delete()

        return JsonResponse({
            'message': 'Backup deleted successfully'
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def download_backup(request, backup_id):
    """Download backup file"""
    try:
        backup = get_object_or_404(BackupRecord, id=backup_id)

        if not backup.file_path or not os.path.exists(backup.file_path):
            return JsonResponse({'error': 'Backup file not found'}, status=404)

        response = FileResponse(
            open(backup.file_path, 'rb'),
            content_type='application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{os.path.basename(backup.file_path)}"'

        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def backup_logs(request, backup_id):
    """Get logs for a backup"""
    try:
        backup = get_object_or_404(BackupRecord, id=backup_id)

        limit = int(request.GET.get('limit', 100))
        logs = BackupLog.objects.filter(backup=backup).order_by('-timestamp')[:limit]

        data = []
        for log in reversed(logs):
            data.append({
                'id': log.id,
                'timestamp': log.timestamp.isoformat(),
                'level': log.level,
                'message': log.message,
                'details': log.details
            })

        return JsonResponse({
            'logs': data,
            'backup_id': backup.id,
            'total_logs': backup.logs.count()
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def list_restores(request):
    """List all restore operations"""
    try:
        limit = int(request.GET.get('limit', 50))
        restores = RestoreRecord.objects.all()[:limit]

        data = []
        for restore in restores:
            data.append({
                'id': restore.id,
                'backup_id': restore.backup.id,
                'backup_name': restore.backup.name,
                'status': restore.status,
                'started_at': restore.started_at.isoformat(),
                'completed_at': restore.completed_at.isoformat() if restore.completed_at else None,
                'duration': str(restore.duration) if restore.duration else None,
                'schema_compatible': restore.schema_compatible,
                'restore_media': restore.restore_media,
                'run_migrations': restore.run_migrations,
                'error_message': restore.error_message,
                'started_by': restore.started_by.username if restore.started_by else None,
            })

        return JsonResponse(data, safe=False)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def get_restore(request, restore_id):
    """Get detailed information about a restore operation"""
    try:
        restore = get_object_or_404(RestoreRecord, id=restore_id)

        data = {
            'id': restore.id,
            'backup_id': restore.backup.id,
            'backup_name': restore.backup.name,
            'status': restore.status,
            'started_at': restore.started_at.isoformat(),
            'completed_at': restore.completed_at.isoformat() if restore.completed_at else None,
            'duration': str(restore.duration) if restore.duration else None,
            'schema_compatible': restore.schema_compatible,
            'migration_plan': restore.migration_plan,
            'compatibility_warnings': restore.compatibility_warnings,
            'restore_media': restore.restore_media,
            'run_migrations': restore.run_migrations,
            'migrations_run': restore.migrations_run,
            'celery_task_id': restore.celery_task_id,
            'error_message': restore.error_message,
            'started_by': restore.started_by.username if restore.started_by else None,
            'pre_restore_backup_id': restore.pre_restore_backup.id if restore.pre_restore_backup else None,
        }

        return JsonResponse(data)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def backup_config(request):
    """Get or update backup configuration"""
    try:
        config = BackupConfiguration.get_config()

        if request.method == 'GET':
            data = {
                'backup_directory': config.backup_directory,
                'max_backups': config.max_backups,
                'auto_backup_enabled': config.auto_backup_enabled,
                'auto_backup_hour': config.auto_backup_hour,
                'auto_backup_include_media': config.auto_backup_include_media,
                'retention_days': config.retention_days,
                'use_compression': config.use_compression,
                'updated_at': config.updated_at.isoformat(),
            }
            return JsonResponse(data)

        elif request.method == 'POST':
            data = json.loads(request.body)

            if 'backup_directory' in data:
                config.backup_directory = data['backup_directory']
            if 'max_backups' in data:
                config.max_backups = data['max_backups']
            if 'auto_backup_enabled' in data:
                config.auto_backup_enabled = data['auto_backup_enabled']
            if 'auto_backup_hour' in data:
                config.auto_backup_hour = data['auto_backup_hour']
            if 'auto_backup_include_media' in data:
                config.auto_backup_include_media = data['auto_backup_include_media']
            if 'retention_days' in data:
                config.retention_days = data['retention_days']
            if 'use_compression' in data:
                config.use_compression = data['use_compression']

            config.save()

            return JsonResponse({
                'message': 'Configuration updated successfully'
            })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def task_status(request, task_id):
    """Get status of a Celery task"""
    from celery.result import AsyncResult

    try:
        result = AsyncResult(task_id)

        if result.state == 'PENDING':
            response = {
                'state': result.state,
                'status': 'Task is waiting to start...'
            }
        elif result.state == 'PROGRESS':
            response = {
                'state': result.state,
                'current': result.info.get('current', 0),
                'total': result.info.get('total', 100),
                'status': result.info.get('status', 'Processing...')
            }
            if 'backup_id' in result.info:
                response['backup_id'] = result.info['backup_id']
            if 'restore_id' in result.info:
                response['restore_id'] = result.info['restore_id']
        elif result.state == 'SUCCESS':
            response = {
                'state': result.state,
                'status': 'Task completed successfully',
                'result': result.info
            }
        else:
            response = {
                'state': result.state,
                'status': f'Task failed: {str(result.info)}',
                'error': str(result.info)
            }

        return JsonResponse(response)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
