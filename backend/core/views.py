import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from .models import Config, Project
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer, ActiveConfigSerializer
from customers.serializers import CustomerSerializer 


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE"])
def config_viewset(request, pk=None):
    """
    Handle Config CRUD operations with optional filtering
    GET /configs/                -> List all configs (optionally filter by ?is_active=True)
    GET /configs/{pk}/          -> Retrieve a single config
    POST /configs/              -> Create a new config
    PUT /configs/{pk}/          -> Update an existing config
    DELETE /configs/{pk}/       -> Delete a config
    """
    print(f"🔥 Config ViewSet - Method: {request.method}, PK: {pk}")
    
    if request.method == "GET":
        is_active = request.GET.get("is_active")
        
        if pk:
            try:
                config = Config.objects.get(pk=pk)
                data = ConfigSerializer(config).data
                return JsonResponse(data)
            except Config.DoesNotExist:
                return JsonResponse({"error": "Config not found"}, status=404)
        
        qs = Config.objects.all()
        if is_active:
            # Convert string to boolean
            is_active_bool = is_active.lower() == 'true'
            qs = qs.filter(is_active=is_active_bool)
        
        data = ConfigSerializer(qs, many=True).data
        return JsonResponse(data, safe=False)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            serializer = ConfigSerializer(data=data)
            if serializer.is_valid():
                config = serializer.save()
                return JsonResponse(ConfigSerializer(config).data, status=201)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "PUT":
        if not pk:
            return JsonResponse({"error": "Missing config ID"}, status=400)
        
        try:
            config = Config.objects.get(pk=pk)
        except Config.DoesNotExist:
            return JsonResponse({"error": "Config not found"}, status=404)
        
        try:
            data = json.loads(request.body)
            serializer = ConfigSerializer(config, data=data, partial=True)
            if serializer.is_valid():
                updated = serializer.save()
                return JsonResponse(ConfigSerializer(updated).data)
            return JsonResponse(serializer.errors, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "DELETE":
        if not pk:
            return JsonResponse({"error": "Missing config ID"}, status=400)
        
        try:
            config = Config.objects.get(pk=pk)
            config.delete()
            return JsonResponse({"message": "Config deleted successfully"}, status=204)
        except Config.DoesNotExist:
            return JsonResponse({"error": "Config not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def active_config_view(request):
    """View to return the active config, optionally filtered by customer"""
    print(f"🔥 Active Config View - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer')
        if customer_id:
            config = Config.objects.filter(customer_id=customer_id, is_active=True).first()
        else:
            config = Config.objects.filter(is_active=True).first()
        
        if config:
            serializer = ConfigSerializer(config)
            return JsonResponse(serializer.data)
        else:
            return JsonResponse({}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT", "GET"])
def config_detail(request):
    """Get or update Config object filtered by customer if provided"""
    print(f"🔥 Config Detail - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer')
        if customer_id:
            try:
                # Get the active config for the specified customer
                config = Config.objects.get(customer_id=customer_id, is_active=True)
            except Config.DoesNotExist:
                return JsonResponse({"error": "Active Config not found for customer"}, status=404)
        else:
            try:
                config = Config.get_active_config()
            except Config.DoesNotExist:
                return JsonResponse({"error": "Config not found"}, status=404)
        
        if request.method == "PUT":
            data = json.loads(request.body)
            partial_data = data.copy()
            # Convert project ID to integer if present
            if "project" in partial_data:
                partial_data["project"] = int(partial_data["project"])
            serializer = ConfigSerializer(config, data=partial_data, partial=True)
            if serializer.is_valid():
                serializer.save()
                # Reload from database to confirm save
                config.refresh_from_db()
                return JsonResponse(ConfigSerializer(config).data)
            return JsonResponse(serializer.errors, status=400)
        
        serializer = ConfigSerializer(config)
        return JsonResponse(serializer.data)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def customer_list(request):
    """Fetch all customers"""
    print(f"🔥 Customer List - Method: {request.method}")
    
    try:
        customers = Customer.objects.all().order_by('name')
        
        # Enhanced customer data for dashboard
        customer_data = []
        for customer in customers:
            customer_info = {
                'id': customer.id,
                'name': customer.name,
                'insights_tenant': getattr(customer, 'insights_tenant', None),
                'insights_api_key': bool(getattr(customer, 'insights_api_key', None)),  # Don't expose actual key
                'has_insights_key': bool(getattr(customer, 'insights_api_key', None)),
                'has_insights_tenant': bool(getattr(customer, 'insights_tenant', None)),
            }
            customer_data.append(customer_info)
        
        return JsonResponse(customer_data, safe=False)
    except Exception as e:
        print(f"❌ Error in customer_list: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def projects_for_customer(request, customer_id):
    """Fetch projects for a selected customer"""
    print(f"🔥 Projects for Customer - Customer ID: {customer_id}")
    
    try:
        customer = Customer.objects.get(id=customer_id)
        projects = customer.projects.all()  # Correct way to access ManyToManyField
        project_data = [{"id": project.id, "name": project.name} for project in projects]
        return JsonResponse(project_data, safe=False)
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found"}, status=404)
    except Exception as e:
        print(f"❌ Error in projects_for_customer: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def config_for_customer(request, customer_id):
    """Return the active config for the specified customer ID"""
    print(f"🔥 Config for Customer - Customer ID: {customer_id}")
    
    try:
        config = Config.objects.get(customer_id=customer_id)
        serializer = ConfigSerializer(config)
        return JsonResponse(serializer.data)
    except Config.DoesNotExist:
        return JsonResponse({"error": "Config not found for customer"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
def update_config_view(request, customer_id):
    """Update config for a specific customer"""
    print(f"🔥 Update Config - Customer ID: {customer_id}")
    
    try:
        config = Config.objects.get(customer=customer_id)
    except Config.DoesNotExist:
        return JsonResponse({"error": "Config not found"}, status=404)
    
    try:
        data = json.loads(request.body)
        data['is_active'] = True
        
        serializer = ConfigSerializer(config, data=data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return JsonResponse(ConfigSerializer(updated).data)
        return JsonResponse(serializer.errors, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def create_project_for_customer(request):
    """
    Create a new project and assign it to a customer's projects (ManyToMany).
    """
    print(f"🔥 Create Project for Customer - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        name = data.get('name')
        customer_id = data.get('customer')

        if not name or not customer_id:
            return JsonResponse({"error": "Both 'name' and 'customer' fields are required."}, status=400)

        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return JsonResponse({"error": "Customer not found."}, status=404)

        # Create the project without referencing customer
        project = Project.objects.create(name=name)

        # Add it to the customer's ManyToMany field
        customer.projects.add(project)

        serializer = ProjectSerializer(project)
        return JsonResponse(serializer.data, status=201)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ====================
# NEW DASHBOARD FUNCTIONS
# ====================

@csrf_exempt
@require_http_methods(["GET"])
def dashboard_overview(request):
    """
    Get overall dashboard statistics
    GET /api/core/dashboard/overview/
    """
    print(f"🔥 Dashboard Overview - Method: {request.method}")
    
    try:
        # Calculate overall statistics
        total_customers = Customer.objects.count()
        total_projects = Project.objects.count()
        
        # Initialize variables for models that might not exist
        total_fabrics = 0
        total_zones = 0
        total_aliases = 0
        total_storage = 0
        brocade_fabrics = 0
        cisco_fabrics = 0
        ds8000_count = 0
        flashsystem_count = 0
        other_storage_count = 0
        
        # Try to import and count SAN models
        try:
            from san.models import Fabric
            total_fabrics = Fabric.objects.count()
            brocade_fabrics = Fabric.objects.filter(san_vendor='BR').count()
            cisco_fabrics = Fabric.objects.filter(san_vendor='CI').count()
        except (ImportError, AttributeError) as e:
            print(f"⚠️  SAN Fabric model not available: {e}")
        
        try:
            from san.models import Zone
            total_zones = Zone.objects.count()
        except (ImportError, AttributeError) as e:
            print(f"⚠️  SAN Zone model not available: {e}")
        
        try:
            from san.models import Alias
            total_aliases = Alias.objects.count()
        except (ImportError, AttributeError) as e:
            print(f"⚠️  SAN Alias model not available: {e}")
        
        # Try to import and count Storage models
        try:
            from storage.models import StorageSystem
            total_storage = StorageSystem.objects.count()
            ds8000_count = StorageSystem.objects.filter(storage_type='DS8000').count()
            flashsystem_count = StorageSystem.objects.filter(storage_type='FlashSystem').count()
            other_storage_count = StorageSystem.objects.exclude(
                storage_type__in=['DS8000', 'FlashSystem']
            ).count()
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Storage model not available: {e}")
        
        # Count customers with Storage Insights configured
        connected_insights = 0
        try:
            connected_insights = Customer.objects.filter(
                insights_api_key__isnull=False
            ).exclude(insights_api_key='').count()
        except AttributeError:
            print("⚠️  insights_api_key field not available on Customer model")
        
        overview = {
            'total_customers': total_customers,
            'total_projects': total_projects,
            'total_fabrics': total_fabrics,
            'total_zones': total_zones,
            'total_aliases': total_aliases,
            'total_storage': total_storage,
            'connected_insights': connected_insights,
            'fabric_distribution': {
                'brocade': brocade_fabrics,
                'cisco': cisco_fabrics
            },
            'storage_distribution': {
                'ds8000': ds8000_count,
                'flashsystem': flashsystem_count,
                'other': other_storage_count
            }
        }
        
        print(f"📊 Dashboard overview calculated: {overview}")
        return JsonResponse(overview)
        
    except Exception as e:
        print(f"❌ Error in dashboard_overview: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def customer_statistics(request, customer_id):
    """
    Get statistics for a specific customer
    GET /api/core/customers/{customer_id}/statistics/
    """
    print(f"🔥 Customer Statistics - Customer ID: {customer_id}")
    
    try:
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Get projects for this customer
        projects = customer.projects.all()
        
        # Initialize variables
        fabrics = None
        storage_systems = None
        
        # Try to get fabrics for this customer
        try:
            from san.models import Fabric
            fabrics = Fabric.objects.filter(customer=customer)
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Fabric model not available: {e}")
            fabrics = []
        
        # Try to get storage systems for this customer
        try:
            from storage.models import StorageSystem
            storage_systems = StorageSystem.objects.filter(customer=customer)
        except (ImportError, AttributeError) as e:
            print(f"⚠️  StorageSystem model not available: {e}")
            storage_systems = []
        
        # Calculate basic statistics
        stats = {
            'customer_id': customer_id,
            'customer_name': customer.name,
            'project_count': projects.count(),
            'fabric_count': len(fabrics) if fabrics else 0,
            'storage_count': len(storage_systems) if storage_systems else 0,
            'has_insights_key': bool(getattr(customer, 'insights_api_key', None)),
            'has_insights_tenant': bool(getattr(customer, 'insights_tenant', None)),
        }
        
        # Calculate fabric distribution
        if fabrics:
            try:
                stats['brocade_fabrics'] = fabrics.filter(san_vendor='BR').count()
                stats['cisco_fabrics'] = fabrics.filter(san_vendor='CI').count()
            except AttributeError:
                stats['brocade_fabrics'] = 0
                stats['cisco_fabrics'] = 0
        else:
            stats['brocade_fabrics'] = 0
            stats['cisco_fabrics'] = 0
        
        # Calculate storage distribution
        if storage_systems:
            try:
                stats['ds8000_count'] = storage_systems.filter(storage_type='DS8000').count()
                stats['flashsystem_count'] = storage_systems.filter(storage_type='FlashSystem').count()
                stats['other_storage_count'] = storage_systems.exclude(
                    storage_type__in=['DS8000', 'FlashSystem']
                ).count()
            except AttributeError:
                stats['ds8000_count'] = 0
                stats['flashsystem_count'] = 0
                stats['other_storage_count'] = 0
        else:
            stats['ds8000_count'] = 0
            stats['flashsystem_count'] = 0
            stats['other_storage_count'] = 0
        
        # Get zone and alias counts across all projects
        total_zones = 0
        total_aliases = 0
        
        for project in projects:
            try:
                from san.models import Zone, Alias
                zones = Zone.objects.filter(project=project)
                aliases = Alias.objects.filter(project=project)
                total_zones += zones.count()
                total_aliases += aliases.count()
            except (ImportError, AttributeError):
                pass  # Models don't exist, skip
        
        stats['zone_count'] = total_zones
        stats['alias_count'] = total_aliases
        
        print(f"📊 Customer {customer.name} statistics: {stats}")
        return JsonResponse(stats)
        
    except Exception as e:
        print(f"❌ Error in customer_statistics: {e}")
        return JsonResponse({'error': str(e)}, status=500)