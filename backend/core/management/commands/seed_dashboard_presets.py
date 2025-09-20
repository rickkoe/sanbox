from django.core.management.base import BaseCommand
from core.models import DashboardPreset


class Command(BaseCommand):
    help = 'Create initial dashboard presets'

    def handle(self, *args, **options):
        presets = [
            {
                'name': 'executive_overview',
                'display_name': 'Executive Overview',
                'description': 'High-level metrics and KPIs for executives. Uses your current theme.',
                'category': 'executive',
                'layout_config': {
                    'theme': 'modern',
                    'grid_columns': 12,
                    'auto_refresh': True,
                    'refresh_interval': 30,
                    'widgets': [
                        {
                            'widget_type': 'san_fabric_count',
                            'title': 'Total Fabrics',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 3,
                            'height': 200,
                            'config': {},
                            'data_filters': {}
                        },
                        {
                            'widget_type': 'storage_capacity_chart',
                            'title': 'Storage Capacity Overview',
                            'position_x': 3,
                            'position_y': 0,
                            'width': 6,
                            'height': 300,
                            'config': {},
                            'data_filters': {}
                        },
                        {
                            'widget_type': 'system_health_overview',
                            'title': 'System Health',
                            'position_x': 9,
                            'position_y': 0,
                            'width': 3,
                            'height': 200,
                            'config': {},
                            'data_filters': {}
                        }
                    ]
                },
                'is_system': True,
                'is_featured': True,
                'usage_count': 0
            },
            {
                'name': 'technical_operations',
                'display_name': 'Technical Operations',
                'description': 'Detailed operational view for technical teams. Adapts to your theme.',
                'category': 'technical',
                'layout_config': {
                    'theme': 'dark',
                    'grid_columns': 12,
                    'auto_refresh': True,
                    'refresh_interval': 15,
                    'widgets': [
                        {
                            'widget_type': 'fabric_zones_table',
                            'title': 'Fabric Zones',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 6,
                            'height': 400,
                            'config': {},
                            'data_filters': {}
                        },
                        {
                            'widget_type': 'storage_systems_table',
                            'title': 'Storage Systems',
                            'position_x': 6,
                            'position_y': 0,
                            'width': 6,
                            'height': 400,
                            'config': {},
                            'data_filters': {}
                        },
                        {
                            'widget_type': 'recent_activity_feed',
                            'title': 'Recent Activity',
                            'position_x': 0,
                            'position_y': 4,
                            'width': 12,
                            'height': 300,
                            'config': {},
                            'data_filters': {}
                        }
                    ]
                },
                'is_system': True,
                'is_featured': True,
                'usage_count': 0
            },
            {
                'name': 'capacity_planning',
                'display_name': 'Capacity Planning',
                'description': 'Focus on storage capacity and growth trends. Preserves your theme choice.',
                'category': 'capacity',
                'layout_config': {
                    'theme': 'modern',
                    'grid_columns': 12,
                    'auto_refresh': True,
                    'refresh_interval': 60,
                    'widgets': [
                        {
                            'widget_type': 'storage_capacity_chart',
                            'title': 'Capacity Trends',
                            'position_x': 0,
                            'position_y': 0,
                            'width': 8,
                            'height': 400,
                            'config': {},
                            'data_filters': {}
                        },
                        {
                            'widget_type': 'capacity_utilization_metric',
                            'title': 'Utilization',
                            'position_x': 8,
                            'position_y': 0,
                            'width': 4,
                            'height': 400,
                            'config': {},
                            'data_filters': {}
                        }
                    ]
                },
                'is_system': True,
                'is_featured': False,
                'usage_count': 0
            }
        ]

        for preset_data in presets:
            preset, created = DashboardPreset.objects.get_or_create(
                name=preset_data['name'],
                defaults=preset_data
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created preset: {preset.display_name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Preset already exists: {preset.display_name}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded dashboard presets')
        )