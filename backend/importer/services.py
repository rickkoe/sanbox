from django.utils import timezone
from storage.models import Storage, Volume, Host
from .models import StorageImport
from .api_client import StorageInsightsClient
from typing import Dict, List


class SimpleStorageImporter:
    """Simple service for importing storage data from IBM Storage Insights"""
    
    def __init__(self, customer):
        self.customer = customer
        self.import_record = None
        
        # Get the active project for this customer
        try:
            self.project = self.customer.config.active_project
            if not self.project:
                raise Exception("No active project configured for this customer")
        except AttributeError:
            raise Exception("Customer has no configuration or active project")
    
    def import_storage_data(self) -> StorageImport:
        """Main import method - simple and straightforward"""
        
        # Create import record
        self.import_record = StorageImport.objects.create(
            customer=self.customer,
            status='running'
        )
        
        try:
            # Get API credentials from customer model
            if not self.customer.insights_api_key or not self.customer.insights_tenant:
                raise Exception("No Storage Insights API credentials configured for this customer")
            
            # Check if we should use mock data (for testing when API is not available)
            use_mock_data = False  # Set to False to use real API data
            
            if use_mock_data:
                # Use mock data for testing
                storage_systems, volumes_by_system, hosts_by_system = self._get_mock_data()
            else:
                # Create API client
                client = StorageInsightsClient(self.customer.insights_tenant, self.customer.insights_api_key)
                
                # Fetch all data
                storage_systems, volumes_by_system, hosts_by_system = client.get_all_data()
                
                # Log summary of fetched data
                total_volumes = sum(len(vols) for vols in volumes_by_system.values())
                total_hosts = sum(len(hosts) for hosts in hosts_by_system.values())
                print(f"Fetched {len(storage_systems)} storage systems, {total_volumes} volumes, {total_hosts} hosts")
            
            # Import data with individual error handling
            # Log debug info to import logs
            from .models import ImportLog
            ImportLog.objects.create(
                import_record=self.import_record,
                level='DEBUG',
                message=f"About to import data: {len(storage_systems)} storage systems, {len(volumes_by_system)} volume systems, {len(hosts_by_system)} host systems"
            )
            
            for sys_id, hosts in hosts_by_system.items():
                ImportLog.objects.create(
                    import_record=self.import_record,
                    level='DEBUG',
                    message=f"System {sys_id}: {len(hosts)} hosts to import"
                )
            
            print(f"🔍 DEBUG: About to import data:")
            print(f"   - Storage systems: {len(storage_systems)}")
            print(f"   - Volumes by system: {len(volumes_by_system)} systems")
            print(f"   - Hosts by system: {len(hosts_by_system)} systems")
            for sys_id, hosts in hosts_by_system.items():
                print(f"     System {sys_id}: {len(hosts)} hosts")
            
            systems_imported = 0
            volumes_imported = 0
            hosts_imported = 0
            
            try:
                systems_imported = self._import_storage_systems(storage_systems, volumes_by_system)
                print(f"✅ Storage systems imported: {systems_imported}")
            except Exception as e:
                error_msg = f"Storage systems import failed: {str(e)}"
                print(f"❌ {error_msg}")
                ImportLog.objects.create(
                    import_record=self.import_record,
                    level='ERROR',
                    message=error_msg
                )
            
            try:
                volumes_imported = self._import_volumes(storage_systems, volumes_by_system)
                print(f"✅ Volumes imported: {volumes_imported}")
            except Exception as e:
                error_msg = f"Volumes import failed: {str(e)}"
                print(f"❌ {error_msg}")
                ImportLog.objects.create(
                    import_record=self.import_record,
                    level='ERROR',
                    message=error_msg
                )
            
            try:
                print(f"🔍 DEBUG: About to import hosts...")
                hosts_imported = self._import_hosts(hosts_by_system)
                print(f"🔍 DEBUG: Hosts imported: {hosts_imported}")
            except Exception as e:
                error_msg = f"Hosts import failed: {str(e)}"
                print(f"❌ {error_msg}")
                ImportLog.objects.create(
                    import_record=self.import_record,
                    level='ERROR',
                    message=error_msg
                )
            
            # Log host import results
            ImportLog.objects.create(
                import_record=self.import_record,
                level='INFO',
                message=f"Import results - Systems: {systems_imported}, Volumes: {volumes_imported}, Hosts: {hosts_imported}"
            )
            
            # Update import record
            self.import_record.status = 'completed'
            self.import_record.completed_at = timezone.now()
            self.import_record.storage_systems_imported = systems_imported
            self.import_record.volumes_imported = volumes_imported
            self.import_record.hosts_imported = hosts_imported
            self.import_record.api_response_summary = {
                'storage_systems_count': len(storage_systems),
                'total_volumes': sum(len(vols) for vols in volumes_by_system.values()),
                'total_hosts': sum(len(hosts) for hosts in hosts_by_system.values())
            }
            self.import_record.save()
            
            return self.import_record
            
        # Credentials are now checked in customer model validation
        except Exception as e:
            return self._fail_import(f"Import failed: {str(e)}")
    
    def _run_import_with_progress(self, task):
        """Run import with Celery progress updates"""
        try:
            # Get logger if available
            logger = getattr(self, 'logger', None)
            
            # Get API credentials from customer model
            if not self.customer.insights_api_key or not self.customer.insights_tenant:
                error_msg = "No Storage Insights API credentials configured for this customer"
                if logger:
                    logger.error(error_msg)
                raise Exception(error_msg)
            
            if logger:
                logger.info(f"API credentials found - tenant: {self.customer.insights_tenant}")
            
            # Check if we should use mock data (for testing when API is not available)
            use_mock_data = False  # Set to False to use real API data
            
            if use_mock_data:
                if logger:
                    logger.info("Using mock data for testing")
                
                # Update progress
                task.update_state(
                    state='PROGRESS',
                    meta={
                        'current': 30,
                        'total': 100,
                        'status': 'Generating mock data for testing...',
                        'import_id': self.import_record.id
                    }
                )
                
                # Use mock data for testing
                storage_systems, volumes_by_system, hosts_by_system = self._get_mock_data()
                
                if logger:
                    logger.info(f"Generated {len(storage_systems)} mock storage systems")
            else:
                if logger:
                    logger.info("Creating IBM Storage Insights API client")
                
                # Create API client
                client = StorageInsightsClient(self.customer.insights_tenant, self.customer.insights_api_key)
                
                # Update progress
                task.update_state(
                    state='PROGRESS',
                    meta={
                        'current': 50,
                        'total': 100,
                        'status': 'Fetching storage systems and volumes...',
                        'import_id': self.import_record.id
                    }
                )
                
                if logger:
                    logger.info("Calling IBM Storage Insights API...")
                
                # Fetch all data
                storage_systems, volumes_by_system, hosts_by_system = client.get_all_data()
                
                if logger:
                    logger.info("Successfully received data from API")
            
            # Log summary of fetched data
            total_volumes = sum(len(vols) for vols in volumes_by_system.values())
            total_hosts = sum(len(hosts) for hosts in hosts_by_system.values())
            
            if logger:
                logger.info(f"Data fetched successfully: {len(storage_systems)} storage systems, {total_volumes} volumes, {total_hosts} hosts")
            
            print(f"Fetched {len(storage_systems)} storage systems, {total_volumes} volumes, {total_hosts} hosts")
            
            # Update progress
            task.update_state(
                state='PROGRESS',
                meta={
                    'current': 75,
                    'total': 100,
                    'status': f'Importing {len(storage_systems)} systems, {total_volumes} volumes, {total_hosts} hosts...',
                    'import_id': self.import_record.id
                }
            )
            
            # Import data with individual error handling
            systems_imported = 0
            volumes_imported = 0
            hosts_imported = 0
            
            try:
                if logger:
                    logger.info("Starting storage systems import...")
                systems_imported = self._import_storage_systems(storage_systems, volumes_by_system)
                if logger:
                    logger.info(f"Imported {systems_imported} storage systems")
            except Exception as e:
                error_msg = f"Storage systems import failed: {str(e)}"
                if logger:
                    logger.error(error_msg)
                # Continue with other imports even if storage systems fail
            
            try:
                if logger:
                    logger.info("Starting volumes import...")
                volumes_imported = self._import_volumes(storage_systems, volumes_by_system)
                if logger:
                    logger.info(f"Imported {volumes_imported} volumes")
            except Exception as e:
                error_msg = f"Volumes import failed: {str(e)}"
                if logger:
                    logger.error(error_msg)
                # Continue with hosts import even if volumes fail
            
            try:
                if logger:
                    logger.info("Starting hosts import...")
                hosts_imported = self._import_hosts(hosts_by_system)
                if logger:
                    logger.info(f"Imported {hosts_imported} hosts")
            except Exception as e:
                error_msg = f"Hosts import failed: {str(e)}"
                if logger:
                    logger.error(error_msg)
            
            if logger:
                logger.info(f"Import completed - Systems: {systems_imported}, Volumes: {volumes_imported}, Hosts: {hosts_imported}")
            
            # Update progress
            task.update_state(
                state='PROGRESS',
                meta={
                    'current': 100,
                    'total': 100,
                    'status': 'Finalizing import...',
                    'import_id': self.import_record.id
                }
            )
            
            # Update import record
            self.import_record.status = 'completed'
            self.import_record.completed_at = timezone.now()
            self.import_record.storage_systems_imported = systems_imported
            self.import_record.volumes_imported = volumes_imported
            self.import_record.hosts_imported = hosts_imported
            self.import_record.api_response_summary = {
                'storage_systems_count': len(storage_systems),
                'total_volumes': sum(len(vols) for vols in volumes_by_system.values()),
                'total_hosts': sum(len(hosts) for hosts in hosts_by_system.values())
            }
            self.import_record.save()
            
            return self.import_record
            
        # Credentials are now checked in customer model validation
        except Exception as e:
            return self._fail_import(f"Import failed: {str(e)}")
    
    def _fail_import(self, error_message: str) -> StorageImport:
        """Helper to mark import as failed"""
        self.import_record.status = 'failed'
        self.import_record.completed_at = timezone.now()
        self.import_record.error_message = error_message
        self.import_record.save()
        return self.import_record
    
    def _import_storage_systems(self, systems_data: List[Dict], volumes_by_system: Dict) -> int:
        """Import storage systems with simple field mapping"""
        imported_count = 0
        
        for i, system_data in enumerate(systems_data):
            try:
                system_id = system_data.get('storage_system_id')  # Use correct field name
                if not system_id:
                    continue
                
                # Map ALL available API fields to Storage model fields
                defaults = {
                    'customer': self.customer,
                    'name': system_data.get('name', ''),
                    'storage_type': self._map_storage_type(system_data.get('type', '')),
                    'storage_system_id': system_id,
                    'machine_type': system_data.get('machine_type'),
                    'model': system_data.get('model', ''),
                    'serial_number': system_data.get('serial_number', ''),
                    'system_id': system_data.get('system_id'),
                    'wwnn': system_data.get('wwnn'),
                    'firmware_level': system_data.get('firmware_level'),
                    'primary_ip': system_data.get('primary_ip'),
                    'secondary_ip': system_data.get('secondary_ip'),
                    'uuid': system_data.get('uuid') or system_id,
                    'vendor': system_data.get('vendor', ''),
                    'location': system_data.get('location', ''),
                    'probe_status': system_data.get('probe_status', ''),
                    'condition': system_data.get('condition', ''),
                    
                    # Capacity fields
                    'written_capacity_limit_bytes': system_data.get('written_capacity_limit_bytes'),
                    'unmapped_capacity_percent': system_data.get('unmapped_capacity_percent'),
                    'provisioned_written_capacity_percent': system_data.get('provisioned_written_capacity_percent'),
                    'capacity_savings_bytes': system_data.get('capacity_savings_bytes'),
                    'raw_capacity_bytes': system_data.get('raw_capacity_bytes'),
                    'provisioned_capacity_percent': system_data.get('provisioned_capacity_percent'),
                    'mapped_capacity_percent': system_data.get('mapped_capacity_percent'),
                    'available_written_capacity_bytes': system_data.get('available_written_capacity_bytes'),
                    'mapped_capacity_bytes': system_data.get('mapped_capacity_bytes'),
                    'available_volume_capacity_bytes': system_data.get('available_volume_capacity_bytes'),
                    'capacity_savings_percent': system_data.get('capacity_savings_percent'),
                    'overhead_capacity_bytes': system_data.get('overhead_capacity_bytes'),
                    'unmapped_capacity_bytes': system_data.get('unmapped_capacity_bytes'),
                    'capacity_bytes': system_data.get('capacity_bytes'),
                    'used_written_capacity_percent': system_data.get('used_written_capacity_percent'),
                    'shortfall_percent': system_data.get('shortfall_percent'),
                    'used_written_capacity_bytes': system_data.get('used_written_capacity_bytes'),
                    'available_system_capacity_bytes': system_data.get('available_system_capacity_bytes'),
                    'used_capacity_bytes': system_data.get('used_capacity_bytes'),
                    'deduplication_savings_percent': system_data.get('deduplication_savings_percent'),
                    'available_capacity_bytes': system_data.get('available_capacity_bytes'),
                    'used_capacity_percent': system_data.get('used_capacity_percent'),
                    'unprotected_volumes_count': system_data.get('unprotected_volumes_count'),
                    'provisioned_capacity_bytes': system_data.get('provisioned_capacity_bytes'),
                    'available_system_capacity_percent': system_data.get('available_system_capacity_percent'),
                    'deduplication_savings_bytes': system_data.get('deduplication_savings_bytes'),
                    
                    # Monitoring and timestamps
                    'last_successful_probe': system_data.get('last_successful_probe'),
                    'last_successful_monitor': system_data.get('last_successful_monitor'),
                    
                    # Customer and system info
                    'customer_country_code': system_data.get('customer_country_code'),
                    'events_status': system_data.get('events_status'),
                    'remote_relationships_count': system_data.get('remote_relationships_count'),
                    'customer_number': system_data.get('customer_number'),
                    'pm_status': system_data.get('pm_status'),
                    'data_collection': system_data.get('data_collection'),
                    'time_zone': system_data.get('time_zone'),
                    'staas_environment': system_data.get('staas_environment'),
                    'element_manager_url': system_data.get('element_manager_url'),
                    'probe_schedule': system_data.get('probe_schedule'),
                    'acknowledged': system_data.get('acknowledged'),
                    'compressed': system_data.get('compressed'),
                    'callhome_system': system_data.get('callhome_system'),
                    'ransomware_threat_detection': system_data.get('ransomware_threat_detection'),
                    'threat_notification_recipients': system_data.get('threat_notification_recipients'),
                    'data_collection_type': system_data.get('data_collection_type'),
                    'topology': system_data.get('topology'),
                    'cluster_id_alias': system_data.get('cluster_id_alias'),
                    
                    # Counts
                    'volumes_count': system_data.get('volumes_count'),
                    'pools_count': system_data.get('pools_count'),
                    'disks_count': system_data.get('disks_count'),
                    'fc_ports_count': system_data.get('fc_ports_count'),
                    'host_connections_count': system_data.get('host_connections_count'),
                    'ip_ports_count': system_data.get('ip_ports_count'),
                    'managed_disks_count': system_data.get('managed_disks_count'),
                    'volume_groups_count': system_data.get('volume_groups_count'),
                    
                    # Performance and efficiency
                    'recent_fill_rate': system_data.get('recent_fill_rate'),
                    'recent_growth': system_data.get('recent_growth'),
                    'current_power_usage_watts': system_data.get('current_power_usage_watts'),
                    'system_temperature_celsius': system_data.get('system_temperature_celsius'),
                    'system_temperature_Fahrenheit': system_data.get('system_temperature_Fahrenheit'),
                    'power_efficiency': system_data.get('power_efficiency'),
                    'co2_emission': system_data.get('co2_emission'),
                    
                    # Safeguarding
                    'safe_guarded_capacity_bytes': system_data.get('safe_guarded_capacity_bytes'),
                    'safeguarded_virtual_capacity_bytes': system_data.get('safeguarded_virtual_capacity_bytes'),
                    'safeguarded_used_capacity_percentage': system_data.get('safeguarded_used_capacity_percentage'),
                    
                    # Cache
                    'read_cache_bytes': system_data.get('read_cache_bytes'),
                    'write_cache_bytes': system_data.get('write_cache_bytes'),
                    
                    # Data reduction and compression
                    'data_reduction_savings_percent': system_data.get('data_reduction_savings_percent'),
                    'data_reduction_savings_bytes': system_data.get('data_reduction_savings_bytes'),
                    'data_reduction_ratio': system_data.get('data_reduction_ratio'),
                    'total_compression_ratio': system_data.get('total_compression_ratio'),
                    'drive_compression_savings_percent': system_data.get('drive_compression_savings_percent'),
                    'remaining_unallocated_capacity_bytes': system_data.get('remaining_unallocated_capacity_bytes'),
                    'pool_compression_savings_bytes': system_data.get('pool_compression_savings_bytes'),
                    'compression_savings_bytes': system_data.get('compression_savings_bytes'),
                    'compression_savings_percent': system_data.get('compression_savings_percent'),
                    'overprovisioned_capacity_bytes': system_data.get('overprovisioned_capacity_bytes'),
                    'unallocated_volume_capacity_bytes': system_data.get('unallocated_volume_capacity_bytes'),
                    'drive_compression_savings_bytes': system_data.get('drive_compression_savings_bytes'),
                    'pool_compression_savings_percent': system_data.get('pool_compression_savings_percent'),
                    'drive_compression_ratio': system_data.get('drive_compression_ratio'),
                    'pool_compression_ratio': system_data.get('pool_compression_ratio'),
                    'snapshot_written_capacity_bytes': system_data.get('snapshot_written_capacity_bytes'),
                    'snapshot_provisioned_capacity_bytes': system_data.get('snapshot_provisioned_capacity_bytes'),
                    'total_savings_ratio': system_data.get('total_savings_ratio'),
                    
                    # Timestamps
                    'imported': timezone.now(),
                    'updated': timezone.now(),
                }
                
                # Remove empty/None values
                defaults = {k: v for k, v in defaults.items() if v is not None and v != ''}
                
                # Create or update storage system using storage_system_id as unique identifier
                storage_system, created = Storage.objects.update_or_create(
                    storage_system_id=system_id,
                    customer=self.customer,
                    defaults=defaults
                )
                
                imported_count += 1
                    
            except Exception as e:
                # Log error but continue with other systems
                print(f"Error importing storage system {system_data.get('id', 'unknown')}: {e}")
                continue
        
        return imported_count
    
    def _get_mock_data(self):
        """Generate mock data for testing when API is not available"""
        storage_systems = [
            {
                'storage_system_id': 'mock_system_1',
                'name': 'Test FlashSystem 9200',
                'type': '2145',
                'model': '9200',
                'serial_number': 'TEST001',
                'vendor': 'IBM',
                'location': 'Test Data Center',
                'probe_status': 'successful',
                'condition': 'healthy',
                'raw_capacity_bytes': 1024 * 1024 * 1024 * 1024,  # 1TB
                'used_capacity_bytes': 512 * 1024 * 1024 * 1024,   # 512GB
                'available_capacity_bytes': 512 * 1024 * 1024 * 1024,  # 512GB
                'volumes_count': 5,
            },
            {
                'storage_system_id': 'mock_system_2', 
                'name': 'Test DS8000',
                'type': '2107',
                'model': '8000',
                'serial_number': 'TEST002',
                'vendor': 'IBM',
                'location': 'Test Data Center',
                'probe_status': 'successful',
                'condition': 'healthy',
                'raw_capacity_bytes': 2 * 1024 * 1024 * 1024 * 1024,  # 2TB
                'used_capacity_bytes': 1024 * 1024 * 1024 * 1024,    # 1TB
                'available_capacity_bytes': 1024 * 1024 * 1024 * 1024,  # 1TB
                'volumes_count': 10,
            }
        ]
        
        volumes_by_system = {
            'mock_system_1': [
                {
                    'volume_id': 'vol_1_1',
                    'name': 'Volume_001',
                    'capacity_bytes': 200 * 1024 * 1024 * 1024,  # 200GB
                    'used_capacity_bytes': 100 * 1024 * 1024 * 1024,  # 100GB
                    'pool_name': 'Pool_1',
                    'pool_id': 'pool_1',
                    'thin_provisioned': 'yes',
                    'compressed': True,
                },
                {
                    'volume_id': 'vol_1_2',
                    'name': 'Volume_002',
                    'capacity_bytes': 300 * 1024 * 1024 * 1024,  # 300GB
                    'used_capacity_bytes': 150 * 1024 * 1024 * 1024,  # 150GB
                    'pool_name': 'Pool_1',
                    'pool_id': 'pool_1',
                    'thin_provisioned': 'yes',
                    'compressed': True,
                }
            ],
            'mock_system_2': [
                {
                    'volume_id': 'vol_2_1',
                    'name': 'DS_Volume_001',
                    'capacity_bytes': 500 * 1024 * 1024 * 1024,  # 500GB
                    'used_capacity_bytes': 250 * 1024 * 1024 * 1024,  # 250GB
                    'pool_name': 'DS_Pool_1',
                    'pool_id': 'ds_pool_1',
                    'thin_provisioned': 'no',
                    'compressed': False,
                }
            ]
        }
        
        hosts_by_system = {
            'mock_system_1': [
                {
                    'id': 'host_1_1', 
                    'name': 'TestHost01',
                    'acknowledged': 'true',
                    'wwpns': ['10:00:00:05:1e:12:34:56', '10:00:00:05:1e:12:34:57'],
                    'status': 'online',
                    'storage_system': 'mock_system_1',
                    'associated_resource': 'resource_1',
                    'host_type': 'Linux',
                    'vols_count': 3,
                    'fc_ports_count': 2,
                    'last_data_collection': 1640995200,  # Unix timestamp
                    'volume_group': 'vg_test_01',
                    'natural_key': 'host_1_1_natural',
                },
                {
                    'id': 'host_1_2', 
                    'name': 'TestHost02',
                    'acknowledged': 'true',
                    'wwpns': ['10:00:00:05:1e:12:34:58', '10:00:00:05:1e:12:34:59'],
                    'status': 'online',
                    'storage_system': 'mock_system_1',
                    'associated_resource': 'resource_2',
                    'host_type': 'Windows',
                    'vols_count': 2,
                    'fc_ports_count': 2,
                    'last_data_collection': 1640995200,
                    'volume_group': 'vg_test_02',
                    'natural_key': 'host_1_2_natural',
                },
            ],
            'mock_system_2': [
                {
                    'id': 'host_2_1', 
                    'name': 'DSHost01',
                    'acknowledged': 'true',
                    'wwpns': ['10:00:00:05:1e:56:78:90', '10:00:00:05:1e:56:78:91'],
                    'status': 'online',
                    'storage_system': 'mock_system_2',
                    'associated_resource': 'resource_3',
                    'host_type': 'AIX',
                    'vols_count': 5,
                    'fc_ports_count': 4,
                    'last_data_collection': 1640995200,
                    'volume_group': 'vg_prod_01',
                    'natural_key': 'host_2_1_natural',
                },
                {
                    'id': 'host_2_2', 
                    'name': 'DSHost02',
                    'acknowledged': 'false',
                    'wwpns': ['10:00:00:05:1e:56:78:92', '10:00:00:05:1e:56:78:93'],
                    'status': 'offline',
                    'storage_system': 'mock_system_2',
                    'associated_resource': 'resource_4',
                    'host_type': 'Linux',
                    'vols_count': 1,
                    'fc_ports_count': 2,
                    'last_data_collection': 1640995100,
                    'volume_group': 'vg_test_03',
                    'natural_key': 'host_2_2_natural',
                },
                {
                    'id': 'host_2_3', 
                    'name': 'DSHost03',
                    'acknowledged': 'true',
                    'wwpns': ['10:00:00:05:1e:56:78:94', '10:00:00:05:1e:56:78:95'],
                    'status': 'online',
                    'storage_system': 'mock_system_2',
                    'associated_resource': 'resource_5',
                    'host_type': 'VMware',
                    'vols_count': 8,
                    'fc_ports_count': 4,
                    'last_data_collection': 1640995200,
                    'volume_group': 'vg_vmware_01',
                    'natural_key': 'host_2_3_natural',
                },
            ]
        }
        
        return storage_systems, volumes_by_system, hosts_by_system
    
    def _map_storage_type(self, api_type: str) -> str:
        """Map API storage type to model storage type"""
        type_mapping = {
            '2145': 'FlashSystem',
            '2107': 'DS8000',
            '2076': 'FlashSystem',  # Storwize -> FlashSystem
            'flashsystem': 'FlashSystem',
            'ds8000': 'DS8000',
            'storwize': 'FlashSystem',
        }
        
        # Check for exact matches first
        lower_type = str(api_type).lower()
        if lower_type in type_mapping:
            return type_mapping[lower_type]
        
        # Check for partial matches
        if 'flash' in lower_type:
            return 'FlashSystem'
        elif 'ds8' in lower_type or '2107' in str(api_type):
            return 'DS8000'
        elif 'storwize' in lower_type or '2076' in str(api_type):
            return 'FlashSystem'
        
        return 'Unknown'
    
    def _import_volumes(self, systems_data: List[Dict], volumes_by_system: Dict) -> int:
        """Import volumes with simple field mapping"""
        imported_count = 0
        
        # Create mapping of system IDs to Storage objects
        system_mapping = {}
        for system_data in systems_data:
            system_id = system_data.get('storage_system_id')  # Use correct field name
            if system_id:
                try:
                    system_mapping[system_id] = Storage.objects.get(
                        storage_system_id=system_id, 
                        customer=self.customer
                    )
                except Storage.DoesNotExist:
                    continue
        
        for system_id, volumes_data in volumes_by_system.items():
            storage_system = system_mapping.get(system_id)
            if not storage_system:
                continue
            
            for i, volume_data in enumerate(volumes_data):
                try:
                    volume_id = volume_data.get('volume_id')  # Use correct field name
                    volume_name = volume_data.get('name', '')
                    if not volume_id or not volume_name:
                        continue
                    
                    # Map API fields to Volume model fields with correct field names
                    defaults = {
                        'storage': storage_system,
                        'name': volume_name,
                        'volume_id': volume_id,
                        'capacity_bytes': volume_data.get('capacity_bytes'),  # Already in bytes
                        'used_capacity_bytes': volume_data.get('used_capacity_bytes'),
                        'used_capacity_percent': volume_data.get('used_capacity_percent'),
                        'available_capacity_bytes': volume_data.get('available_capacity_bytes'),
                        'written_capacity_bytes': volume_data.get('written_capacity_bytes'),
                        'written_capacity_percent': volume_data.get('written_capacity_percent'),
                        'reserved_volume_capacity_bytes': volume_data.get('reserved_volume_capacity_bytes'),
                        'pool_name': volume_data.get('pool_name', ''),
                        'pool_id': volume_data.get('pool_id', ''),
                        'thin_provisioned': volume_data.get('thin_provisioned', ''),
                        'compressed': volume_data.get('compressed'),
                        'unique_id': f"{system_id}_{volume_id}",  # Ensure uniqueness
                        'acknowledged': volume_data.get('acknowledged'),
                        'status_label': volume_data.get('status_label', ''),
                        'raid_level': volume_data.get('raid_level', ''),
                        'node': volume_data.get('node', ''),
                        'io_group': volume_data.get('io_group', ''),
                        'encryption': volume_data.get('encryption', ''),
                        'flashcopy': volume_data.get('flashcopy', ''),
                        'auto_expand': volume_data.get('auto_expand'),
                        'easy_tier': volume_data.get('easy_tier', ''),
                        'easy_tier_status': volume_data.get('easy_tier_status', ''),
                        'volume_number': volume_data.get('volume_number'),
                        'natural_key': volume_data.get('naturalKey', ''),
                        # Tier capacity fields
                        'tier0_flash_capacity_percent': volume_data.get('tier0_flash_capacity_percent'),
                        'tier1_flash_capacity_percent': volume_data.get('tier1_flash_capacity_percent'),
                        'scm_capacity_percent': volume_data.get('scm_capacity_percent'),
                        'enterprise_hdd_capacity_percent': volume_data.get('enterprise_hdd_capacity_percent'),
                        'nearline_hdd_capacity_percent': volume_data.get('nearline_hdd_capacity_percent'),
                        'tier0_flash_capacity_bytes': volume_data.get('tier0_flash_capacity_bytes'),
                        'tier1_flash_capacity_bytes': volume_data.get('tier1_flash_capacity_bytes'),
                        'scm_capacity_bytes': volume_data.get('scm_capacity_bytes'),
                        'enterprise_hdd_capacity_bytes': volume_data.get('enterprise_hdd_capacity_bytes'),
                        'nearline_hdd_capacity_bytes': volume_data.get('nearline_hdd_capacity_bytes'),
                        # Safeguarded fields
                        'safeguarded_virtual_capacity_bytes': volume_data.get('safeguarded_virtual_capacity_bytes'),
                        'safeguarded_used_capacity_percentage': volume_data.get('safeguarded_used_capacity_percentage'),
                        'safeguarded_allocation_capacity_bytes': volume_data.get('safeguarded_allocation_capacity_bytes'),
                    }
                    
                    # Remove empty/None values
                    defaults = {k: v for k, v in defaults.items() if v is not None and v != ''}
                    
                    # Create or update volume using unique_id
                    volume, created = Volume.objects.update_or_create(
                        unique_id=f"{system_id}_{volume_id}",
                        defaults=defaults
                    )
                    
                    imported_count += 1
                        
                except Exception as e:
                    print(f"Error importing volume {volume_data.get('id', 'unknown')}: {e}")
                    continue
        
        return imported_count
    
    def _import_hosts(self, hosts_by_system: Dict) -> int:
        """Import hosts to database"""
        imported_count = 0
        
        print(f"🔍 DEBUG: _import_hosts called with {len(hosts_by_system)} systems")
        
        # Log debug info to import logs
        from .models import ImportLog
        ImportLog.objects.create(
            import_record=self.import_record,
            level='DEBUG',
            message=f"Starting host import for {len(hosts_by_system)} storage systems"
        )
        
        for system_id, hosts_data in hosts_by_system.items():
            print(f"🔍 DEBUG: Processing system {system_id} with {len(hosts_data)} hosts")
            
            ImportLog.objects.create(
                import_record=self.import_record,
                level='DEBUG',
                message=f"Processing storage system {system_id}: {len(hosts_data)} hosts to import"
            )
            
            try:
                # Find the storage system for this system_id
                storage_system = Storage.objects.filter(
                    storage_system_id=system_id,
                    customer=self.customer
                ).first()
                
                if not storage_system:
                    error_msg = f"Storage system {system_id} not found in database, skipping {len(hosts_data)} hosts"
                    print(f"⚠️ {error_msg}")
                    ImportLog.objects.create(
                        import_record=self.import_record,
                        level='WARNING',
                        message=error_msg
                    )
                    continue
                
                print(f"✅ Found storage system: {storage_system.name} (ID: {storage_system.id})")
                
                # Log sample host data for debugging
                if hosts_data:
                    sample_host = hosts_data[0]
                    ImportLog.objects.create(
                        import_record=self.import_record,
                        level='DEBUG',
                        message=f"Sample host data from API",
                        details=sample_host
                    )
                
                for i, host_data in enumerate(hosts_data):
                    try:
                        host_name = host_data.get('name', f'Unknown_Host_{i}')
                        print(f"🔍 Processing host {i+1}/{len(hosts_data)}: {host_name}")
                        
                        # Log the raw host data structure including WWPN format
                        wwpn_debug_info = {
                            'wwpns_raw': host_data.get('wwpns'),
                            'wwpns_type': type(host_data.get('wwpns')).__name__ if host_data.get('wwpns') else None,
                            'wwpns_length': len(host_data.get('wwpns', [])) if isinstance(host_data.get('wwpns'), (list, str)) else None
                        }
                        
                        ImportLog.objects.create(
                            import_record=self.import_record,
                            level='DEBUG',
                            message=f"Processing host: {host_name} - WWPN analysis",
                            details={
                                'wwpn_debug': wwpn_debug_info,
                                'formatted_wwpns': self._format_wwpns(host_data.get('wwpns', [])),
                                'project_id': self.project.id if self.project else None,
                                'storage_system_id': storage_system.id
                            }
                        )
                        
                        # Map API fields to Host model fields
                        defaults = {
                            'project': self.project,
                            'storage': storage_system,
                            'name': host_name,
                            'acknowledged': host_data.get('acknowledged', ''),
                            'wwpns': self._format_wwpns(host_data.get('wwpns', [])),
                            'status': host_data.get('status', ''),
                            'storage_system': host_data.get('storage_system', ''),
                            'associated_resource': host_data.get('associated_resource', ''),
                            'host_type': host_data.get('host_type', ''),
                            'vols_count': host_data.get('vols_count'),
                            'fc_ports_count': host_data.get('fc_ports_count'),
                            'last_data_collection': host_data.get('last_data_collection'),
                            'volume_group': host_data.get('volume_group', ''),
                            'natural_key': host_data.get('natural_key', ''),
                        }
                        
                        # Remove empty/None values
                        defaults = {k: v for k, v in defaults.items() if v is not None and v != ''}
                        
                        # Create or update host using name and project as unique identifier
                        host, created = Host.objects.update_or_create(
                            name=host_name,
                            project=self.project,
                            defaults=defaults
                        )
                        
                        # Verify the storage relationship
                        ImportLog.objects.create(
                            import_record=self.import_record,
                            level='DEBUG',
                            message=f"Host {host.name} storage relationship",
                            details={
                                'host_id': host.id,
                                'host_storage_id': host.storage.id if host.storage else None,
                                'host_storage_system_id': host.storage.storage_system_id if host.storage else None,
                                'expected_storage_system_id': system_id
                            }
                        )
                        
                        # Update timestamps
                        host.imported = timezone.now()
                        if not created:
                            host.updated = timezone.now()
                        host.save()
                        
                        imported_count += 1
                        
                        action = "Created" if created else "Updated"
                        success_msg = f"{action} host: {host.name} (ID: {host.id})"
                        print(f"✅ {success_msg}")
                        
                        ImportLog.objects.create(
                            import_record=self.import_record,
                            level='INFO',
                            message=success_msg
                        )
                        
                    except Exception as e:
                        error_msg = f"Failed to import host {host_data.get('name', 'Unknown')}: {str(e)}"
                        print(f"❌ {error_msg}")
                        ImportLog.objects.create(
                            import_record=self.import_record,
                            level='ERROR',
                            message=error_msg,
                            details={'host_data': host_data, 'error': str(e)}
                        )
                        continue
                        
            except Exception as e:
                error_msg = f"Failed to import hosts for system {system_id}: {str(e)}"
                print(f"❌ {error_msg}")
                ImportLog.objects.create(
                    import_record=self.import_record,
                    level='ERROR',
                    message=error_msg
                )
                continue
        
        # Final summary
        summary_msg = f"Host import completed: {imported_count} hosts successfully imported to database"
        print(f"🏁 {summary_msg}")
        ImportLog.objects.create(
            import_record=self.import_record,
            level='INFO',
            message=summary_msg
        )
        
        return imported_count
    
    def _format_wwpns(self, wwpns_data):
        """Format WWPNs from IBM Storage Insights API format to standard format"""
        if not wwpns_data:
            return ''
        
        formatted_wwpns = []
        
        # Handle case where wwpns_data is a string (most common case)
        if isinstance(wwpns_data, str):
            # Split by comma to get individual WWPNs: "C050760C392D0076,C050760C392D0077" -> ["C050760C392D0076", "C050760C392D0077"]
            wwpn_strings = [wwpn.strip() for wwpn in wwpns_data.split(',') if wwpn.strip()]
            
            for wwpn_hex in wwpn_strings:
                # Clean up the hex string
                clean_wwpn = wwpn_hex.replace(':', '').replace('-', '').replace(' ', '').upper()
                
                # Validate it's 16 hex characters (8 bytes)
                if len(clean_wwpn) == 16 and all(c in '0123456789ABCDEF' for c in clean_wwpn):
                    # Format as standard WWPN: XX:XX:XX:XX:XX:XX:XX:XX
                    formatted_wwpn = ':'.join([clean_wwpn[i:i+2] for i in range(0, 16, 2)])
                    formatted_wwpns.append(formatted_wwpn)
        
        # Handle case where wwpns_data is a list
        elif isinstance(wwpns_data, list):
            for wwpn_raw in wwpns_data:
                if not wwpn_raw:
                    continue
                    
                if isinstance(wwpn_raw, str):
                    # Handle individual WWPN strings in the list
                    clean_wwpn = wwpn_raw.replace(':', '').replace('-', '').replace(' ', '').upper()
                    if len(clean_wwpn) == 16 and all(c in '0123456789ABCDEF' for c in clean_wwpn):
                        formatted_wwpn = ':'.join([clean_wwpn[i:i+2] for i in range(0, 16, 2)])
                        formatted_wwpns.append(formatted_wwpn)
                
                elif isinstance(wwpn_raw, list) and len(wwpn_raw) >= 16:
                    # Handle list of individual hex chars like ['C','0','5','0',...]
                    hex_chars = [str(x).strip() for x in wwpn_raw[:16] if x is not None and str(x).strip()]
                    if len(hex_chars) >= 16:
                        clean_wwpn = ''.join(hex_chars[:16]).upper()
                        if len(clean_wwpn) == 16 and all(c in '0123456789ABCDEF' for c in clean_wwpn):
                            formatted_wwpn = ':'.join([clean_wwpn[i:i+2] for i in range(0, 16, 2)])
                            formatted_wwpns.append(formatted_wwpn)
        
        return ', '.join(formatted_wwpns)
    
    def _parse_capacity_to_bytes(self, capacity_str) -> int:
        """Parse capacity string/number to bytes value"""
        if not capacity_str:
            return 0
        
        try:
            # If it's already a number, assume it's in bytes
            if isinstance(capacity_str, (int, float)):
                return int(capacity_str)
            
            # Remove units and convert string values
            capacity_str = str(capacity_str).upper().replace(' ', '')
            
            if 'TB' in capacity_str:
                return int(float(capacity_str.replace('TB', '')) * 1024 * 1024 * 1024 * 1024)
            elif 'GB' in capacity_str:
                return int(float(capacity_str.replace('GB', '')) * 1024 * 1024 * 1024)
            elif 'MB' in capacity_str:
                return int(float(capacity_str.replace('MB', '')) * 1024 * 1024)
            elif 'KB' in capacity_str:
                return int(float(capacity_str.replace('KB', '')) * 1024)
            else:
                # Assume it's already in bytes
                return int(float(capacity_str))
                
        except (ValueError, TypeError):
            return 0