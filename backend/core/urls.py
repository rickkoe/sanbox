from django.urls import path
from .views import config_detail

urlpatterns = [
    path("config/", config_detail, name="config-detail"),  # ✅ Single object API
]