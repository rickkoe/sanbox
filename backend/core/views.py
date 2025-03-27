from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Config, Project
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer, ActiveConfigSerializer
from customers.serializers import CustomerSerializer 
from django.http import JsonResponse

class ConfigViewSet(viewsets.ModelViewSet):
    queryset = Config.objects.all()
    serializer_class = ConfigSerializer
    filter_backends = [DjangoFilterBackend]  # ✅ Enables ?is_active=True filtering
    filterset_fields = ['is_active']


class ActiveConfigView(APIView):
    """View to return the active config, optionally filtered by customer"""
    def get(self, request):
        customer_id = request.query_params.get('customer')
        if customer_id:
            config = Config.objects.filter(customer_id=customer_id, is_active=True).first()
        else:
            config = Config.objects.filter(is_active=True).first()
        if config:
            serializer = ConfigSerializer(config)
            return Response(serializer.data)
        else:
            return Response({}, status=404)


@api_view(["PUT", "GET"])
def config_detail(request):
    """Get or update Config object filtered by customer if provided"""
    customer_id = request.query_params.get('customer')
    if customer_id:
        try:
            # Get the active config for the specified customer
            config = Config.objects.get(customer_id=customer_id, is_active=True)
        except Config.DoesNotExist:
            return Response({"error": "Active Config not found for customer"}, status=status.HTTP_404_NOT_FOUND)
    else:
        try:
            config = Config.get_active_config()
        except Config.DoesNotExist:
            return Response({"error": "Config not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == "PUT":
        partial_data = request.data.copy()
        # Convert project ID to integer if present
        if "project" in partial_data:
            partial_data["project"] = int(partial_data["project"])
        serializer = ConfigSerializer(config, data=partial_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Reload from database to confirm save
            config.refresh_from_db()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = ConfigSerializer(config)
    return Response(serializer.data)

# ✅ Fetch all customers
@api_view(["GET"])
def customer_list(request):
    customers = Customer.objects.all()
    serializer = CustomerSerializer(customers, many=True)
    return Response(serializer.data)

# ✅ Fetch projects for a selected customer
def projects_for_customer(request, customer_id):
    try:
        customer = Customer.objects.get(id=customer_id)
        projects = customer.projects.all()  # ✅ Correct way to access ManyToManyField
        project_data = [{"id": project.id, "name": project.name} for project in projects]
        return JsonResponse(project_data, safe=False)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found"}, status=404)

@api_view(["GET"])
def config_for_customer(request, customer_id):
    """Return the active config for the specified customer ID"""
    try:
        config = Config.objects.get(customer_id=customer_id)
    except Config.DoesNotExist:
        return Response({"error": "Config not found for customer"}, status=status.HTTP_404_NOT_FOUND)
    serializer = ConfigSerializer(config)
    return Response(serializer.data)

@api_view(['PUT'])
def update_config(request, customer_id):
    """
    Update a configuration by ID. The payload should include the updated values,
    and this view will ensure that is_active is set to True.
    """
    try:
        config = Config.objects.get(customer=customer_id)
    except Config.DoesNotExist:
        return Response({"error": "Config not found"}, status=status.HTTP_404_NOT_FOUND)
    
    # Make sure to set is_active to True

    data = request.data.copy()
    data['is_active'] = True
    
    serializer = ConfigSerializer(config, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)