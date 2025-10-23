"""
URL routing for backup API endpoints
"""

from django.urls import path
from . import views

urlpatterns = [
    # Backup operations
    path('backups/', views.list_backups, name='list_backups'),
    path('backups/create/', views.create_backup, name='create_backup'),
    path('backups/<int:backup_id>/', views.get_backup, name='get_backup'),
    path('backups/<int:backup_id>/delete/', views.delete_backup, name='delete_backup'),
    path('backups/<int:backup_id>/download/', views.download_backup, name='download_backup'),
    path('backups/<int:backup_id>/verify/', views.verify_backup, name='verify_backup'),
    path('backups/<int:backup_id>/restore/', views.restore_backup, name='restore_backup'),
    path('backups/<int:backup_id>/logs/', views.backup_logs, name='backup_logs'),

    # Restore operations
    path('restores/', views.list_restores, name='list_restores'),
    path('restores/<int:restore_id>/', views.get_restore, name='get_restore'),

    # Configuration
    path('config/', views.backup_config, name='backup_config'),

    # Task status
    path('tasks/<str:task_id>/', views.task_status, name='task_status'),
]
