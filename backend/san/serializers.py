from rest_framework import serializers
from .models import Alias

class AliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alias
        fields = '__all__'