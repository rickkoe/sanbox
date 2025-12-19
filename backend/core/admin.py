from django.contrib import admin
from .models import (
    Project, Config, TableConfiguration, AppSettings, AuditLog, CustomNamingRule, CustomVariable,
    DashboardLayout,
    DashboardPreset, DashboardTheme, DashboardWidget, WidgetDataSource, WidgetType,
    UserConfig, EquipmentType, WorksheetTemplate,
    ProjectFabric, ProjectSwitch, ProjectAlias, ProjectZone,
    ProjectStorage, ProjectHost, ProjectVolume, ProjectPool, ProjectPort
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
    list_display = ("user", "theme", "items_per_page", "zone_ratio", "alias_max_zones", "new_users_are_staff", "new_users_are_superuser", "updated_at")
    list_filter = ("theme", "items_per_page", "zone_ratio", "compact_mode", "auto_refresh", "notifications", "new_users_are_staff", "new_users_are_superuser")
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
        ("User Management", {
            "fields": ("new_users_are_staff", "new_users_are_superuser"),
            "description": "Controls whether newly registered users automatically receive Django admin access (staff status) and/or full admin privileges (superuser status)"
        }),
        ("Audit Log Settings", {
            "fields": ("audit_log_retention_days",),
            "description": "Configure audit log retention policy"
        }),
        ("Features & Notifications", {
            "fields": ("notifications", "show_advanced_features", "hide_mode_banners")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )
    
    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('user')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "action_type", "entity_type", "status", "customer", "summary_preview")
    list_filter = ("action_type", "status", "entity_type", "timestamp", "customer")
    search_fields = ("user__username", "summary", "entity_name", "customer__name")
    readonly_fields = ("timestamp", "user", "action_type", "entity_type", "entity_name",
                       "customer", "summary", "details", "status", "duration_seconds", "ip_address")
    date_hierarchy = "timestamp"
    ordering = ("-timestamp",)

    fieldsets = (
        ("Action Information", {
            "fields": ("timestamp", "user", "ip_address")
        }),
        ("Action Type", {
            "fields": ("action_type", "entity_type", "entity_name", "status")
        }),
        ("Context", {
            "fields": ("customer", "summary")
        }),
        ("Details", {
            "fields": ("details", "duration_seconds"),
            "classes": ("collapse",)
        })
    )

    def summary_preview(self, obj):
        """Show truncated summary in list view"""
        if len(obj.summary) > 60:
            return obj.summary[:60] + "..."
        return obj.summary
    summary_preview.short_description = "Summary"

    def has_add_permission(self, request):
        """Prevent manual addition of audit logs"""
        return False

    def has_change_permission(self, request, obj=None):
        """Make audit logs read-only"""
        return False

    def has_delete_permission(self, request, obj=None):
        """Only allow deletion via purge endpoint or superuser"""
        return request.user.is_superuser

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('user', 'customer')


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


# CustomerMembership and ProjectGroup admin removed - models no longer exist


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


# ========== WORKSHEET GENERATOR ADMIN ==========

@admin.register(EquipmentType)
class EquipmentTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "vendor", "is_active", "display_order", "created_at")
    list_filter = ("category", "is_active", "vendor", "created_at")
    search_fields = ("name", "vendor", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("category", "display_order", "name")

    fieldsets = (
        ("Equipment Type Information", {
            "fields": ("name", "category", "vendor", "description")
        }),
        ("Field Schema", {
            "fields": ("fields_schema",),
            "description": "JSON array defining the dynamic fields for this equipment type"
        }),
        ("Display Settings", {
            "fields": ("icon_name", "display_order", "is_active")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )


@admin.register(WorksheetTemplate)
class WorksheetTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "customer", "user", "is_default", "is_global", "created_at")
    list_filter = ("is_default", "is_global", "customer", "created_at")
    search_fields = ("name", "description", "customer__name", "user__username")
    readonly_fields = ("created_at", "updated_at")
    filter_horizontal = ("equipment_types",)

    fieldsets = (
        ("Template Information", {
            "fields": ("name", "description")
        }),
        ("Owner", {
            "fields": ("customer", "user")
        }),
        ("Equipment Types", {
            "fields": ("equipment_types",)
        }),
        ("Template Configuration", {
            "fields": ("template_config",),
            "description": "JSON object storing template configuration",
            "classes": ("collapse",)
        }),
        ("Settings", {
            "fields": ("is_default", "is_global")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related and prefetch_related"""
        return super().get_queryset(request).select_related('customer', 'user').prefetch_related('equipment_types')


# ========== PROJECT-ENTITY JUNCTION TABLES ==========

@admin.register(ProjectFabric)
class ProjectFabricAdmin(admin.ModelAdmin):
    list_display = ("project", "fabric", "action", "added_by", "added_at")
    list_filter = ("action", "project", "fabric__customer", "added_at")
    search_fields = ("project__name", "fabric__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "fabric", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'fabric', 'fabric__customer', 'added_by')


@admin.register(ProjectSwitch)
class ProjectSwitchAdmin(admin.ModelAdmin):
    list_display = ("project", "switch", "action", "added_by", "added_at")
    list_filter = ("action", "project", "switch__customer", "added_at")
    search_fields = ("project__name", "switch__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "switch", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'switch', 'switch__customer', 'added_by')


@admin.register(ProjectAlias)
class ProjectAliasAdmin(admin.ModelAdmin):
    list_display = ("project", "alias", "action", "include_in_zoning", "added_by", "added_at")
    list_filter = ("action", "include_in_zoning", "project", "alias__fabric__customer", "added_at")
    search_fields = ("project__name", "alias__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "alias", "added_by")
    list_editable = ("include_in_zoning",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'project', 'alias', 'alias__fabric', 'alias__fabric__customer', 'added_by'
        )


@admin.register(ProjectZone)
class ProjectZoneAdmin(admin.ModelAdmin):
    list_display = ("project", "zone", "action", "added_by", "added_at")
    list_filter = ("action", "project", "zone__fabric__customer", "added_at")
    search_fields = ("project__name", "zone__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "zone", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'project', 'zone', 'zone__fabric', 'zone__fabric__customer', 'added_by'
        )


@admin.register(ProjectStorage)
class ProjectStorageAdmin(admin.ModelAdmin):
    list_display = ("project", "storage", "action", "added_by", "added_at")
    list_filter = ("action", "project", "storage__customer", "added_at")
    search_fields = ("project__name", "storage__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "storage", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'storage', 'storage__customer', 'added_by')


@admin.register(ProjectHost)
class ProjectHostAdmin(admin.ModelAdmin):
    list_display = ("project", "host", "action", "added_by", "added_at")
    list_filter = ("action", "project", "host__storage__customer", "added_at")
    search_fields = ("project__name", "host__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "host", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'host', 'host__storage', 'added_by')


@admin.register(ProjectVolume)
class ProjectVolumeAdmin(admin.ModelAdmin):
    list_display = ("project", "volume", "action", "added_by", "added_at")
    list_filter = ("action", "project", "volume__storage__customer", "added_at")
    search_fields = ("project__name", "volume__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "volume", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'volume', 'volume__storage', 'added_by')


@admin.register(ProjectPool)
class ProjectPoolAdmin(admin.ModelAdmin):
    list_display = ("project", "pool", "action", "added_by", "added_at")
    list_filter = ("action", "project", "pool__storage__customer", "added_at")
    search_fields = ("project__name", "pool__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "pool", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'pool', 'pool__storage', 'added_by')


@admin.register(ProjectPort)
class ProjectPortAdmin(admin.ModelAdmin):
    list_display = ("project", "port", "action", "added_by", "added_at")
    list_filter = ("action", "project", "port__storage__customer", "added_at")
    search_fields = ("project__name", "port__name", "notes")
    readonly_fields = ("added_at", "updated_at")
    raw_id_fields = ("project", "port", "added_by")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project', 'port', 'port__storage', 'added_by')