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
    is_active = models.BooleanField(default=False)

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
    
    items_per_page = models.CharField(
        max_length=10,
        default='All',
        choices=[
            ('25', '25'),
            ('50', '50'),
            ('100', '100'),
            ('250', '250'),
            ('All', 'All'),
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
    
    # SAN Configuration Settings (moved from Config model)
    zone_ratio = models.CharField(
        max_length=20,
        choices=[
            ("one-to-one", "one-to-one"),
            ("one-to-many", "one-to-many"),
            ("all-to-all", "all-to-all"),
        ],
        default="one-to-one",
        help_text="Default zone ratio for SAN operations"
    )
    
    alias_max_zones = models.IntegerField(
        default=1,
        help_text="Maximum number of zones per alias"
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
                'zone_ratio': 'one-to-one',
                'alias_max_zones': 1,
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


class CustomNamingRule(models.Model):
    """
    Stores custom naming rules for tables with variables and text patterns.
    Allows users to define naming patterns like "zs_" + Member1 + "_" + Member2.
    """
    
    # Identification fields
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE, 
        related_name='custom_naming_rules',
        help_text="Customer this naming rule belongs to"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='custom_naming_rules',
        null=True,
        blank=True,
        help_text="User this naming rule belongs to (optional for global rules)"
    )
    
    # Rule definition
    name = models.CharField(
        max_length=100,
        help_text="Descriptive name for this naming rule"
    )
    table_name = models.CharField(
        max_length=100,
        help_text="Target table name (e.g., 'zones', 'aliases', 'storage')"
    )
    pattern = models.JSONField(
        help_text="Naming pattern as array of objects with type and value"
    )
    
    # Metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rule is currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['customer', 'user', 'name', 'table_name']
        indexes = [
            models.Index(fields=['customer', 'table_name']),
            models.Index(fields=['user', 'table_name']),
        ]
        verbose_name = "Custom Naming Rule"
        verbose_name_plural = "Custom Naming Rules"
    
    def __str__(self):
        user_part = f" (User: {self.user.username})" if self.user else " (Global)"
        return f"{self.customer.name} - {self.name} ({self.table_name}){user_part}"
    
    @classmethod
    def get_rules_for_table(cls, customer, table_name, user=None):
        """
        Get all active naming rules for a customer/table/user combination.
        """
        rules = cls.objects.filter(
            customer=customer,
            table_name=table_name,
            is_active=True
        )
        
        if user:
            rules = rules.filter(user=user)
        else:
            rules = rules.filter(user__isnull=True)
            
        return rules.order_by('-updated_at')


class CustomVariable(models.Model):
    """
    Stores custom variables that can be used in naming patterns.
    These are user-defined variables independent of table columns.
    """
    
    # Identification fields
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE, 
        related_name='custom_variables',
        help_text="Customer this variable belongs to"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='custom_variables',
        null=True,
        blank=True,
        help_text="User this variable belongs to (optional for global variables)"
    )
    
    # Variable definition
    name = models.CharField(
        max_length=100,
        help_text="Variable name (e.g., 'environment', 'datacenter')"
    )
    value = models.CharField(
        max_length=200,
        help_text="Variable value (e.g., 'prod', 'dc1')"
    )
    description = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Optional description of what this variable represents"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['customer', 'user', 'name']
        indexes = [
            models.Index(fields=['customer', 'name']),
            models.Index(fields=['user', 'name']),
        ]
        verbose_name = "Custom Variable"
        verbose_name_plural = "Custom Variables"
    
    def __str__(self):
        user_part = f" (User: {self.user.username})" if self.user else " (Global)"
        return f"{self.customer.name} - {self.name}: {self.value}{user_part}"
    
    @classmethod
    def get_variables_for_customer(cls, customer, user=None):
        """
        Get all custom variables for a customer/user combination.
        """
        variables = cls.objects.filter(customer=customer)
        
        if user:
            variables = variables.filter(user=user)
        else:
            variables = variables.filter(user__isnull=True)
            
        return variables.order_by('name')


# ========== CUSTOMIZABLE DASHBOARD MODELS ==========

class DashboardLayout(models.Model):
    """User's dashboard layout configuration"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dashboard_layouts')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="My Dashboard")
    theme = models.CharField(max_length=50, default='modern', choices=[
        ('modern', 'Modern'),
        ('dark', 'Dark Mode'),
        ('minimal', 'Minimal'),
        ('corporate', 'Corporate'),
        ('colorful', 'Colorful')
    ])
    grid_columns = models.IntegerField(default=12)
    auto_refresh = models.BooleanField(default=True)
    refresh_interval = models.IntegerField(default=30)  # seconds
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'customer']

    def __str__(self):
        return f"{self.user.username}'s {self.name}"


class WidgetType(models.Model):
    """Available widget types that can be added to dashboards"""
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField()
    component_name = models.CharField(max_length=100)  # React component name
    category = models.CharField(max_length=50, choices=[
        ('metrics', 'Key Metrics'),
        ('charts', 'Charts & Graphs'),
        ('tables', 'Data Tables'),
        ('health', 'System Health'),
        ('activity', 'Activity & Logs'),
        ('tools', 'Quick Tools'),
        ('custom', 'Custom Widgets')
    ])
    icon = models.CharField(max_length=50)  # FontAwesome icon name
    default_width = models.IntegerField(default=4)  # Grid columns
    default_height = models.IntegerField(default=300)  # Pixels
    min_width = models.IntegerField(default=2)
    min_height = models.IntegerField(default=200)
    max_width = models.IntegerField(default=12)
    max_height = models.IntegerField(default=800)
    is_resizable = models.BooleanField(default=True)
    requires_data_source = models.BooleanField(default=True)
    config_schema = models.JSONField(default=dict)  # JSON schema for widget configuration
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name


class DashboardWidget(models.Model):
    """Individual widget instance on a dashboard"""
    layout = models.ForeignKey(DashboardLayout, on_delete=models.CASCADE, related_name='widgets')
    widget_type = models.ForeignKey(WidgetType, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    position_x = models.IntegerField(default=0)  # Grid position
    position_y = models.IntegerField(default=0)
    width = models.IntegerField(default=4)  # Grid columns
    height = models.IntegerField(default=300)  # Pixels
    config = models.JSONField(default=dict)  # Widget-specific configuration
    data_filters = models.JSONField(default=dict)  # Data filtering options
    refresh_interval = models.IntegerField(null=True, blank=True)  # Override default
    is_visible = models.BooleanField(default=True)
    z_index = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position_y', 'position_x']

    def __str__(self):
        return f"{self.title} ({self.widget_type.display_name})"


class DashboardTheme(models.Model):
    """Custom dashboard themes"""
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    css_variables = models.JSONField(default=dict)  # CSS custom properties
    background_type = models.CharField(max_length=20, default='solid', choices=[
        ('solid', 'Solid Color'),
        ('gradient', 'Gradient'),
        ('pattern', 'Pattern'),
        ('image', 'Background Image')
    ])
    background_config = models.JSONField(default=dict)
    card_style = models.CharField(max_length=20, default='modern', choices=[
        ('modern', 'Modern Cards'),
        ('flat', 'Flat Design'),
        ('glass', 'Glassmorphism'),
        ('neumorphism', 'Neumorphism'),
        ('minimal', 'Minimal Borders')
    ])
    animation_level = models.CharField(max_length=20, default='medium', choices=[
        ('none', 'No Animations'),
        ('minimal', 'Minimal'),
        ('medium', 'Medium'),
        ('full', 'Full Animations')
    ])
    is_system = models.BooleanField(default=False)  # System vs user-created themes
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name


class WidgetDataSource(models.Model):
    """Data sources that widgets can connect to"""
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField()
    endpoint_pattern = models.CharField(max_length=500)  # API endpoint pattern
    parameters_schema = models.JSONField(default=dict)  # Required/optional parameters
    cache_duration = models.IntegerField(default=300)  # Cache duration in seconds
    requires_auth = models.BooleanField(default=True)
    data_format = models.CharField(max_length=50, default='json')
    is_real_time = models.BooleanField(default=False)
    update_frequency = models.IntegerField(default=30)  # seconds
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name


class DashboardPreset(models.Model):
    """Pre-configured dashboard templates"""
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=[
        ('executive', 'Executive Overview'),
        ('technical', 'Technical Operations'),
        ('capacity', 'Capacity Planning'),
        ('security', 'Security Monitoring'),
        ('performance', 'Performance Analytics'),
        ('custom', 'Custom Templates')
    ])
    thumbnail_url = models.URLField(blank=True)
    layout_config = models.JSONField()  # Complete dashboard configuration
    required_permissions = models.JSONField(default=list)
    target_roles = models.JSONField(default=list)  # Recommended for specific roles
    is_system = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    usage_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Custom template fields
    created_by = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.CASCADE, null=True, blank=True)
    is_public = models.BooleanField(default=False)  # If true, available to all users

    class Meta:
        ordering = ['-is_featured', '-usage_count', 'display_name']

    def __str__(self):
        return self.display_name


class DashboardAnalytics(models.Model):
    """Track dashboard usage and widget performance"""
    layout = models.ForeignKey(DashboardLayout, on_delete=models.CASCADE)
    widget = models.ForeignKey(DashboardWidget, on_delete=models.CASCADE, null=True, blank=True)
    event_type = models.CharField(max_length=50, choices=[
        ('view', 'Dashboard View'),
        ('widget_add', 'Widget Added'),
        ('widget_remove', 'Widget Removed'),
        ('widget_resize', 'Widget Resized'),
        ('widget_move', 'Widget Moved'),
        ('config_change', 'Configuration Changed'),
        ('theme_change', 'Theme Changed'),
        ('export', 'Data Export'),
        ('refresh', 'Manual Refresh')
    ])
    metadata = models.JSONField(default=dict)  # Event-specific data
    session_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['layout', 'event_type', 'timestamp']),
            models.Index(fields=['widget', 'event_type', 'timestamp']),
        ]