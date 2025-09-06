import json
import os
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from .models import Config, Project, TableConfiguration, AppSettings
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer, ActiveConfigSerializer, TableConfigurationSerializer, AppSettingsSerializer
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
@require_http_methods(["GET", "POST", "PUT"])
def create_project_for_customer(request):
    """
    Handle projects endpoint - GET for listing all projects, POST for creating new project.
    """
    print(f"🔥 Projects API - Method: {request.method}")
    
    if request.method == "GET":
        # Return all projects with customer information
        try:
            all_projects = []
            
            # Get all customers and their projects
            customers = Customer.objects.prefetch_related('projects').all()
            
            for customer in customers:
                for project in customer.projects.all():
                    all_projects.append({
                        'id': project.id,
                        'name': project.name,
                        'notes': project.notes or '',
                        'customer': customer.name
                    })
            
            return JsonResponse(all_projects, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    
    elif request.method == "POST":
        # Create new project (existing logic)
        try:
            print(f"📝 Parsing request body...")
            data = json.loads(request.body)
            print(f"📝 Request data: {data}")
            
            name = data.get('name')
            customer_id = data.get('customer')
            print(f"📝 Project name: {name}, Customer ID: {customer_id}")

            if not name or not customer_id:
                print(f"❌ Missing required fields: name={name}, customer_id={customer_id}")
                return JsonResponse({"error": "Both 'name' and 'customer' fields are required."}, status=400)

            print(f"📝 Looking up customer with ID: {customer_id}")
            try:
                customer = Customer.objects.get(id=customer_id)
                print(f"📝 Found customer: {customer.name}")
            except Customer.DoesNotExist:
                print(f"❌ Customer not found: {customer_id}")
                return JsonResponse({"error": "Customer not found."}, status=404)

            print(f"📝 Creating project with name: {name}")
            # Create the project without referencing customer
            project = Project.objects.create(name=name, notes=data.get('notes', ''))
            print(f"📝 Project created with ID: {project.id}")

            print(f"📝 Adding project to customer's ManyToMany field...")
            # Add it to the customer's ManyToMany field
            customer.projects.add(project)
            print(f"📝 Project added to customer successfully")

            print(f"📝 Serializing project...")
            serializer = ProjectSerializer(project)
            print(f"📝 Serialized data: {serializer.data}")
            
            return JsonResponse(serializer.data, status=201)
        
        except Exception as e:
            print(f"❌ Exception in project creation: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"❌ Full traceback: {traceback.format_exc()}")
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt  
@require_http_methods(["PUT"])
def update_project(request, project_id):
    """
    Update a project by ID.
    PUT /api/core/projects/<id>/
    """
    print(f"🔥 Update Project - Method: {request.method}, Project ID: {project_id}")
    
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        print(f"📝 Parsing request body...")
        data = json.loads(request.body)
        print(f"📝 Update data: {data}")
        
        # Update project fields
        if 'name' in data:
            project.name = data['name'].strip()
            print(f"📝 Updated name to: {project.name}")
            
        if 'notes' in data:
            project.notes = data['notes'] or ''
            print(f"📝 Updated notes to: {project.notes}")
        
        project.save()
        print(f"📝 Project saved successfully")
        
        # Handle customer relationship update if provided
        if 'customer' in data:
            customer_id = data['customer']
            print(f"📝 Updating customer relationship to: {customer_id}")
            
            try:
                new_customer = Customer.objects.get(id=customer_id)
                
                # Remove project from all current customers
                current_customers = project.customers.all()
                for customer in current_customers:
                    customer.projects.remove(project)
                    print(f"📝 Removed project from customer: {customer.name}")
                
                # Add project to new customer
                new_customer.projects.add(project)
                print(f"📝 Added project to customer: {new_customer.name}")
                
            except Customer.DoesNotExist:
                return JsonResponse({"error": "Customer not found."}, status=404)

        serializer = ProjectSerializer(project)
        print(f"📝 Serialized updated project: {serializer.data}")
        
        return JsonResponse(serializer.data, status=200)
    
    except Exception as e:
        print(f"❌ Exception in project update: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_project(request, project_id):
    """
    Delete a project by ID.
    DELETE /api/core/projects/<id>/
    """
    print(f"🔥 Delete Project - Method: {request.method}, Project ID: {project_id}")
    
    try:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return JsonResponse({"error": "Project not found."}, status=404)

        project_name = project.name
        
        # Check if this project is currently active in any config
        configs_to_update = []
        
        # Get all configs that reference this project
        configs = Config.objects.all()
        for config in configs:
            if config.active_project and str(project.id) in str(config.active_project):
                configs_to_update.append(config)
                print(f"🔄 Config {config.id} currently has deleted project {project.id} as active")
        
        # Delete the project
        project.delete()
        
        # Update configs that referenced the deleted project
        for config in configs_to_update:
            # Clear the active project from the config
            # This will depend on how active_project is stored
            if hasattr(config, 'active_project'):
                # If active_project is a field, clear it
                config.active_project = None
                config.save()
                print(f"✅ Cleared active project from config {config.id}")
        
        return JsonResponse({
            "message": f"Project '{project_name}' deleted successfully.",
            "configs_updated": len(configs_to_update)
        }, status=200)
    
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


# ====================
# TABLE CONFIGURATION API VIEWS
# ====================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def table_configuration_list(request):
    """
    Get or create table configurations
    GET /api/core/table-config/?customer=<id>&table_name=<name>&user=<id>
    POST /api/core/table-config/ (create new configuration)
    """
    print(f"🔥 Table Configuration List - Method: {request.method}")
    
    if request.method == "GET":
        try:
            customer_id = request.GET.get('customer')
            table_name = request.GET.get('table_name')
            user_id = request.GET.get('user')
            
            if not customer_id or not table_name:
                return JsonResponse({
                    'error': 'customer and table_name parameters are required'
                }, status=400)
            
            customer = get_object_or_404(Customer, id=customer_id)
            user = None
            if user_id:
                from django.contrib.auth.models import User
                user = get_object_or_404(User, id=user_id)
            
            # Get configuration using the model's helper method
            config = TableConfiguration.get_config(customer, table_name, user)
            
            if config:
                serializer = TableConfigurationSerializer(config)
                return JsonResponse(serializer.data)
            else:
                # Return empty configuration structure
                return JsonResponse({
                    'customer': customer_id,
                    'user': user_id,
                    'table_name': table_name,
                    'visible_columns': [],
                    'column_widths': {},
                    'filters': {},
                    'sorting': {},
                    'page_size': 25,
                    'additional_settings': {}
                })
                
        except Exception as e:
            print(f"❌ Error in table_configuration_list GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            
            # Validate required fields
            if not data.get('customer') or not data.get('table_name'):
                return JsonResponse({
                    'error': 'customer and table_name are required'
                }, status=400)
            
            customer = get_object_or_404(Customer, id=data['customer'])
            user = None
            if data.get('user'):
                from django.contrib.auth.models import User
                user = get_object_or_404(User, id=data['user'])
            
            # Use the model's helper method to save configuration
            config_data = {
                'visible_columns': data.get('visible_columns', []),
                'column_widths': data.get('column_widths', {}),
                'filters': data.get('filters', {}),
                'sorting': data.get('sorting', {}),
                'page_size': data.get('page_size', 25),
                'additional_settings': data.get('additional_settings', {})
            }
            
            config = TableConfiguration.save_config(
                customer=customer,
                table_name=data['table_name'],
                config_data=config_data,
                user=user
            )
            
            serializer = TableConfigurationSerializer(config)
            return JsonResponse(serializer.data, status=201)
            
        except Exception as e:
            print(f"❌ Error in table_configuration_list POST: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def table_configuration_detail(request, pk):
    """
    Get, update, or delete a specific table configuration
    GET /api/core/table-config/<id>/
    PUT /api/core/table-config/<id>/
    DELETE /api/core/table-config/<id>/
    """
    print(f"🔥 Table Configuration Detail - Method: {request.method}, PK: {pk}")
    
    try:
        config = get_object_or_404(TableConfiguration, pk=pk)
    except TableConfiguration.DoesNotExist:
        return JsonResponse({'error': 'Table configuration not found'}, status=404)
    
    if request.method == "GET":
        try:
            serializer = TableConfigurationSerializer(config)
            return JsonResponse(serializer.data)
        except Exception as e:
            print(f"❌ Error in table_configuration_detail GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
            serializer = TableConfigurationSerializer(config, data=data, partial=True)
            
            if serializer.is_valid():
                updated_config = serializer.save()
                return JsonResponse(TableConfigurationSerializer(updated_config).data)
            else:
                return JsonResponse(serializer.errors, status=400)
                
        except Exception as e:
            print(f"❌ Error in table_configuration_detail PUT: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "DELETE":
        try:
            config.delete()
            return JsonResponse({'message': 'Table configuration deleted successfully'}, status=204)
        except Exception as e:
            print(f"❌ Error in table_configuration_detail DELETE: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_table_configuration(request):
    """
    Reset table configuration for a customer/table/user combination
    POST /api/core/table-config/reset/
    Body: {"customer": <id>, "table_name": <name>, "user": <id>}
    """
    print(f"🔥 Reset Table Configuration - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer')
        table_name = data.get('table_name')
        user_id = data.get('user')
        
        if not customer_id or not table_name:
            return JsonResponse({
                'error': 'customer and table_name are required'
            }, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        user = None
        if user_id:
            from django.contrib.auth.models import User
            user = get_object_or_404(User, id=user_id)
        
        # Delete existing configuration
        deleted_count = TableConfiguration.objects.filter(
            customer=customer,
            table_name=table_name,
            user=user
        ).delete()[0]
        
        return JsonResponse({
            'message': f'Reset table configuration for {table_name}',
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        print(f"❌ Error in reset_table_configuration: {e}")
        return JsonResponse({'error': str(e)}, status=500)


# ====================
# APP SETTINGS API VIEWS
# ====================

@csrf_exempt
@require_http_methods(["GET", "PUT"])
def app_settings_view(request):
    """
    Get or update application settings for the current user (or global defaults)
    GET /api/core/settings/ - Get current settings
    PUT /api/core/settings/ - Update settings
    """
    print(f"🔥 App Settings - Method: {request.method}")
    
    if request.method == "GET":
        try:
            # For now, we'll use global settings since there's no authentication
            # In a real app, you'd get the current user from request.user
            user = None  # request.user if request.user.is_authenticated else None
            
            settings = AppSettings.get_settings(user=user)
            serializer = AppSettingsSerializer(settings)
            
            return JsonResponse(serializer.data)
            
        except Exception as e:
            print(f"❌ Error in app_settings_view GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
            
            # For now, we'll use global settings since there's no authentication
            user = None  # request.user if request.user.is_authenticated else None
            
            # Get existing settings or create new ones
            settings = AppSettings.get_settings(user=user)
            
            # Update settings using serializer
            serializer = AppSettingsSerializer(settings, data=data, partial=True)
            
            if serializer.is_valid():
                updated_settings = serializer.save()
                print(f"✅ Settings updated successfully: {updated_settings}")
                return JsonResponse(AppSettingsSerializer(updated_settings).data)
            else:
                print(f"❌ Settings validation errors: {serializer.errors}")
                return JsonResponse(serializer.errors, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            print(f"❌ Error in app_settings_view PUT: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def debug_log_view(request):
    """Save debug log entries to filesystem for troubleshooting"""
    try:
        data = json.loads(request.body)
        log_entry = data.get('log_entry', '')
        session_id = data.get('session_id', 'unknown')
        
        # Create debug log directory if it doesn't exist
        log_dir = '/tmp/sanbox_debug_logs'
        os.makedirs(log_dir, exist_ok=True)
        
        # Create log file based on session
        log_file = os.path.join(log_dir, f'{session_id}.log')
        
        # Append log entry to file
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
        
        return JsonResponse({'status': 'success'})
    
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)