from django.contrib import admin
from .models import Storage, Host

# Register your models here.
admin.site.register(Storage)
admin.site.register(Host)