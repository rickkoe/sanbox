from rest_framework import serializers
from .models import Storage, Volume
from customers.serializers import CustomerSerializer

class StorageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Storage
        fields = '__all__'

class VolumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volume
        fields = '__all__'