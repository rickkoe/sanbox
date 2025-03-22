from django.db import models

class Customer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    projects = models.ManyToManyField("core.Project", related_name="customers")
    notes = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name