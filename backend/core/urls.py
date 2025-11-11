from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    config_viewset,
    config_detail,
    projects_for_customer,
    active_config_view,
    user_config_view,
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
    user_detail,
    user_change_password,
    customer_add_member,
    active_users_view,
    heartbeat_view,
    audit_log_list,
    audit_log_purge,
    project_summary_view,
    commit_project_view,
    close_project_view,
)
# Removed: users_list, user_customer_memberships, customer_memberships_list, customer_invite_user,
#          customer_membership_detail, project_groups_list, project_group_detail,
#          project_group_members, project_group_member_remove

# Import new dashboard views
from .dashboard_views import (
    DashboardLayoutView, DashboardWidgetView, widget_types_view,
    dashboard_themes_view, dashboard_presets_view, DashboardPresetApplyView,
    DashboardTemplateSaveView,
    # Widget data endpoints
    widget_san_overview, widget_zone_deployment, widget_alias_distribution,
    widget_storage_inventory, widget_host_connectivity, widget_import_activity,
    widget_backup_health, widget_wwpn_inventory, widget_project_activity,
    widget_storage_capacity
)

# Import worksheet views
from .worksheet_views import (
    EquipmentTypeViewSet,
    WorksheetTemplateViewSet
)

# Import project management views
from .project_views import (
    project_add_alias, project_remove_alias, mark_alias_deletion, unmark_alias_deletion,
    project_add_zone, project_remove_zone, mark_zone_deletion, unmark_zone_deletion,
    project_add_switch, project_remove_switch, mark_switch_deletion, unmark_switch_deletion,
    project_add_fabric, project_remove_fabric, mark_fabric_deletion, unmark_fabric_deletion,
    project_add_storage, project_remove_storage, mark_storage_deletion, unmark_storage_deletion,
    project_add_volume, project_remove_volume, mark_volume_deletion, unmark_volume_deletion,
    project_add_host, project_remove_host, mark_host_deletion, unmark_host_deletion,
    project_add_port, project_remove_port, mark_port_deletion, unmark_port_deletion,
    project_finalize, project_close,
    project_commit, project_commit_deletions, project_commit_and_close,
    project_conflicts, project_summary,
    project_commit_preview, project_commit_execute
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r'equipment-types', EquipmentTypeViewSet, basename='equipment-type')
router.register(r'worksheet-templates', WorksheetTemplateViewSet, basename='worksheet-template')

