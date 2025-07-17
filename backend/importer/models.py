from django.db import models
from django.core.exceptions import ValidationError
from customers.models import Customer


class APICredentials(models.Model):
    """Simple storage for IBM Storage Insights API credentials"""
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='api_credentials')
    insights_tenant = models.CharField(max_length=100, help_text="IBM Storage Insights tenant ID")
    insights_api_key = models.CharField(max_length=255, help_text="IBM Storage Insights API key")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "API Credentials"
        verbose_name_plural = "API Credentials"
    
    def __str__(self):
        return f"{self.customer.name} - {self.insights_tenant}"

    def clean(self):
        if not self.insights_tenant or not self.insights_api_key:
            raise ValidationError("Both tenant ID and API key are required.")


class StorageImport(models.Model):
    """Simple tracking for storage data imports"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='storage_imports')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Celery task tracking
    celery_task_id = models.CharField(max_length=255, null=True, blank=True, help_text="Celery task ID for background processing")
    
    # Simple metrics
    storage_systems_imported = models.IntegerField(default=0)
    volumes_imported = models.IntegerField(default=0)
    hosts_imported = models.IntegerField(default=0)
    
    # Error tracking
    error_message = models.TextField(blank=True, help_text="Error details if import failed")
    
    # Optional: Store raw API response for debugging
    api_response_summary = models.JSONField(null=True, blank=True, help_text="Summary of API responses")
    
    class Meta:
        ordering = ['-started_at']
        verbose_name = "Storage Import"
        verbose_name_plural = "Storage Imports"
    
    def __str__(self):
        return f"{self.customer.name} - {self.status} - {self.started_at.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def duration(self):
        """Calculate import duration"""
        if self.completed_at:
            return self.completed_at - self.started_at
        return None
    
    @property
    def total_items_imported(self):
        """Total items imported across all types"""
        return self.storage_systems_imported + self.volumes_imported + self.hosts_imported
