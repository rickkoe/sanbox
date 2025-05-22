from django.urls import path
from .views import storage_list, storage_detail
from .views import storage_insights_auth, storage_insights_systems, storage_insights_volumes

urlpatterns = [
    path("", storage_list, name="storage-list"),
    path("<int:pk>/", storage_detail, name="storage-detail"),
    path("insights/auth/", storage_insights_auth, name="storage-insights-auth"),
    path("insights/storage-systems/", storage_insights_systems, name="storage-insights-systems"),
    path("insights/volumes/", storage_insights_volumes, name="storage-insights-volumes"),
]