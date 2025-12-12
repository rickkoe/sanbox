from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Config, Project, TableConfiguration, AppSettings, CustomNamingRule, CustomVariable, UserConfig, EquipmentType, WorksheetTemplate, AuditLog
from customers.models import Customer


class UserSerializer(serializers.ModelSerializer):
    """Simplified user serializer - no permission/membership info needed"""

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'is_superuser', 'date_joined']
        read_only_fields = ['id', 'username', 'is_superuser', 'date_joined']


# CustomerMembershipSerializer removed - no longer needed with simplified permissions
# ProjectGroupSerializer removed - no longer needed with simplified permissions


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__"


class ProjectSerializer(serializers.ModelSerializer):
    """Simplified project serializer - no ownership or group info needed"""
    customers = CustomerSerializer(many=True, read_only=True)  # Show all customers this project belongs to

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
        """Update config fields"""

        # Handle active_project updates
        if "active_project" in validated_data:
            instance.active_project = validated_data.get("active_project", instance.active_project)

        # Update is_active if provided
        instance.is_active = validated_data.get("is_active", instance.is_active)

        instance.save()
        return instance


class UserConfigSerializer(serializers.ModelSerializer):
    """Serializer for per-user configuration with activity tracking"""
    active_customer = CustomerSerializer(read_only=True)
    active_project = ProjectSerializer(read_only=True)
    active_customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source="active_customer",
        write_only=True,
        required=False,
        allow_null=True
    )
    active_project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="active_project",
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = UserConfig
        fields = ['id', 'user', 'active_customer', 'active_customer_id',
                  'active_project', 'active_project_id', 'last_activity_at',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'last_activity_at', 'created_at', 'updated_at']


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


class AppSettingsSerializer(serializers.ModelSerializer):
    """Serializer for application settings"""
    
    class Meta:
        model = AppSettings
        fields = [
            'id',
            'user',
            'theme',
            'items_per_page',
            'compact_mode',
            'auto_refresh',
            'auto_refresh_interval',
            'notifications',
            'show_advanced_features',
            'hide_mode_banners',
            'zone_ratio',
            'alias_max_zones',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def validate_theme(self, value):
        """Validate theme choice"""
        valid_themes = ['light', 'dark', 'auto']
        if value not in valid_themes:
            raise serializers.ValidationError(f"Theme must be one of: {', '.join(valid_themes)}")
        return value
    
    def validate_items_per_page(self, value):
        """Validate items per page is a valid choice"""
        valid_choices = ['25', '50', '100', '250', 'All']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Items per page must be one of: {', '.join(valid_choices)}")
        return value
    
    def validate_auto_refresh_interval(self, value):
        """Validate auto refresh interval is a valid choice"""
        valid_intervals = [15, 30, 60, 300]
        if value not in valid_intervals:
            raise serializers.ValidationError(f"Auto refresh interval must be one of: {', '.join(map(str, valid_intervals))}")
        return value
    
    def validate_zone_ratio(self, value):
        """Validate zone ratio choice"""
        valid_ratios = ['one-to-one', 'one-to-many', 'all-to-all']
        if value not in valid_ratios:
            raise serializers.ValidationError(f"Zone ratio must be one of: {', '.join(valid_ratios)}")
        return value
    
    def validate_alias_max_zones(self, value):
        """Validate alias max zones is a positive integer"""
        if value < 1:
            raise serializers.ValidationError("Alias max zones must be at least 1")
        return value


class CustomNamingRuleSerializer(serializers.ModelSerializer):
    """Serializer for custom naming rules"""
    
    class Meta:
        model = CustomNamingRule
        fields = [
            'id',
            'customer',
            'user',
            'name',
            'table_name',
            'pattern',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_pattern(self, value):
        """Validate that pattern is a list of objects with type and value"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Pattern must be a list")
        
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each pattern item must be an object")
            
            if 'type' not in item or 'value' not in item:
                raise serializers.ValidationError("Each pattern item must have 'type' and 'value' fields")
            
            valid_types = ['text', 'column', 'variable']
            if item['type'] not in valid_types:
                raise serializers.ValidationError(f"Pattern type must be one of: {', '.join(valid_types)}")
        
        return value


class CustomVariableSerializer(serializers.ModelSerializer):
    """Serializer for custom variables"""
    
    class Meta:
        model = CustomVariable
        fields = [
            'id',
            'customer',
            'user',
            'name',
            'value',
            'description',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_name(self, value):
        """Ensure variable name is valid identifier"""
        if not value.isidentifier():
            raise serializers.ValidationError("Variable name must be a valid identifier (letters, numbers, underscore, no spaces)")
        return value


# ========== WORKSHEET GENERATOR SERIALIZERS ==========

class EquipmentTypeSerializer(serializers.ModelSerializer):
    """Serializer for equipment types"""

    class Meta:
        model = EquipmentType
        fields = [
            'id',
            'name',
            'category',
            'vendor',
            'description',
            'fields_schema',
            'is_active',
            'icon_name',
            'display_order',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_fields_schema(self, value):
        """Validate fields_schema structure"""
        if not isinstance(value, list):
            raise serializers.ValidationError("fields_schema must be a list")

        for field in value:
            if not isinstance(field, dict):
                raise serializers.ValidationError("Each field in fields_schema must be an object")

            required_keys = ['name', 'label', 'type']
            for key in required_keys:
                if key not in field:
                    raise serializers.ValidationError(f"Each field must have '{key}' property")

            valid_types = ['text', 'number', 'select', 'date', 'textarea']
            if field['type'] not in valid_types:
                raise serializers.ValidationError(f"Field type must be one of: {', '.join(valid_types)}")

            # If type is select, options must be provided
            if field['type'] == 'select' and 'options' not in field:
                raise serializers.ValidationError("Select fields must have 'options' property")

        return value


class WorksheetTemplateSerializer(serializers.ModelSerializer):
    """Serializer for worksheet templates"""
    equipment_types_details = EquipmentTypeSerializer(source='equipment_types', many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = WorksheetTemplate
        fields = [
            'id',
            'name',
            'customer',
            'customer_name',
            'user',
            'user_name',
            'description',
            'equipment_types',
            'equipment_types_details',
            'template_config',
            'is_default',
            'is_global',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_template_config(self, value):
        """Validate template_config structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("template_config must be a dictionary")

        # Validate equipment list if present
        if 'equipment' in value:
            if not isinstance(value['equipment'], list):
                raise serializers.ValidationError("template_config.equipment must be a list")

            for equip in value['equipment']:
                if not isinstance(equip, dict):
                    raise serializers.ValidationError("Each equipment item must be an object")

                required_keys = ['type_id', 'quantity']
                for key in required_keys:
                    if key not in equip:
                        raise serializers.ValidationError(f"Each equipment item must have '{key}' property")

        return value


# ========== AUDIT LOG SERIALIZER ==========

class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'timestamp',
            'user',
            'user_username',
            'user_full_name',
            'action_type',
            'entity_type',
            'entity_name',
            'customer',
            'customer_name',
            'summary',
            'details',
            'status',
            'duration_seconds',
            'ip_address'
        ]
        read_only_fields = fields  # All fields are read-only

    def get_user_full_name(self, obj):
        """Get user's full name or username"""
        if not obj.user:
            return "System"
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name if full_name else obj.user.username