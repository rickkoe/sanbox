from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from customers.models import Customer
from .models import StorageImport, APICredentials
from .services import SimpleStorageImporter
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
    """Start a new storage import for a customer"""
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        
        if not customer_id:
            return JsonResponse(
                {'error': 'customer_id is required'}, 
                status=400
            )
        
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Check if there's already a running import
        running_import = StorageImport.objects.filter(
            customer=customer, 
            status='running'
        ).first()
        
        if running_import:
            return JsonResponse(
                {'error': 'Import already running for this customer'}, 
                status=400
            )
        
        # Check API credentials exist
        try:
            credentials = APICredentials.objects.get(customer=customer, is_active=True)
        except APICredentials.DoesNotExist:
            return JsonResponse(
                {'error': 'No API credentials configured for this customer'}, 
                status=400
            )
        
        # Create import record first
        import_record = StorageImport.objects.create(
            customer=customer,
            status='pending'
        )
        
        # Start background import task
        from .tasks import run_simple_import_task
        task = run_simple_import_task.delay(import_record.id)
        
        # Update record with task ID
        import_record.celery_task_id = task.id
        import_record.status = 'running'
        import_record.save()
        
        return JsonResponse({
            'import_id': import_record.id,
            'task_id': task.id,
            'status': import_record.status,
            'started_at': import_record.started_at.isoformat() if import_record.started_at else None,
            'storage_systems_imported': import_record.storage_systems_imported,
            'volumes_imported': import_record.volumes_imported,
            'hosts_imported': import_record.hosts_imported,
            'total_items_imported': import_record.total_items_imported,
            'message': 'Import started in background - you can navigate to other pages'
        })
        
    except json.JSONDecodeError:
        return JsonResponse(
            {'error': 'Invalid JSON'}, 
            status=400
        )
    except Exception as e:
        return JsonResponse(
            {'error': f'Unexpected error: {str(e)}'}, 
            status=500
        )


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
@require_http_methods(['GET', 'POST', 'PUT', 'DELETE'])
def api_credentials(request, customer_id=None):
    """Manage API credentials for customers"""
    
    if request.method == 'GET':
        if customer_id:
            try:
                credentials = APICredentials.objects.get(customer_id=customer_id, is_active=True)
                return JsonResponse({
                    'customer_id': credentials.customer.id,
                    'insights_tenant': credentials.insights_tenant,
                    'has_api_key': bool(credentials.insights_api_key),  # Don't expose actual key
                    'is_active': credentials.is_active,
                    'created_at': credentials.created_at.isoformat(),
                })
            except APICredentials.DoesNotExist:
                return JsonResponse({'error': 'No credentials found'}, status=404)
        else:
            # List all credentials
            credentials = APICredentials.objects.filter(is_active=True)
            data = []
            for cred in credentials:
                data.append({
                    'customer_id': cred.customer.id,
                    'customer_name': cred.customer.name,
                    'insights_tenant': cred.insights_tenant,
                    'has_api_key': bool(cred.insights_api_key),
                    'created_at': cred.created_at.isoformat(),
                })
            return JsonResponse(data, safe=False)
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            customer = get_object_or_404(Customer, id=data.get('customer_id'))
            
            credentials, created = APICredentials.objects.update_or_create(
                customer=customer,
                defaults={
                    'insights_tenant': data.get('insights_tenant'),
                    'insights_api_key': data.get('insights_api_key'),
                    'is_active': True
                }
            )
            
            return JsonResponse({
                'message': 'Credentials saved successfully',
                'created': created
            })
            
        except Exception as e:
            return JsonResponse(
                {'error': str(e)}, 
                status=400
            )
    
    # Add PUT and DELETE methods as needed...
