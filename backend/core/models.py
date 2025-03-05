from django.db import models
from customers.models import Customer
from django.contrib.auth.models import User 

## Create your models here.
class Project(models.Model):
    customer = models.ForeignKey(Customer, related_name='projects', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ['customer', 'name']
    
    class Meta:
        unique_together = ['customer', 'name']

    def __str__(self):
        return f'{self.customer}: {self.name}'


class Config(models.Model):
    project = models.ForeignKey(Project, related_name="configs", on_delete=models.CASCADE)

    san_vendor = models.CharField(
        max_length=7,
        choices=[
            ("BR", "Brocade"),
            ("CI", "Cisco"),
        ],
        default="BR",
    )
    cisco_alias = models.CharField(
        max_length=15,
        choices=[
            ("device-alias", "device-alias"),
            ("fcalias", "fcalias"),
            ("wwpn", "wwpn"),
        ],
        default="device-alias",
    )
    cisco_zoning_mode = models.CharField(
        max_length=15,
        choices=[("basic", "basic"), ("enhanced", "enhanced")],
        default="enhanced",
    )
    zone_ratio = models.CharField(
        max_length=20,
        choices=[
            ("one-to-one", "one-to-one"),
            ("one-to-many", "one-to-many"),
            ("all-to-all", "all-to-all"),
        ],
        default="one-to-one",
    )
    zoning_job_name = models.CharField(max_length=40, default="default_job")
    smartzone_prefix = models.CharField(max_length=25, default="")
    alias_max_zones = models.IntegerField(default=1)

    # ✅ Automatically get customer from project
    @property
    def customer(self):
        return self.project.customer if self.project else None
