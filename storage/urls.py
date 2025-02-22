from django.urls import path
from .views import index

app_name = 'storage'

urlpatterns = [
    path('', index, name='index'),  # Handles "/storage/"
]