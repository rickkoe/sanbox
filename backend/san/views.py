from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, generics
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from .models import Alias, Zone, Fabric
from customers.models import Customer
from core.models import Config, Project
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer
from django.db import IntegrityError
from collections import defaultdict
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .san_utils import generate_alias_commands, generate_zone_commands
from django.utils import timezone
import json


class AliasListView(APIView):
    """Fetch aliases belonging to a specific project."""
    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        aliases = Alias.objects.filter(projects=project)  # ✅ Filter aliases by project
        
        # Store project_id for serializer context
        self.project_id = project_id
        
        # Pass context to serializer including project_id and view
        serializer = AliasSerializer(
            aliases, 
            many=True, 
            context={
                'request': request, 
                'view': self,
                'project_id': project_id
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

class AliasSaveView(APIView):
    """Save or update aliases for multiple projects."""
    permission_classes = [AllowAny]
    
    def post(self, request):

        project_id = request.data.get("project_id")
        aliases_data = request.data.get("aliases", [])

        if not project_id or not aliases_data:
            return Response({"error": "Project ID and aliases data are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        saved_aliases = []
        errors = []

        for alias_data in aliases_data:
            alias_id = alias_data.get("id")

            # Ensure projects is a list (since it's many-to-many)
            projects_list = alias_data.pop("projects", [project_id])  # ✅ Defaults to the current project

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
                # ✅ Create new alias
                serializer = AliasSerializer(data=alias_data)
                if serializer.is_valid():
                    alias = serializer.save()
                    alias.updated = timezone.now()
                    alias.save(update_fields=["updated"])
                    alias.projects.set(projects_list)  # ✅ Assign multiple projects
                    saved_aliases.append(serializer.data)
                else:
                    errors.append({"alias": alias_data["name"], "errors": serializer.errors})

        if errors:
            return Response({"error": "Some aliases could not be saved.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Aliases saved successfully!", "aliases": saved_aliases}, status=status.HTTP_200_OK)
 
class AliasDeleteView(generics.DestroyAPIView):
    queryset = Alias.objects.all()
    serializer_class = AliasSerializer

    def delete(self, request, *args, **kwargs):
        alias = self.get_object()
        print(f'Deleting Alias: {alias.name}')
        alias.delete()
        return Response({"message": "Alias deleted successfully."}, status=status.HTTP_200_OK)

class ZonesByProjectView(APIView):
    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
            zones = Zone.objects.filter(projects=project)
            serializer = ZoneSerializer(zones, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

class ZoneSaveView(APIView):
    """
    Save or update zones for multiple projects.
    """
    permission_classes = [AllowAny]
    def post(self, request):
        project_id = request.data.get("project_id")
        zones_data = request.data.get("zones", [])

        if not project_id or not zones_data:
            return Response({"error": "Project ID and zones data are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        saved_zones = []
        errors = []

        for zone_data in zones_data:
            zone_id = zone_data.get("id")

            # Ensure projects is a list (since it's many-to-many)
            projects_list = zone_data.pop("projects", [project_id])  # ✅ Defaults to the current project
            members_list = zone_data.pop("members", [])  # ✅ Handle members

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
                        zone.projects.add(*projects_list)  # ✅ Append projects instead of overwriting
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
                    zone.projects.add(*projects_list)  # ✅ Append projects instead of overwriting
                    member_ids = [member.get('alias') for member in members_list if member.get('alias')]
                    zone.members.set(member_ids)
                    saved_zones.append(ZoneSerializer(zone).data)
                else:
                    errors.append({"zone": zone_data["name"], "errors": serializer.errors})

        if errors:
            return Response({"error": "Some zones could not be saved.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Zones saved successfully!", "zones": saved_zones}, status=status.HTTP_200_OK)
   
class ZoneDeleteView(generics.DestroyAPIView):
    permission_classes = [AllowAny]
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer

    def delete(self, request, *args, **kwargs):
        zone = self.get_object()
        print(f'Deleting Zone: {zone.name}')
        zone.delete()
        return Response({"message": "Zone deleted successfully."}, status=status.HTTP_200_OK)
    

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def fabric_management(request, pk=None):
    """
    GET  /fabrics/                -> List all fabrics (optionally filter by customer via query param)
    GET  /fabrics/{pk}/           -> Retrieve a single fabric
    POST /fabrics/                -> Create a new fabric (requires customer_id in payload)
    PUT  /fabrics/{pk}/           -> Update an existing fabric
    """
    print(f"🔥 Method: {request.method}, PK: {pk}")
    
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
        


class FabricDeleteView(generics.DestroyAPIView):
    permission_classes = [AllowAny]
    queryset = Fabric.objects.all()
    serializer_class = FabricSerializer

    def delete(self, request, *args, **kwargs):
        fabric = self.get_object()
        print(f'Deleting Fabric: {fabric.name}')
        fabric.delete()
        return Response({"message": "Fabric deleted successfully."}, status=status.HTTP_200_OK)
  
@require_http_methods(["GET"])
def generate_alias_scripts(request, project_id):
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


@require_http_methods(["GET"])
def generate_zone_scripts(request, project_id):
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

class AliasByFabricView(APIView):
    """Fetch aliases belonging to a specific fabric."""
    def get(self, request, fabric_id):
        try:
            fabric = Fabric.objects.get(id=fabric_id)
        except Fabric.DoesNotExist:
            return Response({"error": "Fabric not found."}, status=status.HTTP_404_NOT_FOUND)

        aliases = Alias.objects.filter(fabric=fabric)
        serializer = AliasSerializer(aliases, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class AliasCopyToProjectView(APIView):
    """Copy existing aliases to a project by adding the project to their many-to-many relationship."""
    
    def post(self, request):
        project_id = request.data.get("project_id")
        alias_ids = request.data.get("alias_ids", [])

        if not project_id or not alias_ids:
            return Response({"error": "Project ID and alias IDs are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

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
            return Response({
                "message": f"Copied {copied_count} aliases with some errors",
                "errors": errors
            }, status=status.HTTP_207_MULTI_STATUS)

        return Response({
            "message": f"Successfully copied {copied_count} aliases to project!"
        }, status=status.HTTP_200_OK)