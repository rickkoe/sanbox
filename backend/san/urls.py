from django.urls import path
from .views import FabricsForCustomerView, FabricsByCustomerView, FabricSaveView
from .views import AliasListView, AliasSaveView, ZonesByProjectView, ZoneSaveView, FabricDeleteView, AliasDeleteView
urlpatterns = [
    path("aliases/project/<int:project_id>/", AliasListView.as_view(), name="alias-list"),
    path("aliases/save/", AliasSaveView.as_view(), name="save-aliases"),
    path("aliases/delete/<int:pk>/", AliasDeleteView.as_view(), name="alias-delete"),

    path("zones/project/<int:project_id>/", ZonesByProjectView.as_view(), name="zones-by-project"),
    path("zones/save/", ZoneSaveView.as_view(), name="save-zones"),

    path("fabrics/customer/", FabricsForCustomerView.as_view(), name="fabrics-for-customer"),  
    path("fabrics/customer/<int:customer_id>/", FabricsByCustomerView.as_view(), name="fabrics-by-customer"),
    path("fabrics/save/", FabricSaveView.as_view(), name="save-fabrics"),
    path("fabrics/delete/<int:pk>/", FabricDeleteView.as_view(), name="fabric-delete"),
]