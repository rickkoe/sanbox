from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Storage, Volume
from .serializers import StorageSerializer, VolumeSerializer
from django.utils import timezone

@api_view(["GET", "POST"])
def storage_list(request):
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
        customer = request.data.get("customer")
        name = request.data.get("name")
        try:
            storage = Storage.objects.get(customer_id=customer, name=name)
            serializer = StorageSerializer(storage, data=request.data)
        except Storage.DoesNotExist:
            serializer = StorageSerializer(data=request.data)
        
        if serializer.is_valid():
            storage_instance = serializer.save()
            storage_instance.imported = timezone.now()
            storage_instance.save(update_fields=['imported'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "PUT", "PATCH", "DELETE"])
def storage_detail(request, pk):
    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return Response({"error": "Storage not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == "GET":
        serializer = StorageSerializer(storage)
        return Response(serializer.data)
    
    elif request.method in ["PUT", "PATCH"]:
        serializer = StorageSerializer(storage, data=request.data, partial=(request.method == "PATCH"))
        if serializer.is_valid():
            storage_instance = serializer.save()
            storage_instance.updated = timezone.now()
            storage_instance.save(update_fields=['updated'])
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
def storage_insights_volumes(request):
    """Fetch all volumes from IBM Storage Insights for a given storage system."""
    token = request.data.get("token")
    tenant = request.data.get("tenant")
    system_id = request.data.get("system_id")

    if not token or not tenant or not system_id:
        return Response({"message": "token, tenant, and system_id are required"}, status=400)

    base_url = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/storage-systems/{system_id}/volumes?limit=500&offset=1"
    headers = {
        "x-api-token": token,
        "Accept": "application/json"
    }

    all_volumes = []

    try:
        url = base_url
        while url:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            all_volumes.extend(result.get("data", []))

            # Get the next page from links
            next_link = next((l["uri"] for l in result.get("links", []) if l["params"].get("rel") == "next"), None)
            url = next_link

        imported_count = 0
        for volume_data in all_volumes:
            try:
                # Match the related storage system
                storage = Storage.objects.get(storage_system_id=system_id)
                # Inject foreign key relation

                volume_data['storage'] = storage.id

                # Match by unique_id
                volume_obj = Volume.objects.filter(unique_id=volume_data['unique_id']).first()
                serializer = VolumeSerializer(instance=volume_obj, data=volume_data)

                if serializer.is_valid():
                    volume_obj = serializer.save()
                    volume_obj.imported = timezone.now()
                    volume_obj.save(update_fields=['imported'])
                    imported_count += 1
                else:
                    logger.warning(f"Invalid volume data for {volume_data.get('name')}: {serializer.errors}")

            except Exception as ve:
                logger.warning(f"Failed to import volume {volume_data.get('name')}: {ve}")

        return Response({
            "imported_count": imported_count,
            "message": f"Imported {imported_count} volume records"
        })
    
    except Exception as e:
        logger.exception("Failed to fetch volumes from Storage Insights")
        return Response({"message": f"Failed to fetch volumes: {str(e)}"}, status=500)
    
@api_view(["GET"])
def volume_list(request):
    """Return volumes filtered by storage system ID."""
    system_id = request.query_params.get("storage_system_id")
    if not system_id:
        return Response({"error": "Missing storage_system_id"}, status=status.HTTP_400_BAD_REQUEST)

    volumes = Volume.objects.filter(storage__storage_system_id=system_id)
    serializer = VolumeSerializer(volumes, many=True)
    return Response(serializer.data)
