from django.db import models
from core.models import Project
from customers.models import Customer
from django.contrib.auth.models import User 


class Storage(models.Model):
    customer = models.ForeignKey(Customer, related_name='storages', on_delete=models.CASCADE, blank=True, null=True)
    name = models.CharField(max_length=64)
    storage_type = models.CharField(
        max_length=20,
        choices=[
            ('FlashSystem', 'FlashSystem'), 
            ('DS8000', 'DS8000'),
            ('Switch', 'Switch'),
            ('Data Domain', 'Data Domain'),
            ('Unknown', 'Unknown')
            ])
    location = models.CharField(max_length=100, blank=True, null=True)
    storage_system_id = models.CharField(max_length=100, blank=True, null=True)
    machine_type = models.CharField(max_length=4, blank=True, null=True)
    model = models.CharField(max_length=3, blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    system_id = models.CharField(max_length=16, blank=True, null=True)
    wwnn = models.CharField(max_length=23, blank=True, null=True)
    firmware_level = models.CharField(max_length=60, blank=True, null=True)
    primary_ip = models.CharField(max_length=40, blank=True, null=True)
    secondary_ip = models.CharField(max_length=40, blank=True, null=True)
    uuid = models.CharField(max_length=36, blank=True, null=True)
    written_capacity_limit_bytes = models.BigIntegerField(blank=True, null=True)
    unmapped_capacity_percent = models.FloatField(blank=True, null=True)
    last_successful_probe = models.BigIntegerField(blank=True, null=True)
    provisioned_written_capacity_percent = models.FloatField(blank=True, null=True)
    capacity_savings_bytes = models.BigIntegerField(blank=True, null=True)
    raw_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    provisioned_capacity_percent = models.FloatField(blank=True, null=True)
    mapped_capacity_percent = models.FloatField(blank=True, null=True)
    available_written_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    mapped_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    probe_status = models.CharField(max_length=64, blank=True, null=True)
    available_volume_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    capacity_savings_percent = models.FloatField(blank=True, null=True)
    overhead_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    customer_country_code = models.CharField(max_length=10, blank=True, null=True)
    events_status = models.CharField(max_length=64, blank=True, null=True)
    unmapped_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    last_successful_monitor = models.BigIntegerField(blank=True, null=True)
    remote_relationships_count = models.CharField(max_length=10, blank=True, null=True)
    condition = models.CharField(max_length=64, blank=True, null=True)
    customer_number = models.CharField(max_length=20, blank=True, null=True)
    capacity_bytes = models.BigIntegerField(blank=True, null=True)
    used_written_capacity_percent = models.FloatField(blank=True, null=True)
    pools_count = models.IntegerField(blank=True, null=True)
    pm_status = models.CharField(max_length=64, blank=True, null=True)
    shortfall_percent = models.FloatField(blank=True, null=True)
    used_written_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    available_system_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    used_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    volumes_count = models.IntegerField(blank=True, null=True)
    deduplication_savings_percent = models.FloatField(blank=True, null=True)
    data_collection = models.CharField(max_length=64, blank=True, null=True)
    available_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    used_capacity_percent = models.FloatField(blank=True, null=True)
    disks_count = models.IntegerField(blank=True, null=True)
    unprotected_volumes_count = models.CharField(max_length=10, blank=True, null=True)
    provisioned_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    available_system_capacity_percent = models.FloatField(blank=True, null=True)
    deduplication_savings_bytes = models.BigIntegerField(blank=True, null=True)
    vendor = models.CharField(max_length=64, blank=True, null=True)
    recent_fill_rate = models.FloatField(blank=True, null=True)
    recent_growth = models.FloatField(blank=True, null=True)
    time_zone = models.CharField(max_length=64, blank=True, null=True)
    fc_ports_count = models.IntegerField(blank=True, null=True)
    staas_environment = models.BooleanField(blank=True, null=True)
    element_manager_url = models.URLField(blank=True, null=True)
    probe_schedule = models.TextField(blank=True, null=True)
    acknowledged = models.BooleanField(blank=True, null=True)
    safe_guarded_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    read_cache_bytes = models.BigIntegerField(blank=True, null=True)
    write_cache_bytes = models.BigIntegerField(blank=True, null=True)
    compressed = models.BooleanField(blank=True, null=True)
    callhome_system = models.BooleanField(blank=True, null=True)
    ransomware_threat_detection = models.CharField(max_length=64, blank=True, null=True)
    threat_notification_recipients = models.TextField(blank=True, null=True)
    current_power_usage_watts = models.IntegerField(blank=True, null=True)
    system_temperature_celsius = models.FloatField(blank=True, null=True)
    system_temperature_Fahrenheit = models.FloatField(blank=True, null=True)
    power_efficiency = models.FloatField(blank=True, null=True)
    co2_emission = models.FloatField(blank=True, null=True)
    safeguarded_virtual_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    safeguarded_used_capacity_percentage = models.FloatField(blank=True, null=True)
    data_collection_type = models.CharField(max_length=64, blank=True, null=True)
    data_reduction_savings_percent = models.FloatField(blank=True, null=True)
    data_reduction_savings_bytes = models.BigIntegerField(blank=True, null=True)
    data_reduction_ratio = models.FloatField(blank=True, null=True)
    total_compression_ratio = models.FloatField(blank=True, null=True)
    host_connections_count = models.IntegerField(blank=True, null=True)
    drive_compression_savings_percent = models.FloatField(blank=True, null=True)
    remaining_unallocated_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    pool_compression_savings_bytes = models.BigIntegerField(blank=True, null=True)
    compression_savings_bytes = models.BigIntegerField(blank=True, null=True)
    compression_savings_percent = models.FloatField(blank=True, null=True)
    ip_ports_count = models.IntegerField(blank=True, null=True)
    overprovisioned_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    unallocated_volume_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    managed_disks_count = models.IntegerField(blank=True, null=True)
    drive_compression_savings_bytes = models.BigIntegerField(blank=True, null=True)
    pool_compression_savings_percent = models.FloatField(blank=True, null=True)
    drive_compression_ratio = models.FloatField(blank=True, null=True)
    pool_compression_ratio = models.FloatField(blank=True, null=True)
    topology = models.CharField(max_length=64, blank=True, null=True)
    cluster_id_alias = models.CharField(max_length=64, blank=True, null=True)
    snapshot_written_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    snapshot_provisioned_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    total_savings_ratio = models.FloatField(blank=True, null=True)
    volume_groups_count = models.IntegerField(blank=True, null=True)
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
        related_name='created_storage_systems',
        help_text="Project that originally created this entity"
    )

    # Audit fields for tracking modifications
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_storage_systems',
        help_text="User who last modified this storage system"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    @property
    def db_volumes_count(self):
        """
        Returns the count of Volume records related to this Storage in the database.
        """
        return self.volumes.count()
    
    @property
    def db_hosts_count(self):
        """
        Returns the count of Host records related to this Storage in the database.
        """
        return self.owning_storage.count()
    
    @property
    def db_aliases_count(self):
        """
        Returns the count of Alias records related to this Storage in the database.
        """
        return self.aliases.count()

    @property
    def db_ports_count(self):
        """
        Returns the count of Port records related to this Storage in the database.
        """
        return self.ports.count()


    def storage_image(self):
        storage_image = f'IBM.2107-{self.serial_number[:-1] + "1"}'
        return storage_image
    
    def __str__(self):
        return f'{self.customer}: {self.name}' if self.customer else self.name
    
    class Meta:
        unique_together = ['customer', 'name']


