from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Config, Project
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer
from customers.serializers import CustomerSerializer 
from django.http import JsonResponse

class ConfigViewSet(viewsets.ModelViewSet):
    queryset = Config.objects.all()
    serializer_class = ConfigSerializer
    filter_backends = [DjangoFilterBackend]  # ✅ Enables ?is_active=True filtering
    filterset_fields = ['is_active']


@api_view(["PUT", "GET"])
def config_detail(request):
    """Get or update Config object"""
    try:
        config = Config.get_active_config()
        print(f"Active Customer: {config.customer.name}")
        print(f"Active SAN Vendor: {config.san_vendor}")
    except Config.DoesNotExist:
        return Response({"error": "Config not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PUT":
        partial_data = request.data.copy()
        # ✅ Convert project ID to integer
        if "project" in partial_data:
            partial_data["project"] = int(partial_data["project"])

        serializer = ConfigSerializer(config, data=partial_data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # ✅ Manually reload from database to confirm save
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