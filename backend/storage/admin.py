from django.contrib import admin
from .models import Storage, Host, Volume, HostWwpn, Port, Pool
from core.dashboard_views import clear_dashboard_cache_for_customer


@admin.register(Storage)
class StorageAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "storage_type",
        "model",
        "serial_number",
        "location",
        "probe_status",
        "used_capacity_percent",
        "volumes_count",
        "pools_count",
        "customer",
    )
    search_fields = ("name", "serial_number", "model", "location", "customer__name")
    list_filter = ("storage_type", "probe_status", "location", "customer")
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Clear dashboard cache when storage is saved via admin
        if obj.customer_id:
            clear_dashboard_cache_for_customer(obj.customer_id)
    
    def delete_model(self, request, obj):
        customer_id = obj.customer_id
        super().delete_model(request, obj)
        # Clear dashboard cache when storage is deleted via admin
        if customer_id:
            clear_dashboard_cache_for_customer(customer_id)


@admin.register(Pool)
class PoolAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "storage",
        "storage_type",
        "unique_id",
        "committed",
        "imported",
        "updated",
    )
    search_fields = ("name", "unique_id", "storage__name")
    list_filter = ("storage_type", "committed", "storage")
    raw_id_fields = ("storage",)
    readonly_fields = ("imported", "updated")

    fieldsets = (
        ("Basic Information", {
            'fields': ('name', 'storage', 'storage_type', 'unique_id')
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed',)
        }),
        ("Timestamps", {
            'fields': ('imported', 'updated'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        """Optimize queries by selecting related objects"""
        return super().get_queryset(request).select_related('storage', 'storage__customer')


@admin.register(Volume)
class VolumeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "volume_id",
        "format",
        "pool",
        "capacity_bytes",
        "used_capacity_percent",
        "storage",
    )
    search_fields = ("name", "volume_id", "unique_id", "storage__name", "pool__name")
    list_filter = ("format", "pool", "storage")


# Host admin registration
@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "host_type",
        "storage_system",
        "fc_ports_count",
        "vols_count",
    )
    search_fields = ("name", "storage_system", "host_type", "volume_group")
    list_filter = ("host_type", "status", "storage_system")


@admin.register(HostWwpn)
class HostWwpnAdmin(admin.ModelAdmin):
    list_display = (
        "host_name",
        "wwpn",
        "source_type",
        "source_alias_name",
        "created_at",
        "updated_at"
    )
    search_fields = ("host__name", "wwpn", "source_alias__name")
    list_filter = ("source_type", "created_at")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("host", "source_alias")

    def host_name(self, obj):
        """Display the host name"""
        return obj.host.name if obj.host else "-"
    host_name.short_description = "Host"
    host_name.admin_order_field = "host__name"

    def source_alias_name(self, obj):
        """Display the source alias name"""
        if obj.source_type == 'alias' and obj.source_alias:
            return obj.source_alias.name
        return "-"
    source_alias_name.short_description = "Source Alias"
    source_alias_name.admin_order_field = "source_alias__name"

    def get_queryset(self, request):
        """Optimize queries by selecting related objects"""
        return super().get_queryset(request).select_related('host', 'source_alias', 'host__storage')

    fieldsets = (
        (None, {
            'fields': ('host', 'wwpn', 'source_type')
        }),
        ('Source Information', {
            'fields': ('source_alias',),
            'description': 'Only applicable when source_type is "alias"'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def has_add_permission(self, request):
        """Allow manual creation of HostWwpn records"""
        return True

    def has_change_permission(self, request, obj=None):
        """Allow editing of HostWwpn records"""
        return True

    def has_delete_permission(self, request, obj=None):
        """Allow deletion of HostWwpn records"""
        return True


@admin.register(Port)
class PortAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "storage",
        "type",
        "speed_gbps",
        "protocol",
        "use",
        "fabric",
        "alias",
        "committed",
        "deployed",
        "location",
    )
    search_fields = ("name", "storage__name", "location", "fabric__name", "alias__name")
    list_filter = ("type", "use", "protocol", "storage", "fabric", "committed", "deployed")
    raw_id_fields = ("storage", "fabric", "alias")
    readonly_fields = ("created", "updated", "last_modified_at")

    fieldsets = (
        ("Basic Information", {
            'fields': ('name', 'storage', 'type', 'speed_gbps', 'use', 'protocol')
        }),
        ("Physical Location", {
            'fields': ('location', 'frame', 'io_enclosure')
        }),
        ("Network Configuration", {
            'fields': ('fabric', 'alias')
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed', 'deployed', 'created_by_project')
        }),
        ("Audit Information", {
            'fields': ('last_modified_by', 'last_modified_at', 'version', 'created', 'updated'),
            'classes': ('collapse',)
        })
    )