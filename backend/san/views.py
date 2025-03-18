from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from .models import Alias, Zone, Fabric
from customers.models import Customer
from core.models import Config
from .serializers import AliasSerializer, ZoneSerializer, FabricSerializer
from django.db import IntegrityError  # ✅ Catch unique constraint errors

@api_view(["GET", "POST"])
def alias_list(request):
    if request.method == "GET":
        aliases = Alias.objects.all()
        serializer = AliasSerializer(aliases, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = AliasSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def alias_update(request, pk):
    try:
        alias = Alias.objects.get(pk=pk)
    except Alias.DoesNotExist:
        return Response({"error": "Alias not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = AliasSerializer(alias, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "POST"])
def zone_list(request):
    if request.method == "GET":
        zones = Zone.objects.all()
        serializer = ZoneSerializer(zones, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = ZoneSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def zone_update(request, pk):
    try:
        zone = Zone.objects.get(pk=pk)
    except Zone.DoesNotExist:
        return Response({"error": "Zone not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = ZoneSerializer(zone, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "POST"])
def fabric_list(request):
    if request.method == "GET":
        fabrics = Fabric.objects.all()
        serializer = FabricSerializer(fabrics, many=True)
        return Response(serializer.data)
    
    elif request.method == "POST":
        serializer = FabricSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT"])
def fabric_update(request, pk):
    try:
        fabric = Fabric.objects.get(pk=pk)
    except Fabric.DoesNotExist:
        return Response({"error": "Fabric not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = FabricSerializer(fabric, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def fabrics_for_customer(request):
    try:
        config = Config.objects.first()  # ✅ Get the single Config instance
        if not config:
            return Response({"error": "No config found"}, status=status.HTTP_404_NOT_FOUND)

        customer = config.project.customer  # ✅ Get the customer that owns the project

        fabrics = Fabric.objects.filter(customer=customer)  # ✅ Filter by customer
        serializer = FabricSerializer(fabrics, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
def aliases_for_project(request):
    try:
        config = Config.objects.first()  # ✅ Get the single Config instance
        if not config:
            return Response({"error": "No config found"}, status=status.HTTP_404_NOT_FOUND)

        aliases = Alias.objects.filter(projects=config.project)
        serializer = AliasSerializer(aliases, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 

@api_view(["GET"])
def zones_for_project(request):
    try:
        config = Config.objects.first()  # ✅ Get the single Config instance
        if not config:
            return Response({"error": "No config found"}, status=status.HTTP_404_NOT_FOUND)

        zones = Zone.objects.filter(projects=config.project)  # ✅ Filter by customer
        serializer = ZoneSerializer(zones, many=True)
        return Response(serializer.data)
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