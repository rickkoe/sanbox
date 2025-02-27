from django.db import models
from core.models import Project
from storage.models import Storage, Host
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User 

# Create your models here.
class Fabric(models.Model):
    project = models.ForeignKey(Project, related_name='fabrics', on_delete=models.CASCADE)
    name = models.CharField(max_length=64)
    zoneset_name = models.CharField(max_length=200)
    vsan = models.IntegerField(blank=True, null=True)
    exists = models.BooleanField(default=False)
    users = models.ManyToManyField(User, related_name='fabric_users')

    def __str__(self):
        return f'{self.project}: {self.name}'
    
    class Meta:
        unique_together = ['project', 'name']


class Alias(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='aliases', null=True, blank=True)
    users = models.ManyToManyField(User, related_name='alias_users')
    USE_CHOICES = [
        ('init', 'Initiator'),
        ('target', 'Target'),
        ('both', 'Both'),
    ]
    name = models.CharField(max_length=100, unique=False)
    wwpn = models.CharField(max_length=23)
    use = models.CharField(max_length=6, choices=USE_CHOICES, null=True, blank=True)
    create = models.BooleanField(default=False)
    include_in_zoning = models.BooleanField(default=False)
    host = models.ForeignKey(Host, on_delete=models.SET_NULL, related_name='alias_host', null=True, blank=True)

    @property
    def project(self):
        return self.fabric.project if self.fabric else None
    
    class Meta:
        ordering = ['name']
        unique_together = [
            ('fabric', 'wwpn'),
            ('fabric', 'name'),
        ]
    
    def __str__(self):
        return f'{self.fabric.project}: {self.name}'


class ZoneGroup(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE)
    users = models.ManyToManyField(User, related_name='zonegroup_users')
    name = models.CharField(max_length=100, unique=False)
    create = models.BooleanField(default=False)
    aliases = models.ManyToManyField(Alias)
    zone_type = models.CharField(max_length=100,choices=[
        ('smart', 'smart'),
        ('standard', 'standard'),
    ])
    exists = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.fabric.project}: {self.name}'


class Zone(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, unique=False)
    users = models.ManyToManyField(User, related_name='zone_users')
    create = models.BooleanField(default=False)
    exists = models.BooleanField(default=False)
    zone_type = models.CharField(max_length=100,choices=[
        ('smart', 'smart'),
        ('standard', 'standard'),
    ])
    members = models.ManyToManyField(Alias)

    @property
    def project(self):
        return self.fabric.project

    def __str__(self):
        return f'{self.fabric.project}: {self.name}'
    
    def clean(self):
        # Check if there is any other Zone with the same name for the same project
        if Zone.objects.filter(name=self.name, fabric__project=self.project).exists():
            raise ValidationError('Zone with this name already exists for this project.')