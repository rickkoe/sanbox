from django.urls import path
from .views import storage_list, storage_detail

urlpatterns = [
    path("", storage_list, name="storage-list"),
    path("<int:pk>/", storage_detail, name="storage-detail"),
]