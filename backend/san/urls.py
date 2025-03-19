from django.urls import path
from .views import alias_list, alias_update, zone_list, zone_update, fabric_list, fabric_update, fabrics_for_customer, aliases_for_project, zones_for_project, FabricsByCustomerView, SaveFabricsView
from .views import AliasListView, SaveAliasesView, ZonesByProjectView, SaveZonesView
urlpatterns = [
    path("aliases/", alias_list, name="alias-list"),
    path("aliases/<int:pk>/", alias_update, name="alias-update"),
    path("zones/", zone_list, name="zone-list"),
    path("zones/<int:pk>/", zone_update, name="zone-update"),
    path("zones/", zone_list, name="zone-list"),
    path("zones/<int:pk>/", zone_update, name="zone-update"),
    path("fabrics/", fabric_list, name="fabric-list"),
    path("fabrics/<int:pk>/", fabric_update, name="fabric-update"),
    path("aliases/project/", aliases_for_project, name="aliases-for-project"),  # ✅ New API endpoint
    path("fabrics/customer/", fabrics_for_customer, name="fabrics-for-customer"),  
    path("zones/project/", zones_for_project, name="zones-for-project"),
    path("fabrics/customer/<int:customer_id>/", FabricsByCustomerView.as_view(), name="fabrics-by-customer"),
    path("fabrics/save/", SaveFabricsView.as_view(), name="save-fabrics"),
    path("aliases/project/<int:project_id>/", AliasListView.as_view(), name="alias-list"),
    path("aliases/save/", SaveAliasesView.as_view(), name="save-aliases"),
    path("zones/project/<int:project_id>/", ZonesByProjectView.as_view(), name="zones-by-project"),
    path("zones/save/", SaveZonesView.as_view(), name="save-zones"),
]