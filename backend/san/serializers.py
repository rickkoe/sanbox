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

    class Meta:
        model = Alias
        fields = "__all__"  # ✅ Includes both `fabric` (ID) and `fabric_details` (full object)

    def create(self, validated_data):
        """Create alias and properly handle many-to-many projects"""
        projects = validated_data.pop("projects", [])
        alias = Alias.objects.create(**validated_data)
        alias.projects.set(projects)  # ✅ Assign multiple projects
        return alias

    def update(self, instance, validated_data):
        """Update alias and handle many-to-many projects"""
        print(f'VALIDATED DATA: {validated_data}')

        projects = validated_data.pop("projects", None)
        print(f'PROJECTS TO REMOVE: {projects}')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if projects is not None:
            instance.projects.set(*projects)  # ✅ Update many-to-many relationship

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



