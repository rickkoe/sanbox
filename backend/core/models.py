from django.db import models
from customers.models import Customer

class Project(models.Model):
    name = models.CharField(max_length=200)
    notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.name}"


class Config(models.Model):
    customer = models.OneToOneField(
        Customer, related_name="config", on_delete=models.CASCADE, db_index=True
    )
    active_project = models.ForeignKey(
        "core.Project",
        related_name="active_configs",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="The currently active project for this customer's config.",
    )

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
    alias_max_zones = models.IntegerField(default=1)
    is_active = models.BooleanField(default=False)  # ✅ Track active config

    def __str__(self):
        return f"Config for {self.customer.name}"

    def save(self, *args, **kwargs):
        """Ensure only one config is active at a time per customer."""
        if self.is_active:
            Config.objects.exclude(pk=self.pk).update(is_active=False)

        # Ensure active_project belongs to the customer
        if self.active_project and self.active_project not in self.customer.projects.all():
            raise ValueError("The active project must belong to the customer.")

        super().save(*args, **kwargs)

    @classmethod
    def get_active_config(cls):
        """Retrieve the active config, if it exists."""
        return cls.objects.filter(is_active=True).first()  # ✅ Returns one active config or None