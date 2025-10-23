from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
import json


class BackupRecord(models.Model):
    """
    Track database backup metadata and history.
    Stores information about backups including versions, schema state, and file locations.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('verifying', 'Verifying'),
        ('verified', 'Verified'),
    ]

    BACKUP_TYPE_CHOICES = [
        ('full', 'Full Backup'),
        ('schema_only', 'Schema Only'),
        ('data_only', 'Data Only'),
    ]

    # Basic Information
    name = models.CharField(
        max_length=255,
        help_text="Descriptive name for this backup"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description or notes about this backup"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='backups_created'
    )

    # Backup Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    backup_type = models.CharField(
        max_length=20,
        choices=BACKUP_TYPE_CHOICES,
        default='full'
    )

    # File Information
    file_path = models.CharField(
        max_length=500,
        help_text="Path to the backup file"
    )
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Backup file size in bytes"
    )
    checksum = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 checksum for integrity verification"
    )

    # Version Information
    app_version = models.CharField(
        max_length=50,
        blank=True,
        help_text="Application version (git tag/commit)"
    )
    django_version = models.CharField(max_length=50)
    python_version = models.CharField(max_length=50)
    postgres_version = models.CharField(max_length=255, blank=True)

    # Schema Information
    migration_state = models.JSONField(
        help_text="Migration IDs for each Django app at backup time"
    )
    installed_apps = models.JSONField(
        help_text="List of installed Django apps"
    )

    # Database Statistics
    database_size = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Database size in bytes at backup time"
    )
    table_counts = models.JSONField(
        null=True,
        blank=True,
        help_text="Row counts for each table"
    )

    # Media Files (Optional)
    includes_media = models.BooleanField(
        default=False,
        help_text="Whether media files are included in this backup"
    )
    media_file_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="Path to media files archive"
    )
    media_file_size = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Media archive size in bytes"
    )

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Celery Task
    celery_task_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Celery task ID for background processing"
    )

    # Error Tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error details if backup failed"
    )

    # Additional Metadata
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional backup metadata"
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Backup Record"
        verbose_name_plural = "Backup Records"
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

    @property
    def duration(self):
        """Calculate backup duration"""
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        return None

    @property
    def total_size(self):
        """Total size of backup including media"""
        size = self.file_size or 0
        if self.includes_media and self.media_file_size:
            size += self.media_file_size
        return size

    @property
    def size_mb(self):
        """Backup size in MB"""
        if self.total_size:
            return round(self.total_size / (1024 * 1024), 2)
        return 0

    def clean(self):
        """Validate backup record"""
        if self.includes_media and not self.media_file_path:
            raise ValidationError(
                "Media file path required when includes_media is True"
            )


class BackupLog(models.Model):
    """
    Real-time logs for backup/restore operations
    """

    LOG_LEVELS = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
    ]

    backup = models.ForeignKey(
        BackupRecord,
        on_delete=models.CASCADE,
        related_name='logs'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=10, choices=LOG_LEVELS, default='INFO')
    message = models.TextField()
    details = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional structured data"
    )

    class Meta:
        ordering = ['timestamp']
        verbose_name = "Backup Log"
        verbose_name_plural = "Backup Logs"
        indexes = [
            models.Index(fields=['backup', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.timestamp.strftime('%H:%M:%S')} [{self.level}] {self.message[:50]}..."


class RestoreRecord(models.Model):
    """
    Track database restore operations
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('validating', 'Validating'),
        ('pre_backup', 'Creating Pre-Restore Backup'),
        ('restoring', 'Restoring'),
        ('migrating', 'Running Migrations'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('rolled_back', 'Rolled Back'),
    ]

    # Source Backup
    backup = models.ForeignKey(
        BackupRecord,
        on_delete=models.CASCADE,
        related_name='restores'
    )

    # Basic Information
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    started_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='restores_started'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Pre-Restore Backup (Safety)
    pre_restore_backup = models.ForeignKey(
        BackupRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pre_restore_for',
        help_text="Automatic backup created before restore"
    )

    # Compatibility Information
    schema_compatible = models.BooleanField(
        default=False,
        help_text="Whether backup schema matches current code"
    )
    migration_plan = models.JSONField(
        null=True,
        blank=True,
        help_text="Migrations to run after restore"
    )
    compatibility_warnings = models.JSONField(
        null=True,
        blank=True,
        help_text="Warnings about schema compatibility"
    )

    # Options
    restore_media = models.BooleanField(
        default=True,
        help_text="Whether to restore media files"
    )
    run_migrations = models.BooleanField(
        default=True,
        help_text="Whether to run migrations after restore"
    )

    # Celery Task
    celery_task_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Celery task ID for background processing"
    )

    # Error Tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error details if restore failed"
    )

    # Results
    migrations_run = models.JSONField(
        null=True,
        blank=True,
        help_text="List of migrations that were run"
    )

    class Meta:
        ordering = ['-started_at']
        verbose_name = "Restore Record"
        verbose_name_plural = "Restore Records"

    def __str__(self):
        return f"Restore from {self.backup.name} at {self.started_at.strftime('%Y-%m-%d %H:%M')}"

    @property
    def duration(self):
        """Calculate restore duration"""
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        return None


class BackupConfiguration(models.Model):
    """
    Global backup configuration settings
    """

    # Storage Configuration
    backup_directory = models.CharField(
        max_length=500,
        default='/app/backups',
        help_text="Directory where backups are stored"
    )
    max_backups = models.IntegerField(
        default=10,
        help_text="Maximum number of backups to retain (0 = unlimited)"
    )

    # Automatic Backup Schedule
    FREQUENCY_CHOICES = [
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
    ]

    auto_backup_enabled = models.BooleanField(
        default=False,
        help_text="Enable automatic scheduled backups"
    )
    auto_backup_frequency = models.CharField(
        max_length=10,
        choices=FREQUENCY_CHOICES,
        default='daily',
        help_text="Frequency of automatic backups"
    )
    auto_backup_hour = models.IntegerField(
        default=2,
        help_text="Hour of day for automatic backup (0-23) - for daily backups or starting hour for hourly"
    )
    auto_backup_include_media = models.BooleanField(
        default=False,
        help_text="Include media files in automatic backups"
    )

    # Retention Policy
    retention_days = models.IntegerField(
        default=30,
        help_text="Days to retain backups (0 = keep all)"
    )

    # Compression
    use_compression = models.BooleanField(
        default=True,
        help_text="Compress backup files"
    )

    # Updated
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='backup_configs_updated'
    )

    class Meta:
        verbose_name = "Backup Configuration"
        verbose_name_plural = "Backup Configuration"

    def __str__(self):
        return f"Backup Configuration (updated {self.updated_at.strftime('%Y-%m-%d')})"

    @classmethod
    def get_config(cls):
        """Get or create the singleton configuration"""
        config, created = cls.objects.get_or_create(pk=1)
        return config
