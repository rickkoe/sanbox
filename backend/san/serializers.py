from rest_framework import serializers
from .models import Alias, AliasWWPN, Zone, Fabric, WwpnPrefix, Switch, SwitchFabric
from core.models import Project, ProjectAlias, ProjectZone
from storage.models import Host, Storage


class SwitchSerializer(serializers.ModelSerializer):
    fabric_domains = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )  # For writing: [{"fabric_id": 1, "domain_id": 123}, ...]
    fabrics_details = serializers.SerializerMethodField()  # For reading
    fabric_domain_details = serializers.SerializerMethodField()  # For reading with domain IDs
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

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

    def get_project_memberships(self, obj):
        """Return list of projects this switch belongs to"""
        memberships = []
        try:
            for pm in obj.project_memberships.all():
                # If delete_me is True, return 'delete' regardless of action
                action = 'delete' if pm.delete_me else pm.action
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': action
                })
        except Exception as e:
            print(f"Error getting project_memberships for switch {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this switch is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for switch {obj.name}: {e}")
            return False

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
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

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

    def get_project_memberships(self, obj):
        """Return list of projects this fabric belongs to"""
        memberships = []
        try:
            for pm in obj.project_memberships.all():
                # If delete_me is True, return 'delete' regardless of action
                action = 'delete' if pm.delete_me else pm.action
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': action
                })
        except Exception as e:
            print(f"Error getting project_memberships for fabric {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this fabric is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for fabric {obj.name}: {e}")
            return False

    # Note: Switch-fabric relationships with domain IDs are managed through
    # the SwitchSerializer or the SwitchFabric model directly


