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
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())  # ✅ Used for saving (PUT/POST)
    project_details = serializers.SerializerMethodField()  # ✅ Used for GET responses
    customer = serializers.SerializerMethodField()

    class Meta:
        model = Config
        fields = "__all__"

    def get_customer(self, obj):
        """Retrieve customer from project"""
        return {"id": obj.project.customer.id, "name": obj.project.customer.name} if obj.project else None

    def get_project_details(self, obj):
        """Retrieve full project details for GET requests"""
        return {"id": obj.project.id, "name": obj.project.name} if obj.project else None

    def update(self, instance, validated_data):
        """Ensure project updates correctly"""
        instance.project = validated_data.get("project", instance.project)  # ✅ Only update the project ID
        instance.save()
        return instance