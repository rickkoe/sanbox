from rest_framework import serializers
from .models import Storage, Volume, Host, HostWwpn, Port, Pool
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


class HostWwpnSerializer(serializers.ModelSerializer):
    source_alias_name = serializers.CharField(source='source_alias.name', read_only=True)
    
    class Meta:
        model = HostWwpn
        fields = ['id', 'wwpn', 'source_type', 'source_alias_name', 'source_alias', 'created_at']


class HostSerializer(serializers.ModelSerializer):
    wwpn_details = serializers.SerializerMethodField()
    wwpn_display = serializers.SerializerMethodField()

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
        if obj.project:
            return {
                "id": obj.project.id,
                "name": obj.project.name
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