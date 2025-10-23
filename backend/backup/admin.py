from django.contrib import admin
from .models import BackupRecord, BackupLog, RestoreRecord, BackupConfiguration


@admin.register(BackupRecord)
class BackupRecordAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'status', 'backup_type', 'created_at',
        'size_mb', 'django_version', 'app_version'
    ]
    list_filter = ['status', 'backup_type', 'created_at', 'includes_media']
    search_fields = ['name', 'description', 'app_version']
    readonly_fields = [
        'created_at', 'started_at', 'completed_at', 'duration',
        'file_size', 'media_file_size', 'total_size', 'size_mb',
        'checksum', 'celery_task_id'
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'created_by', 'created_at')
        }),
        ('Status', {
            'fields': ('status', 'backup_type', 'started_at', 'completed_at', 'duration')
        }),
        ('File Information', {
            'fields': ('file_path', 'file_size', 'size_mb', 'checksum')
        }),
        ('Version Information', {
            'fields': ('app_version', 'django_version', 'python_version', 'postgres_version')
        }),
        ('Schema Information', {
            'fields': ('migration_state', 'installed_apps'),
            'classes': ('collapse',)
        }),
        ('Database Statistics', {
            'fields': ('database_size', 'table_counts'),
            'classes': ('collapse',)
        }),
        ('Media Files', {
            'fields': ('includes_media', 'media_file_path', 'media_file_size')
        }),
        ('Task Information', {
            'fields': ('celery_task_id',),
            'classes': ('collapse',)
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Additional Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )


@admin.register(BackupLog)
class BackupLogAdmin(admin.ModelAdmin):
    list_display = ['backup', 'timestamp', 'level', 'message_preview']
    list_filter = ['level', 'timestamp']
    search_fields = ['message']
    readonly_fields = ['backup', 'timestamp', 'level', 'message', 'details']

    def message_preview(self, obj):
        return obj.message[:100] + '...' if len(obj.message) > 100 else obj.message
    message_preview.short_description = 'Message'


@admin.register(RestoreRecord)
class RestoreRecordAdmin(admin.ModelAdmin):
    list_display = [
        'backup', 'status', 'started_at', 'completed_at',
        'schema_compatible', 'run_migrations'
    ]
    list_filter = ['status', 'schema_compatible', 'run_migrations', 'started_at']
    readonly_fields = [
        'started_at', 'completed_at', 'duration', 'celery_task_id',
        'schema_compatible', 'migration_plan', 'compatibility_warnings'
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('backup', 'started_by', 'started_at', 'completed_at', 'duration')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Pre-Restore Safety', {
            'fields': ('pre_restore_backup',)
        }),
        ('Compatibility', {
            'fields': ('schema_compatible', 'migration_plan', 'compatibility_warnings')
        }),
        ('Options', {
            'fields': ('restore_media', 'run_migrations')
        }),
        ('Results', {
            'fields': ('migrations_run',),
            'classes': ('collapse',)
        }),
        ('Task Information', {
            'fields': ('celery_task_id',),
            'classes': ('collapse',)
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )


@admin.register(BackupConfiguration)
class BackupConfigurationAdmin(admin.ModelAdmin):
    list_display = [
        'backup_directory', 'max_backups', 'auto_backup_enabled',
        'retention_days', 'updated_at'
    ]
    fieldsets = (
        ('Storage Configuration', {
            'fields': ('backup_directory', 'max_backups')
        }),
        ('Automatic Backups', {
            'fields': ('auto_backup_enabled', 'auto_backup_hour', 'auto_backup_include_media')
        }),
        ('Retention Policy', {
            'fields': ('retention_days',)
        }),
        ('Compression', {
            'fields': ('use_compression',)
        }),
        ('Update Information', {
            'fields': ('updated_at', 'updated_by'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        # Only allow one configuration instance
        return not BackupConfiguration.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Don't allow deleting the configuration
        return False
