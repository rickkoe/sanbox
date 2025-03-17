from rest_framework import serializers
from .models import Config, Project
from customers.models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__" 

class ProjectSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)

    class Meta:
        model = Project
        fields = "__all__" 

        
class ActiveConfigSerializer(serializers.Serializer):
    """Serializer that queries and returns the active config."""
    def to_representation(self, instance):
        config = Config.get_active_config()  # ✅ Query active config
        if not config:
            return {}  # ✅ Return empty object if no active config found

        return ConfigSerializer(config).data  # ✅ Serialize active config

class ConfigSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    active_project = ProjectSerializer(read_only=True) 
    
    class Meta:
        model = Config
        fields = "__all__" 

    def update(self, instance, validated_data):
        """Ensure project updates correctly"""
        # instance.project = validated_data.get("project", instance.project)  # ✅ Only update the project ID
        instance.san_vendor = validated_data.get("san_vendor", instance.san_vendor)
        instance.cisco_alias = validated_data.get("cisco_alias", instance.cisco_alias)
        instance.cisco_zoning_mode = validated_data.get("cisco_zoning_mode", instance.cisco_zoning_mode)
        instance.zone_ratio = validated_data.get("zone_ratio", instance.zone_ratio)
        instance.zoning_job_name = validated_data.get("zoning_job_name", instance.zoning_job_name)
        instance.smartzone_prefix = validated_data.get("smartzone_prefix", instance.smartzone_prefix)
        instance.alias_max_zones = validated_data.get("alias_max_zones", instance.alias_max_zones)
        instance.save()
        return instance