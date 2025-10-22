from rest_framework import serializers
from .models import Alias, Zone, Fabric, WwpnPrefix, Switch
from core.models import Project
from storage.models import Host, Storage


class SwitchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Switch
        fields = '__all__'


class FabricSerializer(serializers.ModelSerializer):
    switch_details = serializers.SerializerMethodField()  # For displaying switch name
    alias_count = serializers.SerializerMethodField()  # Count of aliases in this fabric
    zone_count = serializers.SerializerMethodField()  # Count of zones in this fabric

    class Meta:
        model = Fabric
        fields = '__all__'

    def get_switch_details(self, obj):
        """Return switch name for display"""
        if obj.switch:
            return {"id": obj.switch.id, "name": obj.switch.name}
        return None

    def get_alias_count(self, obj):
        """Return count of aliases in this fabric"""
        return obj.alias_set.count()

    def get_zone_count(self, obj):
        """Return count of zones in this fabric"""
        return obj.zone_set.count()


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

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details
    host_details = serializers.SerializerMethodField()  # ✅ Return host name for display
    storage_details = serializers.SerializerMethodField()  # ✅ Return storage name for display
    
    # ADD THIS: Zoned count field
    zoned_count = serializers.SerializerMethodField()

    class Meta:
        model = Alias
        fields = "__all__"  # ✅ Includes both `fabric` (ID) and `fabric_details` (full object)

    def get_host_details(self, obj):
        """Return host name for display"""
        if obj.host:
            return {"id": obj.host.id, "name": obj.host.name}
        return None

    def get_storage_details(self, obj):
        """
        Return storage name by looking up the port with matching WWPN.
        Lookup chain: Alias.wwpn → Port.wwpn → Port.storage → Storage.name
        """
        if not obj.wwpn:
            return None

        # Get customer_id from context (passed from the view)
        customer_id = self.context.get('customer_id')

        if not customer_id:
            # Fallback: try to get customer from fabric relationship
            if obj.fabric and hasattr(obj.fabric, 'customer_id'):
                customer_id = obj.fabric.customer_id

        try:
            from storage.models import Port

            # Normalize WWPN for comparison (remove colons, uppercase)
            alias_wwpn_normalized = obj.wwpn.replace(':', '').upper()

            # Look up port with matching WWPN for the customer
            query = Port.objects.select_related('storage').filter(
                wwpn__isnull=False
            )

            # Filter by customer if available
            if customer_id:
                query = query.filter(storage__customer_id=customer_id)

            # Find matching port by normalized WWPN
            for port in query:
                if port.wwpn:
                    port_wwpn_normalized = port.wwpn.replace(':', '').upper()
                    if port_wwpn_normalized == alias_wwpn_normalized:
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
        """Create alias and properly handle many-to-many projects"""
        projects = validated_data.pop("projects", [])
        alias = Alias.objects.create(**validated_data)
        alias.projects.set(projects)  # ✅ Assign multiple projects
        return alias

    def update(self, instance, validated_data):
        """Update alias and handle many-to-many projects"""
        projects = validated_data.pop("projects", None)

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