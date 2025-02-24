from django.urls import path
from .views import index, aliases, create_aliases, zones

app_name = 'san'

urlpatterns = [
    path('', index, name='index'),
    path('aliases', aliases, name='aliases'),
    path('zones', zones, name='zones'),
    path('create_aliases', create_aliases, name='create_aliases')
]