import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Customer
from .serializers import CustomerSerializer
from core.models import Config

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def customer_management(request, pk=None):
    """
    GET /customers/           -> list all customers
    GET /customers/{pk}/     -> retrieve a single customer
    POST /customers/         -> create a new customer (plus Config)
    PUT  /customers/{pk}/    -> update an existing customer
    """
    print(f"🔥 Customer Method: {request.method}, PK: {pk}")
    
    if request.method == "GET":
        if pk is None:
            customers = Customer.objects.all()
            data = CustomerSerializer(customers, many=True).data
            return JsonResponse(data, safe=False)
        try:
            customer = Customer.objects.get(pk=pk)
            data = CustomerSerializer(customer).data
            return JsonResponse(data)
        except Customer.DoesNotExist:
            return JsonResponse({"error": "Customer not found"}, status=404)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = CustomerSerializer(data=data)
            if serializer.is_valid():
                customer = serializer.save()
                Config.objects.create(customer=customer)
                return JsonResponse(CustomerSerializer(customer).data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "PUT":
        if pk is None:
            return JsonResponse({"error": "Missing customer ID for update"}, status=400)
        try:
            customer = Customer.objects.get(pk=pk)
            data = json.loads(request.body)
            serializer = CustomerSerializer(customer, data=data, partial=True)
            if serializer.is_valid():
                updated = serializer.save()
                return JsonResponse(CustomerSerializer(updated).data)
            return JsonResponse(serializer.errors, status=400)
        except Customer.DoesNotExist:
            return JsonResponse({"error": "Customer not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def customer_delete(request, pk):
    print(f"🔥 Customer Delete: PK: {pk}")
    try:
        customer = Customer.objects.get(pk=pk)
        customer.delete()
        return JsonResponse({"message": "Customer deleted successfully"}, status=204)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)