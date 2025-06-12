from django.urls import path
from . import views

urlpatterns = [
    # Enhanced endpoints (converted from class-based to function-based)
    path('enhanced/auth/', views.enhanced_auth_view, name='enhanced_auth'),
    path('enhanced/storage-systems/', views.enhanced_storage_systems_view, name='enhanced_storage_systems'),
    path('enhanced/import/start/', views.start_orchestated_import_view, name='start_import'),
    
    # New endpoints for the enhanced importer
    path('enhanced/import/preview/', views.preview_import_view, name='preview_import'),
    path('enhanced/test-connection/', views.test_connection_view, name='test_connection'),
    
    # Job and task management
    path('jobs/', views.import_job_list_view, name='import_jobs'),
    path('jobs/<str:job_id>/', views.import_job_detail_view, name='import_job_detail'),
    path('tasks/<str:task_id>/status/', views.task_status_view, name='task_status'),
    
    # Credentials management
    path('credentials/', views.credentials_list_view, name='credentials_list'),
    
    # Legacy compatibility endpoints
    path('auth/', views.legacy_storage_insights_auth_view, name='legacy_auth'),
    path('storage-systems/', views.legacy_storage_insights_systems_view, name='legacy_storage_systems'),
]