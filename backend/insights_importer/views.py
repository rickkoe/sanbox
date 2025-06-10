from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import APICredentials, ImportJob, ImportLog
from .serializers import APICredentialsSerializer, ImportJobSerializer
from .api_client import StorageInsightsAPIClient
from .importers.storage_importer import StorageImporter
from customers.models import Customer
import uuid
from django.utils import timezone
from .tasks import run_import_task, test_connection_task
from celery.result import AsyncResult


class TestConnectionView(APIView):
    """Test API credentials connection"""
    
    def post(self, request):
        tenant = request.data.get('tenant')
        api_key = request.data.get('api_key')
        
        if not tenant or not api_key:
            return Response({
                'error': 'tenant and api_key are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create temporary credentials for testing
        temp_creds = APICredentials(
            name='temp',
            base_url='https://insights.ibm.com/restapi/v1',
            username=tenant,
            password=api_key,
            tenant_id=tenant
        )
        
        try:
            client = StorageInsightsAPIClient(temp_creds)
            
            # Test authentication first
            auth_result = client.authenticate()
            if not auth_result:
                return Response({
                    'status': 'error',
                    'message': 'Authentication failed - check tenant ID and API key'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Test a simple API call
            if client.test_connection():
                return Response({
                    'status': 'success',
                    'message': 'Connection successful',
                    'token_expires': client.token_expires.isoformat() if client.token_expires else None
                })
            else:
                return Response({
                    'status': 'error',
                    'message': 'Connection test failed - API call unsuccessful'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Connection error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EnhancedAuthView(APIView):
    """Enhanced version of your existing auth endpoint"""
    
    def post(self, request):
        tenant = request.data.get('tenant')
        api_key = request.data.get('api_key')
        
        if not tenant or not api_key:
            return Response({
                "message": "Tenant and API key are required"
            }, status=400)
        
        # Create or get credentials
        credentials, created = APICredentials.objects.get_or_create(
            name=f"Customer-{tenant}",
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
        
        client = StorageInsightsAPIClient(credentials)
        
        if client.authenticate():
            return Response({
                "token": client.token,
                "expires": client.token_expires.isoformat() if client.token_expires else None,
                "credentials_id": credentials.id
            })
        else:
            return Response({
                "message": "Failed to authenticate with Storage Insights"
            }, status=401)


class EnhancedStorageSystemsView(APIView):
    """Enhanced version of your existing storage systems endpoint"""
    
    def post(self, request):
        # Support both old format (token) and new format (credentials_id)
        token = request.data.get('token')
        tenant = request.data.get('tenant')
        credentials_id = request.data.get('credentials_id')
        
        if credentials_id:
            # New approach - use stored credentials
            try:
                credentials = APICredentials.objects.get(id=credentials_id)
                client = StorageInsightsAPIClient(credentials)
            except APICredentials.DoesNotExist:
                return Response({
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
            return Response({
                "message": "Either credentials_id or (token + tenant) required"
            }, status=400)
        
        try:
            systems = client.get_storage_systems()
            
            if systems and 'data' in systems:
                return Response({
                    "resources": systems['data'],
                    "count": len(systems['data']),
                    "metadata": {
                        "tenantId": systems.get('tenantId'),
                        "storageType": systems.get('storageType'),
                        "timeStamp": systems.get('timeStamp')
                    }
                })
            else:
                return Response({
                    "message": "No storage systems found"
                }, status=404)
                
        except Exception as e:
            return Response({
                "message": f"Failed to fetch storage systems: {str(e)}"
            }, status=500)


# Update your StartOrchestatedImportView in views.py

class StartOrchestatedImportView(APIView):
    """Start a new orchestrated import job (async) with selected systems support"""
    
    def post(self, request):
        tenant = request.data.get('tenant')
        api_key = request.data.get('api_key')
        customer_id = request.data.get('customer_id')
        import_type = request.data.get('import_type', 'storage_only')
        selected_systems = request.data.get('selected_systems', [])  # List of storage system IDs
        run_async = request.data.get('async', True)
        
        if not tenant or not api_key:
            return Response({
                'error': 'tenant and api_key are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not selected_systems:
            return Response({
                'error': 'selected_systems is required and cannot be empty'
            }, status=status.HTTP_400_BAD_REQUEST)
        
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
            started_by=request.user if request.user.is_authenticated else None
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
            
            return Response({
                'job_id': import_job.job_id,
                'task_id': task.id,
                'status': 'started',
                'message': f'Import started for {len(selected_systems)} storage systems',
                'selected_systems': selected_systems,
                'async': True
            }, status=status.HTTP_202_ACCEPTED)
        else:
            # Use your existing synchronous import
            try:
                from .importers.storage_importer import StorageImporter  # Use existing importer
                importer = StorageImporter(import_job)
                importer.run_import(customer_id=customer_id, import_type=import_type)
                
                return Response({
                    'job_id': import_job.job_id,
                    'status': import_job.status,
                    'message': 'Import completed successfully',
                    'results': {
                        'processed': import_job.processed_items,
                        'successful': import_job.success_count,
                        'errors': import_job.error_count
                    },
                    'async': False
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                import_job.status = 'failed'
                import_job.error_details = str(e)
                import_job.completed_at = timezone.now()
                import_job.save()
                
                return Response({
                    'job_id': import_job.job_id,
                    'error': str(e),
                    'async': False
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CredentialsListView(APIView):
    """List API credentials"""
    
    def get(self, request):
        credentials = APICredentials.objects.filter(is_active=True)
        serializer = APICredentialsSerializer(credentials, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        serializer = APICredentialsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ImportJobListView(APIView):
    """List import jobs"""
    
    def get(self, request):
        jobs = ImportJob.objects.all().order_by('-created_at')[:20]  # Last 20 jobs
        serializer = ImportJobSerializer(jobs, many=True)
        return Response(serializer.data)


class ImportJobDetailView(APIView):
    """Get import job details including task status"""
    
    def get(self, request, job_id):
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
        
        return Response(response_data)


class TaskStatusView(APIView):
    """Get real-time task status"""
    
    def get(self, request, task_id):
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
        
        return Response(response)


class PreviewImportView(APIView):
    """Preview what would be imported"""
    
    def post(self, request):
        tenant = request.data.get('tenant')
        api_key = request.data.get('api_key')
        
        if not tenant or not api_key:
            return Response({
                'error': 'tenant and api_key are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create temporary credentials
        temp_creds = APICredentials(
            name='temp',
            base_url='https://insights.ibm.com/restapi/v1',
            username=tenant,
            password=api_key,
            tenant_id=tenant
        )
        
        client = StorageInsightsAPIClient(temp_creds)
        
        try:
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
                return Response(preview_data)
            else:
                return Response({
                    'error': 'No data available for preview'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            return Response({
                'error': f'Preview failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Legacy compatibility endpoints - these mirror your existing storage app endpoints
class LegacyStorageInsightsAuthView(APIView):
    """Legacy endpoint for backward compatibility"""
    
    def post(self, request):
        # Just proxy to the enhanced version
        enhanced_view = EnhancedAuthView()
        return enhanced_view.post(request)


class LegacyStorageInsightsSystemsView(APIView):
    """Legacy endpoint for backward compatibility"""
    
    def post(self, request):
        # Just proxy to the enhanced version
        enhanced_view = EnhancedStorageSystemsView()
        return enhanced_view.post(request)