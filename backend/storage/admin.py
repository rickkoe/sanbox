from django.contrib import admin
from .models import Storage, Host
from .models import Volume
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


@admin.register(Volume)
class VolumeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "volume_id",
        "format",
        "pool_name",
        "capacity_bytes",
        "used_capacity_percent",
        "storage",
    )
    search_fields = ("name", "volume_id", "unique_id", "storage__name")
    list_filter = ("format", "pool_name", "storage")


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