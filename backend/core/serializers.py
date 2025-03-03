from rest_framework import serializers
from .models import Config, Project
from customers.models import Customer

# ✅ Serializer for Customer
class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name"]

# ✅ Serializer for Project (including Customer)
class ProjectSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)  # ✅ Ensure customer is included

    class Meta:
        model = Project
        fields = ["id", "name", "customer"]

# ✅ Serializer for Config (including Project with Customer)
class ConfigSerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)  # ✅ Include project details
    customer = serializers.SerializerMethodField()  # ✅ Add customer from project

    class Meta:
        model = Config
        fields = "__all__"

    # ✅ Get customer from project
    def get_customer(self, obj):
        return {"id": obj.customer.id, "name": obj.customer.name} if obj.customer else None