from django.contrib import admin
from .models import Storage, Host, Volume, HostWwpn, Port, Pool, HostCluster, IBMiLPAR, VolumeMapping, PPRCPath
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


@admin.register(HostCluster)
class HostClusterAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "storage",
        "host_count",
        "volume_count",
        "committed",
        "deployed",
        "created_at",
    )
    search_fields = ("name", "storage__name", "notes")
    list_filter = ("storage", "committed", "deployed")
    raw_id_fields = ("storage", "created_by_project", "last_modified_by")
    filter_horizontal = ("hosts",)
    readonly_fields = ("created_at", "updated_at", "last_modified_at")

    fieldsets = (
        ("Basic Information", {
            'fields': ('name', 'storage', 'notes')
        }),
        ("Hosts", {
            'fields': ('hosts',),
            'description': 'All hosts in this cluster will share the same volumes'
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed', 'deployed', 'created_by_project')
        }),
        ("Audit Information", {
            'fields': ('last_modified_by', 'last_modified_at', 'version', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def host_count(self, obj):
        return obj.host_count
    host_count.short_description = "Hosts"

    def volume_count(self, obj):
        return obj.volume_count
    volume_count.short_description = "Volumes"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('storage', 'storage__customer').prefetch_related('hosts')


@admin.register(IBMiLPAR)
class IBMiLPARAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "storage",
        "host_count",
        "volume_count",
        "committed",
        "deployed",
        "created_at",
    )
    search_fields = ("name", "storage__name", "notes")
    list_filter = ("storage", "committed", "deployed")
    raw_id_fields = ("storage", "created_by_project", "last_modified_by")
    filter_horizontal = ("hosts",)
    readonly_fields = ("created_at", "updated_at", "last_modified_at")

    fieldsets = (
        ("Basic Information", {
            'fields': ('name', 'storage', 'notes')
        }),
        ("Hosts", {
            'fields': ('hosts',),
            'description': 'Volumes will be distributed evenly across these hosts (LSS-aware for DS8000)'
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed', 'deployed', 'created_by_project')
        }),
        ("Audit Information", {
            'fields': ('last_modified_by', 'last_modified_at', 'version', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def host_count(self, obj):
        return obj.host_count
    host_count.short_description = "Hosts"

    def volume_count(self, obj):
        return obj.volume_count
    volume_count.short_description = "Volumes"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('storage', 'storage__customer').prefetch_related('hosts')


@admin.register(VolumeMapping)
class VolumeMappingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "volume",
        "target_type",
        "target_name",
        "assigned_host",
        "lun_id",
        "committed",
        "deployed",
        "created_at",
    )
    search_fields = ("volume__name", "volume__volume_id", "target_host__name", "target_cluster__name", "target_lpar__name")
    list_filter = ("target_type", "committed", "deployed", "volume__storage")
    raw_id_fields = ("volume", "target_host", "target_cluster", "target_lpar", "assigned_host", "created_by_project", "last_modified_by")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Volume", {
            'fields': ('volume',)
        }),
        ("Target", {
            'fields': ('target_type', 'target_host', 'target_cluster', 'target_lpar'),
            'description': 'Set only ONE target based on target_type'
        }),
        ("LPAR Assignment", {
            'fields': ('assigned_host',),
            'description': 'For LPAR targets: the specific host this volume was assigned to',
            'classes': ('collapse',)
        }),
        ("Configuration", {
            'fields': ('lun_id',)
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed', 'deployed', 'created_by_project')
        }),
        ("Audit Information", {
            'fields': ('last_modified_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def target_name(self, obj):
        return obj.get_target_name()
    target_name.short_description = "Target"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'volume', 'volume__storage',
            'target_host', 'target_cluster', 'target_lpar',
            'assigned_host'
        )


@admin.register(PPRCPath)
class PPRCPathAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "port1_display",
        "port2_display",
        "is_same_storage",
        "committed",
        "deployed",
        "created_at",
    )
    search_fields = (
        "port1__name", "port1__wwpn", "port1__storage__name",
        "port2__name", "port2__wwpn", "port2__storage__name",
    )
    list_filter = ("committed", "deployed", "port1__storage", "port2__storage")
    raw_id_fields = ("port1", "port2", "created_by_project", "last_modified_by")
    readonly_fields = ("created_at", "updated_at", "last_modified_at")

    fieldsets = (
        ("Port Connections", {
            'fields': ('port1', 'port2'),
            'description': 'Select two FC ports to create a PPRC path between them'
        }),
        ("Notes", {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ("Lifecycle Tracking", {
            'fields': ('committed', 'deployed', 'created_by_project')
        }),
        ("Audit Information", {
            'fields': ('last_modified_by', 'last_modified_at', 'version', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def port1_display(self, obj):
        if obj.port1:
            return f"{obj.port1.storage.name}: {obj.port1.name}"
        return "-"
    port1_display.short_description = "Port 1"
    port1_display.admin_order_field = "port1__storage__name"

    def port2_display(self, obj):
        if obj.port2:
            return f"{obj.port2.storage.name}: {obj.port2.name}"
        return "-"
    port2_display.short_description = "Port 2"
    port2_display.admin_order_field = "port2__storage__name"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'port1', 'port1__storage',
            'port2', 'port2__storage',
            'created_by_project', 'last_modified_by'
        )