class Pool(models.Model):
    """
    Storage pool model for DS8000 and FlashSystem storage systems.
    DS8000 pools can be FB (Fixed Block) or CKD (Count Key Data).
    FlashSystem pools are always FB.
    """
    STORAGE_TYPE_CHOICES = [
        ('FB', 'Fixed Block'),
        ('CKD', 'Count Key Data'),
    ]

    name = models.CharField(
        max_length=16,
        help_text="Pool name (max 16 chars for DS8000 compatibility)"
    )
    storage = models.ForeignKey(
        Storage,
        on_delete=models.CASCADE,
        related_name='pools'
    )
    storage_type = models.CharField(
        max_length=3,
        choices=STORAGE_TYPE_CHOICES,
        default='FB',
        help_text="FB (Fixed Block) or CKD (Count Key Data) - FlashSystem is always FB"
    )

    # Lifecycle tracking (following existing pattern)
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
        related_name='created_pools',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_pools',
        help_text="User who last modified this pool"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    # Unique identifier
    unique_id = models.CharField(max_length=64, unique=True)

    imported = models.DateTimeField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['storage', 'name']
        ordering = ['storage', 'name']

    def __str__(self):
        return f'{self.storage.name}: {self.name}'

    @property
    def db_volumes_count(self):
        """Count of volumes using this pool"""
        return self.volumes.count()


