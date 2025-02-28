from django.urls import path
from .views import customer_list

app_name = 'customers'


urlpatterns = [
    path('api/customers/', customer_list, name='customer-list'),
]