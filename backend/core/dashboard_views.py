from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count
from django.core.cache import cache
from customers.models import Customer
from core.models import Project
from san.models import Fabric, Zone, Alias
from storage.models import Storage
from importer.models import StorageImport
import json


@csrf_exempt
@require_http_methods(["GET"])
def dashboard_stats(request):
    """Optimized dashboard statistics endpoint"""
    customer_id = request.GET.get('customer_id')
    project_id = request.GET.get('project_id')
    
    if not customer_id or not project_id:
        return JsonResponse({"error": "customer_id and project_id are required"}, status=400)
    
    # Create cache key
    cache_key = f"dashboard_stats_{customer_id}_{project_id}"
    
    # Try to get from cache first (5 minute cache)
    cached_stats = cache.get(cache_key)
    if cached_stats:
        return JsonResponse(cached_stats)
    
    try:
        # Verify customer and project exist
        customer = Customer.objects.get(id=customer_id)
        project = Project.objects.get(id=project_id)
        
        # Get counts efficiently with single queries
        fabric_count = Fabric.objects.filter(customer_id=customer_id).count()
        zone_count = Zone.objects.filter(projects=project).count()
        alias_count = Alias.objects.filter(projects=project).count()
        storage_count = Storage.objects.filter(customer_id=customer_id).count()
        
        # Get last import info
        last_import = None
        try:
            latest_import = StorageImport.objects.filter(
                customer_id=customer_id
            ).order_by('-started_at').first()
            
            if latest_import:
                last_import = {
                    'id': latest_import.id,
                    'status': latest_import.status,
                    'started_at': latest_import.started_at.isoformat() if latest_import.started_at else None,
                    'storage_systems_imported': latest_import.storage_systems_imported or 0,
                    'volumes_imported': latest_import.volumes_imported or 0,
                }
        except Exception:
            pass
        
        # Build response
        stats = {
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'has_insights': bool(customer.insights_tenant and customer.insights_api_key),
                'insights_tenant': customer.insights_tenant,
            },
            'project': {
                'id': project.id,
                'name': project.name,
            },
            'stats': {
                'total_fabrics': fabric_count,
                'total_zones': zone_count,
                'total_aliases': alias_count,
                'total_storage': storage_count,
            },
            'last_import': last_import,
        }
        
        # Cache for 5 minutes
        cache.set(cache_key, stats, 300)
        
        return JsonResponse(stats)
        
    except Customer.DoesNotExist:
        return JsonResponse({"error": "Customer not found"}, status=404)
    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def clear_dashboard_cache(request):
    """Clear dashboard cache for a specific customer/project"""
    try:
        data = json.loads(request.body)
        customer_id = data.get('customer_id')
        project_id = data.get('project_id')
        
        if customer_id and project_id:
            cache_key = f"dashboard_stats_{customer_id}_{project_id}"
            cache.delete(cache_key)
            return JsonResponse({"message": "Cache cleared successfully"})
        else:
            return JsonResponse({"error": "customer_id and project_id required"}, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)