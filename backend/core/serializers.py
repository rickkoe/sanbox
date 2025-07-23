from rest_framework import serializers
from .models import Config, Project, TableConfiguration
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
    active_project = ProjectSerializer(read_only=True)  # Keeps full object in response
    active_project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), source="active_project", write_only=True, required=False
    )  # Allows updates using only the project id

    class Meta:
        model = Config
        fields = "__all__"  # Includes all fields, including `is_active`

    def update(self, instance, validated_data):
        """Ensure active_project and other fields update correctly"""

        # Handle active_project updates
        if "active_project" in validated_data:
            instance.active_project = validated_data.get("active_project", instance.active_project)

        # Update other fields
        instance.san_vendor = validated_data.get("san_vendor", instance.san_vendor)
        instance.cisco_alias = validated_data.get("cisco_alias", instance.cisco_alias)
        instance.cisco_zoning_mode = validated_data.get("cisco_zoning_mode", instance.cisco_zoning_mode)
        instance.zone_ratio = validated_data.get("zone_ratio", instance.zone_ratio)
        instance.zoning_job_name = validated_data.get("zoning_job_name", instance.zoning_job_name)
        instance.alias_max_zones = validated_data.get("alias_max_zones", instance.alias_max_zones)
        
        # Update is_active if provided
        instance.is_active = validated_data.get("is_active", instance.is_active)
        
        instance.save()
        return instance


class TableConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for table configuration settings"""
    
    class Meta:
        model = TableConfiguration
        fields = [
            'id',
            'customer',
            'user',
            'table_name',
            'visible_columns',
            'column_widths',
            'filters',
            'sorting',
            'page_size',
            'additional_settings',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Ensure visible_columns is a list and filters is a dict"""
        if 'visible_columns' in data and not isinstance(data['visible_columns'], list):
            raise serializers.ValidationError("visible_columns must be a list")
        
        if 'filters' in data and not isinstance(data['filters'], dict):
            raise serializers.ValidationError("filters must be a dictionary")
        
        if 'column_widths' in data and not isinstance(data['column_widths'], dict):
            raise serializers.ValidationError("column_widths must be a dictionary")
        
        if 'sorting' in data and not isinstance(data['sorting'], dict):
            raise serializers.ValidationError("sorting must be a dictionary")
        
        if 'additional_settings' in data and not isinstance(data['additional_settings'], dict):
            raise serializers.ValidationError("additional_settings must be a dictionary")
        
        return data