class Host(models.Model):
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(Storage, related_name="owning_storage", on_delete=models.CASCADE)

    # Storage Insights fields
    acknowledged = models.CharField(max_length=10, blank=True, null=True)
    wwpns = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=32, blank=True, null=True)
    storage_system = models.CharField(max_length=64, blank=True, null=True)
    associated_resource = models.CharField(max_length=100, blank=True, null=True)
    host_type = models.CharField(max_length=64, blank=True, null=True)
    vols_count = models.IntegerField(blank=True, null=True)
    fc_ports_count = models.IntegerField(blank=True, null=True)
    last_data_collection = models.BigIntegerField(blank=True, null=True)
    volume_group = models.CharField(max_length=100, blank=True, null=True)
    natural_key = models.CharField(max_length=64, blank=True, null=True)
    volumes = models.ManyToManyField('Volume', related_name='hosts', blank=True)
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
        related_name='created_hosts',
        help_text="Project that originally created this entity"
    )

    # Optimistic locking and audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_hosts',
        help_text="User who last modified this host"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    class Meta:
        unique_together = ['storage', 'name']

    def get_all_wwpns(self):
        """Returns list of all WWPNs (manual + from aliases) with source info"""
        wwpns = []
        for host_wwpn in self.host_wwpns.select_related('source_alias__fabric').all():
            wwpn_info = {
                'wwpn': host_wwpn.wwpn,
                'source_type': host_wwpn.source_type,
                'source_alias': host_wwpn.source_alias.name if host_wwpn.source_alias else None,
                'source_alias_id': host_wwpn.source_alias.id if host_wwpn.source_alias else None,
                'aligned': host_wwpn.source_type == 'alias'
            }
            
            # Add fabric information for alias-sourced WWPNs
            if host_wwpn.source_alias and host_wwpn.source_alias.fabric:
                wwpn_info.update({
                    'source_fabric_name': host_wwpn.source_alias.fabric.name,
                    'source_fabric_id': host_wwpn.source_alias.fabric.id
                })
            
            wwpns.append(wwpn_info)
        return wwpns

    def get_wwpn_display_string(self):
        """Returns comma-separated WWPNs for table display"""
        return ', '.join([w['wwpn'] for w in self.get_all_wwpns()])

    def __str__(self):
        return f'{self.storage.name if self.storage else "No Storage"}: {self.name}'


