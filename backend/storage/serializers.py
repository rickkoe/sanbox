from rest_framework import serializers
from .models import Storage, Volume, Host, HostWwpn, Port, Pool, HostCluster, IBMiLPAR, VolumeMapping
from customers.serializers import CustomerSerializer
from core.models import TableConfiguration

class StorageSerializer(serializers.ModelSerializer):
    # expose the calculated counts
    db_volumes_count = serializers.IntegerField(read_only=True)
    db_hosts_count = serializers.IntegerField(read_only=True)
    db_aliases_count = serializers.IntegerField(read_only=True)
    db_ports_count = serializers.IntegerField(read_only=True)

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = Storage
        fields = '__all__'

    def get_project_memberships(self, obj):
        """Return list of projects this storage system belongs to"""
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
            print(f"Error getting project_memberships for storage {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this storage system is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for storage {obj.name}: {e}")
            return False


class VolumeSerializer(serializers.ModelSerializer):
    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()
    # Pool field - use name for display, handled in validate
    pool = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Volume
        fields = '__all__'

    def to_representation(self, instance):
        """Return storage and pool names instead of IDs for display"""
        ret = super().to_representation(instance)
        # Return storage name for display (keep storage_id for saving)
        ret['storage_id'] = instance.storage_id
        ret['storage'] = instance.storage.name if instance.storage else None
        # Return pool name for display
        ret['pool'] = instance.pool.name if instance.pool else None
        return ret

    def validate_pool(self, value):
        """Convert pool name to Pool instance, scoped to the volume's storage"""
        if not value:
            return None
        # Get storage from the request data or existing instance
        storage_id = self.initial_data.get('storage')
        if not storage_id and self.instance:
            storage_id = self.instance.storage_id
        if storage_id:
            try:
                return Pool.objects.get(storage_id=storage_id, name=value)
            except Pool.DoesNotExist:
                # Pool not found - could be new or wrong name, return None
                return None
        return None

    def get_project_memberships(self, obj):
        """Return list of projects this volume belongs to"""
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
            print(f"Error getting project_memberships for volume {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this volume is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for volume {obj.name}: {e}")
            return False

    def validate(self, data):
        """Validate DS8000-specific field combinations"""
        format_type = data.get('format', getattr(self.instance, 'format', None))
        os400_type = data.get('os400_type')
        ckd_datatype = data.get('ckd_datatype')
        ckd_capacity_type = data.get('ckd_capacity_type')

        # OS/400 type only valid for FB volumes
        if os400_type and format_type != 'FB':
            raise serializers.ValidationError({
                'os400_type': 'OS/400 type is only valid for FB format volumes.'
            })

        # CKD datatype only valid for CKD volumes
        if ckd_datatype and format_type != 'CKD':
            raise serializers.ValidationError({
                'ckd_datatype': 'CKD datatype is only valid for CKD format volumes.'
            })

        # CKD capacity type only valid for CKD volumes
        if ckd_capacity_type and ckd_capacity_type != 'bytes' and format_type != 'CKD':
            raise serializers.ValidationError({
                'ckd_capacity_type': 'Cylinder/Mod1 capacity type is only valid for CKD volumes.'
            })

        # 3380 volumes have limited cylinder counts
        if ckd_datatype == '3380':
            capacity_cyl = data.get('capacity_cylinders')
            if capacity_cyl and capacity_cyl > 3339:
                raise serializers.ValidationError({
                    'capacity_cylinders': '3380 volumes are limited to 3339 cylinders maximum.'
                })

        return data


class HostWwpnSerializer(serializers.ModelSerializer):
    source_alias_name = serializers.CharField(source='source_alias.name', read_only=True)
    
    class Meta:
        model = HostWwpn
        fields = ['id', 'wwpn', 'source_type', 'source_alias_name', 'source_alias', 'created_at']


