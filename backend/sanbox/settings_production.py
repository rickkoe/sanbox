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
ALLOWED_HOSTS = ['sanbox.esilabs.com', 'localhost']