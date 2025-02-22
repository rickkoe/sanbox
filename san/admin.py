from django.contrib import admin
from .models import Fabric, Alias, Zone, ZoneGroup

# Register your models here.
admin.site.register(Alias)
admin.site.register(Fabric)
admin.site.register(ZoneGroup)
admin.site.register(Zone)
