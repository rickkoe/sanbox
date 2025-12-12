import os
from .settings import *

# SECURITY: Load from environment variables
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable must be set in production")

# Production-specific settings
DEBUG = False

# SECURITY: Restrict allowed hosts to your actual domain
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'sanbox.esilabs.com,localhost').split(',')

# Production database configuration - USE ENVIRONMENT VARIABLES
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'sanbox_db'),
        'USER': os.environ.get('POSTGRES_USER', 'sanbox_user'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD'),  # MUST be set via environment
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# Validate required environment variables
if not DATABASES['default']['PASSWORD']:
    raise ValueError("POSTGRES_PASSWORD environment variable must be set in production")

# CSRF Configuration for API
CSRF_TRUSTED_ORIGINS = os.environ.get(
    'CSRF_TRUSTED_ORIGINS',
    'http://sanbox.esilabs.com,https://sanbox.esilabs.com'
).split(',')

# For API endpoints
CSRF_COOKIE_HTTPONLY = False
CSRF_USE_SESSIONS = False

# SECURITY: Production security headers
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # For testing
    ],
}

# Celery Configuration for Production
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Celery beat schedule
CELERY_BEAT_SCHEDULE = {
    # Add periodic tasks here if needed
}

# Use default queue for all tasks (no custom routing)
CELERY_TASK_ROUTES = {}

# Logging configuration for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/www/sanbox/logs/django.log',
        },
        'celery_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/www/sanbox/logs/celery.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
        'celery': {
            'handlers': ['celery_file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}