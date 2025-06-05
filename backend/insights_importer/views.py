from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import APICredentials, ImportJob
from .serializers import APICredentialsSerializer, ImportJobSerializer
from .api_client import StorageInsightsAPIClient


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
        jobs = ImportJob.objects.all().order_by('-created_at')[:10]  # Last 10 jobs
        serializer = ImportJobSerializer(jobs, many=True)
        return Response(serializer.data)


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
            systems = client.get_storage_systems(limit=5)
            
            if systems and 'data' in systems:
                # Filter to block storage only
                block_systems = [s for s in systems['data'] if s.get('storage_type') == 'block']
                
                preview_data = {
                    'total_systems': len(systems['data']),
                    'block_storage_systems': len(block_systems),
                    'sample_systems': block_systems[:3],  # First 3 for preview
                    'estimated_volumes': sum(s.get('volumes_count', 0) for s in block_systems),
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