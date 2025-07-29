from django.db import models
from core.models import Project, Customer
from storage.models import Storage, Host
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User 

# Create your models here.
class Fabric(models.Model):
    customer = models.ForeignKey(Customer, related_name='fabric_customer', on_delete=models.CASCADE)
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

    def __str__(self):
        return f'{self.customer}: {self.name}'
    
    class Meta:
        unique_together = ['customer', 'name']


class Alias(models.Model):
    fabric = models.ForeignKey(Fabric, on_delete=models.CASCADE)
    projects = models.ManyToManyField(Project, related_name='alias_projects')
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='aliases', null=True, blank=True)
    USE_CHOICES = [
        ('init', 'Initiator'),
        ('target', 'Target'),
        ('both', 'Both'),
    ]
    name = models.CharField(max_length=100, unique=False)
    wwpn = models.CharField(max_length=23)
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
    create = models.BooleanField(default=False, null=True, blank=True)
    include_in_zoning = models.BooleanField(default=False, null=True, blank=True)
    host = models.ForeignKey(Host, on_delete=models.SET_NULL, related_name='alias_host', null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    imported = models.DateTimeField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)

    
    class Meta:
        ordering = ['name']
        unique_together = [
            ('fabric', 'wwpn'),
            ('fabric', 'name'),
        ]
    
    def __str__(self):
        return f'{self.fabric.customer}: {self.name}'


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
    projects = models.ManyToManyField(Project, related_name='zone_projects')
    create = models.BooleanField(default=False, null=True, blank=True)
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

    def __str__(self):
        return f'{self.fabric.customer}: {self.name}'