class HostWwpn(models.Model):
    """Individual WWPN assignments to hosts with source tracking"""
    host = models.ForeignKey(Host, related_name='host_wwpns', on_delete=models.CASCADE)
    wwpn = models.CharField(max_length=23, help_text="Formatted WWPN (e.g., 50:01:23:45:67:89:AB:CD)")
    source_type = models.CharField(
        max_length=10,
        choices=[
            ('manual', 'Manual'),
            ('alias', 'From Alias'),
        ],
        default='manual'
    )
    source_alias = models.ForeignKey(
        'san.Alias', 
        null=True, 
        blank=True, 
        on_delete=models.CASCADE,
        help_text="If source_type='alias', this references the source alias"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['host', 'wwpn']
        ordering = ['created_at']
    
    def __str__(self):
        source = f" (from {self.source_alias.name})" if self.source_alias else ""
        return f'{self.host.name}: {self.wwpn}{source}'


# Volume model
class Port(models.Model):
    """
    Model for storage system ports (Fibre Channel and Ethernet).
    Tracks physical port configuration and connectivity.
    """
    PORT_TYPE_CHOICES = [
        ('fc', 'Fibre Channel'),
        ('ethernet', 'Ethernet'),
    ]

    USE_CHOICES = [
        ('host', 'Host'),
        ('replication', 'Replication'),
        ('both', 'Both'),
    ]

    # Speed choices - validated based on port type in the view
    FC_SPEED_CHOICES = [8, 16, 32, 64]
    ETHERNET_SPEED_CHOICES = [1, 10, 25, 100]

    # Protocol choices - validated based on port type AND storage type
    # FC + DS8000: FICON, SCSI FCP
    # FC + FlashSystem: SCSI FCP, NVMe FCP
    # Ethernet: TCP/IP, iSCSI, RDMA
    PROTOCOL_CHOICES = [
        ('FICON', 'FICON'),
        ('SCSI FCP', 'SCSI FCP'),
        ('NVMe FCP', 'NVMe FCP'),
        ('TCP/IP', 'TCP/IP'),
        ('iSCSI', 'iSCSI'),
        ('RDMA', 'RDMA'),
    ]

    storage = models.ForeignKey(Storage, related_name='ports', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    wwpn = models.CharField(max_length=23, unique=True, blank=True, null=True, help_text="World Wide Port Name (with or without colons)")
    type = models.CharField(max_length=10, choices=PORT_TYPE_CHOICES)
    speed_gbps = models.IntegerField(blank=True, null=True, help_text="Port speed in Gbps (optional)")
    location = models.CharField(max_length=200, blank=True, null=True)
    frame = models.IntegerField(blank=True, null=True)
    io_enclosure = models.IntegerField(blank=True, null=True)
    fabric = models.ForeignKey('san.Fabric', on_delete=models.SET_NULL, null=True, blank=True, related_name='ports')
    alias = models.ForeignKey('san.Alias', on_delete=models.SET_NULL, null=True, blank=True, related_name='ports')
    protocol = models.CharField(max_length=20, choices=PROTOCOL_CHOICES, blank=True, null=True)
    use = models.CharField(max_length=20, choices=USE_CHOICES, blank=True, null=True)

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
        'core.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_ports',
        help_text="Project that originally created this entity"
    )

    # Audit fields for tracking modifications
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_ports',
        help_text="User who last modified this port"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['storage', 'name']

    def __str__(self):
        return f'{self.storage.name}: {self.name} ({self.wwpn})'


class Volume(models.Model):
    storage = models.ForeignKey(Storage, related_name='volumes', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    volume_id = models.CharField(max_length=16)
    volume_number = models.IntegerField(blank=True, null=True)
    volser = models.CharField(max_length=20, blank=True, null=True)
    format = models.CharField(max_length=10, blank=True, null=True)
    natural_key = models.CharField(max_length=50, blank=True, null=True)

    capacity_bytes = models.BigIntegerField(blank=True, null=True)
    used_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    used_capacity_percent = models.FloatField(blank=True, null=True)
    available_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    written_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    written_capacity_percent = models.FloatField(blank=True, null=True)
    reserved_volume_capacity_bytes = models.BigIntegerField(blank=True, null=True)

    tier0_flash_capacity_percent = models.FloatField(blank=True, null=True)
    tier1_flash_capacity_percent = models.FloatField(blank=True, null=True)
    scm_capacity_percent = models.FloatField(blank=True, null=True)
    enterprise_hdd_capacity_percent = models.FloatField(blank=True, null=True)
    nearline_hdd_capacity_percent = models.FloatField(blank=True, null=True)
    tier_distribution_percent = models.FloatField(blank=True, null=True)

    tier0_flash_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    tier1_flash_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    scm_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    enterprise_hdd_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    nearline_hdd_capacity_bytes = models.BigIntegerField(blank=True, null=True)

    safeguarded_virtual_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    safeguarded_used_capacity_percentage = models.FloatField(blank=True, null=True)
    safeguarded_allocation_capacity_bytes = models.BigIntegerField(blank=True, null=True)

    shortfall_percent = models.FloatField(blank=True, null=True)
    warning_level_percent = models.FloatField(blank=True, null=True)

    compression_saving_percent = models.FloatField(blank=True, null=True)
    grain_size_bytes = models.BigIntegerField(blank=True, null=True)
    compressed = models.BooleanField(blank=True, null=True)
    thin_provisioned = models.CharField(max_length=32, blank=True, null=True)

    encryption = models.CharField(max_length=10, blank=True, null=True)
    flashcopy = models.CharField(max_length=10, blank=True, null=True)
    auto_expand = models.BooleanField(blank=True, null=True)
    easy_tier = models.CharField(max_length=32, blank=True, null=True)
    easy_tier_status = models.CharField(max_length=32, blank=True, null=True)

    pool = models.ForeignKey(
        'Pool',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='volumes',
        help_text="Pool this volume belongs to"
    )
    lss_lcu = models.CharField(max_length=10, blank=True, null=True)
    node = models.CharField(max_length=32, blank=True, null=True)
    block_size = models.IntegerField(blank=True, null=True)

    unique_id = models.CharField(max_length=64, unique=True, blank=True, null=True)
    acknowledged = models.BooleanField(blank=True, null=True)
    status_label = models.CharField(max_length=32, blank=True, null=True)
    raid_level = models.CharField(max_length=32, blank=True, null=True)
    copy_id = models.IntegerField(blank=True, null=True)
    safeguarded = models.CharField(max_length=16, blank=True, null=True)

    last_data_collection = models.BigIntegerField(blank=True, null=True)

    scm_available_capacity_bytes = models.BigIntegerField(blank=True, null=True)
    io_group = models.CharField(max_length=32, blank=True, null=True)
    formatted = models.CharField(max_length=10, blank=True, null=True)
    virtual_disk_type = models.CharField(max_length=32, blank=True, null=True)
    fast_write_state = models.CharField(max_length=32, blank=True, null=True)
    vdisk_mirror_copies = models.CharField(max_length=10, blank=True, null=True)
    vdisk_mirror_role = models.CharField(max_length=16, blank=True, null=True)
    deduplicated = models.CharField(max_length=10, blank=True, null=True)
    alias = models.BooleanField(
        default=False,
        help_text="True if this volume is an alias volume"
    )
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
        related_name='created_volumes',
        help_text="Project that originally created this entity"
    )

    # Optimistic locking and audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_volumes',
        help_text="User who last modified this volume"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")

    def __str__(self):
        return self.name


class HostCluster(models.Model):
    """
    Groups multiple hosts that SHARE the same volumes.
    All hosts in a cluster receive identical volume mappings.
    Scoped to a single storage system.
    """
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(
        Storage,
        on_delete=models.CASCADE,
        related_name='host_clusters'
    )
    hosts = models.ManyToManyField(
        Host,
        related_name='clusters',
        blank=True,
        help_text="Hosts in this cluster that share volumes"
    )
    notes = models.TextField(null=True, blank=True)

    # Lifecycle tracking (matches existing pattern)
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
        related_name='created_host_clusters',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_host_clusters',
        help_text="User who last modified this host cluster"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['storage', 'name']
        ordering = ['storage', 'name']

    def __str__(self):
        return f"{self.storage.name}: {self.name} ({self.hosts.count()} hosts)"

    @property
    def host_count(self):
        """Returns the count of hosts in this cluster"""
        return self.hosts.count()

    @property
    def volume_count(self):
        """Returns the count of volumes mapped to this cluster"""
        return self.volume_mappings.count()


class IBMiLPAR(models.Model):
    """
    Groups hosts for EVEN DISTRIBUTION of volumes (round-robin).
    For DS8000: Also distributes evenly across LSS.
    Scoped to a single storage system.
    """
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(
        Storage,
        on_delete=models.CASCADE,
        related_name='ibmi_lpars'
    )
    hosts = models.ManyToManyField(
        Host,
        related_name='ibmi_lpars',
        blank=True,
        help_text="Hosts in this LPAR that receive distributed volumes"
    )
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
        related_name='created_ibmi_lpars',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_ibmi_lpars',
        help_text="User who last modified this LPAR"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=0, help_text="Version number for optimistic locking")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['storage', 'name']
        ordering = ['storage', 'name']
        verbose_name = "IBM i LPAR"
        verbose_name_plural = "IBM i LPARs"

    def __str__(self):
        return f"{self.storage.name}: {self.name} ({self.hosts.count()} hosts)"

    @property
    def host_count(self):
        """Returns the count of hosts in this LPAR"""
        return self.hosts.count()

    @property
    def volume_count(self):
        """Returns the count of volumes mapped to this LPAR"""
        return self.volume_mappings.count()


