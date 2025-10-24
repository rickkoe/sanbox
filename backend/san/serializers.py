from rest_framework import serializers
from .models import Alias, AliasWWPN, Zone, Fabric, WwpnPrefix, Switch, SwitchFabric
from core.models import Project
from storage.models import Host, Storage


class SwitchSerializer(serializers.ModelSerializer):
    fabric_domains = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )  # For writing: [{"fabric_id": 1, "domain_id": 123}, ...]
    fabrics_details = serializers.SerializerMethodField()  # For reading
    fabric_domain_details = serializers.SerializerMethodField()  # For reading with domain IDs

    class Meta:
        model = Switch
        fields = '__all__'

    def get_fabrics_details(self, obj):
        """Return list of fabrics associated with this switch (backward compatibility)"""
        return [{"id": fabric.id, "name": fabric.name} for fabric in obj.fabrics.all()]

    def get_fabric_domain_details(self, obj):
        """Return list of fabrics with their domain IDs"""
        switch_fabrics = obj.switch_fabrics.select_related('fabric').all()
        return [
            {
                "id": sf.fabric.id,
                "name": sf.fabric.name,
                "domain_id": sf.domain_id
            }
            for sf in switch_fabrics
        ]

    def create(self, validated_data):
        """Create switch and handle fabric-domain associations"""
        fabric_domains = validated_data.pop("fabric_domains", [])
        switch = Switch.objects.create(**validated_data)

        # Create SwitchFabric entries
        for fd in fabric_domains:
            SwitchFabric.objects.create(
                switch=switch,
                fabric_id=fd.get('fabric_id'),
                domain_id=fd.get('domain_id')
            )

        return switch

    def update(self, instance, validated_data):
        """Update switch and handle fabric-domain associations"""
        fabric_domains = validated_data.pop("fabric_domains", None)

        # Update regular fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update fabric-domain relationships if provided
        if fabric_domains is not None:
            # Clear existing relationships
            instance.switch_fabrics.all().delete()

            # Create new relationships
            for fd in fabric_domains:
                SwitchFabric.objects.create(
                    switch=instance,
                    fabric_id=fd.get('fabric_id'),
                    domain_id=fd.get('domain_id')
                )

        return instance


class FabricSerializer(serializers.ModelSerializer):
    switches_details = serializers.SerializerMethodField()  # For displaying switch details with domain IDs
    alias_count = serializers.SerializerMethodField()  # Count of aliases in this fabric
    zone_count = serializers.SerializerMethodField()  # Count of zones in this fabric

    class Meta:
        model = Fabric
        fields = '__all__'

    def get_switches_details(self, obj):
        """Return list of switches with their details and domain IDs"""
        switch_fabrics = obj.fabric_switches.select_related('switch').all()
        return [
            {
                "id": sf.switch.id,
                "name": sf.switch.name,
                "domain_id": sf.domain_id
            }
            for sf in switch_fabrics
        ]

    def get_alias_count(self, obj):
        """Return count of aliases in this fabric"""
        return obj.alias_set.count()

    def get_zone_count(self, obj):
        """Return count of zones in this fabric"""
        return obj.zone_set.count()

    # Note: Switch-fabric relationships with domain IDs are managed through
    # the SwitchSerializer or the SwitchFabric model directly


