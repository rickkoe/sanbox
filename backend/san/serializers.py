from rest_framework import serializers
from .models import Alias, Zone

class AliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alias
        fields = '__all__'

class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = '__all__'