from django.urls import path
from .views import config_detail, projects_for_customer

urlpatterns = [
    path("config/", config_detail, name="config-detail"),  # ✅ Single Config API
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),  # ✅ Get projects by customer
]