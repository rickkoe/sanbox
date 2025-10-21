from django.contrib import admin
from .models import Customer, ContactInfo


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'implementation_company_status', 'insights_tenant')
    list_filter = ('is_implementation_company',)
    search_fields = ('name', 'notes', 'insights_tenant')

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'notes')
        }),
        ('Implementation Company', {
            'fields': ('is_implementation_company',),
            'description': 'Mark this as your implementation company. Only one customer can be the implementation company at a time.'
        }),
        ('Insights Configuration', {
            'fields': ('insights_api_key', 'insights_tenant'),
            'classes': ('collapse',)
        }),
    )

    def implementation_company_status(self, obj):
        """Display implementation company status with a visual indicator"""
        if obj.is_implementation_company:
            return '✓ Implementation Company'
        return '-'
    implementation_company_status.short_description = 'Implementation Company'


@admin.register(ContactInfo)
class ContactInfoAdmin(admin.ModelAdmin):
    list_display = ('name', 'customer', 'email', 'phone_number', 'title', 'is_default', 'created_at')
    list_filter = ('is_default', 'customer', 'created_at')
    search_fields = ('name', 'email', 'phone_number', 'customer__name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Contact Information', {
            'fields': ('customer', 'name', 'email', 'phone_number', 'title')
        }),
        ('Settings', {
            'fields': ('is_default', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        """Optimize queries with select_related"""
        return super().get_queryset(request).select_related('customer')