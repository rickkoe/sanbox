from django.urls import path
from .views import index

app_name = 'san'

urlpatterns = [
    path('', index, name='index'),  # Handles "/san/"
]