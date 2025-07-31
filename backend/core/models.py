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


class AppSettings(models.Model):
    """
    Stores application-wide settings for users. 
    Each user can have their own personalized settings.
    """
    
    # User identification - nullable for global defaults
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='app_settings',
        null=True,
        blank=True,
        help_text="User these settings belong to (null for global defaults)"
    )
    
    # Display Settings
    theme = models.CharField(
        max_length=10,
        choices=[
            ('light', 'Light'),
            ('dark', 'Dark'),
            ('auto', 'Auto (System)'),
        ],
        default='light',
        help_text="UI theme preference"
    )
    
    items_per_page = models.IntegerField(
        default=25,
        choices=[
            (10, '10'),
            (25, '25'),
            (50, '50'),
            (100, '100'),
        ],
        help_text="Default number of items per page in tables"
    )
    
    compact_mode = models.BooleanField(
        default=False,
        help_text="Enable compact mode for tables and UI elements"
    )
    
    # Data & Refresh Settings
    auto_refresh = models.BooleanField(
        default=True,
        help_text="Enable automatic data refresh"
    )
    
    auto_refresh_interval = models.IntegerField(
        default=30,
        choices=[
            (15, '15 seconds'),
            (30, '30 seconds'),
            (60, '1 minute'),
            (300, '5 minutes'),
        ],
        help_text="Auto-refresh interval in seconds"
    )
    
    # Notifications & Features
    notifications = models.BooleanField(
        default=True,
        help_text="Enable browser notifications"
    )
    
    show_advanced_features = models.BooleanField(
        default=False,
        help_text="Show advanced features and debugging tools"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "App Settings"
        verbose_name_plural = "App Settings"
        indexes = [
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        if self.user:
            return f"Settings for {self.user.username}"
        return "Global Default Settings"
    
    @classmethod
    def get_settings(cls, user=None):
        """
        Get settings for a user, falling back to global defaults.
        """
        if user:
            settings = cls.objects.filter(user=user).first()
            if settings:
                return settings
        
        # Fall back to global defaults or create default settings
        settings, created = cls.objects.get_or_create(
            user=None,
            defaults={
                'theme': 'light',
                'items_per_page': 25,
                'compact_mode': False,
                'auto_refresh': True,
                'auto_refresh_interval': 30,
                'notifications': True,
                'show_advanced_features': False,
            }
        )
        return settings
    
    @classmethod
    def update_settings(cls, user=None, **settings_data):
        """
        Update or create settings for a user.
        """
        settings, created = cls.objects.update_or_create(
            user=user,
            defaults=settings_data
        )
        return settings