urlpatterns = [
    path("config/", config_detail, name="config-detail"),  # Function-based view
    path("projects/<int:customer_id>/", projects_for_customer, name="projects-for-customer"),  # Get projects by customer
    path("active-config/", active_config_view, name="active-config"),  # DEPRECATED - use user-config instead
    path("user-config/", user_config_view, name="user-config"),  # NEW: Per-user active config
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

    # User Management endpoints (membership endpoints removed)
    path("users/<int:user_id>/", user_detail, name="user-detail"),
    path("users/<int:user_id>/change-password/", user_change_password, name="user-change-password"),
    path("customers/<int:customer_id>/add-member/", customer_add_member, name="customer-add-member"),

    # Project Groups endpoints removed - groups no longer exist

    # User Presence and Activity endpoints
    path("active-users/", active_users_view, name="active-users"),
    path("heartbeat/", heartbeat_view, name="heartbeat"),

    # ========== AUDIT LOG ENDPOINTS ==========
    path("audit-log/", audit_log_list, name="audit-log-list"),
    path("audit-log/purge/", audit_log_purge, name="audit-log-purge"),

    # ========== PROJECT MANAGEMENT ENDPOINTS ==========
    path("projects/<int:project_id>/add-alias/", project_add_alias, name="project-add-alias"),
    path("projects/<int:project_id>/mark-alias-deletion/", mark_alias_deletion, name="mark-alias-deletion"),
    path("projects/<int:project_id>/unmark-alias-deletion/", unmark_alias_deletion, name="unmark-alias-deletion"),
    path("projects/<int:project_id>/remove-alias/<int:alias_id>/", project_remove_alias, name="project-remove-alias"),
    path("projects/<int:project_id>/add-zone/", project_add_zone, name="project-add-zone"),
    path("projects/<int:project_id>/mark-zone-deletion/", mark_zone_deletion, name="mark-zone-deletion"),
    path("projects/<int:project_id>/unmark-zone-deletion/", unmark_zone_deletion, name="unmark-zone-deletion"),
    path("projects/<int:project_id>/remove-zone/<int:zone_id>/", project_remove_zone, name="project-remove-zone"),
    path("projects/<int:project_id>/add-switch/", project_add_switch, name="project-add-switch"),
    path("projects/<int:project_id>/mark-switch-deletion/", mark_switch_deletion, name="mark-switch-deletion"),
    path("projects/<int:project_id>/unmark-switch-deletion/", unmark_switch_deletion, name="unmark-switch-deletion"),
    path("projects/<int:project_id>/remove-switch/<int:switch_id>/", project_remove_switch, name="project-remove-switch"),
    path("projects/<int:project_id>/add-fabric/", project_add_fabric, name="project-add-fabric"),
    path("projects/<int:project_id>/mark-fabric-deletion/", mark_fabric_deletion, name="mark-fabric-deletion"),
    path("projects/<int:project_id>/unmark-fabric-deletion/", unmark_fabric_deletion, name="unmark-fabric-deletion"),
    path("projects/<int:project_id>/remove-fabric/<int:fabric_id>/", project_remove_fabric, name="project-remove-fabric"),
    path("projects/<int:project_id>/add-storage/", project_add_storage, name="project-add-storage"),
    path("projects/<int:project_id>/mark-storage-deletion/", mark_storage_deletion, name="mark-storage-deletion"),
    path("projects/<int:project_id>/unmark-storage-deletion/", unmark_storage_deletion, name="unmark-storage-deletion"),
    path("projects/<int:project_id>/remove-storage/<int:storage_id>/", project_remove_storage, name="project-remove-storage"),
    path("projects/<int:project_id>/add-volume/", project_add_volume, name="project-add-volume"),
    path("projects/<int:project_id>/mark-volume-deletion/", mark_volume_deletion, name="mark-volume-deletion"),
    path("projects/<int:project_id>/unmark-volume-deletion/", unmark_volume_deletion, name="unmark-volume-deletion"),
    path("projects/<int:project_id>/remove-volume/<int:volume_id>/", project_remove_volume, name="project-remove-volume"),
    path("projects/<int:project_id>/add-host/", project_add_host, name="project-add-host"),
    path("projects/<int:project_id>/mark-host-deletion/", mark_host_deletion, name="mark-host-deletion"),
    path("projects/<int:project_id>/unmark-host-deletion/", unmark_host_deletion, name="unmark-host-deletion"),
    path("projects/<int:project_id>/remove-host/<int:host_id>/", project_remove_host, name="project-remove-host"),
    path("projects/<int:project_id>/add-port/", project_add_port, name="project-add-port"),
    path("projects/<int:project_id>/mark-port-deletion/", mark_port_deletion, name="mark-port-deletion"),
    path("projects/<int:project_id>/unmark-port-deletion/", unmark_port_deletion, name="unmark-port-deletion"),
    path("projects/<int:project_id>/remove-port/<int:port_id>/", project_remove_port, name="project-remove-port"),
    path("projects/<int:project_id>/finalize/", project_finalize, name="project-finalize"),
    path("projects/<int:project_id>/close/", close_project_view, name="project-close"),
    path("projects/<int:project_id>/commit/", commit_project_view, name="project-commit"),
    path("projects/<int:project_id>/commit-deletions/", project_commit_deletions, name="project-commit-deletions"),
    path("projects/<int:project_id>/commit-and-close/", project_commit_and_close, name="project-commit-and-close"),
    path("projects/<int:project_id>/conflicts/", project_conflicts, name="project-conflicts"),
    path("projects/<int:project_id>/summary/", project_summary_view, name="project-summary"),
    path("projects/<int:project_id>/commit-preview/", project_commit_preview, name="project-commit-preview"),
    path("projects/<int:project_id>/commit-execute/", project_commit_execute, name="project-commit-execute"),

    # ========== CUSTOMIZABLE DASHBOARD ENDPOINTS ==========
    # Dashboard Layout Management
    path("dashboard-v2/layout/", DashboardLayoutView.as_view(), name="dashboard-layout"),
    
    # Widget Management
    path("dashboard-v2/widgets/", DashboardWidgetView.as_view(), name="dashboard-widgets"),
    path("dashboard-v2/widgets/<int:widget_id>/", DashboardWidgetView.as_view(), name="dashboard-widget-detail"),
    
    # Widget Types and Configuration
    path("dashboard-v2/widget-types/", widget_types_view, name="widget-types"),
    
    # Themes and Presets
    path("dashboard-v2/themes/", dashboard_themes_view, name="dashboard-themes"),
    path("dashboard-v2/presets/", dashboard_presets_view, name="dashboard-presets"),
    path("dashboard-v2/presets/apply/", DashboardPresetApplyView.as_view(), name="dashboard-preset-apply"),
    path("dashboard-v2/templates/save/", DashboardTemplateSaveView.as_view(), name="dashboard-template-save"),

    # Widget Data Endpoints
    path("widgets/san-overview/", widget_san_overview, name="widget-san-overview"),
    path("widgets/zone-deployment/", widget_zone_deployment, name="widget-zone-deployment"),
    path("widgets/alias-distribution/", widget_alias_distribution, name="widget-alias-distribution"),
    path("widgets/storage-inventory/", widget_storage_inventory, name="widget-storage-inventory"),
    path("widgets/host-connectivity/", widget_host_connectivity, name="widget-host-connectivity"),
    path("widgets/import-activity/", widget_import_activity, name="widget-import-activity"),
    path("widgets/backup-health/", widget_backup_health, name="widget-backup-health"),
    path("widgets/wwpn-inventory/", widget_wwpn_inventory, name="widget-wwpn-inventory"),
    path("widgets/project-activity/", widget_project_activity, name="widget-project-activity"),
    path("widgets/storage-capacity/", widget_storage_capacity, name="widget-storage-capacity"),

    # Include router URLs for worksheet generator
    path('', include(router.urls)),
]