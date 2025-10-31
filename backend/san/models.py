from django.db import models
from core.models import Project, Customer
from storage.models import Storage, Host
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User

# Create your models here.
class Switch(models.Model):
    """Model for SAN switches (Brocade and Cisco)."""
    customer = models.ForeignKey(Customer, related_name='switches', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    san_vendor = models.CharField(
        max_length=7,
        choices=[
            ("BR", "Brocade"),
            ("CI", "Cisco"),
        ],
        default="BR",
    )

    # Network configuration
    ip_address = models.CharField(max_length=45, blank=True, null=True, help_text="IPv4 or IPv6 address")
    subnet_mask = models.CharField(max_length=45, blank=True, null=True)
    gateway = models.CharField(max_length=45, blank=True, null=True)
    management_url = models.URLField(blank=True, null=True, help_text="Web management interface URL")
    wwnn = models.CharField(max_length=23, blank=True, null=True, help_text="World Wide Node Name (WWNN)")

    # Hardware/Software information
    model = models.CharField(max_length=100, blank=True, null=True, help_text="Switch model (e.g., MDS 9148S, G620)")
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    firmware_version = models.CharField(max_length=50, blank=True, null=True, help_text="Firmware/OS version")

    # Status and location
    is_active = models.BooleanField(default=True, help_text="Whether switch is currently active/in use")
    location = models.CharField(max_length=200, blank=True, null=True, help_text="Physical location (datacenter/rack)")
    notes = models.TextField(null=True, blank=True)

    # Lifecycle tracking
    committed = models.BooleanField(
        default=False,
        help_text="Changes approved/finalized"
    )
    deployed = models.BooleanField(
        default=False,
        help_text="Actually deployed to infrastructure"
    )
    created_by_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_switches',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_switches',
        help_text="User who last modified this switch"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return f'{self.customer}: {self.name}'

    class Meta:
        unique_together = ['customer', 'name']
        ordering = ['customer__name', 'name']
        verbose_name = "Switch"
        verbose_name_plural = "Switches"


class SwitchFabric(models.Model):
    """
    Junction table for Switch-Fabric many-to-many relationship with domain ID.
    Domain ID represents a switch's unique identifier within a specific fabric.
    """
    switch = models.ForeignKey(Switch, on_delete=models.CASCADE, related_name='switch_fabrics')
    fabric = models.ForeignKey('Fabric', on_delete=models.CASCADE, related_name='fabric_switches')
    domain_id = models.IntegerField(
        blank=True,
        null=True,
        validators=[MinValueValidator(0), MaxValueValidator(999)],
        help_text="Switch's domain ID within this fabric (0-999)"
    )

    class Meta:
        unique_together = [
            ['switch', 'fabric'],  # Each switch-fabric pair is unique
            ['fabric', 'domain_id']  # Domain ID must be unique per fabric
        ]
        ordering = ['fabric', 'switch']
        verbose_name = "Switch-Fabric Assignment"
        verbose_name_plural = "Switch-Fabric Assignments"

    def __str__(self):
        domain_str = f" (Domain: {self.domain_id})" if self.domain_id is not None else ""
        return f"{self.switch.name} on {self.fabric.name}{domain_str}"


class Fabric(models.Model):
    customer = models.ForeignKey(Customer, related_name='fabric_customer', on_delete=models.CASCADE)
    switches = models.ManyToManyField(
        Switch,
        through='SwitchFabric',
        related_name='fabrics',
        blank=True,
        help_text="Switches this fabric belongs to"
    )
    name = models.CharField(max_length=64)
    zoneset_name = models.CharField(max_length=200)
    san_vendor = models.CharField(
        max_length=7,
        choices=[
            ("BR", "Brocade"),
            ("CI", "Cisco"),
        ],
        default="BR",
    )
    vsan = models.IntegerField(blank=True, null=True)
    exists = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    # Lifecycle tracking
    committed = models.BooleanField(
        default=False,
        help_text="Changes approved/finalized"
    )
    deployed = models.BooleanField(
        default=False,
        help_text="Actually deployed to infrastructure"
    )
    created_by_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_fabrics',
        help_text="Project that originally created this entity"
    )

    # Audit fields for tracking modifications
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_fabrics',
        help_text="User who last modified this fabric"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    def __str__(self):
        return f'{self.customer}: {self.name}'

    class Meta:
        unique_together = ['customer', 'name']


