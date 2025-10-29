from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from customers.models import Customer
from .models import StorageImport, ImportLog
# Legacy importer removed - now using unified ImportOrchestrator
import json


@csrf_exempt
@require_http_methods(['GET'])
def import_history(request):
    """Get import history for all customers or specific customer"""
    customer_id = request.GET.get('customer_id')
    
    if customer_id:
        imports = StorageImport.objects.filter(customer_id=customer_id)
    else:
        imports = StorageImport.objects.all()
    
    data = []
    for import_record in imports[:50]:  # Limit to recent 50
        data.append({
            'id': import_record.id,
            'customer': import_record.customer.name,
            'status': import_record.status,
            'started_at': import_record.started_at.isoformat(),
            'completed_at': import_record.completed_at.isoformat() if import_record.completed_at else None,
            'duration': str(import_record.duration) if import_record.duration else None,
            'storage_systems_imported': import_record.storage_systems_imported,
            'volumes_imported': import_record.volumes_imported,
            'hosts_imported': import_record.hosts_imported,
            'total_items': import_record.total_items_imported,
            'error_message': import_record.error_message,
        })
    
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_http_methods(['POST'])
def start_import(request):
    """
    DEPRECATED: Legacy endpoint for IBM Storage Insights import.

    Use the unified importer endpoint instead: /api/insights/import-san-config/
    This endpoint is kept for backward compatibility but will be removed in a future version.
    """
    return JsonResponse({
        'error': 'This endpoint has been deprecated. Please use the unified importer at /api/insights/import-san-config/',
        'deprecated': True,
        'replacement_endpoint': '/api/insights/import-san-config/',
        'documentation': 'See CLAUDE.md for universal importer documentation'
    }, status=410)  # 410 Gone - indicates endpoint is deprecated


@csrf_exempt
@require_http_methods(['GET'])
def import_status(request, import_id):
    """Get status of a specific import"""
    import_record = get_object_or_404(StorageImport, id=import_id)
    
    return JsonResponse({
        'id': import_record.id,
        'customer': import_record.customer.name,
        'status': import_record.status,
        'started_at': import_record.started_at.isoformat(),
        'completed_at': import_record.completed_at.isoformat() if import_record.completed_at else None,
        'duration': str(import_record.duration) if import_record.duration else None,
        'storage_systems_imported': import_record.storage_systems_imported,
        'volumes_imported': import_record.volumes_imported,
        'hosts_imported': import_record.hosts_imported,
        'total_items': import_record.total_items_imported,
        'error_message': import_record.error_message,
        'api_response_summary': import_record.api_response_summary,
    })


@csrf_exempt
@require_http_methods(['POST'])
def cancel_import(request, import_id):
    """Cancel a running import"""
    try:
        import_record = get_object_or_404(StorageImport, id=import_id)

        # Check if user is authenticated and owns this import
        # For now, we'll skip strict auth check since @csrf_exempt is used
        # In production, implement proper authentication

        # Only allow canceling running imports
        if import_record.status != 'running':
            return JsonResponse(
                {'error': f'Cannot cancel import with status: {import_record.status}'},
                status=400
            )

        # Set cancellation flag for graceful shutdown
        from django.utils import timezone
        import_record.cancelled = True
        import_record.cancelled_at = timezone.now()
        import_record.save()

        # Try to revoke the Celery task (will be handled gracefully by task)
        if import_record.celery_task_id:
            try:
                from celery.result import AsyncResult
                result = AsyncResult(import_record.celery_task_id)
                result.revoke(terminate=False)  # Don't force terminate, let task check flag
            except Exception as e:
                # Log the error but continue
                print(f"Failed to revoke Celery task {import_record.celery_task_id}: {e}")

        return JsonResponse({
            'message': 'Import cancellation requested. The import will stop processing new items.',
            'import_id': import_record.id,
            'cancelled_at': import_record.cancelled_at.isoformat() if import_record.cancelled_at else None
        })

    except Exception as e:
        return JsonResponse(
            {'error': f'Failed to cancel import: {str(e)}'},
            status=500
        )


