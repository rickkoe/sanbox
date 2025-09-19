import json
import os
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from .models import Config, Project, TableConfiguration, AppSettings, CustomNamingRule, CustomVariable
from customers.models import Customer 
from .serializers import ConfigSerializer, ProjectSerializer, ActiveConfigSerializer, TableConfigurationSerializer, AppSettingsSerializer, CustomNamingRuleSerializer, CustomVariableSerializer
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
        # Return all projects with customer information and counts
        try:
            from san.models import Fabric, Alias, Zone
            from storage.models import Storage, Host
            
            all_projects = []
            
            # Get all customers and their projects
            customers = Customer.objects.prefetch_related('projects').all()
            
            for customer in customers:
                for project in customer.projects.all():
                    # Calculate counts for each project
                    fabric_count = Fabric.objects.filter(customer__projects=project).count()
                    alias_count = project.alias_projects.count()  # Direct ManyToMany
                    zone_count = project.zone_projects.count()    # Direct ManyToMany  
                    storage_system_count = Storage.objects.filter(customer__projects=project).count()
                    host_count = Host.objects.filter(project=project).count()  # Direct ForeignKey
                    
                    all_projects.append({
                        'id': project.id,
                        'name': project.name,
                        'notes': project.notes or '',
                        'customer': customer.name,
                        'fabric_count': fabric_count,
                        'alias_count': alias_count,
                        'zone_count': zone_count,
                        'storage_system_count': storage_system_count,
                        'host_count': host_count
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
            from storage.models import Storage
            total_storage = Storage.objects.count()
            ds8000_count = Storage.objects.filter(storage_type='DS8000').count()
            flashsystem_count = Storage.objects.filter(storage_type='FlashSystem').count()
            other_storage_count = Storage.objects.exclude(
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
def dashboard_stats(request):
    """
    Enhanced dashboard statistics for current customer/project with caching support
    GET /api/core/dashboard/stats/?customer_id=<id>&project_id=<id>
    """
    print(f"🔥 Dashboard Stats - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer_id')
        project_id = request.GET.get('project_id')
        
        if not customer_id:
            return JsonResponse({'error': 'customer_id parameter required'}, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        project = None
        if project_id:
            project = get_object_or_404(Project, id=project_id)
        
        # Basic counts
        stats = {
            'total_fabrics': 0,
            'total_zones': 0,
            'total_aliases': 0,
            'total_storage': 0,
            'total_hosts': 0,
            'total_volumes': 0
        }
        
        # Try to get SAN data
        try:
            from san.models import Fabric, Zone, Alias
            stats['total_fabrics'] = Fabric.objects.filter(customer=customer).count()
            
            if project:
                stats['total_zones'] = Zone.objects.filter(
                    fabric__customer=customer,
                    projects=project
                ).count()
                stats['total_aliases'] = Alias.objects.filter(
                    fabric__customer=customer,
                    projects=project
                ).count()
            else:
                stats['total_zones'] = Zone.objects.filter(fabric__customer=customer).count()
                stats['total_aliases'] = Alias.objects.filter(fabric__customer=customer).count()
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  SAN models not available: {e}")
        
        # Try to get Storage data
        try:
            from storage.models import Storage, Host, Volume
            stats['total_storage'] = Storage.objects.filter(customer=customer).count()
            
            if project:
                stats['total_hosts'] = Host.objects.filter(project=project).count()
                # Get volumes from storage systems of this customer
                storage_systems = Storage.objects.filter(customer=customer)
                stats['total_volumes'] = Volume.objects.filter(storage__in=storage_systems).count()
            else:
                # Get all hosts for all projects of this customer
                projects = customer.projects.all()
                stats['total_hosts'] = Host.objects.filter(project__in=projects).count()
                storage_systems = Storage.objects.filter(customer=customer)
                stats['total_volumes'] = Volume.objects.filter(storage__in=storage_systems).count()
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Storage models not available: {e}")
        
        # Get customer info with insights status
        customer_data = {
            'id': customer.id,
            'name': customer.name,
            'insights_tenant': getattr(customer, 'insights_tenant', None),
            'has_insights': bool(getattr(customer, 'insights_api_key', None)) and bool(getattr(customer, 'insights_tenant', None))
        }
        
        # Get last import info
        last_import = None
        try:
            from importer.models import StorageImport
            last_import_obj = StorageImport.objects.filter(
                customer=customer
            ).order_by('-started_at').first()
            
            if last_import_obj:
                last_import = {
                    'id': last_import_obj.id,
                    'status': last_import_obj.status,
                    'started_at': last_import_obj.started_at.isoformat() if last_import_obj.started_at else None,
                    'completed_at': last_import_obj.completed_at.isoformat() if last_import_obj.completed_at else None,
                    'storage_systems_imported': getattr(last_import_obj, 'storage_systems_imported', 0),
                    'volumes_imported': getattr(last_import_obj, 'volumes_imported', 0),
                    'error_message': getattr(last_import_obj, 'error_message', None)
                }
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Import models not available: {e}")
        
        response_data = {
            'stats': stats,
            'customer': customer_data,
            'last_import': last_import,
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"📊 Dashboard stats calculated: {response_data}")
        return JsonResponse(response_data)
        
    except Exception as e:
        print(f"❌ Error in dashboard_stats: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def capacity_analytics(request):
    """
    Get storage capacity analytics and trends
    GET /api/core/dashboard/capacity/?customer_id=<id>
    """
    print(f"🔥 Capacity Analytics - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer_id')
        if not customer_id:
            return JsonResponse({'error': 'customer_id parameter required'}, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        
        # Initialize analytics data
        analytics = {
            'total_capacity_tb': 0,
            'used_capacity_tb': 0,
            'available_capacity_tb': 0,
            'utilization_percent': 0,
            'storage_systems': [],
            'capacity_by_type': {},
            'top_consumers': [],
            'alerts': []
        }
        
        try:
            from storage.models import Storage, Volume
            storage_systems = Storage.objects.filter(customer=customer)
            
            total_capacity_bytes = 0
            total_used_bytes = 0
            
            for storage in storage_systems:
                capacity_bytes = storage.capacity_bytes or 0
                used_bytes = storage.used_capacity_bytes or 0
                
                total_capacity_bytes += capacity_bytes
                total_used_bytes += used_bytes
                
                # Convert to TB
                capacity_tb = capacity_bytes / (1024 ** 4) if capacity_bytes else 0
                used_tb = used_bytes / (1024 ** 4) if used_bytes else 0
                available_tb = capacity_tb - used_tb
                
                utilization = (used_tb / capacity_tb * 100) if capacity_tb > 0 else 0
                
                storage_info = {
                    'id': storage.id,
                    'name': storage.name,
                    'storage_type': storage.storage_type,
                    'capacity_tb': round(capacity_tb, 2),
                    'used_tb': round(used_tb, 2),
                    'available_tb': round(available_tb, 2),
                    'utilization_percent': round(utilization, 1),
                    'status': 'healthy' if utilization < 80 else 'warning' if utilization < 90 else 'critical'
                }
                
                analytics['storage_systems'].append(storage_info)
                
                # Track capacity by storage type
                storage_type = storage.storage_type or 'Unknown'
                if storage_type not in analytics['capacity_by_type']:
                    analytics['capacity_by_type'][storage_type] = {
                        'capacity_tb': 0,
                        'used_tb': 0,
                        'count': 0
                    }
                
                analytics['capacity_by_type'][storage_type]['capacity_tb'] += capacity_tb
                analytics['capacity_by_type'][storage_type]['used_tb'] += used_tb
                analytics['capacity_by_type'][storage_type]['count'] += 1
                
                # Generate alerts for high utilization
                if utilization > 90:
                    analytics['alerts'].append({
                        'type': 'critical',
                        'message': f'{storage.name} is {utilization:.1f}% full',
                        'storage_id': storage.id
                    })
                elif utilization > 80:
                    analytics['alerts'].append({
                        'type': 'warning',
                        'message': f'{storage.name} is {utilization:.1f}% full',
                        'storage_id': storage.id
                    })
            
            # Calculate totals
            analytics['total_capacity_tb'] = round(total_capacity_bytes / (1024 ** 4), 2)
            analytics['used_capacity_tb'] = round(total_used_bytes / (1024 ** 4), 2)
            analytics['available_capacity_tb'] = round(analytics['total_capacity_tb'] - analytics['used_capacity_tb'], 2)
            
            if analytics['total_capacity_tb'] > 0:
                analytics['utilization_percent'] = round(
                    (analytics['used_capacity_tb'] / analytics['total_capacity_tb']) * 100, 1
                )
            
            # Find top volume consumers
            volumes = Volume.objects.filter(
                storage__customer=customer
            ).exclude(
                capacity_bytes__isnull=True
            ).order_by('-capacity_bytes')[:10]
            
            for volume in volumes:
                capacity_tb = (volume.capacity_bytes or 0) / (1024 ** 4)
                analytics['top_consumers'].append({
                    'id': volume.id,
                    'name': volume.name,
                    'storage_name': volume.storage.name,
                    'capacity_tb': round(capacity_tb, 2)
                })
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Storage models not available: {e}")
        
        print(f"📊 Capacity analytics calculated: {analytics}")
        return JsonResponse(analytics)
        
    except Exception as e:
        print(f"❌ Error in capacity_analytics: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def system_health(request):
    """
    Get system health status and recent activity
    GET /api/core/dashboard/health/?customer_id=<id>
    """
    print(f"🔥 System Health - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer_id')
        if not customer_id:
            return JsonResponse({'error': 'customer_id parameter required'}, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        
        health = {
            'overall_status': 'healthy',
            'issues': [],
            'recent_imports': [],
            'fabric_status': [],
            'storage_status': [],
            'connection_tests': {}
        }
        
        # Check Storage Insights connection
        has_insights = bool(getattr(customer, 'insights_api_key', None)) and bool(getattr(customer, 'insights_tenant', None))
        health['connection_tests']['storage_insights'] = {
            'status': 'configured' if has_insights else 'not_configured',
            'message': 'Storage Insights configured' if has_insights else 'Storage Insights not configured'
        }
        
        # Check recent imports
        try:
            from importer.models import StorageImport
            recent_imports = StorageImport.objects.filter(
                customer=customer
            ).order_by('-started_at')[:5]
            
            failed_imports = 0
            for import_obj in recent_imports:
                import_info = {
                    'id': import_obj.id,
                    'status': import_obj.status,
                    'started_at': import_obj.started_at.isoformat() if import_obj.started_at else None,
                    'completed_at': import_obj.completed_at.isoformat() if import_obj.completed_at else None,
                    'storage_systems_imported': getattr(import_obj, 'storage_systems_imported', 0),
                    'volumes_imported': getattr(import_obj, 'volumes_imported', 0)
                }
                
                if import_obj.status == 'failed':
                    failed_imports += 1
                    health['issues'].append({
                        'type': 'import_failed',
                        'message': f'Import failed on {import_obj.started_at.strftime("%Y-%m-%d %H:%M")}',
                        'severity': 'warning'
                    })
                
                health['recent_imports'].append(import_info)
            
            if failed_imports > 2:
                health['overall_status'] = 'warning'
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Import models not available: {e}")
        
        # Check fabric health
        try:
            from san.models import Fabric
            fabrics = Fabric.objects.filter(customer=customer)
            
            for fabric in fabrics:
                fabric_info = {
                    'id': fabric.id,
                    'name': fabric.name,
                    'san_vendor': fabric.san_vendor,
                    'status': 'active' if fabric.exists else 'inactive'
                }
                health['fabric_status'].append(fabric_info)
                
                if not fabric.exists:
                    health['issues'].append({
                        'type': 'fabric_inactive',
                        'message': f'Fabric {fabric.name} is marked as inactive',
                        'severity': 'info'
                    })
                    
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Fabric models not available: {e}")
        
        # Check storage system health
        try:
            from storage.models import Storage
            storage_systems = Storage.objects.filter(customer=customer)
            
            critical_systems = 0
            for storage in storage_systems:
                used_percent = storage.used_capacity_percent or 0
                status = 'healthy'
                
                if used_percent > 90:
                    status = 'critical'
                    critical_systems += 1
                elif used_percent > 80:
                    status = 'warning'
                
                storage_info = {
                    'id': storage.id,
                    'name': storage.name,
                    'storage_type': storage.storage_type,
                    'status': status,
                    'used_percent': used_percent,
                    'condition': getattr(storage, 'condition', 'unknown')
                }
                health['storage_status'].append(storage_info)
            
            if critical_systems > 0:
                health['overall_status'] = 'critical'
                health['issues'].append({
                    'type': 'high_capacity',
                    'message': f'{critical_systems} storage system(s) over 90% capacity',
                    'severity': 'critical'
                })
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Storage models not available: {e}")
        
        print(f"📊 System health calculated: {health}")
        return JsonResponse(health)
        
    except Exception as e:
        print(f"❌ Error in system_health: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def clear_dashboard_cache(request):
    """
    Clear dashboard cache for a customer/project
    POST /api/core/dashboard/cache/clear/
    """
    print(f"🔥 Clear Dashboard Cache - Method: {request.method}")
    
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        project_id = data.get('project_id')
        
        # For now, just return success since we're not implementing actual caching
        # In a real implementation, you'd clear Redis cache keys here
        
        return JsonResponse({
            'status': 'success',
            'message': 'Dashboard cache cleared',
            'customer_id': customer_id,
            'project_id': project_id
        })
        
    except Exception as e:
        print(f"❌ Error in clear_dashboard_cache: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def activity_feed(request):
    """
    Get recent activity feed for dashboard
    GET /api/core/dashboard/activity/?customer_id=<id>&limit=<num>
    """
    print(f"🔥 Activity Feed - Method: {request.method}")
    
    try:
        customer_id = request.GET.get('customer_id')
        limit = int(request.GET.get('limit', 10))
        
        if not customer_id:
            return JsonResponse({'error': 'customer_id parameter required'}, status=400)
        
        customer = get_object_or_404(Customer, id=customer_id)
        
        activities = []
        
        # Get recent imports
        try:
            from importer.models import StorageImport
            recent_imports = StorageImport.objects.filter(
                customer=customer
            ).order_by('-started_at')[:limit]
            
            for import_obj in recent_imports:
                activity = {
                    'id': f'import_{import_obj.id}',
                    'type': 'import',
                    'title': 'Storage Data Import',
                    'description': f'Imported {getattr(import_obj, "storage_systems_imported", 0)} storage systems',
                    'status': import_obj.status,
                    'timestamp': import_obj.started_at.isoformat() if import_obj.started_at else None,
                    'icon': 'download',
                    'link': '/import/ibm-storage-insights'
                }
                activities.append(activity)
                
        except (ImportError, AttributeError) as e:
            print(f"⚠️  Import models not available: {e}")
        
        # Sort activities by timestamp
        activities.sort(key=lambda x: x['timestamp'] or '', reverse=True)
        
        # Limit results
        activities = activities[:limit]
        
        print(f"📊 Activity feed calculated: {len(activities)} activities")
        return JsonResponse(activities, safe=False)
        
    except Exception as e:
        print(f"❌ Error in activity_feed: {e}")
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


# ====================
# CUSTOM NAMING API VIEWS
# ====================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def custom_naming_rules_list(request):
    """
    Get or create custom naming rules
    GET /api/core/custom-naming-rules/?customer=<id>&table_name=<name>&user=<id>
    POST /api/core/custom-naming-rules/ (create new rule)
    """
    print(f"🔥 Custom Naming Rules List - Method: {request.method}")
    
    if request.method == "GET":
        try:
            customer_id = request.GET.get('customer')
            table_name = request.GET.get('table_name')
            user_id = request.GET.get('user')
            
            if not customer_id:
                return JsonResponse({
                    'error': 'customer parameter is required'
                }, status=400)
            
            customer = get_object_or_404(Customer, id=customer_id)
            
            # Build query
            rules = CustomNamingRule.objects.filter(customer=customer)
            
            if table_name:
                rules = rules.filter(table_name=table_name)
            
            if user_id:
                from django.contrib.auth.models import User
                user = get_object_or_404(User, id=user_id)
                rules = rules.filter(user=user)
            else:
                rules = rules.filter(user__isnull=True)
            
            rules = rules.order_by('-updated_at')
            serializer = CustomNamingRuleSerializer(rules, many=True)
            return JsonResponse(serializer.data, safe=False)
                
        except Exception as e:
            print(f"❌ Error in custom_naming_rules_list GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            
            # Validate required fields
            if not data.get('customer') or not data.get('table_name') or not data.get('name'):
                return JsonResponse({
                    'error': 'customer, table_name, and name are required'
                }, status=400)
            
            serializer = CustomNamingRuleSerializer(data=data)
            
            if serializer.is_valid():
                rule = serializer.save()
                return JsonResponse(CustomNamingRuleSerializer(rule).data, status=201)
            else:
                return JsonResponse(serializer.errors, status=400)
            
        except Exception as e:
            print(f"❌ Error in custom_naming_rules_list POST: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def custom_naming_rule_detail(request, pk):
    """
    Get, update, or delete a specific custom naming rule
    GET /api/core/custom-naming-rules/<id>/
    PUT /api/core/custom-naming-rules/<id>/
    DELETE /api/core/custom-naming-rules/<id>/
    """
    print(f"🔥 Custom Naming Rule Detail - Method: {request.method}, PK: {pk}")
    
    try:
        rule = get_object_or_404(CustomNamingRule, pk=pk)
    except CustomNamingRule.DoesNotExist:
        return JsonResponse({'error': 'Custom naming rule not found'}, status=404)
    
    if request.method == "GET":
        try:
            serializer = CustomNamingRuleSerializer(rule)
            return JsonResponse(serializer.data)
        except Exception as e:
            print(f"❌ Error in custom_naming_rule_detail GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
            serializer = CustomNamingRuleSerializer(rule, data=data, partial=True)
            
            if serializer.is_valid():
                updated_rule = serializer.save()
                return JsonResponse(CustomNamingRuleSerializer(updated_rule).data)
            else:
                return JsonResponse(serializer.errors, status=400)
                
        except Exception as e:
            print(f"❌ Error in custom_naming_rule_detail PUT: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "DELETE":
        try:
            rule.delete()
            return JsonResponse({'message': 'Custom naming rule deleted successfully'}, status=204)
        except Exception as e:
            print(f"❌ Error in custom_naming_rule_detail DELETE: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def custom_variables_list(request):
    """
    Get or create custom variables
    GET /api/core/custom-variables/?customer=<id>&user=<id>
    POST /api/core/custom-variables/ (create new variable)
    """
    print(f"🔥 Custom Variables List - Method: {request.method}")
    
    if request.method == "GET":
        try:
            customer_id = request.GET.get('customer')
            user_id = request.GET.get('user')
            
            if not customer_id:
                return JsonResponse({
                    'error': 'customer parameter is required'
                }, status=400)
            
            customer = get_object_or_404(Customer, id=customer_id)
            
            # Build query
            variables = CustomVariable.objects.filter(customer=customer)
            
            if user_id:
                from django.contrib.auth.models import User
                user = get_object_or_404(User, id=user_id)
                variables = variables.filter(user=user)
            else:
                variables = variables.filter(user__isnull=True)
            
            variables = variables.order_by('name')
            serializer = CustomVariableSerializer(variables, many=True)
            return JsonResponse(serializer.data, safe=False)
                
        except Exception as e:
            print(f"❌ Error in custom_variables_list GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            
            # Validate required fields
            if not data.get('customer') or not data.get('name') or not data.get('value'):
                return JsonResponse({
                    'error': 'customer, name, and value are required'
                }, status=400)
            
            serializer = CustomVariableSerializer(data=data)
            
            if serializer.is_valid():
                variable = serializer.save()
                return JsonResponse(CustomVariableSerializer(variable).data, status=201)
            else:
                return JsonResponse(serializer.errors, status=400)
            
        except Exception as e:
            print(f"❌ Error in custom_variables_list POST: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def custom_variable_detail(request, pk):
    """
    Get, update, or delete a specific custom variable
    GET /api/core/custom-variables/<id>/
    PUT /api/core/custom-variables/<id>/
    DELETE /api/core/custom-variables/<id>/
    """
    print(f"🔥 Custom Variable Detail - Method: {request.method}, PK: {pk}")
    
    try:
        variable = get_object_or_404(CustomVariable, pk=pk)
    except CustomVariable.DoesNotExist:
        return JsonResponse({'error': 'Custom variable not found'}, status=404)
    
    if request.method == "GET":
        try:
            serializer = CustomVariableSerializer(variable)
            return JsonResponse(serializer.data)
        except Exception as e:
            print(f"❌ Error in custom_variable_detail GET: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
            serializer = CustomVariableSerializer(variable, data=data, partial=True)
            
            if serializer.is_valid():
                updated_variable = serializer.save()
                return JsonResponse(CustomVariableSerializer(updated_variable).data)
            else:
                return JsonResponse(serializer.errors, status=400)
                
        except Exception as e:
            print(f"❌ Error in custom_variable_detail PUT: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == "DELETE":
        try:
            variable.delete()
            return JsonResponse({'message': 'Custom variable deleted successfully'}, status=204)
        except Exception as e:
            print(f"❌ Error in custom_variable_detail DELETE: {e}")
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def table_columns_list(request):
    """
    Get available columns for a specific table
    GET /api/core/table-columns/?table_name=<name>
    """
    print(f"🔥 Table Columns List - Method: {request.method}")
    
    try:
        table_name = request.GET.get('table_name')
        
        if not table_name:
            return JsonResponse({
                'error': 'table_name parameter is required'
            }, status=400)
        
        # Map table names to their models and get field information
        table_models = {
            'zones': 'san.models.Zone',
            'aliases': 'san.models.Alias', 
            'fabrics': 'san.models.Fabric',
            'storage': 'storage.models.Storage',
            'hosts': 'storage.models.Host',
            'volumes': 'storage.models.Volume',
            'customers': 'customers.models.Customer',
            'projects': 'core.models.Project'
        }
        
        if table_name not in table_models:
            return JsonResponse({
                'error': f'Unknown table: {table_name}. Available tables: {", ".join(table_models.keys())}'
            }, status=400)
        
        # Dynamically import and inspect the model
        model_path = table_models[table_name]
        module_name, model_name = model_path.rsplit('.', 1)
        
        try:
            module = __import__(module_name, fromlist=[model_name])
            model = getattr(module, model_name)
        except (ImportError, AttributeError) as e:
            return JsonResponse({
                'error': f'Could not load model {model_path}: {str(e)}'
            }, status=500)
        
        # Get field information
        columns = []
        for field in model._meta.get_fields():
            if hasattr(field, 'name') and not field.many_to_many:  # Skip many-to-many fields
                field_info = {
                    'name': field.name,
                    'verbose_name': getattr(field, 'verbose_name', field.name),
                    'type': field.__class__.__name__,
                    'required': not getattr(field, 'null', True) and not getattr(field, 'blank', True)
                }
                columns.append(field_info)
        
        # Add virtual columns for specific tables
        if table_name == 'zones':
            # Add Member1, Member2, etc. columns that exist in the frontend ZoneTable
            for i in range(1, 11):  # Add Member1 through Member10
                columns.append({
                    'name': f'Member{i}',
                    'verbose_name': f'Member {i}',
                    'type': 'VirtualColumn',
                    'required': False
                })
        
        return JsonResponse({
            'table_name': table_name,
            'columns': columns
        })
        
    except Exception as e:
        print(f"❌ Error in table_columns_list: {e}")
        return JsonResponse({'error': str(e)}, status=500)