from django.urls import path
from .views import storage_list, storage_update

urlpatterns = [
    path("", storage_list, name="storage-list"),
    path("<int:pk>/", storage_update, name="storage-update"),
]