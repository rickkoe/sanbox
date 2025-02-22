from django.db import models
from django.contrib.auth.models import User 

# Create your models here.
class Customer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    users = models.ManyToManyField(User, related_name='customer_users')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
    