class HostSerializer(serializers.ModelSerializer):
    wwpn_details = serializers.SerializerMethodField()
    wwpn_display = serializers.SerializerMethodField()
    volume_count = serializers.SerializerMethodField()

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = Host
        fields = '__all__'

    def get_wwpn_details(self, obj):
        """Return detailed WWPN information with source tracking"""
        return obj.get_all_wwpns()

    def get_wwpn_display(self, obj):
        """Return comma-separated WWPN string for table display"""
        return obj.get_wwpn_display_string()

    def get_volume_count(self, obj):
        """
        Return the count of volumes mapped to this host.

        Counts volumes from:
        1. Direct host mappings (target_type='host', target_host=this host)
        2. LPAR mappings assigned to this host (target_type='lpar', assigned_host=this host)
        3. Cluster mappings where this host is a member (target_type='cluster')

        Filtering:
        - Customer View (no active_project_id): Only committed mappings
        - Project View: Committed mappings + mappings in the active project
        """
        from storage.models import VolumeMapping
        from django.db.models import Q

        active_project_id = self.context.get('active_project_id')
        is_project_view = self.context.get('is_project_view', False)

        try:
            # Base query: mappings where this host is the target
            # Either directly, via LPAR assignment, or via cluster membership
            cluster_ids = list(obj.clusters.values_list('id', flat=True))

            base_q = Q(target_host=obj) | Q(assigned_host=obj)
            if cluster_ids:
                base_q |= Q(target_cluster_id__in=cluster_ids)

            if is_project_view and active_project_id:
                # Project View: Show committed + in active project
                from core.models import ProjectVolumeMapping
                project_mapping_ids = ProjectVolumeMapping.objects.filter(
                    project_id=active_project_id
                ).values_list('volume_mapping_id', flat=True)

                count = VolumeMapping.objects.filter(base_q).filter(
                    Q(committed=True) | Q(id__in=project_mapping_ids)
                ).count()
            else:
                # Customer View: Only committed mappings
                count = VolumeMapping.objects.filter(base_q).filter(
                    committed=True
                ).count()

            return count
        except Exception as e:
            print(f"Error getting volume_count for host {obj.name}: {e}")
            return 0

    def get_project_memberships(self, obj):
        """Return list of projects this host belongs to"""
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
            print(f"Error getting project_memberships for host {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this host is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for host {obj.name}: {e}")
            return False


class PortSerializer(serializers.ModelSerializer):
    # Read-only nested serializers for display
    storage_details = serializers.SerializerMethodField()
    fabric_details = serializers.SerializerMethodField()
    alias_details = serializers.SerializerMethodField()
    project_details = serializers.SerializerMethodField()

    # Include storage_type for frontend dynamic dropdown logic
    storage_type = serializers.CharField(source='storage.storage_type', read_only=True)

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = Port
        fields = '__all__'

    def get_storage_details(self, obj):
        """Return storage name and type for display"""
        if obj.storage:
            return {
                "id": obj.storage.id,
                "name": obj.storage.name,
                "storage_type": obj.storage.storage_type
            }
        return None

    def get_fabric_details(self, obj):
        """Return fabric name for display"""
        if obj.fabric:
            return {
                "id": obj.fabric.id,
                "name": obj.fabric.name
            }
        return None

    def get_alias_details(self, obj):
        """Return alias name for display"""
        if obj.alias:
            return {
                "id": obj.alias.id,
                "name": obj.alias.name,
                "wwpn": obj.alias.wwpn
            }
        return None

    def get_project_details(self, obj):
        """Return project name for display"""
        if obj.created_by_project:
            return {
                "id": obj.created_by_project.id,
                "name": obj.created_by_project.name
            }
        return None

    def get_project_memberships(self, obj):
        """Return list of projects this port belongs to"""
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
            print(f"Error getting project_memberships for port {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this port is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for port {obj.name}: {e}")
            return False


class PoolSerializer(serializers.ModelSerializer):
    """Serializer for Pool model with project membership tracking"""
    # Computed fields
    db_volumes_count = serializers.IntegerField(read_only=True)
    storage_name = serializers.CharField(source='storage.name', read_only=True)
    storage_system_type = serializers.CharField(source='storage.storage_type', read_only=True)

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = Pool
        fields = '__all__'

    def get_project_memberships(self, obj):
        """Return list of projects this pool belongs to"""
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
            print(f"Error getting project_memberships for pool {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this pool is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for pool {obj.name}: {e}")
            return False


