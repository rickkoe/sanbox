from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, generics
from .models import Alias, Zone, Fabric
from customers.models import Customer
from core.models import Config, Project
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer
from django.db import IntegrityError


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
    

class SaveFabricsView(APIView):
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


class SaveAliasesView(APIView):
    """Save or update aliases for multiple projects."""
    
    def post(self, request):
        print("\n🔍 Received alias save request.")
        print("📩 Request Data:", request.data)

        project_id = request.data.get("project_id")
        aliases_data = request.data.get("aliases", [])

        if not project_id or not aliases_data:
            print("⚠️ Missing project_id or aliases_data in request.")
            return Response({"error": "Project ID and aliases data are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
            print(f"✅ Found Project: {project}")
        except Project.DoesNotExist:
            print(f"❌ Project ID {project_id} not found.")
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        saved_aliases = []
        errors = []

        for alias_data in aliases_data:
            alias_id = alias_data.get("id")
            print("\n🔄 Processing Alias:", alias_data)

            # Ensure projects is a list (since it's many-to-many)
            projects_list = alias_data.pop("projects", [project_id])  # ✅ Defaults to the current project
            print(f"📌 Projects Assigned: {projects_list}")

            if alias_id:
                # ✅ Update existing alias
                alias = Alias.objects.filter(id=alias_id).first()
                if alias:
                    print(f"✏️ Updating Alias ID {alias_id}: {alias}")
                    serializer = AliasSerializer(alias, data=alias_data, partial=True)
                    if serializer.is_valid():
                        alias = serializer.save()
                        saved_aliases.append(serializer.data)
                        print(f"✅ Successfully updated Alias ID {alias_id}")
                    else:
                        errors.append({"alias": alias_data["name"], "errors": serializer.errors})
                        print(f"❌ Alias update failed for {alias_data['name']}: {serializer.errors}")
            else:
                # ✅ Create new alias
                print(f"➕ Creating new alias: {alias_data}")
                serializer = AliasSerializer(data=alias_data)
                if serializer.is_valid():
                    alias = serializer.save()
                    alias.projects.set(projects_list)  # ✅ Assign multiple projects
                    saved_aliases.append(serializer.data)
                    print(f"✅ Successfully created new alias: {alias}")
                else:
                    errors.append({"alias": alias_data["name"], "errors": serializer.errors})
                    print(f"❌ Alias creation failed for {alias_data['name']}: {serializer.errors}")

        if errors:
            print("⚠️ Some aliases could not be saved.")
            return Response({"error": "Some aliases could not be saved.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        print("✅ All aliases processed successfully.")
        return Response({"message": "Aliases saved successfully!", "aliases": saved_aliases}, status=status.HTTP_200_OK)
    

class ZonesByProjectView(APIView):
    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
            zones = Zone.objects.filter(projects=project)
            serializer = ZoneSerializer(zones, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)


class SaveZonesView(APIView):
    """
    Save or update zones for multiple projects.
    """
    def post(self, request):
        project_id = request.data.get("project_id")
        zones_data = request.data.get("zones", [])

        print(f"🔍 Received project_id: {project_id}")
        print(f"🔍 Received zones_data: {zones_data}")

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
                print(f'updating existing zone {zone_id}')
                zone = Zone.objects.filter(id=zone_id).first()
                if zone:
                    serializer = ZoneSerializer(zone, data=zone_data, partial=True)
                    if serializer.is_valid():
                        zone = serializer.save()
                        zone.projects.add(*projects_list)  # ✅ Append projects instead of overwriting
                        member_ids = [member.get('alias') for member in members_list if member.get('alias')]
                        zone.members.set(member_ids)
                        saved_zones.append(serializer.data)
                    else:
                        errors.append({"zone": zone_data["name"], "errors": serializer.errors})
            else:
                print(f'creating new zone {zone_data['name']}')
                serializer = ZoneSerializer(data=zone_data)
                print(f'SERIALIZER:{serializer}')
                if serializer.is_valid():
                    print(f'SERIALIZER:{serializer}')
                    zone = serializer.save()
                    zone.projects.add(*projects_list)  # ✅ Append projects instead of overwriting
                    member_ids = [member.get('alias') for member in members_list if member.get('alias')]
                    zone.members.set(member_ids)
                    saved_zones.append(serializer.data)
                else:
                    print("WAAAAAAA")
                    errors.append({"zone": zone_data["name"], "errors": serializer.errors})

        if errors:
            return Response({"error": "Some zones could not be saved.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Zones saved successfully!", "zones": saved_zones}, status=status.HTTP_200_OK)
    

class ZonesByProjectView(APIView):
    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
            zones = Zone.objects.filter(projects=project)
            serializer = ZoneSerializer(zones, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Project.DoesNotExist:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        

class DeleteFabricView(generics.DestroyAPIView):
    queryset = Fabric.objects.all()
    serializer_class = FabricSerializer

    def delete(self, request, *args, **kwargs):
        print('here')
        fabric = self.get_object()
        fabric.delete()
        return Response({"message": "Fabric deleted successfully."}, status=status.HTTP_200_OK)