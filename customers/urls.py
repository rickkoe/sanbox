from django.urls import path
from .views import landing_page

app_name = 'customers'

urlpatterns = [
    path('', landing_page, name='customers_landing'),  # Handles "/customers/"
]