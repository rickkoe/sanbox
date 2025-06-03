from django.urls import path
from .views import (
    fabric_management,
    FabricDeleteView,
    generate_alias_scripts,
    generate_zone_scripts,
    AliasListView,
    AliasSaveView,
    ZonesByProjectView,
    ZoneSaveView,
    AliasDeleteView,
    ZoneDeleteView,
    AliasByFabricView
)
urlpatterns = [
    path("aliases/project/<int:project_id>/", AliasListView.as_view(), name="alias-list"),
    path("aliases/save/", AliasSaveView.as_view(), name="save-aliases"),
    path("aliases/delete/<int:pk>/", AliasDeleteView.as_view(), name="alias-delete"),
    path("alias-scripts/<int:project_id>/", generate_alias_scripts, name="alias-scripts"),
    path("aliases/fabric/<int:fabric_id>/", AliasByFabricView.as_view(), name="aliases-by-fabric"),

    path("zones/project/<int:project_id>/", ZonesByProjectView.as_view(), name="zones-by-project"),
    path("zones/save/", ZoneSaveView.as_view(), name="save-zones"),
    path("zone-scripts/<int:project_id>/", generate_zone_scripts, name="zone-scripts"),
    path("zones/delete/<int:pk>/", ZoneDeleteView.as_view(), name="zone-delete"),

    # Unified fabric management endpoints
    path("fabrics/", fabric_management, name="fabric-list"),
    path("fabrics/<int:pk>/", fabric_management, name="fabric-detail"),
    path("fabrics/delete/<int:pk>/", FabricDeleteView.as_view(), name="fabric-delete"),
]