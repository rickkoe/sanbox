from rest_framework import serializers
from .models import Storage, Volume, Host, HostWwpn, Port, Pool, HostCluster, IBMiLPAR, VolumeMapping, PPRCPath, PPRCReplicationGroup, PPRCGroupLSSMapping, LSSSummary
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


class PPRCPathSerializer(serializers.ModelSerializer):
    """Serializer for PPRCPath model - bidirectional replication connections between ports"""

    # Port details for display
    port1_details = serializers.SerializerMethodField()
    port2_details = serializers.SerializerMethodField()

    # Convenience fields
    is_same_storage = serializers.BooleanField(read_only=True)
    is_cross_fabric = serializers.SerializerMethodField()

    # Replication group details
    replication_group_details = serializers.SerializerMethodField()

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = PPRCPath
        fields = '__all__'

    def get_port1_details(self, obj):
        """Return port1 details including storage and fabric info"""
        if obj.port1:
            return {
                'id': obj.port1.id,
                'name': obj.port1.name,
                'wwpn': obj.port1.wwpn,
                'port_id': obj.port1.port_id,
                'frame': obj.port1.frame,
                'io_enclosure': obj.port1.io_enclosure,
                'storage_id': obj.port1.storage.id,
                'storage_name': obj.port1.storage.name,
                'fabric_id': obj.port1.fabric_id,
                'fabric_name': obj.port1.fabric.name if obj.port1.fabric else None,
            }
        return None

    def get_port2_details(self, obj):
        """Return port2 details including storage and fabric info"""
        if obj.port2:
            return {
                'id': obj.port2.id,
                'name': obj.port2.name,
                'wwpn': obj.port2.wwpn,
                'port_id': obj.port2.port_id,
                'frame': obj.port2.frame,
                'io_enclosure': obj.port2.io_enclosure,
                'storage_id': obj.port2.storage.id,
                'storage_name': obj.port2.storage.name,
                'fabric_id': obj.port2.fabric_id,
                'fabric_name': obj.port2.fabric.name if obj.port2.fabric else None,
            }
        return None

    def get_is_cross_fabric(self, obj):
        """Returns True if ports are in different fabrics"""
        if obj.port1 and obj.port2:
            fabric1 = obj.port1.fabric_id
            fabric2 = obj.port2.fabric_id
            # Only cross-fabric if both have fabrics and they differ
            if fabric1 and fabric2:
                return fabric1 != fabric2
        return False

    def get_replication_group_details(self, obj):
        """Return replication group info if this path belongs to one"""
        if obj.replication_group:
            return {
                'id': obj.replication_group.id,
                'group_number': obj.replication_group.group_number,
                'name': obj.replication_group.name,
                'lss_mode': obj.replication_group.lss_mode,
            }
        return None

    def get_project_memberships(self, obj):
        """Return list of projects this PPRC path belongs to"""
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
            print(f"Error getting project_memberships for PPRC path {obj}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this PPRC path is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for PPRC path {obj}: {e}")
            return False

    def validate(self, data):
        """Validate PPRC path constraints"""
        port1 = data.get('port1')
        port2 = data.get('port2')

        if port1 and port2:
            # Ensure both ports are from DS8000 storage systems
            if port1.storage.storage_type != 'DS8000':
                raise serializers.ValidationError({
                    'port1': 'PPRC paths are only supported for DS8000 storage systems.'
                })
            if port2.storage.storage_type != 'DS8000':
                raise serializers.ValidationError({
                    'port2': 'PPRC paths are only supported for DS8000 storage systems.'
                })

            # Ensure both ports are FC type
            if port1.type != 'fc':
                raise serializers.ValidationError({
                    'port1': 'PPRC paths require Fibre Channel ports.'
                })
            if port2.type != 'fc':
                raise serializers.ValidationError({
                    'port2': 'PPRC paths require Fibre Channel ports.'
                })

            # Ensure ports are replication-capable
            valid_uses = ['replication', 'both']
            if port1.use not in valid_uses:
                raise serializers.ValidationError({
                    'port1': 'Port must have use set to "replication" or "both".'
                })
            if port2.use not in valid_uses:
                raise serializers.ValidationError({
                    'port2': 'Port must have use set to "replication" or "both".'
                })

            # Ensure both ports belong to same customer
            if port1.storage.customer_id != port2.storage.customer_id:
                raise serializers.ValidationError({
                    'port2': 'Both ports must belong to storage systems under the same customer.'
                })

            # Prevent self-connection (same port)
            if port1.id == port2.id:
                raise serializers.ValidationError({
                    'port2': 'Cannot create a path from a port to itself.'
                })

        return data


