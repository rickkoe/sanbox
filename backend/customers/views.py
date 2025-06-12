from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from .models import Customer
from .serializers import CustomerSerializer
from core.models import Config

@csrf_exempt  # Disable CSRF for this view, if needed
@api_view(["GET", "POST", "PUT"])
def customer_management(request, pk=None):
    """
    GET /customers/           -> list all customers
    GET /customers/{pk}/     -> retrieve a single customer
    POST /customers/         -> create a new customer (plus Config)
    PUT  /customers/{pk}/    -> update an existing customer
    """
    # List or retrieve
    if request.method == "GET":
        if pk is None:
            customers = Customer.objects.all()
            serializer = CustomerSerializer(customers, many=True)
            return Response(serializer.data)
        try:
            customer = Customer.objects.get(pk=pk)
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerSerializer(customer)
        return Response(serializer.data)

    # Create
    if request.method == "POST":
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            customer = serializer.save()
            Config.objects.create(customer=customer)
            return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Update
    if request.method == "PUT":
        if pk is None:
            return Response({"error": "Missing customer ID for update"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            customer = Customer.objects.get(pk=pk)
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerSerializer(customer, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@csrf_exempt
@api_view(["DELETE"])
def customer_delete(request, pk):
    try:
        customer = Customer.objects.get(pk=pk)
        customer.delete()
        return Response({"message": "Customer deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
    except Customer.DoesNotExist:
        return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)