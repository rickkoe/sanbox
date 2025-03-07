from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Config, Project
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer
from customers.serializers import CustomerSerializer 


@api_view(["PUT", "GET"])
def config_detail(request):
    """Get or update Config object"""
    try:
        config = Config.objects.first()
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
@api_view(["GET"])
def projects_for_customer(request, customer_id):
    projects = Project.objects.filter(customer_id=customer_id)  # ✅ Ensure this works
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)