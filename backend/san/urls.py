from django.urls import path
from .views import (
    alias_copy_to_project_view,
    fabric_management,
    fabric_delete_view,
    generate_alias_scripts,
    generate_zone_scripts,
    alias_list_view,
    alias_save_view,
    zones_by_project_view,
    zone_save_view,
    alias_delete_view,
    zone_delete_view,
    alias_by_fabric_view,
    wwpn_prefix_list_view,
    wwpn_prefix_detail_view,
    wwpn_detect_type_view
)

urlpatterns = [
    path("aliases/project/<int:project_id>/", alias_list_view, name="alias-list"),
    path("aliases/save/", alias_save_view, name="save-aliases"),
    path("aliases/delete/<int:pk>/", alias_delete_view, name="alias-delete"),
    path("alias-scripts/<int:project_id>/", generate_alias_scripts, name="alias-scripts"),
    path("aliases/fabric/<int:fabric_id>/", alias_by_fabric_view, name="aliases-by-fabric"),
    path("aliases/copy-to-project/", alias_copy_to_project_view, name="copy-aliases-to-project"),
    path("zones/project/<int:project_id>/", zones_by_project_view, name="zones-by-project"),
    path("zones/save/", zone_save_view, name="save-zones"),
    path("zone-scripts/<int:project_id>/", generate_zone_scripts, name="zone-scripts"),
    path("zones/delete/<int:pk>/", zone_delete_view, name="zone-delete"),
    # Unified fabric management endpoints
    path("fabrics/", fabric_management, name="fabric-list"),
    path("fabrics/<int:pk>/", fabric_management, name="fabric-detail"),
    path("fabrics/delete/<int:pk>/", fabric_delete_view, name="fabric-delete"),
    
    # WWPN Prefix management endpoints
    path("wwpn-prefixes/", wwpn_prefix_list_view, name="wwpn-prefix-list"),
    path("wwpn-prefixes/<int:pk>/", wwpn_prefix_detail_view, name="wwpn-prefix-detail"),
    path("wwpn-prefixes/detect-type/", wwpn_detect_type_view, name="wwpn-detect-type"),
]