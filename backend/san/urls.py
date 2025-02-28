from django.urls import path
from .views import alias_list, alias_update, zone_list, zone_update

urlpatterns = [
    path("aliases/", alias_list, name="alias-list"),
    path("aliases/<int:pk>/", alias_update, name="alias-update"),
    path("zones/", zone_list, name="zone-list"),
    path("zones/<int:pk>/", zone_update, name="zone-update"),
]