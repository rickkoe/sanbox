from django.contrib import admin
from .models import (
    Project, Config, TableConfiguration, AppSettings, CustomNamingRule, CustomVariable,
    CustomerMembership, ProjectGroup, DashboardAnalytics, DashboardLayout,
    DashboardPreset, DashboardTheme, DashboardWidget, WidgetDataSource, WidgetType,
    UserConfig
)

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

@admin.register(UserConfig)
class UserConfigAdmin(admin.ModelAdmin):
    list_display = ("user", "active_customer", "active_project", "updated_at")
    list_filter = ("active_customer", "updated_at")
    search_fields = ("user__username", "active_customer__name", "active_project__name")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("User", {
            "fields": ("user",)
        }),
        ("Active Configuration", {
            "fields": ("active_customer", "active_project")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('user', 'active_customer', 'active_project')


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


@admin.register(CustomNamingRule)
class CustomNamingRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "table_name", "customer", "user", "is_active", "created_at")
    list_filter = ("table_name", "is_active", "customer", "created_at")
    search_fields = ("name", "customer__name", "table_name", "user__username")
    readonly_fields = ("created_at", "updated_at")
    
    fieldsets = (
        ("Rule Information", {
            "fields": ("name", "table_name", "is_active")
        }),
        ("Owner", {
            "fields": ("customer", "user")
        }),
        ("Pattern Configuration", {
            "fields": ("pattern",),
            "description": "JSON array defining the naming pattern with type and value objects"
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )
    
    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer', 'user')


@admin.register(CustomVariable)
class CustomVariableAdmin(admin.ModelAdmin):
    list_display = ("name", "value", "customer", "user", "description", "created_at")
    list_filter = ("customer", "created_at")
    search_fields = ("name", "value", "description", "customer__name", "user__username")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Variable Information", {
            "fields": ("name", "value", "description")
        }),
        ("Owner", {
            "fields": ("customer", "user")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer', 'user')


@admin.register(CustomerMembership)
class CustomerMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "customer", "role", "created_at")
    list_filter = ("role", "customer", "created_at")
    search_fields = ("user__username", "customer__name")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Membership Information", {
            "fields": ("customer", "user", "role")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer', 'user')


@admin.register(ProjectGroup)
class ProjectGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "customer", "created_by", "created_at")
    list_filter = ("customer", "created_at")
    search_fields = ("name", "customer__name", "created_by__username", "description")
    readonly_fields = ("created_at", "updated_at")
    filter_horizontal = ("members",)

    fieldsets = (
        ("Group Information", {
            "fields": ("name", "customer", "description")
        }),
        ("Members", {
            "fields": ("created_by", "members")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer', 'created_by')


@admin.register(DashboardLayout)
class DashboardLayoutAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "customer", "theme", "is_active", "updated_at")
    list_filter = ("theme", "is_active", "auto_refresh", "customer", "created_at")
    search_fields = ("name", "user__username", "customer__name")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Layout Information", {
            "fields": ("user", "customer", "name", "is_active")
        }),
        ("Display Settings", {
            "fields": ("theme", "grid_columns")
        }),
        ("Refresh Settings", {
            "fields": ("auto_refresh", "refresh_interval")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('user', 'customer')


@admin.register(WidgetType)
class WidgetTypeAdmin(admin.ModelAdmin):
    list_display = ("display_name", "category", "component_name", "is_active", "is_resizable")
    list_filter = ("category", "is_active", "is_resizable", "requires_data_source")
    search_fields = ("name", "display_name", "description", "component_name")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Widget Type Information", {
            "fields": ("name", "display_name", "description", "category", "icon", "component_name")
        }),
        ("Size Configuration", {
            "fields": ("default_width", "default_height", "min_width", "min_height", "max_width", "max_height", "is_resizable")
        }),
        ("Data & Configuration", {
            "fields": ("requires_data_source", "config_schema")
        }),
        ("Status", {
            "fields": ("is_active", "created_at")
        })
    )


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(admin.ModelAdmin):
    list_display = ("title", "widget_type", "layout", "is_visible", "width", "height", "updated_at")
    list_filter = ("widget_type", "is_visible", "layout__customer", "created_at")
    search_fields = ("title", "layout__name", "layout__user__username", "widget_type__display_name")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Widget Information", {
            "fields": ("layout", "widget_type", "title", "is_visible")
        }),
        ("Position & Size", {
            "fields": ("position_x", "position_y", "width", "height", "z_index")
        }),
        ("Configuration", {
            "fields": ("config", "data_filters", "refresh_interval"),
            "classes": ("collapse",)
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('layout', 'widget_type', 'layout__user', 'layout__customer')


@admin.register(DashboardTheme)
class DashboardThemeAdmin(admin.ModelAdmin):
    list_display = ("display_name", "background_type", "card_style", "animation_level", "is_system", "is_active")
    list_filter = ("background_type", "card_style", "animation_level", "is_system", "is_active")
    search_fields = ("name", "display_name", "description")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Theme Information", {
            "fields": ("name", "display_name", "description")
        }),
        ("Visual Style", {
            "fields": ("background_type", "background_config", "card_style", "animation_level", "css_variables")
        }),
        ("Status", {
            "fields": ("is_system", "is_active", "created_at")
        })
    )


