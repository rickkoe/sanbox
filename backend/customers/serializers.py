from rest_framework import serializers
from .models import Customer, ContactInfo

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'


class ContactInfoSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = ContactInfo
        fields = ['id', 'customer', 'customer_name', 'name', 'email', 'phone_number',
                  'title', 'is_default', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """Validate contact information"""
        # Ensure email is valid
        if 'email' in data and not data['email']:
            raise serializers.ValidationError({"email": "Email is required"})
        return data