@csrf_exempt
@require_http_methods(['GET'])
def task_progress(request, task_id):
    """Get progress of a Celery task"""
    from celery.result import AsyncResult
    
    result = AsyncResult(task_id)
    
    if result.state == 'PENDING':
        # Task is waiting to be processed
        response = {
            'state': result.state,
            'current': 0,
            'total': 100,
            'status': 'Task is waiting to start...'
        }
    elif result.state == 'PROGRESS':
        # Task is currently being processed
        response = {
            'state': result.state,
            'current': result.info.get('current', 0),
            'total': result.info.get('total', 100),
            'status': result.info.get('status', 'Processing...')
        }
        if 'import_id' in result.info:
            response['import_id'] = result.info['import_id']
    else:
        # Task completed or failed
        if result.state == 'SUCCESS':
            response = {
                'state': result.state,
                'current': 100,
                'total': 100,
                'status': 'Import completed successfully!',
                'result': result.info
            }
        else:
            # Task failed
            response = {
                'state': result.state,
                'current': 0,
                'total': 100,
                'status': f'Import failed: {str(result.info)}',
                'error': str(result.info)
            }
    
    return JsonResponse(response)


@csrf_exempt
@require_http_methods(['GET', 'POST', 'PUT'])
def api_credentials(request, customer_id=None):
    """Manage API credentials for customers (stored in Customer model)"""
    
    if request.method == 'GET':
        if customer_id:
            try:
                customer = get_object_or_404(Customer, id=customer_id)
                return JsonResponse({
                    'customer_id': customer.id,
                    'customer_name': customer.name,
                    'insights_tenant': customer.insights_tenant,
                    'has_api_key': bool(customer.insights_api_key),  # Don't expose actual key
                    'has_credentials': bool(customer.insights_api_key and customer.insights_tenant),
                })
            except Customer.DoesNotExist:
                return JsonResponse({'error': 'Customer not found'}, status=404)
        else:
            # List all customers with credentials
            customers = Customer.objects.filter(
                insights_api_key__isnull=False,
                insights_tenant__isnull=False
            ).exclude(
                insights_api_key='',
                insights_tenant=''
            )
            data = []
            for customer in customers:
                data.append({
                    'customer_id': customer.id,
                    'customer_name': customer.name,
                    'insights_tenant': customer.insights_tenant,
                    'has_api_key': bool(customer.insights_api_key),
                    'has_credentials': bool(customer.insights_api_key and customer.insights_tenant),
                })
            return JsonResponse(data, safe=False)
    
    elif request.method == 'POST' or request.method == 'PUT':
        try:
            data = json.loads(request.body)
            customer = get_object_or_404(Customer, id=data.get('customer_id'))
            
            # Update customer's insights credentials
            if 'insights_tenant' in data:
                customer.insights_tenant = data['insights_tenant']
            if 'insights_api_key' in data:
                customer.insights_api_key = data['insights_api_key']
            
            customer.save()
            
            return JsonResponse({
                'message': 'Credentials saved successfully',
                'customer_id': customer.id,
                'has_credentials': bool(customer.insights_api_key and customer.insights_tenant)
            })
            
        except Exception as e:
            return JsonResponse(
                {'error': str(e)}, 
                status=400
            )


@csrf_exempt
@require_http_methods(['GET'])
def import_logs(request, import_id):
    """Get real-time logs for a specific import"""
    import_record = get_object_or_404(StorageImport, id=import_id)
    
    # Get query parameters
    since = request.GET.get('since')  # timestamp to get logs since
    limit = int(request.GET.get('limit', 100))  # max number of logs
    
    logs_query = ImportLog.objects.filter(import_record=import_record)
    
    if since:
        try:
            from django.utils.dateparse import parse_datetime
            since_dt = parse_datetime(since)
            if since_dt:
                logs_query = logs_query.filter(timestamp__gt=since_dt)
        except:
            pass  # ignore invalid since parameter
    
    logs = logs_query.order_by('-timestamp')[:limit]
    
    data = []
    for log in reversed(logs):  # reverse to get chronological order
        data.append({
            'id': log.id,
            'timestamp': log.timestamp.isoformat(),
            'level': log.level,
            'message': log.message,
            'details': log.details,
        })
    
    return JsonResponse({
        'logs': data,
        'import_id': import_record.id,
        'total_logs': import_record.logs.count()
    })


