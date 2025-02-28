from django.urls import path
from .views import customer_list, customer_update

urlpatterns = [
    path("", customer_list, name="customer-list"),
    path("<int:pk>/", customer_update, name="customer-update"),
]