from django.db import models
from core.models import Project
from customers.models import Customer
from django.contrib.auth.models import User 


class Storage(models.Model):
    # Replace project with customer
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


    def storage_image(self):
        storage_image = f'IBM.2107-{self.serial_number[:-1] + "1"}'
        return storage_image
    
    def __str__(self):
        return f'{self.customer}: {self.name}' if self.customer else self.name
    
    class Meta:
        unique_together = ['customer', 'name']



class Host(models.Model):
    project = models.ForeignKey(Project, related_name='host_project', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    storage = models.ForeignKey(Storage, related_name="owning_storage", on_delete=models.CASCADE, null=True, blank=True)

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

    class Meta:
        unique_together = ['project', 'name']

    def __str__(self):
        return f'{self.project}: {self.name}'


# Volume model
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

    pool_name = models.CharField(max_length=64, blank=True, null=True)
    pool_id = models.CharField(max_length=64, blank=True, null=True)
    lss_lcu = models.CharField(max_length=10, blank=True, null=True)
    node = models.CharField(max_length=32, blank=True, null=True)
    block_size = models.IntegerField(blank=True, null=True)

    unique_id = models.CharField(max_length=64, unique=True)
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
    imported = models.DateTimeField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name
