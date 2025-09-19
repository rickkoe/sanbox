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
    dashboard_stats,
    capacity_analytics,
    system_health,
    clear_dashboard_cache,
    activity_feed,
    table_configuration_list,
    table_configuration_detail,
    reset_table_configuration,
    app_settings_view,
    debug_log_view,
    custom_naming_rules_list,
    custom_naming_rule_detail,
    custom_variables_list,
    custom_variable_detail,
    table_columns_list,
)

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

    # Dashboard endpoints
    path("dashboard/overview/", dashboard_overview, name="dashboard-overview"),
    path("dashboard/stats/", dashboard_stats, name="dashboard-stats"),
    path("dashboard/capacity/", capacity_analytics, name="capacity-analytics"),
    path("dashboard/health/", system_health, name="system-health"),
    path("dashboard/activity/", activity_feed, name="activity-feed"),
    path("dashboard/cache/clear/", clear_dashboard_cache, name="clear-dashboard-cache"),
    path("customers/<int:customer_id>/statistics/", customer_statistics, name="customer-statistics"),
    
    # Table Configuration endpoints
    path("table-config/", table_configuration_list, name="table-config-list"),
    path("table-config/<int:pk>/", table_configuration_detail, name="table-config-detail"),
    path("table-config/reset/", reset_table_configuration, name="table-config-reset"),
    
    # App Settings endpoints
    path("settings/", app_settings_view, name="app-settings"),
    
    # Debug logging endpoint
    path("debug-log/", debug_log_view, name="debug-log"),
    
    # Custom Naming endpoints
    path("custom-naming-rules/", custom_naming_rules_list, name="custom-naming-rules-list"),
    path("custom-naming-rules/<int:pk>/", custom_naming_rule_detail, name="custom-naming-rule-detail"),
    path("custom-variables/", custom_variables_list, name="custom-variables-list"),
    path("custom-variables/<int:pk>/", custom_variable_detail, name="custom-variable-detail"),
    path("table-columns/", table_columns_list, name="table-columns-list"),
]