class AliasSerializer(serializers.ModelSerializer):
    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True  # ✅ Allow writing fabric (ID) in request
    )

    host = serializers.PrimaryKeyRelatedField(
        queryset=Host.objects.all(), required=False, allow_null=True
    )  # ✅ Allow writing host (ID) in request

    storage = serializers.PrimaryKeyRelatedField(
        queryset=Storage.objects.all(), required=False, allow_null=True
    )  # ✅ Allow writing storage (ID) in request

    created_by_project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), required=False, allow_null=True
    )

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

    # Zoned count field
    zoned_count = serializers.SerializerMethodField()

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    # Junction table fields for active project (for easy access in UI)
    action = serializers.SerializerMethodField()
    include_in_zoning = serializers.SerializerMethodField()
    do_not_include_in_zoning = serializers.SerializerMethodField()

    class Meta:
        model = Alias
        fields = [
            'id', 'fabric', 'fabric_details', 'storage', 'storage_details',
            'name', 'wwpns', 'wwpns_write', 'wwpn', 'use', 'cisco_alias',
            'logged_in', 'host', 'host_details', 'notes', 'imported', 'updated',
            'committed', 'deployed', 'created_by_project',
            'last_modified_by', 'last_modified_at', 'version', 'zoned_count',
            'project_memberships', 'in_active_project',
            'action', 'include_in_zoning', 'do_not_include_in_zoning'
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
        """Count how many zones in the current project contain this alias

        Performance optimized: Uses pre-built project_zone_ids from context
        to avoid repeated database queries.
        """
        # Use prefetched data if available to avoid N+1 queries
        if hasattr(obj, '_zoned_count'):
            return obj._zoned_count

        # Get project_id from context (passed from the view)
        project_id = self.context.get('project_id')

        if project_id:
            # Count zones in this project that contain this alias
            try:
                # OPTIMIZATION: Check if view provided pre-built project_zone_ids
                project_zone_ids = self.context.get('project_zone_ids')

                if project_zone_ids is not None:
                    # PERFORMANCE CRITICAL: Use pre-built alias_zones_map to avoid N+1 queries
                    try:
                        # Check if view provided pre-built alias→zones map
                        alias_zones_map = self.context.get('alias_zones_map')

                        if alias_zones_map is not None:
                            # Ultra-fast path: O(1) lookup in pre-built map
                            alias_zone_ids = alias_zones_map.get(obj.id, set())
                            count = len(project_zone_ids & alias_zone_ids)
                            return count

                        # Fallback: Try to use prefetched data
                        if hasattr(obj, '_prefetched_objects_cache') and 'zone_set' in obj._prefetched_objects_cache:
                            alias_zone_ids = set(z.id for z in obj.zone_set.all())
                            count = len(project_zone_ids & alias_zone_ids)
                            return count

                        # Last resort: Direct count query (one query per alias - slow!)
                        count = Zone.objects.filter(
                            id__in=project_zone_ids,
                            members=obj
                        ).count()
                        return count

                    except Exception as e:
                        # Fallback to direct count
                        count = Zone.objects.filter(
                            id__in=project_zone_ids,
                            members=obj
                        ).count()
                        return count

                # Fallback: Query database (slower, for backward compatibility)
                from core.models import ProjectZone
                project_zone_ids_query = ProjectZone.objects.filter(project_id=project_id).values_list('zone_id', flat=True)
                count = Zone.objects.filter(
                    id__in=project_zone_ids_query,
                    members=obj
                ).count()
                return count
            except Exception as e:
                # Log the error but don't break the API
                print(f"Error calculating zoned_count for alias {obj.name}: {e}")
                return 0

        return 0

    def get_project_memberships(self, obj):
        """Return list of projects this alias belongs to"""
        memberships = []
        try:
            # Use prefetched data if available (from view's prefetch_related)
            for pm in obj.project_memberships.all():
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': pm.action,
                    'include_in_zoning': getattr(pm, 'include_in_zoning', False)
                })
        except Exception as e:
            print(f"Error getting project_memberships for alias {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this alias is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            # Use prefetched data if available
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for alias {obj.name}: {e}")
            return False

    def get_action(self, obj):
        """Get the action for this alias in the active project"""
        active_project_id = self.context.get('active_project_id') or self.context.get('project_id')
        if not active_project_id:
            return 'unmodified'
        try:
            pm = obj.project_memberships.filter(project_id=active_project_id).first()
            if not pm:
                return 'unmodified'
            # If delete_me is True, return 'delete' regardless of action
            if pm.delete_me:
                return 'delete'
            return pm.action
        except Exception as e:
            print(f"Error getting action for alias {obj.name}: {e}")
            return 'unmodified'

    def get_include_in_zoning(self, obj):
        """Get include_in_zoning flag for this alias in the active project"""
        active_project_id = self.context.get('active_project_id') or self.context.get('project_id')
        if not active_project_id:
            return False
        try:
            pm = obj.project_memberships.filter(project_id=active_project_id).first()
            return pm.include_in_zoning if pm else False
        except Exception as e:
            print(f"Error getting include_in_zoning for alias {obj.name}: {e}")
            return False

    def get_do_not_include_in_zoning(self, obj):
        """Get do_not_include_in_zoning flag for this alias in the active project"""
        active_project_id = self.context.get('active_project_id') or self.context.get('project_id')
        if not active_project_id:
            return False
        try:
            pm = obj.project_memberships.filter(project_id=active_project_id).first()
            return pm.do_not_include_in_zoning if pm else False
        except Exception as e:
            print(f"Error getting do_not_include_in_zoning for alias {obj.name}: {e}")
            return False

    def create(self, validated_data):
        """Create alias and properly handle WWPNs"""
        wwpns_list = validated_data.pop("wwpns_write", [])

        alias = Alias.objects.create(**validated_data)

        # Create AliasWWPN entries
        for order, wwpn in enumerate(wwpns_list):
            AliasWWPN.objects.create(
                alias=alias,
                wwpn=wwpn,
                order=order
            )

        return alias

    def update(self, instance, validated_data):
        """Update alias and handle WWPNs"""
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
    members = serializers.PrimaryKeyRelatedField(
        queryset=Alias.objects.all(), many=True, required=False
    )  # ✅ Allows multiple aliases as members

    members_details = serializers.SerializerMethodField()  # ✅ Add this line

    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True
    )  # ✅ Allows assigning fabric by ID

    created_by_project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), required=False, allow_null=True
    )

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    # Junction table fields for active project (for easy access in UI)
    action = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = [
            'id', 'fabric', 'fabric_details', 'name', 'exists', 'zone_type',
            'members', 'members_details', 'notes', 'imported', 'updated',
            'committed', 'deployed', 'created_by_project',
            'last_modified_by', 'last_modified_at', 'version',
            'project_memberships', 'in_active_project',
            'action'
        ]

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

    def get_project_memberships(self, obj):
        """Return list of projects this zone belongs to"""
        memberships = []
        try:
            # Use prefetched data if available (from view's prefetch_related)
            for pm in obj.project_memberships.all():
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': pm.action
                })
        except Exception as e:
            print(f"Error getting project_memberships for zone {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this zone is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            # Use prefetched data if available
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for zone {obj.name}: {e}")
            return False

    def get_action(self, obj):
        """Get the action for this zone in the active project"""
        active_project_id = self.context.get('active_project_id') or self.context.get('project_id')
        if not active_project_id:
            return 'unmodified'
        try:
            pm = obj.project_memberships.filter(project_id=active_project_id).first()
            if not pm:
                return 'unmodified'
            # If delete_me is True, return 'delete' regardless of action
            if pm.delete_me:
                return 'delete'
            return pm.action
        except Exception as e:
            print(f"Error getting action for zone {obj.name}: {e}")
            return 'unmodified'

    def create(self, validated_data):
        """Create zone and properly handle many-to-many fields"""
        members = validated_data.pop("members", [])

        zone = Zone.objects.create(**validated_data)
        zone.members.add(*members)  # ✅ Append members instead of overwriting
        return zone

    def update(self, instance, validated_data):
        """Update zone and properly handle many-to-many fields"""
        members = validated_data.pop("members", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

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


# ========== PROJECT-ENTITY JUNCTION TABLE SERIALIZERS ==========

class ProjectAliasSerializer(serializers.ModelSerializer):
    """Serializer for ProjectAlias junction table"""
    alias_name = serializers.CharField(source='alias.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    added_by_username = serializers.CharField(source='added_by.username', read_only=True)

    class Meta:
        model = ProjectAlias
        fields = [
            'id', 'project', 'project_name', 'alias', 'alias_name',
            'action', 'field_overrides', 'include_in_zoning', 'do_not_include_in_zoning',
            'added_by', 'added_by_username', 'added_at', 'updated_at', 'notes'
        ]
        read_only_fields = ['added_at', 'updated_at']


class ProjectZoneSerializer(serializers.ModelSerializer):
    """Serializer for ProjectZone junction table"""
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    added_by_username = serializers.CharField(source='added_by.username', read_only=True)

    class Meta:
        model = ProjectZone
        fields = [
            'id', 'project', 'project_name', 'zone', 'zone_name',
            'action', 'field_overrides',
            'added_by', 'added_by_username', 'added_at', 'updated_at', 'notes'
        ]
        read_only_fields = ['added_at', 'updated_at']