from django.db import models
from core.models import Project
from django.contrib.auth.models import User 


class Storage(models.Model):
    project = models.ForeignKey(Project, related_name='storages', on_delete=models.CASCADE)
    name = models.CharField(max_length=64)
    storage_type = models.CharField(
        max_length=20,
        choices=[
            ('FlashSystem', 'FlashSystem'), 
            ('DS8000', 'DS8000'),
            ('Switch', 'Switch'),
            ('Data Domain', 'Data Domain')
            ])
    location = models.CharField(max_length=100, blank=True, null=True)
    machine_type = models.CharField(max_length=4, blank=True, null=True)
    model = models.CharField(max_length=3, blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    system_id = models.CharField(max_length=16, blank=True, null=True)
    wwnn = models.CharField(max_length=23, blank=True, null=True)
    firmware_level = models.CharField(max_length=16, blank=True, null=True)
    primary_ip = models.CharField(max_length=11, blank=True, null=True)
    secondary_ip = models.CharField(max_length=11, blank=True, null=True)

    def storage_image(self):
        storage_image = f'IBM.2107-{self.serial_number[:-1] + "1"}'
        return storage_image
    
    def __str__(self):
        return f'{self.project}: {self.name}' 
    
    class Meta:
        unique_together = ['project', 'name']


class Host(models.Model):
    project = models.ForeignKey(Project, related_name='host_project', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(Storage, related_name="owning_storage", on_delete=models.CASCADE, null=True,blank=True)

    class Meta:
        unique_together = ['project', 'name']

    def __str__(self):
        return f'{self.project}: {self.name}'
