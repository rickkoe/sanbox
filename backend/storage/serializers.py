from rest_framework import serializers
from .models import Storage, Volume, Host, HostWwpn, Port
from customers.serializers import CustomerSerializer

class StorageSerializer(serializers.ModelSerializer):
    # expose the calculated counts
    db_volumes_count = serializers.IntegerField(read_only=True)
    db_hosts_count = serializers.IntegerField(read_only=True)
    db_aliases_count = serializers.IntegerField(read_only=True)
    db_ports_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Storage
        fields = '__all__'


class VolumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volume
        fields = '__all__'


class HostWwpnSerializer(serializers.ModelSerializer):
    source_alias_name = serializers.CharField(source='source_alias.name', read_only=True)
    
    class Meta:
        model = HostWwpn
        fields = ['id', 'wwpn', 'source_type', 'source_alias_name', 'source_alias', 'created_at']


class HostSerializer(serializers.ModelSerializer):
    wwpn_details = serializers.SerializerMethodField()
    wwpn_display = serializers.SerializerMethodField()

    class Meta:
        model = Host
        fields = '__all__'

    def get_wwpn_details(self, obj):
        """Return detailed WWPN information with source tracking"""
        return obj.get_all_wwpns()

    def get_wwpn_display(self, obj):
        """Return comma-separated WWPN string for table display"""
        return obj.get_wwpn_display_string()


class PortSerializer(serializers.ModelSerializer):
    # Read-only nested serializers for display
    storage_details = serializers.SerializerMethodField()
    fabric_details = serializers.SerializerMethodField()
    alias_details = serializers.SerializerMethodField()
    project_details = serializers.SerializerMethodField()

    # Include storage_type for frontend dynamic dropdown logic
    storage_type = serializers.CharField(source='storage.storage_type', read_only=True)

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