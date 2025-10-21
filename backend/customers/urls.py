from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import customer_management, customer_delete, ContactInfoViewSet
from core.views import projects_for_customer

# Create router for ViewSets
router = DefaultRouter()
router.register(r'contact-info', ContactInfoViewSet, basename='contact-info')

urlpatterns = [
    path("", customer_management, name="customer-list"),
    path("<int:pk>/", customer_management, name="customer-detail"),
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),
    path("delete/<int:pk>/", customer_delete, name="customer-delete"),

    # Include router URLs
    path('', include(router.urls)),
]