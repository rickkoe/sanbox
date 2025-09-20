from django.core.management.base import BaseCommand
from core.models import WidgetType, DashboardTheme, DashboardPreset


class Command(BaseCommand):
    help = 'Seed the database with initial widget types, themes, and presets'

    def handle(self, *args, **options):
        self.stdout.write('Seeding dashboard widgets, themes, and presets...')
        
        # Create Widget Types
        widget_types = [
            {
                'name': 'san_metrics',
                'display_name': 'SAN Metrics',
                'description': 'Display key SAN infrastructure metrics like fabric count, zones, and aliases',
                'component_name': 'MetricWidget',
                'category': 'metrics',
                'icon': 'FaNetworkWired',
                'default_width': 3,
                'default_height': 200,
                'min_width': 2,
                'min_height': 150,
                'max_width': 6,
                'max_height': 400,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'metric_type': {'type': 'select', 'options': ['fabrics', 'zones', 'aliases', 'hosts']},
                    'show_trend': {'type': 'boolean', 'default': True}
                }
            },
            {
                'name': 'storage_capacity',
                'display_name': 'Storage Capacity Overview',
                'description': 'Visualize storage capacity utilization across all systems',
                'component_name': 'CapacityWidget',
                'category': 'charts',
                'icon': 'FaServer',
                'default_width': 8,
                'default_height': 350,
                'min_width': 4,
                'min_height': 250,
                'max_width': 12,
                'max_height': 500,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'chart_type': {'type': 'select', 'options': ['bar', 'table', 'pie']},
                    'show_utilization': {'type': 'boolean', 'default': True}
                }
            },
            {
                'name': 'system_health',
                'display_name': 'System Health Monitor',
                'description': 'Monitor overall system health and active issues',
                'component_name': 'HealthWidget',
                'category': 'health',
                'icon': 'FaExclamationTriangle',
                'default_width': 4,
                'default_height': 300,
                'min_width': 3,
                'min_height': 200,
                'max_width': 6,
                'max_height': 400,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'show_details': {'type': 'boolean', 'default': True},
                    'alert_threshold': {'type': 'number', 'default': 80}
                }
            },
            {
                'name': 'recent_activity',
                'display_name': 'Recent Activity Feed',
                'description': 'Show recent system activities and operations',
                'component_name': 'ActivityWidget',
                'category': 'activity',
                'icon': 'FaClock',
                'default_width': 4,
                'default_height': 350,
                'min_width': 3,
                'min_height': 250,
                'max_width': 8,
                'max_height': 500,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'max_items': {'type': 'number', 'default': 10},
                    'filter_type': {'type': 'select', 'options': ['all', 'imports', 'errors', 'warnings']}
                }
            },
            {
                'name': 'fabric_overview',
                'display_name': 'SAN Fabric Overview',
                'description': 'Overview of SAN fabric status and zone counts',
                'component_name': 'NetworkWidget',
                'category': 'charts',
                'icon': 'FaNetworkWired',
                'default_width': 6,
                'default_height': 300,
                'min_width': 4,
                'min_height': 200,
                'max_width': 8,
                'max_height': 400,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'show_zone_count': {'type': 'boolean', 'default': True},
                    'layout': {'type': 'select', 'options': ['list', 'grid']}
                }
            },
            {
                'name': 'storage_systems',
                'display_name': 'Storage Systems',
                'description': 'List of storage systems with status and capacity',
                'component_name': 'SystemsWidget',
                'category': 'tables',
                'icon': 'FaServer',
                'default_width': 6,
                'default_height': 350,
                'min_width': 4,
                'min_height': 250,
                'max_width': 12,
                'max_height': 500,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'show_capacity': {'type': 'boolean', 'default': True},
                    'sort_by': {'type': 'select', 'options': ['name', 'capacity', 'utilization']}
                }
            },
            {
                'name': 'capacity_analytics',
                'display_name': 'Capacity Analytics',
                'description': 'Advanced capacity analytics with trends and forecasting',
                'component_name': 'ChartWidget',
                'category': 'charts',
                'icon': 'FaChartLine',
                'default_width': 12,
                'default_height': 400,
                'min_width': 6,
                'min_height': 300,
                'max_width': 12,
                'max_height': 600,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'time_range': {'type': 'select', 'options': ['7d', '30d', '90d', '1y']},
                    'chart_type': {'type': 'select', 'options': ['line', 'bar', 'area']}
                }
            },
            {
                'name': 'zone_table',
                'display_name': 'Zone Management Table',
                'description': 'Detailed table view of SAN zones with management options',
                'component_name': 'TableWidget',
                'category': 'tables',
                'icon': 'FaDatabase',
                'default_width': 12,
                'default_height': 400,
                'min_width': 6,
                'min_height': 300,
                'max_width': 12,
                'max_height': 600,
                'is_resizable': True,
                'requires_data_source': True,
                'config_schema': {
                    'columns': {'type': 'multiselect', 'options': ['name', 'fabric', 'members', 'status']},
                    'page_size': {'type': 'number', 'default': 25}
                }
            }
        ]

        for widget_data in widget_types:
            widget_type, created = WidgetType.objects.get_or_create(
                name=widget_data['name'],
                defaults=widget_data
            )
            if created:
                self.stdout.write(f'Created widget type: {widget_type.display_name}')
            else:
                self.stdout.write(f'Widget type already exists: {widget_type.display_name}')

        # Create Dashboard Themes
        themes = [
            {
                'name': 'modern',
                'display_name': 'Modern',
                'description': 'Clean and contemporary design with subtle gradients',
                'css_variables': {
                    '--dashboard-bg': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                    '--card-bg': 'rgba(255, 255, 255, 0.95)',
                    '--primary-color': '#667eea',
                    '--secondary-color': '#764ba2'
                },
                'background_type': 'gradient',
                'background_config': {'gradient': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'},
                'card_style': 'modern',
                'animation_level': 'medium',
                'is_system': True
            },
            {
                'name': 'dark',
                'display_name': 'Dark Mode',
                'description': 'Dark theme optimized for low-light environments',
                'css_variables': {
                    '--dashboard-bg': 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
                    '--card-bg': 'rgba(30, 30, 60, 0.95)',
                    '--primary-color': '#64ffda',
                    '--text-color': '#e2e8f0'
                },
                'background_type': 'gradient',
                'background_config': {'gradient': 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)'},
                'card_style': 'modern',
                'animation_level': 'medium',
                'is_system': True
            },
            {
                'name': 'minimal',
                'display_name': 'Minimal',
                'description': 'Clean and simple design with minimal distractions',
                'css_variables': {
                    '--dashboard-bg': '#fafafa',
                    '--card-bg': '#ffffff',
                    '--primary-color': '#2563eb'
                },
                'background_type': 'solid',
                'background_config': {'color': '#fafafa'},
                'card_style': 'minimal',
                'animation_level': 'minimal',
                'is_system': True
            },
            {
                'name': 'corporate',
                'display_name': 'Corporate',
                'description': 'Professional blue theme for business environments',
                'css_variables': {
                    '--dashboard-bg': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                    '--card-bg': 'rgba(255, 255, 255, 0.98)',
                    '--primary-color': '#1e40af'
                },
                'background_type': 'gradient',
                'background_config': {'gradient': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'},
                'card_style': 'modern',
                'animation_level': 'minimal',
                'is_system': True
            },
            {
                'name': 'colorful',
                'display_name': 'Colorful',
                'description': 'Vibrant and energetic theme with dynamic colors',
                'css_variables': {
                    '--dashboard-bg': 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)',
                    '--card-bg': 'rgba(255, 255, 255, 0.9)',
                    '--primary-color': '#e17055'
                },
                'background_type': 'gradient',
                'background_config': {'gradient': 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)'},
                'card_style': 'modern',
                'animation_level': 'full',
                'is_system': True
            }
        ]

        for theme_data in themes:
            theme, created = DashboardTheme.objects.get_or_create(
                name=theme_data['name'],
                defaults=theme_data
            )
            if created:
                self.stdout.write(f'Created theme: {theme.display_name}')
            else:
                self.stdout.write(f'Theme already exists: {theme.display_name}')

        # Create Dashboard Presets
        presets = [
            {
                'name': 'executive_overview',
                'display_name': 'Executive Overview',
                'description': 'High-level metrics and KPIs perfect for executives and managers',
                'category': 'executive',
                'thumbnail_url': '',
                'layout_config': {
                    'theme': 'corporate',
                    'grid_columns': 12,
                    'widgets': [
                        {
                            'widget_type': 'san_metrics',
                            'title': 'SAN Infrastructure',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 3,
                            'height': 200,
                            'config': {'metric_type': 'fabrics', 'show_trend': True}
                        },
                        {
                            'widget_type': 'storage_capacity',
                            'title': 'Storage Overview',
                            'position_x': 3,
                            'position_y': 0,
                            'width': 6,
                            'height': 300,
                            'config': {'chart_type': 'bar', 'show_utilization': True}
                        },
                        {
                            'widget_type': 'system_health',
                            'title': 'System Health',
                            'position_x': 9,
                            'position_y': 0,
                            'width': 3,
                            'height': 200,
                            'config': {'show_details': False}
                        }
                    ]
                },
                'required_permissions': [],
                'target_roles': ['executive', 'manager'],
                'is_system': True,
                'is_featured': True,
                'usage_count': 150
            },
            {
                'name': 'technical_operations',
                'display_name': 'Technical Operations',
                'description': 'Comprehensive operational dashboard for technical teams',
                'category': 'technical',
                'thumbnail_url': '',
                'layout_config': {
                    'theme': 'dark',
                    'grid_columns': 12,
                    'widgets': [
                        {
                            'widget_type': 'fabric_overview',
                            'title': 'SAN Fabrics',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 4,
                            'height': 250,
                            'config': {'show_zone_count': True, 'layout': 'grid'}
                        },
                        {
                            'widget_type': 'storage_systems',
                            'title': 'Storage Systems',
                            'position_x': 4,
                            'position_y': 0,
                            'width': 4,
                            'height': 250,
                            'config': {'show_capacity': True, 'sort_by': 'utilization'}
                        },
                        {
                            'widget_type': 'recent_activity',
                            'title': 'System Activity',
                            'position_x': 8,
                            'position_y': 0,
                            'width': 4,
                            'height': 250,
                            'config': {'max_items': 8, 'filter_type': 'all'}
                        },
                        {
                            'widget_type': 'capacity_analytics',
                            'title': 'Capacity Trends',
                            'position_x': 0,
                            'position_y': 1,
                            'width': 12,
                            'height': 300,
                            'config': {'time_range': '30d', 'chart_type': 'line'}
                        }
                    ]
                },
                'required_permissions': ['view_storage', 'view_san'],
                'target_roles': ['admin', 'engineer', 'analyst'],
                'is_system': True,
                'is_featured': True,
                'usage_count': 95
            },
            {
                'name': 'capacity_planning',
                'display_name': 'Capacity Planning',
                'description': 'Focused on storage capacity analysis and growth planning',
                'category': 'capacity',
                'thumbnail_url': '',
                'layout_config': {
                    'theme': 'modern',
                    'grid_columns': 12,
                    'widgets': [
                        {
                            'widget_type': 'storage_capacity',
                            'title': 'Current Capacity',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 8,
                            'height': 350,
                            'config': {'chart_type': 'table', 'show_utilization': True}
                        },
                        {
                            'widget_type': 'system_health',
                            'title': 'Capacity Alerts',
                            'position_x': 8,
                            'position_y': 0,
                            'width': 4,
                            'height': 350,
                            'config': {'show_details': True, 'alert_threshold': 80}
                        },
                        {
                            'widget_type': 'capacity_analytics',
                            'title': 'Growth Analysis',
                            'position_x': 0,
                            'position_y': 1,
                            'width': 12,
                            'height': 400,
                            'config': {'time_range': '90d', 'chart_type': 'area'}
                        }
                    ]
                },
                'required_permissions': ['view_storage'],
                'target_roles': ['capacity_planner', 'architect'],
                'is_system': True,
                'is_featured': False,
                'usage_count': 67
            }
        ]

        for preset_data in presets:
            preset, created = DashboardPreset.objects.get_or_create(
                name=preset_data['name'],
                defaults=preset_data
            )
            if created:
                self.stdout.write(f'Created preset: {preset.display_name}')
            else:
                self.stdout.write(f'Preset already exists: {preset.display_name}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully seeded dashboard data:\n'
                f'- {len(widget_types)} widget types\n'
                f'- {len(themes)} themes\n'
                f'- {len(presets)} presets'
            )
        )