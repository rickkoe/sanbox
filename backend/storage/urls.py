from django.urls import path
from .views import storage_list, storage_update

urlpatterns = [
    path("storages/", storage_list, name="storage-list"),
    path("storages/<int:pk>/", storage_update, name="storage-update"),
]