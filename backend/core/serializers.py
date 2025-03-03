from rest_framework import serializers
from .models import Config, Project
from customers.models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name"]

class ProjectSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "customer"]


class ConfigSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    customer = serializers.SerializerMethodField() 

    class Meta:
        model = Config
        fields = "__all__"

    def get_customer(self, obj):
        return {"id": obj.project.customer.id, "name": obj.project.customer.name} if obj.project else None

    def update(self, instance, validated_data):
        """Ensure project updates correctly"""
        instance.project = validated_data.get("project", instance.project)
        instance.save()
        return instance