class Alias(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='aliases', null=True, blank=True)
    USE_CHOICES = [
        ('init', 'Initiator'),
        ('target', 'Target'),
        ('both', 'Both'),
    ]
    name = models.CharField(max_length=100, unique=False)
    use = models.CharField(max_length=6, choices=USE_CHOICES, null=True, blank=True)
    cisco_alias = models.CharField(
        max_length=15,
        choices=[
            ("device-alias", "device-alias"),
            ("fcalias", "fcalias"),
            ("wwpn", "wwpn"),
        ],
        default="device-alias",
    null=True,
    blank=True)
    logged_in = models.BooleanField(default=False, null=True, blank=True)
    host = models.ForeignKey(Host, on_delete=models.SET_NULL, related_name='alias_host', null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    imported = models.DateTimeField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)

    # Lifecycle tracking
    committed = models.BooleanField(
        default=False,
        help_text="Changes approved/finalized"
    )
    deployed = models.BooleanField(
        default=False,
        help_text="Actually deployed to infrastructure"
    )
    created_by_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_aliases',
        help_text="Project that originally created this entity"
    )

    # Optimistic locking and audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_aliases',
        help_text="User who last modified this alias"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    class Meta:
        ordering = ['name']
        unique_together = [
            ('fabric', 'name'),
        ]

    def __str__(self):
        return f'{self.fabric.customer}: {self.name}'

    @property
    def wwpns(self):
        """Return list of WWPNs for this alias in order"""
        return [aw.wwpn for aw in self.alias_wwpns.order_by('order')]

    @property
    def wwpn(self):
        """Return first WWPN for backward compatibility"""
        first_wwpn = self.alias_wwpns.order_by('order').first()
        return first_wwpn.wwpn if first_wwpn else None


class AliasWWPN(models.Model):
    """
    Junction table for Alias to WWPN many-to-many relationship.
    Allows a single alias to have multiple WWPNs (common in SAN configurations).
    """
    alias = models.ForeignKey(Alias, on_delete=models.CASCADE, related_name='alias_wwpns')
    wwpn = models.CharField(max_length=23, help_text="World Wide Port Name")
    order = models.IntegerField(
        default=0,
        help_text="Order of WWPN in the alias (for preserving import order)"
    )

    class Meta:
        ordering = ['alias', 'order']
        unique_together = [
            ('alias', 'wwpn'),  # Each WWPN can appear only once per alias
            ('alias', 'order'),  # Each order position must be unique per alias
        ]
        verbose_name = "Alias WWPN"
        verbose_name_plural = "Alias WWPNs"

    def __str__(self):
        return f"{self.alias.name}: {self.wwpn}"


class WwpnPrefix(models.Model):
    """
    Model to store WWPN prefixes (first 4 characters) for smart initiator/target detection.
    This allows automatic classification of WWPNs based on their OUI (Organizationally Unique Identifier).
    Global prefixes apply to all customers since WWPN prefixes are vendor-specific.
    """
    prefix = models.CharField(
        max_length=4, 
        unique=True,
        help_text="First 4 characters of WWPN (e.g., '5001', '2001', 'c050')"
    )
    TYPE_CHOICES = [
        ('init', 'Initiator'),
        ('target', 'Target'),
    ]
    wwpn_type = models.CharField(
        max_length=6, 
        choices=TYPE_CHOICES,
        help_text="Whether WWPNs with this prefix should be classified as initiators or targets"
    )
    vendor = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text="Optional vendor name for reference (e.g., 'IBM', 'EMC', 'Brocade')"
    )
    description = models.CharField(
        max_length=200, 
        blank=True, 
        null=True,
        help_text="Optional description for this prefix"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['prefix']
        verbose_name = "WWPN Prefix"
        verbose_name_plural = "WWPN Prefixes"

    def __str__(self):
        vendor_part = f" ({self.vendor})" if self.vendor else ""
        return f"{self.prefix} -> {self.get_wwpn_type_display()}{vendor_part}"

    @classmethod
    def detect_wwpn_type(cls, wwpn):
        """
        Detect if a WWPN should be classified as initiator or target based on its prefix.
        
        Args:
            wwpn: WWPN string (e.g., "50:01:23:45:67:89:ab:cd")
            
        Returns:
            str: 'init', 'target', or None if no match found
        """
        if not wwpn or len(wwpn) < 4:
            return None
            
        # Clean the WWPN and get first 4 characters
        clean_wwpn = wwpn.replace(':', '').replace('-', '').lower()
        if len(clean_wwpn) < 4:
            return None
            
        prefix = clean_wwpn[:4]
        
        # Look for matching prefix
        prefix_match = cls.objects.filter(
            prefix__iexact=prefix
        ).first()
        
        return prefix_match.wwpn_type if prefix_match else None


class Zone(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, unique=False)
    exists = models.BooleanField(default=False, null=True, blank=True)
    zone_type = models.CharField(
        max_length=100,
        choices=[
            ('smart', 'smart'),
            ('standard', 'standard'),
        ],
        null=True,
        blank=True
    )
    members = models.ManyToManyField(Alias, blank=True)
    notes = models.TextField(null=True, blank=True)
    imported = models.DateTimeField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)

    # Lifecycle tracking
    committed = models.BooleanField(
        default=False,
        help_text="Changes approved/finalized"
    )
    deployed = models.BooleanField(
        default=False,
        help_text="Actually deployed to infrastructure"
    )
    created_by_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_zones',
        help_text="Project that originally created this entity"
    )

    # Optimistic locking and audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_zones',
        help_text="User who last modified this zone"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    def __str__(self):
        return f'{self.fabric.customer}: {self.name}'