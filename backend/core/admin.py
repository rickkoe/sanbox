from django.contrib import admin
from .models import Project, Config, TableConfiguration

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ("customer", "active_project", "san_vendor", "is_active")
    list_filter = ("san_vendor", "customer")
    search_fields = ("customer__name", "active_project__name")

    def save_model(self, request, obj, form, change):
        """Ensure only one Config is active per customer."""
        if obj.is_active:
            Config.objects.exclude(pk=obj.pk).update(is_active=False)
        super().save_model(request, obj, form, change)


@admin.register(TableConfiguration)
class TableConfigurationAdmin(admin.ModelAdmin):
    list_display = ("customer", "table_name", "user", "page_size", "created_at", "updated_at")
    list_filter = ("table_name", "customer", "page_size", "created_at")
    search_fields = ("customer__name", "table_name", "user__username")
    readonly_fields = ("created_at", "updated_at")
    
    fieldsets = (
        ("Identification", {
            "fields": ("customer", "user", "table_name")
        }),
        ("Column Configuration", {
            "fields": ("visible_columns", "column_widths"),
            "classes": ("collapse",)
        }),
        ("Filters and Sorting", {
            "fields": ("filters", "sorting"),
            "classes": ("collapse",)
        }),
        ("Display Settings", {
            "fields": ("page_size", "additional_settings")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )
    
    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer', 'user')