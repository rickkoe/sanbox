from django.urls import path
from .views import customer_management, customer_delete
from core.views import projects_for_customer

urlpatterns = [
    path("", customer_management, name="customer-list"),
    path("<int:pk>/", customer_management, name="customer-detail"),
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),
    path("delete/<int:pk>/", customer_delete, name="customer-delete"),
]