from django.urls import path
from . import views

app_name = 'importer'

urlpatterns = [
    # Import operations
    path('history/', views.import_history, name='import_history'),
    path('start/', views.start_import, name='start_import'),
    path('cancel/<int:import_id>/', views.cancel_import, name='cancel_import'),
    path('status/<int:import_id>/', views.import_status, name='import_status'),
    path('progress/<str:task_id>/', views.task_progress, name='task_progress'),
    path('logs/<int:import_id>/', views.import_logs, name='import_logs'),
    path('test-logging/', views.test_logging, name='test_logging'),
    path('test-celery/', views.test_celery, name='test_celery'),
    path('clear-history/', views.clear_import_history, name='clear_import_history'),
    
    # API credentials management
    path('credentials/', views.api_credentials, name='api_credentials_list'),
    path('credentials/<int:customer_id>/', views.api_credentials, name='api_credentials_detail'),
]