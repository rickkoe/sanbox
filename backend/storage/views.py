import json
import os
import requests
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from .models import Storage, Volume, Host, HostWwpn, Port
from .serializers import StorageSerializer, VolumeSerializer, HostSerializer, PortSerializer
import logging
from django.core.paginator import Paginator
from django.db.models import Q
from urllib.parse import urlencode
from core.dashboard_views import clear_dashboard_cache_for_customer

logger = logging.getLogger(__name__)

# File to store API token
TOKEN_CACHE_DIR = os.path.join(settings.BASE_DIR, 'token_cache')
os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)




@csrf_exempt
@require_http_methods(["GET", "POST"])
def storage_list(request):
    """Handle storage list operations with pagination"""
    print(f"🔥 Storage List - Method: {request.method}")

    user = request.user if request.user.is_authenticated else None

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

            # Build queryset with optimizations
            storages = Storage.objects.select_related('customer').all()

            # Filter by user's customer access
            # Skip filtering if user is not authenticated (for development)
            if user and user.is_authenticated:
                from core.permissions import filter_by_customer_access
                storages = filter_by_customer_access(storages, user)
            
            # Filter by customer if provided
            if customer_id:
                storages = storages.filter(customer=customer_id)
            
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
            
            # Apply field-specific filters
            filter_params = {}
            for param, value in request.GET.items():
                if param.startswith((
                    'name__', 'storage_type__', 'location__', 'storage_system_id__', 'machine_type__',
                    'model__', 'serial_number__', 'system_id__', 'wwnn__', 'firmware_level__',
                    'primary_ip__', 'secondary_ip__', 'uuid__', 'probe_status__', 'condition__',
                    'customer_number__', 'vendor__', 'time_zone__', 'data_collection__',
                    'data_collection_type__', 'notes__', 'imported__', 'updated__'
                )):
                    filter_params[param] = value
            
            # Apply the filters
            if filter_params:
                storages = storages.filter(**filter_params)
            
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
                'results': serializer.data,
                'count': total_count,
                'num_pages': paginator.num_pages,
                'current_page': page_number,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
                'next': next_url,
                'previous': previous_url
            })
            
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "POST":
        # Create/update storage
        try:
            data = json.loads(request.body)
            customer_id = data.get("customer")
            name = data.get("name")

            # Check if user can modify infrastructure for this customer
            # Skip permission check if user is not authenticated (for development)
            if user and customer_id:
                from customers.models import Customer
                from core.permissions import can_edit_customer_infrastructure
                try:
                    customer = Customer.objects.get(id=customer_id)
                    if not can_edit_customer_infrastructure(user, customer):
                        return JsonResponse({
                            "error": "You do not have permission to create/update storage systems. Only members and admins can modify infrastructure."
                        }, status=403)
                except Customer.DoesNotExist:
                    return JsonResponse({"error": "Customer not found"}, status=404)

            try:
                storage = Storage.objects.get(customer=customer_id, name=name)
                serializer = StorageSerializer(storage, data=data)
            except Storage.DoesNotExist:
                serializer = StorageSerializer(data=data)

            if serializer.is_valid():
                storage_instance = serializer.save()
                # Set last_modified_by and imported timestamp
                if user:
                    storage_instance.last_modified_by = user
                storage_instance.imported = timezone.now()
                update_fields = ['imported']
                if user:
                    update_fields.append('last_modified_by')
                storage_instance.save(update_fields=update_fields)

                # Clear dashboard cache when storage is created/updated
                if storage_instance.customer_id:
                    clear_dashboard_cache_for_customer(storage_instance.customer_id)

                return JsonResponse(serializer.data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def storage_detail(request, pk):
    """Handle storage detail operations"""
    print(f"🔥 Storage Detail - Method: {request.method}, PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return JsonResponse({"error": "Storage not found"}, status=404)

    if request.method == "GET":
        # Check if user has access to this storage's customer
        # Skip permission check if user is not authenticated (for development)
        if user and user.is_authenticated:
            from core.permissions import has_customer_access
            if storage.customer and not has_customer_access(user, storage.customer):
                return JsonResponse({"error": "Permission denied"}, status=403)

        try:
            serializer = StorageSerializer(storage)
            return JsonResponse(serializer.data)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method in ["PUT", "PATCH"]:
        # Update storage
        # Check if user can modify infrastructure for this customer
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if storage.customer and not can_edit_customer_infrastructure(user, storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to update storage systems. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            data = json.loads(request.body)

            # Optimistic locking - check version
            client_version = data.get('version')
            if client_version is not None:
                if storage.version != client_version:
                    # Version mismatch - someone else modified this storage
                    return JsonResponse({
                        "error": "Conflict",
                        "message": f"This storage system was modified by {storage.last_modified_by.username if storage.last_modified_by else 'another user'}. Please reload and try again.",
                        "current_version": storage.version,
                        "last_modified_by": storage.last_modified_by.username if storage.last_modified_by else None,
                        "last_modified_at": storage.last_modified_at.isoformat() if storage.last_modified_at else None
                    }, status=409)

            serializer = StorageSerializer(storage, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                storage_instance = serializer.save()
                # Set last_modified_by and increment version
                if user:
                    storage_instance.last_modified_by = user
                storage_instance.version += 1
                storage_instance.updated = timezone.now()
                update_fields = ['version', 'updated']
                if user:
                    update_fields.append('last_modified_by')
                storage_instance.save(update_fields=update_fields)

                # Clear dashboard cache when storage is updated
                if storage_instance.customer_id:
                    clear_dashboard_cache_for_customer(storage_instance.customer_id)

                return JsonResponse(serializer.data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        # Delete storage
        # Check if user can modify infrastructure for this customer
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if storage.customer and not can_edit_customer_infrastructure(user, storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to delete storage systems. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            customer_id = storage.customer_id
            storage.delete()

            # Clear dashboard cache when storage is deleted
            if customer_id:
                clear_dashboard_cache_for_customer(customer_id)

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
    """Return volumes filtered by storage system ID with pagination and filtering."""
    print(f"🔥 Volume List - Method: {request.method}")
    
    try:
        system_id = request.GET.get("storage_system_id")
        if not system_id:
            return JsonResponse({"error": "Missing storage_system_id"}, status=400)

        # Get query parameters
        search = request.GET.get('search', '').strip()
        ordering = request.GET.get('ordering', 'name')
        
        # Base queryset with optimizations
        volumes = Volume.objects.select_related('storage').filter(storage__storage_system_id=system_id)
        
        # Apply general search if provided
        if search:
            volumes = volumes.filter(
                Q(name__icontains=search) |
                Q(storage__name__icontains=search) |
                Q(volume_id__icontains=search) |
                Q(volser__icontains=search) |
                Q(format__icontains=search) |
                Q(natural_key__icontains=search) |
                Q(pool_name__icontains=search) |
                Q(unique_id__icontains=search) |
                Q(status_label__icontains=search)
            )
        
        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith((
                'name__', 'storage__', 'volume_id__', 'volume_number__', 'volser__', 'format__',
                'natural_key__', 'pool_name__', 'pool_id__', 'lss_lcu__', 'node__', 'block_size__',
                'unique_id__', 'acknowledged__', 'status_label__', 'raid_level__', 'copy_id__',
                'safeguarded__', 'io_group__', 'formatted__', 'virtual_disk_type__', 'fast_write_state__',
                'vdisk_mirror_copies__', 'vdisk_mirror_role__', 'compressed__', 'thin_provisioned__',
                'encryption__', 'flashcopy__', 'auto_expand__', 'easy_tier__', 'easy_tier_status__',
                'deduplicated__'
            )):
                filter_params[param] = value
        
        # Apply the filters
        if filter_params:
            volumes = volumes.filter(**filter_params)
        
        # Apply ordering
        if ordering:
            volumes = volumes.order_by(ordering)
        
        # Add pagination for performance with large datasets
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))  # Default 50 volumes per page
        
        # Apply pagination
        paginator = Paginator(volumes, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize paginated results
        serializer = VolumeSerializer(page_obj, many=True)
        
        # Return paginated response with metadata
        return JsonResponse({
            'results': serializer.data,
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'current_page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def host_list(request):
    """Return hosts filtered by storage system ID with pagination and filtering."""
    print(f"🔥 Host List - Method: {request.method}")
    
    try:
        system_id = request.GET.get("storage_system_id")
        if not system_id:
            return JsonResponse({"error": "Missing storage_system_id"}, status=400)

        # Get query parameters
        search = request.GET.get('search', '').strip()
        ordering = request.GET.get('ordering', 'name')
        
        # Base queryset with optimizations
        hosts = Host.objects.select_related('storage').filter(storage__storage_system_id=system_id)
        
        # Apply general search if provided
        if search:
            hosts = hosts.filter(
                Q(name__icontains=search) |
                Q(storage__name__icontains=search) |
                Q(wwpns__icontains=search) |
                Q(status__icontains=search) |
                Q(associated_resource__icontains=search) |
                Q(host_type__icontains=search) |
                Q(volume_group__icontains=search) |
                Q(natural_key__icontains=search)
            )
        
        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith((
                'name__', 'storage__', 'wwpns__', 'status__', 'acknowledged__', 
                'associated_resource__', 'host_type__', 'vols_count__', 'fc_ports_count__',
                'last_data_collection__', 'volume_group__', 'natural_key__'
            )):
                filter_params[param] = value
        
        # Apply the filters
        if filter_params:
            hosts = hosts.filter(**filter_params)
        
        # Apply ordering
        if ordering:
            hosts = hosts.order_by(ordering)
        
        # Add pagination for performance with large datasets
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))  # Default 50 hosts per page
        
        # Apply pagination
        paginator = Paginator(hosts, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize paginated results
        serializer = HostSerializer(page_obj, many=True)
        
        # Return paginated response with metadata
        return JsonResponse({
            'results': serializer.data,
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'current_page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def mkhost_scripts_view(request, customer_id):
    """Generate mkhost scripts for all storage systems for a customer."""
    print(f"🔥 MkHost Scripts - Method: {request.method}, Customer ID: {customer_id}")
    
    try:
        from customers.models import Customer
        from .storage_utils import generate_mkhost_scripts
        
        # Get customer
        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return JsonResponse({"error": "Customer not found"}, status=404)
        
        # Get all storage systems for this customer
        storage_systems = Storage.objects.filter(customer=customer).order_by('name')
        
        if not storage_systems.exists():
            return JsonResponse({
                "storage_scripts": {},
                "message": "No storage systems found for this customer"
            })
        
        # Generate scripts using utility function
        storage_scripts = generate_mkhost_scripts(storage_systems)
        
        return JsonResponse({
            "storage_scripts": storage_scripts,
            "total_storage_systems": len(storage_scripts)
        })
        
    except Exception as e:
        print(f"❌ Error generating mkhost scripts: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def host_wwpns_view(request, host_id):
    """Get or manage WWPNs for a specific host."""
    try:
        host = Host.objects.get(id=host_id)
    except Host.DoesNotExist:
        return JsonResponse({"error": "Host not found."}, status=404)
    
    if request.method == "GET":
        # Return all WWPNs for this host with source information
        wwpn_details = host.get_all_wwpns()
        return JsonResponse({
            "host_id": host.id,
            "host_name": host.name,
            "wwpns": wwpn_details
        })
    
    elif request.method == "POST":
        # Add or remove manual WWPNs
        try:
            data = json.loads(request.body)
            action = data.get('action')  # 'add' or 'remove'
            wwpn = data.get('wwpn', '').strip()
            
            if not wwpn:
                return JsonResponse({"error": "WWPN is required."}, status=400)
            
            # Format WWPN to ensure consistent format
            def format_wwpn(value):
                if not value:
                    return ""
                clean_value = ''.join(c for c in value.upper() if c in '0123456789ABCDEF')
                if len(clean_value) != 16:
                    return None  # Invalid length
                return ':'.join([clean_value[i:i+2] for i in range(0, 16, 2)])
            
            formatted_wwpn = format_wwpn(wwpn)
            if not formatted_wwpn:
                return JsonResponse({"error": "Invalid WWPN format. Must be 16 hex characters."}, status=400)
            
            if action == 'add':
                # Add a manual WWPN
                host_wwpn, created = HostWwpn.objects.get_or_create(
                    host=host,
                    wwpn=formatted_wwpn,
                    defaults={'source_type': 'manual'}
                )
                if not created:
                    if host_wwpn.source_type == 'alias':
                        return JsonResponse({
                            "error": f"WWPN {formatted_wwpn} is already assigned from alias '{host_wwpn.source_alias.name}'."
                        }, status=400)
                    else:
                        return JsonResponse({
                            "error": f"WWPN {formatted_wwpn} is already manually assigned to this host."
                        }, status=400)
                
                return JsonResponse({
                    "success": True,
                    "message": f"WWPN {formatted_wwpn} added to host {host.name}.",
                    "wwpn": {
                        "wwpn": formatted_wwpn,
                        "source_type": "manual",
                        "source_alias": None,
                        "aligned": False
                    }
                })
            
            elif action == 'remove':
                # Remove a manual WWPN (cannot remove alias-sourced WWPNs)
                try:
                    host_wwpn = HostWwpn.objects.get(
                        host=host,
                        wwpn=formatted_wwpn,
                        source_type='manual'
                    )
                    host_wwpn.delete()
                    return JsonResponse({
                        "success": True,
                        "message": f"Manual WWPN {formatted_wwpn} removed from host {host.name}."
                    })
                except HostWwpn.DoesNotExist:
                    return JsonResponse({
                        "error": f"Manual WWPN {formatted_wwpn} not found for this host."
                    }, status=404)
            
            else:
                return JsonResponse({"error": "Invalid action. Use 'add' or 'remove'."}, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON data."}, status=400)
        except Exception as e:
            return JsonResponse({"error": f"Error managing WWPN: {str(e)}"}, status=500)


@csrf_exempt 
@require_http_methods(["POST"])
def check_wwpn_conflicts_view(request):
    """Check for conflicts between manual WWPNs and existing aliases."""
    try:
        data = json.loads(request.body)
        wwpn = data.get('wwpn', '').strip()
        host_id = data.get('host_id')
        
        if not wwpn:
            return JsonResponse({"error": "WWPN is required."}, status=400)
        
        # Format WWPN using same logic as above
        def format_wwpn(value):
            if not value:
                return ""
            clean_value = ''.join(c for c in value.upper() if c in '0123456789ABCDEF')
            if len(clean_value) != 16:
                return None
            return ':'.join([clean_value[i:i+2] for i in range(0, 16, 2)])
        
        formatted_wwpn = format_wwpn(wwpn)
        if not formatted_wwpn:
            return JsonResponse({"error": "Invalid WWPN format. Must be 16 hex characters."}, status=400)
        
        conflicts = []
        
        # Check if this WWPN exists in any aliases
        from san.models import Alias
        aliases_with_wwpn = Alias.objects.filter(wwpn=formatted_wwpn)
        
        for alias in aliases_with_wwpn:
            conflict_info = {
                "type": "alias",
                "alias_name": alias.name,
                "alias_id": alias.id,
                "fabric_name": alias.fabric.name,
                "host_name": alias.host.name if alias.host else None,
                "host_id": alias.host.id if alias.host else None,
                "use": alias.use
            }
            
            if alias.host and str(alias.host.id) == str(host_id):
                conflict_info["alignment"] = "matched"
                conflict_info["message"] = f"This WWPN matches alias '{alias.name}' already assigned to this host."
            elif alias.host:
                conflict_info["alignment"] = "conflict"
                conflict_info["message"] = f"This WWPN matches alias '{alias.name}' assigned to different host '{alias.host.name}'."
            else:
                conflict_info["alignment"] = "available"
                conflict_info["message"] = f"This WWPN matches unassigned alias '{alias.name}'. You can assign this alias to the host instead."
            
            conflicts.append(conflict_info)
        
        # Check if this WWPN is already manually assigned to other hosts
        if host_id:
            manual_assignments = HostWwpn.objects.filter(
                wwpn=formatted_wwpn,
                source_type='manual'
            ).exclude(host_id=host_id)
        else:
            manual_assignments = HostWwpn.objects.filter(
                wwpn=formatted_wwpn,
                source_type='manual'
            )
        
        for assignment in manual_assignments:
            conflicts.append({
                "type": "manual",
                "host_name": assignment.host.name,
                "host_id": assignment.host.id,
                "alignment": "conflict",
                "message": f"This WWPN is already manually assigned to host '{assignment.host.name}'."
            })
        
        return JsonResponse({
            "wwpn": formatted_wwpn,
            "conflicts": conflicts,
            "has_conflicts": len(conflicts) > 0
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data."}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Error checking conflicts: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def port_list(request):
    """Handle port list operations with pagination and filtering"""
    print(f"🔥 Port List - Method: {request.method}")

    user = request.user if request.user.is_authenticated else None

    if request.method == "GET":
        try:
            # Get query parameters
            storage_id = request.GET.get('storage_id')
            project_id = request.GET.get('project')
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

            # Build queryset with optimizations
            ports = Port.objects.select_related('storage', 'fabric', 'alias', 'project').all()

            # Filter by user's project access
            if user and user.is_authenticated:
                from core.permissions import filter_by_project_access
                ports = filter_by_project_access(ports, user)

            # Filter by customer if provided (via storage relationship)
            if customer_id:
                ports = ports.filter(storage__customer_id=customer_id)

            # Filter by storage if provided
            if storage_id:
                ports = ports.filter(storage_id=storage_id)

            # Filter by project if provided
            if project_id:
                ports = ports.filter(project_id=project_id)

            # Apply search if provided
            if search:
                ports = ports.filter(
                    Q(name__icontains=search) |
                    Q(storage__name__icontains=search) |
                    Q(location__icontains=search) |
                    Q(fabric__name__icontains=search) |
                    Q(alias__name__icontains=search) |
                    Q(protocol__icontains=search)
                )

            # Apply field-specific filters
            filter_params = {}
            for param, value in request.GET.items():
                if param.startswith((
                    'name__', 'storage__', 'type__', 'speed_gbps__', 'location__',
                    'frame__', 'io_enclosure__', 'fabric__', 'alias__', 'protocol__', 'use__'
                )):
                    filter_params[param] = value

            # Apply the filters
            if filter_params:
                ports = ports.filter(**filter_params)

            # Apply ordering
            if ordering:
                ports = ports.order_by(ordering)

            # Get total count before pagination
            total_count = ports.count()

            # Handle "All" page size
            if page_size is None:
                serializer = PortSerializer(ports, many=True)
                return JsonResponse({
                    'count': total_count,
                    'next': None,
                    'previous': None,
                    'results': serializer.data
                })

            # Create paginator
            paginator = Paginator(ports, page_size)

            # Get the requested page
            try:
                page_obj = paginator.get_page(page_number)
            except:
                page_obj = paginator.get_page(1)

            # Serialize the page data
            serializer = PortSerializer(page_obj.object_list, many=True)

            # Build next/previous URLs
            base_url = request.build_absolute_uri(request.path)

            # Build query parameters for next/prev links
            query_params = {}
            if storage_id:
                query_params['storage_id'] = storage_id
            if project_id:
                query_params['project'] = project_id
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
                'results': serializer.data,
                'count': total_count,
                'num_pages': paginator.num_pages,
                'current_page': page_number,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
                'next': next_url,
                'previous': previous_url
            })

        except Exception as e:
            logger.exception("Error fetching port list")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "POST":
        # Create/update port
        try:
            data = json.loads(request.body)
            storage_id = data.get("storage")
            wwpn = data.get("wwpn")

            # Check if user can modify infrastructure
            if user:
                from storage.models import Storage
                from core.permissions import can_edit_customer_infrastructure
                try:
                    storage = Storage.objects.get(id=storage_id)
                    if storage.customer and not can_edit_customer_infrastructure(user, storage.customer):
                        return JsonResponse({
                            "error": "You do not have permission to create/update ports. Only members and admins can modify infrastructure."
                        }, status=403)
                except Storage.DoesNotExist:
                    return JsonResponse({"error": "Storage system not found"}, status=404)

            # Look up by WWPN if provided, otherwise create new
            if wwpn:
                try:
                    port = Port.objects.get(wwpn=wwpn)
                    serializer = PortSerializer(port, data=data)
                except Port.DoesNotExist:
                    serializer = PortSerializer(data=data)
            else:
                serializer = PortSerializer(data=data)

            if serializer.is_valid():
                port_instance = serializer.save()
                # Set last_modified_by
                if user:
                    port_instance.last_modified_by = user
                    port_instance.save(update_fields=['last_modified_by'])

                return JsonResponse(serializer.data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            logger.exception("Error creating/updating port")
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def port_detail(request, pk):
    """Handle port detail operations"""
    print(f"🔥 Port Detail - Method: {request.method}, PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        port = Port.objects.select_related('storage', 'fabric', 'alias', 'project').get(pk=pk)
    except Port.DoesNotExist:
        return JsonResponse({"error": "Port not found"}, status=404)

    if request.method == "GET":
        # Check if user has access to this port's project
        if user and user.is_authenticated:
            from core.permissions import has_project_access
            if port.project and not has_project_access(user, port.project):
                return JsonResponse({"error": "Permission denied"}, status=403)

        try:
            serializer = PortSerializer(port)
            return JsonResponse(serializer.data)
        except Exception as e:
            logger.exception("Error fetching port detail")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method in ["PUT", "PATCH"]:
        # Update port
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if port.storage.customer and not can_edit_customer_infrastructure(user, port.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to update ports. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            data = json.loads(request.body)

            # Optimistic locking - check version
            client_version = data.get('version')
            if client_version is not None:
                if port.version != client_version:
                    return JsonResponse({
                        "error": "Conflict",
                        "message": f"This port was modified by {port.last_modified_by.username if port.last_modified_by else 'another user'}. Please reload and try again.",
                        "current_version": port.version,
                        "last_modified_by": port.last_modified_by.username if port.last_modified_by else None,
                        "last_modified_at": port.last_modified_at.isoformat() if port.last_modified_at else None
                    }, status=409)

            serializer = PortSerializer(port, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                port_instance = serializer.save()
                # Set last_modified_by and increment version
                if user:
                    port_instance.last_modified_by = user
                port_instance.version += 1
                update_fields = ['version']
                if user:
                    update_fields.append('last_modified_by')
                port_instance.save(update_fields=update_fields)

                return JsonResponse(serializer.data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            logger.exception("Error updating port")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        # Delete port
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if port.storage.customer and not can_edit_customer_infrastructure(user, port.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to delete ports. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            port.delete()
            return JsonResponse({"message": "Port deleted successfully"}, status=204)
        except Exception as e:
            logger.exception("Error deleting port")
            return JsonResponse({"error": str(e)}, status=500)