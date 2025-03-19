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
        projects = validated_data.pop("projects", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if projects is not None:
            instance.projects.set(projects)  # ✅ Update many-to-many relationship

        return instance

class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = '__all__'