class VolumeMapping(models.Model):
    """
    Tracks volume-to-target mappings with project lifecycle support.
    Target can be Host, HostCluster, or IBMiLPAR.
    Uses separate FK fields for simpler queries (vs GenericForeignKey).
    """
    TARGET_TYPE_CHOICES = [
        ('host', 'Host'),
        ('cluster', 'Host Cluster'),
        ('lpar', 'IBM i LPAR'),
    ]

    volume = models.ForeignKey(
        Volume,
        on_delete=models.CASCADE,
        related_name='volume_mappings'
    )

    # Target polymorphism (only one populated based on target_type)
    target_type = models.CharField(max_length=10, choices=TARGET_TYPE_CHOICES)
    target_host = models.ForeignKey(
        Host,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='direct_volume_mappings'
    )
    target_cluster = models.ForeignKey(
        HostCluster,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='volume_mappings'
    )
    target_lpar = models.ForeignKey(
        IBMiLPAR,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='volume_mappings'
    )

    # For LPAR mappings, track which specific host received this volume
    assigned_host = models.ForeignKey(
        Host,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_volume_mappings',
        help_text="For LPAR targets: the specific host this volume was assigned to"
    )

    # LUN ID if specified
    lun_id = models.IntegerField(null=True, blank=True)

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
        related_name='created_volume_mappings',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_volume_mappings',
        help_text="User who last modified this mapping"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['volume', 'target_type']
        indexes = [
            models.Index(fields=['volume', 'target_type']),
            models.Index(fields=['target_host']),
            models.Index(fields=['target_cluster']),
            models.Index(fields=['target_lpar']),
        ]

    def get_target(self):
        """Return the actual target object"""
        if self.target_type == 'host':
            return self.target_host
        elif self.target_type == 'cluster':
            return self.target_cluster
        elif self.target_type == 'lpar':
            return self.target_lpar
        return None

    def get_target_name(self):
        """Return the target's name for display"""
        target = self.get_target()
        return target.name if target else 'Unknown'

    def __str__(self):
        target = self.get_target()
        return f"{self.volume.name} -> {target.name if target else 'Unknown'}"


