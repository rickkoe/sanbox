from django.db import models
from django.contrib.auth.models import User
from customers.models import Customer
from .constants import PROJECT_ACTION_CHOICES

class Project(models.Model):
    """
    Project model for organizing work within a customer.
    All users have full access to all projects - no ownership or visibility restrictions.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('finalized', 'Finalized'),
        ('closed', 'Closed'),
    ]

    name = models.CharField(max_length=200)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='draft',
        help_text="Project lifecycle status"
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return f"{self.name}"


# ProjectGroup model removed - no longer needed with simplified sharing


class Config(models.Model):
    """
    Customer-level configuration container.
    Note: Active customer/project is now tracked per-user via UserConfig model.
    """
    customer = models.OneToOneField(
        Customer, related_name="config", on_delete=models.CASCADE, db_index=True
    )
    active_project = models.ForeignKey(
        "core.Project",
        related_name="active_configs",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Legacy field - active project is now tracked in UserConfig per-user.",
    )
    is_active = models.BooleanField(
        default=False,
        help_text="DEPRECATED: Active config is now tracked per-user in UserConfig model."
    )

    def __str__(self):
        return f"Config for {self.customer.name}"

    def save(self, *args, **kwargs):
        """
        Save config. Note: Global is_active enforcement removed - use UserConfig instead.
        """
        # Ensure active_project belongs to the customer if set
        if self.active_project and self.active_project not in self.customer.projects.all():
            raise ValueError("The active project must belong to the customer.")

        super().save(*args, **kwargs)

    @classmethod
    def get_active_config(cls):
        """
        DEPRECATED: Use UserConfig to get user-specific active configuration.
        This method is kept for backward compatibility.
        """
        return cls.objects.filter(is_active=True).first()


class UserConfig(models.Model):
    """
    Per-user configuration tracking active customer and project.
    Each user can have their own active context independent of other users.
    Tracks last activity for conflict prevention and presence awareness.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='user_config',
        help_text="User this configuration belongs to"
    )
    active_customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_for_users',
        help_text="Currently active customer for this user"
    )
    active_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_for_users',
        help_text="Currently active project for this user"
    )
    last_activity_at = models.DateTimeField(
        auto_now=True,
        help_text="Last activity timestamp for presence detection"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Configuration"
        verbose_name_plural = "User Configurations"
        indexes = [
            models.Index(fields=['user', 'active_customer']),
            models.Index(fields=['user', 'active_project']),
        ]

    def __str__(self):
        customer_name = self.active_customer.name if self.active_customer else "None"
        project_name = self.active_project.name if self.active_project else "None"
        return f"{self.user.username}: {customer_name} / {project_name}"

    def save(self, *args, **kwargs):
        """Validate that active_project belongs to active_customer"""
        if self.active_project and self.active_customer:
            if self.active_project not in self.active_customer.projects.all():
                raise ValueError("The active project must belong to the active customer.")

        # If project is set but customer is not, clear the project
        if self.active_project and not self.active_customer:
            self.active_project = None

        super().save(*args, **kwargs)

    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create UserConfig for a user"""
        user_config, created = cls.objects.get_or_create(
            user=user,
            defaults={'active_customer': None, 'active_project': None}
        )
        return user_config


# CustomerMembership model removed - all users now have full access to all customers


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
        null=False,
        blank=False,
        help_text="User this configuration belongs to"
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
    page_size = models.CharField(
        max_length=10,
        default='25',
        help_text="Number of rows per page (numeric value or 'All')"
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
        return f"{self.customer.name} - {self.table_name} (User: {self.user.username})"

    @classmethod
    def get_config(cls, customer, table_name, user):
        """
        Get table configuration for a customer/table/user combination.
        User parameter is now required.
        """
        if not user:
            return None

        config = cls.objects.filter(
            customer=customer,
            table_name=table_name,
            user=user
        ).first()

        return config

    @classmethod
    def save_config(cls, customer, table_name, config_data, user):
        """
        Save or update table configuration.
        User parameter is now required.
        """
        if not user:
            raise ValueError("User is required for saving table configuration")

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

    # User Management Settings
    new_users_are_staff = models.BooleanField(
        default=True,
        help_text="Automatically grant staff status (Django admin access) to newly registered users"
    )

    new_users_are_superuser = models.BooleanField(
        default=True,
        help_text="Automatically grant superuser status (full admin privileges) to newly registered users"
    )

    # Audit Log Settings
    audit_log_retention_days = models.IntegerField(
        default=90,
        help_text="Number of days to retain audit logs before automatic purge"
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
                'new_users_are_staff': True,
                'new_users_are_superuser': True,
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


class AuditLog(models.Model):
    """
    Stores high-level audit logs of user actions across the application.
    Logs operations at the activity level, not per-object granularity.
    """

    ACTION_TYPE_CHOICES = [
        ('LOGIN', 'User Login'),
        ('LOGOUT', 'User Logout'),
        ('IMPORT', 'Data Import'),
        ('BACKUP', 'Database Backup'),
        ('RESTORE', 'Database Restore'),
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('EXPORT', 'Data Export'),
        ('CONFIG_CHANGE', 'Configuration Change'),
    ]

    STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    ENTITY_TYPE_CHOICES = [
        ('FABRIC', 'Fabric'),
        ('ZONE', 'Zone'),
        ('ALIAS', 'Alias'),
        ('SWITCH', 'Switch'),
        ('STORAGE_SYSTEM', 'Storage System'),
        ('VOLUME', 'Volume'),
        ('HOST', 'Host'),
        ('BACKUP', 'Backup'),
        ('CREDENTIALS', 'Credentials'),
        ('SETTINGS', 'Settings'),
        ('USER', 'User'),
    ]

    # User who performed the action
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="User who performed the action"
    )

    # When the action occurred
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the action was initiated"
    )

    # Action classification
    action_type = models.CharField(
        max_length=20,
        choices=ACTION_TYPE_CHOICES,
        db_index=True,
        help_text="Type of action performed"
    )

    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text="Type of entity affected"
    )

    entity_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Name of specific entity affected (optional)"
    )

    # Customer context
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        db_index=True,
        help_text="Customer this action affects"
    )

    # Action details
    summary = models.TextField(
        help_text="Human-readable summary of the action"
    )

    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured data about the action (counts, errors, etc.)"
    )

    # Status and duration
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        db_index=True,
        default='SUCCESS',
        help_text="Status of the action"
    )

    duration_seconds = models.IntegerField(
        null=True,
        blank=True,
        help_text="Duration of the action in seconds"
    )

    # Network context
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the user"
    )

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['customer', '-timestamp']),
            models.Index(fields=['action_type', '-timestamp']),
            models.Index(fields=['status', '-timestamp']),
        ]

    def __str__(self):
        user_name = self.user.username if self.user else "System"
        return f"{user_name} - {self.action_type} - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


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
    theme = models.CharField(max_length=50, default='light', choices=[
        ('light', 'Light'),
        ('dark', 'Dark')
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


# ========== WORKSHEET GENERATOR MODELS ==========

class EquipmentType(models.Model):
    """
    Universal equipment type model for worksheet generation.
    Allows dynamic addition of equipment types with custom fields.
    """
    CATEGORY_CHOICES = [
        ('storage', 'Storage'),
        ('network', 'Network'),
        ('compute', 'Compute'),
        ('backup', 'Backup'),
        ('other', 'Other'),
    ]

    name = models.CharField(
        max_length=200,
        unique=True,
        help_text="Equipment type name (e.g., 'SAN Switch', 'FlashSystem')"
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        help_text="Equipment category for grouping"
    )
    vendor = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Primary vendor for this equipment type (optional)"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of this equipment type"
    )
    fields_schema = models.JSONField(
        default=list,
        help_text="""Dynamic fields for this equipment type. Format:
        [{"name": "field_name", "label": "Field Label", "type": "text|number|select|date",
          "required": true/false, "options": [] (for select type)}]"""
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this equipment type is available for selection"
    )
    icon_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Icon name from react-icons (e.g., 'FaServer', 'FaHdd')"
    )
    display_order = models.IntegerField(
        default=0,
        help_text="Display order in the equipment selector"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'display_order', 'name']
        verbose_name = "Equipment Type"
        verbose_name_plural = "Equipment Types"
        indexes = [
            models.Index(fields=['category', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.category})"


class WorksheetTemplate(models.Model):
    """
    Worksheet template model for saving reusable worksheet configurations.
    Allows users to create and reuse worksheet templates.
    """
    name = models.CharField(
        max_length=200,
        help_text="Template name"
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='worksheet_templates',
        null=True,
        blank=True,
        help_text="Customer this template belongs to (null for global templates)"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='worksheet_templates',
        null=True,
        blank=True,
        help_text="User who created this template (null for global templates)"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of this template"
    )
    equipment_types = models.ManyToManyField(
        EquipmentType,
        related_name='worksheet_templates',
        help_text="Equipment types included in this template"
    )
    template_config = models.JSONField(
        default=dict,
        help_text="""Template configuration including equipment quantities and field values.
        Format: {"equipment": [{"type_id": 1, "quantity": 2, "fields": {...}}]}"""
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Default template for this customer/user"
    )
    is_global = models.BooleanField(
        default=False,
        help_text="Available to all users (admin-created templates)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-is_global', 'name']
        verbose_name = "Worksheet Template"
        verbose_name_plural = "Worksheet Templates"
        indexes = [
            models.Index(fields=['customer', 'user']),
            models.Index(fields=['is_global', 'is_default']),
        ]

    def __str__(self):
        prefix = "Global: " if self.is_global else ""
        customer_part = f" ({self.customer.name})" if self.customer else ""
        return f"{prefix}{self.name}{customer_part}"


# ========== PROJECT-ENTITY JUNCTION TABLES (Change Tracking) ==========

class ProjectFabric(models.Model):
    """Track what a project intends to do with a Fabric"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_fabrics'
    )
    fabric = models.ForeignKey(
        'san.Fabric',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values (e.g., {'zoneset_name': 'proj_a_zoneset'})"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_fabrics'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'fabric']
        ordering = ['project', 'fabric__name']
        verbose_name = "Project Fabric"
        verbose_name_plural = "Project Fabrics"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['fabric', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.fabric.name} ({self.action})"


class ProjectSwitch(models.Model):
    """Track what a project intends to do with a Switch"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_switches'
    )
    switch = models.ForeignKey(
        'san.Switch',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_switches'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'switch']
        ordering = ['project', 'switch__name']
        verbose_name = "Project Switch"
        verbose_name_plural = "Project Switches"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['switch', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.switch.name} ({self.action})"


class ProjectAlias(models.Model):
    """Track what a project intends to do with an Alias"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_aliases'
    )
    alias = models.ForeignKey(
        'san.Alias',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values (e.g., {'use': 'target', 'notes': 'Project A notes'})"
    )

    # Alias-specific project flags
    include_in_zoning = models.BooleanField(
        default=False,
        help_text="Manual override to force inclusion in zone generation (overrides deployed status)"
    )
    do_not_include_in_zoning = models.BooleanField(
        default=False,
        help_text="Manual override to force exclusion from zone generation (highest priority)"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_aliases'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'alias']
        ordering = ['project', 'alias__name']
        verbose_name = "Project Alias"
        verbose_name_plural = "Project Aliases"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['alias', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.alias.name} ({self.action})"


class ProjectZone(models.Model):
    """Track what a project intends to do with a Zone"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_zones'
    )
    zone = models.ForeignKey(
        'san.Zone',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_zones'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'zone']
        ordering = ['project', 'zone__name']
        verbose_name = "Project Zone"
        verbose_name_plural = "Project Zones"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['zone', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.zone.name} ({self.action})"


class ProjectStorage(models.Model):
    """Track what a project intends to do with a Storage system"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_storage_systems'
    )
    storage = models.ForeignKey(
        'storage.Storage',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_storage_systems'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'storage']
        ordering = ['project', 'storage__name']
        verbose_name = "Project Storage"
        verbose_name_plural = "Project Storage Systems"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['storage', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.storage.name} ({self.action})"


class ProjectHost(models.Model):
    """Track what a project intends to do with a Host"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_hosts'
    )
    host = models.ForeignKey(
        'storage.Host',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_hosts'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'host']
        ordering = ['project', 'host__name']
        verbose_name = "Project Host"
        verbose_name_plural = "Project Hosts"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['host', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.host.name} ({self.action})"


class ProjectVolume(models.Model):
    """Track what a project intends to do with a Volume"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_volumes'
    )
    volume = models.ForeignKey(
        'storage.Volume',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_volumes'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'volume']
        ordering = ['project', 'volume__name']
        verbose_name = "Project Volume"
        verbose_name_plural = "Project Volumes"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['volume', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.volume.name} ({self.action})"


class ProjectPort(models.Model):
    """Track what a project intends to do with a Port"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_ports'
    )
    port = models.ForeignKey(
        'storage.Port',
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    action = models.CharField(
        max_length=10,
        choices=PROJECT_ACTION_CHOICES,
        default='new'
    )
    delete_me = models.BooleanField(
        default=False,
        help_text="Mark this item for deletion (overrides action for display)"
    )

    # Project-specific settings (overrides base model values)
    field_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Project-specific field values"
    )

    # Audit fields
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='added_project_ports'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Project-specific notes"
    )

    class Meta:
        unique_together = ['project', 'port']
        ordering = ['project', 'port__name']
        verbose_name = "Project Port"
        verbose_name_plural = "Project Ports"
        indexes = [
            models.Index(fields=['project', 'action']),
            models.Index(fields=['port', 'action']),
        ]

    def __str__(self):
        return f"{self.project.name}: {self.port.name} ({self.action})"