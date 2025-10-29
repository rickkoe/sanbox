from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from customers.models import Customer

User = get_user_model()


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
        ('cancelled', 'Cancelled'),
    ]

    IMPORT_TYPE_CHOICES = [
        ('san_config', 'SAN Configuration'),
        ('storage_insights', 'IBM Storage Insights'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='storage_imports')
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='initiated_imports', help_text="User who initiated this import")
    import_type = models.CharField(max_length=20, choices=IMPORT_TYPE_CHOICES, null=True, blank=True, help_text="Type of import")
    import_name = models.CharField(max_length=255, blank=True, help_text="Optional user-provided name for this import")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled = models.BooleanField(default=False, help_text="Flag to request cancellation of running import")
    cancelled_at = models.DateTimeField(null=True, blank=True, help_text="When the import was cancelled")

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


class ImportLog(models.Model):
    """Real-time logs for import operations"""
    
    LOG_LEVELS = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
    ]
    
    import_record = models.ForeignKey(StorageImport, on_delete=models.CASCADE, related_name='logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=10, choices=LOG_LEVELS, default='INFO')
    message = models.TextField()
    details = models.JSONField(null=True, blank=True, help_text="Additional structured data")
    
    class Meta:
        ordering = ['timestamp']
        verbose_name = "Import Log"
        verbose_name_plural = "Import Logs"
    
    def __str__(self):
        return f"{self.timestamp.strftime('%H:%M:%S')} [{self.level}] {self.message[:50]}..."
