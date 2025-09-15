from django.urls import path
from .views import (
    storage_list, 
    storage_detail, 
    volume_list,
    host_list,
    storage_insights_auth, 
    storage_insights_systems, 
    storage_insights_volumes,
    storage_insights_host_connections,
    mkhost_scripts_view,
    host_wwpns_view,
    check_wwpn_conflicts_view
)

urlpatterns = [
    path("", storage_list, name="storage-list"),
    path("<int:pk>/", storage_detail, name="storage-detail"),
    path("insights/auth/", storage_insights_auth, name="storage-insights-auth"),
    path("insights/storage-systems/", storage_insights_systems, name="storage-insights-systems"),
    path("insights/volumes/", storage_insights_volumes, name="storage-insights-volumes"),
    path("insights/host-connections/", storage_insights_host_connections, name="storage-insights-host-connections"),
    path("volumes/", volume_list, name="volume_list"),
    path("hosts/", host_list, name="host_list"),
    path("hosts/<int:host_id>/wwpns/", host_wwpns_view, name="host-wwpns"),
    path("check-wwpn-conflicts/", check_wwpn_conflicts_view, name="check-wwpn-conflicts"),
    path("mkhost-scripts/<int:customer_id>/", mkhost_scripts_view, name="mkhost-scripts"),
]