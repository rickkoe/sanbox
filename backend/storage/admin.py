from django.contrib import admin
from .models import Storage, Host
from .models import Volume


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