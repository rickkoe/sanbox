import json
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from .models import Alias, Zone, Fabric, WwpnPrefix
from customers.models import Customer
from core.models import Config, Project
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer, WwpnPrefixSerializer
from django.db import IntegrityError
from collections import defaultdict
from .san_utils import generate_alias_commands, generate_zone_commands
from django.utils import timezone
from core.dashboard_views import clear_dashboard_cache_for_customer


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "PATCH", "DELETE"])
def fabric_management(request, pk=None):
    """Handle fabric CRUD operations with pagination and filtering."""
    print(f"🔥 Fabric Management - Method: {request.method}, PK: {pk}")
    
    if request.method == "GET":
        if pk:
            # Get specific fabric
            try:
                fabric = Fabric.objects.get(pk=pk)
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
                fabrics = Fabric.objects.select_related('customer').all()
                
                # Filter by customer if provided
                if customer_id:
                    fabrics = fabrics.filter(customer=customer_id)
                
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
        # Create new fabric
        try:
            data = json.loads(request.body)
            serializer = FabricSerializer(data=data)
            if serializer.is_valid():
                fabric = serializer.save()
                fabric.imported = timezone.now()
                fabric.save(update_fields=['imported'] if hasattr(fabric, 'imported') else [])
                
                # Clear dashboard cache when fabric is created
                if fabric.customer_id:
                    clear_dashboard_cache_for_customer(fabric.customer_id)
                
                return JsonResponse({
                    'message': f'Fabric "{fabric.name}" created successfully',
                    'fabric': FabricSerializer(fabric).data
                }, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method in ["PUT", "PATCH"]:
        # Update existing fabric
        if not pk:
            return JsonResponse({"error": "Fabric ID required for update"}, status=400)
        
        try:
            fabric = Fabric.objects.get(pk=pk)
            data = json.loads(request.body)
            serializer = FabricSerializer(fabric, data=data, partial=(request.method == "PATCH"))
            if serializer.is_valid():
                fabric = serializer.save()
                if hasattr(fabric, 'updated'):
                    fabric.updated = timezone.now()
                    fabric.save(update_fields=['updated'])
                
                # Clear dashboard cache when fabric is updated
                if fabric.customer_id:
                    clear_dashboard_cache_for_customer(fabric.customer_id)
                
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
        # Delete fabric
        if not pk:
            return JsonResponse({"error": "Fabric ID required for deletion"}, status=400)
        
        try:
            fabric = Fabric.objects.get(pk=pk)
            customer_id = fabric.customer_id
            fabric_name = fabric.name
            fabric.delete()
            
            # Clear dashboard cache when fabric is deleted
            if customer_id:
                clear_dashboard_cache_for_customer(customer_id)
                
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
    
    try:
        fabric = Fabric.objects.get(pk=pk)
        customer_id = fabric.customer_id
        fabric_name = fabric.name
        fabric.delete()
        
        # Clear dashboard cache when fabric is deleted
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)
            
        return JsonResponse({
            "message": f'Fabric "{fabric_name}" deleted successfully'
        }, status=200)
    except Fabric.DoesNotExist:
        return JsonResponse({"error": "Fabric not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def alias_list_view(request, project_id):
    """Fetch aliases belonging to a specific project."""
    print(f"🔥 Alias List - Project ID: {project_id}")
    
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    
    # Get query parameters
    search = request.GET.get('search', '').strip()
    ordering = request.GET.get('ordering', 'name')
    
    # Base queryset with optimizations and zoned_count annotation
    from django.db.models import Count, Q as Q_models
    aliases_queryset = Alias.objects.select_related('fabric').prefetch_related('projects').annotate(
        _zoned_count=Count('zone', filter=Q_models(zone__projects=project), distinct=True)
    ).filter(projects=project)
    
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
    for param, value in request.GET.items():
        if param.startswith(('name__', 'wwpn__', 'use__', 'fabric__name__', 'cisco_alias__', 'notes__', 'create__', 'include_in_zoning__')):
            filter_params[param] = value
    
    # Apply the filters
    if filter_params:
        aliases_queryset = aliases_queryset.filter(**filter_params)
    
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
    serializer = AliasSerializer(
        page_obj,
        many=True,
        context={'project_id': project_id}
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
@require_http_methods(["POST"])
def alias_save_view(request):
    """Save or update aliases for multiple projects."""
    print(f"🔥 Alias Save - Method: {request.method}")
    
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

        saved_aliases = []
        errors = []

        for alias_data in aliases_data:
            alias_id = alias_data.get("id")

            # Ensure projects is a list (since it's many-to-many)
            projects_list = alias_data.pop("projects", [project_id])  # Defaults to the current project

            if alias_id:
                alias = Alias.objects.filter(id=alias_id).first()
                if alias:
                    serializer = AliasSerializer(alias, data=alias_data, partial=True)
                    if serializer.is_valid():
                        # Manual dirty check
                        dirty = False
                        for field, value in serializer.validated_data.items():
                            if getattr(alias, field) != value:
                                dirty = True
                                break
                        alias = serializer.save()
                        if dirty:
                            alias.updated = timezone.now()
                            alias.save(update_fields=["updated"])
                        saved_aliases.append(AliasSerializer(alias).data)
                    else:
                        errors.append({"alias": alias_data.get("name", "Unknown"), "errors": serializer.errors})
            else:
                # Create new alias
                serializer = AliasSerializer(data=alias_data)
                if serializer.is_valid():
                    alias = serializer.save()
                    alias.updated = timezone.now()
                    alias.save(update_fields=["updated"])
                    alias.projects.set(projects_list)  # Assign multiple projects
                    saved_aliases.append(serializer.data)
                else:
                    errors.append({"alias": alias_data["name"], "errors": serializer.errors})

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
    
    try:
        alias = Alias.objects.get(pk=pk)
        customer_id = None
        # Get customer ID from any project the alias belongs to
        if alias.projects.exists():
            project = alias.projects.first()
            customer = project.customers.first()
            if customer:
                customer_id = customer.id
        print(f'Deleting Alias: {alias.name}')
        alias.delete()
        
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
        
        # Get query parameters
        search = request.GET.get('search', '')
        ordering = request.GET.get('ordering', 'id')
        
        # Build queryset with optimizations
        zones = Zone.objects.select_related('fabric').prefetch_related('members', 'projects').filter(projects=project)
        
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
            if param.startswith(('name__', 'fabric__name__', 'zone_type__', 'notes__', 'create__', 'exists__')):
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
        serializer = ZoneSerializer(page_obj, many=True)
        
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
@require_http_methods(["POST"])
def zone_save_view(request):
    """Save or update zones for multiple projects."""
    print(f"🔥 Zone Save - Method: {request.method}")
    
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
                    serializer = ZoneSerializer(zone, data=zone_data, partial=True)
                    if serializer.is_valid():
                        # Manual dirty check
                        dirty = False
                        for field, value in serializer.validated_data.items():
                            if getattr(zone, field) != value:
                                dirty = True
                                break
                        zone = serializer.save()
                        if dirty:
                            zone.updated = timezone.now()
                            zone.save(update_fields=["updated"])
                        zone.projects.add(*projects_list)  # Append projects instead of overwriting
                        member_ids = [member.get('alias') for member in members_list if member.get('alias')]
                        print(f"🎯 [UPDATE] Setting members for {zone_name}: {member_ids}")
                        zone.members.set(member_ids)
                        print(f"✅ [UPDATE] Members set for {zone_name}. Final count: {zone.members.count()}")
                        saved_zones.append(ZoneSerializer(zone).data)
                    else:
                        errors.append({"zone": zone_data["name"], "errors": serializer.errors})
            else:
                serializer = ZoneSerializer(data=zone_data)
                if serializer.is_valid():
                    zone = serializer.save()
                    zone.updated = timezone.now()
                    zone.save(update_fields=["updated"])
                    zone.projects.add(*projects_list)  # Append projects instead of overwriting
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
    
    try:
        zone = Zone.objects.get(pk=pk)
        customer_id = None
        # Get customer ID from any project the zone belongs to
        if zone.projects.exists():
            project = zone.projects.first()
            customer = project.customers.first()
            if customer:
                customer_id = customer.id
        print(f'Deleting Zone: {zone.name}')
        zone.delete()
        
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
    print(f"🔥 Fabric Management - Method: {request.method}, PK: {pk}")
    
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
        qs = Fabric.objects.select_related('customer').all()
        
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
    
    config = Config.get_active_config()
    if not config:
        return JsonResponse({"error": "Configuration is missing."}, status=500)
    
    try:
        aliases = Alias.objects.filter(create=True, projects=config.active_project)
    except Exception as e:
        return JsonResponse({"error": "Error fetching alias records.", "details": str(e)}, status=500)

    command_data = generate_alias_commands(aliases, config)
    
    # Transform the new structure to maintain backward compatibility
    result = {}
    for fabric_name, fabric_data in command_data.items():
        result[fabric_name] = {
            "commands": fabric_data["commands"],
            "fabric_info": fabric_data["fabric_info"]
        }
    
    return JsonResponse({"alias_scripts": result}, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
def generate_zone_scripts(request, project_id):
    """Generate zone scripts for a project."""
    print(f"🔥 Generate Zone Scripts - Project ID: {project_id}")
    
    if not project_id:
        return JsonResponse({"error": "Missing project_id in query parameters."}, status=400)
    
    config = Config.get_active_config()
    if not config:
        return JsonResponse({"error": "Configuration is missing."}, status=500)
    try:
        zones = Zone.objects.filter(create=True, projects=config.active_project)
    except Exception as e:
        return JsonResponse({"error": "Error fetching zone records.", "details": str(e)}, status=500)

    command_data = generate_zone_commands(zones, config)
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
                # Add the project to the alias's projects (many-to-many)
                alias.projects.add(project)
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