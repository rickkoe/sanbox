from rest_framework import serializers
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model with customer memberships"""
    customer_memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'customer_memberships']
        read_only_fields = ['id']

    def get_customer_memberships(self, obj):
        """Get all customer memberships for this user"""
        from core.models import Customer

        # Get memberships if CustomerMembership model exists
        try:
            memberships = []
            for membership in obj.customer_memberships.all():
                memberships.append({
                    'customer_id': membership.customer.id,
                    'customer_name': membership.customer.name,
                    'role': membership.role,
                    'created_at': membership.created_at.isoformat() if membership.created_at else None,
                })
            return memberships
        except AttributeError:
            # CustomerMembership model doesn't exist yet
            return []


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'}, label='Confirm Password')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']

    def validate(self, attrs):
        """Validate passwords match"""
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        """Create new user with hashed password"""
        from core.models import AppSettings

        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )

        # Check AppSettings to determine if new users should have staff/superuser status
        app_settings = AppSettings.get_settings()
        if app_settings:
            if app_settings.new_users_are_staff:
                user.is_staff = True
            if app_settings.new_users_are_superuser:
                user.is_superuser = True
            user.save()

        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for login requests"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, style={'input_type': 'password'})
