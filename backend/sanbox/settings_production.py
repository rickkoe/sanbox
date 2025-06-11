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

# Production-specific settings
DEBUG = False
ALLOWED_HOSTS = ['sanbox.esilabs.com', 'localhost']