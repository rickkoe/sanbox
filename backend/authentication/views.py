from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import json

from .serializers import UserSerializer, UserRegistrationSerializer, LoginSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login endpoint - authenticates user and creates session
    POST /api/auth/login/
    Body: {"username": "...", "password": "..."}
    """
    serializer = LoginSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']

    # Authenticate user
    user = authenticate(request, username=username, password=password)

    if user is not None:
        # Create session
        login(request, user)

        # Return user data with memberships
        user_serializer = UserSerializer(user)
        return Response({
            'user': user_serializer.data,
            'message': 'Login successful'
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'Invalid username or password'
        }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint - destroys session
    POST /api/auth/logout/
    """
    logout(request)
    return Response({
        'message': 'Logout successful'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info_view(request):
    """
    Get current user info with customer memberships
    GET /api/auth/user/
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    User registration endpoint
    POST /api/auth/register/
    Body: {
        "username": "...",
        "email": "...",
        "password": "...",
        "password2": "...",
        "first_name": "...",
        "last_name": "..."
    }
    """
    serializer = UserRegistrationSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # Auto-login after registration
        login(request, user)

        # Return user data
        user_serializer = UserSerializer(user)
        return Response({
            'user': user_serializer.data,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_auth_view(request):
    """
    Check if user is authenticated
    GET /api/auth/check/
    """
    return Response({
        'authenticated': True,
        'user': UserSerializer(request.user).data
    }, status=status.HTTP_200_OK)