class AliasSerializer(serializers.ModelSerializer):
    projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )  # ✅ Allows multiple projects

    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True  # ✅ Allow writing fabric (ID) in request
    )

    host = serializers.PrimaryKeyRelatedField(
        queryset=Host.objects.all(), required=False, allow_null=True
    )  # ✅ Allow writing host (ID) in request

    storage = serializers.PrimaryKeyRelatedField(
        queryset=Storage.objects.all(), required=False, allow_null=True
    )  # ✅ Allow writing storage (ID) in request

    # Multi-WWPN support
    wwpns = serializers.SerializerMethodField()  # Read: list of WWPNs
    wwpns_write = serializers.ListField(
        child=serializers.CharField(max_length=23),
        write_only=True,
        required=False,
        help_text="List of WWPNs for this alias"
    )
    wwpn = serializers.SerializerMethodField()  # Backward compatibility: first WWPN

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details
    host_details = serializers.SerializerMethodField()  # ✅ Return host name for display
    storage_details = serializers.SerializerMethodField()  # ✅ Return storage name for display

    # ADD THIS: Zoned count field
    zoned_count = serializers.SerializerMethodField()

    class Meta:
        model = Alias
        fields = [
            'id', 'fabric', 'fabric_details', 'projects', 'storage', 'storage_details',
            'name', 'wwpns', 'wwpns_write', 'wwpn', 'use', 'cisco_alias',
            'create', 'delete', 'include_in_zoning', 'logged_in',
            'host', 'host_details', 'notes', 'imported', 'updated',
            'last_modified_by', 'last_modified_at', 'version', 'zoned_count'
        ]

    def get_wwpns(self, obj):
        """Return list of WWPNs for this alias"""
        return obj.wwpns

    def get_wwpn(self, obj):
        """Return first WWPN for backward compatibility"""
        return obj.wwpn

    def get_host_details(self, obj):
        """Return host name for display"""
        if obj.host:
            return {"id": obj.host.id, "name": obj.host.name}
        return None

    def get_storage_details(self, obj):
        """
        Return storage name by looking up ports with matching WWPNs.
        Lookup chain: Alias.wwpns → Port.wwpn → Port.storage → Storage.name

        Optimized: Uses a pre-built WWPN→Storage map from context to avoid N+1 queries.
        """
        wwpns = obj.wwpns
        if not wwpns:
            return None

        # Check if we have a pre-built WWPN→Storage map in context (bulk optimization)
        wwpn_storage_map = self.context.get('wwpn_storage_map')

        if wwpn_storage_map is not None:
            # Use the pre-built map for O(1) lookup
            for wwpn in wwpns:
                wwpn_normalized = wwpn.replace(':', '').upper()
                storage_info = wwpn_storage_map.get(wwpn_normalized)
                if storage_info:
                    return storage_info
            return None

        # Fallback to individual query (only used when map is not provided)
        # This preserves backward compatibility but is slower
        customer_id = self.context.get('customer_id')

        if not customer_id:
            # Fallback: try to get customer from fabric relationship
            if obj.fabric and hasattr(obj.fabric, 'customer_id'):
                customer_id = obj.fabric.customer_id

        try:
            from storage.models import Port

            # Look up ports with matching WWPNs for the customer
            query = Port.objects.select_related('storage').filter(
                wwpn__isnull=False
            )

            # Filter by customer if available
            if customer_id:
                query = query.filter(storage__customer_id=customer_id)

            # Normalize all alias WWPNs for comparison
            alias_wwpns_normalized = [w.replace(':', '').upper() for w in wwpns]

            # Find matching port by normalized WWPN (check all WWPNs in the alias)
            for port in query:
                if port.wwpn:
                    port_wwpn_normalized = port.wwpn.replace(':', '').upper()
                    if port_wwpn_normalized in alias_wwpns_normalized:
                        # Found matching port with storage
                        if port.storage:
                            return {"id": port.storage.id, "name": port.storage.name}
                        break

            # No matching port found
            return None

        except Exception as e:
            # Log the error but don't break the API
            print(f"Error looking up storage for alias {obj.name} via port WWPN: {e}")
            return None

    def get_zoned_count(self, obj):
        """Count how many zones in the current project contain this alias"""
        # Use prefetched data if available to avoid N+1 queries
        if hasattr(obj, '_zoned_count'):
            return obj._zoned_count

        # Get project_id from context (passed from the view)
        project_id = self.context.get('project_id')

        if project_id:
            # Count zones in this project that contain this alias
            try:
                count = Zone.objects.filter(
                    projects__id=project_id,
                    members=obj
                ).count()
                return count
            except Exception as e:
                # Log the error but don't break the API
                print(f"Error calculating zoned_count for alias {obj.name}: {e}")
                return 0

        return 0

    def create(self, validated_data):
        """Create alias and properly handle many-to-many projects and WWPNs"""
        projects = validated_data.pop("projects", [])
        wwpns_list = validated_data.pop("wwpns_write", [])

        alias = Alias.objects.create(**validated_data)
        alias.projects.set(projects)  # ✅ Assign multiple projects

        # Create AliasWWPN entries
        for order, wwpn in enumerate(wwpns_list):
            AliasWWPN.objects.create(
                alias=alias,
                wwpn=wwpn,
                order=order
            )

        return alias

    def update(self, instance, validated_data):
        """Update alias and handle many-to-many projects and WWPNs"""
        projects = validated_data.pop("projects", None)
        wwpns_list = validated_data.pop("wwpns_write", None)

        updated = False

        for attr, value in validated_data.items():
            old_value = getattr(instance, attr)
            if old_value != value:
                setattr(instance, attr, value)
                updated = True

        if updated:
            from django.utils import timezone
            instance.updated = timezone.now()

        instance.save()

        if projects is not None:
            instance.projects.set(projects)

        # Update WWPNs if provided
        if wwpns_list is not None:
            # Clear existing WWPNs and recreate
            instance.alias_wwpns.all().delete()
            for order, wwpn in enumerate(wwpns_list):
                AliasWWPN.objects.create(
                    alias=instance,
                    wwpn=wwpn,
                    order=order
                )

        return instance

class ZoneSerializer(serializers.ModelSerializer):
    projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )  # ✅ Allows multiple projects

    members = serializers.PrimaryKeyRelatedField(
        queryset=Alias.objects.all(), many=True, required=False
    )  # ✅ Allows multiple aliases as members

    members_details = serializers.SerializerMethodField()  # ✅ Add this line

    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True
    )  # ✅ Allows assigning fabric by ID

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details
    
    class Meta:
        model = Zone
        fields = "__all__"

    def get_members_details(self, obj):
        """
        Return a list of member alias details including use type.

        PERFORMANCE: This method relies on prefetch_related('members') being called
        in the view queryset. When properly prefetched, this accesses cached data
        instead of making additional database queries.
        """
        # Access prefetched members (already loaded in memory from view's Prefetch)
        # Using .all() on a prefetched relation does NOT trigger a new query
        members = obj.members.all()
        return [{"id": alias.id, "name": alias.name, "alias_details": {"use": alias.use}} for alias in members]
    
    def create(self, validated_data):
        """Create zone and properly handle many-to-many fields"""
        projects = validated_data.pop("projects", [])
        members = validated_data.pop("members", [])

        zone = Zone.objects.create(**validated_data)
        zone.projects.add(*projects)  # ✅ Append projects instead of overwriting
        zone.members.add(*members)  # ✅ Append members instead of overwriting
        return zone

    def update(self, instance, validated_data):
        """Update zone and properly handle many-to-many fields"""
        projects = validated_data.pop("projects", None)
        members = validated_data.pop("members", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if projects is not None:
            instance.projects.add(*projects)  # ✅ Append instead of overwriting

        if members is not None:
            instance.members.add(*members)  # ✅ Append instead of overwriting

        return instance


class WwpnPrefixSerializer(serializers.ModelSerializer):
    wwpn_type_display = serializers.CharField(source='get_wwpn_type_display', read_only=True)
    
    class Meta:
        model = WwpnPrefix
        fields = ['id', 'prefix', 'wwpn_type', 'wwpn_type_display', 
                 'vendor', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'wwpn_type_display']