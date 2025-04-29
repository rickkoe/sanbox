from django.urls import path
from .views import FabricsForCustomerView, FabricsByCustomerView, FabricSaveView, generate_alias_scripts, generate_zone_scripts
from .views import AliasListView, AliasSaveView, ZonesByProjectView, ZoneSaveView, FabricDeleteView, AliasDeleteView, ZoneDeleteView
urlpatterns = [
    path("aliases/project/<int:project_id>/", AliasListView.as_view(), name="alias-list"),
    path("aliases/save/", AliasSaveView.as_view(), name="save-aliases"),
    path("aliases/delete/<int:pk>/", AliasDeleteView.as_view(), name="alias-delete"),
    path('alias-scripts/<int:project_id>/', generate_alias_scripts, name='alias-scripts'),

    path("zones/project/<int:project_id>/", ZonesByProjectView.as_view(), name="zones-by-project"),
    path("zones/save/", ZoneSaveView.as_view(), name="save-zones"),
    path('zone-scripts/<int:project_id>/', generate_zone_scripts, name='zone-scripts'),
    path("zones/delete/<int:pk>/", ZoneDeleteView.as_view(), name="alias-delete"),


    path("fabrics/customer/", FabricsForCustomerView.as_view(), name="fabrics-for-customer"),  
    path("fabrics/customer/<int:customer_id>/", FabricsByCustomerView.as_view(), name="fabrics-by-customer"),
    path("fabrics/save/", FabricSaveView.as_view(), name="save-fabrics"),
    path("fabrics/delete/<int:pk>/", FabricDeleteView.as_view(), name="fabric-delete"),
    
]