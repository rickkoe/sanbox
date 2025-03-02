from rest_framework import serializers
from .models import Alias, Zone, Fabric

class AliasSerializer(serializers.ModelSerializer):
    fabric = serializers.SlugRelatedField(
        queryset=Fabric.objects.all(),
        slug_field="name"  # ✅ Show & accept fabric names instead of IDs
    )
    class Meta:
        model = Alias
        fields = '__all__'

class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = '__all__'

class FabricSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fabric
        fields = '__all__'