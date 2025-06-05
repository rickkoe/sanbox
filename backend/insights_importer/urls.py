from django.urls import path
from . import views

app_name = 'insights_importer'

urlpatterns = [
    # Testing endpoints
    path('test-connection/', views.TestConnectionView.as_view(), name='test-connection'),
    path('preview/', views.PreviewImportView.as_view(), name='preview-import'),
    
    # Enhanced endpoints (new functionality)
    path('enhanced/auth/', views.EnhancedAuthView.as_view(), name='enhanced-auth'),
    path('enhanced/storage-systems/', views.EnhancedStorageSystemsView.as_view(), name='enhanced-storage-systems'),
    path('enhanced/import/start/', views.StartOrchestatedImportView.as_view(), name='start-orchestrated-import'),
    
    # Management endpoints
    path('credentials/', views.CredentialsListView.as_view(), name='credentials-list'),
    path('jobs/', views.ImportJobListView.as_view(), name='jobs-list'),
    path('jobs/<str:job_id>/', views.ImportJobDetailView.as_view(), name='job-detail'),
    
    # Task status endpoints
    path('tasks/<str:task_id>/status/', views.TaskStatusView.as_view(), name='task-status'),
    
    # Legacy compatibility endpoints - these can replace your existing storage app endpoints
    path('legacy/auth/', views.LegacyStorageInsightsAuthView.as_view(), name='legacy-auth'),
    path('legacy/storage-systems/', views.LegacyStorageInsightsSystemsView.as_view(), name='legacy-storage-systems'),
]