@admin.register(WidgetDataSource)
class WidgetDataSourceAdmin(admin.ModelAdmin):
    list_display = ("display_name", "endpoint_pattern", "data_format", "is_real_time", "cache_duration", "is_active")
    list_filter = ("data_format", "is_real_time", "requires_auth", "is_active")
    search_fields = ("name", "display_name", "description", "endpoint_pattern")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Data Source Information", {
            "fields": ("name", "display_name", "description", "endpoint_pattern")
        }),
        ("Configuration", {
            "fields": ("parameters_schema", "data_format", "requires_auth")
        }),
        ("Caching & Updates", {
            "fields": ("cache_duration", "is_real_time", "update_frequency")
        }),
        ("Status", {
            "fields": ("is_active", "created_at")
        })
    )


@admin.register(DashboardPreset)
class DashboardPresetAdmin(admin.ModelAdmin):
    list_display = ("display_name", "category", "is_system", "is_featured", "is_public", "usage_count", "updated_at")
    list_filter = ("category", "is_system", "is_featured", "is_public", "created_at")
    search_fields = ("name", "display_name", "description", "created_by__username", "customer__name")
    readonly_fields = ("usage_count", "created_at", "updated_at")

    fieldsets = (
        ("Preset Information", {
            "fields": ("name", "display_name", "description", "category", "thumbnail_url")
        }),
        ("Configuration", {
            "fields": ("layout_config", "required_permissions", "target_roles"),
            "classes": ("collapse",)
        }),
        ("Ownership", {
            "fields": ("created_by", "customer", "is_public")
        }),
        ("Status & Popularity", {
            "fields": ("is_system", "is_featured", "usage_count")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('created_by', 'customer')


@admin.register(DashboardAnalytics)
class DashboardAnalyticsAdmin(admin.ModelAdmin):
    list_display = ("layout", "event_type", "widget", "timestamp", "session_id")
    list_filter = ("event_type", "timestamp", "layout__customer")
    search_fields = ("layout__name", "layout__user__username", "widget__title", "session_id", "ip_address")
    readonly_fields = ("timestamp",)

    fieldsets = (
        ("Event Information", {
            "fields": ("layout", "widget", "event_type", "metadata")
        }),
        ("Session Information", {
            "fields": ("session_id", "ip_address", "user_agent"),
            "classes": ("collapse",)
        }),
        ("Metadata", {
            "fields": ("timestamp",),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('layout', 'widget', 'layout__user', 'layout__customer')

    def has_add_permission(self, request):
        # Analytics should only be created programmatically
        return False