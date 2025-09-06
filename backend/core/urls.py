from django.urls import path
from .views import (
    config_viewset,
    config_detail, 
    projects_for_customer, 
    active_config_view, 
    config_for_customer, 
    create_project_for_customer, 
    update_project,
    delete_project,
    update_config_view,
    customer_list,
    dashboard_overview,
    customer_statistics,
    table_configuration_list,
    table_configuration_detail,
    reset_table_configuration,
    app_settings_view,
    debug_log_view,
)
from .dashboard_views import dashboard_stats, clear_dashboard_cache

urlpatterns = [
    path("config/", config_detail, name="config-detail"),  # Function-based view
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),  # Get projects by customer
    path("active-config/", active_config_view, name="active-config"), 
    path("config/customer/<int:customer_id>/", config_for_customer, name="config-for-customer"),
    path("config/update/<int:customer_id>/", update_config_view, name="update-config"),
    path('projects/', create_project_for_customer, name='create_project_for_customer'),
    path('projects/update/<int:project_id>/', update_project, name='update_project'),
    path('projects/delete/<int:project_id>/', delete_project, name='delete_project'),
    path("customers/", customer_list, name="customer-list"),  # Added customer list endpoint
    
    # Config CRUD endpoints (replacing the DRF router)
    path("configs/", config_viewset, name="config-list"),
    path("configs/<int:pk>/", config_viewset, name="config-detail-pk"),

    # Add these to your existing core/urls.py urlpatterns:
    path("dashboard/overview/", dashboard_overview, name="dashboard-overview"),
    path("customers/<int:customer_id>/statistics/", customer_statistics, name="customer-statistics"),
    
    # Optimized dashboard endpoints
    path("dashboard/stats/", dashboard_stats, name="dashboard-stats"),
    path("dashboard/cache/clear/", clear_dashboard_cache, name="clear-dashboard-cache"),
    
    # Table Configuration endpoints
    path("table-config/", table_configuration_list, name="table-config-list"),
    path("table-config/<int:pk>/", table_configuration_detail, name="table-config-detail"),
    path("table-config/reset/", reset_table_configuration, name="table-config-reset"),
    
    # App Settings endpoints
    path("settings/", app_settings_view, name="app-settings"),
    
    # Debug logging endpoint
    path("debug-log/", debug_log_view, name="debug-log"),
]