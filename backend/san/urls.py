from django.urls import path
from .views import alias_list, alias_update, zone_list, zone_update, fabric_list, fabric_update, fabrics_for_config_project

urlpatterns = [
    path("aliases/", alias_list, name="alias-list"),
    path("aliases/<int:pk>/", alias_update, name="alias-update"),
    path("zones/", zone_list, name="zone-list"),
    path("zones/<int:pk>/", zone_update, name="zone-update"),
    path("zones/", zone_list, name="zone-list"),
    path("zones/<int:pk>/", zone_update, name="zone-update"),
    path("fabrics/", fabric_list, name="fabric-list"),
    path("fabrics/<int:pk>/", fabric_update, name="fabric-update"),
    path("fabrics/config/", fabrics_for_config_project, name="fabrics-for-config-project"),  # ✅ New API endpoint
]