from rest_framework import serializers
from .models import Storage, Volume, Host, HostWwpn
from customers.serializers import CustomerSerializer

class StorageSerializer(serializers.ModelSerializer):
    # expose the calculated counts
    db_volumes_count = serializers.IntegerField(read_only=True)
    db_hosts_count = serializers.IntegerField(read_only=True)
    db_aliases_count = serializers.IntegerField(read_only=True)

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