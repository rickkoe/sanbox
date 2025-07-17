from .settings import *

# Production database configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'sanbox_db',
        'USER': 'sanbox_user',
        'PASSWORD': 'ESI@2022bpic',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# CSRF Configuration for API
CSRF_TRUSTED_ORIGINS = [
    'http://sanbox.esilabs.com',
    'https://sanbox.esilabs.com',  # If you add SSL later
]

# For API endpoints, you might want to disable CSRF
CSRF_COOKIE_HTTPONLY = False
CSRF_USE_SESSIONS = False

# Production-specific settings
DEBUG = False
ALLOWED_HOSTS = ['*']

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