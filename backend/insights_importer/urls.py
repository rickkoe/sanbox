# Update your insights_importer/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Enhanced endpoints (your existing ones)
    path('enhanced/auth/', views.EnhancedAuthView.as_view(), name='enhanced_auth'),
    path('enhanced/storage-systems/', views.EnhancedStorageSystemsView.as_view(), name='enhanced_storage_systems'),
    path('enhanced/import/start/', views.StartOrchestatedImportView.as_view(), name='start_import'),
    
    # New endpoints for the enhanced importer
    path('enhanced/import/preview/', views.PreviewImportView.as_view(), name='preview_import'),
    path('enhanced/test-connection/', views.TestConnectionView.as_view(), name='test_connection'),
    
    # Job and task management
    path('jobs/', views.ImportJobListView.as_view(), name='import_jobs'),
    path('jobs/<str:job_id>/', views.ImportJobDetailView.as_view(), name='import_job_detail'),
    path('tasks/<str:task_id>/status/', views.TaskStatusView.as_view(), name='task_status'),
    
    # Credentials management
    path('credentials/', views.CredentialsListView.as_view(), name='credentials_list'),
    
    # Legacy compatibility endpoints
    path('auth/', views.LegacyStorageInsightsAuthView.as_view(), name='legacy_auth'),
    path('storage-systems/', views.LegacyStorageInsightsSystemsView.as_view(), name='legacy_storage_systems'),
]