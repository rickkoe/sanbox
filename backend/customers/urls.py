from django.urls import path
from .views import customer_list, customer_update, customer_create, customer_delete
from core.views import projects_for_customer

urlpatterns = [
    path("", customer_list, name="customer-list"),
    path("<int:pk>/", customer_update, name="customer-update"),
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),
    path("create/", customer_create, name="create-customer"),
    path("delete/<int:pk>", customer_delete, name="customer-delete"),
]