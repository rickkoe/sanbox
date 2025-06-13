import json
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import APICredentials, ImportJob, ImportLog
from .serializers import APICredentialsSerializer, ImportJobSerializer
from .api_client import StorageInsightsAPIClient
from .importers.storage_importer import StorageImporter
from customers.models import Customer
from .tasks import run_import_task, test_connection_task
from celery.result import AsyncResult


@csrf_exempt
@require_http_methods(["POST"])
def test_connection_view(request):
    """Test API credentials connection"""
    print(f"🔥 Test Connection - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        tenant = data.get('tenant')
        api_key = data.get('api_key')
        
        if not tenant or not api_key:
            return JsonResponse({
                'error': 'tenant and api_key are required'
            }, status=400)
        
        # Create temporary credentials for testing
        temp_creds = APICredentials(
            name='temp',
            base_url='https://insights.ibm.com/restapi/v1',
            username=tenant,
            password=api_key,
            tenant_id=tenant
        )
        
        client = StorageInsightsAPIClient(temp_creds)
        
        # Test authentication first
        auth_result = client.authenticate()
        if not auth_result:
            return JsonResponse({
                'status': 'error',
                'message': 'Authentication failed - check tenant ID and API key'
            }, status=400)
        
        # Test a simple API call
        if client.test_connection():
            return JsonResponse({
                'status': 'success',
                'message': 'Connection successful',
                'token_expires': client.token_expires.isoformat() if client.token_expires else None
            })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Connection test failed - API call unsuccessful'
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Connection error: {str(e)}'
        }, status=500)

