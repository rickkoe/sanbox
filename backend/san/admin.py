from django.contrib import admin
from .models import Fabric, Alias, AliasWWPN, Zone, WwpnPrefix, Switch, SwitchFabric
from django.db.models import Count

@admin.register(Switch)
class SwitchAdmin(admin.ModelAdmin):
    list_display = [
        "name", "customer", "san_vendor", "ip_address", "model",
        "is_active", "location", "fabric_count", "created_at"
    ]
    list_filter = [
        "customer",
        "san_vendor",
        "is_active",
        ("location", admin.EmptyFieldListFilter),
        ("created_at", admin.DateFieldListFilter),
    ]
    search_fields = ["name", "customer__name", "ip_address", "model", "serial_number", "location"]
    list_editable = ["is_active"]
    ordering = ["customer__name", "name"]
    list_per_page = 50

    # Add custom field to display fabric count
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            fabric_count=Count('fabrics', distinct=True)
        ).select_related('customer')

    def fabric_count(self, obj):
        return obj.fabric_count
    fabric_count.short_description = "Fabrics"
    fabric_count.admin_order_field = "fabric_count"

    # Add actions
    actions = ["mark_as_active", "mark_as_inactive"]

    def mark_as_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} switches marked as active.")
    mark_as_active.short_description = "Mark selected switches as active"

    def mark_as_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} switches marked as inactive.")
    mark_as_inactive.short_description = "Mark selected switches as inactive"


@admin.register(Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = ["name", "customer", "zoneset_name", "san_vendor", "vsan", "exists", "switch_count", "alias_count", "zone_count"]
    list_filter = [
        "customer",
        "san_vendor",
        "exists",
        ("vsan", admin.EmptyFieldListFilter),  # Filter by empty/non-empty VSAN
    ]
    search_fields = ["name", "customer__name", "zoneset_name", "switches__name"]
    list_editable = ["exists", "vsan"]
    ordering = ["customer__name", "name"]
    list_per_page = 50
    # Note: Can't use filter_horizontal with through tables - managed via Switch admin or API

    # Add custom fields to display counts
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            switch_count=Count('switches', distinct=True),
            alias_count=Count('alias', distinct=True),
            zone_count=Count('zone', distinct=True)
        ).select_related('customer')
    
    def switch_count(self, obj):
        return obj.switch_count
    switch_count.short_description = "Switches"
    switch_count.admin_order_field = "switch_count"

    def alias_count(self, obj):
        return obj.alias_count
    alias_count.short_description = "Aliases"
    alias_count.admin_order_field = "alias_count"

    def zone_count(self, obj):
        return obj.zone_count
    zone_count.short_description = "Zones"
    zone_count.admin_order_field = "zone_count"

# Inline for AliasWWPN
class AliasWWPNInline(admin.TabularInline):
    model = AliasWWPN
    extra = 1
    fields = ['wwpn', 'order']
    ordering = ['order']

@admin.register(Alias)
class AliasAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "wwpn_display",
        "fabric",
        "customer_name",
        "use",
        "cisco_alias",
        "committed",
        "deployed",
        "imported",
        "updated"
    ]
    list_filter = [
        "fabric__customer",  # Filter by customer through fabric
        "fabric",
        "use",
        "cisco_alias",
        "committed",
        "deployed",
        ("storage", admin.EmptyFieldListFilter),  # Has storage or not
        ("host", admin.EmptyFieldListFilter),     # Has host or not
        ("imported", admin.DateFieldListFilter), # Filter by import date
        ("updated", admin.DateFieldListFilter),  # Filter by update date
    ]
    search_fields = [
        "name",
        "alias_wwpns__wwpn",  # Search in related AliasWWPN table
        "fabric__name",
        "fabric__customer__name",
        "notes"
    ]
    list_editable = ["use", "committed", "deployed"]
    ordering = ["fabric__customer__name", "fabric__name", "name"]
    list_per_page = 100

    # Add inline for WWPNs
    inlines = [AliasWWPNInline]

    # Custom fields
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'fabric', 'fabric__customer', 'storage', 'host'
        ).prefetch_related('alias_wwpns')

    def wwpn_display(self, obj):
        """Display WWPNs - show first one, indicate if there are more"""
        wwpns = obj.wwpns
        if not wwpns:
            return '-'
        if len(wwpns) == 1:
            return wwpns[0]
        return f"{wwpns[0]} (+{len(wwpns)-1} more)"
    wwpn_display.short_description = "WWPN(s)"

    def customer_name(self, obj):
        return obj.fabric.customer.name
    customer_name.short_description = "Customer"
    customer_name.admin_order_field = "fabric__customer__name"

    # Add actions
    actions = ["mark_as_committed", "mark_as_deployed"]

    def mark_as_committed(self, request, queryset):
        updated = queryset.update(committed=True)
        self.message_user(request, f"{updated} aliases marked as committed.")
    mark_as_committed.short_description = "Mark selected aliases as committed"

    def mark_as_deployed(self, request, queryset):
        updated = queryset.update(deployed=True)
        self.message_user(request, f"{updated} aliases marked as deployed.")
    mark_as_deployed.short_description = "Mark selected aliases as deployed"

@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "fabric",
        "customer_name",
        "zone_type",
        "committed",
        "deployed",
        "exists",
        "member_count",
        "imported",
        "updated"
    ]
    list_filter = [
        "fabric__customer",  # Filter by customer through fabric
        "fabric",
        "zone_type",
        "committed",
        "deployed",
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
    list_editable = ["zone_type", "committed", "deployed", "exists"]
    ordering = ["fabric__customer__name", "fabric__name", "name"]
    list_per_page = 100

    # Better interface for many-to-many fields
    filter_horizontal = ["members"]

    # Custom fields
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            member_count=Count('members', distinct=True)
        ).select_related('fabric', 'fabric__customer')

    def customer_name(self, obj):
        return obj.fabric.customer.name
    customer_name.short_description = "Customer"
    customer_name.admin_order_field = "fabric__customer__name"

    def member_count(self, obj):
        return obj.member_count
    member_count.short_description = "Members"
    member_count.admin_order_field = "member_count"

    # Add actions
    actions = ["mark_as_committed", "mark_as_deployed", "mark_as_existing", "mark_as_not_existing"]

    def mark_as_committed(self, request, queryset):
        updated = queryset.update(committed=True)
        self.message_user(request, f"{updated} zones marked as committed.")
    mark_as_committed.short_description = "Mark selected zones as committed"

    def mark_as_deployed(self, request, queryset):
        updated = queryset.update(deployed=True)
        self.message_user(request, f"{updated} zones marked as deployed.")
    mark_as_deployed.short_description = "Mark selected zones as deployed"

    def mark_as_existing(self, request, queryset):
        updated = queryset.update(exists=True)
        self.message_user(request, f"{updated} zones marked as existing.")
    mark_as_existing.short_description = "Mark selected zones as existing"

    def mark_as_not_existing(self, queryset, request):
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


@admin.register(SwitchFabric)
class SwitchFabricAdmin(admin.ModelAdmin):
    list_display = ["switch", "fabric", "domain_id", "get_customer"]
    list_filter = ["fabric__customer", "switch__customer"]
    search_fields = ["switch__name", "fabric__name", "domain_id"]
    list_editable = ["domain_id"]
    ordering = ["fabric", "switch"]
    list_per_page = 100

    def get_customer(self, obj):
        return obj.fabric.customer.name
    get_customer.short_description = "Customer"
    get_customer.admin_order_field = "fabric__customer__name"