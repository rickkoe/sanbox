from django.contrib import admin
from .models import Fabric, Alias, Zone, ZoneGroup

# Register your models here.
admin.site.register(Alias)
admin.site.register(ZoneGroup)
admin.site.register(Zone)

@admin.register(Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = ["name", "customer", "zoneset_name", "vsan"]
    list_filter = ["customer"]
    search_fields = ["customer__name"]