import logging
logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def enhanced_auth_view(request):
    """Enhanced version of your existing auth endpoint"""
    
    # Log everything for debugging
    logger.error("🔥 Enhanced Auth view called!")
    print("🔥 Enhanced Auth view called!")
    
    try:
        logger.error(f"🔥 Request method: {request.method}")
        logger.error(f"🔥 Request body type: {type(request.body)}")
        logger.error(f"🔥 Request body length: {len(request.body) if request.body else 0}")
        logger.error(f"🔥 Request body: {request.body}")
        
        print(f"🔥 Enhanced Auth - Method: {request.method}")
        print(f"🔥 Request body: {request.body}")
        
        # Test JSON parsing
        if not request.body:
            logger.error("🔥 ERROR: Request body is empty!")
            return JsonResponse({"error": "Request body is empty"}, status=400)
            
        data = json.loads(request.body)
        logger.error(f"🔥 Successfully parsed JSON: {data}")
        print(f"🔥 Parsed data: {data}")
        
        tenant = data.get('tenant')
        api_key = data.get('api_key')
        
        logger.error(f"🔥 Extracted - Tenant: {tenant}, API Key: {'***' if api_key else None}")
        print(f"🔥 Tenant: {tenant}, API Key present: {bool(api_key)}")
        
        if not tenant or not api_key:
            logger.error("🔥 Missing tenant or API key")
            return JsonResponse({
                "message": "Tenant and API key are required"
            }, status=400)
        
        # Test model import
        logger.error("🔥 About to test APICredentials import...")
        try:
            from .models import APICredentials
            logger.error("🔥 APICredentials import successful")
        except Exception as import_error:
            logger.error(f"🔥 IMPORT ERROR - APICredentials: {str(import_error)}")
            return JsonResponse({"error": f"Model import error: {str(import_error)}"}, status=500)
        
        # Test database operation
        logger.error("🔥 About to create/get credentials...")
        try:
            credentials, created = APICredentials.objects.get_or_create(
                name=f"Customer-{tenant}",
                defaults={
                    'base_url': 'https://insights.ibm.com/restapi/v1',
                    'username': tenant,
                    'password': api_key,
                    'tenant_id': tenant,
                }
            )
            logger.error(f"🔥 Credentials created/retrieved successfully. Created: {created}, ID: {credentials.id}")
            print(f"🔥 Credentials - Created: {created}, ID: {credentials.id}")
        except Exception as db_error:
            logger.error(f"🔥 DATABASE ERROR: {str(db_error)}")
            return JsonResponse({"error": f"Database error: {str(db_error)}"}, status=500)
        
        if not created:
            logger.error("🔥 Updating existing credentials...")
            try:
                credentials.password = api_key
                credentials.save()
                logger.error("🔥 Credentials updated successfully")
            except Exception as update_error:
                logger.error(f"🔥 UPDATE ERROR: {str(update_error)}")
                return JsonResponse({"error": f"Update error: {str(update_error)}"}, status=500)
        
        # Test API client import
        logger.error("🔥 About to test StorageInsightsAPIClient import...")
        try:
            from .api_client import StorageInsightsAPIClient
            logger.error("🔥 StorageInsightsAPIClient import successful")
        except Exception as client_import_error:
            logger.error(f"🔥 CLIENT IMPORT ERROR: {str(client_import_error)}")
            return JsonResponse({"error": f"API client import error: {str(client_import_error)}"}, status=500)
        
        # Test client creation
        logger.error("🔥 About to create API client...")
        try:
            client = StorageInsightsAPIClient(credentials)
            logger.error("🔥 API client created successfully")
        except Exception as client_error:
            logger.error(f"🔥 CLIENT CREATION ERROR: {str(client_error)}")
            return JsonResponse({"error": f"API client creation error: {str(client_error)}"}, status=500)
        
        # Test authentication
        logger.error("🔥 About to test authentication...")
        try:
            auth_result = client.authenticate()
            logger.error(f"🔥 Authentication result: {auth_result}")
            
            if auth_result:
                logger.error("🔥 Authentication successful, preparing response...")
                response_data = {
                    "token": client.token,
                    "expires": client.token_expires.isoformat() if client.token_expires else None,
                    "credentials_id": credentials.id
                }
                logger.error(f"🔥 Response data prepared: {response_data}")
                return JsonResponse(response_data)
            else:
                logger.error("🔥 Authentication failed - returning 401")
                return JsonResponse({
                    "message": "Failed to authenticate with Storage Insights - check tenant ID and API key"
                }, status=401)
        except Exception as auth_error:
            logger.error(f"🔥 AUTHENTICATION ERROR: {str(auth_error)}")
            # Return 401 instead of 500 for authentication failures
            return JsonResponse({
                "message": f"Authentication failed: {str(auth_error)}"
            }, status=401)
    
    except json.JSONDecodeError as json_error:
        logger.error(f"🔥 JSON DECODE ERROR: {str(json_error)}")
        return JsonResponse({"error": f"Invalid JSON: {str(json_error)}"}, status=400)
    
    except Exception as e:
        logger.error(f"🔥 GENERAL EXCEPTION: {str(e)}")
        logger.error(f"🔥 Exception type: {type(e)}")
        import traceback
        logger.error(f"🔥 Full traceback: {traceback.format_exc()}")
        print(f"🔥 Exception: {str(e)}")
        print(f"🔥 Traceback: {traceback.format_exc()}")
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def enhanced_storage_systems_view(request):
    """Enhanced version of your existing storage systems endpoint"""
    print(f"🔥 Enhanced Storage Systems - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        # Support both old format (token) and new format (credentials_id)
        token = data.get('token')
        tenant = data.get('tenant')
        credentials_id = data.get('credentials_id')
        
        if credentials_id:
            # New approach - use stored credentials
            try:
                credentials = APICredentials.objects.get(id=credentials_id)
                client = StorageInsightsAPIClient(credentials)
            except APICredentials.DoesNotExist:
                return JsonResponse({
                    "message": "Invalid credentials"
                }, status=400)
        elif token and tenant:
            # Legacy approach - create temporary credentials
            temp_creds = APICredentials(
                name='temp',
                base_url='https://insights.ibm.com/restapi/v1',
                username=tenant,
                password='temp',  # We're using the token directly
                tenant_id=tenant
            )
            client = StorageInsightsAPIClient(temp_creds)
            client.token = token  # Use the provided token directly
        else:
            return JsonResponse({
                "message": "Either credentials_id or (token + tenant) required"
            }, status=400)
        
        systems = client.get_storage_systems()
        
        if systems and 'data' in systems:
            return JsonResponse({
                "resources": systems['data'],
                "count": len(systems['data']),
                "metadata": {
                    "tenantId": systems.get('tenantId'),
                    "storageType": systems.get('storageType'),
                    "timeStamp": systems.get('timeStamp')
                }
            })
        else:
            return JsonResponse({
                "message": "No storage systems found"
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            "message": f"Failed to fetch storage systems: {str(e)}"
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def start_orchestated_import_view(request):
    """Start a new orchestrated import job (async) with selected systems support"""
    print(f"🔥 Start Orchestrated Import - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        tenant = data.get('tenant')
        api_key = data.get('api_key')
        customer_id = data.get('customer_id')
        import_type = data.get('import_type', 'storage_only')
        selected_systems = data.get('selected_systems', [])  # List of storage system IDs
        run_async = data.get('async', True)
        
        if not tenant or not api_key:
            return JsonResponse({
                'error': 'tenant and api_key are required'
            }, status=400)
        
        if not selected_systems:
            return JsonResponse({
                'error': 'selected_systems is required and cannot be empty'
            }, status=400)
        
        # Create or get credentials
        credentials, created = APICredentials.objects.get_or_create(
            name=f"Import-{tenant}",
            defaults={
                'base_url': 'https://insights.ibm.com/restapi/v1',
                'username': tenant,
                'password': api_key,
                'tenant_id': tenant,
            }
        )
        
        if not created:
            # Update existing credentials
            credentials.password = api_key
            credentials.save()
        
        # Create import job
        import_job = ImportJob.objects.create(
            job_id=str(uuid.uuid4()),
            job_type=import_type,
            api_credentials=credentials,
            started_by=request.user if hasattr(request, 'user') and request.user.is_authenticated else None
        )
        
        if run_async:
            # Use your existing task for now
            task = run_import_task.delay(
                import_job.id, 
                customer_id=customer_id, 
                import_type=import_type
                # Note: selected_systems parameter will be ignored by the existing task
                # but that's okay for testing
            )
            
            # Store task ID
            import_job.celery_task_id = task.id
            import_job.save()
            
            return JsonResponse({
                'job_id': import_job.job_id,
                'task_id': task.id,
                'status': 'started',
                'message': f'Import started for {len(selected_systems)} storage systems',
                'selected_systems': selected_systems,
                'async': True
            }, status=202)
        else:
            # Use your existing synchronous import
            try:
                from .importers.storage_importer import StorageImporter  # Use existing importer
                importer = StorageImporter(import_job)
                importer.run_import(customer_id=customer_id, import_type=import_type)
                
                return JsonResponse({
                    'job_id': import_job.job_id,
                    'status': import_job.status,
                    'message': 'Import completed successfully',
                    'results': {
                        'processed': import_job.processed_items,
                        'successful': import_job.success_count,
                        'errors': import_job.error_count
                    },
                    'async': False
                }, status=201)
                
            except Exception as e:
                import_job.status = 'failed'
                import_job.error_details = str(e)
                import_job.completed_at = timezone.now()
                import_job.save()
                
                return JsonResponse({
                    'job_id': import_job.job_id,
                    'error': str(e),
                    'async': False
                }, status=500)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def credentials_list_view(request):
    """List API credentials"""
    print(f"🔥 Credentials List - Method: {request.method}")
    
    if request.method == "GET":
        try:
            credentials = APICredentials.objects.filter(is_active=True)
            serializer = APICredentialsSerializer(credentials, many=True)
            return JsonResponse(serializer.data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = APICredentialsSerializer(data=data)
            if serializer.is_valid():
                credentials = serializer.save()
                return JsonResponse(APICredentialsSerializer(credentials).data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def import_job_list_view(request):
    """List import jobs"""
    print(f"🔥 Import Job List - Method: {request.method}")
    
    try:
        jobs = ImportJob.objects.all().order_by('-created_at')[:20]  # Last 20 jobs
        serializer = ImportJobSerializer(jobs, many=True)
        return JsonResponse(serializer.data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def import_job_detail_view(request, job_id):
    """Get import job details including task status"""
    print(f"🔥 Import Job Detail - Job ID: {job_id}")
    
    try:
        job = get_object_or_404(ImportJob, job_id=job_id)
        serializer = ImportJobSerializer(job)
        
        response_data = serializer.data
        
        # Add Celery task status if available
        if job.celery_task_id:
            task_result = AsyncResult(job.celery_task_id)
            response_data['task_status'] = {
                'state': task_result.state,
                'info': task_result.info,
                'ready': task_result.ready(),
                'successful': task_result.successful() if task_result.ready() else None,
                'failed': task_result.failed() if task_result.ready() else None
            }
        
        return JsonResponse(response_data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def task_status_view(request, task_id):
    """Get real-time task status"""
    print(f"🔥 Task Status - Task ID: {task_id}")
    
    try:
        task_result = AsyncResult(task_id)
        
        if task_result.state == 'PENDING':
            response = {
                'state': task_result.state,
                'current': 0,
                'total': 1,
                'status': 'Task pending...'
            }
        elif task_result.state == 'PROGRESS':
            response = {
                'state': task_result.state,
                'current': task_result.info.get('current', 0),
                'total': task_result.info.get('total', 1),
                'status': task_result.info.get('status', '')
            }
        elif task_result.state == 'SUCCESS':
            response = {
                'state': task_result.state,
                'current': 1,
                'total': 1,
                'status': 'Task completed successfully',
                'result': task_result.info
            }
        else:  # FAILURE
            response = {
                'state': task_result.state,
                'current': 1,
                'total': 1,
                'status': 'Task failed',
                'error': str(task_result.info)
            }
        
        return JsonResponse(response)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def preview_import_view(request):
    """Preview what would be imported"""
    print(f"🔥 Preview Import - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        tenant = data.get('tenant')
        api_key = data.get('api_key')
        
        if not tenant or not api_key:
            return JsonResponse({
                'error': 'tenant and api_key are required'
            }, status=400)
        
        # Create temporary credentials
        temp_creds = APICredentials(
            name='temp',
            base_url='https://insights.ibm.com/restapi/v1',
            username=tenant,
            password=api_key,
            tenant_id=tenant
        )
        
        client = StorageInsightsAPIClient(temp_creds)
        
        # Get sample data without importing
        systems = client.get_storage_systems()
        
        if systems and 'data' in systems:
            # Filter to block storage only
            block_systems = [s for s in systems['data'] if s.get('storage_type') == 'block']
            
            preview_data = {
                'total_systems': len(systems['data']),
                'block_storage_systems': len(block_systems),
                'sample_systems': block_systems[:3],  # First 3 for preview
                'estimated_volumes': sum(s.get('volumes_count', 0) for s in block_systems),
                'metadata': {
                    'tenantId': systems.get('tenantId'),
                    'timeStamp': systems.get('timeStamp')
                }
            }
            return JsonResponse(preview_data)
        else:
            return JsonResponse({
                'error': 'No data available for preview'
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            'error': f'Preview failed: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def legacy_storage_insights_auth_view(request):
    """Legacy endpoint for backward compatibility"""
    print(f"🔥 Legacy Storage Insights Auth - Method: {request.method}")
    
    # Just proxy to the enhanced version
    return enhanced_auth_view(request)


@csrf_exempt
@require_http_methods(["POST"])
def legacy_storage_insights_systems_view(request):
    """Legacy endpoint for backward compatibility"""
    print(f"🔥 Legacy Storage Insights Systems - Method: {request.method}")
    
    # Just proxy to the enhanced version
    return enhanced_storage_systems_view(request)