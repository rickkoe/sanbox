from django.urls import path
from .views import FabricsForCustomerView, FabricsByCustomerView, SaveFabricsView
from .views import AliasListView, SaveAliasesView, ZonesByProjectView, SaveZonesView, DeleteFabricView
urlpatterns = [
    path("aliases/project/<int:project_id>/", AliasListView.as_view(), name="alias-list"),
    path("aliases/save/", SaveAliasesView.as_view(), name="save-aliases"),

    path("zones/project/<int:project_id>/", ZonesByProjectView.as_view(), name="zones-by-project"),
    path("zones/save/", SaveZonesView.as_view(), name="save-zones"),

    path("fabrics/customer/", FabricsForCustomerView.as_view(), name="fabrics-for-customer"),  
    path("fabrics/customer/<int:customer_id>/", FabricsByCustomerView.as_view(), name="fabrics-by-customer"),
    path("fabrics/save/", SaveFabricsView.as_view(), name="save-fabrics"),
    path("fabrics/delete/<int:pk>/", DeleteFabricView.as_view(), name="delete-fabric"),
]