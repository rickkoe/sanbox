import json
from django.http import JsonResponse
from django.db.models import Q, Count, Prefetch
from django.db.models import Q as Q_models
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from .models import Alias, Zone, Fabric, WwpnPrefix, Switch, AliasWWPN
from customers.models import Customer
from core.models import Config, Project, UserConfig, ProjectAlias, ProjectZone, ProjectHost, ProjectSwitch, ProjectFabric
from storage.models import Host
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer, WwpnPrefixSerializer, SwitchSerializer
from django.db import IntegrityError
from collections import defaultdict
from .san_utils import generate_alias_commands, generate_zone_commands, generate_alias_deletion_only_commands, generate_zone_deletion_commands, generate_zone_creation_commands
from django.utils import timezone
from core.dashboard_views import clear_dashboard_cache_for_customer
from core.audit import log_create, log_update, log_delete


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "PATCH", "DELETE"])
def fabric_management(request, pk=None):
    """Handle fabric CRUD operations with pagination and filtering."""
    print(f"🔥🔥🔥 FABRIC MANAGEMENT CALLED - Method: {request.method}, PK: {pk} 🔥🔥🔥")

    user = request.user if request.user.is_authenticated else None

    if request.method == "GET":
        if pk:
            # Get specific fabric
            try:
                fabric = Fabric.objects.get(pk=pk)

                # Check if user has access to this fabric's customer
                if user and user.is_authenticated:
                    from core.permissions import has_customer_access
                    if not has_customer_access(user, fabric.customer):
                        return JsonResponse({"error": "Permission denied"}, status=403)
                else:
                    return JsonResponse({"error": "Authentication required"}, status=401)

                serializer = FabricSerializer(fabric)
                return JsonResponse(serializer.data)
            except Fabric.DoesNotExist:
                return JsonResponse({"error": "Fabric not found"}, status=404)
        else:
            # List fabrics with pagination and filtering
            try:
                # Get query parameters
                customer_id = request.GET.get('customer_id')
                page_number = request.GET.get('page', 1)
                page_size = request.GET.get('page_size', 50)
                search = request.GET.get('search', '')
                ordering = request.GET.get('ordering', 'name')

                # Convert to integers with defaults
                try:
                    page_number = int(page_number)
                    page_size = int(page_size) if page_size != 'All' else None
                except (ValueError, TypeError):
                    page_number = 1
                    page_size = 50

                # Build queryset with optimizations
                from django.db.models import Q, Count
                fabrics = Fabric.objects.select_related('customer', 'created_by_project').all()

                # Filter by user's customer access
                if user and user.is_authenticated:
                    from core.permissions import filter_by_customer_access
                    fabrics = filter_by_customer_access(fabrics, user)
                else:
                    # Unauthenticated users see nothing
                    fabrics = Fabric.objects.none()

                # Customer View filtering: Show fabrics that are either:
                # 1. Committed (committed=True), OR
                # 2. Not referenced by any project (no junction table entries)
                print(f"DEBUG: Before filter - count: {fabrics.count()}")
                fabrics = fabrics.annotate(
                    project_count=Count('project_memberships')
                ).filter(
                    Q(committed=True) | Q(project_count=0)
                )
                print(f"DEBUG: After filter - count: {fabrics.count()}")

                # Filter by customer if provided
                if customer_id:
                    fabrics = fabrics.filter(customer=customer_id)
                    print(f"DEBUG: After customer filter - count: {fabrics.count()}")
                
                # Apply search if provided
                if search:
                    fabrics = fabrics.filter(
                        Q(name__icontains=search) |
                        Q(zoneset_name__icontains=search) |
                        Q(san_vendor__icontains=search) |
                        Q(notes__icontains=search)
                    )
                
                # Apply field-specific filters
                filter_params = {}
                for param, value in request.GET.items():
                    if param.startswith((
                        'name__', 'zoneset_name__', 'san_vendor__', 'vsan__',
                        'exists__', 'notes__', 'customer__'
                    )):
                        filter_params[param] = value
                
                # Apply the filters
                if filter_params:
                    fabrics = fabrics.filter(**filter_params)
                
                # Apply ordering
                if ordering:
                    fabrics = fabrics.order_by(ordering)
                
                # Get total count before pagination
                total_count = fabrics.count()
                
                # Handle "All" page size
                if page_size is None:
                    # Return all results without pagination
                    serializer = FabricSerializer(fabrics, many=True)
                    return JsonResponse({
                        'count': total_count,
                        'next': None,
                        'previous': None,
                        'results': serializer.data
                    })
                
                # Create paginator
                paginator = Paginator(fabrics, page_size)
                
                # Get the requested page
                try:
                    page_obj = paginator.get_page(page_number)
                except:
                    page_obj = paginator.get_page(1)
                
                # Serialize the page data
                serializer = FabricSerializer(page_obj.object_list, many=True)
                
                return JsonResponse({
                    'results': serializer.data,
                    'count': total_count,
                    'num_pages': paginator.num_pages,
                    'current_page': page_number,
                    'page_size': page_size,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous()
                })
                
            except Exception as e:
                return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "POST":
        # Create new fabric - requires admin role
        print("🔥 POST handler started")
        if not user or not user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)

        try:
            print("🔥 Loading request body")
            data = json.loads(request.body)
            print(f"🔥 Request data: {data}")

            # Check if user can modify infrastructure for this customer
            customer_id = data.get('customer')
            if customer_id:
                from customers.models import Customer
                from core.permissions import can_edit_customer_infrastructure
                try:
                    print(f"🔥 Checking permissions for customer {customer_id}")
                    customer = Customer.objects.get(id=customer_id)
                    if not can_edit_customer_infrastructure(user, customer):
                        return JsonResponse({
                            "error": "You do not have permission to create fabrics. Only members and admins can modify infrastructure."
                        }, status=403)
                except Customer.DoesNotExist:
                    return JsonResponse({"error": "Customer not found"}, status=404)

            print("🔥 Creating serializer")
            serializer = FabricSerializer(data=data)
            print("🔥 Validating serializer")
            if serializer.is_valid():
                print("🔥 Serializer is valid!")
                try:
                    print("✅ Step 1: Saving fabric...")
                    fabric = serializer.save(last_modified_by=user)
                    print(f"✅ Step 2: Fabric saved with ID: {fabric.pk}")

                    # Clear dashboard cache when fabric is created
                    if fabric.customer_id:
                        print(f"✅ Step 3: Clearing cache for customer {fabric.customer_id}...")
                        clear_dashboard_cache_for_customer(fabric.customer_id)
                        print("✅ Step 4: Cache cleared")

                    # Reload fabric from database to get all related fields
                    print("✅ Step 5: Reloading fabric from database...")
                    fabric = Fabric.objects.select_related('customer', 'last_modified_by').get(pk=fabric.pk)
                    print("✅ Step 6: Fabric reloaded")

                    print("✅ Step 7: Serializing response...")
                    response_data = {
                        'message': f'Fabric "{fabric.name}" created successfully',
                        'fabric': FabricSerializer(fabric).data
                    }

                    # Log the creation
                    log_create(
                        user=user,
                        entity_type='FABRIC',
                        entity_name=fabric.name,
                        customer=fabric.customer,
                        details={
                            'zoneset_name': fabric.zoneset_name,
                            'vsan': fabric.vsan,
                            'san_vendor': fabric.san_vendor
                        }
                    )

                    print("✅ Step 8: Response data created, returning...")
                    return JsonResponse(response_data, status=201)
                except Exception as inner_e:
                    import traceback
                    print(f"❌ Error in fabric creation process: {str(inner_e)}")
                    print(f"❌ Traceback:\n{traceback.format_exc()}")
                    raise
            else:
                print(f"❌ Serializer validation failed: {serializer.errors}")
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            import traceback
            print(f"❌ Error creating fabric: {str(e)}")
            print(f"❌ Traceback:\n{traceback.format_exc()}")
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method in ["PUT", "PATCH"]:
        # Update existing fabric - requires admin role
        if not user or not user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)

        if not pk:
            return JsonResponse({"error": "Fabric ID required for update"}, status=400)

        try:
            fabric = Fabric.objects.get(pk=pk)

            # Check if user can modify infrastructure for this customer
            from core.permissions import can_edit_customer_infrastructure
            if not can_edit_customer_infrastructure(user, fabric.customer):
                return JsonResponse({
                    "error": "You do not have permission to update fabrics. Only members and admins can modify infrastructure."
                }, status=403)

            data = json.loads(request.body)

            # Optimistic locking - check version
            client_version = data.get('version')
            if client_version is not None:
                if fabric.version != client_version:
                    # Version mismatch - someone else modified this fabric
                    return JsonResponse({
                        "error": "Conflict",
                        "message": f"This fabric was modified by {fabric.last_modified_by.username if fabric.last_modified_by else 'another user'}. Please reload and try again.",
                        "current_version": fabric.version,
                        "last_modified_by": fabric.last_modified_by.username if fabric.last_modified_by else None,
                        "last_modified_at": fabric.last_modified_at.isoformat() if fabric.last_modified_at else None
                    }, status=409)

            serializer = FabricSerializer(fabric, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                fabric = serializer.save()
                # Set last_modified_by and increment version
                fabric.last_modified_by = user
                fabric.version += 1
                if hasattr(fabric, 'updated'):
                    fabric.updated = timezone.now()
                    fabric.save(update_fields=['last_modified_by', 'version', 'updated'])
                else:
                    fabric.save(update_fields=['last_modified_by', 'version'])

                # Clear dashboard cache when fabric is updated
                if fabric.customer_id:
                    clear_dashboard_cache_for_customer(fabric.customer_id)

                # Log the update
                log_update(
                    user=user,
                    entity_type='FABRIC',
                    entity_name=fabric.name,
                    customer=fabric.customer,
                    details={'fields_updated': list(data.keys())}
                )

                return JsonResponse({
                    'message': f'Fabric "{fabric.name}" updated successfully',
                    'fabric': FabricSerializer(fabric).data
                })
            return JsonResponse(serializer.errors, status=400)
        except Fabric.DoesNotExist:
            return JsonResponse({"error": "Fabric not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "DELETE":
        # Delete fabric - requires admin role
        if not user or not user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)

        if not pk:
            return JsonResponse({"error": "Fabric ID required for deletion"}, status=400)

        try:
            fabric = Fabric.objects.get(pk=pk)

            # Check if user can modify infrastructure for this customer
            from core.permissions import can_edit_customer_infrastructure
            if not can_edit_customer_infrastructure(user, fabric.customer):
                return JsonResponse({
                    "error": "You do not have permission to delete fabrics. Only members and admins can modify infrastructure."
                }, status=403)

            customer_id = fabric.customer_id
            customer = fabric.customer
            fabric_name = fabric.name

            # Get zone count before deleting
            zone_count = fabric.zones.count()

            fabric.delete()

            # Clear dashboard cache when fabric is deleted
            if customer_id:
                clear_dashboard_cache_for_customer(customer_id)

            # Log the deletion
            log_delete(
                user=user,
                entity_type='FABRIC',
                entity_name=fabric_name,
                customer=customer,
                details={'zones_affected': zone_count}
            )

            return JsonResponse({
                "message": f'Fabric "{fabric_name}" deleted successfully'
            }, status=200)
        except Fabric.DoesNotExist:
            return JsonResponse({"error": "Fabric not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def fabric_delete_view(request, pk):
    """Delete a specific fabric."""
    print(f"🔥 Fabric Delete - PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        fabric = Fabric.objects.get(pk=pk)
        customer_id = fabric.customer_id
        customer = fabric.customer
        fabric_name = fabric.name
        zone_count = fabric.zones.count()

        fabric.delete()

        # Clear dashboard cache when fabric is deleted
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)

        # Log the deletion
        if user:
            log_delete(
                user=user,
                entity_type='FABRIC',
                entity_name=fabric_name,
                customer=customer,
                details={'zones_affected': zone_count}
            )

        return JsonResponse({
            "message": f'Fabric "{fabric_name}" deleted successfully'
        }, status=200)
    except Fabric.DoesNotExist:
        return JsonResponse({"error": "Fabric not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def get_unique_values_for_zones(request, project, field_name):
    """Get unique values for a specific field from zones in a project."""
    print(f"🔍 Getting unique values for zone field: {field_name} in project {project.id}")
    
    try:
        # Handle calculated field - member_count
        if field_name == 'member_count':
            # Calculate member_count for all zones and get unique values
            zones_queryset = Zone.objects.select_related('fabric').filter(projects=project).annotate(
                _member_count=Count('members', distinct=True)
            )
            unique_values = zones_queryset.values_list('_member_count', flat=True).distinct().order_by('_member_count')
            actual_field = '_member_count'  # Set actual_field for consistency
        else:
            # Base queryset for zones in the project
            zones_queryset = Zone.objects.select_related('fabric').filter(projects=project)
            
            # Map field names to actual model fields
            field_mapping = {
                'create': 'create',
                'delete': 'delete', 
                'exists': 'exists',
                'fabric__name': 'fabric__name',
                'zone_type': 'zone_type',
                'notes': 'notes'
            }
            
            # Get the actual field name
            actual_field = field_mapping.get(field_name, field_name)
            
            # Get unique values for the field
            unique_values = zones_queryset.values_list(actual_field, flat=True).distinct().order_by(actual_field)
        
        # Convert to list and handle different field types
        unique_values = list(unique_values)
        
        # Handle boolean fields specially (only for non-calculated fields)
        if field_name != 'member_count' and actual_field in ['create', 'delete', 'exists']:
            # For boolean fields, we need to handle True, False, and potentially None
            boolean_values = set(unique_values)  # Get unique boolean values including None
            # Convert to consistent string representation, including None values
            processed_booleans = []
            for value in boolean_values:
                if value is True:
                    processed_booleans.append('True')
                elif value is False:
                    processed_booleans.append('False')
                # Skip None values for boolean fields as they're not meaningful for filtering
            unique_values = sorted(processed_booleans)  # Sort to ensure consistent order
        else:
            # For non-boolean fields, filter out None/null values
            unique_values = [value for value in unique_values if value is not None and str(value).strip() != '']
        
        print(f"✅ Found {len(unique_values)} unique values for zone {field_name}: {unique_values}")
        
        return JsonResponse({
            'unique_values': unique_values
        })
        
    except Exception as e:
        print(f"❌ Error getting unique values for zone {field_name}: {str(e)}")
        return JsonResponse({"error": f"Failed to get unique values: {str(e)}"}, status=500)


def get_unique_values_for_aliases(request, project, field_name):
    """Get unique values for a specific field from aliases in a project."""
    print(f"🔍 Getting unique values for field: {field_name} in project {project.id}")

    try:
        # Handle calculated field - zoned_count
        if field_name == 'zoned_count':
            # Calculate zoned_count for all aliases and get unique values
            aliases_queryset = Alias.objects.select_related('fabric').filter(projects=project).annotate(
                _zoned_count=Count('zone', filter=Q_models(zone__projects=project), distinct=True)
            )
            unique_values = aliases_queryset.values_list('_zoned_count', flat=True).distinct().order_by('_zoned_count')
            actual_field = '_zoned_count'  # Set actual_field for consistency
        # Handle storage_details.name - looked up via Port.wwpn
        elif field_name in ['storage_details.name', 'storage__name']:
            from storage.models import Port

            # Get customer_id from project
            customer_id = project.customers.first().id if project.customers.exists() else None

            # Get all aliases in this project with WWPNs (normalized for comparison)
            project_alias_ids = ProjectAlias.objects.filter(project=project).values_list('alias_id', flat=True)
            aliases = Alias.objects.filter(id__in=project_alias_ids, wwpn__isnull=False).exclude(wwpn='')
            alias_wwpns = set()
            for alias in aliases:
                if alias.wwpn:
                    # Normalize WWPN (remove colons, uppercase)
                    normalized = alias.wwpn.replace(':', '').upper()
                    alias_wwpns.add(normalized)

            # Get all ports for the customer with WWPNs
            ports_query = Port.objects.select_related('storage').filter(
                wwpn__isnull=False,
                storage__isnull=False
            )

            # Filter by customer if available
            if customer_id:
                ports_query = ports_query.filter(storage__customer_id=customer_id)

            # Collect unique storage names from matching ports
            storage_names = set()
            for port in ports_query:
                if port.wwpn:
                    # Normalize port WWPN
                    port_wwpn_normalized = port.wwpn.replace(':', '').upper()
                    # Check if this port's WWPN matches any alias WWPN
                    if port_wwpn_normalized in alias_wwpns:
                        if port.storage and port.storage.name:
                            storage_names.add(port.storage.name)

            unique_values = sorted(list(storage_names))
            actual_field = 'storage_details.name'
        else:
            # Base queryset for aliases in the project
            aliases_queryset = Alias.objects.select_related('fabric').filter(projects=project)

            # Map field names to actual model fields
            field_mapping = {
                'create': 'create',
                'include_in_zoning': 'include_in_zoning',
                'fabric__name': 'fabric__name',
                'use': 'use',
                'cisco_alias': 'cisco_alias',
                'notes': 'notes'
            }

            # Get the actual field name
            actual_field = field_mapping.get(field_name, field_name)

            # Get unique values for the field
            unique_values = aliases_queryset.values_list(actual_field, flat=True).distinct().order_by(actual_field)
        
        # Convert to list and handle different field types
        unique_values = list(unique_values)
        
        # Handle boolean fields specially
        if actual_field in ['create', 'delete', 'include_in_zoning', 'logged_in']:
            # For boolean fields, we need to handle True, False, and potentially None
            boolean_values = set(unique_values)  # Get unique boolean values including None
            # Convert to consistent string representation, including None values
            processed_booleans = []
            for value in boolean_values:
                if value is True:
                    processed_booleans.append('True')
                elif value is False:
                    processed_booleans.append('False')
                # Skip None values for boolean fields as they're not meaningful for filtering
            unique_values = sorted(processed_booleans)  # Sort to ensure consistent order
        else:
            # For non-boolean fields, filter out None/null values
            unique_values = [value for value in unique_values if value is not None and str(value).strip() != '']
        
        print(f"✅ Found {len(unique_values)} unique values for {field_name}: {unique_values}")
        
        return JsonResponse({
            'unique_values': unique_values
        })
        
    except Exception as e:
        print(f"❌ Error getting unique values for {field_name}: {str(e)}")
        return JsonResponse({"error": f"Failed to get unique values: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def alias_list_view(request, project_id):
    """Fetch aliases belonging to a specific project."""
    print(f"🔥 Alias List - Project ID: {project_id}")
    
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        print(f"❌ Project {project_id} not found - likely deleted. Request from {request.META.get('HTTP_REFERER', 'unknown')}")
        print(f"🔄 Suggesting config refresh to prevent repeated requests...")
        return JsonResponse({
            "error": f"Project {project_id} not found. This project may have been deleted.",
            "project_id": project_id,
            "deleted": True,
            "suggestion": "Please refresh the page or clear browser storage to update active project"
        }, status=404)
    
    # Check for unique values request
    unique_values_field = request.GET.get('unique_values')
    if unique_values_field:
        return get_unique_values_for_aliases(request, project, unique_values_field)
    
    # Get query parameters
    search = request.GET.get('search', '').strip()
    ordering = request.GET.get('ordering', 'name')
    
    # Base queryset with optimizations and zoned_count annotation
    from django.db.models import Count, Q as Q_models, Prefetch

    # Get customer for customer-scoped filtering
    customer = project.customers.first()

    # Get project filter parameter (default: 'all' shows all customer aliases)
    project_filter = request.GET.get('project_filter', 'all')

    # Get zones for this project via junction table (for zoned_count)
    project_zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)

    if project_filter == 'current':
        # Filter to current project only (old behavior)
        project_alias_ids = ProjectAlias.objects.filter(project=project).values_list('alias_id', flat=True)
        aliases_queryset = Alias.objects.select_related('fabric').filter(
            id__in=project_alias_ids
        )
    else:
        # Show all customer aliases (new default behavior)
        if customer:
            from django.db.models import Q, Count
            customer_fabric_ids = Fabric.objects.filter(customer=customer).values_list('id', flat=True)
            aliases_queryset = Alias.objects.select_related('fabric', 'created_by_project').filter(
                fabric_id__in=customer_fabric_ids
            )

            # Customer View filtering: Show aliases that are either:
            # 1. Committed (committed=True), OR
            # 2. Not referenced by any project (no junction table entries)
            aliases_queryset = aliases_queryset.annotate(
                project_count=Count('project_aliases')  # Correct relationship name
            ).filter(
                Q(committed=True) | Q(project_count=0)
            )
        else:
            # Fallback if no customer (shouldn't happen but handle gracefully)
            project_alias_ids = ProjectAlias.objects.filter(project=project).values_list('alias_id', flat=True)
            aliases_queryset = Alias.objects.select_related('fabric').filter(
                id__in=project_alias_ids
            )

    # Prefetch project memberships for badge display
    aliases_queryset = aliases_queryset.prefetch_related(
        Prefetch('project_memberships', queryset=ProjectAlias.objects.select_related('project'))
    )

    # Annotate with zoned_count
    aliases_queryset = aliases_queryset.annotate(
        _zoned_count=Count('zone', filter=Q_models(zone__id__in=project_zone_ids), distinct=True)
    )
    
    # Apply general search if provided
    if search:
        aliases_queryset = aliases_queryset.filter(
            Q(name__icontains=search) |
            Q(wwpn__icontains=search) |
            Q(notes__icontains=search) |
            Q(fabric__name__icontains=search) |
            Q(use__icontains=search) |
            Q(cisco_alias__icontains=search)
        )
    
    # Apply field-specific filters
    filter_params = {}
    storage_filter_value = None  # Track storage filtering separately

    for param, value in request.GET.items():
        # Handle storage_details.name filtering (computed field via Port.wwpn lookup)
        if param.startswith(('storage_details.name__', 'storage__name__')) or param in ['storage_details.name', 'storage__name']:
            storage_filter_value = (param, value)
            continue  # Skip adding to filter_params, will handle separately

        if param.startswith(('name__', 'wwpn__', 'use__', 'fabric__name__', 'host__name__', 'cisco_alias__', 'notes__', 'logged_in__', 'committed__', 'deployed__', 'zoned_count__')) or param in ['zoned_count', 'fabric__name', 'host__name', 'use', 'cisco_alias', 'logged_in', 'committed', 'deployed']:
            # Handle boolean field filtering - convert string representations back to actual booleans
            if any(param.startswith(f'{bool_field}__') for bool_field in ['logged_in', 'committed', 'deployed']):
                if param.endswith('__in'):
                    # Handle multi-select boolean filters (e.g., create__in=True,False)
                    boolean_values = []
                    for str_val in value.split(','):
                        str_val = str_val.strip()
                        if str_val.lower() == 'true':
                            boolean_values.append(True)
                        elif str_val.lower() == 'false':
                            boolean_values.append(False)
                    filter_params[param] = boolean_values
                else:
                    # Handle single boolean filters (e.g., create__exact=True)
                    if value.lower() == 'true':
                        filter_params[param] = True
                    elif value.lower() == 'false':
                        filter_params[param] = False
            else:
                # Handle calculated fields - map to annotated field names
                if param.startswith('zoned_count__'):
                    # Map zoned_count__ to _zoned_count__
                    mapped_param = param.replace('zoned_count__', '_zoned_count__')
                    # Handle multi-select values (comma-separated)
                    if param.endswith('__in') and isinstance(value, str) and ',' in value:
                        # Convert comma-separated string to list of integers
                        try:
                            filter_params[mapped_param] = [int(v.strip()) for v in value.split(',')]
                        except ValueError:
                            filter_params[mapped_param] = value.split(',')
                    elif param.endswith('__in') and isinstance(value, str):
                        # Handle single value in __in parameter
                        try:
                            filter_params[mapped_param] = [int(value.strip())]
                        except ValueError:
                            filter_params[mapped_param] = [value.strip()]
                    else:
                        # Handle single values - try to convert to int if possible
                        try:
                            filter_params[mapped_param] = int(value) if str(value).isdigit() else value
                        except (ValueError, AttributeError):
                            filter_params[mapped_param] = value
                elif param == 'zoned_count':
                    # Handle direct zoned_count equals filter
                    try:
                        filter_params['_zoned_count'] = int(value)
                    except ValueError:
                        filter_params['_zoned_count'] = value
                else:
                    # Handle non-boolean fields normally
                    filter_params[param] = value
    
    # Apply the filters
    if filter_params:
        print(f"🔍 Applying filters: {filter_params}")
        aliases_queryset = aliases_queryset.filter(**filter_params)
        print(f"📊 Filter result count: {aliases_queryset.count()}")

    # Apply storage filter if present (must be done via Port.wwpn lookup)
    if storage_filter_value:
        from storage.models import Port
        from san.models import AliasWWPN

        param, value = storage_filter_value
        print(f"🔍 Applying storage filter: {param} = {value}")

        # Get customer_id from project
        customer_id = project.customers.first().id if project.customers.exists() else None

        # Determine the filter operation
        if param.endswith('__icontains'):
            # Contains filter
            storage_names = Port.objects.filter(
                storage__isnull=False,
                storage__customer_id=customer_id if customer_id else None,
                storage__name__icontains=value
            ).values_list('storage__name', flat=True).distinct()
        elif param.endswith('__in'):
            # Multi-select filter (comma-separated values)
            storage_list = [v.strip() for v in value.split(',')]
            storage_names = storage_list
        else:
            # Exact match
            storage_names = [value]

        # OPTIMIZED: Use database query instead of Python iteration
        # Get WWPNs from ports with matching storage names (normalized, uppercase)
        from django.db.models import F
        from django.db.models.functions import Replace, Upper

        port_wwpns_query = Port.objects.filter(
            wwpn__isnull=False,
            storage__isnull=False,
            storage__name__in=storage_names
        )

        # Filter by customer if available
        if customer_id:
            port_wwpns_query = port_wwpns_query.filter(storage__customer_id=customer_id)

        # Get normalized WWPNs from ports (remove colons, uppercase)
        port_wwpns = set()
        for port in port_wwpns_query.values_list('wwpn', flat=True):
            if port:
                port_wwpns.add(port.replace(':', '').upper())

        print(f"🔍 Found {len(port_wwpns)} WWPNs matching storage filter")

        # Find aliases with matching WWPNs using database query on AliasWWPN table
        # This is much faster than iterating through all aliases in Python
        matching_wwpns = AliasWWPN.objects.filter(
            alias__in=aliases_queryset
        ).values_list('wwpn', 'alias_id')

        # Find matching alias IDs by comparing normalized WWPNs
        matching_alias_ids = set()
        for wwpn, alias_id in matching_wwpns:
            if wwpn:
                wwpn_normalized = wwpn.replace(':', '').upper()
                if wwpn_normalized in port_wwpns:
                    matching_alias_ids.add(alias_id)

        # Apply the filter
        aliases_queryset = aliases_queryset.filter(id__in=matching_alias_ids)
        print(f"📊 Storage filter result count: {len(matching_alias_ids)} aliases")

    # Apply ordering
    if ordering:
        aliases_queryset = aliases_queryset.order_by(ordering)
    
    # Add pagination for performance with large datasets
    from django.core.paginator import Paginator
    
    # Get pagination parameters
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 50))  # Default 50 aliases per page
    
    # Apply pagination
    paginator = Paginator(aliases_queryset, page_size)
    page_obj = paginator.get_page(page)
    
    # Serialize paginated results
    # Get customer_id from project
    customer_id = project.customers.first().id if project.customers.exists() else None

    # Build WWPN→Storage map for bulk lookup (performance optimization)
    # This prevents N+1 queries when serializing storage_details
    wwpn_storage_map = {}
    try:
        from storage.models import Port

        # Get all ports with storage for this customer
        ports_query = Port.objects.select_related('storage').filter(
            wwpn__isnull=False,
            storage__isnull=False
        )

        if customer_id:
            ports_query = ports_query.filter(storage__customer_id=customer_id)

        # Build the map: normalized_wwpn → storage_info
        for port in ports_query:
            if port.wwpn and port.storage:
                wwpn_normalized = port.wwpn.replace(':', '').upper()
                wwpn_storage_map[wwpn_normalized] = {
                    "id": port.storage.id,
                    "name": port.storage.name
                }

        print(f"🔧 Built WWPN→Storage map with {len(wwpn_storage_map)} entries for performance")
    except Exception as e:
        print(f"⚠️ Failed to build WWPN→Storage map: {e}")
        # Continue without the map - serializer will fall back to individual queries

    serializer = AliasSerializer(
        page_obj,
        many=True,
        context={
            'project_id': project_id,
            'customer_id': customer_id,
            'active_project_id': project_id,
            'wwpn_storage_map': wwpn_storage_map
        }
    )
    
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


@csrf_exempt
@require_http_methods(["GET"])
def alias_project_view(request, project_id):
    """
    Get aliases in project with field_overrides applied (merged view).
    Returns only aliases in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Performance optimized: Builds WWPN→Storage map and ProjectZone cache
    to avoid N+1 queries during serialization.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project (Project has ManyToMany customers relationship)
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get all ProjectAlias entries for this project
    project_aliases = ProjectAlias.objects.filter(
        project=project
    ).select_related(
        'alias',
        'alias__fabric',
        'alias__host',
        'alias__storage'
    ).prefetch_related(
        'alias__alias_wwpns',
        Prefetch('alias__project_memberships',
                 queryset=ProjectAlias.objects.select_related('project'))
    )

    # ===== PAGINATION =====
    from django.core.paginator import Paginator

    # Get pagination parameters
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', 50)

    # Handle "All" as a special case
    if page_size_param == 'All':
        page_size = None
        page_obj = None
        paginator = None
        total_count = project_aliases.count()
        project_aliases_page = project_aliases  # Use all results
    else:
        page_size = int(page_size_param)
        paginator = Paginator(project_aliases, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
        except:
            page_obj = paginator.get_page(1)
            page = 1

        project_aliases_page = page_obj.object_list  # Use only current page
    # ===== END PAGINATION =====

    # ===== PERFORMANCE OPTIMIZATION: Build maps before serialization =====
    # Build WWPN→Storage map to avoid N+1 queries in get_storage_details()
    from storage.models import Port
    wwpn_storage_map = {}

    # Only build WWPN map if we have a customer
    if customer_id:
        ports = Port.objects.select_related('storage').filter(
            storage__customer_id=customer_id,
            wwpn__isnull=False
        )

        for port in ports:
            if port.wwpn and port.storage:
                wwpn_normalized = port.wwpn.replace(':', '').upper()
                wwpn_storage_map[wwpn_normalized] = {
                    'id': port.storage.id,
                    'name': port.storage.name
                }

    # Build ProjectZone IDs for this project (used by get_zoned_count())
    project_zone_ids = set(
        ProjectZone.objects.filter(project_id=project_id).values_list('zone_id', flat=True)
    )

    # Build alias→zones map to avoid N+1 queries in get_zoned_count()
    # Query the Zone.members through-table once to get all alias-zone relationships
    alias_zones_map = {}
    if project_zone_ids:
        # Get all zone membership pairs for zones in this project
        zone_alias_pairs = Zone.members.through.objects.filter(
            zone_id__in=project_zone_ids
        ).values_list('alias_id', 'zone_id')

        # Build map: alias_id → set of zone_ids
        for alias_id, zone_id in zone_alias_pairs:
            if alias_id not in alias_zones_map:
                alias_zones_map[alias_id] = set()
            alias_zones_map[alias_id].add(zone_id)

    # Build serializer context with optimization data
    serializer_context = {
        'project_id': project_id,
        'active_project_id': project_id,
        'customer_id': customer_id,
        'wwpn_storage_map': wwpn_storage_map,
        'project_zone_ids': project_zone_ids,
        'alias_zones_map': alias_zones_map,  # New: pre-built alias→zones mapping
    }
    # ===== END PERFORMANCE OPTIMIZATION =====

    merged_data = []

    for pa in project_aliases_page:
        # Serialize base alias WITH optimization context
        base_data = AliasSerializer(pa.alias, context=serializer_context).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pa.field_overrides:
            print(f"🔍 ProjectAlias {pa.id}: field_overrides = {pa.field_overrides}")
            for field_name, override_value in pa.field_overrides.items():
                # Only apply if value actually differs from base
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                        print(f"  ✅ Field '{field_name}' modified: {base_data.get(field_name)} -> {override_value}")
                else:
                    # New field from override
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)
                    print(f"  ✅ New field '{field_name}' added: {override_value}")

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pa.action
        base_data['in_active_project'] = True

        print(f"✨ Final modified_fields for alias {pa.alias.name}: {modified_fields}")

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    # Add pagination metadata if paginated
    if paginator is not None:
        response_data.update({
            'num_pages': paginator.num_pages,
            'current_page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data)


@csrf_exempt
@require_http_methods(["GET"])
def alias_customer_list_view(request):
    """
    Fetch all aliases for a customer (without requiring a project).
    Use this endpoint when viewing customer-level data without an active project.
    """
    print(f"🔥 Alias Customer List - Customer ID from query params")

    # Get customer_id from query parameters
    customer_id = request.GET.get('customer_id')
    if not customer_id:
        return JsonResponse({"error": "customer_id parameter is required"}, status=400)

    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return JsonResponse({"error": f"Customer {customer_id} not found"}, status=404)

    # Check permissions
    user = request.user if request.user.is_authenticated else None
    if user and user.is_authenticated:
        from core.permissions import has_customer_access
        if not has_customer_access(user, customer):
            return JsonResponse({"error": "Permission denied"}, status=403)
    else:
        return JsonResponse({"error": "Authentication required"}, status=401)

    # Get query parameters
    search = request.GET.get('search', '').strip()
    ordering = request.GET.get('ordering', 'name')

    # Base queryset - filter by customer's fabrics
    from django.db.models import Q, Count
    customer_fabric_ids = Fabric.objects.filter(customer=customer).values_list('id', flat=True)
    aliases_queryset = Alias.objects.select_related('fabric', 'host', 'created_by_project').filter(
        fabric_id__in=customer_fabric_ids
    )

    # Customer View filtering: Show aliases that are either:
    # 1. Committed (committed=True), OR
    # 2. Not referenced by any project (no junction table entries)
    aliases_queryset = aliases_queryset.annotate(
        project_count=Count('project_aliases')  # Correct relationship name
    ).filter(
        Q(committed=True) | Q(project_count=0)
    )

    # Prefetch project memberships for badge display
    aliases_queryset = aliases_queryset.prefetch_related(
        Prefetch('project_memberships', queryset=ProjectAlias.objects.select_related('project'))
    )

    # Annotate with zoned_count (across all customer zones)
    from django.db.models import Count, Q as Q_models
    customer_zone_ids = Zone.objects.filter(fabric_id__in=customer_fabric_ids).values_list('id', flat=True)
    aliases_queryset = aliases_queryset.annotate(
        _zoned_count=Count('zone', filter=Q_models(zone__id__in=customer_zone_ids), distinct=True)
    )

    # Apply general search if provided
    if search:
        aliases_queryset = aliases_queryset.filter(
            Q(name__icontains=search) |
            Q(wwpn__icontains=search) |
            Q(notes__icontains=search) |
            Q(fabric__name__icontains=search) |
            Q(use__icontains=search) |
            Q(cisco_alias__icontains=search)
        )

    # Apply field-specific filters (same logic as project endpoint)
    filter_params = {}
    storage_filter_value = None

    for param, value in request.GET.items():
        if param.startswith(('storage_details.name__', 'storage__name__')) or param in ['storage_details.name', 'storage__name']:
            storage_filter_value = (param, value)
            continue

        if param.startswith(('name__', 'wwpn__', 'use__', 'fabric__name__', 'host__name__', 'cisco_alias__', 'notes__', 'logged_in__', 'committed__', 'deployed__', 'zoned_count__')) or param in ['zoned_count', 'fabric__name', 'host__name', 'use', 'cisco_alias', 'logged_in', 'committed', 'deployed']:
            # Handle boolean fields
            if any(param.startswith(f'{bool_field}__') for bool_field in ['logged_in', 'committed', 'deployed']):
                if param.endswith('__in'):
                    boolean_values = []
                    for str_val in value.split(','):
                        str_val = str_val.strip()
                        if str_val.lower() == 'true':
                            boolean_values.append(True)
                        elif str_val.lower() == 'false':
                            boolean_values.append(False)
                    filter_params[param] = boolean_values
                else:
                    if value.lower() == 'true':
                        filter_params[param] = True
                    elif value.lower() == 'false':
                        filter_params[param] = False
            else:
                # Handle calculated fields
                if param.startswith('zoned_count__'):
                    mapped_param = param.replace('zoned_count__', '_zoned_count__')
                    if param.endswith('__in') and isinstance(value, str) and ',' in value:
                        try:
                            filter_params[mapped_param] = [int(v.strip()) for v in value.split(',')]
                        except ValueError:
                            filter_params[mapped_param] = value.split(',')
                    elif param.endswith('__in') and isinstance(value, str):
                        try:
                            filter_params[mapped_param] = [int(value.strip())]
                        except ValueError:
                            filter_params[mapped_param] = [value.strip()]
                    else:
                        try:
                            filter_params[mapped_param] = int(value) if str(value).isdigit() else value
                        except (ValueError, AttributeError):
                            filter_params[mapped_param] = value
                elif param == 'zoned_count':
                    try:
                        filter_params['_zoned_count'] = int(value)
                    except ValueError:
                        filter_params['_zoned_count'] = value
                else:
                    filter_params[param] = value

    if filter_params:
        print(f"🔍 Applying filters: {filter_params}")
        aliases_queryset = aliases_queryset.filter(**filter_params)

    # Apply storage filter if present
    if storage_filter_value:
        from storage.models import Port
        from san.models import AliasWWPN

        param, value = storage_filter_value
        print(f"🔍 Applying storage filter: {param} = {value}")

        if param.endswith('__icontains'):
            storage_names = Port.objects.filter(
                storage__isnull=False,
                storage__customer_id=customer_id,
                storage__name__icontains=value
            ).values_list('storage__name', flat=True).distinct()
        elif param.endswith('__in'):
            storage_list = [v.strip() for v in value.split(',')]
            storage_names = storage_list
        else:
            storage_names = [value]

        port_wwpns_query = Port.objects.filter(
            wwpn__isnull=False,
            storage__isnull=False,
            storage__name__in=storage_names,
            storage__customer_id=customer_id
        )

        port_wwpns = set()
        for port in port_wwpns_query.values_list('wwpn', flat=True):
            if port:
                port_wwpns.add(port.replace(':', '').upper())

        matching_wwpns = AliasWWPN.objects.filter(
            alias__in=aliases_queryset
        ).values_list('wwpn', 'alias_id')

        matching_alias_ids = set()
        for wwpn, alias_id in matching_wwpns:
            if wwpn:
                wwpn_normalized = wwpn.replace(':', '').upper()
                if wwpn_normalized in port_wwpns:
                    matching_alias_ids.add(alias_id)

        aliases_queryset = aliases_queryset.filter(id__in=matching_alias_ids)

    # Apply ordering
    if ordering:
        aliases_queryset = aliases_queryset.order_by(ordering)

    # Pagination
    from django.core.paginator import Paginator
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 50))

    paginator = Paginator(aliases_queryset, page_size)
    page_obj = paginator.get_page(page)

    # Build WWPN→Storage map
    wwpn_storage_map = {}
    try:
        from storage.models import Port
        ports_query = Port.objects.select_related('storage').filter(
            wwpn__isnull=False,
            storage__isnull=False,
            storage__customer_id=customer_id
        )

        for port in ports_query:
            if port.wwpn and port.storage:
                wwpn_normalized = port.wwpn.replace(':', '').upper()
                wwpn_storage_map[wwpn_normalized] = {
                    "id": port.storage.id,
                    "name": port.storage.name
                }
    except Exception as e:
        print(f"⚠️ Failed to build WWPN→Storage map: {e}")

    serializer = AliasSerializer(
        page_obj,
        many=True,
        context={
            'customer_id': customer_id,
            'wwpn_storage_map': wwpn_storage_map
        }
    )

    return JsonResponse({
        'results': serializer.data,
        'count': paginator.count,
        'num_pages': paginator.num_pages,
        'current_page': page,
        'page_size': page_size,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous()
    })


@csrf_exempt
@require_http_methods(["GET"])
def get_unique_values_for_hosts(request, project, field_name):
    """Get unique values for a specific field from hosts in a project."""
    print(f"🔍 Getting unique values for host field: {field_name} in project {project.id}")
    
    from django.db.models import Q
    
    try:
        # Handle calculated fields
        if field_name == 'aliases_count':
            # Calculate aliases_count for all hosts and get unique values
            hosts_queryset = Host.objects.filter(project=project).annotate(
                _aliases_count=Count('alias_host', distinct=True)
            )
            unique_values = hosts_queryset.values_list('_aliases_count', flat=True).distinct().order_by('_aliases_count')
        elif field_name == 'storage_system':
            # For storage_system, we need to get values from both storage ForeignKey and storage_system CharField
            hosts_queryset = Host.objects.filter(project=project)
            
            # Get storage names from ForeignKey relationship
            storage_values = hosts_queryset.select_related('storage').exclude(storage=None).values_list('storage__name', flat=True).distinct()
            # Get storage_system values from CharField
            storage_system_values = hosts_queryset.exclude(storage_system__isnull=True).exclude(storage_system='').values_list('storage_system', flat=True).distinct()
            
            # Combine and deduplicate
            all_values = set(list(storage_values) + list(storage_system_values))
            unique_values = sorted([value for value in all_values if value])
            
            # Check if there are any hosts with no storage assigned
            hosts_without_storage = hosts_queryset.filter(
                Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')
            ).filter(
                Q(storage_system__isnull=True) | Q(storage_system='')
            ).exists()
            
            if hosts_without_storage:
                unique_values.append('Blank')
        else:
            # Base queryset for hosts in the project
            hosts_queryset = Host.objects.filter(project=project)
            
            # Map field names to actual model fields
            field_mapping = {
                'create': 'create',
                'name': 'name',
                'status': 'status',
                'host_type': 'host_type',
                'associated_resource': 'associated_resource',
                'volume_group': 'volume_group',
                'acknowledged': 'acknowledged',
                'natural_key': 'natural_key'
            }
            
            # Get the actual field name
            actual_field = field_mapping.get(field_name, field_name)
            
            # Get unique values for the field
            unique_values = hosts_queryset.values_list(actual_field, flat=True).distinct().order_by(actual_field)
        
        # Convert to list and handle different field types
        if field_name not in ['storage_system']:  # storage_system is already handled above
            unique_values = list(unique_values)
        
        # Handle boolean fields specially
        if field_name in ['create']:
            # For boolean fields, convert to consistent string representation
            boolean_values = set(unique_values)
            processed_booleans = []
            for value in boolean_values:
                if value is True:
                    processed_booleans.append('True')
                elif value is False:
                    processed_booleans.append('False')
            unique_values = sorted(processed_booleans)
        else:
            # For non-boolean fields, filter out None/null values
            unique_values = [value for value in unique_values if value is not None and str(value).strip() != '']
        
        print(f"✅ Found {len(unique_values)} unique values for host {field_name}: {unique_values}")
        
        return JsonResponse({
            'unique_values': unique_values
        })
        
    except Exception as e:
        print(f"❌ Error getting unique values for host {field_name}: {str(e)}")
        return JsonResponse({"error": f"Failed to get unique values: {str(e)}"}, status=500)


def hosts_by_project_view(request, project_id):
    """Fetch hosts belonging to a specific project."""
    print(f"🔥 Hosts by Project - Project ID: {project_id}")
    
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    
    # Get query parameters
    search = request.GET.get('search', '').strip()
    ordering = request.GET.get('ordering', 'name')
    page = request.GET.get('page', 1)
    page_size = request.GET.get('page_size', 50)
    format_type = request.GET.get('format', 'dropdown')
    
    print(f"🔍 Hosts API - Project: {project_id}, Search: '{search}', Page: {page}, PageSize: {page_size}, Format: {format_type}")
    
    # Check for unique values request
    unique_values_field = request.GET.get('unique_values')
    if unique_values_field:
        return get_unique_values_for_hosts(request, project, unique_values_field)
    
    # Base queryset
    # Host is linked to Storage which is linked to Customer
    # Project has many-to-many relationship with customers
    # So filter hosts by storage's customer being in project's customers
    hosts_queryset = Host.objects.filter(storage__customer__in=project.customers.all())
    print(f"🔍 Found {hosts_queryset.count()} hosts for project {project_id}")
    
    # Apply storage filtering if provided
    storage_id = request.GET.get('storage')
    if storage_id:
        try:
            hosts_queryset = hosts_queryset.filter(storage_id=int(storage_id))
            print(f"🔍 After storage ID filter (storage={storage_id}): {hosts_queryset.count()} hosts")
        except ValueError:
            # Invalid storage ID format, skip filtering
            print(f"❌ Invalid storage ID format: {storage_id}")
    
    # Apply search if provided
    if search:
        hosts_queryset = hosts_queryset.filter(
            Q(name__icontains=search) |
            Q(status__icontains=search) |
            Q(host_type__icontains=search) |
            Q(storage_system__icontains=search)
        )
        print(f"🔍 After search filter: {hosts_queryset.count()} hosts")
    
    # Apply count field filtering for table format
    if format_type == 'table':
        # Get count filter parameters
        aliases_count = request.GET.get('aliases_count')
        aliases_count__gte = request.GET.get('aliases_count__gte')
        aliases_count__lte = request.GET.get('aliases_count__lte')
        aliases_count__gt = request.GET.get('aliases_count__gt')
        aliases_count__lt = request.GET.get('aliases_count__lt')
        
        vols_count = request.GET.get('vols_count')
        vols_count__gte = request.GET.get('vols_count__gte')
        vols_count__lte = request.GET.get('vols_count__lte')
        vols_count__gt = request.GET.get('vols_count__gt')
        vols_count__lt = request.GET.get('vols_count__lt')
        
        fc_ports_count = request.GET.get('fc_ports_count')
        fc_ports_count__gte = request.GET.get('fc_ports_count__gte')
        fc_ports_count__lte = request.GET.get('fc_ports_count__lte')
        fc_ports_count__gt = request.GET.get('fc_ports_count__gt')
        fc_ports_count__lt = request.GET.get('fc_ports_count__lt')
        
        # Apply aliases_count filtering (using annotation since it's calculated)
        if any([aliases_count, aliases_count__gte, aliases_count__lte, aliases_count__gt, aliases_count__lt]):
            hosts_queryset = hosts_queryset.annotate(
                computed_aliases_count=Count('alias_host', distinct=True)
            )
            
            if aliases_count is not None:
                hosts_queryset = hosts_queryset.filter(computed_aliases_count=int(aliases_count))
                print(f"🔍 After aliases_count={aliases_count} filter: {hosts_queryset.count()} hosts")
            if aliases_count__gte is not None:
                hosts_queryset = hosts_queryset.filter(computed_aliases_count__gte=int(aliases_count__gte))
                print(f"🔍 After aliases_count__gte={aliases_count__gte} filter: {hosts_queryset.count()} hosts")
            if aliases_count__lte is not None:
                hosts_queryset = hosts_queryset.filter(computed_aliases_count__lte=int(aliases_count__lte))
                print(f"🔍 After aliases_count__lte={aliases_count__lte} filter: {hosts_queryset.count()} hosts")
            if aliases_count__gt is not None:
                hosts_queryset = hosts_queryset.filter(computed_aliases_count__gt=int(aliases_count__gt))
                print(f"🔍 After aliases_count__gt={aliases_count__gt} filter: {hosts_queryset.count()} hosts")
            if aliases_count__lt is not None:
                hosts_queryset = hosts_queryset.filter(computed_aliases_count__lt=int(aliases_count__lt))
                print(f"🔍 After aliases_count__lt={aliases_count__lt} filter: {hosts_queryset.count()} hosts")
        
        # Apply vols_count filtering (direct field filtering)
        if vols_count is not None:
            hosts_queryset = hosts_queryset.filter(vols_count=int(vols_count))
            print(f"🔍 After vols_count={vols_count} filter: {hosts_queryset.count()} hosts")
        if vols_count__gte is not None:
            hosts_queryset = hosts_queryset.filter(vols_count__gte=int(vols_count__gte))
        if vols_count__lte is not None:
            hosts_queryset = hosts_queryset.filter(vols_count__lte=int(vols_count__lte))
        if vols_count__gt is not None:
            hosts_queryset = hosts_queryset.filter(vols_count__gt=int(vols_count__gt))
        if vols_count__lt is not None:
            hosts_queryset = hosts_queryset.filter(vols_count__lt=int(vols_count__lt))
        
        # Apply fc_ports_count filtering (direct field filtering)
        if fc_ports_count is not None:
            hosts_queryset = hosts_queryset.filter(fc_ports_count=int(fc_ports_count))
            print(f"🔍 After fc_ports_count={fc_ports_count} filter: {hosts_queryset.count()} hosts")
        if fc_ports_count__gte is not None:
            hosts_queryset = hosts_queryset.filter(fc_ports_count__gte=int(fc_ports_count__gte))
        if fc_ports_count__lte is not None:
            hosts_queryset = hosts_queryset.filter(fc_ports_count__lte=int(fc_ports_count__lte))
        if fc_ports_count__gt is not None:
            hosts_queryset = hosts_queryset.filter(fc_ports_count__gt=int(fc_ports_count__gt))
        if fc_ports_count__lt is not None:
            hosts_queryset = hosts_queryset.filter(fc_ports_count__lt=int(fc_ports_count__lt))
    
    # Apply field-specific filters (similar to AliasTable and ZoneTable)
    from django.db.models import Q
    filter_params = {}
    for param, value in request.GET.items():
        if param.startswith(('name__', 'storage_system__', 'storage__name__', 'wwpns__', 'status__', 'host_type__', 'associated_resource__', 'volume_group__', 'acknowledged__', 'natural_key__', 'create__')) or param in ['name', 'storage_system', 'storage__name', 'wwpns', 'status', 'host_type', 'associated_resource', 'volume_group', 'acknowledged', 'natural_key', 'create']:
            # Handle boolean field filtering
            if any(param.startswith(f'{bool_field}__') for bool_field in ['create']):
                if param.endswith('__in'):
                    # Handle multi-select boolean filters
                    boolean_values = []
                    for str_val in value.split(','):
                        str_val = str_val.strip()
                        if str_val.lower() == 'true':
                            boolean_values.append(True)
                        elif str_val.lower() == 'false':
                            boolean_values.append(False)
                    filter_params[param] = boolean_values
                else:
                    # Handle single boolean filters
                    if value.lower() == 'true':
                        filter_params[param] = True
                    elif value.lower() == 'false':
                        filter_params[param] = False
            else:
                # Handle special field mappings
                if param == 'storage_system':
                    if value == 'Blank':
                        # Filter for hosts with no storage assigned (both ForeignKey and CharField are null/empty)
                        hosts_queryset = hosts_queryset.filter(
                            (Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')) &
                            (Q(storage_system__isnull=True) | Q(storage_system=''))
                        )
                        # Don't add to filter_params since we already applied the filter
                        continue
                    else:
                        # storage_system in the API comes from storage.name, so filter on the ForeignKey
                        filter_params['storage__name'] = value
                elif param.startswith('storage_system__'):
                    if param == 'storage_system__regex' and 'Blank' in value:
                        # Handle multi-select that includes "Blank" - need special logic
                        # Extract non-Blank values for regex, handle Blank separately
                        import re
                        # Parse the regex pattern to extract values
                        match = re.match(r'^\^?\(([^)]+)\)\$?$', value)
                        if match:
                            values = match.group(1).split('|')
                            non_blank_values = [v for v in values if v != 'Blank']
                            has_blank = 'Blank' in values
                            
                            if non_blank_values and has_blank:
                                # Include both non-blank storage systems AND blank ones
                                blank_filter = (Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')) & (Q(storage_system__isnull=True) | Q(storage_system=''))
                                if len(non_blank_values) == 1:
                                    non_blank_filter = Q(storage__name=non_blank_values[0])
                                else:
                                    non_blank_filter = Q(storage__name__regex=f"^({'|'.join(non_blank_values)})$")
                                hosts_queryset = hosts_queryset.filter(blank_filter | non_blank_filter)
                                continue
                            elif has_blank and not non_blank_values:
                                # Only "Blank" is selected
                                hosts_queryset = hosts_queryset.filter(
                                    (Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')) &
                                    (Q(storage_system__isnull=True) | Q(storage_system=''))
                                )
                                continue
                    
                    # Map storage_system__ lookups to storage__name__ lookups
                    mapped_param = param.replace('storage_system__', 'storage__name__')
                    filter_params[mapped_param] = value
                else:
                    # Handle non-boolean fields normally
                    filter_params[param] = value
    
    # Apply the filters
    if filter_params:
        print(f"🔍 Applying host filters: {filter_params}")
        hosts_queryset = hosts_queryset.filter(**filter_params)
        print(f"📊 Host filter result count: {hosts_queryset.count()}")
    
    # Apply ordering
    if ordering:
        hosts_queryset = hosts_queryset.order_by(ordering)
    
    # Get total count before pagination
    total_count = hosts_queryset.count()
    print(f"🔍 Total hosts after filters: {total_count}")
    
    if format_type == 'table':
        # Implement pagination for table format
        try:
            page = int(page)
            page_size = int(page_size)
        except (ValueError, TypeError):
            page = 1
            page_size = 50
            
        paginator = Paginator(hosts_queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Return full host data for table display with pagination
        hosts_data = []
        for host in page_obj:
            # Get aliases that reference this host
            from .models import Alias
            aliases_for_host = Alias.objects.filter(host=host)
            aliases_count = aliases_for_host.count()
            
            # Get WWPN details using the new HostWwpn model
            wwpn_details = host.get_all_wwpns()
            wwpns_string = host.get_wwpn_display_string()
            
            # Calculate WWPN reconciliation status
            manual_wwpns = host.host_wwpns.filter(source_type='manual')
            alias_wwpns = host.host_wwpns.filter(source_type='alias')
            total_wwpns = host.host_wwpns.count()
            
            if total_wwpns == 0:
                wwpn_status = "No WWPNs assigned"
                wwpn_status_level = "no_wwpns"
                wwpn_status_components = [{
                    "text": "No WWPNs assigned",
                    "type": "no_wwpns",
                    "color": "light"
                }]
            elif manual_wwpns.exists():
                # Host has manual WWPNs - check for matches
                manual_wwpn_values = [hw.wwpn for hw in manual_wwpns]
                matching_aliases_count = Alias.objects.filter(
                    projects=project,
                    host__isnull=True,  # Only unassigned aliases
                    wwpn__in=manual_wwpn_values
                ).count()
                
                manual_count = manual_wwpns.count()
                alias_count = alias_wwpns.count()
                
                if matching_aliases_count > 0:
                    # Build status message and components for mixed state
                    status_parts = []
                    status_components = []
                    
                    if alias_count > 0:
                        status_parts.append(f"{alias_count} matched")
                        status_components.append({
                            "text": f"{alias_count} matched",
                            "type": "matched",
                            "color": "success"
                        })
                    
                    if matching_aliases_count > 0:
                        status_parts.append(f"{matching_aliases_count} match{'es' if matching_aliases_count != 1 else ''} available")
                        status_components.append({
                            "text": f"{matching_aliases_count} match{'es' if matching_aliases_count != 1 else ''} available",
                            "type": "matches_available", 
                            "color": "warning"
                        })
                    
                    wwpn_status = ", ".join(status_parts)
                    wwpn_status_level = "matches_available"
                    wwpn_status_components = status_components
                else:
                    # No matches for manual WWPNs
                    status_components = []
                    
                    if alias_count > 0:
                        status_components.append({
                            "text": f"{alias_count} matched",
                            "type": "matched",
                            "color": "success"
                        })
                        status_components.append({
                            "text": f"{manual_count} manual",
                            "type": "manual_no_matches",
                            "color": "secondary"
                        })
                        wwpn_status = f"{alias_count} matched, {manual_count} manual"
                        wwpn_status_level = "mixed_no_matches"
                    else:
                        status_components.append({
                            "text": f"{manual_count} manual, no matches",
                            "type": "manual_no_matches",
                            "color": "secondary"
                        })
                        wwpn_status = f"{manual_count} manual, no matches"
                        wwpn_status_level = "no_matches"
                    
                    wwpn_status_components = status_components
            else:
                # Only alias-sourced WWPNs (all matched)
                alias_count = alias_wwpns.count()
                wwpn_status = f"All {alias_count} WWPN{'s' if alias_count != 1 else ''} matched"
                wwpn_status_level = "all_matched"
                wwpn_status_components = [{
                    "text": f"All {alias_count} WWPN{'s' if alias_count != 1 else ''} matched",
                    "type": "all_matched",
                    "color": "success"
                }]
            
            # Get storage system information
            storage_name = ""
            storage_id = None
            if host.storage:
                storage_name = host.storage.name
                storage_id = host.storage.id
            elif host.storage_system:
                # Fallback to storage_system CharField if no ForeignKey relation
                storage_name = host.storage_system

            host_data = {
                "id": host.id,
                "name": host.name,
                "storage_system": storage_name,
                "storage_id": storage_id,  # Include storage ID for reference
                "wwpns": wwpns_string,  # Use new HostWwpn model display string
                "wwpn_details": wwpn_details,  # Add detailed WWPN information with source tracking
                "wwpn_status": wwpn_status,  # WWPN reconciliation status
                "wwpn_status_level": wwpn_status_level,  # Status level for styling
                "wwpn_status_components": wwpn_status_components,  # Individual status components for multi-line display
                "status": host.status or "",
                "host_type": host.host_type or "",
                "aliases_count": aliases_count,
                "vols_count": host.vols_count or 0,
                "fc_ports_count": host.fc_ports_count or 0,
                "associated_resource": host.associated_resource or "",
                "volume_group": host.volume_group or "",
                "acknowledged": host.acknowledged or "",
                "last_data_collection": host.last_data_collection,
                "natural_key": host.natural_key or "",
                "create": host.create or False,  # Include the create field
                "imported": host.imported.isoformat() if host.imported else None,
                "updated": host.updated.isoformat() if host.updated else None,
            }
            hosts_data.append(host_data)
            
            # Debug logging
            if wwpn_details:
                print(f"🔍 Host '{host.name}' has {len(wwpn_details)} WWPNs: {wwpns_string[:50]}{'...' if len(wwpns_string) > 50 else ''}")
        
        print(f"🔍 Returning {len(hosts_data)} hosts for page {page}")
        
        # Return paginated response in the format GenericTable expects
        response_data = {
            "results": hosts_data,
            "count": total_count,
            "next": f"?page={page + 1}" if page_obj.has_next() else None,
            "previous": f"?page={page - 1}" if page_obj.has_previous() else None
        }
        
        return JsonResponse(response_data, safe=False)
    else:
        # Return simple list for dropdown usage
        hosts_data = [{"id": host.id, "name": host.name} for host in hosts_queryset]
        
        return JsonResponse(hosts_data, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def host_save_view(request):
    """Save or update multiple hosts."""
    print(f"🔥 Host Save - Method: {request.method}")

    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)

        # Handle single host creation (for AliasTable compatibility)
        if "name" in data and "project_id" in data:
            project_id = data.get("project_id")
            host_name = data.get("name", "").strip()

            if not project_id or not host_name:
                return JsonResponse({"error": "Project ID and host name are required."}, status=400)

            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                return JsonResponse({"error": "Project not found."}, status=404)

            # Check if user has permission to modify hosts (must be at least member)
            # Skip permission check if user is not authenticated (for development)
            if user:
                from core.permissions import can_modify_project
                if not can_modify_project(user, project):
                    return JsonResponse({"error": "Only project owners, members, and admins can modify hosts. Viewers have read-only access."}, status=403)
            
            # Check if host already exists in this project
            existing_host = Host.objects.filter(project=project, name=host_name).first()
            if existing_host:
                return JsonResponse({
                    "message": "Host already exists", 
                    "host": {"id": existing_host.id, "name": existing_host.name}
                })
            
            # Create new host
            new_host = Host.objects.create(project=project, name=host_name)
            print(f"✅ Created new host: {host_name} (ID: {new_host.id})")
            
            return JsonResponse({
                "message": "Host created successfully!", 
                "host": {"id": new_host.id, "name": new_host.name}
            })
        
        # Handle bulk host operations (for AllHostsTable)
        project_id = data.get("project_id")
        hosts_data = data.get("hosts", [])


        if not project_id or not hosts_data:
            return JsonResponse({"error": "Project ID and hosts data are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        # Check if user has permission to modify hosts (must be at least member)
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can modify hosts. Viewers have read-only access."}, status=403)
        
        saved_hosts = []
        errors = []
        
        for host_data in hosts_data:
            host_id = host_data.get("id")
            
            if host_id:
                # Update existing host
                try:
                    host = Host.objects.filter(id=host_id, project=project).first()
                    if host:
                        # Update host fields
                        host.name = host_data.get("name", host.name)
                        host.storage_system = host_data.get("storage_system", host.storage_system)
                        host.wwpns = host_data.get("wwpns", host.wwpns)
                        host.status = host_data.get("status", host.status)
                        host.host_type = host_data.get("host_type", host.host_type)
                        host.associated_resource = host_data.get("associated_resource", host.associated_resource)
                        host.volume_group = host_data.get("volume_group", host.volume_group)
                        host.acknowledged = host_data.get("acknowledged", host.acknowledged)
                        host.natural_key = host_data.get("natural_key", host.natural_key)
                        host.create = host_data.get("create", host.create)
                        
                        # Handle storage ForeignKey assignment
                        storage_id = host_data.get("storage")
                        if storage_id:
                            try:
                                from storage.models import Storage
                                storage = Storage.objects.get(id=storage_id)
                                host.storage = storage
                                print(f"✅ Assigned storage {storage.name} to host {host.name}")
                            except Storage.DoesNotExist:
                                print(f"❌ Storage with ID {storage_id} not found")
                                host.storage = None
                        else:
                            host.storage = None
                        
                        from django.utils import timezone
                        host.updated = timezone.now()
                        host.save()
                        
                        saved_hosts.append({"id": host.id, "name": host.name})
                        print(f"✅ Updated host: {host.name} (ID: {host.id})")
                    else:
                        errors.append({"host": host_data.get("name", "Unknown"), "error": "Host not found"})
                except Exception as e:
                    errors.append({"host": host_data.get("name", "Unknown"), "error": str(e)})
            else:
                # Create new host
                try:
                    host_name = host_data.get("name", "").strip()
                    if not host_name:
                        errors.append({"host": "Unknown", "error": "Host name is required"})
                        continue
                    
                    # Check if host already exists
                    existing_host = Host.objects.filter(project=project, name=host_name).first()
                    if existing_host:
                        errors.append({"host": host_name, "error": "Host already exists"})
                        continue
                    
                    # Handle storage ForeignKey assignment for new host
                    storage_obj = None
                    storage_id = host_data.get("storage")
                    if storage_id:
                        try:
                            from storage.models import Storage
                            storage_obj = Storage.objects.get(id=storage_id)
                            print(f"✅ Found storage {storage_obj.name} for new host {host_name}")
                        except Storage.DoesNotExist:
                            print(f"❌ Storage with ID {storage_id} not found for new host")
                    
                    new_host = Host.objects.create(
                        project=project,
                        name=host_name,
                        storage=storage_obj,  # Set the ForeignKey
                        storage_system=host_data.get("storage_system", ""),
                        wwpns=host_data.get("wwpns", ""),
                        status=host_data.get("status", ""),
                        host_type=host_data.get("host_type", ""),
                        associated_resource=host_data.get("associated_resource", ""),
                        volume_group=host_data.get("volume_group", ""),
                        acknowledged=host_data.get("acknowledged", ""),
                        natural_key=host_data.get("natural_key", ""),
                        create=host_data.get("create", False)
                    )
                    
                    from django.utils import timezone
                    new_host.updated = timezone.now()
                    new_host.save()
                    
                    saved_hosts.append({"id": new_host.id, "name": new_host.name})
                    print(f"✅ Created new host: {host_name} (ID: {new_host.id})")
                    
                except Exception as e:
                    errors.append({"host": host_data.get("name", "Unknown"), "error": str(e)})
        
        if errors:
            return JsonResponse({"error": "Some hosts could not be saved.", "details": errors}, status=400)
        
        return JsonResponse({"message": "Hosts saved successfully!", "hosts": saved_hosts})
        
    except Exception as e:
        print(f"❌ Error saving hosts: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def host_delete_view(request, pk):
    """Delete a host."""
    print(f"🔥 Host Delete - PK: {pk}, Method: {request.method}")
    print(f"🔍 Request path: {request.path}")
    print(f"🔍 Request headers: {dict(request.headers)}")

    user = request.user if request.user.is_authenticated else None

    # Check for force parameter
    force_delete = request.GET.get('force', 'false').lower() == 'true'
    print(f"🔍 Force delete: {force_delete}")

    try:
        host = Host.objects.get(pk=pk)

        # Check if user has permission to delete hosts
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, host.project):
                return JsonResponse({"error": "Only project owners, members, and admins can delete hosts. Viewers have read-only access."}, status=403)

        host_name = host.name
        project_id = host.project.id
        
        print(f"🔍 Found host: {host_name} (ID: {pk}) in project: {project_id}")
        
        # Check if host is being used by any aliases
        from .models import Alias
        aliases_using_host = Alias.objects.filter(host=host)
        
        if aliases_using_host.exists():
            alias_list = [{"id": alias.id, "name": alias.name} for alias in aliases_using_host]
            print(f"🔍 Host {host_name} is being used by {aliases_using_host.count()} aliases: {[a['name'] for a in alias_list]}")
            
            if not force_delete:
                # Return list of aliases for confirmation modal
                return JsonResponse({
                    "requires_confirmation": True,
                    "host_name": host_name,
                    "aliases": alias_list,
                    "message": f"Host '{host_name}' is being used by {len(alias_list)} aliases. Deleting will remove host references from these aliases."
                }, status=409)  # 409 Conflict - requires user decision
            else:
                # Force delete - remove host references from aliases first
                print(f"🔄 Removing host references from {aliases_using_host.count()} aliases")
                aliases_using_host.update(host=None)
                print(f"✅ Cleared host references from aliases: {[a['name'] for a in alias_list]}")
        
        # Delete the host
        host.delete()
        print(f"✅ Successfully deleted host: {host_name} (ID: {pk})")
        
        return JsonResponse({
            "message": f"Host '{host_name}' deleted successfully!",
            "cleared_aliases": alias_list if aliases_using_host.exists() else []
        })
        
    except Host.DoesNotExist:
        print(f"❌ Host with ID {pk} not found")
        return JsonResponse({"error": "Host not found."}, status=404)
    except Exception as e:
        print(f"❌ Unexpected error deleting host {pk}: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def assign_host_to_alias_view(request):
    """Assign a host to an alias."""
    try:
        data = json.loads(request.body)
        alias_id = data.get('alias_id')
        host_id = data.get('host_id')
        
        if not alias_id or not host_id:
            return JsonResponse({"error": "Both alias_id and host_id are required."}, status=400)
        
        try:
            alias = Alias.objects.get(id=alias_id)
            from storage.models import Host
            host = Host.objects.get(id=host_id)
        except Alias.DoesNotExist:
            return JsonResponse({"error": "Alias not found."}, status=404)
        except Host.DoesNotExist:
            return JsonResponse({"error": "Host not found."}, status=404)
        
        # Check if alias is already assigned to a different host
        if alias.host and alias.host.id != host_id:
            return JsonResponse({
                "error": f"Alias '{alias.name}' is already assigned to host '{alias.host.name}'."
            }, status=400)
        
        # Check if alias use type is appropriate for host assignment
        if alias.use and alias.use != 'init':
            return JsonResponse({
                "error": f"Only initiator aliases (use=init) can be assigned to hosts. This alias has use='{alias.use}'."
            }, status=400)
        
        # Assign the host to the alias
        alias.host = host
        if not alias.use:
            alias.use = 'init'  # Set to initiator if not already set
        
        # Update the timestamp
        from django.utils import timezone
        alias.updated = timezone.now()
        alias.save()
        
        return JsonResponse({
            "success": True,
            "message": f"Host '{host.name}' assigned to alias '{alias.name}'. WWPN {alias.wwpn} will now appear in the host's WWPN list.",
            "alias": {
                "id": alias.id,
                "name": alias.name,
                "wwpn": alias.wwpn,
                "use": alias.use,
                "fabric_name": alias.fabric.name
            },
            "host": {
                "id": host.id,
                "name": host.name
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data."}, status=400)
    except Exception as e:
        print(f"❌ Error assigning host to alias: {e}")
        return JsonResponse({"error": f"Error assigning host to alias: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def host_wwpn_reconciliation_view(request, host_id):
    """Get WWPN reconciliation data for a specific host."""
    try:
        from storage.models import Host
        host = Host.objects.get(id=host_id)
        project = host.project
        
        # Get all manual WWPNs for this host
        manual_wwpns = host.host_wwpns.filter(source_type='manual')
        
        # Get all unassigned aliases in the same project with matching WWPNs
        unassigned_aliases = Alias.objects.filter(
            projects=project,
            host__isnull=True,  # Only unassigned aliases
            wwpn__in=[hw.wwpn for hw in manual_wwpns]
        ).select_related('fabric')
        
        # Build match data
        matches = []
        for manual_wwpn in manual_wwpns:
            matching_aliases = [alias for alias in unassigned_aliases if alias.wwpn == manual_wwpn.wwpn]
            if matching_aliases:
                matches.append({
                    'wwpn': manual_wwpn.wwpn,
                    'host_wwpn_id': manual_wwpn.id,
                    'matching_aliases': [{
                        'id': alias.id,
                        'name': alias.name,
                        'fabric_name': alias.fabric.name,
                        'fabric_id': alias.fabric.id,
                        'use': alias.use,
                        'created': alias.imported.isoformat() if alias.imported else None
                    } for alias in matching_aliases]
                })
        
        # Calculate status
        total_manual_wwpns = manual_wwpns.count()
        wwpns_with_matches = len(matches)
        total_potential_matches = sum(len(match['matching_aliases']) for match in matches)
        
        if total_manual_wwpns == 0:
            status = 'no_manual_wwpns'
            status_text = 'No Manual WWPNs'
        elif wwpns_with_matches == 0:
            status = 'no_matches'
            status_text = 'No Matches Available'
        else:
            status = 'matches_available'
            status_text = f'{total_potential_matches} Match{"es" if total_potential_matches != 1 else ""} Found'
        
        return JsonResponse({
            'host_id': host.id,
            'host_name': host.name,
            'project_id': project.id,
            'project_name': project.name,
            'status': status,
            'status_text': status_text,
            'total_manual_wwpns': total_manual_wwpns,
            'wwpns_with_matches': wwpns_with_matches,
            'total_potential_matches': total_potential_matches,
            'matches': matches
        })
        
    except Host.DoesNotExist:
        return JsonResponse({"error": "Host not found."}, status=404)
    except Exception as e:
        print(f"❌ Error getting WWPN reconciliation data: {e}")
        return JsonResponse({"error": f"Error getting reconciliation data: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def alias_save_view(request):
    """Save or update aliases for multiple projects."""
    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        aliases_data = data.get("aliases", [])

        if not project_id or not aliases_data:
            return JsonResponse({"error": "Project ID and aliases data are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        # Check if user has permission to modify aliases (must be at least member)
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can modify aliases. Viewers have read-only access."}, status=403)

        saved_aliases = []
        errors = []

        for alias_data in aliases_data:
            alias_id = alias_data.get("id")

            # Ensure projects is a list (since it's many-to-many)
            projects_list = alias_data.pop("projects", [project_id])  # Defaults to the current project

            # Handle host assignment - check if it's a new hostname that needs to be created
            host_name = alias_data.get("host_name")
            if host_name and isinstance(host_name, str):
                # Try to find existing host by name with the same storage system
                storage_id = alias_data.get("storage")
                existing_host = None
                if storage_id:
                    existing_host = Host.objects.filter(storage_id=storage_id, name=host_name).first()

                if existing_host:
                    alias_data["host"] = existing_host.id
                else:
                    # Create new host - needs storage system
                    if storage_id:
                        new_host = Host.objects.create(
                            storage_id=storage_id,
                            name=host_name,
                            committed=False,
                            deployed=False,
                            created_by_project=project
                        )
                        alias_data["host"] = new_host.id
                        # Auto-add host to project
                        ProjectHost.objects.create(
                            project=project,
                            host=new_host,
                            action='new',
                            added_by=user
                        )
                        print(f"✅ Created new host: {host_name} (ID: {new_host.id})")

                # Remove host_name from alias_data as it's not a model field
                alias_data.pop("host_name", None)

            if alias_id:
                alias = Alias.objects.filter(id=alias_id).first()
                if alias:
                    # Optimistic locking - check version
                    client_version = alias_data.get('version')
                    if client_version is not None and alias.version != client_version:
                        # Version mismatch - someone else modified this alias
                        errors.append({
                            "alias": alias_data.get("name", "Unknown"),
                            "errors": {
                                "version": f"Conflict: This alias was modified by {alias.last_modified_by.username if alias.last_modified_by else 'another user'} at {alias.last_modified_at}. Please refresh and try again.",
                                "current_version": alias.version,
                                "last_modified_by": alias.last_modified_by.username if alias.last_modified_by else None,
                                "last_modified_at": alias.last_modified_at.isoformat() if alias.last_modified_at else None
                            }
                        })
                        continue

                    # Validate the incoming data
                    serializer = AliasSerializer(alias, data=alias_data, partial=True)
                    if serializer.is_valid():
                        # Extract only changed fields using field_merge utility
                        from core.utils.field_merge import extract_changed_fields

                        # Get validated data
                        validated_data = serializer.validated_data.copy()

                        # Remove write-only fields that shouldn't be compared
                        write_only_fields = ['wwpns_write']
                        for field in write_only_fields:
                            validated_data.pop(field, None)

                        # Extract only fields that actually changed
                        changed_fields = extract_changed_fields(alias, validated_data)

                        if changed_fields or 'wwpns_write' in serializer.validated_data:
                            # Get or create ProjectAlias for this project
                            project_alias, pa_created = ProjectAlias.objects.get_or_create(
                                project=project,
                                alias=alias,
                                defaults={
                                    'action': 'reference',
                                    'added_by': user,
                                    'field_overrides': {}
                                }
                            )

                            # Update field_overrides with new changes
                            # Merge existing overrides with new changes
                            current_overrides = project_alias.field_overrides or {}
                            current_overrides.update(changed_fields)
                            project_alias.field_overrides = current_overrides

                            # Update action to 'modified' unless it's already 'new'
                            if project_alias.action not in ['new', 'delete']:
                                project_alias.action = 'modified'

                            project_alias.added_by = user
                            project_alias.save()

                            # Handle WWPN updates if present (these still need to update the actual alias)
                            if 'wwpns_write' in serializer.validated_data:
                                wwpns_data = serializer.validated_data['wwpns_write']
                                # Delete existing WWPNs
                                alias.alias_wwpns.all().delete()
                                # Create new WWPNs
                                for order, wwpn_str in enumerate(wwpns_data):
                                    AliasWWPN.objects.create(
                                        alias=alias,
                                        wwpn=wwpn_str,
                                        order=order
                                    )

                            print(f"✏️ Stored field overrides for alias '{alias.name}' in project '{project.name}': {changed_fields}")

                        # Return the base alias data (not modified)
                        saved_aliases.append(AliasSerializer(alias).data)
                    else:
                        errors.append({"alias": alias_data.get("name", "Unknown"), "errors": serializer.errors})
            else:
                # Create new alias
                serializer = AliasSerializer(data=alias_data)
                if serializer.is_valid():
                    alias = serializer.save(
                        committed=False,
                        deployed=False,
                        created_by_project=project
                    )
                    alias.updated = timezone.now()
                    if user:
                        alias.last_modified_by = user
                    alias.save(update_fields=["updated", "last_modified_by"])

                    # Auto-add to current project via junction table
                    ProjectAlias.objects.create(
                        project=project,
                        alias=alias,
                        action='new',
                        include_in_zoning=False,
                        added_by=user,
                        notes='Auto-created with alias'
                    )

                    saved_aliases.append(serializer.data)
                else:
                    errors.append({"alias": alias_data.get("name", "Unknown"), "errors": serializer.errors})

        if errors:
            return JsonResponse({"error": "Some aliases could not be saved.", "details": errors}, status=400)

        # Clear dashboard cache when aliases are saved
        # Get customer through project's customers relationship
        customer = project.customers.first()
        if customer:
            clear_dashboard_cache_for_customer(customer.id)
        
        return JsonResponse({"message": "Aliases saved successfully!", "aliases": saved_aliases})
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def alias_delete_view(request, pk):
    """Delete an alias."""
    print(f"🔥 Alias Delete - PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        alias = Alias.objects.get(pk=pk)

        # Check permission on the first project this alias belongs to
        # Skip permission check if user is not authenticated (for development)
        project_alias = ProjectAlias.objects.filter(alias=alias).select_related('project').first()
        if user and project_alias:
            project = project_alias.project
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can delete aliases. Viewers have read-only access."}, status=403)
        customer_id = None
        # Get customer ID from fabric (aliases are customer-scoped via fabric)
        if alias.fabric and alias.fabric.customer:
            customer_id = alias.fabric.customer.id
        print(f'Deleting Alias: {alias.name}')
        Alias.objects.filter(pk=alias.pk).delete()
        
        # Clear dashboard cache when alias is deleted
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)
            
        return JsonResponse({"message": "Alias deleted successfully."})
    except Alias.DoesNotExist:
        return JsonResponse({"error": "Alias not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def zones_by_project_view(request, project_id):
    """Fetch zones belonging to a specific project."""
    print(f"🔥 Zones by Project - Project ID: {project_id}")
    
    try:
        # Verify project exists
        project = Project.objects.get(id=project_id)
        
        # Check for unique values request
        unique_values_field = request.GET.get('unique_values')
        if unique_values_field:
            return get_unique_values_for_zones(request, project, unique_values_field)
        
        # Get query parameters
        search = request.GET.get('search', '')
        ordering = request.GET.get('ordering', 'id')

        # Build queryset with optimized prefetching to avoid N+1 queries
        # Prefetch members with only the fields we need (id, name, use)
        # This loads ALL members for ALL zones in a SINGLE additional query
        optimized_members_prefetch = Prefetch(
            'members',
            queryset=Alias.objects.only('id', 'name', 'use', 'fabric_id')
        )

        # Get customer for customer-scoped filtering
        customer = project.customers.first()

        # Get project filter parameter (default: 'all' shows all customer zones)
        project_filter = request.GET.get('project_filter', 'all')

        if project_filter == 'current':
            # Filter to current project only (old behavior)
            project_zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)
            zones = Zone.objects.select_related('fabric').filter(id__in=project_zone_ids)
        else:
            # Show all customer zones (new default behavior)
            if customer:
                from django.db.models import Q, Count
                customer_fabric_ids = Fabric.objects.filter(customer=customer).values_list('id', flat=True)
                zones = Zone.objects.select_related('fabric', 'created_by_project').filter(fabric_id__in=customer_fabric_ids)

                # Customer View filtering: Show zones that are either:
                # 1. Committed (committed=True), OR
                # 2. Not referenced by any project (no junction table entries)
                zones = zones.annotate(
                    project_count=Count('project_zones')  # Correct relationship name
                ).filter(
                    Q(committed=True) | Q(project_count=0)
                )
            else:
                # Fallback if no customer (shouldn't happen but handle gracefully)
                project_zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)
                zones = Zone.objects.select_related('fabric').filter(id__in=project_zone_ids)

        # Prefetch project memberships for badge display
        zones = zones.prefetch_related(
            Prefetch('project_memberships', queryset=ProjectZone.objects.select_related('project'))
        )

        # Build optimized query with prefetch_related to eliminate N+1 queries
        zones = zones.prefetch_related(optimized_members_prefetch).annotate(
            _member_count=Count('members', distinct=True)
        )
        
        # Apply general search if provided
        if search:
            zones = zones.filter(
                Q(name__icontains=search) | 
                Q(fabric__name__icontains=search) |
                Q(zone_type__icontains=search) |
                Q(notes__icontains=search) |
                Q(members__name__icontains=search)
            ).distinct()  # distinct() because of the members join
        
        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith(('name__', 'fabric__name__', 'zone_type__', 'notes__', 'exists__', 'committed__', 'deployed__', 'member_count__')) or param in ['fabric__name', 'zone_type', 'exists', 'committed', 'deployed', 'member_count']:
                # Handle boolean field filtering - convert string representations back to actual booleans
                if any(param.startswith(f'{bool_field}__') for bool_field in ['exists', 'committed', 'deployed']):
                    if param.endswith('__in'):
                        # Handle multi-select boolean filters (e.g., create__in=True,False)
                        boolean_values = []
                        for str_val in value.split(','):
                            str_val = str_val.strip()
                            if str_val.lower() == 'true':
                                boolean_values.append(True)
                            elif str_val.lower() == 'false':
                                boolean_values.append(False)
                        filter_params[param] = boolean_values
                    else:
                        # Handle single boolean filters (e.g., create__exact=True)
                        if value.lower() == 'true':
                            filter_params[param] = True
                        elif value.lower() == 'false':
                            filter_params[param] = False
                else:
                    # Handle calculated fields - map to annotated field names
                    if param.startswith('member_count__'):
                        # Map member_count__ to _member_count__
                        mapped_param = param.replace('member_count__', '_member_count__')
                        # Handle multi-select values (comma-separated)
                        if param.endswith('__in') and isinstance(value, str) and ',' in value:
                            # Convert comma-separated string to list of integers
                            try:
                                filter_params[mapped_param] = [int(v.strip()) for v in value.split(',')]
                            except ValueError:
                                filter_params[mapped_param] = value.split(',')
                        elif param.endswith('__in') and isinstance(value, str):
                            # Handle single value in __in parameter
                            try:
                                filter_params[mapped_param] = [int(value.strip())]
                            except ValueError:
                                filter_params[mapped_param] = [value.strip()]
                        else:
                            # Handle single values - try to convert to int if possible
                            try:
                                filter_params[mapped_param] = int(value) if str(value).isdigit() else value
                            except (ValueError, AttributeError):
                                filter_params[mapped_param] = value
                    elif param == 'member_count':
                        # Handle direct member_count equals filter
                        try:
                            filter_params['_member_count'] = int(value)
                        except ValueError:
                            filter_params['_member_count'] = value
                    else:
                        # Handle non-boolean fields normally
                        filter_params[param] = value
        
        # Apply the filters
        if filter_params:
            zones = zones.filter(**filter_params)
        
        # Apply ordering
        if ordering:
            zones = zones.order_by(ordering)
        
        # Add pagination for performance with large datasets
        from django.core.paginator import Paginator
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))  # Default 50 zones per page
        
        # Apply pagination
        paginator = Paginator(zones, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize paginated results
        serializer = ZoneSerializer(
            page_obj,
            many=True,
            context={
                'active_project_id': project_id
            }
        )

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
        
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def zone_project_view(request, project_id):
    """
    Get zones in project with field_overrides applied (merged view).
    Returns only zones in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.

    Performance optimized: Passes context to serializer to avoid N+1 queries.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project (Project has ManyToMany customers relationship)
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get all ProjectZone entries for this project
    project_zones = ProjectZone.objects.filter(
        project=project
    ).select_related(
        'zone',
        'zone__fabric'
    ).prefetch_related(
        'zone__members',
        Prefetch('zone__project_memberships',
                 queryset=ProjectZone.objects.select_related('project'))
    )

    # ===== PAGINATION =====
    from django.core.paginator import Paginator

    # Get pagination parameters
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', 50)

    # Handle "All" as a special case
    if page_size_param == 'All':
        page_size = None
        page_obj = None
        paginator = None
        total_count = project_zones.count()
        project_zones_page = project_zones  # Use all results
    else:
        page_size = int(page_size_param)
        paginator = Paginator(project_zones, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
        except:
            page_obj = paginator.get_page(1)
            page = 1

        project_zones_page = page_obj.object_list  # Use only current page
    # ===== END PAGINATION =====

    # ===== PERFORMANCE OPTIMIZATION: Build serializer context =====
    serializer_context = {
        'project_id': project_id,
        'active_project_id': project_id,
        'customer_id': customer_id,
    }
    # ===== END PERFORMANCE OPTIMIZATION =====

    merged_data = []

    for pz in project_zones_page:
        # Serialize base zone WITH optimization context
        base_data = ZoneSerializer(pz.zone, context=serializer_context).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pz.field_overrides:
            for field_name, override_value in pz.field_overrides.items():
                # Skip member_ids (handled separately)
                if field_name == 'member_ids':
                    continue

                # Only apply if value actually differs from base
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pz.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    # Add pagination metadata if paginated
    if paginator is not None:
        response_data.update({
            'num_pages': paginator.num_pages,
            'current_page': page,
            'page_size': page_size,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })

    return JsonResponse(response_data)


@csrf_exempt
@require_http_methods(["GET"])
def zone_customer_list_view(request):
    """
    Fetch all zones for a customer (without requiring a project).
    Use this endpoint when viewing customer-level data without an active project.
    """
    print(f"🔥 Zone Customer List - Customer ID from query params")

    # Get customer_id from query parameters
    customer_id = request.GET.get('customer_id')
    if not customer_id:
        return JsonResponse({"error": "customer_id parameter is required"}, status=400)

    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return JsonResponse({"error": f"Customer {customer_id} not found"}, status=404)

    # Check permissions
    user = request.user if request.user.is_authenticated else None
    if user and user.is_authenticated:
        from core.permissions import has_customer_access
        if not has_customer_access(user, customer):
            return JsonResponse({"error": "Permission denied"}, status=403)
    else:
        return JsonResponse({"error": "Authentication required"}, status=401)

    # Get query parameters
    search = request.GET.get('search', '')
    ordering = request.GET.get('ordering', 'id')

    # Build queryset with optimized prefetching
    optimized_members_prefetch = Prefetch(
        'members',
        queryset=Alias.objects.only('id', 'name', 'use', 'fabric_id')
    )

    # Base queryset - filter by customer's fabrics
    from django.db.models import Q, Count
    customer_fabric_ids = Fabric.objects.filter(customer=customer).values_list('id', flat=True)
    zones = Zone.objects.select_related('fabric', 'created_by_project').filter(fabric_id__in=customer_fabric_ids)

    # Customer View filtering: Show zones that are either:
    # 1. Committed (committed=True), OR
    # 2. Not referenced by any project (no junction table entries)
    zones = zones.annotate(
        project_count=Count('project_zones')  # Correct relationship name
    ).filter(
        Q(committed=True) | Q(project_count=0)
    )

    # Prefetch project memberships for badge display
    zones = zones.prefetch_related(
        Prefetch('project_memberships', queryset=ProjectZone.objects.select_related('project'))
    )

    # Build optimized query with prefetch_related
    zones = zones.prefetch_related(optimized_members_prefetch).annotate(
        _member_count=Count('members', distinct=True)
    )

    # Apply general search if provided
    if search:
        zones = zones.filter(
            Q(name__icontains=search) |
            Q(fabric__name__icontains=search) |
            Q(zone_type__icontains=search) |
            Q(notes__icontains=search) |
            Q(members__name__icontains=search)
        ).distinct()

    # Apply field-specific filters
    filter_params = {}
    for param, value in request.GET.items():
        if param.startswith(('name__', 'fabric__name__', 'zone_type__', 'notes__', 'exists__', 'committed__', 'deployed__', 'member_count__')) or param in ['fabric__name', 'zone_type', 'exists', 'committed', 'deployed', 'member_count']:
            # Handle boolean fields
            if any(param.startswith(f'{bool_field}__') for bool_field in ['exists', 'committed', 'deployed']):
                if param.endswith('__in'):
                    boolean_values = []
                    for str_val in value.split(','):
                        str_val = str_val.strip()
                        if str_val.lower() == 'true':
                            boolean_values.append(True)
                        elif str_val.lower() == 'false':
                            boolean_values.append(False)
                    filter_params[param] = boolean_values
                else:
                    if value.lower() == 'true':
                        filter_params[param] = True
                    elif value.lower() == 'false':
                        filter_params[param] = False
            else:
                # Handle calculated fields
                if param.startswith('member_count__'):
                    mapped_param = param.replace('member_count__', '_member_count__')
                    if param.endswith('__in') and isinstance(value, str) and ',' in value:
                        try:
                            filter_params[mapped_param] = [int(v.strip()) for v in value.split(',')]
                        except ValueError:
                            filter_params[mapped_param] = value.split(',')
                    elif param.endswith('__in') and isinstance(value, str):
                        try:
                            filter_params[mapped_param] = [int(value.strip())]
                        except ValueError:
                            filter_params[mapped_param] = [value.strip()]
                    else:
                        try:
                            filter_params[mapped_param] = int(value) if str(value).isdigit() else value
                        except (ValueError, AttributeError):
                            filter_params[mapped_param] = value
                elif param == 'member_count':
                    try:
                        filter_params['_member_count'] = int(value)
                    except ValueError:
                        filter_params['_member_count'] = value
                else:
                    filter_params[param] = value

    if filter_params:
        zones = zones.filter(**filter_params)

    # Apply ordering
    if ordering:
        zones = zones.order_by(ordering)

    # Pagination
    from django.core.paginator import Paginator
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 50))

    paginator = Paginator(zones, page_size)
    page_obj = paginator.get_page(page)

    # Serialize paginated results
    serializer = ZoneSerializer(
        page_obj,
        many=True,
        context={'customer_id': customer_id}
    )

    return JsonResponse({
        'results': serializer.data,
        'count': paginator.count,
        'num_pages': paginator.num_pages,
        'current_page': page,
        'page_size': page_size,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous()
    })


@csrf_exempt
@require_http_methods(["GET"])
def zone_max_members_view(request, project_id):
    """Get the maximum number of members across all zones in a project."""
    print(f"🔥 Zone Max Members - Project ID: {project_id}")
    
    try:
        # Verify project exists
        project = Project.objects.get(id=project_id)
        print(f"  ✅ Project found: {project.name}")
        
        # Get all zones for this project with their members
        zones = Zone.objects.prefetch_related('members').filter(projects=project)
        total_zones = zones.count()
        print(f"  📊 Total zones in project: {total_zones}")
        
        max_members = 0
        max_zone_name = None
        
        for zone in zones:
            member_count = zone.members.count()
            print(f"  🔍 Zone {zone.name} has {member_count} members")
            if member_count > max_members:
                max_members = member_count
                max_zone_name = zone.name
                print(f"    📊 New max: {member_count} members in zone {zone.name}")
        
        print(f"✅ Maximum members across all zones: {max_members} (zone: {max_zone_name})")
        return JsonResponse({
            "max_members": max_members, 
            "max_zone_name": max_zone_name,
            "total_zones": total_zones
        })
        
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def zone_column_requirements(request, project_id):
    """Lightweight endpoint to get zone column requirements without fetching all zone data"""
    try:
        project = Project.objects.get(pk=project_id)
        
        # Get zones with member counts, using prefetch for efficiency
        # Use junction table to get zones for this project
        project_zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)
        zones = Zone.objects.filter(id__in=project_zone_ids).prefetch_related('members')
        
        # Calculate maximum members across all zones
        max_members = 0
        total_zones = zones.count()
        
        for zone in zones:
            member_count = zone.members.count()
            max_members = max(max_members, member_count)
        
        # Add a few extra columns for buffer
        recommended_columns = max(max_members + 2, 5)  # At least 5 columns, or max + 2
        
        return JsonResponse({
            'max_members': max_members,
            'recommended_columns': recommended_columns,
            'total_zones': total_zones
        })
        
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def zone_save_view(request):
    """Save or update zones for multiple projects."""
    print(f"🔥 Zone Save - Method: {request.method}")

    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        zones_data = data.get("zones", [])

        if not project_id or not zones_data:
            return JsonResponse({"error": "Project ID and zones data are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        # Check if user has permission to modify zones (must be at least member)
        # Skip permission check if user is not authenticated (for development)
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can modify zones. Viewers have read-only access."}, status=403)

        saved_zones = []
        errors = []

        for zone_data in zones_data:
            zone_id = zone_data.get("id")
            zone_name = zone_data.get("name", "Unknown")
            
            print(f"🔍 Processing zone: {zone_name}")
            print(f"📋 Zone data: {zone_data}")

            # Ensure projects is a list (since it's many-to-many)
            projects_list = zone_data.pop("projects", [project_id])  # Defaults to the current project
            members_list = zone_data.pop("members", [])  # Handle members
            
            print(f"👥 Members list for {zone_name}: {members_list}")
            print(f"📊 Members count: {len(members_list)}")
            
            # Debug member processing
            if members_list:
                print(f"🔍 Processing members for {zone_name}:")
                for i, member in enumerate(members_list):
                    print(f"  Member {i}: {member} (type: {type(member)})")
                    if isinstance(member, dict) and 'alias' in member:
                        print(f"    Alias ID: {member['alias']} (type: {type(member['alias'])})")
            
            # Extract member IDs
            member_ids = [member.get('alias') for member in members_list if member.get('alias')]
            print(f"🎯 Extracted member IDs for {zone_name}: {member_ids}")
            print(f"🎯 Member IDs count: {len(member_ids)}")

            if zone_id:
                zone = Zone.objects.filter(id=zone_id).first()
                if zone:
                    # Optimistic locking - check version
                    client_version = zone_data.get('version')
                    if client_version is not None and zone.version != client_version:
                        # Version mismatch - someone else modified this zone
                        errors.append({
                            "zone": zone_name,
                            "errors": {
                                "version": f"Conflict: This zone was modified by {zone.last_modified_by.username if zone.last_modified_by else 'another user'} at {zone.last_modified_at}. Please refresh and try again.",
                                "current_version": zone.version,
                                "last_modified_by": zone.last_modified_by.username if zone.last_modified_by else None,
                                "last_modified_at": zone.last_modified_at.isoformat() if zone.last_modified_at else None
                            }
                        })
                        continue

                    # Validate the incoming data
                    serializer = ZoneSerializer(zone, data=zone_data, partial=True)
                    if serializer.is_valid():
                        # Extract only changed fields using field_merge utility
                        from core.utils.field_merge import extract_changed_fields

                        # Get validated data
                        validated_data = serializer.validated_data.copy()

                        # Extract only fields that actually changed
                        changed_fields = extract_changed_fields(zone, validated_data)

                        # Check if members changed
                        current_member_ids = set(zone.members.values_list('id', flat=True))
                        new_member_ids = set(member_ids)
                        members_changed = current_member_ids != new_member_ids

                        if changed_fields or members_changed:
                            # Get or create ProjectZone for this project
                            project_zone, pz_created = ProjectZone.objects.get_or_create(
                                project=project,
                                zone=zone,
                                defaults={
                                    'action': 'reference',
                                    'added_by': user,
                                    'field_overrides': {}
                                }
                            )

                            # Update field_overrides with new changes
                            current_overrides = project_zone.field_overrides or {}
                            current_overrides.update(changed_fields)

                            # Store member changes in field_overrides as well
                            if members_changed:
                                current_overrides['member_ids'] = member_ids

                            project_zone.field_overrides = current_overrides

                            # Update action to 'modified' unless it's already 'new'
                            if project_zone.action not in ['new', 'delete']:
                                project_zone.action = 'modified'

                            project_zone.added_by = user
                            project_zone.save()

                            # Handle member updates (these still need to update the actual zone for now)
                            # TODO: In future, members could also be stored in overrides only
                            print(f"🎯 [UPDATE] Setting members for {zone_name}: {member_ids}")
                            zone.members.set(member_ids)
                            print(f"✅ [UPDATE] Members set for {zone_name}. Final count: {zone.members.count()}")

                            print(f"✏️ Stored field overrides for zone '{zone.name}' in project '{project.name}': {changed_fields}")

                        # Return the base zone data (not modified)
                        saved_zones.append(ZoneSerializer(zone).data)
                    else:
                        errors.append({"zone": zone_data["name"], "errors": serializer.errors})
            else:
                serializer = ZoneSerializer(data=zone_data)
                if serializer.is_valid():
                    zone = serializer.save(
                        committed=False,
                        deployed=False,
                        created_by_project=project
                    )
                    zone.updated = timezone.now()
                    if user:
                        zone.last_modified_by = user
                    zone.save(update_fields=["updated", "last_modified_by"])

                    # Auto-add to current project via junction table
                    ProjectZone.objects.create(
                        project=project,
                        zone=zone,
                        action='new',
                        added_by=user,
                        notes='Auto-created with zone'
                    )

                    member_ids = [member.get('alias') for member in members_list if member.get('alias')]
                    print(f"🎯 [CREATE] Setting members for {zone_name}: {member_ids}")
                    zone.members.set(member_ids)
                    print(f"✅ [CREATE] Members set for {zone_name}. Final count: {zone.members.count()}")
                    saved_zones.append(ZoneSerializer(zone).data)
                else:
                    errors.append({"zone": zone_data["name"], "errors": serializer.errors})

        if errors:
            return JsonResponse({"error": "Some zones could not be saved.", "details": errors}, status=400)

        # Clear dashboard cache when zones are saved
        # Get customer through project's customers relationship
        customer = project.customers.first()
        if customer:
            clear_dashboard_cache_for_customer(customer.id)
        
        return JsonResponse({"message": "Zones saved successfully!", "zones": saved_zones})
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def zone_delete_view(request, pk):
    """Delete a zone."""
    print(f"🔥 Zone Delete - PK: {pk}")

    user = request.user if request.user.is_authenticated else None

    try:
        zone = Zone.objects.get(pk=pk)

        # Check permission on the first project this zone belongs to
        # Skip permission check if user is not authenticated (for development)
        project_zone = ProjectZone.objects.filter(zone=zone).select_related('project').first()
        if user and project_zone:
            project = project_zone.project
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can delete zones. Viewers have read-only access."}, status=403)
        customer_id = None
        # Get customer ID from fabric (zones are customer-scoped via fabric)
        if zone.fabric and zone.fabric.customer:
            customer_id = zone.fabric.customer.id
        print(f'Deleting Zone: {zone.name}')
        Zone.objects.filter(pk=zone.pk).delete()
        
        # Clear dashboard cache when zone is deleted
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)
            
        return JsonResponse({"message": "Zone deleted successfully."})
    except Zone.DoesNotExist:
        return JsonResponse({"error": "Zone not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def fabric_management(request, pk=None):
    """
    GET  /fabrics/                -> List all fabrics (optionally filter by customer)
    GET  /fabrics/{pk}/           -> Retrieve a single fabric
    POST /fabrics/                -> Create a new fabric (requires customer_id in payload)
    PUT  /fabrics/{pk}/           -> Update an existing fabric
    """
    
    if request.method == "GET":
        if pk:
            # Single fabric GET
            try:
                fabric = Fabric.objects.get(pk=pk)
                data = FabricSerializer(fabric).data
                return JsonResponse(data)
            except Fabric.DoesNotExist:
                return JsonResponse({"error": "Fabric not found"}, status=404)
        
        # List view with pagination
        customer_id = request.GET.get("customer_id")
        search = request.GET.get('search', '')
        ordering = request.GET.get('ordering', 'id')
        
        # Build queryset with optimizations
        qs = Fabric.objects.select_related('customer').prefetch_related(
            Prefetch('project_memberships', queryset=ProjectFabric.objects.select_related('project'))
        ).all()

        # Customer View filtering: Show fabrics that are either:
        # 1. Committed (committed=True), OR
        # 2. Not referenced by any project (no junction table entries)
        from django.db.models import Count
        qs = qs.annotate(
            project_count=Count('project_memberships')
        ).filter(
            Q(committed=True) | Q(project_count=0)
        )

        # Filter by customer if provided
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        
        # Apply search if provided
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | 
                Q(customer__name__icontains=search) |
                Q(san_vendor__icontains=search) |
                Q(zoneset_name__icontains=search) |
                Q(vsan__icontains=search) |
                Q(notes__icontains=search)
            )
        
        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith((
                'name__', 'customer__name__', 'san_vendor__', 'zoneset_name__', 
                'vsan__', 'exists__', 'notes__'
            )):
                filter_params[param] = value
        
        # Apply the filters
        if filter_params:
            qs = qs.filter(**filter_params)
        
        # Apply ordering
        if ordering:
            qs = qs.order_by(ordering)
        
        # Check if pagination is requested
        page = request.GET.get('page')
        page_size = request.GET.get('page_size')
        
        if page is not None and page_size is not None:
            # Paginated response
            try:
                page = int(page)
                page_size = int(page_size)
            except (ValueError, TypeError):
                page = 1
                page_size = 50
            
            # Apply pagination
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            
            # Serialize paginated results
            serializer = FabricSerializer(page_obj, many=True)
            
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
        else:
            # Non-paginated response (for backwards compatibility)
            data = FabricSerializer(qs, many=True).data
            return JsonResponse(data, safe=False)
    
    # POST method
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = FabricSerializer(data=data)
            if serializer.is_valid():
                fabric = serializer.save()

                # Clear dashboard cache when fabric is created
                if fabric.customer_id:
                    clear_dashboard_cache_for_customer(fabric.customer_id)

                # Reload fabric to ensure all relations are loaded
                fabric = Fabric.objects.select_related('customer', 'last_modified_by').get(pk=fabric.pk)

                return JsonResponse({
                    "message": "Fabric created successfully!",
                    "fabric": FabricSerializer(fabric).data
                }, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    # PUT method
    elif request.method == "PUT":
        if not pk:
            return JsonResponse({"error": "Missing fabric ID"}, status=400)
        
        try:
            fabric = Fabric.objects.get(pk=pk)
        except Fabric.DoesNotExist:
            return JsonResponse({"error": "Fabric not found"}, status=404)
        
        try:
            data = json.loads(request.body)
            serializer = FabricSerializer(fabric, data=data, partial=True)
            if serializer.is_valid():
                updated = serializer.save()
                
                # Clear dashboard cache when fabric is updated
                if updated.customer_id:
                    clear_dashboard_cache_for_customer(updated.customer_id)
                    
                return JsonResponse({
                    "message": "Fabric updated successfully!",
                    "fabric": FabricSerializer(updated).data
                })
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def fabric_delete_view(request, pk):
    """Delete a fabric."""
    print(f"🔥 Fabric Delete - PK: {pk}")
    
    try:
        fabric = Fabric.objects.get(pk=pk)
        customer_id = fabric.customer_id
        print(f'Deleting Fabric: {fabric.name}')
        fabric.delete()
        
        # Clear dashboard cache when fabric is deleted
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)
            
        return JsonResponse({"message": "Fabric deleted successfully."})
    except Fabric.DoesNotExist:
        return JsonResponse({"error": "Fabric not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def generate_alias_scripts(request, project_id):
    """Generate alias scripts for a project."""
    print(f"🔥 Generate Alias Scripts - Project ID: {project_id}")

    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)

    # Get the project directly from the project_id parameter
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": f"Project with ID {project_id} not found."}, status=404)

    # Filter aliases by the actual project_id passed in the URL using junction table
    try:
        # Get aliases to create from junction table
        create_alias_ids = ProjectAlias.objects.filter(project=project, action='new').values_list('alias_id', flat=True)
        create_aliases = Alias.objects.filter(id__in=create_alias_ids)

        # Get aliases to delete from junction table
        delete_alias_ids = ProjectAlias.objects.filter(project=project, action='delete').values_list('alias_id', flat=True)
        delete_aliases = Alias.objects.filter(id__in=delete_alias_ids)

        print(f"🔍 Found {create_aliases.count()} aliases with action=new for project {project_id}")
        print(f"🔍 Found {delete_aliases.count()} aliases with action=delete for project {project_id}")
    except Exception as e:
        return JsonResponse({"error": "Error fetching alias records.", "details": str(e)}, status=500)

    command_data = generate_alias_commands(create_aliases, delete_aliases, project)

    # Transform the new structure to maintain backward compatibility
    result = {}
    for fabric_name, fabric_data in command_data.items():
        result[fabric_name] = {
            "commands": fabric_data["commands"],
            "fabric_info": fabric_data["fabric_info"]
        }

    print(f"🔍 Generated alias scripts for {len(result)} fabrics")
    return JsonResponse({"alias_scripts": result}, safe=False)



@csrf_exempt
@require_http_methods(["GET"])
def generate_zone_scripts(request, project_id):
    """Generate zone scripts for a project."""
    print(f"🔥 Generate Zone Scripts - Project ID: {project_id}")

    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)

    # Get the project directly from the project_id parameter
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": f"Project with ID {project_id} not found."}, status=404)

    # Filter zones by the actual project_id passed in the URL using junction table
    try:
        # Get zones to create from junction table
        create_zone_ids = ProjectZone.objects.filter(project=project, action='new').values_list('zone_id', flat=True)
        create_zones = Zone.objects.filter(id__in=create_zone_ids)

        # Get zones to delete from junction table
        delete_zone_ids = ProjectZone.objects.filter(project=project, action='delete').values_list('zone_id', flat=True)
        delete_zones = Zone.objects.filter(id__in=delete_zone_ids)

        print(f"🔍 Found {create_zones.count()} zones with action=new for project {project_id}")
        print(f"🔍 Found {delete_zones.count()} zones with action=delete for project {project_id}")
    except Exception as e:
        return JsonResponse({"error": "Error fetching zone records.", "details": str(e)}, status=500)

    # Check for aliases with action=new that are missing cisco_alias for Cisco fabrics
    warnings = []
    try:
        create_alias_ids = ProjectAlias.objects.filter(project=project, action='new').values_list('alias_id', flat=True)
        create_aliases = Alias.objects.filter(id__in=create_alias_ids).select_related('fabric')
        invalid_cisco_aliases = [
            alias for alias in create_aliases
            if alias.fabric and alias.fabric.san_vendor == 'CI' and not alias.cisco_alias
        ]

        if invalid_cisco_aliases:
            fabric_groups = {}
            for alias in invalid_cisco_aliases:
                fabric_name = alias.fabric.name if alias.fabric else "Unknown"
                if fabric_name not in fabric_groups:
                    fabric_groups[fabric_name] = []
                fabric_groups[fabric_name].append(alias.name)

            warning_message = "Some Cisco aliases have 'create' checked but are missing the 'cisco_alias' field. "
            warning_message += "These aliases will NOT be included in scripts. Please set cisco_alias to 'device-alias' or 'fcalias'. "
            warning_message += f"Affected aliases ({len(invalid_cisco_aliases)} total): "

            fabric_details = []
            for fabric_name, alias_names in fabric_groups.items():
                fabric_details.append(f"{fabric_name}: {', '.join(alias_names[:5])}" +
                                    (f" (and {len(alias_names)-5} more)" if len(alias_names) > 5 else ""))

            warning_message += "; ".join(fabric_details)
            warnings.append(warning_message)
            print(f"⚠️  Found {len(invalid_cisco_aliases)} Cisco aliases missing cisco_alias field")
    except Exception as e:
        print(f"⚠️  Error checking for invalid aliases: {e}")

    # Pass project instead of config to the command generation
    command_data = generate_zone_commands(create_zones, delete_zones, project)
    print(f"🔍 Generated scripts for {len(command_data)} fabrics")

    response_data = {
        "zone_scripts": command_data,
        "warnings": warnings
    }
    return JsonResponse(response_data, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def generate_alias_deletion_scripts(request, project_id):
    """Generate alias deletion scripts for a project."""
    print(f"🔥 Generate Alias Deletion Scripts - Project ID: {project_id}")

    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)

    # Get the project directly from the project_id parameter
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": f"Project with ID {project_id} not found."}, status=404)

    # Filter aliases by the actual project_id passed in the URL using junction table
    try:
        delete_alias_ids = ProjectAlias.objects.filter(project=project, action='delete').values_list('alias_id', flat=True)
        delete_aliases = Alias.objects.filter(id__in=delete_alias_ids)
        print(f"🔍 Found {delete_aliases.count()} aliases with action=delete for project {project_id}")
    except Exception as e:
        return JsonResponse({"error": "Error fetching alias records.", "details": str(e)}, status=500)

    command_data = generate_alias_deletion_only_commands(delete_aliases, project)

    # Transform the new structure to maintain backward compatibility
    result = {}
    for fabric_name, fabric_data in command_data.items():
        result[fabric_name] = {
            "commands": fabric_data["commands"],
            "fabric_info": fabric_data["fabric_info"]
        }

    print(f"🔍 Generated alias deletion scripts for {len(result)} fabrics")
    return JsonResponse({"alias_scripts": result}, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def generate_zone_deletion_scripts(request, project_id):
    """Generate zone deletion scripts for a project."""
    print(f"🔥 Generate Zone Deletion Scripts - Project ID: {project_id}")

    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)

    # Get the project directly from the project_id parameter
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": f"Project with ID {project_id} not found."}, status=404)

    # Filter zones by the actual project_id passed in the URL using junction table
    try:
        delete_zone_ids = ProjectZone.objects.filter(project=project, action='delete').values_list('zone_id', flat=True)
        delete_zones = Zone.objects.filter(id__in=delete_zone_ids)
        print(f"🔍 Found {delete_zones.count()} zones with action=delete for project {project_id}")
    except Exception as e:
        return JsonResponse({"error": "Error fetching zone records.", "details": str(e)}, status=500)

    command_data = generate_zone_deletion_commands(delete_zones, project)
    print(f"🔍 Generated zone deletion scripts for {len(command_data)} fabrics")
    return JsonResponse({"zone_scripts": command_data}, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def alias_by_fabric_view(request, fabric_id):
    """Fetch aliases belonging to a specific fabric."""
    print(f"🔥 Alias by Fabric - Fabric ID: {fabric_id}")
    
    try:
        fabric = Fabric.objects.get(id=fabric_id)
    except Fabric.DoesNotExist:
        return JsonResponse({"error": "Fabric not found."}, status=404)

    aliases = Alias.objects.filter(fabric=fabric)
    serializer = AliasSerializer(aliases, many=True)
    return JsonResponse(serializer.data, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def alias_copy_to_project_view(request):
    """Copy existing aliases to a project by adding the project to their many-to-many relationship."""
    print(f"🔥 Alias Copy to Project - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        alias_ids = data.get("alias_ids", [])

        if not project_id or not alias_ids:
            return JsonResponse({"error": "Project ID and alias IDs are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        copied_count = 0
        errors = []

        for alias_id in alias_ids:
            try:
                alias = Alias.objects.get(id=alias_id)
                # Add the alias to the project via junction table
                ProjectAlias.objects.get_or_create(
                    project=project,
                    alias=alias,
                    defaults={
                        'action': 'reference',
                        'added_by': user,
                        'notes': 'Copied to project'
                    }
                )
                copied_count += 1
            except Alias.DoesNotExist:
                errors.append(f"Alias with ID {alias_id} not found")

        if errors:
            return JsonResponse({
                "message": f"Copied {copied_count} aliases with some errors",
                "errors": errors
            }, status=207)

        return JsonResponse({
            "message": f"Successfully copied {copied_count} aliases to project!"
        })
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def wwpn_prefix_list_view(request):
    """
    GET /wwpn-prefixes/  -> List all WWPN prefixes
    POST /wwpn-prefixes/ -> Create a new WWPN prefix
    """
    print(f"🔥 WWPN Prefix List - Method: {request.method}")
    
    if request.method == "GET":
        search = request.GET.get('search', '')
        ordering = request.GET.get('ordering', 'prefix')
        
        # Build queryset
        qs = WwpnPrefix.objects.all()
        
        # Apply search if provided
        if search:
            qs = qs.filter(
                Q(prefix__icontains=search) |
                Q(vendor__icontains=search) |
                Q(description__icontains=search)
            )
        
        # Apply ordering
        if ordering:
            qs = qs.order_by(ordering)
        
        # Serialize all results
        data = WwpnPrefixSerializer(qs, many=True).data
        return JsonResponse(data, safe=False)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = WwpnPrefixSerializer(data=data)
            if serializer.is_valid():
                wwpn_prefix = serializer.save()
                return JsonResponse({
                    "message": "WWPN prefix created successfully!",
                    "wwpn_prefix": WwpnPrefixSerializer(wwpn_prefix).data
                }, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def wwpn_prefix_detail_view(request, pk):
    """
    GET /wwpn-prefixes/{pk}/    -> Retrieve a single WWPN prefix
    PUT /wwpn-prefixes/{pk}/    -> Update an existing WWPN prefix
    DELETE /wwpn-prefixes/{pk}/ -> Delete a WWPN prefix
    """
    print(f"🔥 WWPN Prefix Detail - Method: {request.method}, PK: {pk}")
    
    try:
        wwpn_prefix = WwpnPrefix.objects.get(pk=pk)
    except WwpnPrefix.DoesNotExist:
        return JsonResponse({"error": "WWPN prefix not found"}, status=404)
    
    if request.method == "GET":
        data = WwpnPrefixSerializer(wwpn_prefix).data
        return JsonResponse(data)
    
    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
            serializer = WwpnPrefixSerializer(wwpn_prefix, data=data, partial=True)
            if serializer.is_valid():
                updated = serializer.save()
                return JsonResponse({
                    "message": "WWPN prefix updated successfully!",
                    "wwpn_prefix": WwpnPrefixSerializer(updated).data
                })
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "DELETE":
        try:
            print(f'Deleting WWPN Prefix: {wwpn_prefix.prefix}')
            wwpn_prefix.delete()
            return JsonResponse({"message": "WWPN prefix deleted successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def wwpn_detect_type_view(request):
    """
    POST /wwpn-prefixes/detect-type/
    Detect WWPN type (initiator/target) based on global prefix rules
    Body: {"wwpn": "<wwpn>"}
    """
    print(f"🔥 WWPN Detect Type - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        wwpn = data.get("wwpn")
        
        if not wwpn:
            return JsonResponse({"error": "wwpn is required"}, status=400)
        
        # Use the model's detection method
        detected_type = WwpnPrefix.detect_wwpn_type(wwpn)
        
        return JsonResponse({
            "wwpn": wwpn,
            "detected_type": detected_type
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt 
@require_http_methods(["GET"])
def generate_zone_creation_scripts(request, project_id):
    """Generate combined zone creation scripts with aliases in the specified format."""
    print(f"🔥 Generate Zone Creation Scripts - Project ID: {project_id}")

    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)

    # Get the project directly from the project_id parameter
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": f"Project with ID {project_id} not found."}, status=404)

    # Filter zones by the actual project_id passed in the URL using junction table
    try:
        create_zone_ids = ProjectZone.objects.filter(project=project, action='new').values_list('zone_id', flat=True)
        create_zones = Zone.objects.filter(id__in=create_zone_ids)
        print(f"🔍 Found {create_zones.count()} zones with action=new for project {project_id}")
    except Exception as e:
        print(f"❌ Error fetching zones: {e}")
        return JsonResponse({"error": "Error fetching zone records.", "details": str(e)}, status=500)

    try:
        command_data = generate_zone_creation_commands(create_zones, project)
        print(f"✅ Generated zone creation scripts for {len(command_data)} fabrics")
    except Exception as e:
        print(f"❌ Error generating scripts: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": "Error generating scripts.", "details": str(e)}, status=500)

    return JsonResponse({"zone_scripts": command_data}, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_alias_boolean(request, project_id):
    """Bulk update boolean fields for aliases in a project via junction table."""
    print(f"🔥 Bulk Update Alias Boolean - Project ID: {project_id}")

    try:
        data = json.loads(request.body)
        field = data.get('field')
        value = data.get('value')
        filters = data.get('filters', {})

        print(f"📝 Bulk update request: field={field}, value={value}, filters={filters}")

        if not field or value is None:
            return JsonResponse({"error": "Field and value are required"}, status=400)

        # Validate field is a boolean field
        boolean_fields = ['create', 'delete', 'include_in_zoning', 'logged_in']
        if field not in boolean_fields:
            return JsonResponse({"error": f"Invalid boolean field: {field}"}, status=400)

        # Get project
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": f"Project {project_id} not found"}, status=404)

        # Start with aliases in the project via junction table
        alias_ids = ProjectAlias.objects.filter(project=project).values_list('alias_id', flat=True)
        queryset = Alias.objects.filter(id__in=alias_ids)

        # Apply server-side filters if provided
        if filters:
            for filter_key, filter_value in filters.items():
                if filter_key == 'quick_search' and filter_value:
                    # Quick search across main fields
                    queryset = queryset.filter(
                        Q(name__icontains=filter_value) |
                        Q(wwpn__icontains=filter_value) |
                        Q(use__icontains=filter_value)
                    )
                elif '__' in filter_key:
                    # Handle complex filters
                    if filter_key.endswith('__in') and isinstance(filter_value, list):
                        queryset = queryset.filter(**{filter_key: filter_value})
                    elif filter_key.endswith('__in') and isinstance(filter_value, str):
                        # Handle single value passed as __in
                        values = [v.strip() for v in filter_value.split(',')]
                        queryset = queryset.filter(**{filter_key: values})
                    else:
                        queryset = queryset.filter(**{filter_key: filter_value})
                else:
                    # Simple field filter
                    queryset = queryset.filter(**{filter_key: filter_value})

        # Get the final list of alias IDs after filtering
        filtered_alias_ids = list(queryset.values_list('id', flat=True))

        # Update based on field type
        if field in ['create', 'delete']:
            # Map boolean to action field on junction table
            if field == 'create':
                new_action = 'new' if value else 'unmodified'
            else:  # delete
                new_action = 'delete' if value else 'reference'

            # Update ProjectAlias junction table
            updated_count = ProjectAlias.objects.filter(
                project=project,
                alias_id__in=filtered_alias_ids
            ).update(action=new_action)

        elif field == 'include_in_zoning':
            # Update include_in_zoning field on junction table
            updated_count = ProjectAlias.objects.filter(
                project=project,
                alias_id__in=filtered_alias_ids
            ).update(include_in_zoning=value)

        elif field == 'logged_in':
            # logged_in stays on Alias model (not moved to junction table)
            updated_count = queryset.update(logged_in=value, updated=timezone.now())

        # Clear dashboard cache
        try:
            if queryset.first():
                customer_id = queryset.first().fabric.customer_id
                clear_dashboard_cache_for_customer(customer_id)
        except:
            pass

        print(f"✅ Updated {updated_count} alias records")

        return JsonResponse({
            "message": f"Successfully updated {updated_count} aliases",
            "updated_count": updated_count,
            "field": field,
            "value": value
        })

    except Exception as e:
        print(f"❌ Error in bulk update: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_zone_boolean(request, project_id):
    """Bulk update boolean fields for zones in a project via junction table."""
    print(f"🔥 Bulk Update Zone Boolean - Project ID: {project_id}")

    try:
        data = json.loads(request.body)
        field = data.get('field')
        value = data.get('value')
        filters = data.get('filters', {})

        print(f"📝 Bulk update request: field={field}, value={value}, filters={filters}")

        if not field or value is None:
            return JsonResponse({"error": "Field and value are required"}, status=400)

        # Validate field is a boolean field
        boolean_fields = ['create', 'delete', 'exists']
        if field not in boolean_fields:
            return JsonResponse({"error": f"Invalid boolean field: {field}"}, status=400)

        # Get project
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": f"Project {project_id} not found"}, status=404)

        # Start with zones in the project via junction table
        zone_ids = ProjectZone.objects.filter(project=project).values_list('zone_id', flat=True)
        queryset = Zone.objects.filter(id__in=zone_ids)
        
        # Apply server-side filters if provided
        if filters:
            for filter_key, filter_value in filters.items():
                if filter_key == 'quick_search' and filter_value:
                    # Quick search across main fields
                    queryset = queryset.filter(
                        Q(name__icontains=filter_value) | 
                        Q(zone_type__icontains=filter_value) | 
                        Q(notes__icontains=filter_value)
                    )
                elif filter_key.startswith('member_count__'):
                    # Handle member count filters
                    mapped_key = filter_key.replace('member_count__', '_member_count__')
                    if filter_key.endswith('__in') and isinstance(filter_value, list):
                        queryset = queryset.annotate(_member_count=Count('members')).filter(**{mapped_key: filter_value})
                    elif filter_key.endswith('__in') and isinstance(filter_value, str):
                        # Handle single value or comma-separated values
                        if ',' in filter_value:
                            values = [int(v.strip()) for v in filter_value.split(',')]
                        else:
                            values = [int(filter_value.strip())]
                        queryset = queryset.annotate(_member_count=Count('members')).filter(**{mapped_key: values})
                    else:
                        queryset = queryset.annotate(_member_count=Count('members')).filter(**{mapped_key: int(filter_value)})
                elif '__' in filter_key:
                    # Handle other complex filters
                    if filter_key.endswith('__in') and isinstance(filter_value, list):
                        queryset = queryset.filter(**{filter_key: filter_value})
                    elif filter_key.endswith('__in') and isinstance(filter_value, str):
                        # Handle single value passed as __in
                        values = [v.strip() for v in filter_value.split(',')]
                        queryset = queryset.filter(**{filter_key: values})
                    else:
                        queryset = queryset.filter(**{filter_key: filter_value})
                else:
                    # Simple field filter
                    queryset = queryset.filter(**{filter_key: filter_value})

        # Get the final list of zone IDs after filtering
        filtered_zone_ids = list(queryset.values_list('id', flat=True))

        # Update based on field type
        if field in ['create', 'delete']:
            # Map boolean to action field on junction table
            if field == 'create':
                new_action = 'new' if value else 'unmodified'
            else:  # delete
                new_action = 'delete' if value else 'reference'

            # Update ProjectZone junction table
            updated_count = ProjectZone.objects.filter(
                project=project,
                zone_id__in=filtered_zone_ids
            ).update(action=new_action)

        elif field == 'exists':
            # exists stays on Zone model (not moved to junction table)
            updated_count = queryset.update(exists=value, updated=timezone.now())

        # Clear dashboard cache
        try:
            if queryset.first():
                customer_id = queryset.first().fabric.customer_id
                clear_dashboard_cache_for_customer(customer_id)
        except:
            pass

        print(f"✅ Updated {updated_count} zone records")

        return JsonResponse({
            "message": f"Successfully updated {updated_count} zones",
            "updated_count": updated_count,
            "field": field,
            "value": value
        })

    except Exception as e:
        print(f"❌ Error in bulk update: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_zones_create(request):
    """Bulk update create action for specific zones via junction table."""
    print("🔥 Bulk Update Zones Create")

    try:
        data = json.loads(request.body)
        zones = data.get('zones', [])

        if not zones:
            return JsonResponse({
                "message": "Skipping... No zones exist"
            })

        # Get the user's active project from config (passed in request or session)
        # For now, we'll require project_id to be passed in the request
        project_id = data.get('project_id') or request.GET.get('project_id')

        if not project_id:
            # Try to get from user's session/config
            return JsonResponse({"error": "project_id is required"}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": f"Project {project_id} not found"}, status=404)

        updated_count = 0
        for zone_data in zones:
            zone_id = zone_data.get('id')
            create_value = zone_data.get('create', False)

            # Map boolean to action
            new_action = 'new' if create_value else 'unmodified'

            try:
                # Update ProjectZone junction table
                project_zone, created = ProjectZone.objects.get_or_create(
                    project=project,
                    zone_id=zone_id,
                    defaults={'action': new_action, 'added_by': request.user if request.user.is_authenticated else None}
                )
                if not created:
                    project_zone.action = new_action
                    project_zone.save()
                updated_count += 1
            except Zone.DoesNotExist:
                print(f"❌ Zone with ID {zone_id} not found")
                continue

        print(f"✅ Updated {updated_count} zones")
        return JsonResponse({
            "message": f"Successfully updated {updated_count} zones",
            "updated_count": updated_count
        })

    except Exception as e:
        print(f"❌ Error in bulk update zones: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_aliases_create(request):
    """Bulk update create action for specific aliases via junction table."""
    print("🔥 Bulk Update Aliases Create")

    try:
        data = json.loads(request.body)
        aliases = data.get('aliases', [])

        if not aliases:
            return JsonResponse({
                "message": "Skipping... No aliases exist"
            })

        # Get the user's active project from config (passed in request or session)
        project_id = data.get('project_id') or request.GET.get('project_id')

        if not project_id:
            return JsonResponse({"error": "project_id is required"}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": f"Project {project_id} not found"}, status=404)

        updated_count = 0
        for alias_data in aliases:
            alias_id = alias_data.get('id')
            create_value = alias_data.get('create', False)

            # Map boolean to action
            new_action = 'new' if create_value else 'unmodified'

            try:
                # Update ProjectAlias junction table
                project_alias, created = ProjectAlias.objects.get_or_create(
                    project=project,
                    alias_id=alias_id,
                    defaults={'action': new_action, 'added_by': request.user if request.user.is_authenticated else None}
                )
                if not created:
                    project_alias.action = new_action
                    project_alias.save()
                updated_count += 1
            except Alias.DoesNotExist:
                print(f"❌ Alias with ID {alias_id} not found")
                continue

        print(f"✅ Updated {updated_count} aliases")
        return JsonResponse({
            "message": f"Successfully updated {updated_count} aliases",
            "updated_count": updated_count
        })

    except Exception as e:
        print(f"❌ Error in bulk update aliases: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_hosts_create(request):
    """Bulk update create field for specific hosts by ID."""
    print("🔥 Bulk Update Hosts Create")

    try:
        data = json.loads(request.body)
        hosts = data.get('hosts', [])

        if not hosts:
            return JsonResponse({"error": "No hosts provided"}, status=400)

        updated_count = 0
        for host_data in hosts:
            host_id = host_data.get('id')
            create_value = host_data.get('create', False)

            try:
                host = Host.objects.get(id=host_id)
                host.create = create_value
                host.save()
                updated_count += 1
            except Host.DoesNotExist:
                print(f"❌ Host with ID {host_id} not found")
                continue

        print(f"✅ Updated {updated_count} hosts")
        return JsonResponse({
            "message": f"Successfully updated {updated_count} hosts",
            "updated_count": updated_count
        })

    except Exception as e:
        print(f"❌ Error in bulk update hosts: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def switch_management(request, pk=None):
    """
    GET  /switches/                -> List all switches (optionally filter by customer)
    GET  /switches/{pk}/           -> Retrieve a single switch
    POST /switches/                -> Create a new switch (requires customer_id in payload)
    PUT  /switches/{pk}/           -> Update an existing switch
    """

    if request.method == "GET":
        if pk:
            # Single switch GET
            try:
                switch = Switch.objects.get(pk=pk)
                data = SwitchSerializer(switch).data
                return JsonResponse(data)
            except Switch.DoesNotExist:
                return JsonResponse({"error": "Switch not found"}, status=404)

        # List view with pagination
        customer_id = request.GET.get("customer_id")
        search = request.GET.get('search', '')
        ordering = request.GET.get('ordering', 'id')

        # Build queryset with optimizations
        from django.db.models import Q, Count
        qs = Switch.objects.select_related('customer', 'created_by_project').prefetch_related(
            Prefetch('project_memberships', queryset=ProjectSwitch.objects.select_related('project'))
        ).all()

        # Filter by customer if provided
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        # Customer View filtering: Show switches that are either:
        # 1. Committed (committed=True), OR
        # 2. Not referenced by any project (no junction table entries)
        qs = qs.annotate(
            project_count=Count('project_memberships')  # Correct relationship name
        ).filter(
            Q(committed=True) | Q(project_count=0)
        )

        # Apply search if provided
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(san_vendor__icontains=search) |
                Q(ip_address__icontains=search) |
                Q(model__icontains=search) |
                Q(serial_number__icontains=search) |
                Q(location__icontains=search) |
                Q(notes__icontains=search)
            )

        # Apply field-specific filters
        filter_params = {}
        for param, value in request.GET.items():
            if param.startswith((
                'name__', 'customer__name__', 'san_vendor__', 'ip_address__',
                'model__', 'serial_number__', 'is_active__', 'location__', 'notes__'
            )):
                filter_params[param] = value

        # Apply the filters
        if filter_params:
            qs = qs.filter(**filter_params)

        # Apply ordering
        if ordering:
            qs = qs.order_by(ordering)

        # Check if pagination is requested
        page = request.GET.get('page')
        page_size = request.GET.get('page_size')

        if page is not None and page_size is not None:
            # Paginated response
            try:
                page = int(page)
                page_size = int(page_size)
            except (ValueError, TypeError):
                page = 1
                page_size = 50

            # Apply pagination
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)

            # Serialize paginated results
            serializer = SwitchSerializer(page_obj, many=True)

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
        else:
            # Non-paginated response (for backwards compatibility)
            data = SwitchSerializer(qs, many=True).data
            return JsonResponse(data, safe=False)

    # POST method
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = SwitchSerializer(data=data)
            if serializer.is_valid():
                switch = serializer.save()

                # Reload switch to ensure all relations are loaded
                switch = Switch.objects.select_related('customer', 'last_modified_by').get(pk=switch.pk)

                return JsonResponse({
                    "message": "Switch created successfully!",
                    "switch": SwitchSerializer(switch).data
                }, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    # PUT method
    elif request.method == "PUT":
        if not pk:
            return JsonResponse({"error": "Missing switch ID"}, status=400)

        try:
            switch = Switch.objects.get(pk=pk)
        except Switch.DoesNotExist:
            return JsonResponse({"error": "Switch not found"}, status=404)

        try:
            data = json.loads(request.body)
            serializer = SwitchSerializer(switch, data=data, partial=True)
            if serializer.is_valid():
                updated = serializer.save()

                return JsonResponse({
                    "message": "Switch updated successfully!",
                    "switch": SwitchSerializer(updated).data
                })
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def switch_delete_view(request, pk):
    """Delete a switch."""
    print(f"🔥 Switch Delete - PK: {pk}")

    try:
        switch = Switch.objects.get(pk=pk)
        print(f'Deleting Switch: {switch.name}')
        switch.delete()

        return JsonResponse({"message": "Switch deleted successfully."})
    except Switch.DoesNotExist:
        return JsonResponse({"error": "Switch not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def switches_by_customer_view(request, customer_id):
    """Fetch switches belonging to a specific customer (for dropdown population)."""
    print(f"🔥 Switches by Customer - Customer ID: {customer_id}")

    try:
        from django.db.models import Q, Count
        switches = Switch.objects.filter(customer_id=customer_id)

        # Customer View filtering: Show switches that are either:
        # 1. Committed (committed=True), OR
        # 2. Not referenced by any project (no junction table entries)
        switches = switches.annotate(
            project_count=Count('project_memberships')
        ).filter(
            Q(committed=True) | Q(project_count=0)
        ).order_by('name')

        data = SwitchSerializer(switches, many=True).data
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def switch_project_view(request, project_id):
    """
    Get switches in project with field_overrides applied (merged view).
    Returns only switches in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get all ProjectSwitch entries for this project
    project_switches = ProjectSwitch.objects.filter(
        project=project
    ).select_related(
        'switch',
        'switch__customer'
    ).prefetch_related(
        'switch__fabrics',
        'switch__switch_fabrics',
        Prefetch('switch__project_memberships',
                 queryset=ProjectSwitch.objects.select_related('project'))
    )

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', 50)

    # Handle "All" as a special case
    if page_size_param == 'All':
        page_size = None
        page_obj = None
        paginator = None
        total_count = project_switches.count()
        project_switches_page = project_switches  # Use all results
    else:
        page_size = int(page_size_param)
        paginator = Paginator(project_switches, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            project_switches_page = page_obj.object_list
        except:
            project_switches_page = []

    merged_data = []

    for ps in project_switches_page:
        # Serialize base switch
        base_data = SwitchSerializer(ps.switch).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if ps.field_overrides:
            for field_name, override_value in ps.field_overrides.items():
                # Special handling for fabric_domains (ManyToMany field)
                if field_name == 'fabric_domains':
                    # Reconstruct fabric_domain_details from fabric_domains override
                    fabric_domain_details = []
                    for fd in override_value:
                        fabric_id = fd.get('fabric_id')
                        domain_id = fd.get('domain_id')
                        try:
                            fabric = Fabric.objects.get(id=fabric_id)
                            fabric_domain_details.append({
                                'id': fabric.id,
                                'name': fabric.name,
                                'domain_id': domain_id
                            })
                        except Fabric.DoesNotExist:
                            pass

                    # Replace the fabric_domain_details with override
                    base_data['fabric_domain_details'] = fabric_domain_details

                    # Also update fabrics_details and fabrics for backward compatibility
                    base_data['fabrics_details'] = [{'id': f['id'], 'name': f['name']} for f in fabric_domain_details]
                    base_data['fabrics'] = [f['name'] for f in fabric_domain_details]

                    # Store as fabric_domains for frontend
                    base_data['fabric_domains'] = override_value

                    # Mark the display columns as modified for cell highlighting
                    modified_fields.append('fabrics')
                    modified_fields.append('domain_ids')
                # Standard field handling
                elif field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    # New field from override
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

    # Add pagination metadata if paginated
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
def fabric_project_view(request, project_id):
    """
    Get fabrics in project with field_overrides applied (merged view).
    Returns only fabrics in the project with overrides merged into base data.
    Adds 'modified_fields' array to track which fields have overrides.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)

    # Get customer for the project
    customer = project.customers.first()
    customer_id = customer.id if customer else None

    # Get all ProjectFabric entries for this project
    project_fabrics = ProjectFabric.objects.filter(
        project=project
    ).select_related(
        'fabric',
        'fabric__customer'
    ).prefetch_related(
        'fabric__alias_set',
        'fabric__zone_set',
        'fabric__fabric_switches__switch',
        Prefetch('fabric__project_memberships',
                 queryset=ProjectFabric.objects.select_related('project'))
    )

    # ===== PAGINATION =====
    page = int(request.GET.get('page', 1))
    page_size_param = request.GET.get('page_size', 50)

    # Handle "All" as a special case
    if page_size_param == 'All':
        page_size = None
        page_obj = None
        paginator = None
        total_count = project_fabrics.count()
        project_fabrics_page = project_fabrics  # Use all results
    else:
        page_size = int(page_size_param)
        paginator = Paginator(project_fabrics, page_size)
        total_count = paginator.count

        try:
            page_obj = paginator.get_page(page)
            project_fabrics_page = page_obj.object_list
        except:
            project_fabrics_page = []

    merged_data = []

    for pf in project_fabrics_page:
        # Serialize base fabric
        base_data = FabricSerializer(pf.fabric).data

        # Track which fields have overrides
        modified_fields = []

        # Apply field_overrides if they exist
        if pf.field_overrides:
            for field_name, override_value in pf.field_overrides.items():
                # Only apply if value actually differs from base
                if field_name in base_data:
                    if base_data[field_name] != override_value:
                        base_data[field_name] = override_value
                        modified_fields.append(field_name)
                else:
                    # New field from override
                    base_data[field_name] = override_value
                    modified_fields.append(field_name)

        # Add metadata
        base_data['modified_fields'] = modified_fields
        base_data['project_action'] = pf.action
        base_data['in_active_project'] = True

        merged_data.append(base_data)

    # Return response with pagination metadata
    response_data = {
        'results': merged_data,
        'count': total_count,
    }

    # Add pagination metadata if paginated
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
@require_http_methods(["POST"])
def switch_save_view(request):
    """Save or update switches with field override support for projects."""
    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        switches_data = data.get("switches", [])

        if not project_id or not switches_data:
            return JsonResponse({"error": "Project ID and switches data are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        # Check if user has permission to modify switches
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can modify switches. Viewers have read-only access."}, status=403)

        saved_switches = []
        errors = []

        for switch_data in switches_data:
            switch_id = switch_data.get("id")

            if switch_id:
                switch = Switch.objects.filter(id=switch_id).first()
                if switch:
                    # Optimistic locking - check version
                    client_version = switch_data.get('version')
                    if client_version is not None and switch.version != client_version:
                        errors.append({
                            "switch": switch_data.get("name", "Unknown"),
                            "errors": {
                                "version": f"Conflict: This switch was modified by {switch.last_modified_by.username if switch.last_modified_by else 'another user'} at {switch.last_modified_at}. Please refresh and try again.",
                                "current_version": switch.version,
                                "last_modified_by": switch.last_modified_by.username if switch.last_modified_by else None,
                                "last_modified_at": switch.last_modified_at.isoformat() if switch.last_modified_at else None
                            }
                        })
                        continue

                    # Validate the incoming data
                    serializer = SwitchSerializer(switch, data=switch_data, partial=True)
                    if serializer.is_valid():
                        # Extract only changed fields
                        from core.utils.field_merge import extract_changed_fields

                        # Get validated data
                        validated_data = serializer.validated_data.copy()

                        # Special handling for fabric_domains (ManyToMany field)
                        # The serializer will pop this out before updating, so capture it here
                        fabric_domains_new = validated_data.get('fabric_domains', None)

                        # Extract only fields that actually changed (standard fields)
                        changed_fields = extract_changed_fields(switch, validated_data)

                        # Check if fabric_domains changed (compare with current state)
                        if fabric_domains_new is not None:
                            # Get current fabric_domains from switch
                            current_fabric_domains = [
                                {'fabric_id': sf.fabric_id, 'domain_id': sf.domain_id}
                                for sf in switch.switch_fabrics.all().order_by('fabric_id')
                            ]

                            # Normalize new fabric_domains for comparison
                            if fabric_domains_new:  # Non-empty list
                                normalized_new = sorted(
                                    [{'fabric_id': fd.get('fabric_id'), 'domain_id': fd.get('domain_id')}
                                     for fd in fabric_domains_new],
                                    key=lambda x: x.get('fabric_id', 0)
                                )
                            else:  # Empty list
                                normalized_new = []

                            # Compare
                            if current_fabric_domains != normalized_new:
                                changed_fields['fabric_domains'] = fabric_domains_new
                                print(f"🔧 Fabric domains changed for switch '{switch.name}': {current_fabric_domains} -> {normalized_new}")

                        if changed_fields:
                            # Get or create ProjectSwitch for this project
                            project_switch, ps_created = ProjectSwitch.objects.get_or_create(
                                project=project,
                                switch=switch,
                                defaults={
                                    'action': 'unmodified',
                                    'added_by': user,
                                    'field_overrides': {}
                                }
                            )

                            # Update field_overrides with new changes
                            current_overrides = project_switch.field_overrides or {}
                            current_overrides.update(changed_fields)
                            project_switch.field_overrides = current_overrides

                            # Update action to 'modified' unless it's already 'new'
                            if project_switch.action not in ['new', 'delete']:
                                project_switch.action = 'modified'

                            project_switch.added_by = user
                            project_switch.save()

                            print(f"✏️ Stored field overrides for switch '{switch.name}' in project '{project.name}': {changed_fields}")

                        # Return the base switch data (not modified)
                        saved_switches.append(SwitchSerializer(switch).data)
                    else:
                        errors.append({"switch": switch_data.get("name", "Unknown"), "errors": serializer.errors})
            else:
                # Create new switch
                serializer = SwitchSerializer(data=switch_data)
                if serializer.is_valid():
                    switch = serializer.save(
                        committed=False,
                        deployed=False,
                        created_by_project=project
                    )
                    if user:
                        switch.last_modified_by = user
                        switch.save(update_fields=["last_modified_by"])

                    # Auto-add to current project via junction table
                    ProjectSwitch.objects.create(
                        project=project,
                        switch=switch,
                        action='new',
                        added_by=user,
                        notes='Auto-created with switch'
                    )

                    saved_switches.append(serializer.data)
                else:
                    errors.append({"switch": switch_data.get("name", "Unknown"), "errors": serializer.errors})

        if errors:
            return JsonResponse({"error": "Some switches could not be saved.", "details": errors}, status=400)

        # Clear dashboard cache when switches are saved
        customer = project.customers.first()
        if customer:
            clear_dashboard_cache_for_customer(customer.id)

        return JsonResponse({"message": "Switches saved successfully!", "switches": saved_switches})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def fabric_save_view(request):
    """Save or update fabrics with field override support for projects."""
    user = request.user if request.user.is_authenticated else None

    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        fabrics_data = data.get("fabrics", [])

        if not project_id or not fabrics_data:
            return JsonResponse({"error": "Project ID and fabrics data are required."}, status=400)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        # Check if user has permission to modify fabrics
        if user:
            from core.permissions import can_modify_project
            if not can_modify_project(user, project):
                return JsonResponse({"error": "Only project owners, members, and admins can modify fabrics. Viewers have read-only access."}, status=403)

        saved_fabrics = []
        errors = []

        for fabric_data in fabrics_data:
            fabric_id = fabric_data.get("id")

            if fabric_id:
                fabric = Fabric.objects.filter(id=fabric_id).first()
                if fabric:
                    # Optimistic locking - check version
                    client_version = fabric_data.get('version')
                    if client_version is not None and fabric.version != client_version:
                        errors.append({
                            "fabric": fabric_data.get("name", "Unknown"),
                            "errors": {
                                "version": f"Conflict: This fabric was modified by {fabric.last_modified_by.username if fabric.last_modified_by else 'another user'} at {fabric.last_modified_at}. Please refresh and try again.",
                                "current_version": fabric.version,
                                "last_modified_by": fabric.last_modified_by.username if fabric.last_modified_by else None,
                                "last_modified_at": fabric.last_modified_at.isoformat() if fabric.last_modified_at else None
                            }
                        })
                        continue

                    # Validate the incoming data
                    serializer = FabricSerializer(fabric, data=fabric_data, partial=True)
                    if serializer.is_valid():
                        # Extract only changed fields
                        from core.utils.field_merge import extract_changed_fields

                        # Get validated data
                        validated_data = serializer.validated_data.copy()

                        # Extract only fields that actually changed
                        changed_fields = extract_changed_fields(fabric, validated_data)

                        if changed_fields:
                            # Get or create ProjectFabric for this project
                            project_fabric, pf_created = ProjectFabric.objects.get_or_create(
                                project=project,
                                fabric=fabric,
                                defaults={
                                    'action': 'reference',
                                    'added_by': user,
                                    'field_overrides': {}
                                }
                            )

                            # Update field_overrides with new changes
                            current_overrides = project_fabric.field_overrides or {}
                            current_overrides.update(changed_fields)
                            project_fabric.field_overrides = current_overrides

                            # Update action to 'modified' unless it's already 'new'
                            if project_fabric.action not in ['new', 'delete']:
                                project_fabric.action = 'modified'

                            project_fabric.added_by = user
                            project_fabric.save()

                            print(f"✏️ Stored field overrides for fabric '{fabric.name}' in project '{project.name}': {changed_fields}")

                        # Return the base fabric data (not modified)
                        saved_fabrics.append(FabricSerializer(fabric).data)
                    else:
                        errors.append({"fabric": fabric_data.get("name", "Unknown"), "errors": serializer.errors})
            else:
                # Create new fabric
                serializer = FabricSerializer(data=fabric_data)
                if serializer.is_valid():
                    fabric = serializer.save(
                        committed=False,
                        deployed=False,
                        created_by_project=project
                    )
                    if user:
                        fabric.last_modified_by = user
                        fabric.save(update_fields=["last_modified_by"])

                    # Auto-add to current project via junction table
                    ProjectFabric.objects.create(
                        project=project,
                        fabric=fabric,
                        action='new',
                        added_by=user,
                        notes='Auto-created with fabric'
                    )

                    saved_fabrics.append(serializer.data)
                else:
                    errors.append({"fabric": fabric_data.get("name", "Unknown"), "errors": serializer.errors})

        if errors:
            return JsonResponse({"error": "Some fabrics could not be saved.", "details": errors}, status=400)

        # Clear dashboard cache when fabrics are saved
        customer = project.customers.first()
        if customer:
            clear_dashboard_cache_for_customer(customer.id)

        return JsonResponse({"message": "Fabrics saved successfully!", "fabrics": saved_fabrics})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
