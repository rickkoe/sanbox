from django.urls import path
from .views import customer_list

urlpatterns = [
    path("", customer_list, name="customer-list"),  # API available at /api/customers/
]