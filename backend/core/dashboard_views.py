from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count, Q
from django.core.cache import cache
from customers.models import Customer
from core.models import Project
from san.models import Fabric, Zone, Alias
from storage.models import Storage
from importer.models import StorageImport
import json


def clear_dashboard_cache_for_customer(customer_id):
    """Helper function to clear dashboard cache for a customer across all their projects"""
    try:
        customer = Customer.objects.get(id=customer_id)
        projects = customer.projects.all()

        for project in projects:
            cache_key = f"dashboard_stats_{customer_id}_{project.id}"
            try:
                cache.delete(cache_key)
            except Exception as cache_error:
                # Silently fail if cache is unavailable
                print(f"Warning: Could not clear cache for {cache_key}: {cache_error}")

    except Customer.DoesNotExist:
        pass


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


# ========== CUSTOMIZABLE DASHBOARD VIEWS ==========

from django.utils.decorators import method_decorator
from django.views import View
from django.db import transaction
from django.contrib.auth.decorators import login_required
from datetime import timedelta
from django.utils import timezone

from .models import (
    DashboardLayout, DashboardWidget, WidgetType, DashboardTheme,
    DashboardPreset, WidgetDataSource
)


@method_decorator([login_required, csrf_exempt], name='dispatch')
class DashboardLayoutView(View):
    """Manage user dashboard layouts"""
    
    def get(self, request):
        """Get user's dashboard layout"""
        customer_id = request.GET.get('customer_id')
        if not customer_id:
            return JsonResponse({'error': 'Customer ID required'}, status=400)
        
        try:
            customer = Customer.objects.get(id=customer_id)
            layout, created = DashboardLayout.objects.get_or_create(
                user=request.user,
                customer=customer,
                defaults={
                    'name': f"{customer.name} Dashboard",
                    'theme': 'modern'
                }
            )

            # If this is a new layout, populate with default widgets
            if created:
                self._create_default_widgets(layout)

            # Get all widgets for this layout
            widgets = DashboardWidget.objects.filter(layout=layout, is_visible=True)

            return JsonResponse({
                'layout': {
                    'id': layout.id,
                    'name': layout.name,
                    'theme': layout.theme,
                    'grid_columns': layout.grid_columns,
                    'auto_refresh': layout.auto_refresh,
                    'refresh_interval': layout.refresh_interval,
                    'created_at': layout.created_at.isoformat(),
                    'updated_at': layout.updated_at.isoformat()
                },
                'widgets': [{
                    'id': widget.id,
                    'widget_type': {
                        'name': widget.widget_type.name,
                        'display_name': widget.widget_type.display_name,
                        'component_name': widget.widget_type.component_name,
                        'category': widget.widget_type.category,
                        'icon': widget.widget_type.icon
                    },
                    'title': widget.title,
                    'position_x': widget.position_x,
                    'position_y': widget.position_y,
                    'width': widget.width,
                    'height': widget.height,
                    'config': widget.config,
                    'data_filters': widget.data_filters,
                    'refresh_interval': widget.refresh_interval,
                    'z_index': widget.z_index
                } for widget in widgets]
            })
            
        except Customer.DoesNotExist:
            return JsonResponse({'error': 'Customer not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def _create_default_widgets(self, layout):
        """Create default widgets for a new dashboard layout"""
        # Get all active widget types
        widget_types = WidgetType.objects.filter(is_active=True).order_by('category', 'name')

        # Define a nice grid layout (12 columns total)
        # Position widgets in a 3-column layout
        positions = [
            # Row 1
            {'x': 0, 'y': 0},   # Column 1
            {'x': 4, 'y': 0},   # Column 2
            {'x': 8, 'y': 0},   # Column 3
            # Row 2
            {'x': 0, 'y': 1},
            {'x': 4, 'y': 1},
            {'x': 8, 'y': 1},
            # Row 3
            {'x': 0, 'y': 2},
            {'x': 4, 'y': 2},
            {'x': 8, 'y': 2},
            # Row 4
            {'x': 0, 'y': 3},
            {'x': 4, 'y': 3},
            {'x': 8, 'y': 3},
        ]

        # Create widgets for each type
        for idx, widget_type in enumerate(widget_types):
            if idx < len(positions):
                pos = positions[idx]
                DashboardWidget.objects.create(
                    layout=layout,
                    widget_type=widget_type,
                    title=widget_type.display_name,
                    position_x=pos['x'],
                    position_y=pos['y'],
                    width=widget_type.default_width,
                    height=widget_type.default_height,
                    config={},
                    data_filters={},
                    is_visible=True
                )

    def post(self, request):
        """Create or update dashboard layout"""
        try:
            data = json.loads(request.body)
            customer_id = data.get('customer_id')
            
            if not customer_id:
                return JsonResponse({'error': 'Customer ID required'}, status=400)
            
            customer = Customer.objects.get(id=customer_id)
            
            with transaction.atomic():
                layout, created = DashboardLayout.objects.get_or_create(
                    user=request.user,
                    customer=customer
                )
                
                # Update layout properties
                layout.name = data.get('name', layout.name)
                layout.theme = data.get('theme', layout.theme)
                layout.grid_columns = data.get('grid_columns', layout.grid_columns)
                layout.auto_refresh = data.get('auto_refresh', layout.auto_refresh)
                layout.refresh_interval = data.get('refresh_interval', layout.refresh_interval)
                layout.save()

                return JsonResponse({
                    'message': 'Layout updated successfully',
                    'layout_id': layout.id
                })
                
        except Customer.DoesNotExist:
            return JsonResponse({'error': 'Customer not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@method_decorator([login_required, csrf_exempt], name='dispatch')
class DashboardWidgetView(View):
    """Manage dashboard widgets"""
    
    def post(self, request):
        """Add a new widget to dashboard"""
        try:
            data = json.loads(request.body)
            customer_id = data.get('customer_id')
            widget_type_name = data.get('widget_type')
            
            if not customer_id or not widget_type_name:
                return JsonResponse({'error': 'Customer ID and widget type required'}, status=400)
            
            customer = Customer.objects.get(id=customer_id)
            widget_type = WidgetType.objects.get(name=widget_type_name, is_active=True)
            
            layout, _ = DashboardLayout.objects.get_or_create(
                user=request.user,
                customer=customer
            )
            
            with transaction.atomic():
                widget = DashboardWidget.objects.create(
                    layout=layout,
                    widget_type=widget_type,
                    title=data.get('title', widget_type.display_name),
                    position_x=data.get('position_x', 0),
                    position_y=data.get('position_y', 0),
                    width=data.get('width', widget_type.default_width),
                    height=data.get('height', widget_type.default_height),
                    config=data.get('config', {}),
                    data_filters=data.get('data_filters', {}),
                    refresh_interval=data.get('refresh_interval')
                )

                return JsonResponse({
                    'message': 'Widget added successfully',
                    'widget_id': widget.id
                })
                
        except (Customer.DoesNotExist, WidgetType.DoesNotExist):
            return JsonResponse({'error': 'Customer or widget type not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def put(self, request, widget_id):
        """Update widget configuration"""
        try:
            data = json.loads(request.body)
            
            widget = DashboardWidget.objects.get(
                id=widget_id,
                layout__user=request.user
            )
            
            with transaction.atomic():
                # Update widget properties
                widget.title = data.get('title', widget.title)
                widget.position_x = data.get('position_x', widget.position_x)
                widget.position_y = data.get('position_y', widget.position_y)
                widget.width = data.get('width', widget.width)
                widget.height = data.get('height', widget.height)
                widget.config = data.get('config', widget.config)
                widget.data_filters = data.get('data_filters', widget.data_filters)
                widget.refresh_interval = data.get('refresh_interval', widget.refresh_interval)
                widget.z_index = data.get('z_index', widget.z_index)
                widget.save()

                return JsonResponse({'message': 'Widget updated successfully'})
                
        except DashboardWidget.DoesNotExist:
            return JsonResponse({'error': 'Widget not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def delete(self, request, widget_id):
        """Remove widget from dashboard"""
        try:
            widget = DashboardWidget.objects.get(
                id=widget_id,
                layout__user=request.user
            )
            
            layout = widget.layout
            widget_type_name = widget.widget_type.name
            
            with transaction.atomic():
                widget.delete()

                return JsonResponse({'message': 'Widget removed successfully'})
                
        except DashboardWidget.DoesNotExist:
            return JsonResponse({'error': 'Widget not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_types_view(request):
    """Get available widget types"""
    try:
        category = request.GET.get('category')
        
        widget_types = WidgetType.objects.filter(is_active=True)
        if category:
            widget_types = widget_types.filter(category=category)
        
        return JsonResponse({
            'widget_types': [{
                'name': wt.name,
                'display_name': wt.display_name,
                'description': wt.description,
                'component_name': wt.component_name,
                'category': wt.category,
                'icon': wt.icon,
                'default_width': wt.default_width,
                'default_height': wt.default_height,
                'min_width': wt.min_width,
                'min_height': wt.min_height,
                'max_width': wt.max_width,
                'max_height': wt.max_height,
                'is_resizable': wt.is_resizable,
                'requires_data_source': wt.requires_data_source,
                'config_schema': wt.config_schema
            } for wt in widget_types]
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def dashboard_themes_view(request):
    """Get available dashboard themes"""
    try:
        themes = DashboardTheme.objects.filter(is_active=True)
        
        return JsonResponse({
            'themes': [{
                'name': theme.name,
                'display_name': theme.display_name,
                'description': theme.description,
                'css_variables': theme.css_variables,
                'background_type': theme.background_type,
                'background_config': theme.background_config,
                'card_style': theme.card_style,
                'animation_level': theme.animation_level,
                'is_system': theme.is_system
            } for theme in themes]
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def dashboard_presets_view(request):
    """Get available dashboard presets"""
    try:
        category = request.GET.get('category')
        customer_id = request.GET.get('customer_id')
        
        # Build query for presets
        preset_filter = Q(is_system=True)  # System presets
        
        # Include user's custom templates and public custom templates
        if customer_id:
            try:
                customer = Customer.objects.get(id=customer_id)
                preset_filter |= Q(created_by=request.user, customer=customer)  # User's own templates
                preset_filter |= Q(is_public=True, is_system=False)  # Public custom templates
            except Customer.DoesNotExist:
                pass
        
        presets = DashboardPreset.objects.filter(preset_filter)
        
        if category:
            presets = presets.filter(category=category)
        
        preset_data = []
        for preset in presets:
            preset_info = {
                'name': preset.name,
                'display_name': preset.display_name,
                'description': preset.description,
                'category': preset.category,
                'thumbnail_url': preset.thumbnail_url,
                'layout_config': preset.layout_config,
                'target_roles': preset.target_roles,
                'is_featured': preset.is_featured,
                'usage_count': preset.usage_count,
                'is_system': preset.is_system,
                'is_custom': not preset.is_system,
                'created_by': preset.created_by.get_full_name() or preset.created_by.username if preset.created_by else None,
                'created_at': preset.created_at.isoformat() if hasattr(preset, 'created_at') else None
            }
            preset_data.append(preset_info)
        
        return JsonResponse({
            'presets': preset_data
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@method_decorator([login_required, csrf_exempt], name='dispatch')
class DashboardPresetApplyView(View):
    """Apply a dashboard preset"""
    
    def post(self, request):
        """Apply a preset to user's dashboard"""
        try:
            data = json.loads(request.body)
            customer_id = data.get('customer_id')
            preset_name = data.get('preset_name')
            
            if not customer_id or not preset_name:
                return JsonResponse({'error': 'Customer ID and preset name required'}, status=400)
            
            customer = Customer.objects.get(id=customer_id)
            # Get preset (system or custom) - check user access for custom templates
            try:
                preset = DashboardPreset.objects.get(name=preset_name, is_system=True)
            except DashboardPreset.DoesNotExist:
                # Try to find custom template accessible to user
                preset = DashboardPreset.objects.get(
                    Q(name=preset_name, created_by=request.user, customer=customer) |  # User's own template
                    Q(name=preset_name, is_public=True, is_system=False)  # Public custom template
                )
            
            with transaction.atomic():
                # Get or create layout
                layout, _ = DashboardLayout.objects.get_or_create(
                    user=request.user,
                    customer=customer
                )
                
                # Clear existing widgets
                DashboardWidget.objects.filter(layout=layout).delete()
                
                # Apply preset configuration (preserve user's theme)
                layout_config = preset.layout_config
                current_theme = layout.theme  # Preserve current theme
                
                if 'grid_columns' in layout_config:
                    layout.grid_columns = layout_config['grid_columns']
                if 'auto_refresh' in layout_config:
                    layout.auto_refresh = layout_config['auto_refresh']
                if 'refresh_interval' in layout_config:
                    layout.refresh_interval = layout_config['refresh_interval']
                
                # Keep the user's current theme instead of preset theme
                layout.theme = current_theme
                
                layout.name = data.get('name', f"{preset.display_name} Dashboard")
                layout.save()
                
                # Create widgets from preset
                widgets_created = []
                for widget_config in layout_config.get('widgets', []):
                    try:
                        widget_type = WidgetType.objects.get(
                            name=widget_config['widget_type'], 
                            is_active=True
                        )
                        
                        widget = DashboardWidget.objects.create(
                            layout=layout,
                            widget_type=widget_type,
                            title=widget_config.get('title', widget_type.display_name),
                            position_x=widget_config.get('position_x', 0),
                            position_y=widget_config.get('position_y', 0),
                            width=widget_config.get('width', widget_type.default_width),
                            height=widget_config.get('height', widget_type.default_height),
                            config=widget_config.get('config', {}),
                            data_filters=widget_config.get('data_filters', {}),
                            refresh_interval=widget_config.get('refresh_interval')
                        )
                        widgets_created.append(widget)
                        
                    except WidgetType.DoesNotExist:
                        # Skip widgets with missing types
                        continue
                
                # Update preset usage count
                preset.usage_count += 1
                preset.save()

                return JsonResponse({
                    'message': 'Preset applied successfully',
                    'layout_id': layout.id,
                    'widgets_created': len(widgets_created)
                })
                
        except (Customer.DoesNotExist, DashboardPreset.DoesNotExist):
            return JsonResponse({'error': 'Customer or preset not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@method_decorator([login_required, csrf_exempt], name='dispatch')
class DashboardTemplateSaveView(View):
    """Save current dashboard as a custom template"""
    
    def post(self, request):
        """Save user's current dashboard layout as a custom template"""
        try:
            data = json.loads(request.body)
            customer_id = data.get('customer_id')
            template_name = data.get('template_name')
            template_description = data.get('template_description', '')
            is_public = data.get('is_public', False)
            
            if not customer_id or not template_name:
                return JsonResponse({'error': 'Customer ID and template name required'}, status=400)
            
            customer = Customer.objects.get(id=customer_id)
            
            # Get user's current dashboard layout
            try:
                layout = DashboardLayout.objects.get(user=request.user, customer=customer)
            except DashboardLayout.DoesNotExist:
                return JsonResponse({'error': 'No dashboard layout found to save'}, status=404)
            
            # Get all widgets for this layout
            widgets = DashboardWidget.objects.filter(layout=layout, is_visible=True)
            
            with transaction.atomic():
                # Create layout configuration
                layout_config = {
                    'theme': layout.theme,
                    'grid_columns': layout.grid_columns,
                    'auto_refresh': layout.auto_refresh,
                    'refresh_interval': layout.refresh_interval,
                    'widgets': []
                }
                
                # Add widget configurations
                for widget in widgets:
                    widget_config = {
                        'widget_type': widget.widget_type.name,
                        'title': widget.title,
                        'position_x': widget.position_x,
                        'position_y': widget.position_y,
                        'width': widget.width,
                        'height': widget.height,
                        'config': widget.config,
                        'data_filters': widget.data_filters,
                        'refresh_interval': widget.refresh_interval
                    }
                    layout_config['widgets'].append(widget_config)
                
                # Create the custom preset
                preset = DashboardPreset.objects.create(
                    name=f"custom_{request.user.id}_{int(timezone.now().timestamp())}",
                    display_name=template_name,
                    description=template_description or f"Custom template created by {request.user.get_full_name() or request.user.username}",
                    category='custom',
                    layout_config=layout_config,
                    created_by=request.user,
                    customer=customer if not is_public else None,
                    is_system=False,
                    is_public=is_public,
                    is_featured=False,
                    usage_count=0
                )

                return JsonResponse({
                    'message': 'Template saved successfully',
                    'template_id': preset.id,
                    'template_name': preset.display_name
                })

        except Customer.DoesNotExist:
            return JsonResponse({'error': 'Customer not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ========== WIDGET DATA ENDPOINTS ==========

from san.models import Switch, AliasWWPN
from storage.models import Host, HostWwpn
from backup.models import BackupRecord
from django.db.models import Sum, Count, Q, Max


@login_required
def widget_san_overview(request):
    """SAN Configuration Overview Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')
        project_id = request.GET.get('project_id')

        if not customer_id or not project_id:
            return JsonResponse({'error': 'customer_id and project_id required'}, status=400)

        project = Project.objects.get(id=project_id)

        # Get counts
        fabric_count = Fabric.objects.filter(customer_id=customer_id).count()
        zone_count = Zone.objects.filter(projects=project).count()
        alias_count = Alias.objects.filter(projects=project).count()
        switch_count = Switch.objects.filter(customer_id=customer_id).count()

        # Get vendor breakdown
        cisco_fabrics = Fabric.objects.filter(customer_id=customer_id, san_vendor='cisco').count()
        brocade_fabrics = Fabric.objects.filter(customer_id=customer_id, san_vendor='brocade').count()

        return JsonResponse({
            'total_fabrics': fabric_count,
            'total_zones': zone_count,
            'total_aliases': alias_count,
            'total_switches': switch_count,
            'cisco_fabrics': cisco_fabrics,
            'brocade_fabrics': brocade_fabrics
        })

    except Project.DoesNotExist:
        return JsonResponse({'error': 'Project not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_zone_deployment(request):
    """Zone Deployment Status Widget Data"""
    try:
        project_id = request.GET.get('project_id')

        if not project_id:
            return JsonResponse({'error': 'project_id required'}, status=400)

        project = Project.objects.get(id=project_id)

        # Get deployment status
        total_zones = Zone.objects.filter(projects=project).count()
        deployed_zones = Zone.objects.filter(projects=project, exists=True).count()
        designed_zones = total_zones - deployed_zones

        deployment_percentage = round((deployed_zones / total_zones * 100) if total_zones > 0 else 0, 1)

        return JsonResponse({
            'total_zones': total_zones,
            'deployed': deployed_zones,
            'designed': designed_zones,
            'deployment_percentage': deployment_percentage
        })

    except Project.DoesNotExist:
        return JsonResponse({'error': 'Project not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_alias_distribution(request):
    """Alias Distribution Widget Data"""
    try:
        project_id = request.GET.get('project_id')

        if not project_id:
            return JsonResponse({'error': 'project_id required'}, status=400)

        project = Project.objects.get(id=project_id)

        # Get alias distribution by use type
        initiators = Alias.objects.filter(projects=project, use='init').count()
        targets = Alias.objects.filter(projects=project, use='target').count()
        both = Alias.objects.filter(projects=project, use='both').count()
        total = initiators + targets + both

        return JsonResponse({
            'total_aliases': total,
            'initiators': initiators,
            'targets': targets,
            'both': both
        })

    except Project.DoesNotExist:
        return JsonResponse({'error': 'Project not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_storage_inventory(request):
    """Storage Systems Inventory Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Get storage counts by type
        storage_types = Storage.objects.filter(
            customer_id=customer_id
        ).values('storage_type').annotate(count=Count('id'))

        total_storage = Storage.objects.filter(customer_id=customer_id).count()

        # Format by type
        type_breakdown = {item['storage_type'] or 'Unknown': item['count'] for item in storage_types}

        return JsonResponse({
            'total_systems': total_storage,
            'by_type': type_breakdown
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_host_connectivity(request):
    """Host Connectivity Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Get host counts
        total_hosts = Host.objects.filter(storage__customer_id=customer_id).distinct().count()

        # Hosts with WWPNs
        hosts_with_wwpns = Host.objects.filter(
            storage__customer_id=customer_id
        ).annotate(
            wwpn_count=Count('host_wwpns')
        ).filter(wwpn_count__gt=0).count()

        hosts_without_wwpns = total_hosts - hosts_with_wwpns

        # Total WWPNs
        total_wwpns = HostWwpn.objects.filter(
            host__storage__customer_id=customer_id
        ).count()

        return JsonResponse({
            'total_hosts': total_hosts,
            'hosts_with_wwpns': hosts_with_wwpns,
            'hosts_without_wwpns': hosts_without_wwpns,
            'total_wwpns': total_wwpns
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_import_activity(request):
    """Recent Import Activity Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Get latest import
        latest_import = StorageImport.objects.filter(
            customer_id=customer_id
        ).order_by('-started_at').first()

        if not latest_import:
            return JsonResponse({
                'has_imports': False,
                'message': 'No imports found'
            })

        return JsonResponse({
            'has_imports': True,
            'import_id': latest_import.id,
            'status': latest_import.status,
            'started_at': latest_import.started_at.isoformat() if latest_import.started_at else None,
            'completed_at': latest_import.completed_at.isoformat() if latest_import.completed_at else None,
            'storage_systems_imported': latest_import.storage_systems_imported or 0,
            'volumes_imported': latest_import.volumes_imported or 0,
            'hosts_imported': latest_import.hosts_imported or 0,
            'error_message': latest_import.error_message
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_backup_health(request):
    """Backup Health Widget Data"""
    try:
        # Get latest backup (global, not customer-specific)
        latest_backup = BackupRecord.objects.order_by('-started_at').first()

        if not latest_backup:
            return JsonResponse({
                'has_backups': False,
                'message': 'No backups found'
            })

        # Calculate time since last backup
        from django.utils import timezone
        if latest_backup.completed_at:
            time_since = timezone.now() - latest_backup.completed_at
            hours_since = int(time_since.total_seconds() / 3600)

            if hours_since < 1:
                time_since_str = f"{int(time_since.total_seconds() / 60)} minutes ago"
            elif hours_since < 24:
                time_since_str = f"{hours_since} hours ago"
            else:
                days_since = int(hours_since / 24)
                time_since_str = f"{days_since} days ago"
        else:
            time_since_str = "In progress"

        return JsonResponse({
            'has_backups': True,
            'backup_id': latest_backup.id,
            'status': latest_backup.status,
            'started_at': latest_backup.started_at.isoformat() if latest_backup.started_at else None,
            'completed_at': latest_backup.completed_at.isoformat() if latest_backup.completed_at else None,
            'file_size_mb': latest_backup.size_mb,
            'duration': latest_backup.duration,
            'time_since': time_since_str,
            'backup_type': latest_backup.backup_type,
            'description': latest_backup.description
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_wwpn_inventory(request):
    """WWPN Inventory Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')
        project_id = request.GET.get('project_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Total WWPNs in aliases (SAN side)
        alias_wwpns = AliasWWPN.objects.filter(
            alias__fabric__customer_id=customer_id
        ).count()

        # Total WWPNs on hosts (Storage side)
        host_wwpns = HostWwpn.objects.filter(
            host__storage__customer_id=customer_id
        ).count()

        # Manual vs alias-derived (from HostWwpn)
        manual_wwpns = HostWwpn.objects.filter(
            host__storage__customer_id=customer_id,
            source_type='manual'
        ).count()

        alias_derived_wwpns = HostWwpn.objects.filter(
            host__storage__customer_id=customer_id,
            source_type='alias'
        ).count()

        return JsonResponse({
            'alias_wwpns': alias_wwpns,
            'host_wwpns': host_wwpns,
            'manual_wwpns': manual_wwpns,
            'alias_derived_wwpns': alias_derived_wwpns,
            'total_wwpns': alias_wwpns + host_wwpns
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_project_activity(request):
    """Project Activity Log Widget Data"""
    try:
        project_id = request.GET.get('project_id')
        limit = int(request.GET.get('limit', 10))

        if not project_id:
            return JsonResponse({'error': 'project_id required'}, status=400)

        project = Project.objects.get(id=project_id)

        # Get recently modified zones
        recent_zones = Zone.objects.filter(
            projects=project,
            last_modified_at__isnull=False
        ).order_by('-last_modified_at')[:limit]

        # Get recently modified aliases
        recent_aliases = Alias.objects.filter(
            projects=project,
            last_modified_at__isnull=False
        ).order_by('-last_modified_at')[:limit]

        # Combine and sort by timestamp
        activities = []

        for zone in recent_zones:
            activities.append({
                'type': 'zone',
                'name': zone.name,
                'action': 'modified',
                'timestamp': zone.last_modified_at.isoformat(),
                'user': zone.last_modified_by.username if zone.last_modified_by else 'Unknown'
            })

        for alias in recent_aliases:
            activities.append({
                'type': 'alias',
                'name': alias.name,
                'action': 'modified',
                'timestamp': alias.last_modified_at.isoformat(),
                'user': alias.last_modified_by.username if alias.last_modified_by else 'Unknown'
            })

        # Sort by timestamp descending
        activities.sort(key=lambda x: x['timestamp'], reverse=True)

        return JsonResponse({
            'activities': activities[:limit]
        })

    except Project.DoesNotExist:
        return JsonResponse({'error': 'Project not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def widget_storage_capacity(request):
    """Storage Capacity Summary Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Get all storage systems for customer
        storage_systems = Storage.objects.filter(customer_id=customer_id)

        # Calculate totals
        total_capacity_bytes = 0
        total_used_bytes = 0
        total_compression_savings = 0
        system_count = 0

        for system in storage_systems:
            # Total capacity
            if system.capacity_bytes:
                total_capacity_bytes += system.capacity_bytes

            # Used capacity
            if system.used_capacity_bytes:
                total_used_bytes += system.used_capacity_bytes

            # Compression savings
            if system.capacity_savings_bytes:
                total_compression_savings += system.capacity_savings_bytes

            system_count += 1

        # Calculate available
        total_available_bytes = total_capacity_bytes - total_used_bytes

        # Calculate percentages
        used_percentage = round((total_used_bytes / total_capacity_bytes * 100) if total_capacity_bytes > 0 else 0, 1)

        # Convert to readable units (TB)
        def bytes_to_tb(bytes_val):
            return round(bytes_val / (1024**4), 2) if bytes_val else 0

        return JsonResponse({
            'system_count': system_count,
            'total_capacity_tb': bytes_to_tb(total_capacity_bytes),
            'used_capacity_tb': bytes_to_tb(total_used_bytes),
            'available_capacity_tb': bytes_to_tb(total_available_bytes),
            'used_percentage': used_percentage,
            'compression_savings_tb': bytes_to_tb(total_compression_savings),
            'total_capacity_bytes': total_capacity_bytes,
            'used_capacity_bytes': total_used_bytes,
            'available_capacity_bytes': total_available_bytes
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)