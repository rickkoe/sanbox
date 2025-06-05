from django.urls import path
from . import views

app_name = 'insights_importer'

urlpatterns = [
    # Testing endpoints
    path('test-connection/', views.TestConnectionView.as_view(), name='test-connection'),
    path('preview/', views.PreviewImportView.as_view(), name='preview-import'),
    
    # Basic CRUD endpoints
    path('credentials/', views.CredentialsListView.as_view(), name='credentials-list'),
    path('jobs/', views.ImportJobListView.as_view(), name='jobs-list'),
]