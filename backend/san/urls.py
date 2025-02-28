from django.urls import path
from .views import alias_list, alias_update

urlpatterns = [
    path("aliases/", alias_list, name="alias-list"),
    path("aliases/<int:pk>/", alias_update, name="alias-update"),
]