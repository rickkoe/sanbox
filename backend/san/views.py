import json
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Alias, Zone, Fabric
from customers.models import Customer
from core.models import Config, Project
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer
from django.db import IntegrityError
from collections import defaultdict
from .san_utils import generate_alias_commands, generate_zone_commands
from django.utils import timezone


@csrf_exempt
@require_http_methods(["GET"])
def alias_list_view(request, project_id):
    """Fetch aliases belonging to a specific project with pagination."""
    print(f"🔥 Alias List - Project ID: {project_id}")
    
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found."}, status=404)
    
    # Get pagination parameters
    page = int(request.GET.get('page', 1))
    page_size = request.GET.get('page_size', '100')
    
    # Handle "All" page size
    if page_size == 'All':
        page_size = None
    else:
        page_size = int(page_size)
    
    # Get search parameter
    search = request.GET.get('search', '').strip()
    
    # Base queryset
    aliases_queryset = Alias.objects.filter(projects=project)
    
    # Apply search if provided
    if search:
        aliases_queryset = aliases_queryset.filter(
            Q(name__icontains=search) |
            Q(wwpn__icontains=search) |
            Q(notes__icontains=search) |
            Q(fabric__name__icontains=search)
        )
    
    # Order by name for consistent pagination
    aliases_queryset = aliases_queryset.order_by('name')
    
    if page_size is None:
        # Return all results
        aliases = aliases_queryset
        serializer = AliasSerializer(
            aliases,
            many=True,
            context={'project_id': project_id}
        )
        
        return JsonResponse({
            'results': serializer.data,
            'count': len(serializer.data),
            'page': 1,
            'page_size': 'All',
            'total_pages': 1,
            'has_next': False,
            'has_previous': False,
            'next': None,
            'previous': None
        })
    
    # Paginate results
    paginator = Paginator(aliases_queryset, page_size)
    total_pages = paginator.num_pages
    
    # Ensure page number is valid
    if page > total_pages and total_pages > 0:
        page = total_pages
    elif page < 1:
        page = 1
    
    page_obj = paginator.get_page(page)
    
    # Serialize the current page
    serializer = AliasSerializer(
        page_obj.object_list,
        many=True,
        context={'project_id': project_id}
    )
    
    # Build pagination URLs
    base_url = request.build_absolute_uri().split('?')[0]
    next_url = None
    previous_url = None
    
    if page_obj.has_next():
        next_url = f"{base_url}?page={page_obj.next_page_number()}&page_size={page_size}"
        if search:
            next_url += f"&search={search}"
    
    if page_obj.has_previous():
        previous_url = f"{base_url}?page={page_obj.previous_page_number()}&page_size={page_size}"
        if search:
            previous_url += f"&search={search}"
    
    return JsonResponse({
        'results': serializer.data,
        'count': paginator.count,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous(),
        'next': next_url,
        'previous': previous_url
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
        print(f'Deleting Alias: {alias.name}')
        alias.delete()
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
        project = Project.objects.get(id=project_id)
        zones = Zone.objects.filter(projects=project)
        serializer = ZoneSerializer(zones, many=True)
        return JsonResponse(serializer.data, safe=False)
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

            # Ensure projects is a list (since it's many-to-many)
            projects_list = zone_data.pop("projects", [project_id])  # Defaults to the current project
            members_list = zone_data.pop("members", [])  # Handle members

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
                        zone.members.set(member_ids)
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
                    zone.members.set(member_ids)
                    saved_zones.append(ZoneSerializer(zone).data)
                else:
                    errors.append({"zone": zone_data["name"], "errors": serializer.errors})

        if errors:
            return JsonResponse({"error": "Some zones could not be saved.", "details": errors}, status=400)

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
        print(f'Deleting Zone: {zone.name}')
        zone.delete()
        return JsonResponse({"message": "Zone deleted successfully."})
    except Zone.DoesNotExist:
        return JsonResponse({"error": "Zone not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def fabric_management(request, pk=None):
    """
    GET  /fabrics/                -> List all fabrics (optionally filter by customer via query param)
    GET  /fabrics/{pk}/           -> Retrieve a single fabric
    POST /fabrics/                -> Create a new fabric (requires customer_id in payload)
    PUT  /fabrics/{pk}/           -> Update an existing fabric
    """
    print(f"🔥 Fabric Management - Method: {request.method}, PK: {pk}")
    
    if request.method == "GET":
        customer_id = request.GET.get("customer_id")
        if pk:
            try:
                fabric = Fabric.objects.get(pk=pk)
                data = FabricSerializer(fabric).data
                return JsonResponse(data)
            except Fabric.DoesNotExist:
                return JsonResponse({"error": "Fabric not found"}, status=404)
        
        qs = Fabric.objects.all()
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        data = FabricSerializer(qs, many=True).data
        return JsonResponse(data, safe=False)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = FabricSerializer(data=data)
            if serializer.is_valid():
                fabric = serializer.save()
                return JsonResponse(FabricSerializer(fabric).data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
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
                return JsonResponse(FabricSerializer(updated).data)
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
        print(f'Deleting Fabric: {fabric.name}')
        fabric.delete()
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