from rest_framework import serializers
from .models import Alias, Zone, Fabric

from rest_framework import serializers
from .models import Alias
from core.models import Project



class FabricSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fabric
        fields = '__all__'


class AliasSerializer(serializers.ModelSerializer):
    projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )  # ✅ Allows multiple projects

    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True  # ✅ Allow writing fabric (ID) in request
    )

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details
    
    # ADD THIS: Zoned count field
    zoned_count = serializers.SerializerMethodField()

    class Meta:
        model = Alias
        fields = "__all__"  # ✅ Includes both `fabric` (ID) and `fabric_details` (full object)

    def get_zoned_count(self, obj):
        """Count how many zones in the current project contain this alias"""
        # Get project_id from context (passed from the view)
        request = self.context.get('request')
        view = self.context.get('view')
        
        # Try to get project_id from the URL kwargs
        project_id = None
        if hasattr(view, 'kwargs') and 'project_id' in view.kwargs:
            project_id = view.kwargs['project_id']
        
        # Fallback: try to get from view attributes
        if not project_id and hasattr(view, 'project_id'):
            project_id = view.project_id
            
        # Fallback: try to get from context directly
        if not project_id:
            project_id = self.context.get('project_id')
        
        if project_id:
            # Count zones in this project that contain this alias
            try:
                count = Zone.objects.filter(
                    projects__id=project_id,
                    members=obj
                ).count()
                return count
            except Exception as e:
                # Log the error but don't break the API
                print(f"Error calculating zoned_count for alias {obj.name}: {e}")
                return 0
        
        return 0

    def create(self, validated_data):
        """Create alias and properly handle many-to-many projects"""
        projects = validated_data.pop("projects", [])
        alias = Alias.objects.create(**validated_data)
        alias.projects.set(projects)  # ✅ Assign multiple projects
        return alias

    def update(self, instance, validated_data):
        """Update alias and handle many-to-many projects"""
        projects = validated_data.pop("projects", None)

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

        if projects is not None:
            instance.projects.set(projects)

        return instance

class ZoneSerializer(serializers.ModelSerializer):
    projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )  # ✅ Allows multiple projects

    members = serializers.PrimaryKeyRelatedField(
        queryset=Alias.objects.all(), many=True, required=False
    )  # ✅ Allows multiple aliases as members

    members_details = serializers.SerializerMethodField()  # ✅ Add this line

    fabric = serializers.PrimaryKeyRelatedField(
        queryset=Fabric.objects.all(), required=True
    )  # ✅ Allows assigning fabric by ID

    fabric_details = FabricSerializer(source="fabric", read_only=True)  # ✅ Return full fabric details
    
    class Meta:
        model = Zone
        fields = "__all__"

    def get_members_details(self, obj):
        """Return a list of member alias names."""
        return [{"id": alias.id, "name": alias.name} for alias in obj.members.all()]  # ✅ Returning list of alias objects
    
    def create(self, validated_data):
        """Create zone and properly handle many-to-many fields"""
        projects = validated_data.pop("projects", [])
        members = validated_data.pop("members", [])

        zone = Zone.objects.create(**validated_data)
        zone.projects.add(*projects)  # ✅ Append projects instead of overwriting
        zone.members.add(*members)  # ✅ Append members instead of overwriting
        return zone

    def update(self, instance, validated_data):
        """Update zone and properly handle many-to-many fields"""
        projects = validated_data.pop("projects", None)
        members = validated_data.pop("members", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if projects is not None:
            instance.projects.add(*projects)  # ✅ Append instead of overwriting

        if members is not None:
            instance.members.add(*members)  # ✅ Append instead of overwriting

        return instance