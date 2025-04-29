from rest_framework import serializers
from .models import Storage
from customers.serializers import CustomerSerializer

class StorageSerializer(serializers.ModelSerializer):
    customer_details = CustomerSerializer(source='customer', read_only=True)
    
    class Meta:
        model = Storage
        fields = '__all__'