class StorageFieldPreferenceSerializer(serializers.Serializer):
    """Serializer for storage detail field preferences"""
    visible_columns = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        help_text="List of visible field names for storage detail view"
    )

    def save(self, customer, user):
        """Save field preferences to TableConfiguration"""
        visible_columns = self.validated_data.get('visible_columns', [])

        config, created = TableConfiguration.objects.update_or_create(
            customer=customer,
            user=user,
            table_name='storage_detail',
            defaults={'visible_columns': visible_columns}
        )

        return config

    @staticmethod
    def get_preferences(customer, user):
        """Get field preferences from TableConfiguration"""
        config = TableConfiguration.objects.filter(
            customer=customer,
            user=user,
            table_name='storage_detail'
        ).first()

        if config and config.visible_columns:
            return {'visible_columns': config.visible_columns}

        # Return default fields if no preferences found
        return {
            'visible_columns': [
                'name', 'storage_type', 'vendor', 'serial_number',
                'location', 'firmware_level', 'condition',
                'capacity_bytes', 'used_capacity_percent', 'available_capacity_bytes'
            ]
        }


class HostClusterSerializer(serializers.ModelSerializer):
    """Serializer for HostCluster model with project membership tracking"""
    # Computed fields
    host_count = serializers.IntegerField(read_only=True)
    volume_count = serializers.IntegerField(read_only=True)
    storage_name = serializers.CharField(source='storage.name', read_only=True)
    storage_type = serializers.CharField(source='storage.storage_type', read_only=True)

    # Host details for display
    hosts_details = serializers.SerializerMethodField()

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = HostCluster
        fields = '__all__'

    def get_hosts_details(self, obj):
        """Return list of hosts in this cluster"""
        return [
            {'id': host.id, 'name': host.name}
            for host in obj.hosts.all()
        ]

    def get_project_memberships(self, obj):
        """Return list of projects this host cluster belongs to"""
        memberships = []
        try:
            for pm in obj.project_memberships.all():
                action = 'delete' if pm.delete_me else pm.action
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': action
                })
        except Exception as e:
            print(f"Error getting project_memberships for host cluster {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this host cluster is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for host cluster {obj.name}: {e}")
            return False


class IBMiLPARSerializer(serializers.ModelSerializer):
    """Serializer for IBMiLPAR model with project membership tracking"""
    # Computed fields
    host_count = serializers.IntegerField(read_only=True)
    volume_count = serializers.IntegerField(read_only=True)
    storage_name = serializers.CharField(source='storage.name', read_only=True)
    storage_type = serializers.CharField(source='storage.storage_type', read_only=True)

    # Host details for display
    hosts_details = serializers.SerializerMethodField()

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = IBMiLPAR
        fields = '__all__'

    def get_hosts_details(self, obj):
        """Return list of hosts in this LPAR"""
        return [
            {'id': host.id, 'name': host.name}
            for host in obj.hosts.all()
        ]

    def get_project_memberships(self, obj):
        """Return list of projects this LPAR belongs to"""
        memberships = []
        try:
            for pm in obj.project_memberships.all():
                action = 'delete' if pm.delete_me else pm.action
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': action
                })
        except Exception as e:
            print(f"Error getting project_memberships for LPAR {obj.name}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this LPAR is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for LPAR {obj.name}: {e}")
            return False


class VolumeMappingSerializer(serializers.ModelSerializer):
    """Serializer for VolumeMapping model with project membership tracking"""
    # Volume details
    volume_name = serializers.CharField(source='volume.name', read_only=True)
    volume_id_hex = serializers.CharField(source='volume.volume_id', read_only=True)
    storage_name = serializers.CharField(source='volume.storage.name', read_only=True)

    # Target details
    target_name = serializers.SerializerMethodField()
    target_details = serializers.SerializerMethodField()

    # Assigned host details (for LPAR mappings)
    assigned_host_name = serializers.CharField(source='assigned_host.name', read_only=True)

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = VolumeMapping
        fields = '__all__'

    def get_target_name(self, obj):
        """Return the target's name"""
        return obj.get_target_name()

    def get_target_details(self, obj):
        """Return detailed info about the target"""
        target = obj.get_target()
        if not target:
            return None

        result = {
            'id': target.id,
            'name': target.name,
            'type': obj.target_type
        }

        # Add host count for clusters and LPARs
        if obj.target_type in ('cluster', 'lpar'):
            result['host_count'] = target.host_count

        return result

    def get_project_memberships(self, obj):
        """Return list of projects this mapping belongs to"""
        memberships = []
        try:
            for pm in obj.project_memberships.all():
                action = 'delete' if pm.delete_me else pm.action
                memberships.append({
                    'project_id': pm.project.id,
                    'project_name': pm.project.name,
                    'action': action
                })
        except Exception as e:
            print(f"Error getting project_memberships for mapping {obj}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this mapping is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for mapping {obj}: {e}")
            return False