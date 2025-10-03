from django.urls import path
from .views import (
    alias_copy_to_project_view,
    fabric_management,
    fabric_delete_view,
    generate_zone_scripts,
    generate_zone_creation_scripts,
    generate_zone_deletion_scripts,
    alias_list_view,
    alias_save_view,
    hosts_by_project_view,
    host_save_view,
    host_delete_view,
    assign_host_to_alias_view,
    host_wwpn_reconciliation_view,
    zones_by_project_view,
    zone_max_members_view,
    zone_column_requirements,
    zone_save_view,
    alias_delete_view,
    zone_delete_view,
    alias_by_fabric_view,
    wwpn_prefix_list_view,
    wwpn_prefix_detail_view,
    wwpn_detect_type_view,
    bulk_update_alias_boolean,
    bulk_update_zone_boolean,
    bulk_update_zones_create,
    bulk_update_aliases_create,
    bulk_update_hosts_create
)

urlpatterns = [
    path("aliases/project/<int:project_id>/", alias_list_view, name="alias-list"),
    path("aliases/save/", alias_save_view, name="save-aliases"),
    path("aliases/delete/<int:pk>/", alias_delete_view, name="alias-delete"),
    path("hosts/project/<int:project_id>/", hosts_by_project_view, name="hosts-by-project"),
    path("hosts/save/", host_save_view, name="save-host"),
    path("hosts/delete/<int:pk>/", host_delete_view, name="delete-host"),
    path("hosts/<int:host_id>/wwpn-reconciliation/", host_wwpn_reconciliation_view, name="host-wwpn-reconciliation"),
    path("assign-host-to-alias/", assign_host_to_alias_view, name="assign-host-to-alias"),
    path("aliases/fabric/<int:fabric_id>/", alias_by_fabric_view, name="aliases-by-fabric"),
    path("aliases/copy-to-project/", alias_copy_to_project_view, name="copy-aliases-to-project"),
    path("zones/project/<int:project_id>/", zones_by_project_view, name="zones-by-project"),
    path("zones/project/<int:project_id>/max-members/", zone_max_members_view, name="zone-max-members"),
    path("zones/project/<int:project_id>/column-requirements/", zone_column_requirements, name="zone-column-requirements"),
    path("zones/save/", zone_save_view, name="save-zones"),
    path("zone-scripts/<int:project_id>/", generate_zone_scripts, name="zone-scripts"),
    path("zone-creation-scripts/<int:project_id>/", generate_zone_creation_scripts, name="zone-creation-scripts"),
    path("zone-deletion-scripts/<int:project_id>/", generate_zone_deletion_scripts, name="zone-deletion-scripts"),
    path("zones/delete/<int:pk>/", zone_delete_view, name="zone-delete"),
    # Unified fabric management endpoints
    path("fabrics/", fabric_management, name="fabric-list"),
    path("fabrics/<int:pk>/", fabric_management, name="fabric-detail"),
    path("fabrics/delete/<int:pk>/", fabric_delete_view, name="fabric-delete"),
    
    # WWPN Prefix management endpoints
    path("wwpn-prefixes/", wwpn_prefix_list_view, name="wwpn-prefix-list"),
    path("wwpn-prefixes/<int:pk>/", wwpn_prefix_detail_view, name="wwpn-prefix-detail"),
    path("wwpn-prefixes/detect-type/", wwpn_detect_type_view, name="wwpn-detect-type"),
    
    # Bulk boolean update endpoints
    path("aliases/project/<int:project_id>/bulk-boolean/", bulk_update_alias_boolean, name="bulk-update-alias-boolean"),
    path("zones/project/<int:project_id>/bulk-boolean/", bulk_update_zone_boolean, name="bulk-update-zone-boolean"),

    # Bulk create settings update endpoints
    path("zones/bulk-update-create/", bulk_update_zones_create, name="bulk-update-zones-create"),
    path("aliases/bulk-update-create/", bulk_update_aliases_create, name="bulk-update-aliases-create"),
    path("hosts/bulk-update-create/", bulk_update_hosts_create, name="bulk-update-hosts-create"),
]