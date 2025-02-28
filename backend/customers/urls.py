from django.urls import path
from .views import customer_list

urlpatterns = [
    path('api/customers/', customer_list, name='customer-list'),
]