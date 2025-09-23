from django.core.management.base import BaseCommand
from core.models import WidgetType, DashboardWidget


class Command(BaseCommand):
    help = 'Remove unused widget types and clean up dashboard widgets'

    def handle(self, *args, **options):
        self.stdout.write('Cleaning up unused widget types...')
        
        # Keep only these widget types
        keep_widgets = ['storage_systems']
        
        # Get widget types to remove
        widgets_to_remove = WidgetType.objects.exclude(name__in=keep_widgets)
        
        self.stdout.write(f'Found {widgets_to_remove.count()} widget types to remove:')
        for widget in widgets_to_remove:
            self.stdout.write(f'  - {widget.display_name} ({widget.name})')
        
        # Remove associated dashboard widgets first
        dashboard_widgets_to_remove = DashboardWidget.objects.filter(
            widget_type__in=widgets_to_remove
        )
        
        if dashboard_widgets_to_remove.exists():
            count = dashboard_widgets_to_remove.count()
            dashboard_widgets_to_remove.delete()
            self.stdout.write(f'Removed {count} dashboard widget instances')
        
        # Remove the widget types
        if widgets_to_remove.exists():
            count = widgets_to_remove.count()
            widgets_to_remove.delete()
            self.stdout.write(f'Removed {count} widget types')
        
        # Update the storage_systems widget to ensure it has requires_data_source=True
        storage_widget = WidgetType.objects.filter(name='storage_systems').first()
        if storage_widget:
            storage_widget.requires_data_source = True
            storage_widget.save()
            self.stdout.write('Updated storage_systems widget to require data source')
        
        self.stdout.write(
            self.style.SUCCESS('Successfully cleaned up unused widgets!')
        )