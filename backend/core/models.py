from django.db import models
from django.contrib.auth.models import User
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


class TableConfiguration(models.Model):
    """
    Stores table configuration settings for each user/customer/table combination.
    This includes visible columns, filters, sorting, and other table preferences.
    """
    
    # Identification fields
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE, 
        related_name='table_configurations',
        help_text="Customer this configuration belongs to"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='table_configurations',
        null=True,
        blank=True,
        help_text="User this configuration belongs to (optional for global settings)"
    )
    table_name = models.CharField(
        max_length=100,
        help_text="Name of the table (e.g., 'storage', 'volumes', 'hosts', 'zones', 'aliases')"
    )
    
    # Configuration data
    visible_columns = models.JSONField(
        default=list,
        blank=True,
        help_text="List of visible column names/keys in order"
    )
    column_widths = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dictionary mapping column names to their widths"
    )
    filters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Active filters as key-value pairs"
    )
    sorting = models.JSONField(
        default=dict,
        blank=True,
        help_text="Sorting configuration (column, direction)"
    )
    page_size = models.IntegerField(
        default=25,
        help_text="Number of rows per page"
    )
    additional_settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Any additional table-specific settings"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['customer', 'user', 'table_name']
        indexes = [
            models.Index(fields=['customer', 'table_name']),
            models.Index(fields=['user', 'table_name']),
        ]
        verbose_name = "Table Configuration"
        verbose_name_plural = "Table Configurations"
    
    def __str__(self):
        user_part = f" (User: {self.user.username})" if self.user else " (Global)"
        return f"{self.customer.name} - {self.table_name}{user_part}"
    
    @classmethod
    def get_config(cls, customer, table_name, user=None):
        """
        Get table configuration for a customer/table/user combination.
        Falls back to customer-level config if user-specific config doesn't exist.
        """
        # Try to get user-specific config first
        if user:
            config = cls.objects.filter(
                customer=customer,
                table_name=table_name,
                user=user
            ).first()
            if config:
                return config
        
        # Fall back to customer-level config
        config = cls.objects.filter(
            customer=customer,
            table_name=table_name,
            user__isnull=True
        ).first()
        
        return config
    
    @classmethod
    def save_config(cls, customer, table_name, config_data, user=None):
        """
        Save or update table configuration.
        """
        config, created = cls.objects.update_or_create(
            customer=customer,
            table_name=table_name,
            user=user,
            defaults=config_data
        )
        return config