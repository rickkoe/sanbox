import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Customer
from .serializers import CustomerSerializer
from core.models import Config
from django.db.models import Q
from django.core.paginator import Paginator
from urllib.parse import urlencode

@csrf_exempt
@require_http_methods(["GET", "POST", "PUT"])
def customer_management(request, pk=None):
    """
    GET /customers/           -> list all customers (paginated)
    GET /customers/{pk}/     -> retrieve a single customer
    POST /customers/         -> create a new customer (plus Config)
    PUT  /customers/{pk}/    -> update an existing customer
    """
    print(f"🔥 Customer Method: {request.method}, PK: {pk}")
    
    if request.method == "GET":
        if pk is None:
            # Get query parameters
            page_number = request.GET.get('page', 1)
            page_size = request.GET.get('page_size', 100)
            search = request.GET.get('search', '')
            ordering = request.GET.get('ordering', 'id')
            
            # Convert to integers with defaults
            try:
                page_number = int(page_number)
                page_size = int(page_size) if page_size != 'All' else None
            except (ValueError, TypeError):
                page_number = 1
                page_size = 100
            
            # Build queryset
            customers = Customer.objects.all()
            
            # Apply search if provided
            if search:
                customers = customers.filter(
                    Q(name__icontains=search) | 
                    Q(insights_tenant__icontains=search) |
                    Q(notes__icontains=search)
                )
            
            # Apply ordering
            if ordering:
                customers = customers.order_by(ordering)
            
            # Get total count before pagination
            total_count = customers.count()
            
            # Handle "All" page size
            if page_size is None:
                # Return all results without pagination
                data = CustomerSerializer(customers, many=True).data
                return JsonResponse({
                    'count': total_count,
                    'next': None,
                    'previous': None,
                    'results': data
                })
            
            # Create paginator
            paginator = Paginator(customers, page_size)
            
            # Get the requested page
            try:
                page_obj = paginator.get_page(page_number)
            except:
                page_obj = paginator.get_page(1)
            
            # Serialize the page data
            data = CustomerSerializer(page_obj.object_list, many=True).data
            
            # Build next/previous URLs
            base_url = request.build_absolute_uri(request.path)
            
            # Build query parameters for next/prev links
            query_params = {}
            if search:
                query_params['search'] = search
            if ordering:
                query_params['ordering'] = ordering
            query_params['page_size'] = page_size
            
            next_url = None
            if page_obj.has_next():
                query_params['page'] = page_obj.next_page_number()
                next_url = f"{base_url}?{urlencode(query_params)}"
            
            previous_url = None
            if page_obj.has_previous():
                query_params['page'] = page_obj.previous_page_number()
                previous_url = f"{base_url}?{urlencode(query_params)}"
            
            return JsonResponse({
                'count': total_count,
                'next': next_url,
                'previous': previous_url,
                'results': data
            })
            
        # Single customer GET remains the same
        try:
            customer = Customer.objects.get(pk=pk)
            data = CustomerSerializer(customer).data
            return JsonResponse(data)
        except Customer.DoesNotExist:
            return JsonResponse({"error": "Customer not found"}, status=404)

    # POST and PUT methods remain the same
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