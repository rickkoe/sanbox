from django.db import models
from django.contrib.auth.models import User
import json
import re


class APICredentials(models.Model):
    """Store IBM Storage Insights API credentials"""
    name = models.CharField(max_length=100, unique=True)
    base_url = models.URLField()
    username = models.CharField(max_length=100)
    password = models.CharField(max_length=255)  # Consider encryption
    tenant_id = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "API Credentials"
    
    def __str__(self):
        return f"{self.name} - {self.base_url}"


class ImportJob(models.Model):
    """Track import job status and metadata"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    TYPE_CHOICES = [
        ('full', 'Full Import'),
        ('incremental', 'Incremental Import'),
        ('storage_only', 'Storage Systems Only'),
        ('volumes_only', 'Volumes Only'),
        ('hosts_only', 'Hosts Only'),
    ]
    
    job_id = models.CharField(max_length=50, unique=True)
    job_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='full')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    api_credentials = models.ForeignKey(APICredentials, on_delete=models.CASCADE)
    started_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Progress tracking
    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    
    # Results
    result_summary = models.JSONField(default=dict, blank=True)
    error_details = models.TextField(blank=True)
    
    # Celery task tracking
    celery_task_id = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Import Job {self.job_id} - {self.status}"
    
    @property
    def progress_percentage(self):
        if self.total_items == 0:
            return 0
        return (self.processed_items / self.total_items) * 100


class ImportLog(models.Model):
    """Detailed logging for import operations"""
    LOG_LEVELS = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('debug', 'Debug'),
    ]
    
    import_job = models.ForeignKey(ImportJob, on_delete=models.CASCADE, related_name='logs')
    level = models.CharField(max_length=10, choices=LOG_LEVELS)
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Optional references to created/updated objects
    content_type = models.CharField(max_length=50, blank=True)  # e.g., 'storage.Storage'
    object_id = models.CharField(max_length=100, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.level.upper()}: {self.message[:50]}..."


class DataMapping(models.Model):
    """Store field mappings between IBM Storage Insights and local models"""
    source_system = models.CharField(max_length=50, default='storage_insights')
    local_model = models.CharField(max_length=100)  # e.g., 'storage.Storage'
    local_field = models.CharField(max_length=100)
    api_field_path = models.CharField(max_length=200)  # e.g., 'system.serialNumber'
    transformation_rule = models.TextField(blank=True)  # JSON or Python code
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['local_model', 'local_field', 'api_field_path']
    
    def __str__(self):
        return f"{self.local_model}.{self.local_field} <- {self.api_field_path}"


class ImportHistory(models.Model):
    """Track what was imported when for incremental updates"""
    resource_type = models.CharField(max_length=50)  # storage_systems, volumes, hosts
    resource_id = models.CharField(max_length=100)   # ID from Storage Insights
    last_imported = models.DateTimeField()
    last_modified_api = models.DateTimeField(null=True, blank=True)
    checksum = models.CharField(max_length=64, blank=True)  # For change detection
    local_object_id = models.CharField(max_length=100, blank=True)
    
    class Meta:
        unique_together = ['resource_type', 'resource_id']
        indexes = [
            models.Index(fields=['resource_type', 'last_imported']),
        ]
    
    def __str__(self):
        return f"{self.resource_type}: {self.resource_id}"