from django.contrib import admin
from .models import Project, Config, TableConfiguration, AppSettings

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ("customer", "active_project", "is_active")
    list_filter = ("is_active", "customer")
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


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "theme", "items_per_page", "zone_ratio", "alias_max_zones", "updated_at")
    list_filter = ("theme", "items_per_page", "zone_ratio", "compact_mode", "auto_refresh", "notifications")
    search_fields = ("user__username",)
    readonly_fields = ("created_at", "updated_at")
    
    fieldsets = (
        ("User", {
            "fields": ("user",)
        }),
        ("Display Settings", {
            "fields": ("theme", "items_per_page", "compact_mode")
        }),
        ("Data & Refresh Settings", {
            "fields": ("auto_refresh", "auto_refresh_interval")
        }),
        ("SAN Configuration", {
            "fields": ("zone_ratio", "alias_max_zones"),
            "description": "SAN-specific settings moved from Config model"
        }),
        ("Features & Notifications", {
            "fields": ("notifications", "show_advanced_features")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )
    
    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('user')