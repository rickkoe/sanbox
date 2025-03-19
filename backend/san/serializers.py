from rest_framework import serializers
from .models import Alias, Zone, Fabric

from rest_framework import serializers
from .models import Alias
from core.models import Project

class AliasSerializer(serializers.ModelSerializer):
    projects = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), many=True, required=False
    )  # ✅ Allows multiple projects to be assigned

    class Meta:
        model = Alias
        fields = "__all__"

    def validate(self, data):
        """
        Ensure the alias name is unique within the same fabric for any project.
        """
        fabric = data.get("fabric")
        name = data.get("name")
        alias_id = self.instance.id if self.instance else None  # Check for updates

        if Alias.objects.filter(fabric=fabric, name=name).exclude(id=alias_id).exists():
            raise serializers.ValidationError(
                {"name": f"Alias '{name}' already exists within this fabric."}
            )

        return data

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

class FabricSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fabric
        fields = '__all__'