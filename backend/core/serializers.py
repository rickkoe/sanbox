from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Config, Project, ProjectGroup, TableConfiguration, AppSettings, CustomNamingRule, CustomVariable, CustomerMembership, UserConfig
from customers.models import Customer


class UserSerializer(serializers.ModelSerializer):
    customer_memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'is_superuser', 'date_joined', 'customer_memberships']
        read_only_fields = ['id', 'username', 'is_superuser', 'date_joined']

    def get_customer_memberships(self, obj):
        memberships = CustomerMembership.objects.filter(user=obj).select_related('customer')
        return [{
            'id': m.id,
            'customer_id': m.customer.id,
            'customer_name': m.customer.name,
            'role': m.role,
            'created_at': m.created_at
        } for m in memberships]


class CustomerMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    customer = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(write_only=True, required=False)
    customer_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = CustomerMembership
        fields = ['id', 'customer', 'customer_id', 'user', 'user_id',
                  'role', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_customer(self, obj):
        return {
            'id': obj.customer.id,
            'name': obj.customer.name
        }

    def validate_role(self, value):
        if value not in dict(CustomerMembership.ROLE_CHOICES):
            raise serializers.ValidationError(f"Invalid role: {value}")
        return value


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__" 

class ProjectSerializer(serializers.ModelSerializer):
    customers = CustomerSerializer(many=True, read_only=True)  # Show all customers this project belongs to
    group_details = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = "__all__"

    def get_group_details(self, obj):
        """Return group details if project has a group"""
        if obj.group:
            return {
                'id': obj.group.id,
                'name': obj.group.name,
                'member_count': obj.group.members.count()
            }
        return None


class ProjectGroupSerializer(serializers.ModelSerializer):
    """Serializer for ProjectGroup"""
    members = UserSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    customer = serializers.SerializerMethodField()
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of user IDs to add as members"
    )
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectGroup
        fields = ['id', 'name', 'customer', 'members', 'member_ids',
                  'created_by', 'description', 'project_count',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_customer(self, obj):
        return {
            'id': obj.customer.id,
            'name': obj.customer.name
        }

    def get_project_count(self, obj):
        """Return count of projects using this group"""
        return obj.projects.count()

    def validate_member_ids(self, value):
        """Validate that all member IDs exist"""
        if value:
            existing_users = User.objects.filter(id__in=value)
            if existing_users.count() != len(value):
                raise serializers.ValidationError("One or more user IDs are invalid")
        return value

    def create(self, validated_data):
        """Create group and add members"""
        member_ids = validated_data.pop('member_ids', [])
        group = ProjectGroup.objects.create(**validated_data)

        if member_ids:
            members = User.objects.filter(id__in=member_ids)
            group.members.set(members)

        return group

    def update(self, instance, validated_data):
        """Update group and members"""
        member_ids = validated_data.pop('member_ids', None)

        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update members if provided
        if member_ids is not None:
            members = User.objects.filter(id__in=member_ids)
            instance.members.set(members)

        return instance


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
    """Serializer for per-user configuration"""
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
                  'active_project', 'active_project_id', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


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