class LSSSummary(models.Model):
    """
    Stores per-LSS configuration (SSID) for DS8000 storage systems.
    LSS data (volume counts, type) is computed from Volume table.
    LSS = first 2 hex digits of DS8000 volume_id (e.g., 50 for volumes 5000-50FF).
    """
    storage = models.ForeignKey(
        Storage,
        on_delete=models.CASCADE,
        related_name='lss_summaries'
    )
    lss = models.CharField(
        max_length=2,
        help_text="2 hex digit LSS identifier (00-FF)"
    )
    ssid = models.CharField(
        max_length=4,
        blank=True,
        null=True,
        help_text="4 hex digit SSID (e.g., 0000-FFFF)"
    )

    # Lifecycle tracking (following existing patterns)
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
        related_name='created_lss_summaries',
        help_text="Project that originally created this entity"
    )

    # Audit fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modified_lss_summaries',
        help_text="User who last modified this LSS summary"
    )
    last_modified_at = models.DateTimeField(auto_now=True, null=True)
    version = models.IntegerField(default=1, help_text="Version number for optimistic locking")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['storage', 'lss']
        ordering = ['storage', 'lss']
        verbose_name = "LSS Summary"
        verbose_name_plural = "LSS Summaries"

    def __str__(self):
        return f"{self.storage.name}: LSS {self.lss}"
