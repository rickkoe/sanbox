import json
import os
import requests
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from .models import Storage, Volume, Host
from .serializers import StorageSerializer, VolumeSerializer, HostSerializer
import logging
from django.core.paginator import Paginator
from django.db.models import Q
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

# File to store API token
TOKEN_CACHE_DIR = os.path.join(settings.BASE_DIR, 'token_cache')
os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)




@csrf_exempt
@require_http_methods(["GET", "POST"])
def storage_list(request):
    """Handle storage list operations with pagination"""
    print(f"🔥 Storage List - Method: {request.method}")
    
    if request.method == "GET":
        try:
            # Get query parameters
            customer_id = request.GET.get('customer')
            page_number = request.GET.get('page', 1)
            page_size = request.GET.get('page_size', 100)
            search = request.GET.get('search', '')
            ordering = request.GET.get('ordering', 'id')
            
            # Convert to integers with defaults
            try:
                page_number = int(page_number)
                page_size = int(page_size) if page_size != 'All' else None
            except (ValueError, TypeError):
                page_number = 1
                page_size = 100
            
            # Build queryset
            storages = Storage.objects.all()
            
            # Filter by customer if provided
            if customer_id:
                storages = storages.filter(customer_id=customer_id)
            
            # Apply search if provided
            if search:
                storages = storages.filter(
                    Q(name__icontains=search) | 
                    Q(storage_type__icontains=search) |
                    Q(location__icontains=search) |
                    Q(model__icontains=search) |
                    Q(serial_number__icontains=search) |
                    Q(system_id__icontains=search) |
                    Q(primary_ip__icontains=search)
                )
            
            # Apply ordering
            if ordering:
                storages = storages.order_by(ordering)
            
            # Get total count before pagination
            total_count = storages.count()
            
            # Handle "All" page size
            if page_size is None:
                # Return all results without pagination
                serializer = StorageSerializer(storages, many=True)
                return JsonResponse({
                    'count': total_count,
                    'next': None,
                    'previous': None,
                    'results': serializer.data
                })
            
            # Create paginator
            paginator = Paginator(storages, page_size)
            
            # Get the requested page
            try:
                page_obj = paginator.get_page(page_number)
            except:
                page_obj = paginator.get_page(1)
            
            # Serialize the page data
            serializer = StorageSerializer(page_obj.object_list, many=True)
            
            # Build next/previous URLs
            base_url = request.build_absolute_uri(request.path)
            
            # Build query parameters for next/prev links
            query_params = {}
            if customer_id:
                query_params['customer'] = customer_id
            if search:
                query_params['search'] = search
            if ordering:
                query_params['ordering'] = ordering
            query_params['page_size'] = page_size
            
            next_url = None
            if page_obj.has_next():
                query_params['page'] = page_obj.next_page_number()
                next_url = f"{base_url}?{urlencode(query_params)}"
            
            previous_url = None
            if page_obj.has_previous():
                query_params['page'] = page_obj.previous_page_number()
                previous_url = f"{base_url}?{urlencode(query_params)}"
            
            return JsonResponse({
                'count': total_count,
                'next': next_url,
                'previous': previous_url,
                'results': serializer.data
            })
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            customer = data.get("customer")
            name = data.get("name")
            
            try:
                storage = Storage.objects.get(customer_id=customer, name=name)
                serializer = StorageSerializer(storage, data=data)
            except Storage.DoesNotExist:
                serializer = StorageSerializer(data=data)
            
            if serializer.is_valid():
                storage_instance = serializer.save()
                storage_instance.imported = timezone.now()
                storage_instance.save(update_fields=['imported'])
                return JsonResponse(serializer.data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def storage_detail(request, pk):
    """Handle storage detail operations"""
    print(f"🔥 Storage Detail - Method: {request.method}, PK: {pk}")
    
    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return JsonResponse({"error": "Storage not found"}, status=404)
    
    if request.method == "GET":
        try:
            serializer = StorageSerializer(storage)
            return JsonResponse(serializer.data)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method in ["PUT", "PATCH"]:
        try:
            data = json.loads(request.body)
            serializer = StorageSerializer(storage, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                storage_instance = serializer.save()
                storage_instance.updated = timezone.now()
                storage_instance.save(update_fields=['updated'])
                return JsonResponse(serializer.data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "DELETE":
        try:
            storage.delete()
            return JsonResponse({"message": "Storage deleted successfully"}, status=204)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def storage_insights_auth(request):
    """Authenticate with IBM Storage Insights and get a token."""
    print(f"🔥 Storage Insights Auth - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        tenant = data.get('tenant')
        api_key = data.get('api_key')
        
        if not tenant or not api_key:
            return JsonResponse({"message": "Tenant and API key are required"}, status=400)
        
        logger.info(f"Authenticating with Storage Insights for tenant: {tenant}")
        
        # Check for cached token
        token_file = os.path.join(TOKEN_CACHE_DIR, f'{tenant}_token.json')
        token = get_cached_token(token_file, tenant, api_key)
        
        if token:
            return JsonResponse({"token": token})
        else:
            return JsonResponse({"message": "Failed to authenticate with Storage Insights"}, status=401)
            
    except Exception as e:
        logger.exception("Unexpected error during authentication")
        return JsonResponse(
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


@csrf_exempt
@require_http_methods(['POST'])
def storage_insights_systems(request):
    """Fetch storage systems from IBM Storage Insights."""
    print(f"🔥 Storage Insights Systems - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        token = data.get('token')
        tenant = data.get('tenant')
        
        if not token:
            return JsonResponse({"message": "Valid authorization token required"}, status=401)
        
        if not tenant:
            return JsonResponse({"message": "Tenant parameter is required"}, status=400)
        
        logger.info(f"Fetching storage systems for tenant: {tenant}")
        
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
        
        return JsonResponse(result)
    
    except Exception as e:
        logger.exception("Error fetching storage systems")
        return JsonResponse(
            {"message": f"Failed to fetch storage systems: {str(e)}"}, 
            status=500
        )


@csrf_exempt
@require_http_methods(['POST'])
def storage_insights_volumes(request):
    """Fetch all volumes from IBM Storage Insights for a given storage system."""
    print(f"🔥 Storage Insights Volumes - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        token = data.get("token")
        tenant = data.get("tenant")
        system_id = data.get("system_id")

        if not token or not tenant or not system_id:
            return JsonResponse({"message": "token, tenant, and system_id are required"}, status=400)

        base_url = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/storage-systems/{system_id}/volumes?limit=500&offset=1"
        headers = {
            "x-api-token": token,
            "Accept": "application/json"
        }

        all_volumes = []
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

        return JsonResponse({
            "imported_count": imported_count,
            "message": f"Imported {imported_count} volume records"
        })
    
    except Exception as e:
        logger.exception("Failed to fetch volumes from Storage Insights")
        return JsonResponse({"message": f"Failed to fetch volumes: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def storage_insights_host_connections(request):
    """Fetch all host connections from IBM Storage Insights for a given storage system."""
    print(f"🔥 Storage Insights Host Connections - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        token = data.get("token")
        tenant = data.get("tenant")
        system_id = data.get("system_id")

        if not token or not tenant or not system_id:
            return JsonResponse({"message": "token, tenant, and system_id are required"}, status=400)

        base_url = f"https://insights.ibm.com/restapi/v1/tenants/{tenant}/storage-systems/{system_id}/host-connections?limit=500&offset=1"
        headers = {
            "x-api-token": token,
            "Accept": "application/json"
        }

        all_connections = []
        url = base_url
        while url:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            result = resp.json()
            all_connections.extend(result.get("data", []))
            next_link = next((l["uri"] for l in result.get("links", []) if l["params"].get("rel") == "next"), None)
            url = next_link

        imported_count = 0
        storage_obj = Storage.objects.get(storage_system_id=system_id)
        for conn in all_connections:
            conn['storage'] = storage_obj.id
            existing = Host.objects.filter(storage=storage_obj, name=conn.get("name")).first()
            serializer = HostSerializer(instance=existing, data=conn)
            if serializer.is_valid():
                hc_obj = serializer.save()
                hc_obj.imported = timezone.now()
                hc_obj.save(update_fields=['imported'])
                imported_count += 1
            else:
                logger.warning(f"Invalid host connection data for {conn.get('port')}: {serializer.errors}")

        return JsonResponse({
            "imported_count": imported_count,
            "message": f"Imported {imported_count} host connection records"
        })
    except Storage.DoesNotExist:
        return JsonResponse({"message": "Storage system not found"}, status=404)
    except Exception as e:
        logger.exception("Failed to fetch host connections from Storage Insights")
        return JsonResponse({"message": f"Failed to fetch host connections: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def volume_list(request):
    """Return volumes filtered by storage system ID."""
    print(f"🔥 Volume List - Method: {request.method}")
    
    try:
        system_id = request.GET.get("storage_system_id")
        if not system_id:
            return JsonResponse({"error": "Missing storage_system_id"}, status=400)

        volumes = Volume.objects.filter(storage__storage_system_id=system_id)
        serializer = VolumeSerializer(volumes, many=True)
        return JsonResponse(serializer.data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)