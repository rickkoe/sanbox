import json
import os
import requests
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from .models import Storage, Volume, Host, HostWwpn, Port, Pool
from .serializers import StorageSerializer, VolumeSerializer, HostSerializer, PortSerializer, StorageFieldPreferenceSerializer, PoolSerializer
import logging
from django.core.paginator import Paginator
from django.db.models import Q, Prefetch
from urllib.parse import urlencode
from core.dashboard_views import clear_dashboard_cache_for_customer
from core.models import Project, ProjectStorage, ProjectVolume, ProjectHost, ProjectPort, ProjectPool

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
            page_size = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)
            search = request.GET.get('search', '')
            ordering = request.GET.get('ordering', 'id')

            # Convert to integers with defaults
            try:
                page_number = int(page_number)
                if page_size == 'All':
                    return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)
                page_size = int(page_size)
            except (ValueError, TypeError):
                page_number = 1
                page_size = settings.DEFAULT_PAGE_SIZE

            # Enforce maximum page size
            if page_size > settings.MAX_PAGE_SIZE:
                return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

            # Build queryset with optimizations
            from django.db.models import Q, Count
            storages = Storage.objects.select_related('customer', 'created_by_project').prefetch_related(
                Prefetch('project_memberships',
                         queryset=ProjectStorage.objects.select_related('project'))
            ).all()

            # Filter by user's customer access
            # Skip filtering if user is not authenticated (for development)
            if user and user.is_authenticated:
                from core.permissions import filter_by_customer_access
                storages = filter_by_customer_access(storages, user)

            # Filter by customer if provided
            if customer_id:
                storages = storages.filter(customer=customer_id)

            # Customer View filtering: Show storage systems that are either:
            # 1. Committed (committed=True), OR
            # 2. Not referenced by any project (no junction table entries)
            storages = storages.annotate(
                project_count=Count('project_memberships')  # Correct relationship name
            ).filter(
                Q(committed=True) | Q(project_count=0)
            )
            
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

            # Get active project ID from query params (for bulk modal)
            project_id = request.GET.get('project_id') or request.GET.get('project')
            context = {}
            if project_id:
                context['active_project_id'] = int(project_id)

            # Create paginator
            paginator = Paginator(storages, page_size)

            # Get the requested page
            try:
                page_obj = paginator.get_page(page_number)
            except:
                page_obj = paginator.get_page(1)

            # Serialize the page data
            serializer = StorageSerializer(page_obj.object_list, many=True, context=context)
            
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
            active_project_id = data.get("active_project_id")

            # Remove read-only fields that shouldn't be in the POST data
            readonly_fields = ['db_volumes_count', 'db_hosts_count', 'db_aliases_count',
                              'db_ports_count', 'project_memberships', 'in_active_project',
                              'saved', 'modified_fields', 'project_action', '_selected',
                              'active_project_id']
            for field in readonly_fields:
                data.pop(field, None)

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

            # Get project if creating in Project View
            project = None
            if active_project_id:
                try:
                    project = Project.objects.get(id=active_project_id)
                except Project.DoesNotExist:
                    return JsonResponse({"error": "Project not found"}, status=404)

            # Check if storage exists (update) or needs to be created
            is_new = False
            try:
                storage = Storage.objects.get(customer=customer_id, name=name)
                serializer = StorageSerializer(storage, data=data)
            except Storage.DoesNotExist:
                serializer = StorageSerializer(data=data)
                is_new = True

            if serializer.is_valid():
                # For new storage in Project View, set project-specific fields
                if is_new and project:
                    storage_instance = serializer.save(
                        committed=False,
                        deployed=False,
                        created_by_project=project
                    )
                else:
                    storage_instance = serializer.save()

                logger.info(f"Storage created/updated: {storage_instance.id} - {storage_instance.name}")

                # Set last_modified_by and imported timestamp
                if user:
                    storage_instance.last_modified_by = user
                storage_instance.imported = timezone.now()
                update_fields = ['imported']
                if user:
                    update_fields.append('last_modified_by')
                storage_instance.save(update_fields=update_fields)

                # For new storage in Project View, create junction table entry
                if is_new and project:
                    ProjectStorage.objects.create(
                        project=project,
                        storage=storage_instance,
                        action='new',
                        added_by=user,
                        notes='Auto-created with storage'
                    )
                    logger.info(f"Created ProjectStorage entry for storage {storage_instance.id} in project {project.id}")

                # Clear dashboard cache when storage is created/updated
                if storage_instance.customer_id:
                    clear_dashboard_cache_for_customer(storage_instance.customer_id)

                # Re-fetch to get fresh data for serialization
                storage_instance.refresh_from_db()
                response_serializer = StorageSerializer(storage_instance)
                return JsonResponse(response_serializer.data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            logger.exception(f"Error in storage POST: {str(e)}")
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
@require_http_methods(["GET", "POST"])
def storage_field_preferences(request, pk):
    """Handle storage detail field preferences for a specific storage system"""
    print(f"🔥 Storage Field Preferences - Method: {request.method}, Storage PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    if not user:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        storage = Storage.objects.get(pk=pk)
    except Storage.DoesNotExist:
        return JsonResponse({"error": "Storage not found"}, status=404)

    # Check if user has access to this storage's customer
    from core.permissions import has_customer_access
    if storage.customer and not has_customer_access(user, storage.customer):
        return JsonResponse({"error": "Permission denied"}, status=403)

    customer = storage.customer

    if request.method == "GET":
        # Get field preferences for this user and customer
        try:
            preferences = StorageFieldPreferenceSerializer.get_preferences(customer, user)
            return JsonResponse(preferences)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "POST":
        # Save field preferences for this user and customer
        try:
            data = json.loads(request.body)
            serializer = StorageFieldPreferenceSerializer(data=data)

            if serializer.is_valid():
                config = serializer.save(customer, user)
                return JsonResponse({
                    "message": "Preferences saved successfully",
                    "visible_columns": config.visible_columns
                })
            return JsonResponse(serializer.errors, status=400)
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


def _handle_volume_create(request):
    """Create a new volume."""
    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)

        # Validate required fields
        storage_id = data.get('storage')
        if not storage_id:
            return JsonResponse({"error": "Storage system is required"}, status=400)

        # Get the storage system
        try:
            storage = Storage.objects.select_related('customer').get(pk=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({"error": "Storage system not found"}, status=404)

        # Check permissions
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if storage.customer and not can_edit_customer_infrastructure(user, storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to create volumes. Only members and admins can modify infrastructure."
                }, status=403)

        # Get active project ID if provided
        active_project_id = data.pop('active_project_id', None)

        # Create the volume
        print(f"📝 Creating volume with data: {data}")
        serializer = VolumeSerializer(data=data)
        if serializer.is_valid():
            volume = serializer.save()
            if user:
                volume.last_modified_by = user

            # If created in project context, add to project and mark as uncommitted
            if active_project_id:
                from core.models import Project, ProjectVolume
                try:
                    project = Project.objects.get(pk=active_project_id)
                    # Create the junction record
                    ProjectVolume.objects.create(
                        project=project,
                        volume=volume,
                        action='new'
                    )
                    # Mark volume as created by this project and uncommitted
                    volume.created_by_project = project
                    volume.committed = False
                    volume.save(update_fields=['last_modified_by', 'created_by_project', 'committed'] if user else ['created_by_project', 'committed'])
                    print(f"✅ Volume created and added to project {project.name}")
                except Project.DoesNotExist:
                    print(f"⚠️ Project {active_project_id} not found, volume created without project")
                    if user:
                        volume.save(update_fields=['last_modified_by'])
            else:
                if user:
                    volume.save(update_fields=['last_modified_by'])

            print(f"✅ Volume created successfully: {volume.id}")
            return JsonResponse(serializer.data, status=201)
        print(f"❌ Volume serializer errors: {serializer.errors}")
        return JsonResponse(serializer.errors, status=400)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def volume_list(request):
    """Return volumes filtered by storage system ID (optional) or customer with pagination and filtering."""
    print(f"🔥 Volume List - Method: {request.method}")

    if request.method == "POST":
        return _handle_volume_create(request)

    user = request.user if request.user.is_authenticated else None

    try:
        system_id = request.GET.get("storage_system_id")
        storage_id = request.GET.get("storage_id")
        customer_id = request.GET.get("customer")

        # Get query parameters
        search = request.GET.get('search', '').strip()
        ordering = request.GET.get('ordering', 'name')

        # Base queryset with optimizations
        from django.db.models import Q, Count
        volumes = Volume.objects.select_related('storage', 'created_by_project').prefetch_related(
            Prefetch('project_memberships',
                     queryset=ProjectVolume.objects.select_related('project'))
        ).all()

        # Filter by user's customer access
        if user and user.is_authenticated:
            from core.permissions import filter_by_customer_access
            # Filter through storage relationship
            accessible_storages = filter_by_customer_access(
                Storage.objects.all(), user
            ).values_list('id', flat=True)
            volumes = volumes.filter(storage_id__in=accessible_storages)

        # Filter by storage system ID (legacy parameter)
        if system_id:
            volumes = volumes.filter(storage__storage_system_id=system_id)

        # Filter by storage ID (direct FK)
        if storage_id:
            volumes = volumes.filter(storage_id=storage_id)

        # Filter by customer
        if customer_id:
            volumes = volumes.filter(storage__customer_id=customer_id)

        # Customer View filtering: Show volumes that are either:
        # 1. Committed (committed=True), OR
        # 2. Not referenced by any project (no junction table entries)
        volumes = volumes.annotate(
            project_count=Count('project_memberships')  # Correct relationship name
        ).filter(
            Q(committed=True) | Q(project_count=0)
        )
        
        # Apply general search if provided
        if search:
            volumes = volumes.filter(
                Q(name__icontains=search) |
                Q(storage__name__icontains=search) |
                Q(volume_id__icontains=search) |
                Q(volser__icontains=search) |
                Q(format__icontains=search) |
                Q(natural_key__icontains=search) |
                Q(pool__name__icontains=search) |
                Q(unique_id__icontains=search) |
                Q(status_label__icontains=search)
            )
        
        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith((
                'name__', 'storage__', 'volume_id__', 'volume_number__', 'volser__', 'format__',
                'natural_key__', 'pool__', 'lss_lcu__', 'node__', 'block_size__',
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
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        # Handle "All" - not supported
        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        # Enforce maximum page size
        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        # Apply pagination
        paginator = Paginator(volumes, page_size)
        page_obj = paginator.get_page(page)

        # Get active project ID from query params (for bulk modal)
        project_id = request.GET.get('project_id') or request.GET.get('project')

        # Serialize paginated results with context
        context = {}
        if project_id:
            context['active_project_id'] = int(project_id)
        serializer = VolumeSerializer(page_obj, many=True, context=context)

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
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def volume_detail(request, pk):
    """Handle volume detail operations."""
    print(f"🔥 Volume Detail - Method: {request.method}, PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        volume = Volume.objects.select_related('storage', 'storage__customer', 'pool').get(pk=pk)
    except Volume.DoesNotExist:
        return JsonResponse({"error": "Volume not found"}, status=404)

    if request.method == "GET":
        # Check if user has access to this volume's customer
        if user and user.is_authenticated:
            from core.permissions import has_customer_access
            if volume.storage.customer and not has_customer_access(user, volume.storage.customer):
                return JsonResponse({"error": "Permission denied"}, status=403)

        try:
            serializer = VolumeSerializer(volume)
            return JsonResponse(serializer.data)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method in ["PUT", "PATCH"]:
        # Update volume
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if volume.storage.customer and not can_edit_customer_infrastructure(user, volume.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to update volumes. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            data = json.loads(request.body)

            # Optimistic locking - check version
            client_version = data.get('version')
            if client_version is not None:
                if volume.version != client_version:
                    return JsonResponse({
                        "error": "Conflict",
                        "message": f"This volume was modified by {volume.last_modified_by.username if volume.last_modified_by else 'another user'}. Please reload and try again.",
                        "current_version": volume.version,
                        "last_modified_by": volume.last_modified_by.username if volume.last_modified_by else None,
                        "last_modified_at": volume.last_modified_at.isoformat() if volume.last_modified_at else None
                    }, status=409)

            serializer = VolumeSerializer(volume, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                volume_instance = serializer.save()
                # Set last_modified_by and increment version
                if user:
                    volume_instance.last_modified_by = user
                volume_instance.version += 1
                volume_instance.updated = timezone.now()
                update_fields = ['version', 'updated']
                if user:
                    update_fields.append('last_modified_by')
                volume_instance.save(update_fields=update_fields)

                return JsonResponse(serializer.data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        # Delete volume
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if volume.storage.customer and not can_edit_customer_infrastructure(user, volume.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to delete volumes. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            volume.delete()
            return JsonResponse({"message": "Volume deleted successfully"}, status=204)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def host_list(request):
    """Handle host list and creation operations."""
    print(f"🔥 Host List - Method: {request.method}")

    user = request.user if request.user.is_authenticated else None

    if request.method == "GET":
        return _handle_host_list_get(request, user)
    elif request.method == "POST":
        return _handle_host_create(request, user)


def _handle_host_list_get(request, user):
    """Return hosts filtered by customer's storage systems with pagination and filtering."""
    try:
        customer_id = request.GET.get("customer")
        storage_id = request.GET.get("storage_id")

        # Get query parameters
        search = request.GET.get('search', '').strip()
        ordering = request.GET.get('ordering', 'name')

        # Base queryset with optimizations
        from django.db.models import Q, Count
        hosts = Host.objects.select_related('storage', 'storage__customer', 'created_by_project').prefetch_related(
            Prefetch('project_memberships',
                     queryset=ProjectHost.objects.select_related('project'))
        ).all()

        # Filter by user's customer access
        if user and user.is_authenticated:
            from core.permissions import filter_by_customer_access
            # Filter through storage relationship
            accessible_storages = filter_by_customer_access(
                Storage.objects.all(), user
            ).values_list('id', flat=True)
            hosts = hosts.filter(storage_id__in=accessible_storages)

        # Filter by customer if provided
        if customer_id:
            hosts = hosts.filter(storage__customer_id=customer_id)

        # Filter by specific storage if provided
        if storage_id:
            hosts = hosts.filter(storage_id=storage_id)

        # Customer View filtering: Show hosts that are either:
        # 1. Committed (committed=True), OR
        # 2. Not referenced by any project (no junction table entries)
        hosts = hosts.annotate(
            project_count=Count('project_memberships')  # Correct relationship name
        ).filter(
            Q(committed=True) | Q(project_count=0)
        )

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
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        # Handle "All" - not supported
        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        # Enforce maximum page size
        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        # Apply pagination
        paginator = Paginator(hosts, page_size)
        page_obj = paginator.get_page(page)

        # Get active project ID from query params (for bulk modal)
        project_id = request.GET.get('project_id') or request.GET.get('project')

        # Serialize paginated results with context
        context = {}
        if project_id:
            context['active_project_id'] = int(project_id)
        serializer = HostSerializer(page_obj, many=True, context=context)

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


def _handle_host_create(request, user):
    """Create or update a host."""
    try:
        data = json.loads(request.body)
        storage_id = data.get("storage")
        name = data.get("name")
        active_project_id = data.get("active_project_id")

        if not storage_id or not name:
            return JsonResponse({"error": "storage and name are required"}, status=400)

        # Remove read-only fields that shouldn't be in the POST data
        readonly_fields = ['project_memberships', 'in_active_project', 'saved',
                          'modified_fields', 'project_action', '_selected', 'active_project_id']
        for field in readonly_fields:
            data.pop(field, None)

        # Check if user can modify infrastructure for this customer
        if user:
            from core.permissions import can_edit_customer_infrastructure
            try:
                storage = Storage.objects.get(id=storage_id)
                if storage.customer and not can_edit_customer_infrastructure(user, storage.customer):
                    return JsonResponse({
                        "error": "You do not have permission to create/update hosts. Only members and admins can modify infrastructure."
                    }, status=403)
            except Storage.DoesNotExist:
                return JsonResponse({"error": "Storage system not found"}, status=404)

        # Get project if creating in Project View
        project = None
        if active_project_id:
            try:
                project = Project.objects.get(id=active_project_id)
            except Project.DoesNotExist:
                return JsonResponse({"error": "Project not found"}, status=404)

        # Check if host exists (update) or needs to be created
        is_new = False
        try:
            # Try to find existing host by name and storage
            host = Host.objects.get(name=name, storage=storage)
            serializer = HostSerializer(host, data=data)
        except Host.DoesNotExist:
            # Create new host
            serializer = HostSerializer(data=data)
            is_new = True

        if serializer.is_valid():
            # For new host in Project View, set project-specific fields
            if is_new and project:
                host_instance = serializer.save(
                    committed=False,
                    deployed=False,
                    created_by_project=project
                )
            else:
                host_instance = serializer.save()

            # Set last_modified_by and imported timestamp
            if user:
                host_instance.last_modified_by = user
            host_instance.imported = timezone.now()
            update_fields = ['imported']
            if user:
                update_fields.append('last_modified_by')
            host_instance.save(update_fields=update_fields)

            # For new host in Project View, create junction table entry
            if is_new and project:
                ProjectHost.objects.create(
                    project=project,
                    host=host_instance,
                    action='new',
                    added_by=user,
                    notes='Auto-created with host'
                )
                logger.info(f"Created ProjectHost entry for host {host_instance.id} in project {project.id}")

            # Re-fetch to get fresh data for serialization
            host_instance.refresh_from_db()
            response_serializer = HostSerializer(host_instance)
            return JsonResponse(response_serializer.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    except Exception as e:
        logger.exception(f"Error in host POST: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def host_detail(request, pk):
    """Handle host detail operations."""
    print(f"🔥 Host Detail - Method: {request.method}, PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        host = Host.objects.select_related('storage', 'storage__customer').get(pk=pk)
    except Host.DoesNotExist:
        return JsonResponse({"error": "Host not found"}, status=404)

    if request.method == "GET":
        # Check if user has access to this host's customer
        if user and user.is_authenticated:
            from core.permissions import has_customer_access
            if host.storage.customer and not has_customer_access(user, host.storage.customer):
                return JsonResponse({"error": "Permission denied"}, status=403)

        try:
            serializer = HostSerializer(host)
            return JsonResponse(serializer.data)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method in ["PUT", "PATCH"]:
        # Update host
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if host.storage.customer and not can_edit_customer_infrastructure(user, host.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to update hosts. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            data = json.loads(request.body)

            # Optimistic locking - check version
            client_version = data.get('version')
            if client_version is not None:
                if host.version != client_version:
                    return JsonResponse({
                        "error": "Conflict",
                        "message": f"This host was modified by {host.last_modified_by.username if host.last_modified_by else 'another user'}. Please reload and try again.",
                        "current_version": host.version,
                        "last_modified_by": host.last_modified_by.username if host.last_modified_by else None,
                        "last_modified_at": host.last_modified_at.isoformat() if host.last_modified_at else None
                    }, status=409)

            serializer = HostSerializer(host, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                host_instance = serializer.save()
                # Set last_modified_by and increment version
                if user:
                    host_instance.last_modified_by = user
                host_instance.version += 1
                host_instance.updated = timezone.now()
                update_fields = ['version', 'updated']
                if user:
                    update_fields.append('last_modified_by')
                host_instance.save(update_fields=update_fields)

                return JsonResponse(serializer.data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        # Delete host
        if user:
            from core.permissions import can_edit_customer_infrastructure
            if host.storage.customer and not can_edit_customer_infrastructure(user, host.storage.customer):
                return JsonResponse({
                    "error": "You do not have permission to delete hosts. Only members and admins can modify infrastructure."
                }, status=403)

        try:
            host.delete()
            return JsonResponse({"message": "Host deleted successfully"}, status=204)
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
@require_http_methods(["GET"])
def mkhost_scripts_project_view(request, project_id):
    """Generate mkhost scripts for storage systems in a project."""
    print(f"🔥 MkHost Scripts (Project) - Method: {request.method}, Project ID: {project_id}")

    try:
        from core.models import Project, ProjectStorage
        from .storage_utils import generate_mkhost_scripts

        # Get project
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found"}, status=404)

        # Get storage systems that are in this project via junction table
        storage_ids = ProjectStorage.objects.filter(project=project).values_list('storage_id', flat=True)
        storage_systems = Storage.objects.filter(id__in=storage_ids).order_by('name')

        if not storage_systems.exists():
            return JsonResponse({
                "storage_scripts": {},
                "message": "No storage systems found for this project"
            })

        # Generate scripts using utility function with project filter
        storage_scripts = generate_mkhost_scripts(storage_systems, project=project)

        return JsonResponse({
            "storage_scripts": storage_scripts,
            "total_storage_systems": len(storage_scripts)
        })

    except Exception as e:
        print(f"❌ Error generating mkhost scripts for project: {e}")
        import traceback
        traceback.print_exc()
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
            page_size = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)
            search = request.GET.get('search', '')
            ordering = request.GET.get('ordering', 'id')

            # Convert to integers with defaults
            try:
                page_number = int(page_number)
                if page_size == 'All':
                    return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)
                page_size = int(page_size)
            except (ValueError, TypeError):
                page_number = 1
                page_size = settings.DEFAULT_PAGE_SIZE

            # Enforce maximum page size
            if page_size > settings.MAX_PAGE_SIZE:
                return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

            # Build queryset with optimizations
            from django.db.models import Q, Count
            ports = Port.objects.select_related('storage', 'fabric', 'alias', 'project', 'created_by_project').prefetch_related(
                Prefetch('project_memberships',
                         queryset=ProjectPort.objects.select_related('project'))
            ).all()

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

            # Customer View filtering: Show ports that are either:
            # 1. Committed (committed=True), OR
            # 2. Not referenced by any project (no junction table entries)
            ports = ports.annotate(
                project_count=Count('project_ports')  # Correct relationship name
            ).filter(
                Q(committed=True) | Q(project_count=0)
            )

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

            # Get active project ID from query params (for bulk modal)
            project_id = request.GET.get('project_id') or request.GET.get('project')
            context = {}
            if project_id:
                context['active_project_id'] = int(project_id)

            # Handle "All" page size
            if page_size is None:
                serializer = PortSerializer(ports, many=True, context=context)
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
            serializer = PortSerializer(page_obj.object_list, many=True, context=context)

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


@csrf_exempt
@require_http_methods(["GET"])
def storage_project_view(request, project_id):
    """
    Get storage systems in project with field_overrides applied (merged view).
    Returns only storage systems in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Supports project_filter parameter:
    - 'current': Only storage in the project (default)
    - 'all': All customer storage with in_active_project flag
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get project filter parameter
    project_filter = request.GET.get('project_filter', 'current')

    # Get project storage IDs for membership checking
    project_storage_ids = set(ProjectStorage.objects.filter(
        project=project
    ).values_list('storage_id', flat=True))

    if project_filter == 'all' and customer:
        # Return ALL customer storage with in_active_project flag
        all_storage = Storage.objects.filter(
            customer=customer
        ).select_related(
            'customer'
        ).prefetch_related(
            Prefetch('project_memberships',
                     queryset=ProjectStorage.objects.select_related('project'))
        )

        # ===== PAGINATION =====
        page = int(request.GET.get('page', 1))
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        paginator = Paginator(all_storage, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            storage_page = page_obj.object_list
        except:
            storage_page = []

        merged_data = []

        for storage in storage_page:
            base_data = StorageSerializer(storage).data
            in_project = storage.id in project_storage_ids

            # If in project, get overrides
            modified_fields = []
            if in_project:
                try:
                    ps = ProjectStorage.objects.get(project=project, storage=storage)
                    if ps.field_overrides:
                        for field_name, override_value in ps.field_overrides.items():
                            if field_name in base_data and base_data[field_name] != override_value:
                                base_data[field_name] = override_value
                                modified_fields.append(field_name)
                    base_data['project_action'] = ps.action
                except ProjectStorage.DoesNotExist:
                    pass

            base_data['modified_fields'] = modified_fields
            base_data['in_active_project'] = in_project
            merged_data.append(base_data)

        response_data = {
            'results': merged_data,
            'count': total_count,
        }

        if paginator and page_obj:
            response_data.update({
                'next': page_obj.has_next(),
                'previous': page_obj.has_previous(),
                'page': page,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            })

        return JsonResponse(response_data)

    # Default: current project only
    # Get all ProjectStorage entries for this project
    project_storages = ProjectStorage.objects.filter(
        project=project
    ).select_related(
        'storage',
        'storage__customer'
    ).prefetch_related(
        Prefetch('storage__project_memberships',
                 queryset=ProjectStorage.objects.select_related('project'))
    )

    # Get search parameter
    search = request.GET.get('search', '').strip()

    # Apply search filter if provided
    if search:
        from django.db.models import Q
        project_storages = project_storages.filter(
            Q(storage__name__icontains=search) |
            Q(storage__storage_type__icontains=search) |
            Q(storage__manufacturer__icontains=search) |
            Q(storage__model__icontains=search)
        ).distinct()

    # Apply field-specific advanced filters
    # Frontend sends params like 'name__icontains', we need to map to 'storage__name__icontains'
    filter_params = {}
    for param, value in request.GET.items():
        # Skip pagination and search params
        if param in ['page', 'page_size', 'search', 'ordering', 'customer_id', 'project_filter']:
            continue

        # Map frontend parameter to Django ORM lookup through junction table
        mapped_param = None

        # Special handling for project_action - this is on the junction table itself, not the entity
        if param.startswith('project_action__'):
            # Map project_action to action (the field name on ProjectStorage)
            mapped_param = param.replace('project_action', 'action')
            # __in lookup requires a list, even for single values
            if mapped_param.endswith('__in'):
                filter_params[mapped_param] = [v.strip() for v in value.split(',')] if isinstance(value, str) else value
            else:
                filter_params[mapped_param] = value
        elif param.startswith(('name__', 'storage_type__', 'manufacturer__', 'model__')):
            mapped_param = f'storage__{param}'

            # Handle filters
            if mapped_param.endswith('__in') and isinstance(value, str) and ',' in value:
                filter_params[mapped_param] = value.split(',')
            else:
                filter_params[mapped_param] = value

    # Apply filters to queryset
    if filter_params:
        project_storages = project_storages.filter(**filter_params)

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

    # Handle "All" - not supported
    if page_size_param == 'All':
        return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

    page_size = int(page_size_param)

    # Enforce maximum page size
    if page_size > settings.MAX_PAGE_SIZE:
        return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

    paginator = Paginator(project_storages, page_size)
    total_count = paginator.count

    try:
        page_obj = paginator.get_page(page)
        project_storages_page = page_obj.object_list
    except:
        project_storages_page = []

    merged_data = []

    for ps in project_storages_page:
        # Serialize base storage
        base_data = StorageSerializer(ps.storage).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if ps.field_overrides:
            for field_name, override_value in ps.field_overrides.items():
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = ps.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    if paginator and page_obj:
        response_data.update({
            'next': page_obj.has_next(),
            'previous': page_obj.has_previous(),
            'page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def volume_project_view(request, project_id):
    """
    Get volumes in project with field_overrides applied (merged view).
    Returns only volumes in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Supports project_filter parameter:
    - 'current': Only volumes in the project (default)
    - 'all': All customer volumes with in_active_project flag
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get project filter parameter
    project_filter = request.GET.get('project_filter', 'current')

    # Get project volume IDs for membership checking
    project_volume_ids = set(ProjectVolume.objects.filter(
        project=project
    ).values_list('volume_id', flat=True))

    if project_filter == 'all' and customer:
        # Return ALL customer volumes with in_active_project flag
        # Get customer storage IDs first
        customer_storage_ids = Storage.objects.filter(customer=customer).values_list('id', flat=True)

        all_volumes = Volume.objects.filter(
            storage_id__in=customer_storage_ids
        ).select_related(
            'storage',
            'storage__customer'
        ).prefetch_related(
            Prefetch('project_memberships',
                     queryset=ProjectVolume.objects.select_related('project'))
        )

        # ===== PAGINATION =====
        page = int(request.GET.get('page', 1))
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        paginator = Paginator(all_volumes, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            volumes_page = page_obj.object_list
        except:
            volumes_page = []

        merged_data = []

        for volume in volumes_page:
            base_data = VolumeSerializer(volume).data
            in_project = volume.id in project_volume_ids

            # If in project, get overrides
            modified_fields = []
            if in_project:
                try:
                    pv = ProjectVolume.objects.get(project=project, volume=volume)
                    if pv.field_overrides:
                        for field_name, override_value in pv.field_overrides.items():
                            if field_name in base_data and base_data[field_name] != override_value:
                                base_data[field_name] = override_value
                                modified_fields.append(field_name)
                    base_data['project_action'] = pv.action
                except ProjectVolume.DoesNotExist:
                    pass

            base_data['modified_fields'] = modified_fields
            base_data['in_active_project'] = in_project
            merged_data.append(base_data)

        response_data = {
            'results': merged_data,
            'count': total_count,
        }

        if paginator and page_obj:
            response_data.update({
                'next': page_obj.has_next(),
                'previous': page_obj.has_previous(),
                'page': page,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            })

        return JsonResponse(response_data)

    # Default: current project only
    # Get all ProjectVolume entries for this project
    project_volumes = ProjectVolume.objects.filter(
        project=project
    ).select_related(
        'volume',
        'volume__storage',
        'volume__storage__customer'
    ).prefetch_related(
        Prefetch('volume__project_memberships',
                 queryset=ProjectVolume.objects.select_related('project'))
    )

    # Get search parameter
    search = request.GET.get('search', '').strip()

    # Apply search filter if provided
    if search:
        from django.db.models import Q
        project_volumes = project_volumes.filter(
            Q(volume__name__icontains=search) |
            Q(volume__storage__name__icontains=search) |
            Q(volume__volume_type__icontains=search)
        ).distinct()

    # Apply field-specific advanced filters
    # Frontend sends params like 'name__icontains', we need to map to 'volume__name__icontains'
    filter_params = {}
    for param, value in request.GET.items():
        # Skip pagination and search params
        if param in ['page', 'page_size', 'search', 'ordering', 'customer_id', 'project_filter']:
            continue

        # Map frontend parameter to Django ORM lookup through junction table
        mapped_param = None

        # Special handling for project_action - this is on the junction table itself, not the entity
        if param.startswith('project_action__'):
            # Map project_action to action (the field name on ProjectVolume)
            mapped_param = param.replace('project_action', 'action')
            # __in lookup requires a list, even for single values
            if mapped_param.endswith('__in'):
                filter_params[mapped_param] = [v.strip() for v in value.split(',')] if isinstance(value, str) else value
            else:
                filter_params[mapped_param] = value
        elif param.startswith(('name__', 'volume_type__')):
            mapped_param = f'volume__{param}'
        elif param.startswith('storage_name__'):
            # Map storage_name to storage__name for Django ORM
            mapped_param = param.replace('storage_name', 'volume__storage__name')
        elif param.startswith('storage__name__'):
            mapped_param = param.replace('storage__name', 'volume__storage__name')

        if mapped_param:
            # Handle filters
            if mapped_param.endswith('__in') and isinstance(value, str) and ',' in value:
                filter_params[mapped_param] = value.split(',')
            else:
                filter_params[mapped_param] = value

    # Apply filters to queryset
    if filter_params:
        project_volumes = project_volumes.filter(**filter_params)

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

    # Handle "All" - not supported
    if page_size_param == 'All':
        return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

    page_size = int(page_size_param)

    # Enforce maximum page size
    if page_size > settings.MAX_PAGE_SIZE:
        return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

    paginator = Paginator(project_volumes, page_size)
    total_count = paginator.count

    try:
        page_obj = paginator.get_page(page)
        project_volumes_page = page_obj.object_list
    except:
        project_volumes_page = []

    merged_data = []

    for pv in project_volumes_page:
        # Serialize base volume
        base_data = VolumeSerializer(pv.volume).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pv.field_overrides:
            for field_name, override_value in pv.field_overrides.items():
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pv.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    if paginator and page_obj:
        response_data.update({
            'next': page_obj.has_next(),
            'previous': page_obj.has_previous(),
            'page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def host_project_view(request, project_id):
    """
    Get hosts in project with field_overrides applied (merged view).
    Returns only hosts in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Supports project_filter parameter:
    - 'current': Only hosts in the project (default)
    - 'all': All customer hosts with in_active_project flag
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get project filter parameter
    project_filter = request.GET.get('project_filter', 'current')

    # Get project host IDs for membership checking
    project_host_ids = set(ProjectHost.objects.filter(
        project=project
    ).values_list('host_id', flat=True))

    if project_filter == 'all' and customer:
        # Return ALL customer hosts with in_active_project flag
        # Get customer storage IDs first
        customer_storage_ids = Storage.objects.filter(customer=customer).values_list('id', flat=True)

        all_hosts = Host.objects.filter(
            storage_id__in=customer_storage_ids
        ).select_related(
            'storage',
            'storage__customer'
        ).prefetch_related(
            'host_wwpns',
            Prefetch('project_memberships',
                     queryset=ProjectHost.objects.select_related('project'))
        )

        # ===== PAGINATION =====
        page = int(request.GET.get('page', 1))
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        paginator = Paginator(all_hosts, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            hosts_page = page_obj.object_list
        except:
            hosts_page = []

        merged_data = []

        for host in hosts_page:
            base_data = HostSerializer(host).data
            in_project = host.id in project_host_ids

            # If in project, get overrides
            modified_fields = []
            if in_project:
                try:
                    ph = ProjectHost.objects.get(project=project, host=host)
                    if ph.field_overrides:
                        for field_name, override_value in ph.field_overrides.items():
                            if field_name in base_data and base_data[field_name] != override_value:
                                base_data[field_name] = override_value
                                modified_fields.append(field_name)
                    base_data['project_action'] = ph.action
                except ProjectHost.DoesNotExist:
                    pass

            base_data['modified_fields'] = modified_fields
            base_data['in_active_project'] = in_project
            merged_data.append(base_data)

        response_data = {
            'results': merged_data,
            'count': total_count,
        }

        if paginator and page_obj:
            response_data.update({
                'next': page_obj.has_next(),
                'previous': page_obj.has_previous(),
                'page': page,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            })

        return JsonResponse(response_data)

    # Default: current project only
    # Get all ProjectHost entries for this project
    project_hosts = ProjectHost.objects.filter(
        project=project
    ).select_related(
        'host',
        'host__storage',
        'host__storage__customer'
    ).prefetch_related(
        'host__host_wwpns',
        Prefetch('host__project_memberships',
                 queryset=ProjectHost.objects.select_related('project'))
    )

    # Get search parameter
    search = request.GET.get('search', '').strip()

    # Apply search filter if provided
    if search:
        from django.db.models import Q
        project_hosts = project_hosts.filter(
            Q(host__name__icontains=search) |
            Q(host__status__icontains=search) |
            Q(host__host_type__icontains=search) |
            Q(host__storage__name__icontains=search)
        ).distinct()

    # Apply field-specific advanced filters
    # Frontend sends params like 'name__icontains', we need to map to 'host__name__icontains'
    filter_params = {}
    for param, value in request.GET.items():
        # Skip pagination and search params
        if param in ['page', 'page_size', 'search', 'ordering', 'customer_id', 'project_filter']:
            continue

        # Map frontend parameter to Django ORM lookup through junction table
        mapped_param = None

        # Special handling for project_action - this is on the junction table itself, not the entity
        if param.startswith('project_action__'):
            # Map project_action to action (the field name on ProjectHost)
            mapped_param = param.replace('project_action', 'action')
            # __in lookup requires a list, even for single values
            if mapped_param.endswith('__in'):
                filter_params[mapped_param] = [v.strip() for v in value.split(',')] if isinstance(value, str) else value
            else:
                filter_params[mapped_param] = value
        elif param.startswith(('name__', 'status__', 'host_type__', 'storage_name__', 'storage__name__')):
            # Map storage_name to storage__name for Django ORM
            if param.startswith('storage_name'):
                mapped_param = param.replace('storage_name', 'host__storage__name')
            elif param.startswith('storage__name'):
                mapped_param = param.replace('storage__name', 'host__storage__name')
            else:
                mapped_param = f'host__{param}'

            # Handle regular string filters
            if mapped_param.endswith('__in') and isinstance(value, str) and ',' in value:
                filter_params[mapped_param] = value.split(',')
            else:
                filter_params[mapped_param] = value

    # Apply filters to queryset
    if filter_params:
        project_hosts = project_hosts.filter(**filter_params)

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

    # Handle "All" - not supported
    if page_size_param == 'All':
        return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

    page_size = int(page_size_param)

    # Enforce maximum page size
    if page_size > settings.MAX_PAGE_SIZE:
        return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

    paginator = Paginator(project_hosts, page_size)
    total_count = paginator.count

    try:
        page_obj = paginator.get_page(page)
        project_hosts_page = page_obj.object_list
    except:
        project_hosts_page = []

    merged_data = []

    for ph in project_hosts_page:
        # Serialize base host
        base_data = HostSerializer(ph.host).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if ph.field_overrides:
            for field_name, override_value in ph.field_overrides.items():
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = ph.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    if paginator and page_obj:
        response_data.update({
            'next': page_obj.has_next(),
            'previous': page_obj.has_previous(),
            'page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def port_project_view(request, project_id):
    """
    Get ports in project with field_overrides applied (merged view).
    Returns only ports in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Supports project_filter parameter:
    - 'current': Only ports in the project (default)
    - 'all': All customer ports with in_active_project flag
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get project filter parameter
    project_filter = request.GET.get('project_filter', 'current')

    # Get project port IDs for membership checking
    project_port_ids = set(ProjectPort.objects.filter(
        project=project
    ).values_list('port_id', flat=True))

    if project_filter == 'all' and customer:
        # Return ALL customer ports with in_active_project flag
        # Get customer storage IDs first
        customer_storage_ids = Storage.objects.filter(customer=customer).values_list('id', flat=True)

        all_ports = Port.objects.filter(
            storage_id__in=customer_storage_ids
        ).select_related(
            'storage',
            'fabric',
            'alias',
            'project'
        ).prefetch_related(
            Prefetch('project_memberships',
                     queryset=ProjectPort.objects.select_related('project'))
        )

        # ===== PAGINATION =====
        page = int(request.GET.get('page', 1))
        page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

        if page_size_param == 'All':
            return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

        page_size = int(page_size_param)

        if page_size > settings.MAX_PAGE_SIZE:
            return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

        paginator = Paginator(all_ports, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            ports_page = page_obj.object_list
        except:
            ports_page = []

        merged_data = []

        for port in ports_page:
            base_data = PortSerializer(port).data
            in_project = port.id in project_port_ids

            # If in project, get overrides
            modified_fields = []
            if in_project:
                try:
                    pp = ProjectPort.objects.get(project=project, port=port)
                    if pp.field_overrides:
                        for field_name, override_value in pp.field_overrides.items():
                            if field_name in base_data and base_data[field_name] != override_value:
                                base_data[field_name] = override_value
                                modified_fields.append(field_name)
                    base_data['project_action'] = pp.action
                except ProjectPort.DoesNotExist:
                    pass

            base_data['modified_fields'] = modified_fields
            base_data['in_active_project'] = in_project
            merged_data.append(base_data)

        response_data = {
            'results': merged_data,
            'count': total_count,
        }

        if paginator and page_obj:
            response_data.update({
                'next': page_obj.has_next(),
                'previous': page_obj.has_previous(),
                'page': page,
                'page_size': page_size,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            })

        return JsonResponse(response_data)

    # Default: current project only
    # Get all ProjectPort entries for this project
    project_ports = ProjectPort.objects.filter(
        project=project
    ).select_related(
        'port',
        'port__storage',
        'port__fabric',
        'port__alias',
        'port__project'
    ).prefetch_related(
        Prefetch('port__project_memberships',
                 queryset=ProjectPort.objects.select_related('project'))
    )

    # Get search parameter
    search = request.GET.get('search', '').strip()

    # Apply search filter if provided
    if search:
        from django.db.models import Q
        project_ports = project_ports.filter(
            Q(port__wwpn__icontains=search) |
            Q(port__storage__name__icontains=search) |
            Q(port__port_type__icontains=search)
        ).distinct()

    # Apply field-specific advanced filters
    # Frontend sends params like 'wwpn__icontains', we need to map to 'port__wwpn__icontains'
    filter_params = {}
    for param, value in request.GET.items():
        # Skip pagination and search params
        if param in ['page', 'page_size', 'search', 'ordering', 'customer_id', 'project_filter']:
            continue

        # Map frontend parameter to Django ORM lookup through junction table
        mapped_param = None

        # Special handling for project_action - this is on the junction table itself, not the entity
        if param.startswith('project_action__'):
            # Map project_action to action (the field name on ProjectPort)
            mapped_param = param.replace('project_action', 'action')
            # __in lookup requires a list, even for single values
            if mapped_param.endswith('__in'):
                filter_params[mapped_param] = [v.strip() for v in value.split(',')] if isinstance(value, str) else value
            else:
                filter_params[mapped_param] = value
        elif param.startswith(('wwpn__', 'port_type__')):
            mapped_param = f'port__{param}'
        elif param.startswith('storage_name__'):
            # Map storage_name to storage__name for Django ORM
            mapped_param = param.replace('storage_name', 'port__storage__name')
        elif param.startswith('storage__name__'):
            mapped_param = param.replace('storage__name', 'port__storage__name')

        if mapped_param:
            # Handle filters
            if mapped_param.endswith('__in') and isinstance(value, str) and ',' in value:
                filter_params[mapped_param] = value.split(',')
            else:
                filter_params[mapped_param] = value

    # Apply filters to queryset
    if filter_params:
        project_ports = project_ports.filter(**filter_params)

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

    # Handle "All" - not supported
    if page_size_param == 'All':
        return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

    page_size = int(page_size_param)

    # Enforce maximum page size
    if page_size > settings.MAX_PAGE_SIZE:
        return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

    paginator = Paginator(project_ports, page_size)
    total_count = paginator.count

    try:
        page_obj = paginator.get_page(page)
        project_ports_page = page_obj.object_list
    except:
        project_ports_page = []

    merged_data = []

    for pp in project_ports_page:
        # Serialize base port
        base_data = PortSerializer(pp.port).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pp.field_overrides:
            for field_name, override_value in pp.field_overrides.items():
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pp.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    if paginator and page_obj:
        response_data.update({
            'next': page_obj.has_next(),
            'previous': page_obj.has_previous(),
            'page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data, safe=False)

# =============================================================================
# DS8000 Volume Range Management Views
# =============================================================================

@csrf_exempt
@require_http_methods(["GET"])
def volume_ranges_list(request, storage_id):
    """
    GET /api/storage/{storage_id}/volume-ranges/

    Returns calculated volume ranges for a DS8000 storage system.
    Only works for storage_type='DS8000'.

    Query params:
    - active_project_id: ID of the active project (for Draft mode)
    - project_filter: 'current' for Draft mode, anything else for Committed mode
    """
    try:
        # Validate storage exists
        try:
            storage = Storage.objects.get(id=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({'error': f'Storage system with id {storage_id} not found'}, status=404)

        # Validate it's a DS8000
        if storage.storage_type != 'DS8000':
            return JsonResponse({
                'error': f'Volume ranges are only available for DS8000 storage systems. This storage is type: {storage.storage_type}'
            }, status=400)

        # Get query params for view mode
        active_project_id = request.GET.get('active_project_id')
        project_filter = request.GET.get('project_filter', 'all')

        # Get volumes for this storage
        from django.db.models import Q, Count
        volumes = Volume.objects.filter(storage=storage).select_related('storage')

        # Apply filtering based on view mode
        if project_filter == 'current' and active_project_id:
            # Draft mode: Show committed volumes OR volumes in the active project
            volumes = volumes.filter(
                Q(committed=True) | Q(project_memberships__project_id=active_project_id)
            ).distinct()
        else:
            # Committed mode: Show only committed volumes OR orphaned volumes (not in any project)
            volumes = volumes.annotate(
                project_count=Count('project_memberships')
            ).filter(
                Q(committed=True) | Q(project_count=0)
            )

        # Calculate ranges
        from .volume_range_utils import calculate_volume_ranges
        from .storage_utils import generate_ds8000_device_id

        ranges = calculate_volume_ranges(volumes)
        device_id = generate_ds8000_device_id(storage)

        # Check if table format is requested (for TanStackCRUDTable compatibility)
        table_format = request.GET.get('table_format', 'false').lower() == 'true'

        if table_format:
            # Return in TanStackCRUDTable-compatible format
            # Add 'id' field to each range for table row identification
            for r in ranges:
                r['id'] = r['range_id']
            return JsonResponse({
                'results': ranges,
                'count': len(ranges),
                'storage_id': storage.id,
                'storage_name': storage.name,
                'storage_type': storage.storage_type,
                'device_id': device_id,
            })

        # Return original format for backwards compatibility
        return JsonResponse({
            'storage_id': storage.id,
            'storage_name': storage.name,
            'storage_type': storage.storage_type,
            'device_id': device_id,
            'ranges': ranges,
            'range_count': len(ranges),
            'total_volumes': sum(r['volume_count'] for r in ranges),
        })

    except Exception as e:
        logger.error(f"Error calculating volume ranges: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def volume_range_create(request, storage_id):
    """
    POST /api/storage/{storage_id}/volume-ranges/create/

    Creates individual Volume records for a range.
    Request body:
    {
        "start_volume": "1000",
        "end_volume": "100B",
        "format": "FB",
        "capacity_bytes": 53687091200,
        "pool_name": "P0",
        "active_project_id": 123  // optional
    }
    """
    try:
        # Validate storage exists and is DS8000
        try:
            storage = Storage.objects.get(id=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({'error': f'Storage system with id {storage_id} not found'}, status=404)

        if storage.storage_type != 'DS8000':
            return JsonResponse({
                'error': f'Volume ranges are only available for DS8000 storage systems.'
            }, status=400)

        # Parse request body
        data = json.loads(request.body)

        start_volume = data.get('start_volume', '').strip().upper()
        end_volume = data.get('end_volume', '').strip().upper()
        fmt = data.get('format', 'FB').strip().upper()
        capacity_bytes = data.get('capacity_bytes', 0)
        pool_name = data.get('pool_name', '')
        name_prefix = data.get('name_prefix', '').strip()
        active_project_id = data.get('active_project_id')

        # Look up Pool by name if provided
        pool = None
        if pool_name:
            pool = Pool.objects.filter(storage=storage, name=pool_name).first()

        # Validate the range
        from .volume_range_utils import validate_volume_range, generate_volume_ids_for_range

        is_valid, error, details = validate_volume_range(start_volume, end_volume)
        if not is_valid:
            return JsonResponse({'error': error}, status=400)

        # Validate format
        if fmt not in ['FB', 'CKD']:
            return JsonResponse({'error': f"Invalid format '{fmt}': must be 'FB' or 'CKD'"}, status=400)

        # Generate volume IDs for the range
        volume_ids = generate_volume_ids_for_range(start_volume, end_volume)

        # Check for existing volumes in this range
        existing = Volume.objects.filter(
            storage=storage,
            volume_id__in=volume_ids
        ).values_list('volume_id', flat=True)

        if existing:
            existing_list = list(existing)[:10]  # Show first 10
            more = len(existing) - 10 if len(existing) > 10 else 0
            return JsonResponse({
                'error': f"Volumes already exist in this range: {', '.join(existing_list)}" +
                         (f" and {more} more" if more else "")
            }, status=400)

        # Get project if specified
        project = None
        if active_project_id:
            try:
                project = Project.objects.get(id=active_project_id)
            except Project.DoesNotExist:
                return JsonResponse({'error': f'Project with id {active_project_id} not found'}, status=404)

        # Create volumes
        user = request.user if request.user.is_authenticated else None
        created_volumes = []

        for vol_id in volume_ids:
            # Generate unique_id for the volume
            unique_id = f"{storage.storage_system_id or storage.serial_number or storage.id}_{vol_id}"

            # Generate volume name: use name_prefix if provided, otherwise use storage name
            volume_name = f"{name_prefix}_{vol_id}" if name_prefix else f"{storage.name}_{vol_id}"

            volume = Volume.objects.create(
                storage=storage,
                name=volume_name,
                volume_id=vol_id,
                lss_lcu=details['lss'],
                format=fmt,
                capacity_bytes=capacity_bytes,
                pool=pool,
                unique_id=unique_id,
                committed=False,  # New volumes start uncommitted
                deployed=False,
                created_by_project=project,
                last_modified_by=user,
            )
            created_volumes.append(volume)

            # Add to project if specified
            if project:
                ProjectVolume.objects.create(
                    project=project,
                    volume=volume,
                    action='new',
                    added_by=user,
                )

        # Clear dashboard cache
        if storage.customer_id:
            clear_dashboard_cache_for_customer(storage.customer_id)

        return JsonResponse({
            'success': True,
            'message': f"Created {len(created_volumes)} volumes in range {start_volume}-{end_volume}",
            'start_volume': start_volume,
            'end_volume': end_volume,
            'volume_count': len(created_volumes),
            'volume_ids': [v.id for v in created_volumes],
            'lss': details['lss'],
            'format': fmt,
            'capacity_bytes': capacity_bytes,
            'pool_name': pool_name,
            'name_prefix': name_prefix,
            'project_id': active_project_id,
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
    except Exception as e:
        logger.error(f"Error creating volume range: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def volume_range_delete(request, storage_id):
    """
    POST /api/storage/{storage_id}/volume-ranges/delete/

    Deletes volumes by their IDs.
    Request body:
    {
        "volume_ids": [1, 2, 3, ...]
    }
    """
    try:
        # Validate storage exists
        try:
            storage = Storage.objects.get(id=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({'error': f'Storage system with id {storage_id} not found'}, status=404)

        # Parse request body
        data = json.loads(request.body)
        volume_ids = data.get('volume_ids', [])

        if not volume_ids:
            return JsonResponse({'error': 'No volume_ids provided'}, status=400)

        # Get volumes that belong to this storage
        volumes = Volume.objects.filter(
            id__in=volume_ids,
            storage=storage
        )

        count = volumes.count()
        if count == 0:
            return JsonResponse({'error': 'No matching volumes found'}, status=404)

        # Get volume IDs for response before deletion
        deleted_vol_ids = list(volumes.values_list('volume_id', flat=True))

        # Delete project memberships first
        ProjectVolume.objects.filter(volume__in=volumes).delete()

        # Delete the volumes
        volumes.delete()

        # Clear dashboard cache
        if storage.customer_id:
            clear_dashboard_cache_for_customer(storage.customer_id)

        return JsonResponse({
            'success': True,
            'message': f"Deleted {count} volumes",
            'deleted_count': count,
            'deleted_volume_ids': deleted_vol_ids,
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
    except Exception as e:
        logger.error(f"Error deleting volume range: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def volume_range_dscli(request, storage_id):
    """
    POST /api/storage/{storage_id}/volume-ranges/dscli/

    Generates DSCLI commands for selected ranges or new range specification.

    Request body option 1 - existing ranges:
    {
        "range_ids": ["range_id_1", "range_id_2", ...],
        "command_type": "create"
    }

    Request body option 2 - new range specification:
    {
        "start_volume": "1000",
        "end_volume": "100F",
        "format": "FB",
        "capacity_bytes": 53687091200,
        "pool_name": "P0",
        "command_type": "create"
    }
    """
    try:
        # Validate storage exists and is DS8000
        try:
            storage = Storage.objects.get(id=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({'error': f'Storage system with id {storage_id} not found'}, status=404)

        if storage.storage_type != 'DS8000':
            return JsonResponse({
                'error': 'DSCLI commands are only available for DS8000 storage systems.'
            }, status=400)

        # Parse request body
        data = json.loads(request.body)
        command_type = data.get('command_type', 'create')

        # Get project context for filtering
        active_project_id = data.get('active_project_id')
        project_filter = data.get('project_filter', 'all')

        from .volume_range_utils import (
            calculate_volume_ranges,
            generate_dscli_commands,
            generate_dscli_for_new_range,
            validate_volume_range
        )
        from .storage_utils import generate_ds8000_device_id

        device_id = generate_ds8000_device_id(storage)

        # Check if this is for existing ranges or a new range spec
        if 'range_ids' in data:
            # Option 1: Generate commands for existing ranges
            range_ids = data.get('range_ids', [])

            if not range_ids:
                return JsonResponse({'error': 'No range_ids provided'}, status=400)

            # Get current volumes and calculate ranges with project context
            from django.db.models import Q, Count
            volumes = Volume.objects.filter(storage=storage).select_related('storage')

            # Apply filtering based on view mode
            if project_filter == 'current' and active_project_id:
                # Draft mode: Show committed volumes OR volumes in the active project
                volumes = volumes.filter(
                    Q(committed=True) | Q(project_memberships__project_id=active_project_id)
                ).distinct()
            else:
                # Committed mode: Show only committed volumes OR orphaned volumes
                volumes = volumes.annotate(
                    project_count=Count('project_memberships')
                ).filter(
                    Q(committed=True) | Q(project_count=0)
                )

            all_ranges = calculate_volume_ranges(volumes)

            # Filter to selected ranges
            selected_ranges = [r for r in all_ranges if r['range_id'] in range_ids]

            if not selected_ranges:
                return JsonResponse({'error': 'No matching ranges found'}, status=404)

            # Generate commands
            result = generate_dscli_commands(storage, selected_ranges, command_type)

            return JsonResponse({
                'device_id': device_id,
                'storage_name': storage.name,
                'commands': result['commands'],
                'command_count': result['command_count'],
                'command_type': command_type,
                'selected_ranges': len(selected_ranges),
            })

        elif 'start_volume' in data and 'end_volume' in data:
            # Option 2: Generate command for a new range specification
            start_volume = data.get('start_volume', '').strip().upper()
            end_volume = data.get('end_volume', '').strip().upper()
            fmt = data.get('format', 'FB').strip().upper()
            capacity_bytes = data.get('capacity_bytes', 0)
            pool_name = data.get('pool_name', 'P0')

            # Validate range
            is_valid, error, details = validate_volume_range(start_volume, end_volume)
            if not is_valid:
                return JsonResponse({'error': error}, status=400)

            # Generate command
            try:
                command = generate_dscli_for_new_range(
                    storage, start_volume, end_volume, fmt, capacity_bytes, pool_name
                )
            except ValueError as e:
                return JsonResponse({'error': str(e)}, status=400)

            return JsonResponse({
                'device_id': device_id,
                'storage_name': storage.name,
                'commands': [command],
                'command_count': 1,
                'command_type': command_type,
                'start_volume': start_volume,
                'end_volume': end_volume,
                'volume_count': details['count'],
            })

        else:
            return JsonResponse({
                'error': 'Must provide either range_ids (for existing ranges) or start_volume/end_volume (for new range)'
            }, status=400)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
    except Exception as e:
        logger.error(f"Error generating DSCLI commands: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def volume_range_update(request, storage_id):
    """
    POST /api/storage/{storage_id}/volume-ranges/update/

    Updates properties on volumes in a range, and handles range size changes.
    If the range is shrunk (start increased or end decreased), volumes outside
    the new range will be deleted.

    Request body:
    {
        "volume_ids": [1, 2, 3, ...],        // Existing volume IDs in the range
        "lss": "10",                          // 2-digit LSS
        "new_start_volume": "00",             // New 2-digit start (within LSS)
        "new_end_volume": "0F",               // New 2-digit end (within LSS)
        "format": "FB",                       // FB or CKD
        "capacity_bytes": 53687091200,        // Volume capacity in bytes
        "pool_name": "P0",                    // Pool name
        "preview": true/false,                // If true, returns what would change without applying
        "active_project_id": 123              // Optional project context
    }
    """
    try:
        # Validate storage exists and is DS8000
        try:
            storage = Storage.objects.get(id=storage_id)
        except Storage.DoesNotExist:
            return JsonResponse({'error': f'Storage system with id {storage_id} not found'}, status=404)

        if storage.storage_type != 'DS8000':
            return JsonResponse({
                'error': 'Volume range updates are only available for DS8000 storage systems.'
            }, status=400)

        # Parse request body
        data = json.loads(request.body)

        volume_ids = data.get('volume_ids', [])
        lss = data.get('lss', '').strip().upper()
        new_start = data.get('new_start_volume', '').strip().upper()
        new_end = data.get('new_end_volume', '').strip().upper()
        fmt = data.get('format', '').strip().upper()
        capacity_bytes = data.get('capacity_bytes')
        pool_name = data.get('pool_name', '')
        name_prefix = data.get('name_prefix', '').strip()
        preview = data.get('preview', False)
        active_project_id = data.get('active_project_id')

        if not volume_ids:
            return JsonResponse({'error': 'No volume_ids provided'}, status=400)

        # Validate LSS format (2 hex digits)
        import re
        if not re.match(r'^[0-9A-F]{2}$', lss):
            return JsonResponse({'error': f"Invalid LSS format '{lss}': must be 2 hex digits"}, status=400)

        # Construct full 4-digit volume IDs
        full_start = (lss + new_start).upper()
        full_end = (lss + new_end).upper()

        # Validate the new range
        from .volume_range_utils import validate_volume_range, generate_volume_ids_for_range

        is_valid, error, details = validate_volume_range(full_start, full_end)
        if not is_valid:
            return JsonResponse({'error': error}, status=400)

        # Validate format if provided
        if fmt and fmt not in ['FB', 'CKD']:
            return JsonResponse({'error': f"Invalid format '{fmt}': must be 'FB' or 'CKD'"}, status=400)

        # Get existing volumes
        existing_volumes = Volume.objects.filter(
            id__in=volume_ids,
            storage=storage
        ).select_related('pool')

        if not existing_volumes.exists():
            return JsonResponse({'error': 'No matching volumes found'}, status=404)

        # Get the current range info from existing volumes
        existing_vol_ids_hex = set(v.volume_id.upper() for v in existing_volumes)

        # Generate the new range's volume IDs
        new_vol_ids_hex = set(generate_volume_ids_for_range(full_start, full_end))

        # Calculate what changes need to happen
        # 1. Volumes to keep (in both old and new range)
        volumes_to_keep = existing_vol_ids_hex & new_vol_ids_hex
        # 2. Volumes to delete (in old but not in new - range was shrunk)
        volumes_to_delete = existing_vol_ids_hex - new_vol_ids_hex
        # 3. Volumes to create (in new but not in old - range was expanded)
        volumes_to_create = new_vol_ids_hex - existing_vol_ids_hex

        # Look up Pool by name if provided
        pool = None
        if pool_name:
            pool = Pool.objects.filter(storage=storage, name=pool_name).first()

        # Prepare the response with what would change
        changes = {
            'volumes_to_update': len(volumes_to_keep),
            'volumes_to_delete': len(volumes_to_delete),
            'volumes_to_create': len(volumes_to_create),
            'delete_volume_ids': sorted(list(volumes_to_delete)),
            'create_volume_ids': sorted(list(volumes_to_create)),
            'property_changes': {},
        }

        # Check what properties would change on kept volumes
        if volumes_to_keep:
            sample_vol = existing_volumes.first()
            if fmt and sample_vol.format != fmt:
                changes['property_changes']['format'] = {'from': sample_vol.format, 'to': fmt}
            if capacity_bytes is not None and sample_vol.capacity_bytes != capacity_bytes:
                changes['property_changes']['capacity_bytes'] = {
                    'from': sample_vol.capacity_bytes,
                    'to': capacity_bytes
                }
            if pool_name and (sample_vol.pool is None or sample_vol.pool.name != pool_name):
                changes['property_changes']['pool'] = {
                    'from': sample_vol.pool.name if sample_vol.pool else None,
                    'to': pool_name
                }

        # If preview mode, just return what would change
        if preview:
            return JsonResponse({
                'preview': True,
                'changes': changes,
                'lss': lss,
                'new_start': full_start,
                'new_end': full_end,
                'will_delete_volumes': len(volumes_to_delete) > 0,
            })

        # Apply the changes
        user = request.user if request.user.is_authenticated else None

        # Get project if specified
        project = None
        if active_project_id:
            try:
                project = Project.objects.get(id=active_project_id)
            except Project.DoesNotExist:
                pass  # Project is optional for updates

        results = {
            'updated': 0,
            'deleted': 0,
            'created': 0,
            'errors': [],
        }

        # 1. Delete volumes that are no longer in range
        if volumes_to_delete:
            vols_to_delete = existing_volumes.filter(volume_id__in=volumes_to_delete)
            # Delete project memberships first
            ProjectVolume.objects.filter(volume__in=vols_to_delete).delete()
            delete_count = vols_to_delete.count()
            vols_to_delete.delete()
            results['deleted'] = delete_count

        # 2. Update remaining volumes with new properties
        if volumes_to_keep:
            vols_to_update = existing_volumes.filter(volume_id__in=volumes_to_keep)
            update_fields = {'last_modified_by': user}
            if fmt:
                update_fields['format'] = fmt
            if capacity_bytes is not None:
                update_fields['capacity_bytes'] = capacity_bytes
            if pool is not None:
                update_fields['pool'] = pool

            # Update volume names if name_prefix is provided
            if name_prefix:
                # Name update requires per-volume update due to unique name per volume
                for vol in vols_to_update:
                    vol.name = f"{name_prefix}_{vol.volume_id}"
                    for field, value in update_fields.items():
                        setattr(vol, field, value)
                    vol.save()
                results['updated'] = vols_to_update.count()
            elif len(update_fields) > 1:  # More than just last_modified_by
                vols_to_update.update(**update_fields)
                results['updated'] = vols_to_update.count()

        # 3. Create new volumes if range was expanded
        if volumes_to_create:
            # Check for conflicts with existing volumes
            conflicts = Volume.objects.filter(
                storage=storage,
                volume_id__in=volumes_to_create
            ).values_list('volume_id', flat=True)

            if conflicts:
                results['errors'].append(
                    f"Cannot expand range: volumes already exist: {', '.join(conflicts)}"
                )
            else:
                for vol_id in sorted(volumes_to_create):
                    try:
                        unique_id = f"{storage.storage_system_id or storage.serial_number or storage.id}_{vol_id}"
                        # Generate volume name: use name_prefix if provided, otherwise use storage name
                        volume_name = f"{name_prefix}_{vol_id}" if name_prefix else f"{storage.name}_{vol_id}"
                        volume = Volume.objects.create(
                            storage=storage,
                            name=volume_name,
                            volume_id=vol_id,
                            lss_lcu=lss,
                            format=fmt or 'FB',
                            capacity_bytes=capacity_bytes,
                            pool=pool,
                            unique_id=unique_id,
                            committed=False,
                            deployed=False,
                            created_by_project=project,
                            last_modified_by=user,
                        )
                        # Add to project if specified
                        if project:
                            ProjectVolume.objects.create(
                                project=project,
                                volume=volume,
                                action='new',
                                added_by=user,
                            )
                        results['created'] += 1
                    except Exception as e:
                        results['errors'].append(f"Error creating volume {vol_id}: {str(e)}")

        # Clear dashboard cache
        if storage.customer_id:
            clear_dashboard_cache_for_customer(storage.customer_id)

        return JsonResponse({
            'success': len(results['errors']) == 0,
            'message': f"Updated {results['updated']}, deleted {results['deleted']}, created {results['created']} volumes",
            'results': results,
            'lss': lss,
            'new_start': full_start,
            'new_end': full_end,
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
    except Exception as e:
        logger.error(f"Error updating volume range: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


# ==========================================
# Pool Management Views
# ==========================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def pool_list(request, storage_id=None):
    """
    Handle pool list and creation operations.

    GET: Return pools filtered by storage system ID (optional) or customer with pagination.
    POST: Create a new pool.
    """
    user = request.user if request.user.is_authenticated else None

    if request.method == "GET":
        try:
            customer_id = request.GET.get("customer")

            # Get query parameters
            search = request.GET.get('search', '').strip()
            ordering = request.GET.get('ordering', 'name')

            # Base queryset with optimizations
            from django.db.models import Count
            pools = Pool.objects.select_related('storage', 'created_by_project').prefetch_related(
                Prefetch('project_memberships',
                         queryset=ProjectPool.objects.select_related('project'))
            ).all()

            # Filter by user's customer access
            if user and user.is_authenticated:
                from core.permissions import filter_by_customer_access
                accessible_storages = filter_by_customer_access(
                    Storage.objects.all(), user
                ).values_list('id', flat=True)
                pools = pools.filter(storage_id__in=accessible_storages)

            # Filter by storage ID if provided in URL
            if storage_id:
                pools = pools.filter(storage_id=storage_id)

            # Filter by customer
            if customer_id:
                pools = pools.filter(storage__customer_id=customer_id)

            # Get project filter parameters
            project_filter = request.GET.get('project_filter', 'all')
            active_project_id = request.GET.get('project_id') or request.GET.get('project')

            # Apply view-based filtering
            if project_filter == 'current' and active_project_id:
                # Project View: Show committed pools OR pools in the active project
                project_pool_ids = set(ProjectPool.objects.filter(
                    project_id=active_project_id
                ).values_list('pool_id', flat=True))

                pools = pools.annotate(
                    project_count=Count('project_memberships')
                ).filter(
                    Q(committed=True) | Q(project_count=0) | Q(id__in=project_pool_ids)
                )
            else:
                # Customer View filtering: Show pools that are either:
                # 1. Committed (committed=True), OR
                # 2. Not referenced by any project (no junction table entries)
                pools = pools.annotate(
                    project_count=Count('project_memberships')
                ).filter(
                    Q(committed=True) | Q(project_count=0)
                )

            # Apply general search if provided
            if search:
                pools = pools.filter(
                    Q(name__icontains=search) |
                    Q(storage__name__icontains=search) |
                    Q(storage_type__icontains=search) |
                    Q(unique_id__icontains=search)
                )

            # Apply ordering
            if ordering:
                pools = pools.order_by(ordering)

            # Get pagination parameters
            page = int(request.GET.get('page', 1))
            page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

            if page_size_param == 'All':
                return JsonResponse({'error': '"All" page size is not supported. Maximum page size is 500.'}, status=400)

            page_size = int(page_size_param)

            if page_size > settings.MAX_PAGE_SIZE:
                return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}. Requested: {page_size}'}, status=400)

            # Apply pagination
            paginator = Paginator(pools, page_size)
            page_obj = paginator.get_page(page)

            # Serialize paginated results with context
            context = {}
            if active_project_id:
                context['active_project_id'] = int(active_project_id)
            serializer = PoolSerializer(page_obj, many=True, context=context)

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
            logger.error(f"Error in pool_list GET: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)

            # Required fields
            name = data.get('name')
            storage_id_param = data.get('storage') or storage_id
            storage_type = data.get('storage_type', 'FB')

            if not name:
                return JsonResponse({'error': 'Pool name is required'}, status=400)
            if not storage_id_param:
                return JsonResponse({'error': 'Storage system is required'}, status=400)

            # Get storage system
            try:
                storage = Storage.objects.get(id=storage_id_param)
            except Storage.DoesNotExist:
                return JsonResponse({'error': f'Storage system {storage_id_param} not found'}, status=404)

            # FlashSystem pools are always FB
            if storage.storage_type == 'FlashSystem':
                storage_type = 'FB'

            # Check for duplicate pool name in same storage
            if Pool.objects.filter(storage=storage, name=name).exists():
                return JsonResponse({'error': f'Pool "{name}" already exists in storage system {storage.name}'}, status=400)

            # Generate unique_id
            unique_id = f"{storage.storage_system_id or storage.id}_{name}"

            # Get project ID if provided
            active_project_id = data.get('active_project_id')
            project = None
            if active_project_id:
                try:
                    project = Project.objects.get(id=active_project_id)
                except Project.DoesNotExist:
                    pass

            # Create the pool
            pool = Pool.objects.create(
                name=name,
                storage=storage,
                storage_type=storage_type,
                unique_id=unique_id,
                committed=False,
                deployed=False,
                created_by_project=project,
                last_modified_by=user
            )

            # Add to project if project ID provided
            if project:
                ProjectPool.objects.create(
                    project=project,
                    pool=pool,
                    action='new',
                    added_by=user
                )

            # Clear dashboard cache
            if storage.customer:
                clear_dashboard_cache_for_customer(storage.customer.id)

            serializer = PoolSerializer(pool)
            return JsonResponse(serializer.data, status=201)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
        except Exception as e:
            logger.error(f"Error in pool_list POST: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def pool_detail(request, pk):
    """Handle pool detail operations (GET, PUT, PATCH, DELETE)."""
    user = request.user if request.user.is_authenticated else None

    try:
        pool = Pool.objects.select_related('storage', 'created_by_project').get(pk=pk)
    except Pool.DoesNotExist:
        return JsonResponse({'error': 'Pool not found'}, status=404)

    if request.method == "GET":
        serializer = PoolSerializer(pool)
        return JsonResponse(serializer.data)

    elif request.method in ["PUT", "PATCH"]:
        try:
            data = json.loads(request.body)

            # Update allowed fields
            if 'name' in data:
                # Check for duplicate name in same storage
                new_name = data['name']
                if Pool.objects.filter(storage=pool.storage, name=new_name).exclude(pk=pk).exists():
                    return JsonResponse({'error': f'Pool "{new_name}" already exists in this storage system'}, status=400)
                pool.name = new_name
                pool.unique_id = f"{pool.storage.storage_system_id or pool.storage.id}_{new_name}"

            if 'storage_type' in data:
                # FlashSystem pools are always FB
                if pool.storage.storage_type == 'FlashSystem':
                    pool.storage_type = 'FB'
                else:
                    pool.storage_type = data['storage_type']

            if 'committed' in data:
                pool.committed = data['committed']

            if 'deployed' in data:
                pool.deployed = data['deployed']

            pool.last_modified_by = user
            pool.version += 1
            pool.save()

            # Clear dashboard cache
            if pool.storage.customer:
                clear_dashboard_cache_for_customer(pool.storage.customer.id)

            serializer = PoolSerializer(pool)
            return JsonResponse(serializer.data)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
        except Exception as e:
            logger.error(f"Error in pool_detail PUT/PATCH: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        try:
            storage = pool.storage

            # Remove project memberships first
            ProjectPool.objects.filter(pool=pool).delete()

            # Delete the pool
            pool.delete()

            # Clear dashboard cache
            if storage.customer:
                clear_dashboard_cache_for_customer(storage.customer.id)

            return JsonResponse({'message': 'Pool deleted successfully'})

        except Exception as e:
            logger.error(f"Error in pool_detail DELETE: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def pool_project_view(request, project_id):
    """
    Get pools in project with field_overrides applied.

    GET: Returns pools with project-specific modifications merged in.
    POST: Save multiple pool changes in project context.
    """
    user = request.user if request.user.is_authenticated else None

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({'error': 'Project not found'}, status=404)

    # Get customer from project
    customer = project.customers.first()
    if not customer:
        return JsonResponse({'error': 'Project has no associated customer'}, status=400)

    if request.method == "GET":
        try:
            project_filter = request.GET.get('project_filter', 'current')
            search = request.GET.get('search', '').strip()
            ordering = request.GET.get('ordering', 'name')
            storage_id = request.GET.get('storage_id')

            # Get project pool IDs for quick lookup
            project_pool_ids = set(ProjectPool.objects.filter(
                project=project
            ).values_list('pool_id', flat=True))

            from django.db.models import Count

            # Base queryset
            if project_filter == 'all':
                # Return ALL customer pools with in_active_project flag
                # Include: committed pools, orphaned pools, AND pools in current project
                pools = Pool.objects.filter(
                    storage__customer=customer
                ).select_related('storage', 'created_by_project').prefetch_related(
                    Prefetch('project_memberships',
                             queryset=ProjectPool.objects.select_related('project'))
                )

                # Apply Customer View filtering BUT also include pools in current project
                # This allows showing uncommitted pools that are in the active project
                pools = pools.annotate(
                    project_count=Count('project_memberships')
                ).filter(
                    Q(committed=True) | Q(project_count=0) | Q(id__in=project_pool_ids)
                )
            else:
                # Return only pools in this project
                pools = Pool.objects.filter(
                    project_memberships__project=project
                ).select_related('storage', 'created_by_project').prefetch_related(
                    Prefetch('project_memberships',
                             queryset=ProjectPool.objects.select_related('project'))
                )

            # Filter by storage if provided
            if storage_id:
                pools = pools.filter(storage_id=storage_id)

            # Apply search
            if search:
                pools = pools.filter(
                    Q(name__icontains=search) |
                    Q(storage__name__icontains=search) |
                    Q(storage_type__icontains=search)
                )

            # Apply ordering
            if ordering:
                pools = pools.order_by(ordering)

            # Pagination
            page = int(request.GET.get('page', 1))
            page_size_param = request.GET.get('page_size', settings.DEFAULT_PAGE_SIZE)

            if page_size_param == 'All':
                return JsonResponse({'error': '"All" page size is not supported.'}, status=400)

            page_size = int(page_size_param)
            if page_size > settings.MAX_PAGE_SIZE:
                return JsonResponse({'error': f'Maximum page size is {settings.MAX_PAGE_SIZE}'}, status=400)

            paginator = Paginator(pools, page_size)
            pools_page = paginator.get_page(page)

            # Build merged data
            merged_data = []
            for pool in pools_page:
                base_data = PoolSerializer(pool, context={'active_project_id': project_id}).data
                in_project = pool.id in project_pool_ids

                # Apply field overrides if in project
                modified_fields = []
                if in_project:
                    try:
                        pp = ProjectPool.objects.get(project=project, pool=pool)
                        if pp.field_overrides:
                            for field_name, override_value in pp.field_overrides.items():
                                if field_name in base_data and base_data[field_name] != override_value:
                                    base_data[field_name] = override_value
                                    modified_fields.append(field_name)
                        base_data['project_action'] = 'delete' if pp.delete_me else pp.action
                    except ProjectPool.DoesNotExist:
                        pass

                base_data['modified_fields'] = modified_fields
                base_data['in_active_project'] = in_project
                merged_data.append(base_data)

            return JsonResponse({
                'results': merged_data,
                'count': paginator.count,
                'num_pages': paginator.num_pages,
                'current_page': page,
                'page_size': page_size,
                'has_next': pools_page.has_next(),
                'has_previous': pools_page.has_previous()
            })

        except Exception as e:
            logger.error(f"Error in pool_project_view GET: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            rows = data.get('rows', [])

            results = {'created': 0, 'updated': 0, 'errors': []}

            for row in rows:
                try:
                    pool_id = row.get('id')

                    if pool_id:
                        # Update existing pool
                        try:
                            pool = Pool.objects.get(id=pool_id)
                        except Pool.DoesNotExist:
                            results['errors'].append(f"Pool {pool_id} not found")
                            continue

                        # Get or create project membership
                        pp, created = ProjectPool.objects.get_or_create(
                            project=project,
                            pool=pool,
                            defaults={'action': 'modified', 'added_by': user}
                        )

                        # Update field overrides
                        overrides = pp.field_overrides or {}
                        for field in ['name', 'storage_type']:
                            if field in row and row[field] != getattr(pool, field):
                                overrides[field] = row[field]

                        pp.field_overrides = overrides
                        if not created and overrides:
                            pp.action = 'modified'
                        pp.save()

                        results['updated'] += 1
                    else:
                        # Create new pool
                        storage_id = row.get('storage')
                        if isinstance(storage_id, str):
                            try:
                                storage = Storage.objects.get(name=storage_id, customer=customer)
                                storage_id = storage.id
                            except Storage.DoesNotExist:
                                results['errors'].append(f"Storage '{storage_id}' not found")
                                continue

                        storage = Storage.objects.get(id=storage_id)
                        name = row.get('name')
                        storage_type = row.get('storage_type', 'FB')

                        # FlashSystem pools are always FB
                        if storage.storage_type == 'FlashSystem':
                            storage_type = 'FB'

                        unique_id = f"{storage.storage_system_id or storage.id}_{name}"

                        pool = Pool.objects.create(
                            name=name,
                            storage=storage,
                            storage_type=storage_type,
                            unique_id=unique_id,
                            committed=False,
                            deployed=False,
                            created_by_project=project,
                            last_modified_by=user
                        )

                        ProjectPool.objects.create(
                            project=project,
                            pool=pool,
                            action='new',
                            added_by=user
                        )

                        results['created'] += 1

                except Exception as e:
                    results['errors'].append(str(e))

            # Clear dashboard cache
            if customer:
                clear_dashboard_cache_for_customer(customer.id)

            return JsonResponse(results)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON in request body'}, status=400)
        except Exception as e:
            logger.error(f"Error in pool_project_view POST: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)