class PPRCGroupLSSMappingSerializer(serializers.ModelSerializer):
    """Serializer for PPRCGroupLSSMapping - LSS pairs within a replication group"""

    class Meta:
        model = PPRCGroupLSSMapping
        fields = '__all__'

    def validate(self, data):
        """Validate that source_lss is not already in another group for same storage pair"""
        group = data.get('group') or (self.instance.group if self.instance else None)
        source_lss = data.get('source_lss') or (self.instance.source_lss if self.instance else None)

        if group and source_lss:
            # Check if this source_lss is already assigned to another group for the same storage pair
            existing = PPRCGroupLSSMapping.objects.filter(
                group__source_storage=group.source_storage,
                group__target_storage=group.target_storage,
                source_lss=source_lss
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            if existing.exists():
                raise serializers.ValidationError({
                    'source_lss': f"LSS {source_lss} is already assigned to Group {existing.first().group.group_number}"
                })

        return data


class PPRCReplicationGroupSerializer(serializers.ModelSerializer):
    """Serializer for PPRCReplicationGroup - groups of LSSs that share port-pair configuration"""

    # Nested LSS mappings
    lss_mappings = PPRCGroupLSSMappingSerializer(many=True, read_only=True)

    # Computed fields
    path_count = serializers.SerializerMethodField()
    source_storage_name = serializers.CharField(source='source_storage.name', read_only=True)
    target_storage_name = serializers.CharField(source='target_storage.name', read_only=True)
    is_same_storage = serializers.BooleanField(read_only=True)

    # Project membership fields
    project_memberships = serializers.SerializerMethodField()
    in_active_project = serializers.SerializerMethodField()

    class Meta:
        model = PPRCReplicationGroup
        fields = '__all__'

    def get_path_count(self, obj):
        return obj.paths.count()

    def get_project_memberships(self, obj):
        """Return list of projects this group belongs to"""
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
            print(f"Error getting project_memberships for PPRC group {obj}: {e}")
        return memberships

    def get_in_active_project(self, obj):
        """Check if this group is in the user's active project"""
        active_project_id = self.context.get('active_project_id')
        if not active_project_id:
            return False
        try:
            return obj.project_memberships.filter(project_id=active_project_id).exists()
        except Exception as e:
            print(f"Error checking in_active_project for PPRC group {obj}: {e}")
            return False

    def validate(self, data):
        """Validate replication group constraints"""
        source_storage = data.get('source_storage')
        target_storage = data.get('target_storage')
        lss_mode = data.get('lss_mode', 'all')
        group_number = data.get('group_number', 1)

        if source_storage and target_storage:
            # Ensure both are DS8000
            if source_storage.storage_type != 'DS8000':
                raise serializers.ValidationError({
                    'source_storage': 'Replication groups are only supported for DS8000 storage systems.'
                })
            if target_storage.storage_type != 'DS8000':
                raise serializers.ValidationError({
                    'target_storage': 'Replication groups are only supported for DS8000 storage systems.'
                })

            # Ensure same customer
            if source_storage.customer_id != target_storage.customer_id:
                raise serializers.ValidationError({
                    'target_storage': 'Source and target storage must belong to the same customer.'
                })

            # Check if Group 1 is in "all" mode - if so, no other groups allowed
            if group_number > 1:
                group1 = PPRCReplicationGroup.objects.filter(
                    source_storage=source_storage,
                    target_storage=target_storage,
                    group_number=1
                ).first()
                if group1 and group1.lss_mode == 'all':
                    raise serializers.ValidationError({
                        'group_number': 'Cannot create additional groups when Group 1 is set to "All LSSs" mode.'
                    })

            # If setting Group 1 to "all" mode, delete other groups
            if group_number == 1 and lss_mode == 'all':
                other_groups = PPRCReplicationGroup.objects.filter(
                    source_storage=source_storage,
                    target_storage=target_storage,
                    group_number__gt=1
                )
                if other_groups.exists():
                    raise serializers.ValidationError({
                        'lss_mode': 'Cannot set to "All LSSs" while other groups exist. Delete other groups first.'
                    })

        return data


class LSSSummarySerializer(serializers.ModelSerializer):
    """Serializer for LSSSummary - per-LSS configuration for DS8000"""

    # Computed fields for volume stats
    volume_count = serializers.SerializerMethodField()

    class Meta:
        model = LSSSummary
        fields = '__all__'

    def get_volume_count(self, obj):
        """Count volumes in this LSS"""
        return Volume.objects.filter(
            storage=obj.storage,
            lss_lcu__startswith=obj.lss
        ).count()