@csrf_exempt
@require_http_methods(['POST'])
def test_logging(request):
    """Test endpoint to verify logging system works"""
    try:
        data = json.loads(request.body)
        import_id = data.get('import_id')
        
        if not import_id:
            return JsonResponse({'error': 'import_id required'}, status=400)
        
        import_record = get_object_or_404(StorageImport, id=import_id)
        
        # Test logging
        from .logger import ImportLogger
        logger = ImportLogger(import_record)
        logger.info('Test log entry - logging system is working!')
        logger.warning('This is a test warning message')
        logger.error('This is a test error message')
        
        return JsonResponse({
            'message': 'Test logs added successfully',
            'import_id': import_record.id
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def test_celery(request):
    """Test endpoint to verify Celery is working"""
    try:
        from .tasks import test_task
        
        # Start the test task
        task = test_task.delay()
        
        return JsonResponse({
            'message': 'Test task started',
            'task_id': task.id,
            'status': 'PENDING'
        })
        
    except Exception as e:
        return JsonResponse({'error': f'Celery test failed: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def clear_import_history(request):
    """Clear import history for a customer"""
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        
        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Delete all imports for this customer except running ones
        deleted_count = StorageImport.objects.filter(
            customer=customer
        ).exclude(status='running').delete()[0]
        
        return JsonResponse({
            'message': f'Cleared {deleted_count} import records',
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def fetch_storage_systems(request):
    """Fetch available storage systems from IBM Storage Insights without importing"""
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        customer = get_object_or_404(Customer, id=customer_id)

        # Get credentials from request body (passed from frontend)
        insights_tenant = data.get('insights_tenant')
        insights_api_key = data.get('insights_api_key')

        # Fall back to customer model if not provided in request
        if not insights_tenant:
            insights_tenant = customer.insights_tenant
        if not insights_api_key:
            insights_api_key = customer.insights_api_key

        # Check we have credentials
        if not insights_api_key or not insights_tenant:
            return JsonResponse({
                'error': 'No Storage Insights API credentials provided. Please enter Tenant ID and API Key.'
            }, status=400)

        # Create API client and fetch storage systems using V2 client
        from .parsers.insights_api_client_v2 import StorageInsightsClientV2
        client = StorageInsightsClientV2(insights_tenant, insights_api_key)
        storage_systems = client.get_storage_systems()
        
        # Format the response for the frontend
        formatted_systems = []
        for system in storage_systems:
            # Get storage_system_id (primary key from API)
            system_id = system.get('storage_system_id') or system.get('serial_number') or system.get('id', 'unknown')

            formatted_systems.append({
                'storage_system_id': system_id,
                'serial': system.get('serial_number', system_id),
                'name': system.get('name', system.get('display_name', 'Unknown System')),
                'type': system.get('type', system.get('storage_type', 'Unknown Type')),
                'model': system.get('model', system.get('product_name', 'Unknown Model')),
                'status': system.get('probe_status', system.get('status', 'unknown')),
                'vendor': system.get('vendor', 'IBM'),
                'raw_data': system  # Include raw data for debugging
            })

        return JsonResponse({
            'storage_systems': formatted_systems,
            'count': len(formatted_systems)
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def start_selective_import(request):
    """
    DEPRECATED: Legacy selective import endpoint.

    Use the unified importer with selective options instead: /api/insights/import-san-config/
    Pass credentials with selected_systems and import_options in the JSON data field.
    """
    return JsonResponse({
        'error': 'This endpoint has been deprecated. Please use the unified importer at /api/insights/import-san-config/',
        'deprecated': True,
        'replacement_endpoint': '/api/insights/import-san-config/',
        'documentation': 'See CLAUDE.md for universal importer documentation with selective import support'
    }, status=410)  # 410 Gone - indicates endpoint is deprecated


# ===== Universal Importer Endpoints =====

@csrf_exempt
@require_http_methods(['POST'])
def parse_preview(request):
    """
    Universal preview endpoint - handles both SAN text and Storage API credentials.

    Request body formats:
    - For SAN: {"customer_id": 1, "data": "show zoneset active..."}
    - For Storage: {"customer_id": 1, "data": "{\"tenant_id\": \"...\", \"api_key\": \"...\"}"}

    The orchestrator auto-detects the format and routes appropriately.
    """
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        config_data = data.get('data')
        check_conflicts = data.get('check_conflicts', False)

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        if not config_data:
            return JsonResponse({'error': 'data required'}, status=400)

        customer = get_object_or_404(Customer, id=customer_id)

        # Use orchestrator to preview (auto-detects SAN vs Storage)
        from .import_orchestrator import ImportOrchestrator
        orchestrator = ImportOrchestrator(customer)

        preview = orchestrator.preview_import(config_data, check_conflicts=check_conflicts)

        return JsonResponse(preview)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def import_san_config(request):
    """
    Universal import endpoint - handles both SAN and Storage imports.

    Auto-detects import type based on data format:
    - SAN text (Cisco/Brocade CLI) → SAN import
    - JSON credentials (IBM Storage Insights) → Storage import

    Request body:
    - customer_id: Required
    - data: Required (either text or JSON credentials)
    - import_name: Optional user-provided name for this import
    - fabric_id, fabric_mapping: SAN-specific options
    - conflict_resolutions: Conflict handling
    - project_id: Optional project assignment

    This replaces the legacy separate endpoints for SAN and Storage imports.
    """
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        config_data = data.get('data')
        import_name = data.get('import_name', '')

        # SAN-specific options (optional)
        fabric_id = data.get('fabric_id')
        fabric_name = data.get('fabric_name')
        zoneset_name = data.get('zoneset_name')
        vsan = data.get('vsan')
        create_new_fabric = data.get('create_new_fabric', False)
        conflict_resolutions = data.get('conflict_resolutions', {})
        project_id = data.get('project_id')
        fabric_mapping = data.get('fabric_mapping')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        if not config_data:
            return JsonResponse({'error': 'data required'}, status=400)

        customer = get_object_or_404(Customer, id=customer_id)

        # Get user (if authenticated) - for now, set to None since we use @csrf_exempt
        # In production, implement proper authentication
        user = request.user if request.user.is_authenticated else None

        # Check for concurrent imports (soft warning, not blocking)
        if user:
            active_imports = StorageImport.objects.filter(
                initiated_by=user,
                status='running'
            ).count()

            # Return warning if 3+ imports already running
            if active_imports >= 3:
                # Still allow the import but include a warning
                warning = f'You currently have {active_imports} imports running. This may impact performance.'
            else:
                warning = None
        else:
            warning = None

        # Create import record to track this
        import_record = StorageImport.objects.create(
            customer=customer,
            initiated_by=user,
            import_name=import_name,
            status='pending'
        )

        # Start background task for universal import
        from .tasks import run_san_import_task  # Will be renamed to run_universal_import_task
        task = run_san_import_task.delay(
            import_record.id,
            config_data,
            fabric_id,
            fabric_name,
            zoneset_name,
            vsan,
            create_new_fabric,
            conflict_resolutions,
            project_id,
            fabric_mapping
        )

        # Update import record
        import_record.celery_task_id = task.id
        import_record.status = 'running'
        import_record.save()

        response_data = {
            'success': True,
            'message': 'Import started',
            'import_id': import_record.id,
            'task_id': task.id
        }

        if warning:
            response_data['warning'] = warning

        return JsonResponse(response_data, status=201)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def import_progress(request, import_id):
    """Get detailed progress of an import job"""
    try:
        import_record = get_object_or_404(StorageImport, id=import_id)

        progress_data = {
            'import_id': import_record.id,
            'status': import_record.status,
            'started_at': import_record.started_at.isoformat() if import_record.started_at else None,
            'completed_at': import_record.completed_at.isoformat() if import_record.completed_at else None,
            'duration': str(import_record.duration) if import_record.duration else None,
            'error_message': import_record.error_message,
        }

        # Include import stats if available (for completed imports)
        if import_record.api_response_summary:
            # Check if this is a SAN import
            if import_record.api_response_summary.get('import_type') == 'san_config':
                stats = import_record.api_response_summary.get('stats', {})
                progress_data['aliases_imported'] = stats.get('aliases_created', 0)
                progress_data['zones_imported'] = stats.get('zones_created', 0)
                progress_data['fabrics_created'] = stats.get('fabrics_created', 0) or stats.get('fabrics_updated', 1)

                # Also include the raw stats for backward compatibility
                progress_data['stats'] = stats
            # For storage imports
            else:
                progress_data['storage_systems_imported'] = import_record.storage_systems_imported
                progress_data['volumes_imported'] = import_record.volumes_imported
                progress_data['hosts_imported'] = import_record.hosts_imported

        # If task is running, get Celery task progress
        if import_record.status == 'running' and import_record.celery_task_id:
            from celery.result import AsyncResult
            result = AsyncResult(import_record.celery_task_id)

            if result.state == 'PROGRESS':
                progress_data['progress'] = {
                    'current': result.info.get('current', 0),
                    'total': result.info.get('total', 100),
                    'message': result.info.get('status', 'Processing...')
                }
            elif result.state == 'PENDING':
                progress_data['progress'] = {
                    'current': 0,
                    'total': 100,
                    'message': 'Waiting to start...'
                }

        return JsonResponse(progress_data)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ===== User-Scoped Import Monitoring Endpoints =====

@csrf_exempt
@require_http_methods(['GET'])
def my_imports(request):
    """Get list of imports for the current user with filtering"""
    try:
        # Get user - for now, allow viewing all imports since we use @csrf_exempt
        # In production, filter by request.user
        user = request.user if request.user.is_authenticated else None

        # Get filter parameters
        status_filter = request.GET.get('status')  # running, completed, failed, cancelled
        import_type_filter = request.GET.get('import_type')  # san_config, storage_insights
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        limit = int(request.GET.get('limit', 50))

        # Build query
        if user:
            imports = StorageImport.objects.filter(initiated_by=user)
        else:
            # If no user (during development), show all imports
            imports = StorageImport.objects.all()

        # Apply filters
        if status_filter:
            imports = imports.filter(status=status_filter)

        if import_type_filter:
            imports = imports.filter(import_type=import_type_filter)

        if date_from:
            try:
                from django.utils.dateparse import parse_datetime
                date_from_dt = parse_datetime(date_from)
                if date_from_dt:
                    imports = imports.filter(started_at__gte=date_from_dt)
            except:
                pass

        if date_to:
            try:
                from django.utils.dateparse import parse_datetime
                date_to_dt = parse_datetime(date_to)
                if date_to_dt:
                    imports = imports.filter(started_at__lte=date_to_dt)
            except:
                pass

        # Order by most recent first
        imports = imports.order_by('-started_at')[:limit]

        # Serialize data
        data = []
        for import_record in imports:
            item = {
                'id': import_record.id,
                'customer': import_record.customer.name,
                'customer_id': import_record.customer.id,
                'import_name': import_record.import_name,
                'import_type': import_record.import_type,
                'status': import_record.status,
                'started_at': import_record.started_at.isoformat() if import_record.started_at else None,
                'completed_at': import_record.completed_at.isoformat() if import_record.completed_at else None,
                'cancelled': import_record.cancelled,
                'cancelled_at': import_record.cancelled_at.isoformat() if import_record.cancelled_at else None,
                'duration': str(import_record.duration) if import_record.duration else None,
                'error_message': import_record.error_message,
            }

            # Add stats based on import type
            if import_record.api_response_summary:
                import_type = import_record.api_response_summary.get('import_type')
                if import_type == 'san_config':
                    stats = import_record.api_response_summary.get('stats', {})
                    item['stats'] = {
                        'aliases_created': stats.get('aliases_created', 0),
                        'zones_created': stats.get('zones_created', 0),
                        'fabrics_created': stats.get('fabrics_created', 0)
                    }
                else:
                    item['stats'] = {
                        'storage_systems': import_record.storage_systems_imported,
                        'volumes': import_record.volumes_imported,
                        'hosts': import_record.hosts_imported
                    }
            else:
                item['stats'] = {}

            # Add progress if running
            if import_record.status == 'running' and import_record.celery_task_id:
                try:
                    from celery.result import AsyncResult
                    result = AsyncResult(import_record.celery_task_id)
                    if result.state == 'PROGRESS':
                        item['progress'] = {
                            'current': result.info.get('current', 0),
                            'total': result.info.get('total', 100),
                            'message': result.info.get('status', 'Processing...')
                        }
                except:
                    pass

            data.append(item)

        return JsonResponse({
            'imports': data,
            'count': len(data)
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def active_imports_count(request):
    """Get count of active/running imports for the current user"""
    try:
        # Get user
        user = request.user if request.user.is_authenticated else None

        if user:
            count = StorageImport.objects.filter(
                initiated_by=user,
                status='running'
            ).count()
        else:
            # If no user (during development), count all running imports
            count = StorageImport.objects.filter(status='running').count()

        return JsonResponse({
            'count': count
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
