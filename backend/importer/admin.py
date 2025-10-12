from django.contrib import admin
from .models import APICredentials, StorageImport, ImportLog


@admin.register(APICredentials)
class APICredentialsAdmin(admin.ModelAdmin):
    list_display = ('customer', 'insights_tenant', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('customer__name', 'insights_tenant')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': ('customer', 'insights_tenant', 'insights_api_key', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(StorageImport)
class StorageImportAdmin(admin.ModelAdmin):
    list_display = ('customer', 'status', 'started_at', 'completed_at', 'total_items_imported')
    list_filter = ('status', 'started_at', 'customer')
    search_fields = ('customer__name',)
    readonly_fields = ('started_at', 'completed_at', 'duration', 'total_items_imported')

    fieldsets = (
        (None, {
            'fields': ('customer', 'status')
        }),
        ('Import Metrics', {
            'fields': ('storage_systems_imported', 'volumes_imported', 'hosts_imported', 'total_items_imported')
        }),
        ('Timing', {
            'fields': ('started_at', 'completed_at', 'duration')
        }),
        ('Error Details', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('API Response', {
            'fields': ('api_response_summary',),
            'classes': ('collapse',)
        }),
    )

    def has_add_permission(self, request):
        # Imports should only be created through the API
        return False


@admin.register(ImportLog)
class ImportLogAdmin(admin.ModelAdmin):
    list_display = ('import_record', 'level', 'message', 'timestamp')
    list_filter = ('level', 'timestamp', 'import_record__customer')
    search_fields = ('message', 'import_record__customer__name')
    readonly_fields = ('timestamp',)

    fieldsets = (
        ('Log Information', {
            'fields': ('import_record', 'level', 'message')
        }),
        ('Details', {
            'fields': ('details',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('timestamp',)
        }),
    )

    def has_add_permission(self, request):
        # Log entries should only be created programmatically
        return False
