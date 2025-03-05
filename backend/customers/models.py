from django.db import models
from django.contrib.auth.models import User 

# Create your models here.
class Customer(models.Model):
    name = models.CharField(max_length=200, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
    