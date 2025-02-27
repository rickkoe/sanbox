from django.urls import path
from .views import index, aliases, create_aliases, zones, save_aliases, alias_data, fabrics_data

app_name = 'san'

urlpatterns = [
    path('', index, name='index'),
    path('aliases/', aliases, name='aliases'),
    path('save_aliases/', save_aliases, name='save_aliases'),
    path('zones/', zones, name='zones'),
    path('create_aliases/', create_aliases, name='create_aliases'),
    path('alias_data/', alias_data, name='alias_data'),
    path('fabrics_data/', fabrics_data, name='fabrics_data'),
]