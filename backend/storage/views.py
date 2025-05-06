from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Storage
from .serializers import StorageSerializer

@api_view(["GET", "POST"])
def storage_list(request):
    print(f'storage_list DATA: {request.data}')
    if request.method == "GET":
        # Get all storage items
        storages = Storage.objects.all()
        
        # Filter by customer if provided in query params
        customer_id = request.query_params.get('customer')
        if customer_id:
            storages = storages.filter(customer_id=customer_id)
            
        serializer = StorageSerializer(storages, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = StorageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT", "DELETE", "GET"])
def storage_detail(request, pk):
    print(f'PK: {pk}')
    print(f'storage_detail DATA: {request.data}')
    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return Response({"error": "Storage not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == "GET":
        serializer = StorageSerializer(storage)
        return Response(serializer.data)
    
    elif request.method == "PUT":
        serializer = StorageSerializer(storage, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == "DELETE":
        storage.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

import json
import os
import requests
from datetime import datetime
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# File to store API token
TOKEN_CACHE_DIR = os.path.join(settings.BASE_DIR, 'token_cache')
os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)

@api_view(['POST'])
def storage_insights_auth(request):
    """Authenticate with IBM Storage Insights and get a token."""
    tenant = request.data.get('tenant')
    api_key = request.data.get('api_key')
    
    if not tenant or not api_key:
        return Response({"message": "Tenant and API key are required"}, status=400)
    
    logger.info(f"Authenticating with Storage Insights for tenant: {tenant}")
    
    try:
        # Check for cached token
        token_file = os.path.join(TOKEN_CACHE_DIR, f'{tenant}_token.json')
        token = get_cached_token(token_file, tenant, api_key)
        
        if token:
            return Response({"token": token})
        else:
            return Response({"message": "Failed to authenticate with Storage Insights"}, status=401)
            
    except Exception as e:
        logger.exception("Unexpected error during authentication")
        return Response(
            {"message": f"Authentication error: {str(e)}"}, 
            status=500
        )

def get_cached_token(token_file, tenant, api_key):
    """Get a valid token, either from cache or by requesting a new one."""
    try:
        if os.path.exists(token_file):
            with open(token_file, 'r') as f:
                stored_token = json.load(f)
                token_expiry = datetime.utcfromtimestamp(stored_token.get('result', {}).get('expiration', 0)/1000.0)
                
                if datetime.utcnow() < token_expiry:
                    logger.info("Using cached token (still valid)")
                    return stored_token['result']['token']
                else:
                    logger.info("Cached token expired, fetching new token")
        else:
            logger.info("No cached token found, fetching new token")
        
        # Token doesn't exist or is expired, fetch a new one
        token_response = fetch_new_token(tenant, api_key)
        
        if token_response and token_response.get('result', {}).get('token'):
            # Cache the token
            with open(token_file, 'w') as f:
                json.dump(token_response, f)
            return token_response['result']['token']
        else:
            logger.error("Failed to get token from Storage Insights")
            return None
            
    except Exception as e:
        logger.exception(f"Error in token management: {str(e)}")
        return None

def fetch_new_token(tenant, api_key):
    """Fetch a new token from IBM Storage Insights."""
    token_endpoint = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/token"
    
    headers = {
        "x-api-key": api_key,
        "Accept": "application/json"
    }
    
    try:
        response = requests.post(token_endpoint, headers=headers, timeout=30)
        response.raise_for_status()  # Raise exception for non-200 responses
        
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Token request failed: {str(e)}")
        if hasattr(e, 'response') and e.response:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response content: {e.response.text}")
        return None

@api_view(['POST'])
def storage_insights_systems(request):
    """Fetch storage systems from IBM Storage Insights."""
    token = request.data.get('token')
    tenant = request.data.get('tenant')
    
    if not token:
        return Response({"message": "Valid authorization token required"}, status=401)
    
    if not tenant:
        return Response({"message": "Tenant parameter is required"}, status=400)
    
    logger.info(f"Fetching storage systems for tenant: {tenant}")
    
    try:
        systems_endpoint = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/storage-systems"
        
        headers = {
            "x-api-token": token,
            "Accept": "application/json"
        }
        
        response = requests.get(systems_endpoint, headers=headers, timeout=30)
        response.raise_for_status()
        
        storage_systems = response.json()
        logger.info(f"Successfully fetched storage systems")
        
        # Process the data for a consistent format
        resources = storage_systems.get('data', [])
        result = {
            "resources": resources,
            "count": len(resources)
        }
        
        return Response(result)
    
    except Exception as e:
        logger.exception("Error fetching storage systems")
        return Response(
            {"message": f"Failed to fetch storage systems: {str(e)}"}, 
            status=500
        )

@api_view(['POST'])
def import_from_insights(request):
    """Import selected storage systems from IBM Storage Insights."""
    from .models import Storage
    from customers.models import Customer
    print(f'DATA: {request.data}')
    customer_id = request.data.get('customer_id')
    system_ids = request.data.get('system_ids', [])
    token = request.data.get('token')
    
    if not customer_id or not system_ids or not token:
        return Response(
            {"message": "Customer ID, system IDs, and token are required"}, 
            status=400
        )
    
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return Response({"message": "Customer not found"}, status=404)
    
    tenant = customer.insights_tenant
    if not tenant:
        return Response({"message": "Customer has no Storage Insights tenant configured"}, status=400)
    
    rest_api_host = f"https://insights.ibm.com/restapi/v1/tenants{tenant}"
    
    # Fetch details for each selected system
    imported_count = 0
    errors = []
    
    for system_id in system_ids:
        try:
            # Get detailed system info
            system_url = f"{rest_api_host}/api/resources/storage-systems/{system_id}"
            
            response = requests.get(
                system_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                },
                timeout=30
            )
            
            response.raise_for_status()
            system_data = response.json().get('data', {})
            
            if not system_data:
                errors.append({
                    "system_id": system_id,
                    "error": "Empty system data returned from API"
                })
                continue
            
            # Map Storage Insights fields to your Storage model fields
            storage_type_mapping = {
                '2145': 'FlashSystem',
                '2107': 'DS8000',
                '2076': 'Storwize',
                '1814': 'XIV',
                # Add more mappings as needed
            }
            
            machine_type = system_data.get('machine_type', '')
            
            storage_data = {
                'customer': customer,
                'name': system_data.get('name', f"Storage-{system_id}"),
                'storage_type': storage_type_mapping.get(machine_type, 'Unknown'),
                'machine_type': machine_type,
                'model': system_data.get('model', ''),
                'serial_number': system_data.get('serial_number', ''),
                'firmware_level': system_data.get('code_level', ''),
                'wwnn': system_data.get('wwnn', ''),
                'system_id': system_id,
                'primary_ip': system_data.get('ip_address', ''),
                'location': system_data.get('location', '')
            }
            
            # Try to find existing storage entry, update it or create new one
            storage, created = Storage.objects.update_or_create(
                customer=customer,
                system_id=system_id,
                defaults=storage_data
            )
            
            logger.info(f"{'Created' if created else 'Updated'} storage system: {storage.name}")
            imported_count += 1
            
        except requests.RequestException as e:
            logger.error(f"API error for system {system_id}: {str(e)}")
            errors.append({
                "system_id": system_id,
                "error": str(e)
            })
        except Exception as e:
            logger.exception(f"Processing error for system {system_id}")
            errors.append({
                "system_id": system_id,
                "error": str(e)
            })
    
    return Response({
        "imported_count": imported_count,
        "total": len(system_ids),
        "errors": errors
    })