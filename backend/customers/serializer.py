from rest_framework import serializers
from .models import Customer

class ReactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['name']
