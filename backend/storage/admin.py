from django.contrib import admin
from .models import Storage, Host


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