from rest_framework import serializers
from .models import Storage, Volume, Host
from customers.serializers import CustomerSerializer

class StorageSerializer(serializers.ModelSerializer):
    # expose the calculated counts
    db_volumes_count = serializers.IntegerField(read_only=True)
    db_hosts_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Storage
        fields = '__all__'


class VolumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volume
        fields = '__all__'


class HostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = '__all__'