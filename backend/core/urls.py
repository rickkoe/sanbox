from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConfigViewSet, config_detail, projects_for_customer, ActiveConfigView, config_for_customer, update_config, create_project_for_customer

# ✅ Register ConfigViewSet for DRF API access
router = DefaultRouter()
router.register(r'configs', ConfigViewSet, basename='config')

urlpatterns = [
    path("config/", config_detail, name="config-detail"),  # ✅ Function-based view
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),  # ✅ Get projects by customer
    path("", include(router.urls)),  # ✅ DRF API for Config (configs/)
    path("active-config/", ActiveConfigView.as_view(), name="active-config"), 
    path("config/customer/<int:customer_id>/", config_for_customer, name="config-for-customer"),
    path("config/update/<int:customer_id>/", update_config, name="update-config"),
    path('projects/', create_project_for_customer, name='create_project_for_customer'),
]