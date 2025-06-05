from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
import json
from .models import (
    APICredentials, ImportJob, ImportLog, 
    DataMapping, ImportHistory
)


@admin.register(APICredentials)
class APICredentialsAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_url', 'username', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'base_url', 'username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'base_url', 'is_active')
        }),
        ('Authentication', {
            'fields': ('username', 'password', 'tenant_id'),
            'description': 'Consider using environment variables for sensitive data'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj:  # Editing existing object
            form.base_fields['password'].widget.attrs['placeholder'] = '••••••••'
        return form


class ImportLogInline(admin.TabularInline):
    model = ImportLog
    extra = 0
    readonly_fields = ['timestamp', 'level', 'message', 'details_preview']
    fields = ['timestamp', 'level', 'message', 'details_preview']
    
    def details_preview(self, obj):
        if obj.details:
            details_str = json.dumps(obj.details, indent=2)[:200]
            return format_html('<pre style="font-size: 11px;">{}</pre>', details_str)
        return '-'
    details_preview.short_description = 'Details Preview'


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = [
        'job_id', 'job_type', 'status_badge', 'progress_bar', 
        'started_by', 'created_at', 'duration'
    ]
    list_filter = ['status', 'job_type', 'created_at', 'api_credentials']
    search_fields = ['job_id', 'started_by__username']
    readonly_fields = [
        'job_id', 'created_at', 'started_at', 'completed_at', 
        'progress_percentage', 'duration', 'result_summary_display'
    ]
    inlines = [ImportLogInline]
    
    fieldsets = (
        ('Job Information', {
            'fields': ('job_id', 'job_type', 'status', 'api_credentials', 'started_by')
        }),
        ('Progress', {
            'fields': ('total_items', 'processed_items', 'success_count', 'error_count', 'progress_percentage')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'started_at', 'completed_at', 'duration')
        }),
        ('Results', {
            'fields': ('result_summary_display', 'error_details'),
            'classes': ('collapse',)
        })
    )
    
    def status_badge(self, obj):
        colors = {
            'pending': 'orange',
            'running': 'blue',
            'completed': 'green',
            'failed': 'red',
            'cancelled': 'gray'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def progress_bar(self, obj):
        if obj.total_items == 0:
            return '-'
        
        percentage = obj.progress_percentage
        color = 'green' if percentage == 100 else 'blue'
        
        return format_html(
            '<div style="width: 100px; background-color: #f0f0f0; border-radius: 3px;">'
            '<div style="width: {}%; background-color: {}; height: 20px; border-radius: 3px; text-align: center; line-height: 20px; color: white; font-size: 12px;">'
            '{}%</div></div>',
            percentage, color, int(percentage)
        )
    progress_bar.short_description = 'Progress'
    
    def duration(self, obj):
        if obj.started_at and obj.completed_at:
            duration = obj.completed_at - obj.started_at
            return str(duration).split('.')[0]  # Remove microseconds
        elif obj.started_at:
            from django.utils import timezone
            duration = timezone.now() - obj.started_at
            return f"{str(duration).split('.')[0]} (running)"
        return '-'
    duration.short_description = 'Duration'
    
    def result_summary_display(self, obj):
        if obj.result_summary:
            return format_html('<pre>{}</pre>', json.dumps(obj.result_summary, indent=2))
        return '-'
    result_summary_display.short_description = 'Result Summary'


@admin.register(ImportLog)
class ImportLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'import_job', 'level_badge', 'message_preview', 'content_type']
    list_filter = ['level', 'timestamp', 'import_job__status']
    search_fields = ['message', 'import_job__job_id']
    readonly_fields = ['timestamp', 'details_formatted']
    date_hierarchy = 'timestamp'
    
    def level_badge(self, obj):
        colors = {
            'info': 'blue',
            'warning': 'orange', 
            'error': 'red',
            'debug': 'gray'
        }
        color = colors.get(obj.level, 'gray')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.level.upper()
        )
    level_badge.short_description = 'Level'
    
    def message_preview(self, obj):
        return obj.message[:100] + ('...' if len(obj.message) > 100 else '')
    message_preview.short_description = 'Message'
    
    def details_formatted(self, obj):
        if obj.details:
            return format_html('<pre>{}</pre>', json.dumps(obj.details, indent=2))
        return '-'
    details_formatted.short_description = 'Details'


@admin.register(DataMapping)
class DataMappingAdmin(admin.ModelAdmin):
    list_display = ['local_model', 'local_field', 'api_field_path', 'is_active', 'created_at']
    list_filter = ['local_model', 'is_active', 'source_system']
    search_fields = ['local_model', 'local_field', 'api_field_path']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Mapping Configuration', {
            'fields': ('source_system', 'local_model', 'local_field', 'api_field_path', 'is_active')
        }),
        ('Transformation', {
            'fields': ('transformation_rule',),
            'description': 'Optional Python code or JSON for data transformation'
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )


@admin.register(ImportHistory)
class ImportHistoryAdmin(admin.ModelAdmin):
    list_display = ['resource_type', 'resource_id', 'last_imported', 'local_object_id']
    list_filter = ['resource_type', 'last_imported']
    search_fields = ['resource_id', 'local_object_id']
    readonly_fields = ['last_imported']
    date_hierarchy = 'last_imported'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related()