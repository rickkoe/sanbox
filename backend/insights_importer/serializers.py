from rest_framework import serializers
from .models import APICredentials, ImportJob, ImportLog, DataMapping, ImportHistory


class APICredentialsSerializer(serializers.ModelSerializer):
    class Meta:
        model = APICredentials
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True}  # Don't expose password in responses
        }


class ImportJobSerializer(serializers.ModelSerializer):
    started_by_username = serializers.CharField(source='started_by.username', read_only=True)
    api_credentials_name = serializers.CharField(source='api_credentials.name', read_only=True)
    duration = serializers.SerializerMethodField()
    
    class Meta:
        model = ImportJob
        fields = '__all__'
    
    def get_duration(self, obj):
        if obj.started_at and obj.completed_at:
            duration = obj.completed_at - obj.started_at
            return str(duration).split('.')[0]  # Remove microseconds
        elif obj.started_at:
            from django.utils import timezone
            duration = timezone.now() - obj.started_at
            return f"{str(duration).split('.')[0]} (running)"
        return None


class ImportLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportLog
        fields = '__all__'


class DataMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataMapping
        fields = '__all__'


class ImportHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportHistory
        fields = '__all__'


class StartImportSerializer(serializers.Serializer):
    credentials_id = serializers.IntegerField()
    customer_id = serializers.IntegerField(required=False)
    import_type = serializers.ChoiceField(
        choices=['full', 'incremental', 'storage_only', 'volumes_only', 'hosts_only'],
        default='full'
    )
    
    def validate_credentials_id(self, value):
        try:
            APICredentials.objects.get(pk=value, is_active=True)
        except APICredentials.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive credentials")
        return value