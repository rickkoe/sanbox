from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, generics
from .models import Alias, Zone, Fabric
from customers.models import Customer
from core.models import Config, Project
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer
from django.db import IntegrityError
from collections import defaultdict
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .san_utils import generate_alias_commands, generate_zone_commands
from django.utils import timezone

class AliasListView(APIView):
    """Fetch aliases belonging to a specific project."""
    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        aliases = Alias.objects.filter(projects=project)  # ✅ Filter aliases by project
        serializer = AliasSerializer(aliases, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class AliasSaveView(APIView):
    """Save or update aliases for multiple projects."""
    
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
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer

    def delete(self, request, *args, **kwargs):
        zone = self.get_object()
        print(f'Deleting Zone: {zone.name}')
        zone.delete()
        return Response({"message": "Zone deleted successfully."}, status=status.HTTP_200_OK)
    
class FabricsForCustomerView(APIView):
    def get(self, request, *args, **kwargs):
        try:
            config = Config.objects.first()  # Get the single Config instance
            if not config:
                return Response({"error": "No config found"}, status=status.HTTP_404_NOT_FOUND)
            customer = config.project.customer  # Get the customer that owns the project
            fabrics = Fabric.objects.filter(customer=customer)  # Filter by customer
            serializer = FabricSerializer(fabrics, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class FabricsByCustomerView(APIView):
    def get(self, request, customer_id):
        fabrics = Fabric.objects.filter(customer_id=customer_id)  # ✅ Ensure filtering by customer ID
        if not fabrics.exists():
            return Response({"error": "No fabrics found for this customer."}, status=status.HTTP_404_NOT_FOUND)

        serializer = FabricSerializer(fabrics, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class FabricSaveView(APIView):
    def post(self, request):
        customer_id = request.data.get("customer_id")
        fabrics_data = request.data.get("fabrics", [])

        if not customer_id or not fabrics_data:
            return Response({"error": "Customer ID and fabrics data are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        saved_fabrics = []
        errors = []  # ✅ Collect errors

        for fabric_data in fabrics_data:
            fabric_id = fabric_data.get("id")

            if fabric_id:
                # ✅ Update existing fabric
                fabric = Fabric.objects.filter(id=fabric_id, customer=customer).first()
                if fabric:
                    serializer = FabricSerializer(fabric, data=fabric_data, partial=True)
                    if serializer.is_valid():
                        serializer.save()
                        saved_fabrics.append(serializer.data)
                    else:
                        errors.append({"fabric": fabric_data["name"], "errors": serializer.errors})
            else:
                # ✅ Create new fabric
                fabric_data["customer"] = customer.id
                serializer = FabricSerializer(data=fabric_data)
                try:
                    if serializer.is_valid():
                        serializer.save()
                        saved_fabrics.append(serializer.data)
                    else:
                        errors.append({"fabric": fabric_data["name"], "errors": serializer.errors})
                except IntegrityError:  # ✅ Catch duplicate errors
                    errors.append({
                        "fabric": fabric_data["name"],
                        "errors": "A fabric with this name already exists for this customer."
                    })

        if errors:
            return Response({"error": "Some fabrics could not be saved.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Fabrics saved successfully!", "fabrics": saved_fabrics}, status=status.HTTP_200_OK)
    

    from rest_framework.response import Response

class FabricDeleteView(generics.DestroyAPIView):
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
    print(config.active_project)


    try:
        aliases = Alias.objects.filter(create=True, projects=config.active_project)
    except Exception as e:
        return JsonResponse({"error": "Error fetching alias records.", "details": str(e)}, status=500)

    commands = generate_alias_commands(aliases, config)
    
    return JsonResponse({"alias_scripts": commands}, safe=False)

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

    commands = generate_zone_commands(zones, config)
    return JsonResponse({"zone_scripts": commands}, safe=False)