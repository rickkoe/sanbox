from django.contrib import admin
from .models import Fabric, Alias, Zone, WwpnPrefix
from django.db.models import Count

@admin.register(Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = ["name", "customer", "zoneset_name", "san_vendor", "vsan", "exists", "alias_count", "zone_count"]
    list_filter = [
        "customer", 
        "san_vendor", 
        "exists",
        ("vsan", admin.EmptyFieldListFilter),  # Filter by empty/non-empty VSAN
    ]
    search_fields = ["name", "customer__name", "zoneset_name"]
    list_editable = ["exists", "vsan"]
    ordering = ["customer__name", "name"]
    list_per_page = 50
    
    # Add custom fields to display counts
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            alias_count=Count('alias', distinct=True),
            zone_count=Count('zone', distinct=True)
        ).select_related('customer')
    
    def alias_count(self, obj):
        return obj.alias_count
    alias_count.short_description = "Aliases"
    alias_count.admin_order_field = "alias_count"
    
    def zone_count(self, obj):
        return obj.zone_count
    zone_count.short_description = "Zones"
    zone_count.admin_order_field = "zone_count"

@admin.register(Alias)
class AliasAdmin(admin.ModelAdmin):
    list_display = [
        "name", 
        "wwpn", 
        "fabric", 
        "customer_name",
        "use", 
        "cisco_alias", 
        "create", 
        "include_in_zoning",
        "project_count",
        "imported",
        "updated"
    ]
    list_filter = [
        "fabric__customer",  # Filter by customer through fabric
        "fabric",
        "projects",  # Filter by projects
        "use",
        "cisco_alias", 
        "create", 
        "include_in_zoning",
        ("storage", admin.EmptyFieldListFilter),  # Has storage or not
        ("host", admin.EmptyFieldListFilter),     # Has host or not
        ("imported", admin.DateFieldListFilter), # Filter by import date
        ("updated", admin.DateFieldListFilter),  # Filter by update date
    ]
    search_fields = [
        "name", 
        "wwpn", 
        "fabric__name", 
        "fabric__customer__name",
        "notes"
    ]
    list_editable = ["use", "create", "include_in_zoning"]
    ordering = ["fabric__customer__name", "fabric__name", "name"]
    list_per_page = 100
    
    # Add filter for projects
    filter_horizontal = ["projects"]  # Better interface for many-to-many
    
    # Custom fields
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            project_count=Count('projects', distinct=True)
        ).select_related('fabric', 'fabric__customer', 'storage', 'host')
    
    def customer_name(self, obj):
        return obj.fabric.customer.name
    customer_name.short_description = "Customer"
    customer_name.admin_order_field = "fabric__customer__name"
    
    def project_count(self, obj):
        return obj.project_count
    project_count.short_description = "Projects"
    project_count.admin_order_field = "project_count"
    
    # Add actions
    actions = ["mark_for_creation", "unmark_for_creation", "include_in_zoning", "exclude_from_zoning"]
    
    def mark_for_creation(self, request, queryset):
        updated = queryset.update(create=True)
        self.message_user(request, f"{updated} aliases marked for creation.")
    mark_for_creation.short_description = "Mark selected aliases for creation"
    
    def unmark_for_creation(self, request, queryset):
        updated = queryset.update(create=False)
        self.message_user(request, f"{updated} aliases unmarked for creation.")
    unmark_for_creation.short_description = "Unmark selected aliases for creation"
    
    def include_in_zoning(self, request, queryset):
        updated = queryset.update(include_in_zoning=True)
        self.message_user(request, f"{updated} aliases included in zoning.")
    include_in_zoning.short_description = "Include selected aliases in zoning"
    
    def exclude_from_zoning(self, request, queryset):
        updated = queryset.update(include_in_zoning=False)
        self.message_user(request, f"{updated} aliases excluded from zoning.")
    exclude_from_zoning.short_description = "Exclude selected aliases from zoning"

@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = [
        "name", 
        "fabric", 
        "customer_name",
        "zone_type", 
        "create", 
        "exists",
        "member_count",
        "project_count",
        "imported",
        "updated"
    ]
    list_filter = [
        "fabric__customer",  # Filter by customer through fabric
        "fabric",
        "zone_type",
        "create",
        "exists", 
        ("imported", admin.DateFieldListFilter),
        ("updated", admin.DateFieldListFilter),
    ]
    search_fields = [
        "name", 
        "fabric__name", 
        "fabric__customer__name",
        "notes",
        "members__name"  # Search by member alias names
    ]
    list_editable = ["zone_type", "create", "exists"]
    ordering = ["fabric__customer__name", "fabric__name", "name"]
    list_per_page = 100
    
    # Better interface for many-to-many fields
    filter_horizontal = ["projects", "members"]
    
    # Custom fields
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            member_count=Count('members', distinct=True),
            project_count=Count('projects', distinct=True)
        ).select_related('fabric', 'fabric__customer')
    
    def customer_name(self, obj):
        return obj.fabric.customer.name
    customer_name.short_description = "Customer"
    customer_name.admin_order_field = "fabric__customer__name"
    
    def member_count(self, obj):
        return obj.member_count
    member_count.short_description = "Members"
    member_count.admin_order_field = "member_count"
    
    def project_count(self, obj):
        return obj.project_count
    project_count.short_description = "Projects"
    project_count.admin_order_field = "project_count"
    
    # Add actions
    actions = ["mark_for_creation", "unmark_for_creation", "mark_as_existing", "mark_as_not_existing"]
    
    def mark_for_creation(self, request, queryset):
        updated = queryset.update(create=True)
        self.message_user(request, f"{updated} zones marked for creation.")
    mark_for_creation.short_description = "Mark selected zones for creation"
    
    def unmark_for_creation(self, request, queryset):
        updated = queryset.update(create=False)
        self.message_user(request, f"{updated} zones unmarked for creation.")
    unmark_for_creation.short_description = "Unmark selected zones for creation"
    
    def mark_as_existing(self, request, queryset):
        updated = queryset.update(exists=True)
        self.message_user(request, f"{updated} zones marked as existing.")
    mark_as_existing.short_description = "Mark selected zones as existing"
    
    def mark_as_not_existing(self, request, queryset):
        updated = queryset.update(exists=False)
        self.message_user(request, f"{updated} zones marked as not existing.")
    mark_as_not_existing.short_description = "Mark selected zones as not existing"


@admin.register(WwpnPrefix)
class WwpnPrefixAdmin(admin.ModelAdmin):
    list_display = [
        "prefix", 
        "wwpn_type", 
        "vendor", 
        "description", 
        "created_at", 
        "updated_at"
    ]
    list_filter = [
        "wwpn_type", 
        "vendor",
        ("created_at", admin.DateFieldListFilter),
        ("updated_at", admin.DateFieldListFilter),
    ]
    search_fields = [
        "prefix", 
        "vendor", 
        "description"
    ]
    list_editable = ["wwpn_type", "vendor"]
    ordering = ["prefix"]
    list_per_page = 100
    
    # Add actions
    actions = ["mark_as_initiator", "mark_as_target"]
    
    def mark_as_initiator(self, request, queryset):
        updated = queryset.update(wwpn_type='init')
        self.message_user(request, f"{updated} prefixes marked as initiator.")
    mark_as_initiator.short_description = "Mark selected prefixes as initiator"
    
    def mark_as_target(self, request, queryset):
        updated = queryset.update(wwpn_type='target')
        self.message_user(request, f"{updated} prefixes marked as target.")
    mark_as_target.short_description = "Mark selected prefixes as target"