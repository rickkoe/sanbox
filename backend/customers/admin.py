from django.contrib import admin
from .models import Customer, ContactInfo

# Register your models here.
admin.site.register(Customer)


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